import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import {
  createClient,
  type SupabaseClient,
  type User,
} from "https://esm.sh/@supabase/supabase-js@2";

import { fetchSupplyHistoryPage, loginVeloe, type VeloeConfig } from "./veloeClient.ts";
import { mapVeloeSupplyToRow, normalizeVeloePlate, type FuelSupplyRow } from "./veloeMapping.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const PAGE_SIZE = 500;
const MAX_PAGES = 50;
const UPSERT_BATCH_SIZE = 500;
const SYNC_ROLES = ["Manager", "Coordinator", "Director", "Admin Master"];

interface SyncSummary {
  fetched: number;
  upserted: number;
  skipped: number;
  unmatchedPlates: number;
}

interface VehicleIndex {
  byPlate: Map<string, string>;
  driverByVehicle: Map<string, string>;
}

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function authenticate(req: Request): Promise<
  { ok: true; supabase: SupabaseClient; user: User } |
  { ok: false; response: Response }
> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return { ok: false, response: json({ error: "Não autorizado" }, 401) };

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } },
  );

  const token = authHeader.replace("Bearer ", "");
  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) {
    return { ok: false, response: json({ error: "Não autorizado" }, 401) };
  }

  return { ok: true, supabase, user };
}

async function resolveTenant(
  supabase: SupabaseClient,
  userId: string,
  allowedClientId: string,
): Promise<string | null> {
  const { data, error } = await supabase
    .from("profiles")
    .select("client_id, role")
    .eq("id", userId)
    .maybeSingle();

  if (error || !data) {
    console.error(
      "[veloe-fuel-sync] falha ao resolver perfil:",
      error?.message ?? "perfil não encontrado",
    );
    return null;
  }

  if (data.client_id) return data.client_id as string;
  return data.role === "Admin Master" ? allowedClientId : null;
}

/** Identifica se a chamada veio do agendador (`pg_cron`) e não de um usuário. */
function isServiceRoleCall(authHeader: string | null): boolean {
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!serviceRoleKey || !authHeader) return false;
  return authHeader.replace("Bearer ", "") === serviceRoleKey;
}

/** Autoriza o disparo manual do sync lendo o papel no servidor. */
async function hasSyncPermission(supabase: SupabaseClient, userId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .maybeSingle();

  if (error || !data) {
    console.error(
      "[veloe-fuel-sync] falha ao ler papel:",
      error?.message ?? "perfil não encontrado",
    );
    return false;
  }
  return SYNC_ROLES.includes(data.role as string);
}

/** Índices de resolução placa→vehicle_id e vehicle_id→driver_id. */
async function loadVehicleIndex(
  supabase: SupabaseClient,
  clientId: string,
): Promise<VehicleIndex> {
  const { data, error } = await supabase
    .from("vehicles")
    .select("id, license_plate, driver_id")
    .eq("client_id", clientId);

  if (error) throw error;

  const byPlate = new Map<string, string>();
  const driverByVehicle = new Map<string, string>();
  for (const row of data ?? []) {
    const plate = normalizeVeloePlate(row.license_plate as string | null);
    if (!plate) continue;
    byPlate.set(plate, row.id as string);
    if (row.driver_id) driverByVehicle.set(row.id as string, row.driver_id as string);
  }
  return { byPlate, driverByVehicle };
}

/** Executa login → paginação → mapeamento → upsert para uma janela de datas. */
async function syncRange(
  supabase: SupabaseClient,
  config: VeloeConfig,
  clientId: string,
  startDate: string,
  endDate: string,
): Promise<SyncSummary> {
  const { byPlate, driverByVehicle } = await loadVehicleIndex(supabase, clientId);
  const plates = [...byPlate.keys()];
  let token = await loginVeloe(config);

  const rows: FuelSupplyRow[] = [];
  let fetched = 0;
  let skipped = 0;
  let unmatchedPlates = 0;

  for (let pageNumber = 0; pageNumber < MAX_PAGES; pageNumber++) {
    const params = { startDate, endDate, pageNumber, pageSize: PAGE_SIZE, plates };
    let records;
    try {
      records = await fetchSupplyHistoryPage(config, token, params);
    } catch (error) {
      // Token da Veloe vale 120 minutos: refaz o login uma vez e repete a página.
      if (error instanceof Error && error.message === "veloe_fetch_failed:401") {
        console.error("[veloe-fuel-sync] token expirado, refazendo login");
        token = await loginVeloe(config);
        records = await fetchSupplyHistoryPage(config, token, params);
      } else {
        throw error;
      }
    }

    fetched += records.length;
    for (const record of records) {
      const row = mapVeloeSupplyToRow(record, clientId);
      if (!row) {
        skipped++;
        continue;
      }
      const vehicleId = byPlate.get(row.plate) ?? null;
      if (!vehicleId) unmatchedPlates++;
      row.vehicle_id = vehicleId;
      row.driver_id = vehicleId ? (driverByVehicle.get(vehicleId) ?? null) : null;
      rows.push(row);
    }

    if (records.length < PAGE_SIZE) break;
  }

  for (let start = 0; start < rows.length; start += UPSERT_BATCH_SIZE) {
    const batch = rows.slice(start, start + UPSERT_BATCH_SIZE);
    const { error } = await supabase
      .from("fuel_supplies")
      .upsert(batch, { onConflict: "client_id,external_key" });
    if (error) {
      console.error("[veloe-fuel-sync] falha no upsert:", error.message);
      throw new Error("veloe_upsert_failed");
    }
  }

  return { fetched, upserted: rows.length, skipped, unmatchedPlates };
}

