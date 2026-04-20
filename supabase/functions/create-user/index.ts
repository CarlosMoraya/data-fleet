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
  "Driver": 1,
  "Workshop": 1,
  "Yard Auditor": 2,
  "Fleet Assistant": 3,
  "Fleet Analyst": 4,
  "Supervisor": 5,
  "Coordinator": 6,
  "Manager": 7,
  "Director": 8,
  "Admin Master": 9,
};

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

    // Autenticar o caller
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Não autorizado" }, 401);

    const token = authHeader.replace("Bearer ", "");
    const { data: { user: caller }, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !caller) return json({ error: "Token inválido" }, 401);

    // Buscar perfil do caller (role + client_id)
    const { data: callerProfile } = await supabaseAdmin
      .from("profiles")
      .select("role, client_id")
      .eq("id", caller.id)
      .single();

    if (!callerProfile) return json({ error: "Perfil não encontrado" }, 403);

    const callerRank = ROLE_RANK[callerProfile.role] ?? 0;
    console.log(`Caller: ${caller.email} (${callerProfile.role}, rank ${callerRank})`);

    // Apenas Fleet Assistant ou superior pode criar usuários
    if (callerRank < ROLE_RANK["Fleet Assistant"]) {
      console.error(`Acesso negado: ${callerProfile.role} tentou criar usuário.`);
      return json({ error: "Acesso negado. Papel insuficiente." }, 403);
    }

    const body = await req.json();

    // ── Ação: deletar usuário ──────────────────────────────────────────────────
    if (body.action === "delete") {
      const { user_id } = body;
      if (!user_id) return json({ error: "user_id é obrigatório." }, 400);

      // Buscar perfil do target para validar hierarquia
      const { data: targetProfile } = await supabaseAdmin
        .from("profiles")
        .select("role, client_id")
        .eq("id", user_id)
        .single();

      if (!targetProfile) return json({ error: "Usuário não encontrado." }, 404);

      const targetRank = ROLE_RANK[targetProfile.role] ?? 0;

      // Caller deve ter rank estritamente maior que o target
      if (callerRank <= targetRank) {
        return json({ error: "Você não tem permissão para excluir este usuário." }, 403);
      }

      // Multi-tenancy: Admin Master pode deletar de qualquer cliente; outros só do próprio
      if (callerProfile.role !== "Admin Master" && targetProfile.client_id !== callerProfile.client_id) {
        return json({ error: "Você não tem permissão para excluir usuários de outro cliente." }, 403);
      }

      // Deletar perfil primeiro (FK constraint)
      const { error: profileDeleteError } = await supabaseAdmin
        .from("profiles")
        .delete()
        .eq("id", user_id);

      if (profileDeleteError) {
        console.error(`[delete] Erro ao deletar perfil: ${profileDeleteError.message}`);
        return json({ error: profileDeleteError.message }, 500);
      }

      // Deletar conta auth
      const { error: authDeleteError } = await supabaseAdmin.auth.admin.deleteUser(user_id);
      if (authDeleteError && authDeleteError.message !== "User not found") {
        console.error(`[delete] Erro ao deletar auth user: ${authDeleteError.message}`);
      }

      console.log(`[delete] Usuário deletado com sucesso: ${user_id}`);
      return json({ success: true, user_id }, 200);
    }

    // ── Ação: criar usuário (padrão) ──────────────────────────────────────────
    const { email, password, name, role, client_id, can_delete_vehicles, can_delete_drivers, can_delete_workshops, budget_approval_limit } = body;

    if (!email || !password || !name || !role) {
      return json({ error: "Todos os campos são obrigatórios." }, 400);
    }

    const targetRank = ROLE_RANK[role] ?? 0;

    // Validar hierarquia: só pode criar papéis estritamente abaixo do seu
    // EXCEÇÃO: Admin Master pode criar outro Admin Master
    if (targetRank > callerRank || (targetRank === callerRank && callerProfile.role !== "Admin Master")) {
      return json({ error: `Você não tem permissão para criar usuários com o papel "${role}".` }, 403);
    }

    // Admin Master pode especificar client_id; demais usam o próprio
    const targetClientId = callerProfile.role === "Admin Master" && client_id
      ? client_id
      : callerProfile.client_id;

    // Criar conta no Supabase Auth
    const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });

    if (createError) {
      const isEmailConflict = createError.message.toLowerCase().includes("already");
      if (isEmailConflict && (role === "Driver" || role === "Workshop")) {
        // get-or-create semântico: retornar profileId do usuário existente se for Driver/Workshop do mesmo client
        const { data: { users } } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 });
        const existing = users.find((u: { email?: string; id: string }) => u.email === email.toLowerCase());
        if (existing) {
          const { data: existingProfile } = await supabaseAdmin
            .from("profiles")
            .select("role, client_id")
            .eq("id", existing.id)
            .single();
          if (existingProfile?.role === role && existingProfile?.client_id === targetClientId) {
            console.log(`${role} já existe: ${email} — retornando profileId existente.`);
            return json({ id: existing.id, profileId: existing.id }, 200);
          }
        }
      }
      return json({ error: createError.message }, 400);
    }

    // Criar perfil na tabela profiles
    const { error: profileError } = await supabaseAdmin
      .from("profiles")
      .insert({
        id: newUser.user.id,
        name,
        role,
        client_id: targetClientId,
        can_delete_vehicles: can_delete_vehicles ?? false,
        can_delete_drivers: can_delete_drivers ?? false,
        can_delete_workshops: can_delete_workshops ?? false,
        budget_approval_limit: budget_approval_limit ?? 0,
      });

    if (profileError) {
      // Rollback: deletar o auth user criado
      await supabaseAdmin.auth.admin.deleteUser(newUser.user.id);
      return json({ error: profileError.message }, 400);
    }

    return json({ id: newUser.user.id, profileId: newUser.user.id }, 200);
  } catch (err) {
    return json({ error: String(err) }, 500);
  }
});
