import { describe, expect, it } from 'vitest';

import {
  canAddMoreEvidencePhotos,
  remainingEvidenceSlots,
  validateEvidencePhoto,
} from './extraPaymentEvidence';

function makeFile(sizeBytes: number, type: string): File {
  return new File([new Uint8Array(sizeBytes)], 'file', { type });
}

describe('canAddMoreEvidencePhotos', () => {
  it.each([0, 1, 2])('retorna true para currentCount = %i', (count) => {
    expect(canAddMoreEvidencePhotos(count)).toBe(true);
  });

  it('retorna false para currentCount = 3', () => {
    expect(canAddMoreEvidencePhotos(3)).toBe(false);
  });

  it('retorna false para currentCount = 4', () => {
    expect(canAddMoreEvidencePhotos(4)).toBe(false);
  });
});

describe('remainingEvidenceSlots', () => {
  it('retorna 3 para currentCount = 0', () => {
    expect(remainingEvidenceSlots(0)).toBe(3);
  });

  it('retorna 1 para currentCount = 2', () => {
    expect(remainingEvidenceSlots(2)).toBe(1);
  });

  it('retorna 0 para currentCount = 3', () => {
    expect(remainingEvidenceSlots(3)).toBe(0);
  });

  it('nunca retorna negativo para currentCount = 5', () => {
    expect(remainingEvidenceSlots(5)).toBe(0);
  });
});

describe('validateEvidencePhoto', () => {
  it('não lança para image/jpeg de 1MB', () => {
    const file = makeFile(1 * 1024 * 1024, 'image/jpeg');
    expect(() => validateEvidencePhoto(file)).not.toThrow();
  });

  it('lança "Apenas imagens" para application/pdf', () => {
    const file = makeFile(1024, 'application/pdf');
    expect(() => validateEvidencePhoto(file)).toThrow(/Apenas imagens/);
  });

  it('lança a mensagem de limite de 10MB para imagem de 11MB', () => {
    const file = makeFile(11 * 1024 * 1024, 'image/jpeg');
    expect(() => validateEvidencePhoto(file)).toThrow(/10MB/);
  });
});
