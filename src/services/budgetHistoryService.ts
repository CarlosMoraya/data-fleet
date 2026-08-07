import { maintenanceFromRow, type MaintenanceOrderRow } from '../lib/maintenanceMappers';
import { supabase } from '../lib/supabase';

import type { MaintenanceOrder } from '../types/maintenance';

export async function listReviewedBudgets(clientId?: string): Promise<MaintenanceOrder[]> {
  let query = supabase.from('maintenance_orders').select(`
    *,
    vehicles (license_plate, model, shippers (name), operational_units (name)),
    workshops (name),
    profiles!created_by_id (name),
    budget_reviewer:profiles!budget_reviewed_by (name),
    clients (name)
  `)
    .in('budget_status', ['aprovado', 'reprovado'])
    .order('budget_reviewed_at', { ascending: false, nullsFirst: false });

  if (clientId) {
    query = query.eq('client_id', clientId);
  }

  const { data, error } = await query;
  if (error) throw error;

  return (data as unknown as MaintenanceOrderRow[]).map(maintenanceFromRow);
}