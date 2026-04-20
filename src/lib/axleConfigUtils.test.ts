import {
  getPhysicalAxles,
  getAvailableAxleTypes,
  getAvailableRodagem,
  tiresPerPhysicalAxle,
  calculateTotalTires,
  totalPhysicalAxles,
  AXLE_TYPE_LABELS,
  RODAGEM_LABELS,
} from './axleConfigUtils';

describe('getPhysicalAxles', () => {
  it('retorna quantidade correta de eixos físicos por tipo', () => {
    expect(getPhysicalAxles('direcional')).toBe(1);
    expect(getPhysicalAxles('simples')).toBe(1);
    expect(getPhysicalAxles('duplo')).toBe(2);
    expect(getPhysicalAxles('duplo_tandem')).toBe(2);
    expect(getPhysicalAxles('triplo_tandem')).toBe(3);
    expect(getPhysicalAxles('elevacao')).toBe(1);
  });
});

describe('getAvailableAxleTypes', () => {
  it('primeiro eixo é sempre direcional', () => {
    expect(getAvailableAxleTypes(4, true)).toEqual(['direcional']);
  });

  it('eixos subsequentes incluem tipos base', () => {
    const types = getAvailableAxleTypes(4, false);
    expect(types).toContain('direcional');
    expect(types).toContain('simples');
    expect(types).toContain('elevacao');
  });

  it('inclui duplo se >= 2 slots restantes', () => {
    const types = getAvailableAxleTypes(2, false);
    expect(types).toContain('duplo');
  });

  it('inclui triplo_tandem se >= 3 slots restantes', () => {
    const types = getAvailableAxleTypes(3, false);
    expect(types).toContain('triplo_tandem');
  });
});

describe('getAvailableRodagem', () => {
  it('primeiro eixo sem tripla', () => {
    expect(getAvailableRodagem(true)).toEqual(['simples', 'dupla']);
  });

  it('demais eixos com tripla', () => {
    expect(getAvailableRodagem(false)).toEqual(['simples', 'dupla', 'tripla']);
  });
});

describe('tiresPerPhysicalAxle', () => {
  it('retorna pneus por eixo físico', () => {
    expect(tiresPerPhysicalAxle('simples')).toBe(2);
    expect(tiresPerPhysicalAxle('dupla')).toBe(4);
    expect(tiresPerPhysicalAxle('tripla')).toBe(6);
  });
});

describe('calculateTotalTires', () => {
  it('calcula total com 2 eixos simples + 1 estepe', () => {
    const entries = [
      { order: 1, type: 'direcional' as const, rodagem: 'simples' as const, physicalAxles: 1 },
      { order: 2, type: 'simples' as const, rodagem: 'simples' as const, physicalAxles: 1 },
    ];
    expect(calculateTotalTires(entries, 1)).toBe(5); // 2 + 2 + 1
  });

  it('calcula total com eixo duplo + 2 estepes', () => {
    const entries = [
      { order: 1, type: 'direcional' as const, rodagem: 'simples' as const, physicalAxles: 1 },
      { order: 2, type: 'duplo' as const, rodagem: 'dupla' as const, physicalAxles: 2 },
    ];
    // Eixo 1: 1 * 2 = 2, Eixo 2: 2 * 4 = 8, Estepes: 2
    expect(calculateTotalTires(entries, 2)).toBe(12);
  });
});

describe('totalPhysicalAxles', () => {
  it('soma eixos físicos', () => {
    const entries = [
      { order: 1, type: 'direcional' as const, rodagem: 'simples' as const, physicalAxles: 1 },
      { order: 2, type: 'duplo_tandem' as const, rodagem: 'dupla' as const, physicalAxles: 2 },
    ];
    expect(totalPhysicalAxles(entries)).toBe(3);
  });
});

describe('labels', () => {
  it('AXLE_TYPE_LABELS tem todos os tipos', () => {
    expect(Object.keys(AXLE_TYPE_LABELS).length).toBe(6);
  });

  it('RODAGEM_LABELS tem todos os tipos', () => {
    expect(Object.keys(RODAGEM_LABELS).length).toBe(3);
  });
});
