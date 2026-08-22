import { normalizeBudgetSystem } from '../lib/budgetSystems';
import { type BudgetLockKind } from '../lib/maintenanceBudgetLock';
import { budgetItemFromRow } from '../lib/maintenanceMappers';
import { uploadMaintenanceBudget } from '../lib/storageHelpers';
import { supabase } from '../lib/supabase';

import type { MaintenanceOrder, BudgetItem, MaintenanceBudgetItemRow } from '../types/maintenance';

// ─── Tipos ───────────────────────────────────────────────────────────────────

export interface SaveMaintenancePayload {
  data: Partial<MaintenanceOrder>;
  budgetItems: BudgetItem[];
  budgetFile: File | null;
  profileId: string;
  currentClientId?: string;
  /**
   * Preenchido quando a OS editada tem orçamento aprovado — nenhuma coluna de
   * orçamento (itens, descontos, PDF, custos) é gravada. 'workshop' grava só os
   * campos operacionais; 'client' grava todo o resto da OS.
   */
  budgetLock?: BudgetLockKind;
}

export interface MaintenanceBudgetApprovalDetails {
  maintenanceOrderId: string;
  osNumber: string;
  approvedCost: number;
  budgetDiscount: number;
  budgetPdfUrl?: string;
  workshopName: string;
  items: BudgetItem[];
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
  const { data, budgetItems, budgetFile, profileId, currentClientId, budgetLock } = payload;

  // Orçamento aprovado: a oficina só registra a execução do serviço. Nenhuma
  // coluna de orçamento é enviada e os itens não são tocados.
  if (budgetLock === 'workshop') {
    if (!data.id) throw new Error('Orçamento aprovado só pode ser atualizado em edição.');
    const { error } = await supabase
      .from('maintenance_orders')
      .update({
        expected_exit_date: data.expectedExitDate ?? null,
        workshop_os_number: data.workshopOs ?? null,
        mechanic_name: data.mechanicName ?? null,
        current_km: data.currentKm ?? null,
      })
      .eq('id', data.id);
    if (error) throw error;
    return data.id;
  }

  // Em edição (Workshop ou Assistant), o client_id da própria OS prevalece;
  // em criação, usa o cliente selecionado.
  const effectiveClientId = data.clientId ?? currentClientId;

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
    notes: data.notes ?? null,
    workshop_os_number: data.workshopOs ?? null,
    current_km: data.currentKm ?? null,
    warranty_revision_event_id: data.warrantyRevisionEventId ?? null,
    ...(budgetLock
      ? {}
      : {
        estimated_cost: data.estimatedCost ?? 0,
        approved_cost: data.approvedCost ?? null,
        budget_discount: 0,
      }),
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
    orderId = (inserted as { id: string }).id;
  }

  // Upload do PDF de orçamento.
  // 'vehicle-documents' é privado: persistimos o CAMINHO do objeto, nunca a URL
  // assinada (que é temporária e não pode ser gravada no banco).
  if (budgetFile && !budgetLock) {
    const pdfPath = await uploadMaintenanceBudget(effectiveClientId, orderId, budgetFile);
    const { error } = await supabase
      .from('maintenance_orders')
      .update({
        budget_pdf_url: pdfPath,
        budget_status: 'pendente',
        status: 'Aguardando aprovação',
        budget_rejection_reason: null,
      })
      .eq('id', orderId);
    if (error) throw error;
  }

  // Substituir itens de orçamento
  const hasSignificantItems = budgetItems.some(i => i.itemName.trim().length > 0);
  if (!budgetLock && (hasSignificantItems || budgetFile)) {
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
        system: item.itemName.trim().length > 0 ? normalizeBudgetSystem(item.system) : null,
        quantity: item.quantity,
        value: item.value,
        discount: item.discount ?? 0,
        sort_order: idx,
      }));
      const { error } = await supabase
        .from('maintenance_budget_items')
        .insert(rows);
      if (error) throw error;
    }
  }

  const finalBudgetDiscount = data.budgetDiscount ?? 0;
  if (!budgetLock && finalBudgetDiscount > 0) {
    const { error } = await supabase
      .from('maintenance_orders')
      .update({ budget_discount: finalBudgetDiscount })
      .eq('id', orderId);
    if (error) throw error;
  }

  return orderId;
}

/**
 * Carrega cabeçalho e itens do orçamento aprovado de uma OS, para uso no
 * modal de consulta Itens/PDF das telas de Aprovações financeiras.
 */
export async function getMaintenanceBudgetApprovalDetails(
  maintenanceOrderId: string,
): Promise<MaintenanceBudgetApprovalDetails> {
  const { data: order, error: orderError } = await supabase
    .from('maintenance_orders')
    .select('os_number, approved_cost, budget_discount, budget_pdf_url, workshops(name)')
    .eq('id', maintenanceOrderId)
    .single();
  if (orderError) throw orderError;

  const { data: itemRows, error: itemsError } = await supabase
    .from('maintenance_budget_items')
    .select('*')
    .eq('maintenance_order_id', maintenanceOrderId)
    .order('sort_order');
  if (itemsError) throw itemsError;

  const row = order as unknown as {
    os_number: string;
    approved_cost: number | null;
    budget_discount: number | null;
    budget_pdf_url: string | null;
    workshops: { name: string } | null;
  };

  return {
    maintenanceOrderId,
    osNumber: row.os_number,
    approvedCost: Number(row.approved_cost ?? 0),
    budgetDiscount: Number(row.budget_discount ?? 0),
    budgetPdfUrl: row.budget_pdf_url ?? undefined,
    workshopName: row.workshops?.name ?? '—',
    items: (itemRows as MaintenanceBudgetItemRow[]).map(budgetItemFromRow),
  };
}

/**
 * Oficina inicia o serviço de uma OS com orçamento aprovado.
 * Só muda o status — nenhuma outra coluna é tocada.
 */
export async function startWorkshopService(id: string): Promise<void> {
  const { error } = await supabase
    .from('maintenance_orders')
    .update({ status: 'Serviço em execução' })
    .eq('id', id);
  if (error) throw error;
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
      actual_exit_date: status === 'Veículo retirado' ? new Date().toISOString() : null,
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
