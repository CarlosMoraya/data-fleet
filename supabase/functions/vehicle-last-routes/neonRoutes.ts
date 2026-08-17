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
