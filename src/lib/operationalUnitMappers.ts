import { OperationalUnit } from '../types';
import { capitalizeWords, normalizeUpper, normalizeTrim } from './inputHelpers';

// ─── Tipo espelho do banco (snake_case) ─────────────────────────────────────

export interface OperationalUnitRow {
  id: string;
  client_id: string;
  shipper_id: string;
  name: string;
  code: string | null;
  city: string | null;
  state: string | null;
  notes: string | null;
  active: boolean;
  created_at?: string;
  // JOIN opcional
  shippers?: { name: string } | null;
}

// ─── Conversor: banco → frontend ────────────────────────────────────────────

export function operationalUnitFromRow(row: OperationalUnitRow): OperationalUnit {
  return {
    id: row.id,
    clientId: row.client_id,
    shipperId: row.shipper_id,
    shipperName: row.shippers?.name ?? undefined,
    name: row.name,
    code: row.code ?? undefined,
    city: row.city ?? undefined,
    state: row.state ?? undefined,
    notes: row.notes ?? undefined,
    active: row.active,
  };
}

// ─── Conversor: frontend → banco ────────────────────────────────────────────

export function operationalUnitToRow(
  unit: Partial<OperationalUnit>,
  clientId: string
): Omit<OperationalUnitRow, 'id' | 'shippers'> {
  return {
    client_id: clientId,
    shipper_id: unit.shipperId!,
    name: capitalizeWords(unit.name),
    code: normalizeUpper(unit.code) || null,
    city: capitalizeWords(unit.city) || null,
    state: normalizeUpper(unit.state) || null,
    notes: normalizeTrim(unit.notes) || null,
    active: unit.active ?? true,
  };
}
