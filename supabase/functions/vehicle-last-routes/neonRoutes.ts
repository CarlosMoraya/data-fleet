import { neon } from "https://esm.sh/@neondatabase/serverless@0.10.4";

export interface NeonLastRoute {
  plate: string;
  lastRouteDate: string;
  routeId: string;
}

interface NeonLastRouteRow {
  plate: string;
  last_route_date: string;
  route_id: string;
}

export function normalizePlate(value: string | null | undefined): string {
  if (!value) return "";
  return value.replace(/[^A-Za-z0-9]/g, "").toUpperCase().slice(-7);
}

export async function fetchLastRoutesByPlate(
  connectionString: string,
  normalizedPlates: string[],
): Promise<NeonLastRoute[]> {
  if (normalizedPlates.length === 0) return [];

  const sql = neon(connectionString);
  const rows = await sql(
    `SELECT DISTINCT ON (np)
       np                   AS plate,
       data_referencia::text AS last_route_date,
       route_id::text        AS route_id
FROM (
  SELECT right(regexp_replace(upper(plate), '[^A-Z0-9]', '', 'g'), 7) AS np,
         data_referencia,
         route_id
  FROM rotas_diarias
  WHERE plate IS NOT NULL
) t
WHERE np = ANY($1::text[])
ORDER BY np, data_referencia DESC, route_id DESC`,
    [normalizedPlates],
  ) as NeonLastRouteRow[];

  return rows.map((row) => ({
    plate: row.plate,
    lastRouteDate: row.last_route_date,
    routeId: row.route_id,
  }));
}

export interface NeonRouteHistoryEntry {
  plate: string;
  routeDate: string;
  routeId: string;
  driverName: string | null;
  serviceCenter: string;
  cycle: string | null;
  odometerDistanceKm: number | null;
}

export async function fetchRouteHistoryByPlate(
  connectionString: string,
  normalizedPlates: string[],
  from: string,
  to: string,
): Promise<NeonRouteHistoryEntry[]> {
  if (normalizedPlates.length === 0) return [];

  const sql = neon(connectionString);
  const rows = await sql(
    `SELECT right(regexp_replace(upper(plate), '[^A-Z0-9]', '', 'g'), 7) AS plate,
           data_referencia::text  AS route_date,
           route_id::text         AS route_id,
           driver_name,
           service_center,
           cycle,
           odometer_distance_km
      FROM vw_rotas_com_driver
     WHERE plate IS NOT NULL
       AND data_referencia BETWEEN $2::date AND $3::date
       AND right(regexp_replace(upper(plate), '[^A-Z0-9]', '', 'g'), 7) = ANY($1::text[])
     ORDER BY data_referencia DESC, route_id
     LIMIT 20000`,
    [normalizedPlates, from, to],
  ) as Array<{
    plate: string;
    route_date: string;
    route_id: string;
    driver_name: string | null;
    service_center: string;
    cycle: string | null;
    odometer_distance_km: number | null;
  }>;

  return rows.map((row) => ({
    plate: row.plate,
    routeDate: row.route_date,
    routeId: row.route_id,
    driverName: row.driver_name,
    serviceCenter: row.service_center,
    cycle: row.cycle,
    odometerDistanceKm: row.odometer_distance_km,
  }));
}
