import { describe, expect, it } from 'vitest';

import { normalizeReasonText } from './reasonText';

describe('normalizeReasonText', () => {
  it('apara espaços ao redor do texto', () => {
    expect(normalizeReasonText('  troca emergencial  ', 500)).toBe('troca emergencial');
  });

  it('devolve o texto quando já está aparado', () => {
    expect(normalizeReasonText('motor fundido', 500)).toBe('motor fundido');
  });

  it('devolve null para texto vazio', () => {
    expect(normalizeReasonText('', 500)).toBeNull();
  });

  it('devolve null para texto só com espaços', () => {
    expect(normalizeReasonText('    ', 500)).toBeNull();
  });

  it('devolve null para texto só com quebras e tabulações', () => {
    expect(normalizeReasonText('\n\t', 500)).toBeNull();
  });

  it('aceita texto exatamente no teto', () => {
    expect(normalizeReasonText('a'.repeat(500), 500)).toBe('a'.repeat(500));
  });

  it('devolve null para texto acima do teto', () => {
    expect(normalizeReasonText('a'.repeat(501), 500)).toBeNull();
  });

  it('mede o comprimento depois do trim', () => {
    expect(normalizeReasonText(`  ${'a'.repeat(500)}  `, 500)).toBe('a'.repeat(500));
  });
});
