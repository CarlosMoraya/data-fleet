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
    console.log(`[delete-user] Caller: ${caller.email} (${callerProfile.role}, rank ${callerRank})`);

    // Apenas Fleet Assistant ou superior pode deletar usuários
    if (callerRank < ROLE_RANK["Fleet Assistant"]) {
      console.error(`[delete-user] Acesso negado: ${callerProfile.role}`);
      return json({ error: "Acesso negado. Papel insuficiente." }, 403);
    }

    const body = await req.json();
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
      console.error(`[delete-user] Erro ao deletar perfil: ${profileDeleteError.message}`);
      return json({ error: profileDeleteError.message }, 500);
    }

    // Deletar conta auth
    const { error: authDeleteError } = await supabaseAdmin.auth.admin.deleteUser(user_id);
    if (authDeleteError && authDeleteError.message !== "User not found") {
      console.error(`[delete-user] Erro ao deletar auth user: ${authDeleteError.message}`);
      // Não falhar se o auth user já não existir (perfil já deletado)
    }

    console.log(`[delete-user] Usuário deletado com sucesso: ${user_id}`);
    return json({ success: true, user_id }, 200);
  } catch (err) {
    console.error(`[delete-user] Erro inesperado:`, err);
    return json({ error: String(err) }, 500);
  }
});
