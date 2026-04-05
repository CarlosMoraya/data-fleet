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

/** Gera token criptograficamente seguro de 48 caracteres URL-safe */
function generateToken(): string {
  const bytes = new Uint8Array(36);
  crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "");
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

    // Buscar perfil do caller
    const { data: callerProfile } = await supabaseAdmin
      .from("profiles")
      .select("role, client_id")
      .eq("id", caller.id)
      .single();

    if (!callerProfile) return json({ error: "Perfil não encontrado" }, 403);

    const callerRank = ROLE_RANK[callerProfile.role] ?? 0;

    // Apenas Fleet Assistant ou superior pode gerenciar convites
    if (callerRank < ROLE_RANK["Fleet Assistant"]) {
      return json({ error: "Acesso negado. Papel insuficiente." }, 403);
    }

    const body = await req.json();
    const { action } = body;

    // ─── AÇÃO: CRIAR CONVITE ─────────────────────────────────
    if (action === "create") {
      const clientId = callerProfile.role === "Admin Master"
        ? (body.client_id ?? callerProfile.client_id)
        : callerProfile.client_id;

      if (!clientId) return json({ error: "client_id é obrigatório" }, 400);

      const inviteToken = generateToken();
      const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(); // +30 dias

      const { data: invitation, error: insertError } = await supabaseAdmin
        .from("workshop_invitations")
        .insert({
          client_id: clientId,
          token: inviteToken,
          status: "pending",
          invited_by: caller.id,
          expires_at: expiresAt,
        })
        .select("id, token, expires_at")
        .single();

      if (insertError) return json({ error: insertError.message }, 400);

      const baseUrl = Deno.env.get("FRONTEND_URL") ?? "https://betafleet.com.br";
      const inviteUrl = `${baseUrl}/workshop/join?token=${invitation.token}`;

      return json({ id: invitation.id, token: invitation.token, url: inviteUrl, expiresAt: invitation.expires_at }, 201);
    }

    // ─── AÇÃO: REVOGAR CONVITE ───────────────────────────────
    if (action === "revoke") {
      const { invitation_id } = body;
      if (!invitation_id) return json({ error: "invitation_id é obrigatório" }, 400);

      // Verificar que o convite pertence ao cliente do caller
      const { data: invitation } = await supabaseAdmin
        .from("workshop_invitations")
        .select("client_id, status")
        .eq("id", invitation_id)
        .single();

      if (!invitation) return json({ error: "Convite não encontrado" }, 404);

      if (callerProfile.role !== "Admin Master" && invitation.client_id !== callerProfile.client_id) {
        return json({ error: "Sem permissão para revogar este convite" }, 403);
      }

      if (invitation.status !== "pending") {
        return json({ error: "Apenas convites pendentes podem ser revogados" }, 400);
      }

      const { error: updateError } = await supabaseAdmin
        .from("workshop_invitations")
        .update({ status: "revoked" })
        .eq("id", invitation_id);

      if (updateError) return json({ error: updateError.message }, 400);

      return json({ success: true }, 200);
    }

    // ─── AÇÃO: LISTAR CONVITES ───────────────────────────────
    if (action === "list") {
      const clientId = callerProfile.role === "Admin Master"
        ? (body.client_id ?? callerProfile.client_id)
        : callerProfile.client_id;

      const { data, error } = await supabaseAdmin
        .from("workshop_invitations")
        .select("id, token, status, expires_at, created_at, invited_by")
        .eq("client_id", clientId)
        .order("created_at", { ascending: false });

      if (error) return json({ error: error.message }, 400);

      return json({ invitations: data }, 200);
    }

    return json({ error: "Ação inválida. Use: create, revoke, list" }, 400);
  } catch (err) {
    return json({ error: String(err) }, 500);
  }
});
