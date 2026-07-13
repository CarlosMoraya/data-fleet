import type { ExtraPaymentCategory, ExtraPaymentRequest, ExtraPaymentStatus } from '../types/serviceExpense';

export interface ExtraPaymentFilters {
  statuses?: ExtraPaymentStatus[];
  categories?: ExtraPaymentCategory[];
}

export interface ExtraPaymentCounts {
  pendente_aprovacao: number;
  aprovado: number;
  reprovado: number;
  pago: number;
  cancelado: number;
}

/**
 * Busca textual por número, fornecedor, documento, placa, motorista,
 * descrição e categoria (case-insensitive).
 */
export function matchesExtraPaymentSearch(item: ExtraPaymentRequest, search: string): boolean {
  const trimmed = search.trim();
  if (!trimmed) return true;
  const needle = trimmed.toLowerCase();

  const haystacks = [
    item.requestNumber,
    item.supplierName,
    item.supplierDocument,
    item.vehicleLicensePlate,
    item.driverName,
    item.description,
    item.category,
  ];

  return haystacks.some((value) => (value ?? '').toLowerCase().includes(needle));
}

export function filterExtraPayments(
  items: ExtraPaymentRequest[],
  filters: ExtraPaymentFilters,
): ExtraPaymentRequest[] {
  const statusSet = filters.statuses && filters.statuses.length > 0 ? new Set(filters.statuses) : null;
  const categorySet = filters.categories && filters.categories.length > 0 ? new Set(filters.categories) : null;

  return items.filter((item) => {
    if (statusSet && !statusSet.has(item.status)) return false;
    if (categorySet && !categorySet.has(item.category)) return false;
    return true;
  });
}

export function computeExtraPaymentCounts(items: ExtraPaymentRequest[]): ExtraPaymentCounts {
  const counts: ExtraPaymentCounts = {
    pendente_aprovacao: 0,
    aprovado: 0,
    reprovado: 0,
    pago: 0,
    cancelado: 0,
  };

  for (const item of items) {
    counts[item.status] += 1;
  }

  return counts;
}
