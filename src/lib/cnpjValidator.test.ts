import { isValidCNPJ, formatCNPJ } from './cnpjValidator';

describe('isValidCNPJ', () => {
  it('aceita CNPJs válidos conhecidos', () => {
    expect(isValidCNPJ('11.222.333/0001-81')).toBe(true);
    expect(isValidCNPJ('00.623.904/0001-73')).toBe(true);
    expect(isValidCNPJ('11222333000181')).toBe(true);
  });

  it('rejeita CNPJs inválidos', () => {
    expect(isValidCNPJ('12.345.678/0001-00')).toBe(false);
    expect(isValidCNPJ('00000000000000')).toBe(false);
    expect(isValidCNPJ('11111111111111')).toBe(false);
  });

  it('rejeita CNPJs com tamanho errado', () => {
    expect(isValidCNPJ('12345678901')).toBe(false);
    expect(isValidCNPJ('')).toBe(false);
  });
});

describe('formatCNPJ', () => {
  it('formata CNPJ com máscara', () => {
    expect(formatCNPJ('11222333000181')).toBe('11.222.333/0001-81');
  });

  it('retorna sem formatação se tamanho incorreto', () => {
    expect(formatCNPJ('123')).toBe('123');
  });
});
