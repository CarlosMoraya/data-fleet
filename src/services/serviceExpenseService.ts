import { extraPaymentRequestFromRow, extraPaymentRequestToInsert } from '../lib/serviceExpenseMappers';
import { supabase } from '../lib/supabase';

import type {
  ExtraPaymentAuditors,
  ExtraPaymentDriverOption,
  ExtraPaymentFormInput,
  ExtraPaymentRequest,
  ExtraPaymentRequestRow,
  ExtraPaymentVehicleOption,
} from '../types/serviceExpense';

const EXTRA_PAYMENT_SELECT = `
  id, client_id, request_number, category, service_date, supplier_name, supplier_document,
  vehicle_id, driver_id, amount, description, justification, notes, receipt_url, invoice_url,
  status, created_by_id, approved_by, approved_at, rejected_by, rejected_at, rejection_reason,
  paid_by, paid_at, created_at, updated_at,
  vehicles(license_plate), drivers(name), approver:profiles!extra_payment_requests_approved_by_fkey(name)
`;

export interface CreateExtraPaymentRequestInput {
  input: ExtraPaymentFormInput;
  clientId: string;
  userId: string;
}

/**
 * Lista cabeçalhos de Pagamentos Extras com joins de veículo/motorista/aprovador.
 */
export async function listExtraPaymentRequests(
  filters: { clientId?: string } = {},
): Promise<ExtraPaymentRequest[]> {
  let query = supabase
    .from('extra_payment_requests')
    .select(EXTRA_PAYMENT_SELECT)
    .order('created_at', { ascending: false });

  if (filters.clientId) {
    query = query.eq('client_id', filters.clientId);
  }

  const { data, error } = await query;
  if (error) throw error;
  return ((data ?? []) as unknown as ExtraPaymentRequestRow[]).map(extraPaymentRequestFromRow);
}

/**
 * Resolve o próximo número de Pagamento Extra (PE-YYMM-0001) via RPC,
 * evitando corrida de concorrência no cliente.
 */
export async function getNextExtraPaymentRequestNumber(clientId: string): Promise<string> {
  const { data, error } = await supabase.rpc('next_extra_payment_request_number', {
    p_client_id: clientId,
  });
  if (error) throw error;
  return data as string;
}

/**
 * Lista veículos ativos do tenant com o motorista vinculado (para autopreenchimento).
 */
export async function listExtraPaymentVehicles(clientId?: string): Promise<ExtraPaymentVehicleOption[]> {
  let query = supabase
    .from('vehicles')
    .select('id, license_plate, driver_id, drivers(name)')
    .eq('active', true)
    .order('license_plate');

  if (clientId) {
    query = query.eq('client_id', clientId);
  }

  const { data, error } = await query;
  if (error) throw error;

  type Row = {
    id: string;
    license_plate: string;
    driver_id: string | null;
    drivers: { name: string } | null;
  };

  return ((data ?? []) as unknown as Row[]).map((row) => ({
    id: row.id,
    licensePlate: row.license_plate,
    driverId: row.driver_id ?? undefined,
    driverName: row.drivers?.name ?? undefined,
  }));
}

/**
 * Lista motoristas ativos do tenant com o veículo vinculado (para autopreenchimento).
 */
export async function listExtraPaymentDrivers(clientId?: string): Promise<ExtraPaymentDriverOption[]> {
  let query = supabase
    .from('drivers')
    .select('id, name, vehicles(id, license_plate)')
    .eq('active', true)
    .order('name');

  if (clientId) {
    query = query.eq('client_id', clientId);
  }

  const { data, error } = await query;
  if (error) throw error;

  type Row = {
    id: string;
    name: string;
    vehicles: { id: string; license_plate: string }[] | { id: string; license_plate: string } | null;
  };

  return ((data ?? []) as unknown as Row[]).map((row) => {
    const vehicle = Array.isArray(row.vehicles) ? row.vehicles[0] : row.vehicles;
    return {
      id: row.id,
      name: row.name,
      vehicleId: vehicle?.id ?? undefined,
      vehicleLicensePlate: vehicle?.license_plate ?? undefined,
    };
  });
}

/**
 * Cria o cabeçalho de um Pagamento Extra. As parcelas são criadas
 * separadamente via createExtraPaymentInstallmentsBatch.
 */
export async function createExtraPaymentRequest(input: CreateExtraPaymentRequestInput): Promise<string> {
  const requestNumber = await getNextExtraPaymentRequestNumber(input.clientId);
  const payload = extraPaymentRequestToInsert(input.input, input.clientId, input.userId, requestNumber);

  const { data, error } = await supabase
    .from('extra_payment_requests')
    .insert(payload)
    .select('id')
    .single();
  if (error) throw error;
  return (data as { id: string }).id;
}

/**
 * Aprova um Pagamento Extra (status → aprovado). O trigger grava autor + timestamp
 * e propaga a aprovação para as parcelas vinculadas.
 */
export async function approveExtraPaymentRequest(id: string): Promise<void> {
  const { error } = await supabase
    .from('extra_payment_requests')
    .update({ status: 'aprovado' })
    .eq('id', id);
  if (error) throw error;
}

/**
 * Reprova um Pagamento Extra (status → reprovado), exigindo motivo.
 */
export async function rejectExtraPaymentRequest(id: string, reason: string): Promise<void> {
  const { error } = await supabase
    .from('extra_payment_requests')
    .update({ status: 'reprovado', rejection_reason: reason })
    .eq('id', id);
  if (error) throw error;
}

/**
 * Cancela um Pagamento Extra pendente de aprovação (status → cancelado).
 */
export async function cancelExtraPaymentRequest(id: string): Promise<void> {
  const { error } = await supabase
    .from('extra_payment_requests')
    .update({ status: 'cancelado' })
    .eq('id', id);
  if (error) throw error;
}

/**
 * Resolve os nomes de auditoria (criado por, aprovado por, reprovado por,
 * pago por) de um Pagamento Extra via RPC SECURITY DEFINER.
 */
export async function getExtraPaymentAuditors(id: string): Promise<ExtraPaymentAuditors> {
  const { data, error } = await supabase.rpc('get_extra_payment_auditors', {
    p_extra_payment_request_id: id,
  });
  if (error) throw error;

  const row = (data ?? [])[0] as
    | {
        created_by_name: string | null;
        approved_by_name: string | null;
        rejected_by_name: string | null;
        paid_by_name: string | null;
      }
    | undefined;

  return {
    createdByName: row?.created_by_name ?? undefined,
    approvedByName: row?.approved_by_name ?? undefined,
    rejectedByName: row?.rejected_by_name ?? undefined,
    paidByName: row?.paid_by_name ?? undefined,
  };
}
