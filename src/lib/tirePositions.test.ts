import { generatePositions, generatePositionsFromConfig, validatePositionAssignment } from './tirePositions';

describe('generatePositions', () => {
  it('gera posições para moto', () => {
    const positions = generatePositions(1, [], 0, 'Moto');
    expect(positions).toHaveLength(2);
    expect(positions[0].code).toBe('E1');
    expect(positions[1].code).toBe('D1');
  });

  it('gera posições para 2 eixos simples + 1 estepe', () => {
    const positions = generatePositions(2, [], 1, 'Toco');
    expect(positions).toHaveLength(5); // E1, D1, E2, D2, Step 1
    expect(positions[0].code).toBe('E1');
    expect(positions[1].code).toBe('D1');
    expect(positions[4].code).toBe('Step 1');
  });

  it('gera posições com eixo duplo', () => {
    const positions = generatePositions(2, [2], 1, 'Truck');
    // E1, D1 (simples) + E2IN, E2EX, D2IN, D2EX (duplo) + Step 1
    expect(positions).toHaveLength(7);
    expect(positions[2].code).toBe('E2IN');
    expect(positions[2].type).toBe('dual_internal');
  });

  it('gera estepes corretamente', () => {
    const positions = generatePositions(1, [], 3, 'Toco');
    const spares = positions.filter(p => p.type === 'spare');
    expect(spares).toHaveLength(3);
    expect(spares[0].code).toBe('Step 1');
    expect(spares[2].code).toBe('Step 3');
  });
});

describe('generatePositionsFromConfig', () => {
  it('gera posições para moto', () => {
    const positions = generatePositionsFromConfig([], 0, 'Moto');
    expect(positions).toHaveLength(2);
  });

  it('gera posições com rodagem simples', () => {
    const entries = [
      { order: 1, type: 'direcional' as const, rodagem: 'simples' as const, physicalAxles: 1 },
    ];
    const positions = generatePositionsFromConfig(entries, 0, 'Toco');
    expect(positions).toHaveLength(2);
    expect(positions[0].code).toBe('E1');
    expect(positions[1].code).toBe('D1');
  });

  it('gera posições com rodagem dupla', () => {
    const entries = [
      { order: 1, type: 'direcional' as const, rodagem: 'dupla' as const, physicalAxles: 1 },
    ];
    const positions = generatePositionsFromConfig(entries, 0, 'Truck');
    expect(positions).toHaveLength(4);
    expect(positions.map(p => p.code)).toEqual(['E1IN', 'E1EX', 'D1IN', 'D1EX']);
  });

  it('gera posições com rodagem tripla', () => {
    const entries = [
      { order: 1, type: 'simples' as const, rodagem: 'tripla' as const, physicalAxles: 1 },
    ];
    const positions = generatePositionsFromConfig(entries, 0, 'Cavalo');
    expect(positions).toHaveLength(6);
    expect(positions.map(p => p.code)).toEqual(['E1IN', 'E1M', 'E1EX', 'D1IN', 'D1M', 'D1EX']);
  });

  it('gera estepes', () => {
    const entries = [
      { order: 1, type: 'direcional' as const, rodagem: 'simples' as const, physicalAxles: 1 },
    ];
    const positions = generatePositionsFromConfig(entries, 2, 'Toco');
    const spares = positions.filter(p => p.type === 'spare');
    expect(spares).toHaveLength(2);
  });
});

describe('validatePositionAssignment', () => {
  const makeTire = (id: string, pos: string, active: boolean) =>
    ({ id, currentPosition: pos, active, tireCode: 'TIRE-' + id } as any);

  it('retorna null quando posição está livre', () => {
    const tires = [makeTire('1', 'E1', true)];
    expect(validatePositionAssignment('D1', tires)).toBeNull();
  });

  it('retorna erro quando posição está ocupada', () => {
    const tires = [makeTire('1', 'E1', true)];
    const result = validatePositionAssignment('E1', tires);
    expect(result).toBe('Posição já ocupada por TIRE-1');
  });

  it('ignora pneu excluído (edição)', () => {
    const tires = [makeTire('1', 'E1', true)];
    expect(validatePositionAssignment('E1', tires, '1')).toBeNull();
  });

  it('ignora pneus inativos', () => {
    const tires = [makeTire('1', 'E1', false)];
    expect(validatePositionAssignment('E1', tires)).toBeNull();
  });
});
