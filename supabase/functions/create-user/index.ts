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

    // Verificar que o caller é Admin Master
    const { data: callerProfile } = await supabaseAdmin
      .from("profiles")
      .select("role")
      .eq("id", caller.id)
      .single();

    if (callerProfile?.role !== "Admin Master") {
      return json({ error: "Acesso negado. Apenas Admin Master pode criar usuários." }, 403);
    }

    // Ler os dados do novo usuário
    const { email, password, name, role, client_id } = await req.json();

    if (!email || !password || !name || !role || !client_id) {
      return json({ error: "Todos os campos são obrigatórios." }, 400);
    }

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
      .insert({ id: newUser.user.id, name, role, client_id });

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
