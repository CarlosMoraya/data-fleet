import { describe, expect, it } from 'vitest';

import {
  applySharedBoletoToDrafts,
  clearSharedBoletoFromDrafts,
  countDraftsWithDistinctBoleto,
} from './sharedBoleto';

import type { InstallmentDraft } from '../types/payment';

function draft(overrides: Partial<InstallmentDraft> = {}): InstallmentDraft {
  return {
    installmentNumber: 1,
    value: 100,
    dueDate: '2026-08-01',
    ...overrides,
  };
}

describe('applySharedBoletoToDrafts', () => {
  it('carimba o caminho em todos os 3 drafts vazios', () => {
    const drafts = [draft({ installmentNumber: 1 }), draft({ installmentNumber: 2 }), draft({ installmentNumber: 3 })];
    const result = applySharedBoletoToDrafts(drafts, 'path/shared.pdf');
    expect(result.every((d) => d.boletoUrl === 'path/shared.pdf')).toBe(true);
  });

  it('carimba o único draft de parcela única', () => {
    const drafts = [draft()];
    const result = applySharedBoletoToDrafts(drafts, 'path/shared.pdf');
    expect(result[0].boletoUrl).toBe('path/shared.pdf');
  });

  it('carimba também drafts com método pix', () => {
    const drafts = [draft({ paymentMethod: 'pix' })];
    const result = applySharedBoletoToDrafts(drafts, 'path/shared.pdf');
    expect(result[0].boletoUrl).toBe('path/shared.pdf');
  });

  it('não muta o array original', () => {
    const original = [draft()];
    const originalRef = original[0];
    applySharedBoletoToDrafts(original, 'path/shared.pdf');
    expect(original[0]).toBe(originalRef);
    expect(original[0].boletoUrl).toBeUndefined();
  });

  it('lista vazia retorna lista vazia', () => {
    expect(applySharedBoletoToDrafts([], 'path/shared.pdf')).toEqual([]);
  });
});

describe('countDraftsWithDistinctBoleto', () => {
  it('conta 2 individuais + 1 vazio como 2', () => {
    const drafts = [
      draft({ boletoUrl: 'path/individual-1.pdf' }),
      draft({ boletoUrl: 'path/individual-2.pdf' }),
      draft({}),
    ];
    expect(countDraftsWithDistinctBoleto(drafts, 'path/shared.pdf')).toBe(2);
  });

  it('retorna 0 quando todos já apontam para sharedPath', () => {
    const drafts = [draft({ boletoUrl: 'path/shared.pdf' }), draft({ boletoUrl: 'path/shared.pdf' })];
    expect(countDraftsWithDistinctBoleto(drafts, 'path/shared.pdf')).toBe(0);
  });

  it('lista vazia retorna 0', () => {
    expect(countDraftsWithDistinctBoleto([], 'path/shared.pdf')).toBe(0);
  });
});

describe('clearSharedBoletoFromDrafts', () => {
  it('limpa só os que batem com sharedPath, preserva os individuais', () => {
    const drafts = [
      draft({ boletoUrl: 'path/shared.pdf' }),
      draft({ boletoUrl: 'path/individual.pdf' }),
      draft({ boletoUrl: 'path/shared.pdf' }),
    ];
    const result = clearSharedBoletoFromDrafts(drafts, 'path/shared.pdf');
    expect(result[0].boletoUrl).toBeUndefined();
    expect(result[1].boletoUrl).toBe('path/individual.pdf');
    expect(result[2].boletoUrl).toBeUndefined();
  });

  it('lista vazia retorna lista vazia', () => {
    expect(clearSharedBoletoFromDrafts([], 'path/shared.pdf')).toEqual([]);
  });
});
