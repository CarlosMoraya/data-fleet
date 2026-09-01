import { describe, expect, it } from 'vitest';

import { normalizeSearchText } from './textSearch';

describe('normalizeSearchText', () => {
  it('normaliza acentos', () => {
    expect(normalizeSearchText('Oficina São João')).toBe('oficina sao joao');
  });

  it('normaliza caixa', () => {
    expect(normalizeSearchText('ABC1D23')).toBe('abc1d23');
  });

  it('remove espaços nas pontas', () => {
    expect(normalizeSearchText('  OS-123  ')).toBe('os-123');
  });

  it('devolve vazio para valores ausentes ou vazios', () => {
    expect(normalizeSearchText(undefined)).toBe('');
    expect(normalizeSearchText(null)).toBe('');
    expect(normalizeSearchText('')).toBe('');
  });
});
