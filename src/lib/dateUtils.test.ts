import { formatDate, formatPhone } from './dateUtils';

describe('formatDate', () => {
  it('formata data ISO simples', () => {
    const result = formatDate('2025-04-11');
    // Pode variar por fuso horário
    expect(result).toMatch(/\d{2}\/04\/2025/);
  });

  it('formata data ISO com hora', () => {
    // UTC → pode deslocar dependendo do fuso local
    const result = formatDate('2025-04-11T14:30:00');
    // O formato inclui data e hora (o dia pode variar por fuso)
    expect(result).toMatch(/\d{2}\/\d{2}\/\d{4}/);
    expect(result).toMatch(/14:30|11:30|17:30/);
  });

  it('retorna — para valores nulos/inválidos', () => {
    expect(formatDate(null)).toBe('—');
    expect(formatDate(undefined)).toBe('—');
    expect(formatDate('')).toBe('—');
    expect(formatDate('invalido')).toBe('—');
  });
});

describe('formatPhone', () => {
  it('formata celular (11 dígitos)', () => {
    expect(formatPhone('11999998888')).toBe('(11) 99999-8888');
  });

  it('formata fixo (10 dígitos)', () => {
    expect(formatPhone('1133334444')).toBe('(11) 3333-4444');
  });

  it('retorna original se tamanho inesperado', () => {
    expect(formatPhone('123')).toBe('123');
  });

  it('retorna — para nulo/vazio', () => {
    expect(formatPhone(null)).toBe('—');
    expect(formatPhone('')).toBe('—');
  });
});
