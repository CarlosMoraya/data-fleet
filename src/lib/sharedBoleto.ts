import type { InstallmentDraft } from '../types/payment';

export function applySharedBoletoToDrafts(drafts: InstallmentDraft[], sharedPath: string): InstallmentDraft[] {
  return drafts.map((d) => ({ ...d, boletoUrl: sharedPath }));
}

export function countDraftsWithDistinctBoleto(drafts: InstallmentDraft[], sharedPath: string): number {
  return drafts.filter((d) => d.boletoUrl && d.boletoUrl !== sharedPath).length;
}

export function clearSharedBoletoFromDrafts(drafts: InstallmentDraft[], sharedPath: string): InstallmentDraft[] {
  return drafts.map((d) => (d.boletoUrl === sharedPath ? { ...d, boletoUrl: undefined } : d));
}
