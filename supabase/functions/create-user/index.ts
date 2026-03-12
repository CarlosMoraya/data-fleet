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
  "Yard Auditor": 2,
  "Fleet Assistant": 3,
  "Fleet Analyst": 4,
  "Manager": 5,
  "Director": 6,
  "Admin Master": 7,
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

    // Apenas Fleet Assistant ou superior pode criar usuários
    if (callerRank < ROLE_RANK["Fleet Assistant"]) {
      return json({ error: "Acesso negado. Papel insuficiente." }, 403);
    }

    const body = await req.json();
    const { action } = body;

    // ─── AÇÃO: DELETAR USUÁRIO ───────────────────────────────────────
    if (action === "delete") {
      const { user_id } = body;
      if (!user_id) return json({ error: "user_id é obrigatório." }, 400);

      // Deletar perfil
      await supabaseAdmin.from("profiles").delete().eq("id", user_id);
      // Deletar conta auth
      await supabaseAdmin.auth.admin.deleteUser(user_id);

      return json({ success: true }, 200);
    }

    // ─── AÇÃO: CRIAR USUÁRIO (padrão) ────────────────────────────────
    const { email, password, name, role, client_id, can_delete_vehicles, can_delete_drivers } = body;

    if (!email || !password || !name || !role) {
      return json({ error: "Todos os campos são obrigatórios." }, 400);
    }

    const targetRank = ROLE_RANK[role] ?? 0;

    // Validar hierarquia: só pode criar papéis estritamente abaixo do seu
    if (targetRank >= callerRank) {
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

    if (createError) return json({ error: createError.message }, 400);

    // Criar perfil na tabela profiles
    const { error: profileError } = await supabaseAdmin
      .from("profiles")
      .insert({ id: newUser.user.id, name, role, client_id: targetClientId, can_delete_vehicles: can_delete_vehicles ?? false, can_delete_drivers: can_delete_drivers ?? false });

    if (profileError) {
      // Rollback: deletar o auth user criado
      await supabaseAdmin.auth.admin.deleteUser(newUser.user.id);
      return json({ error: profileError.message }, 400);
    }

    return json({ id: newUser.user.id }, 200);
  } catch (err) {
    return json({ error: String(err) }, 500);
  }
});
