import { mapFuelSupplyRow } from '../lib/fuelSupplyMappers';
import { invokeEdgeFunction } from '../lib/invokeEdgeFn';
import { supabase } from '../lib/supabase';

import type { FuelSupply } from '../types/fuelSupply';

export interface VeloeSyncSummary {
  fetched: number;
  upserted: number;
  skipped: number;
  unmatchedPlates: number;
}

const SELECT_WITH_JOINS =
  '*, vehicles(id, shipper_id, operational_unit_id, shippers(id, name), operational_units(id, name))';

/** Busca os abastecimentos do período para o cliente informado. */
export async function getFuelSupplies(
  clientId: string,
  range: { from: string; to: string }
): Promise<FuelSupply[]> {
  const { data, error } = await supabase
    .from('fuel_supplies')
    .select(SELECT_WITH_JOINS)
    .eq('client_id', clientId)
    .gte('transaction_date', range.from)
    .lte('transaction_date', range.to)
    .order('transaction_date', { ascending: false })
    .limit(5000);

  if (error) throw error;

  return (data ?? [])
    .map((row) => mapFuelSupplyRow(row))
    .filter((supply): supply is FuelSupply => supply !== null);
}

/** Dispara a sincronização manual com a Veloe pela Edge Function. */
export async function triggerVeloeFuelSync(): Promise<VeloeSyncSummary> {
  const response = await invokeEdgeFunction('veloe-fuel-sync', {});
  if (response == null || typeof response !== 'object') {
    throw new Error('Resposta inválida da sincronização.');
  }

  const { fetched, upserted, skipped, unmatchedPlates } = response as Record<string, unknown>;
  if (
    typeof fetched !== 'number' ||
    typeof upserted !== 'number' ||
    typeof skipped !== 'number' ||
    typeof unmatchedPlates !== 'number'
  ) {
    throw new Error('Resposta inválida da sincronização.');
  }

  return { fetched, upserted, skipped, unmatchedPlates };
}
