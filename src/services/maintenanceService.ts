import { supabase } from '../lib/supabase';
import type { MaintenanceOrder, BudgetItem, BudgetStatus } from '../types/maintenance';
import { uploadMaintenanceBudget } from '../lib/storageHelpers';

// ─── Tipos ───────────────────────────────────────────────────────────────────

export interface SaveMaintenancePayload {
  data: Partial<MaintenanceOrder>;
  budgetItems: BudgetItem[];
  budgetFile: File | null;
  profileId: string;
  currentClientId?: string;
}

// ─── Funções de serviço ──────────────────────────────────────────────────────

/**
 * Gera um número de OS no formato OS-YYMM-XXXX.
 */
export function generateOSNumber(): string {
  const d = new Date();
  const yy = d.getFullYear().toString().slice(-2);
  const mm = (d.getMonth() + 1).toString().padStart(2, '0');
  const rand = Math.floor(1000 + Math.random() * 9000);
  return `OS-${yy}${mm}-${rand}`;
}

/**
 * Cria ou atualiza uma ordem de serviço, com upload de orçamento e itens.
 * Centraliza a lógica que estava no mutationFn de Maintenance.tsx.
 */
export async function saveMaintenanceOrder(
  payload: SaveMaintenancePayload,
): Promise<string> {
  const { data, budgetItems, budgetFile, profileId, currentClientId } = payload;

  const isWorkshopSave = false; // caller deve passar clientId correto
  const effectiveClientId = isWorkshopSave
    ? (data.clientId ?? currentClientId)
    : currentClientId;

  if (!effectiveClientId) throw new Error('client_id é obrigatório');

  const commonFields: Record<string, unknown> = {
    client_id: effectiveClientId,
    vehicle_id: data.vehicleId,
    workshop_id: data.workshopId,
    entry_date: data.entryDate,
    expected_exit_date: data.expectedExitDate ?? null,
    type: data.type,
    status: data.status,
    description: data.description ?? null,
    mechanic_name: data.mechanicName ?? null,
    estimated_cost: data.estimatedCost ?? 0,
    approved_cost: data.approvedCost ?? null,
    notes: data.notes ?? null,
    workshop_os_number: data.workshopOs ?? null,
    current_km: data.currentKm ?? null,
  };

  let orderId: string;

  if (data.id) {
    // UPDATE
    const { error } = await supabase
      .from('maintenance_orders')
      .update(commonFields)
      .eq('id', data.id);
    if (error) throw error;
    orderId = data.id;
  } else {
    // INSERT
    const osNumber = generateOSNumber();
    const { data: inserted, error } = await supabase
      .from('maintenance_orders')
      .insert([{ ...commonFields, os_number: osNumber, created_by_id: profileId }])
      .select('id')
      .single();
    if (error) throw error;
    orderId = inserted.id;
  }

  // Upload do PDF de orçamento
  if (budgetFile) {
    const pdfUrl = await uploadMaintenanceBudget(effectiveClientId, orderId, budgetFile);
    const { error } = await supabase
      .from('maintenance_orders')
      .update({
        budget_pdf_url: pdfUrl,
        budget_status: 'pendente',
        status: 'Aguardando aprovação',
      })
      .eq('id', orderId);
    if (error) throw error;
  }

  // Substituir itens de orçamento
  const hasSignificantItems = budgetItems.some(i => i.itemName.trim().length > 0);
  if (hasSignificantItems || budgetFile) {
    await supabase
      .from('maintenance_budget_items')
      .delete()
      .eq('maintenance_order_id', orderId);

    const significantItems = budgetItems.filter(i => i.itemName.trim().length > 0);
    if (significantItems.length > 0) {
      const rows = significantItems.map((item, idx) => ({
        maintenance_order_id: orderId,
        client_id: effectiveClientId,
        item_name: item.itemName,
        system: item.system || null,
        quantity: item.quantity,
        value: item.value,
        sort_order: idx,
      }));
      const { error } = await supabase
        .from('maintenance_budget_items')
        .insert(rows);
      if (error) throw error;
    }
  }

  return orderId;
}

/**
 * Atualiza o status de uma ordem de serviço.
 */
export async function updateMaintenanceStatus(
  id: string,
  status: MaintenanceOrder['status'],
): Promise<void> {
  const { error } = await supabase
    .from('maintenance_orders')
    .update({
      status,
      actual_exit_date: status === 'Concluído' ? new Date().toISOString() : null,
    })
    .eq('id', id);
  if (error) throw error;
}

/**
 * Cancela uma ordem de serviço.
 */
export async function cancelMaintenanceOrder(
  id: string,
  cancelledById: string | null,
): Promise<void> {
  const { error } = await supabase
    .from('maintenance_orders')
    .update({
      status: 'Cancelado',
      cancelled_at: new Date().toISOString(),
      cancelled_by_id: cancelledById,
    })
    .eq('id', id);
  if (error) throw error;
}
