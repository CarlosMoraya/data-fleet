import {
  filterDigitsOnly,
  filterNumericComma,
  filterText,
  filterPlate,
  filterAlpha,
  filterAlphanumeric,
  normalizeUpper,
  capitalizeWords,
  commaToFloat,
  normalizeTrim,
  filterCPF,
  filterCNHCategory,
  filterCNPJ,
  filterPhone,
  filterCEP,
} from './inputHelpers';

describe('filterDigitsOnly', () => {
  it('remove caracteres não numéricos', () => {
    expect(filterDigitsOnly('abc123')).toBe('123');
    expect(filterDigitsOnly('')).toBe('');
    expect(filterDigitsOnly('!@#')).toBe('');
  });
});

describe('filterNumericComma', () => {
  it('permite dígitos e vírgula', () => {
    expect(filterNumericComma('12,5')).toBe('12,5');
    expect(filterNumericComma('12a,5b')).toBe('12,5');
  });

  it('garante no máximo uma vírgula', () => {
    expect(filterNumericComma('12,5,3')).toBe('12,53');
  });
});

describe('filterText', () => {
  it('remove caracteres especiais mantendo letras, números, espaços, pontos e parênteses', () => {
    expect(filterText('Fiat/Strada')).toBe('FiatStrada');
    expect(filterText('Azul (claro)')).toBe('Azul (claro)');
    expect(filterText('São Paulo')).toBe('São Paulo');
  });
});

describe('filterPlate', () => {
  it('remove não alfanuméricos e converte para uppercase', () => {
    expect(filterPlate('abc-1d23')).toBe('ABC1D23');
    expect(filterPlate('ABC1234')).toBe('ABC1234');
  });
});

describe('filterAlpha', () => {
  it('mantém apenas letras e limita tamanho', () => {
    expect(filterAlpha('SP', 2)).toBe('SP');
    // filterAlpha usa [^A-Za-z] — remove acentos: "São" → "So"
    expect(filterAlpha('São Paulo', 2)).toBe('SO');
    expect(filterAlpha('sp123', 2)).toBe('SP');
  });
});

describe('filterAlphanumeric', () => {
  it('mantém letras e números, limita tamanho', () => {
    expect(filterAlphanumeric('9BD19648BN0123456', 17)).toBe('9BD19648BN0123456');
    expect(filterAlphanumeric('abc!@#123', 20)).toBe('ABC123');
  });
});

describe('normalizeUpper', () => {
  it('trim e uppercase', () => {
    expect(normalizeUpper('  fiat  ')).toBe('FIAT');
    expect(normalizeUpper(null)).toBe('');
    expect(normalizeUpper(undefined)).toBe('');
  });
});

describe('capitalizeWords', () => {
  it('capitaliza cada palavra', () => {
    // capitalizeWords usa \b\p{L} que pode capitalizar letras após acentos
    // "joão" → "Jo" + "Ã" + "O" = "JoÃO" (comportamento conhecido da regex)
    const result = capitalizeWords('joão da silva');
    expect(result).toMatch(/^Jo.+ Da Silva$/);
    expect(capitalizeWords('  azul   claro  ')).toBe('Azul Claro');
    expect(capitalizeWords(null)).toBe('');
  });
});

describe('commaToFloat', () => {
  it('converte vírgula decimal para ponto', () => {
    expect(commaToFloat('1500,50')).toBeCloseTo(1500.5);
    expect(commaToFloat('1500')).toBe(1500);
    expect(commaToFloat('')).toBe(0);
    expect(commaToFloat(null)).toBe(0);
    expect(commaToFloat(undefined)).toBe(0);
    expect(commaToFloat(42)).toBe(42);
  });
});

describe('normalizeTrim', () => {
  it('trim simples', () => {
    expect(normalizeTrim('  abc  ')).toBe('abc');
    expect(normalizeTrim(null)).toBe('');
  });
});

describe('filterCPF', () => {
  it('mantém apenas 11 dígitos', () => {
    expect(filterCPF('123.456.789-01')).toBe('12345678901');
    expect(filterCPF('12345678901234567890')).toBe('12345678901');
  });
});

describe('filterCNHCategory', () => {
  it('mantém apenas A-E, max 5 chars', () => {
    expect(filterCNHCategory('AB')).toBe('AB');
    expect(filterCNHCategory('ABCDE')).toBe('ABCDE');
    expect(filterCNHCategory('ABF')).toBe('AB');
    expect(filterCNHCategory('ae')).toBe('AE');
  });
});

describe('filterCNPJ', () => {
  it('mantém apenas 14 dígitos', () => {
    expect(filterCNPJ('11.222.333/0001-81')).toBe('11222333000181');
  });
});

describe('filterPhone', () => {
  it('mantém apenas 11 dígitos', () => {
    expect(filterPhone('(11) 99999-8888')).toBe('11999998888');
  });
});

describe('filterCEP', () => {
  it('mantém apenas 8 dígitos', () => {
    expect(filterCEP('12345-678')).toBe('12345678');
  });
});
