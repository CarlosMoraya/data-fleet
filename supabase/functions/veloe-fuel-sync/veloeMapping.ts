// Anti-Corruption Layer: traduz o vocabulário da Veloe para o modelo do βetaFleet.
//
// ⚠️ Este arquivo é TypeScript puro por contrato: nenhum `import`, nenhum global
// do Deno, nenhuma API de navegador. É o que permite executá-lo tanto no runtime
// Deno (Edge Function) quanto no Vitest (`src/lib/veloeFuelMapping.test.ts`).

/** Item do array `body` da resposta do endpoint "Histórico de Abastecimento". */
export interface VeloeSupplyRecord {
  corporateName?: string | null;
  vehiclePlate?: string | null;
  vehicleModel?: string | null;
  costCenter?: string | null;
  driverName?: string | null;
  /** CPF do motorista — NUNCA persistido. */
  registry?: string | null;
  /** Número completo do cartão — NUNCA persistido. */
  card?: string | null;
  fuelType?: string | null;
  amountLiters?: string | number | null;
  unitValue?: string | number | null;
  stockedValue?: string | number | null;
  cardBalance?: string | number | null;
  transactionDate?: string | null;
  authorization?: string | null;
  transactionStatus?: string | null;
  supplyLocation?: string | null;
  ecContractee?: string | number | null;
  gasStationAddress?: string | null;
  network?: string | null;
  previousOdometer?: string | number | null;
  odometer?: string | number | null;
  previousOrimeter?: string | number | null;
  orimeter?: string | number | null;
  kmTraveled?: string | number | null;
  standardAverage?: string | number | null;
  valueCostKmTraveled?: string | number | null;
  ipa?: string | number | null;
  anpIndex?: string | number | null;
  /** Matrícula do motorista — NUNCA persistida. */
  registration?: string | null;
  branchContractee?: string | null;
  branchName?: string | null;
  baseName?: string | null;
  baseCode?: string | null;
  merchantState?: string | null;
}

/** Linha de `public.fuel_supplies` pronta para upsert. */
export interface FuelSupplyRow {
  client_id: string;
  vehicle_id: string | null;
  driver_id: string | null;
  plate: string;
  driver_name: string | null;
  vehicle_model: string | null;
  fuel_type: string | null;
  amount_liters: number | null;
  unit_value: number | null;
  total_value: number | null;
  odometer: number | null;
  previous_odometer: number | null;
  km_traveled: number | null;
  standard_average: number | null;
  transaction_date: string;
  transaction_status: string | null;
  authorization_code: string | null;
  supply_location: string | null;
  network: string | null;
  merchant_state: string | null;
  cost_center: string | null;
  base_code: string | null;
  base_name: string | null;
  card_last4: string | null;
  source: string;
  external_key: string;
}

/** Converte um decimal da Veloe ("8,94", "0.089000", "1.234,56") em number. */
export function parseVeloeDecimal(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "number") return Number.isNaN(value) ? null : value;
  const trimmed = value.trim();
  if (trimmed === "") return null;
  const normalized = trimmed.includes(",")
    ? trimmed.replace(/\./g, "").replace(",", ".")
    : trimmed;
  const parsed = Number(normalized);
  return Number.isNaN(parsed) ? null : parsed;
}

/**
 * Converte "dd/MM/yyyy HH:mm:ss" (ou "dd/MM/yyyy") em ISO 8601 UTC.
 * A Veloe informa o horário no fuso de Brasília (UTC-03:00).
 */
export function parseVeloeDateTime(value: string | null | undefined): string | null {
  if (value === null || value === undefined) return null;
  const match = /^(\d{2})\/(\d{2})\/(\d{4})(?:\s+(\d{2}):(\d{2}):(\d{2}))?$/.exec(value.trim());
  if (!match) return null;
  const [, day, month, year, hour, minute, second] = match;
  const iso = `${year}-${month}-${day}T${hour ?? "00"}:${minute ?? "00"}:${second ?? "00"}-03:00`;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

/**
 * Normaliza a placa para o formato canônico do projeto (7 últimos alfanuméricos).
 * Duplicação deliberada de `normalizeFleetPlate` (src/services/vehicleLastRouteService.ts):
 * o runtime Deno não importa de `src/`. Não unificar.
 */
export function normalizeVeloePlate(value: string | null | undefined): string {
  return (value ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(-7);
}

/** Extrai os 4 últimos dígitos do cartão. O número completo nunca é persistido. */
export function maskCardLast4(card: string | null | undefined): string | null {
  const digits = (card ?? "").replace(/\D/g, "");
  if (digits.length < 4) return null;
  return digits.slice(-4);
}

/**
 * Deriva a chave natural idempotente da transação.
 *
 * Usa apenas os 4 últimos dígitos do cartão, e não o número completo: a
 * `external_key` é persistida em `fuel_supplies`, e gravar o cartão inteiro
 * violaria a restrição absoluta de LGPD do módulo. Decidido com o usuário
 * em 2026-09-06.
 */
export function buildExternalKey(record: VeloeSupplyRecord): string {
  const authorization = record.authorization ?? "";
  const isoDate = parseVeloeDateTime(record.transactionDate) ?? "";
  const plate = normalizeVeloePlate(record.vehiclePlate);
  const cardLast4 = maskCardLast4(record.card) ?? "";
  return [authorization, isoDate, plate, cardLast4].join("|").toUpperCase();
}

/**
 * Monta a linha de `fuel_supplies` a partir de um registro da Veloe.
 * Devolve `null` quando a placa normalizada é vazia ou a data é inválida.
 * `registry` (CPF) e `registration` (matrícula) são ignorados de propósito.
 */
export function mapVeloeSupplyToRow(
  record: VeloeSupplyRecord,
  clientId: string,
): FuelSupplyRow | null {
  const plate = normalizeVeloePlate(record.vehiclePlate);
  const transactionDate = parseVeloeDateTime(record.transactionDate);
  if (!plate || !transactionDate) return null;

  return {
    client_id: clientId,
    vehicle_id: null,
    driver_id: null,
    plate,
    driver_name: record.driverName ?? null,
    vehicle_model: record.vehicleModel ?? null,
    fuel_type: record.fuelType ?? null,
    amount_liters: parseVeloeDecimal(record.amountLiters),
    unit_value: parseVeloeDecimal(record.unitValue),
    total_value: parseVeloeDecimal(record.stockedValue),
    odometer: parseVeloeDecimal(record.odometer),
    previous_odometer: parseVeloeDecimal(record.previousOdometer),
    km_traveled: parseVeloeDecimal(record.kmTraveled),
    standard_average: parseVeloeDecimal(record.standardAverage),
    transaction_date: transactionDate,
    transaction_status: record.transactionStatus ?? null,
    authorization_code: record.authorization ?? null,
    supply_location: record.supplyLocation ?? null,
    network: record.network ?? null,
    merchant_state: record.merchantState ?? null,
    cost_center: record.costCenter ?? null,
    base_code: record.baseCode ?? null,
    base_name: record.baseName ?? null,
    card_last4: maskCardLast4(record.card),
    source: "veloe",
    external_key: buildExternalKey(record),
  };
}
