import { paymentInstallmentFromRow } from '../lib/paymentMappers';
import { supabase } from '../lib/supabase';

import type {
  PaymentInstallment,
  PaymentInstallmentAuditors,
  PaymentInstallmentRow,
  PaymentInstallmentStatus,
  PaymentMethod,
  PixKeyType,
} from '../types/payment';

// ─── Tipos ───────────────────────────────────────────────────────────────────

export interface PaymentInstallmentFilters {
  maintenanceOrderId?: string;
  status?: PaymentInstallmentStatus;
  paymentMethod?: PaymentMethod;
  clientId?: string;
}

export type PaymentInstallmentPatch = Partial<{
  value: number;
  due_date: string;
  payment_method: PaymentMethod;
  competencia_date: string | null;
  boleto_url: string | null;
  nota_fiscal_url: string | null;
  nota_fiscal_url_2: string | null;
  invoice_number: string | null;
  pix_key_type: PixKeyType | null;
  pix_key: string | null;
  pix_beneficiary_name: string | null;
  categoria: string | null;
  centro_custo: string | null;
  descricao: string | null;
  notes: string | null;
}>;

export interface InstallmentDraftInput {
  installmentNumber: number;
  value: number;
  dueDate: string;
  paymentMethod: PaymentMethod;
  pixKeyType?: PixKeyType | null;
  pixKey?: string | null;
  pixBeneficiaryName?: string | null;
  boletoUrl?: string | null;
}

export interface CreateInstallmentBatchInput {
  maintenanceOrderId: string;
  clientId: string;
  createdById: string;
  installmentsTotal: number;
  competenciaDate?: string | null;
  categoria?: string | null;
  centroCusto?: string | null;
  descricao?: string | null;
  notaFiscalUrl?: string | null;
  notaFiscalUrl2?: string | null;
  invoiceNumber?: string | null;
  drafts: InstallmentDraftInput[];
}

export interface ApprovedOrderForPayment {
  id: string;
  osNumber: string;
  approvedCost: number;
  budgetPdfUrl?: string;
  workshopName: string;
  workshopCnpj?: string;
  clientId: string;
}

const INSTALLMENT_SELECT = `
  id, maintenance_order_id, client_id, installment_number, installments_total,
  value, due_date, competencia_date, status, payment_method, boleto_url,
  nota_fiscal_url, nota_fiscal_url_2, invoice_number, pix_key_type, pix_key, pix_beneficiary_name, categoria,
  centro_custo, descricao, notes, created_by_id, payment_approved_by,
  payment_approved_at, paid_by, paid_at, created_at, updated_at,
  maintenance_orders(os_number, budget_pdf_url, budget_reviewed_by, workshops(name, cnpj), budget_reviewer:profiles!maintenance_orders_budget_reviewed_by_fkey(name))
`;

// ─── Funções de serviço ──────────────────────────────────────────────────────

/**
 * Lista parcelas de pagamento com filtros opcionais (OS, status, forma, cliente).
 */
export async function listPaymentInstallments(
  filters: PaymentInstallmentFilters = {},
): Promise<PaymentInstallment[]> {
  let query = supabase
    .from('payment_installments')
    .select(INSTALLMENT_SELECT)
    .order('installment_number', { ascending: true });

  if (filters.maintenanceOrderId) {
    query = query.eq('maintenance_order_id', filters.maintenanceOrderId);
  }
  if (filters.status) {
    query = query.eq('status', filters.status);
  }
  if (filters.paymentMethod) {
    query = query.eq('payment_method', filters.paymentMethod);
  }
  if (filters.clientId) {
    query = query.eq('client_id', filters.clientId);
  }

  const { data, error } = await query;
  if (error) throw error;
  return ((data ?? []) as unknown as PaymentInstallmentRow[]).map(paymentInstallmentFromRow);
}

/**
 * Resolve os nomes de auditoria (orçamento/pagamento/pago) de uma parcela
 * via RPC SECURITY DEFINER, contornando a RLS de profiles de forma controlada.
 * Retorna nomes vazios (undefined) quando a ação não ocorreu ou o chamador
 * não pode ver a parcela.
 */
export async function getPaymentInstallmentAuditors(
  installmentId: string,
): Promise<PaymentInstallmentAuditors> {
  const { data, error } = await supabase.rpc('get_payment_installment_auditors', {
    p_installment_id: installmentId,
  });
  if (error) throw error;

  const row = (data ?? [])[0] as
    | {
        budget_approved_by_name: string | null;
        payment_approved_by_name: string | null;
        paid_by_name: string | null;
      }
    | undefined;

  return {
    budgetApprovedByName: row?.budget_approved_by_name ?? undefined,
    paymentApprovedByName: row?.payment_approved_by_name ?? undefined,
    paidByName: row?.paid_by_name ?? undefined,
  };
}

