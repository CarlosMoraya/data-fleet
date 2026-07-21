import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

const ROLE_RANK: Record<string, number> = {
  "Coupling Agent": 0,
  "Driver": 0,
  "Yard Auditor": 1,
  "Workshop": 2,
  "Fleet Assistant": 3,
  "Fleet Analyst": 4,
  "Supervisor": 5,
  "Operations Manager": 5,
  "Coordinator": 6,
  "Manager": 7,
  "Director": 8,
  "Admin Master": 9,
};

const OPERATIONS_MANAGER_ROLE = "Operations Manager";

function isOperationsManager(role: string | null | undefined): boolean {
  return role === OPERATIONS_MANAGER_ROLE;
}

function canManageOperationsManagerScope(role: string): boolean {
  return role === "Coordinator" || role === "Manager" || role === "Director" || role === "Admin Master";
}

async function validateOperationsManagerScope(params: {
  supabaseAdmin: ReturnType<typeof createClient>;
  targetClientId: string | null;
  shipperIds: string[];
  operationalUnitIds: string[];
}) {
  const { supabaseAdmin, targetClientId, shipperIds, operationalUnitIds } = params;

  if (!targetClientId) {
    throw new Error("Não foi possível determinar o client_id de destino para o Gestor de Operações.");
  }

  if (!Array.isArray(shipperIds) || shipperIds.length === 0) {
    throw new Error("shipper_ids é obrigatório para Operations Manager.");
  }

  if (!Array.isArray(operationalUnitIds) || operationalUnitIds.length === 0) {
    throw new Error("operational_unit_ids é obrigatório para Operations Manager.");
  }

  const { data: shippers, error: shippersError } = await supabaseAdmin
    .from("shippers")
    .select("id, client_id")
    .in("id", shipperIds);

  if (shippersError) throw new Error(shippersError.message);
  if ((shippers ?? []).length !== shipperIds.length) {
    throw new Error("Um ou mais embarcadores informados não existem.");
  }

  if ((shippers ?? []).some((shipper: any) => shipper.client_id !== targetClientId)) {
    throw new Error("Todos os embarcadores devem pertencer ao client_id do usuário que será criado/editado.");
  }

  const { data: units, error: unitsError } = await supabaseAdmin
    .from("operational_units")
    .select("id, client_id, shipper_id")
    .in("id", operationalUnitIds);

  if (unitsError) throw new Error(unitsError.message);
  if ((units ?? []).length !== operationalUnitIds.length) {
    throw new Error("Uma ou mais bases operacionais informadas não existem.");
  }

  const shipperIdSet = new Set(shipperIds);
  for (const unit of units ?? []) {
    if (unit.client_id !== targetClientId) {
      throw new Error("Todas as bases operacionais devem pertencer ao client_id do usuário que será criado/editado.");
    }

    if (!shipperIdSet.has(unit.shipper_id)) {
      throw new Error("Toda base operacional associada deve pertencer a um embarcador selecionado.");
    }
  }

  return {
    shipperIds,
    operationalUnitIds,
  };
}

async function syncOperationsManagerScope(params: {
  supabaseAdmin: ReturnType<typeof createClient>;
  profileId: string;
  clientId: string;
  createdBy: string;
  shipperIds: string[];
  operationalUnitIds: string[];
}) {
  const { supabaseAdmin, profileId, clientId, createdBy, shipperIds, operationalUnitIds } = params;

  const { error: deleteUnitsError } = await supabaseAdmin
    .from("profile_operational_unit_scopes")
    .delete()
    .eq("profile_id", profileId);
  if (deleteUnitsError) throw new Error(deleteUnitsError.message);

  const { error: deleteShippersError } = await supabaseAdmin
    .from("profile_shipper_scopes")
    .delete()
    .eq("profile_id", profileId);
  if (deleteShippersError) throw new Error(deleteShippersError.message);

  const { error: shipperInsertError } = await supabaseAdmin
    .from("profile_shipper_scopes")
    .insert(
      shipperIds.map((shipperId) => ({
        profile_id: profileId,
        shipper_id: shipperId,
        client_id: clientId,
        created_by: createdBy,
      }))
    );
  if (shipperInsertError) throw new Error(shipperInsertError.message);

  const { error: unitInsertError } = await supabaseAdmin
    .from("profile_operational_unit_scopes")
    .insert(
      operationalUnitIds.map((operationalUnitId) => ({
        profile_id: profileId,
        operational_unit_id: operationalUnitId,
        client_id: clientId,
        created_by: createdBy,
      }))
    );
  if (unitInsertError) throw new Error(unitInsertError.message);
}