/** Formata uma data como dd/MM/yyyy. */
function formatVeloeDate(date: Date): string {
  const day = String(date.getUTCDate()).padStart(2, "0");
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  return `${day}/${month}/${date.getUTCFullYear()}`;
}

/** Janela padrão: os últimos 7 dias, inclusive hoje. */
function defaultRange(): { startDate: string; endDate: string } {
  const today = new Date();
  const start = new Date(today.getTime() - 6 * 24 * 60 * 60 * 1000);
  return { startDate: formatVeloeDate(start), endDate: formatVeloeDate(today) };
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return json({ error: "Método não permitido" }, 405);
  }

  try {
    const allowedClientId = Deno.env.get("VELOE_CLIENT_ID");
    const baseUrl = Deno.env.get("VELOE_API_BASE_URL");
    const ibmClientId = Deno.env.get("VELOE_IBM_CLIENT_ID");
    const ibmClientSecret = Deno.env.get("VELOE_IBM_CLIENT_SECRET");
    const contract = Deno.env.get("VELOE_CONTRACT");

    const missing = Object.entries({
      VELOE_CLIENT_ID: allowedClientId,
      VELOE_API_BASE_URL: baseUrl,
      VELOE_IBM_CLIENT_ID: ibmClientId,
      VELOE_IBM_CLIENT_SECRET: ibmClientSecret,
      VELOE_CONTRACT: contract,
    }).find(([, value]) => !value);

    if (missing || !allowedClientId || !baseUrl || !ibmClientId || !ibmClientSecret || !contract) {
      console.error(`[veloe-fuel-sync] secret ausente: ${missing?.[0] ?? "desconhecido"}`);
      return json({ error: "Integração de abastecimento não configurada." }, 500);
    }

    let supabase: SupabaseClient;
    let clientId: string;

    if (isServiceRoleCall(req.headers.get("Authorization"))) {
      supabase = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      );
      clientId = allowedClientId;
    } else {
      const auth = await authenticate(req);
      if (!auth.ok) {
        console.error("[veloe-fuel-sync] auth falhou");
        return auth.response;
      }

      const effectiveClientId = await resolveTenant(auth.supabase, auth.user.id, allowedClientId);
      if (!effectiveClientId || effectiveClientId !== allowedClientId) {
        console.error("[veloe-fuel-sync] tenant negado");
        return json({ error: "Recurso não disponível para este cliente." }, 403);
      }

      if (!await hasSyncPermission(auth.supabase, auth.user.id)) {
        console.error("[veloe-fuel-sync] papel negado");
        return json({ error: "Permissão insuficiente." }, 403);
      }

      supabase = auth.supabase;
      clientId = effectiveClientId;
    }

    const body = await req.json().catch(() => ({})) as {
      startDate?: unknown;
      endDate?: unknown;
    };
    const fallback = defaultRange();
    const startDate = typeof body.startDate === "string" ? body.startDate : fallback.startDate;
    const endDate = typeof body.endDate === "string" ? body.endDate : fallback.endDate;

    const config: VeloeConfig = { baseUrl, ibmClientId, ibmClientSecret, contract };

    try {
      const summary = await syncRange(supabase, config, clientId, startDate, endDate);
      console.log(
        `[veloe-fuel-sync] concluído: fetched=${summary.fetched} upserted=${summary.upserted} skipped=${summary.skipped} unmatchedPlates=${summary.unmatchedPlates}`,
      );
      return json(summary, 200);
    } catch (error) {
      console.error(
        "[veloe-fuel-sync] sincronização falhou:",
        error instanceof Error ? error.message : "desconhecido",
      );
      return json({ error: "Não foi possível sincronizar os abastecimentos." }, 500);
    }
  } catch (error) {
    console.error(
      "[veloe-fuel-sync] erro inesperado:",
      error instanceof Error ? error.message : "desconhecido",
    );
    return json({ error: "Não foi possível sincronizar os abastecimentos." }, 500);
  }
});
