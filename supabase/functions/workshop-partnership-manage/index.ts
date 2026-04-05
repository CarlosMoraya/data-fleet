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

    const { data: callerProfile } = await supabaseAdmin
      .from("profiles")
      .select("role, client_id, workshop_account_id")
      .eq("id", caller.id)
      .single();

    if (!callerProfile) return json({ error: "Perfil não encontrado" }, 403);

    const callerRank = ROLE_RANK[callerProfile.role] ?? 0;
    const body = await req.json();
    const { action, partnership_id } = body;

    if (!partnership_id) return json({ error: "partnership_id é obrigatório" }, 400);

    // Buscar a partnership
    const { data: partnership } = await supabaseAdmin
      .from("workshop_partnerships")
      .select("id, workshop_account_id, client_id, status")
      .eq("id", partnership_id)
      .single();

    if (!partnership) return json({ error: "Partnership não encontrada" }, 404);

    // ─── AÇÃO: DESATIVAR ──────────────────────────────────────
    if (action === "deactivate") {
      // Permitido para: Fleet Analyst+ do cliente OU a própria oficina
      const isFleetAnalyst = callerRank >= ROLE_RANK["Fleet Analyst"]
        && (callerProfile.role === "Admin Master" || partnership.client_id === callerProfile.client_id);

      const isOwnWorkshop = callerProfile.role === "Workshop"
        && callerProfile.workshop_account_id === partnership.workshop_account_id;

      if (!isFleetAnalyst && !isOwnWorkshop) {
        return json({ error: "Sem permissão para desativar esta parceria" }, 403);
      }

      if (partnership.status !== "active") {
        return json({ error: "Partnership já está inativa" }, 400);
      }

      await supabaseAdmin
        .from("workshop_partnerships")
        .update({
          status: "inactive",
          deactivated_at: new Date().toISOString(),
          deactivated_by: caller.id,
        })
        .eq("id", partnership_id);

      // Registrar em audit
      await supabaseAdmin
        .from("workshop_partnership_audit")
        .insert({
          partnership_id,
          action: "deactivated",
          performed_by: caller.id,
          details: { reason: body.reason ?? null },
        });

      return json({ success: true }, 200);
    }

    // ─── AÇÃO: REATIVAR ───────────────────────────────────────
    if (action === "reactivate") {
      // Apenas Fleet Analyst+ do cliente pode reativar
      const canReactivate = callerRank >= ROLE_RANK["Fleet Analyst"]
        && (callerProfile.role === "Admin Master" || partnership.client_id === callerProfile.client_id);

      if (!canReactivate) {
        return json({ error: "Sem permissão para reativar esta parceria" }, 403);
      }

      if (partnership.status !== "inactive") {
        return json({ error: "Partnership não está inativa" }, 400);
      }

      await supabaseAdmin
        .from("workshop_partnerships")
        .update({
          status: "active",
          deactivated_at: null,
          deactivated_by: null,
        })
        .eq("id", partnership_id);

      // Registrar em audit
      await supabaseAdmin
        .from("workshop_partnership_audit")
        .insert({
          partnership_id,
          action: "reactivated",
          performed_by: caller.id,
        });

      return json({ success: true }, 200);
    }

    return json({ error: "Ação inválida. Use: deactivate, reactivate" }, 400);
  } catch (err) {
    return json({ error: String(err) }, 500);
  }
});