async function logPasswordReset(params: {
  supabaseAdmin: ReturnType<typeof createClient>;
  clientId: string | null;
  driverProfileId: string;
  driverName: string;
  resetById: string;
}): Promise<void> {
  const { supabaseAdmin, clientId, driverProfileId, driverName, resetById } = params;

  try {
    const { data: resetByProfile } = await supabaseAdmin
      .from("profiles")
      .select("name")
      .eq("id", resetById)
      .single();

    const resetByName = resetByProfile?.name ?? "—";

    const { error: insertError } = await supabaseAdmin
      .from("driver_password_reset_log")
      .insert({
        client_id: clientId,
        driver_profile_id: driverProfileId,
        driver_name: driverName,
        reset_by_id: resetById,
        reset_by_name: resetByName,
      });

    if (insertError) {
      console.error(`[reset-password] Erro ao gravar auditoria: ${insertError.message}`);
    }
  } catch (err) {
    console.error(`[reset-password] Erro ao gravar auditoria: ${String(err)}`);
  }
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Não autorizado" }, 401);

    const token = authHeader.replace("Bearer ", "");
    const { data: { user: caller }, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !caller) return json({ error: "Token inválido" }, 401);

    const { data: callerProfile } = await supabaseAdmin
      .from("profiles")
      .select("role, client_id")
      .eq("id", caller.id)
      .single();

    if (!callerProfile) return json({ error: "Perfil não encontrado" }, 403);

    const callerRank = ROLE_RANK[callerProfile.role] ?? 0;
    if (callerRank < ROLE_RANK["Fleet Assistant"]) {
      return json({ error: "Acesso negado. Papel insuficiente." }, 403);
    }

    if (isOperationsManager(callerProfile.role)) {
      return json({ error: "Operations Manager não pode criar, editar escopo ou excluir usuários." }, 403);
    }

    const body = await req.json();

    if (body.action === "delete") {
      const { user_id } = body;
      if (!user_id) return json({ error: "user_id é obrigatório." }, 400);

      const { data: targetProfile } = await supabaseAdmin
        .from("profiles")
        .select("role, client_id")
        .eq("id", user_id)
        .single();

      if (!targetProfile) return json({ error: "Usuário não encontrado." }, 404);

      const targetRank = ROLE_RANK[targetProfile.role] ?? 0;
      if (callerRank <= targetRank) {
        return json({ error: "Você não tem permissão para excluir este usuário." }, 403);
      }

      if (callerProfile.role !== "Admin Master" && targetProfile.client_id !== callerProfile.client_id) {
        return json({ error: "Você não tem permissão para excluir usuários de outro cliente." }, 403);
      }

      const { error: profileDeleteError } = await supabaseAdmin
        .from("profiles")
        .delete()
        .eq("id", user_id);

      if (profileDeleteError) {
        return json({ error: profileDeleteError.message }, 500);
      }

      const { error: authDeleteError } = await supabaseAdmin.auth.admin.deleteUser(user_id);
      if (authDeleteError && authDeleteError.message !== "User not found") {
        console.error(`[delete] Erro ao deletar auth user: ${authDeleteError.message}`);
      }

      return json({ success: true, user_id }, 200);
    }

    if (body.action === "block" || body.action === "unblock") {
      const { user_id } = body;
      if (!user_id) return json({ error: "user_id é obrigatório." }, 400);

      const { data: targetProfile } = await supabaseAdmin
        .from("profiles").select("role, client_id").eq("id", user_id).single();
      if (!targetProfile) return json({ error: "Usuário não encontrado." }, 404);

      const targetRank = ROLE_RANK[targetProfile.role] ?? 0;
      if (callerRank <= targetRank) {
        return json({ error: "Você não tem permissão para bloquear este usuário." }, 403);
      }
      if (callerProfile.role !== "Admin Master" && targetProfile.client_id !== callerProfile.client_id) {
        return json({ error: "Você não tem permissão para bloquear usuários de outro cliente." }, 403);
      }

      const ban_duration = body.action === "block" ? "87600h" : "none";
      const { error: banError } = await supabaseAdmin.auth.admin.updateUserById(user_id, { ban_duration });
      if (banError) return json({ error: banError.message }, 500);
      return json({ success: true, user_id, action: body.action }, 200);
    }

    if (body.action === "sync_operations_scope") {
      const { target_user_id, shipper_ids = [], operational_unit_ids = [] } = body;

      if (!canManageOperationsManagerScope(callerProfile.role)) {
        return json({ error: "Apenas Coordinator+ podem editar o escopo do Operations Manager." }, 403);
      }

      if (!target_user_id) {
        return json({ error: "target_user_id é obrigatório." }, 400);
      }

      const { data: targetProfile } = await supabaseAdmin
        .from("profiles")
        .select("id, role, client_id")
        .eq("id", target_user_id)
        .single();

      if (!targetProfile) return json({ error: "Usuário alvo não encontrado." }, 404);
      if (!isOperationsManager(targetProfile.role)) {
        return json({ error: "O usuário alvo precisa ter role Operations Manager." }, 400);
      }
      if (callerProfile.role !== "Admin Master" && targetProfile.client_id !== callerProfile.client_id) {
        return json({ error: "Você só pode editar o escopo de usuários do seu próprio cliente." }, 403);
      }

      const validatedScope = await validateOperationsManagerScope({
        supabaseAdmin,
        targetClientId: targetProfile.client_id,
        shipperIds: shipper_ids,
        operationalUnitIds: operational_unit_ids,
      });

      await syncOperationsManagerScope({
        supabaseAdmin,
        profileId: targetProfile.id,
        clientId: targetProfile.client_id,
        createdBy: caller.id,
        shipperIds: validatedScope.shipperIds,
        operationalUnitIds: validatedScope.operationalUnitIds,
      });

      return json({ success: true }, 200);
    }

    if (body.action === "reset-password") {
      const { user_id, new_password } = body;

      if (!user_id || !new_password) {
        return json({ error: "user_id e new_password são obrigatórios." }, 400);
      }

      if (new_password.length < 8) {
        return json({ error: "A senha deve ter pelo menos 8 caracteres." }, 400);
      }

      if (callerRank < ROLE_RANK["Fleet Analyst"]) {
        return json({ error: "Acesso negado. Apenas Fleet Analyst ou superior pode redefinir senha de motorista." }, 403);
      }

      const { data: targetProfile } = await supabaseAdmin
        .from("profiles")
        .select("role, client_id, name")
        .eq("id", user_id)
        .single();

      if (!targetProfile) return json({ error: "Usuário não encontrado." }, 404);

      if (targetProfile.role !== "Driver") {
        return json({ error: "Só é permitido redefinir a senha de motoristas." }, 403);
      }

      if (callerProfile.role !== "Admin Master" && targetProfile.client_id !== callerProfile.client_id) {
        return json({ error: "Você não tem permissão para redefinir a senha de motoristas de outro cliente." }, 403);
      }

      const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(user_id, {
        password: new_password,
      });
      if (updateError) return json({ error: updateError.message }, 400);

      await logPasswordReset({
        supabaseAdmin,
        clientId: targetProfile.client_id,
        driverProfileId: user_id,
        driverName: targetProfile.name,
        resetById: caller.id,
      });

      let email: string | null = null;
      try {
        const { data: userData } = await supabaseAdmin.auth.admin.getUserById(user_id);
        email = userData?.user?.email ?? null;
      } catch (err) {
        console.error(`[reset-password] Erro ao buscar email: ${String(err)}`);
      }

      return json({ success: true, email }, 200);
    }

    const {
      email,
      password,
      name,
      role,
      client_id,
      budget_approval_limit,
      shipper_ids = [],
      operational_unit_ids = [],
    } = body;

    if (!email || !password || !name || !role) {
      return json({ error: "Todos os campos são obrigatórios." }, 400);
    }

    const targetRank = ROLE_RANK[role] ?? 0;
    if (targetRank > callerRank || (targetRank === callerRank && callerProfile.role !== "Admin Master")) {
      return json({ error: `Você não tem permissão para criar usuários com o papel "${role}".` }, 403);
    }

    if (isOperationsManager(role)) {
      if (!canManageOperationsManagerScope(callerProfile.role)) {
        return json({ error: "Apenas Coordinator+ podem criar Operations Manager." }, 403);
      }
    }

    const targetClientId = callerProfile.role === "Admin Master" && client_id
      ? client_id
      : callerProfile.client_id;

    let validatedScope: { shipperIds: string[]; operationalUnitIds: string[] } | null = null;
    if (isOperationsManager(role)) {
      validatedScope = await validateOperationsManagerScope({
        supabaseAdmin,
        targetClientId,
        shipperIds: shipper_ids,
        operationalUnitIds: operational_unit_ids,
      });
    }

    const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });

    if (createError) {
      const isEmailConflict = createError.message.toLowerCase().includes("already");
      if (isEmailConflict && (role === "Driver" || role === "Workshop")) {
        const { data: { users } } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 });
        const existing = users.find((u: { email?: string; id: string }) => u.email === email.toLowerCase());
        if (existing) {
          const { data: existingProfile } = await supabaseAdmin
            .from("profiles")
            .select("role, client_id")
            .eq("id", existing.id)
            .single();
          if (existingProfile?.role === role && existingProfile?.client_id === targetClientId) {
            return json({ id: existing.id, profileId: existing.id }, 200);
          }
        }
      }
      return json({ error: createError.message }, 400);
    }

    const { error: profileError } = await supabaseAdmin
      .from("profiles")
      .insert({
        id: newUser.user.id,
        name,
        role,
        client_id: targetClientId,
        budget_approval_limit: isOperationsManager(role) ? 0 : budget_approval_limit ?? 0,
      });

    if (profileError) {
      await supabaseAdmin.auth.admin.deleteUser(newUser.user.id);
      return json({ error: profileError.message }, 400);
    }

    try {
      if (validatedScope && targetClientId) {
        await syncOperationsManagerScope({
          supabaseAdmin,
          profileId: newUser.user.id,
          clientId: targetClientId,
          createdBy: caller.id,
          shipperIds: validatedScope.shipperIds,
          operationalUnitIds: validatedScope.operationalUnitIds,
        });
      }
    } catch (scopeError) {
      await supabaseAdmin.from("profiles").delete().eq("id", newUser.user.id);
      await supabaseAdmin.auth.admin.deleteUser(newUser.user.id);
      return json({ error: scopeError instanceof Error ? scopeError.message : String(scopeError) }, 400);
    }

    return json({ id: newUser.user.id, profileId: newUser.user.id }, 200);
  } catch (err) {
    return json({ error: String(err) }, 500);
  }
});
