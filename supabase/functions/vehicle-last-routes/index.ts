import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import {
  createClient,
  type SupabaseClient,
  type User,
} from "https://esm.sh/@supabase/supabase-js@2";

import { fetchLastRoutesByPlate, normalizePlate } from "./neonRoutes.ts";

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
    return { ok: false, response: json({ error: "Token inválido ou expirado" }, 401) };
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
      "[vehicle-last-routes] falha ao resolver perfil:",
      error?.message ?? "perfil não encontrado",
    );
    return null;
  }

  if (data.client_id) return data.client_id as string;
  return data.role === "Admin Master" ? allowedClientId : null;
}

async function loadFleetPlates(
  supabase: SupabaseClient,
  clientId: string,
): Promise<string[]> {
  const { data, error } = await supabase
    .from("vehicles")
    .select("license_plate")
    .eq("client_id", clientId);

  if (error) throw error;

  const plates = (data ?? [])
    .map((row) => normalizePlate(row.license_plate as string | null))
    .filter((plate) => plate.length > 0);
  return [...new Set(plates)];
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return json({ error: "Método não permitido" }, 405);
  }

  try {
    const auth = await authenticate(req);
    if (!auth.ok) {
      console.error("[vehicle-last-routes] auth falhou");
      return auth.response;
    }

    const allowedClientId = Deno.env.get("LAST_ROUTE_CLIENT_ID");
    if (!allowedClientId) {
      console.error("[vehicle-last-routes] secret ausente: LAST_ROUTE_CLIENT_ID");
      return json({ error: "Integração de rotas não configurada." }, 500);
    }

    const effectiveClientId = await resolveTenant(auth.supabase, auth.user.id, allowedClientId);
    if (!effectiveClientId || effectiveClientId !== allowedClientId) {
      console.error("[vehicle-last-routes] tenant negado");
      return json({ error: "Recurso não disponível para este cliente." }, 403);
    }

    const plates = await loadFleetPlates(auth.supabase, effectiveClientId);
    const connectionString = Deno.env.get("NEON_DATABASE_URL");
    if (!connectionString) {
      console.error("[vehicle-last-routes] secret ausente: NEON_DATABASE_URL");
      return json({ error: "Integração de rotas não configurada." }, 500);
    }

    try {
      const routes = await fetchLastRoutesByPlate(connectionString, plates);
      return json({ routes }, 200);
    } catch (error) {
      console.error(
        "[vehicle-last-routes] falha na consulta ao Neon:",
        error instanceof Error ? error.message : "desconhecido",
      );
      return json({ error: "Não foi possível consultar as rotas." }, 500);
    }
  } catch (error) {
    console.error(
      "[vehicle-last-routes] erro inesperado:",
      error instanceof Error ? error.message : "desconhecido",
    );
    return json({ error: "Não foi possível consultar as rotas." }, 500);
  }
});
