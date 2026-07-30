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
  "Financeiro": 1,
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

type TicketReason = "sos_created" | "critical_classified" | "high_classified";
type TicketPayload = { action: "ticket"; ticketId: string; reason: TicketReason };
type TestPayload = { action: "test"; clientId: string };
type Payload = TicketPayload | TestPayload;

type TicketRow = {
  id: string;
  client_id: string;
  source: "sos" | "report";
  opened_by: string;
  opened_by_role: string;
  opened_by_name_snapshot: string;
  driver_name_snapshot: string | null;
  vehicle_license_plate_snapshot: string;
  sos_type: "breakdown" | "collision" | "theft" | null;
  title: string;
  description: string | null;
  criticality: "critical" | "high" | "medium" | "low" | null;
  latitude: number | null;
  longitude: number | null;
  location_text: string | null;
};

type TelegramSettingsRow = {
  client_id: string;
  enabled: boolean;
  chat_id: string | null;
  notify_sos: boolean;
  notify_critical: boolean;
  notify_high: boolean;
};

const sosLabels: Record<NonNullable<TicketRow["sos_type"]>, string> = {
  breakdown: "Veículo enguiçado",
  collision: "Colisão/Sinistro",
  theft: "Roubo do veículo",
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isTicketPayload(value: unknown): value is TicketPayload {
  if (!isRecord(value)) return false;
  return value.action === "ticket"
    && typeof value.ticketId === "string"
    && ["sos_created", "critical_classified", "high_classified"].includes(String(value.reason));
}

function isTestPayload(value: unknown): value is TestPayload {
  if (!isRecord(value)) return false;
  return value.action === "test" && typeof value.clientId === "string";
}

function roleRank(role: string | null | undefined): number {
  return ROLE_RANK[role ?? ""] ?? -1;
}

function canTriggerTicketNotification(
  profile: { id: string; role: string; client_id: string | null },
  ticket: TicketRow,
  reason: TicketReason,
): boolean {
  if (profile.role === "Admin Master") return true;

  if (reason === "sos_created") {
    return ticket.opened_by === profile.id
      || (profile.role !== "Operations Manager" && roleRank(profile.role) >= ROLE_RANK["Fleet Assistant"]
        && profile.client_id === ticket.client_id);
  }

  return roleRank(profile.role) >= ROLE_RANK["Fleet Analyst"]
    && profile.client_id === ticket.client_id;
}

function mapsUrl(ticket: TicketRow): string | null {
  if (ticket.latitude == null || ticket.longitude == null) return null;
  return `https://maps.google.com/?q=${ticket.latitude},${ticket.longitude}`;
}

function buildTicketMessage(ticket: TicketRow, reason: TicketReason, appUrl: string): string {
  const openUrl = `${appUrl.replace(/\/$/, "")}/chamados?ticket=${ticket.id}`;
  if (reason === "sos_created") {
    const map = mapsUrl(ticket);
    return [
      "🚨 S.O.S. — EMERGÊNCIA",
      "",
      `Veículo: ${ticket.vehicle_license_plate_snapshot}`,
      `Motorista: ${ticket.driver_name_snapshot ?? "Não informado"}`,
      `Tipo: ${ticket.sos_type ? sosLabels[ticket.sos_type] : "Não informado"}`,
      `Descrição: ${ticket.description ?? "Não informado"}`,
      `Local: ${ticket.location_text ?? "Não informado"}`,
      ...(map ? [`Mapa: ${map}`] : []),
      "",
      `Abrir no BetaFleet: ${openUrl}`,
    ].join("\n");
  }

  return [
    "🔴 Chamado crítico classificado",
    "",
    `Veículo: ${ticket.vehicle_license_plate_snapshot}`,
    `Aberto por: ${ticket.opened_by_name_snapshot}`,
    `Título: ${ticket.title}`,
    `Descrição: ${ticket.description ?? "Não informado"}`,
    "",
    `Abrir no BetaFleet: ${openUrl}`,
  ].join("\n");
}

async function recordTelegramResult(
  supabaseAdmin: ReturnType<typeof createClient>,
  ticketId: string,
  success: boolean,
  error: string | null,
) {
  const { error: recordError } = await supabaseAdmin.rpc("record_fleet_ticket_telegram_result", {
    p_ticket_id: ticketId,
    p_success: success,
    p_error: error,
  });
  if (recordError) {
    console.error(`[notify-fleet-ticket-telegram] Erro ao registrar resultado: ${recordError.message}`);
  }
}

async function sendTelegramMessage(chatId: string, text: string, token: string) {
  const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text }),
  });

  if (!response.ok) {
    let description = "Não foi possível enviar a mensagem ao Telegram.";
    try {
      const body = await response.json();
      if (typeof body?.description === "string") description = body.description;
    } catch {
      // Keep the friendly fallback when Telegram does not return JSON.
    }
    throw new Error(description);
  }
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Não autorizado" }, 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const botToken = Deno.env.get("TELEGRAM_BOT_TOKEN");
    const appUrl = Deno.env.get("APP_URL");

    if (!supabaseUrl || !anonKey || !serviceRoleKey) {
      return json({ error: "Configuração do Supabase incompleta" }, 500);
    }
    if (!botToken) return json({ error: "TELEGRAM_BOT_TOKEN não configurado" }, 500);
    if (!appUrl) return json({ error: "APP_URL não configurada" }, 500);

    const token = authHeader.replace(/^Bearer\s+/i, "");
    const supabaseAuth = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser(token);
    if (authError || !user) return json({ error: "Token inválido ou expirado" }, 401);

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: callerProfile, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select("id, role, client_id")
      .eq("id", user.id)
      .single();
    if (profileError || !callerProfile) return json({ error: "Perfil não encontrado" }, 403);

    const body: unknown = await req.json();
    if (!isTicketPayload(body) && !isTestPayload(body)) {
      return json({ error: "Payload inválido." }, 400);
    }

    if (isTestPayload(body)) {
      if (!["Coordinator", "Manager", "Director", "Admin Master"].includes(callerProfile.role)) {
        return json({ error: "Apenas Coordinator, Manager, Director ou Admin Master podem enviar teste." }, 403);
      }
      if (callerProfile.role !== "Admin Master" && callerProfile.client_id !== body.clientId) {
        return json({ error: "Cliente fora do escopo do usuário." }, 403);
      }

      const { data: settings, error: settingsError } = await supabaseAdmin
        .from("client_telegram_settings")
        .select("client_id, enabled, chat_id, notify_sos, notify_critical, notify_high")
        .eq("client_id", body.clientId)
        .maybeSingle();
      if (settingsError) return json({ error: settingsError.message }, 500);
      if (!settings?.enabled || !settings.chat_id?.trim()) {
        return json({ error: "Ative as notificações e informe o chat_id antes de enviar o teste." }, 400);
      }

      await sendTelegramMessage(
        settings.chat_id.trim(),
        "✅ Teste de integração BetaFleet\nAs notificações Telegram deste cliente estão configuradas corretamente.",
        botToken,
      );
      return json({ sent: true }, 200);
    }

    const { data: ticket, error: ticketError } = await supabaseAdmin
      .from("fleet_tickets")
      .select("id, client_id, source, opened_by, opened_by_role, opened_by_name_snapshot, driver_name_snapshot, vehicle_license_plate_snapshot, sos_type, title, description, criticality, latitude, longitude, location_text")
      .eq("id", body.ticketId)
      .single();
    if (ticketError || !ticket) return json({ error: "Chamado não encontrado." }, 404);

    if (!canTriggerTicketNotification(callerProfile, ticket as TicketRow, body.reason)) {
      return json({ error: "Usuário sem permissão para notificar este chamado." }, 403);
    }

    const { data: settings, error: settingsError } = await supabaseAdmin
      .from("client_telegram_settings")
      .select("client_id, enabled, chat_id, notify_sos, notify_critical, notify_high")
      .eq("client_id", ticket.client_id)
      .maybeSingle();
    if (settingsError) return json({ error: settingsError.message }, 500);
    if (!settings?.enabled || !settings.chat_id?.trim()) {
      return json({ skipped: true, reason: "disabled" }, 200);
    }

    const telegramSettings = settings as TelegramSettingsRow;
    const flagEnabled = body.reason === "sos_created"
      ? telegramSettings.notify_sos
      : body.reason === "critical_classified"
        ? telegramSettings.notify_critical
        : telegramSettings.notify_high;
    if (!flagEnabled) return json({ skipped: true, reason: "disabled" }, 200);

    try {
      await sendTelegramMessage(
        telegramSettings.chat_id!.trim(),
        buildTicketMessage(ticket as TicketRow, body.reason, appUrl),
        botToken,
      );
      await recordTelegramResult(supabaseAdmin, body.ticketId, true, null);
      return json({ sent: true }, 200);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Não foi possível enviar a mensagem ao Telegram.";
      await recordTelegramResult(supabaseAdmin, body.ticketId, false, message);
      return json({ error: `Não foi possível enviar a notificação Telegram: ${message}` }, 502);
    }
  } catch (error) {
    console.error("[notify-fleet-ticket-telegram] Erro inesperado:", error);
    return json({ error: "Erro inesperado ao processar a notificação Telegram." }, 500);
  }
});
