import type { WarrantyRevisionStatus, WarrantyRegime } from '../types/warrantyRevision';

export const WARRANTY_STATUS_LABEL: Record<WarrantyRevisionStatus, string> = {
  em_dia: 'Em dia',
  a_vencer: 'A vencer',
  vencida: 'Vencida',
  aguardando_proxima: 'Aguardando próxima',
};

export const WARRANTY_STATUS_BADGE: Record<WarrantyRevisionStatus, string> = {
  em_dia: 'bg-emerald-50 text-emerald-700',
  a_vencer: 'bg-amber-50 text-amber-700',
  vencida: 'bg-red-50 text-red-700',
  aguardando_proxima: 'bg-blue-50 text-blue-700',
};

export const WARRANTY_REGIME_LABEL: Record<WarrantyRegime, string> = {
  warranty: 'Garantia',
  preventive: 'Preventiva',
  none: '—',
};

export const WARRANTY_ISSUE_VALUES: WarrantyRevisionStatus[] = [
  'em_dia',
  'a_vencer',
  'vencida',
  'aguardando_proxima',
];

export function formatKm(km: number | null | undefined): string {
  if (km == null) return '—';
  return km.toLocaleString('pt-BR');
}

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  const [y, m, d] = iso.split('T')[0].split('-');
  return `${d}/${m}/${y}`;
}