/**
 * Insere um lote de parcelas numa única chamada `insert(array)`.
 * Se falhar, nenhuma parcela é criada. Status inicial: pendente_aprovacao.
 * A auditoria de aprovação/pagamento é preenchida pelo trigger do banco.
 */
export async function createPaymentInstallmentsBatch(
  input: CreateInstallmentBatchInput,
): Promise<void> {
  if (input.drafts.length === 0) return;

  const rows = input.drafts.map((d) => ({
    maintenance_order_id: input.maintenanceOrderId,
    client_id: input.clientId,
    created_by_id: input.createdById,
    installments_total: input.installmentsTotal,
    installment_number: d.installmentNumber,
    value: d.value,
    due_date: d.dueDate,
    payment_method: d.paymentMethod,
    competencia_date: input.competenciaDate ?? null,
    categoria: input.categoria ?? null,
    centro_custo: input.centroCusto ?? null,
    descricao: input.descricao ?? null,
    nota_fiscal_url: input.notaFiscalUrl ?? null,
    nota_fiscal_url_2: input.notaFiscalUrl2 ?? null,
    invoice_number: input.invoiceNumber ?? null,
    pix_key_type: d.pixKeyType ?? null,
    pix_key: d.pixKey ?? null,
    pix_beneficiary_name: d.pixBeneficiaryName ?? null,
    boleto_url: d.boletoUrl ?? null,
    status: 'pendente_aprovacao' as PaymentInstallmentStatus,
  }));

  const { error } = await supabase.from('payment_installments').insert(rows);
  if (error) throw error;
}

/**
 * Atualiza campos editáveis de uma parcela (docs/contábeis/notes).
 * Transições de status NÃO passam por aqui — use approve/reject/markPaid.
 */
export async function updatePaymentInstallment(
  id: string,
  patch: PaymentInstallmentPatch,
): Promise<void> {
  const { error } = await supabase.from('payment_installments').update(patch).eq('id', id);
  if (error) throw error;
}

/**
 * Aprova uma parcela (status → aprovado). O trigger grava autor + timestamp.
 */
export async function approvePaymentInstallment(id: string): Promise<void> {
  const { error } = await supabase
    .from('payment_installments')
    .update({ status: 'aprovado' })
    .eq('id', id);
  if (error) throw error;
}

/**
 * Reprova uma parcela (status → reprovado). O trigger grava autor + timestamp.
 */
export async function rejectPaymentInstallment(id: string): Promise<void> {
  const { error } = await supabase
    .from('payment_installments')
    .update({ status: 'reprovado' })
    .eq('id', id);
  if (error) throw error;
}

/**
 * Marca um lote de parcelas como pagas (status → pago) num único UPDATE.
 * O trigger grava autor + timestamp e rejeita transições inválidas.
 */
export async function markInstallmentsPaid(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  const { error } = await supabase
    .from('payment_installments')
    .update({ status: 'pago' })
    .in('id', ids);
  if (error) throw error;
}

/**
 * Deleta uma parcela.
 */
export async function deletePaymentInstallment(id: string): Promise<void> {
  const { error } = await supabase.from('payment_installments').delete().eq('id', id);
  if (error) throw error;
}

/**
 * Lista OS com budget_status='aprovado' para o dropdown de cadastro de pagamento.
 * Traz approved_cost, budget_pdf_url e workshops(name, cnpj).
 */
export async function listApprovedOrdersForPayment(
  clientId?: string,
): Promise<ApprovedOrderForPayment[]> {
  let query = supabase
    .from('maintenance_orders')
    .select(`
      id, os_number, client_id, approved_cost, budget_pdf_url,
      workshops(name, cnpj)
    `)
    .eq('budget_status', 'aprovado')
    .order('created_at', { ascending: false });

  if (clientId) {
    query = query.eq('client_id', clientId);
  }

  const { data, error } = await query;
  if (error) throw error;

  type Row = {
    id: string;
    os_number: string;
    client_id: string;
    approved_cost: number | null;
    budget_pdf_url: string | null;
    workshops: { name: string; cnpj: string | null } | null;
  };

  return ((data ?? []) as unknown as Row[]).map((row) => ({
    id: row.id,
    osNumber: row.os_number,
    approvedCost: row.approved_cost != null ? Number(row.approved_cost) : 0,
    budgetPdfUrl: row.budget_pdf_url ?? undefined,
    workshopName: row.workshops?.name ?? '—',
    workshopCnpj: row.workshops?.cnpj ?? undefined,
    clientId: row.client_id,
  }));
}
