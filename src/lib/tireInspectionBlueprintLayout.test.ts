import { describe, it, expect } from 'vitest';
import { calculateBlueprintLayout } from './tireInspectionBlueprintLayout';
import type { AxleConfigEntry } from '../types/tire';

// ─── Fixtures de AxleConfig ───────────────────────────────────────────────────

const twoAxleSimples: AxleConfigEntry[] = [
  { order: 1, type: 'direcional', rodagem: 'simples', physicalAxles: 1 },
  { order: 2, type: 'simples', rodagem: 'simples', physicalAxles: 1 },
];

const twoAxleDupla: AxleConfigEntry[] = [
  { order: 1, type: 'direcional', rodagem: 'simples', physicalAxles: 1 },
  { order: 2, type: 'simples', rodagem: 'dupla', physicalAxles: 1 },
];

const twoAxleTripla: AxleConfigEntry[] = [
  { order: 1, type: 'direcional', rodagem: 'simples', physicalAxles: 1 },
  { order: 2, type: 'simples', rodagem: 'tripla', physicalAxles: 1 },
];

const duploTandemConfig: AxleConfigEntry[] = [
  { order: 1, type: 'direcional', rodagem: 'simples', physicalAxles: 1 },
  { order: 2, type: 'duplo_tandem', rodagem: 'dupla', physicalAxles: 2 },
];

// ─── Estrutura básica ─────────────────────────────────────────────────────────

describe('calculateBlueprintLayout — estrutura básica', () => {
  it('retorna dimensões SVG maiores que zero', () => {
    const layout = calculateBlueprintLayout(twoAxleSimples, 1, 'Truck');

    expect(layout.svgWidth).toBeGreaterThan(0);
    expect(layout.svgHeight).toBeGreaterThan(0);
  });

  it('bodyX e bodyY são positivos', () => {
    const layout = calculateBlueprintLayout(twoAxleSimples, 0, 'Truck');

    expect(layout.bodyX).toBeGreaterThan(0);
    expect(layout.bodyY).toBeGreaterThan(0);
  });

  it('retorna nodes para cada posição esperada', () => {
    // 2 eixos simples: E1, D1, E2, D2 = 4 nós
    const layout = calculateBlueprintLayout(twoAxleSimples, 0, 'Truck');
    const codes = layout.nodes.map(n => n.positionCode);

    expect(codes).toContain('E1');
    expect(codes).toContain('D1');
    expect(codes).toContain('E2');
    expect(codes).toContain('D2');
    expect(layout.nodes).toHaveLength(4);
  });
});

// ─── Rodagem simples ──────────────────────────────────────────────────────────

describe('calculateBlueprintLayout — rodagem simples', () => {
  it('gera 2 nós por eixo (esquerdo e direito)', () => {
    const layout = calculateBlueprintLayout(twoAxleSimples, 0, 'Truck');

    const axle2nodes = layout.nodes.filter(n => n.positionCode.startsWith('E2') || n.positionCode.startsWith('D2'));
    expect(axle2nodes).toHaveLength(2);
  });
});

// ─── Rodagem dupla ────────────────────────────────────────────────────────────

describe('calculateBlueprintLayout — rodagem dupla', () => {
  it('gera 4 nós no eixo com rodagem dupla (IN + EX por lado)', () => {
    const layout = calculateBlueprintLayout(twoAxleDupla, 0, 'Truck');

    const axle2nodes = layout.nodes.filter(n => n.positionCode.includes('2'));
    expect(axle2nodes).toHaveLength(4);

    const codes = axle2nodes.map(n => n.positionCode);
    expect(codes).toContain('E2IN');
    expect(codes).toContain('E2EX');
    expect(codes).toContain('D2IN');
    expect(codes).toContain('D2EX');
  });
});

// ─── Rodagem tripla ───────────────────────────────────────────────────────────

describe('calculateBlueprintLayout — rodagem tripla', () => {
  it('gera 6 nós no eixo com rodagem tripla (IN + M + EX por lado)', () => {
    const layout = calculateBlueprintLayout(twoAxleTripla, 0, 'Truck');

    const axle2nodes = layout.nodes.filter(n => n.positionCode.includes('2'));
    expect(axle2nodes).toHaveLength(6);

    const codes = axle2nodes.map(n => n.positionCode);
    expect(codes).toContain('E2IN');
    expect(codes).toContain('E2M');
    expect(codes).toContain('E2EX');
    expect(codes).toContain('D2IN');
    expect(codes).toContain('D2M');
    expect(codes).toContain('D2EX');
  });
});

// ─── Estepes ──────────────────────────────────────────────────────────────────

describe('calculateBlueprintLayout — estepes', () => {
  it('gera nós de estepe com side = Step', () => {
    const layout = calculateBlueprintLayout(twoAxleSimples, 2, 'Truck');

    const spares = layout.nodes.filter(n => n.side === 'Step');
    expect(spares).toHaveLength(2);
    expect(spares[0].positionCode).toBe('Step 1');
    expect(spares[1].positionCode).toBe('Step 2');
  });

  it('estepes ficam posicionados abaixo do corpo do veículo', () => {
    const layout = calculateBlueprintLayout(twoAxleSimples, 1, 'Truck');

    const spare = layout.nodes.find(n => n.side === 'Step')!;
    const bodyBottom = layout.bodyY + layout.bodyHeight;

    expect(spare.y).toBeGreaterThan(bodyBottom);
  });

  it('altura SVG é maior quando há estepes', () => {
    const noSpares = calculateBlueprintLayout(twoAxleSimples, 0, 'Truck');
    const withSpares = calculateBlueprintLayout(twoAxleSimples, 2, 'Truck');

    expect(withSpares.svgHeight).toBeGreaterThanOrEqual(noSpares.svgHeight);
  });
});

// ─── Escala com número de eixos ───────────────────────────────────────────────

describe('calculateBlueprintLayout — escala com eixos', () => {
  it('SVG é mais alto com mais eixos físicos', () => {
    const twoAxle = calculateBlueprintLayout(twoAxleSimples, 0, 'Truck');
    const fourAxle = calculateBlueprintLayout(duploTandemConfig, 0, 'Truck');

    // duploTandemConfig tem 3 eixos físicos (1 + 2), twoAxleSimples tem 2
    expect(fourAxle.svgHeight).toBeGreaterThan(twoAxle.svgHeight);
  });
});

// ─── Touch targets ────────────────────────────────────────────────────────────

describe('calculateBlueprintLayout — touch targets', () => {
  it('todos os nós têm largura ≥ 24px', () => {
    const layout = calculateBlueprintLayout(duploTandemConfig, 1, 'Truck');

    for (const node of layout.nodes) {
      expect(node.width).toBeGreaterThanOrEqual(24);
    }
  });

  it('todos os nós têm altura ≥ 44px', () => {
    const layout = calculateBlueprintLayout(duploTandemConfig, 1, 'Truck');

    for (const node of layout.nodes) {
      expect(node.height).toBeGreaterThanOrEqual(44);
    }
  });
});

// ─── Status dos nós ───────────────────────────────────────────────────────────

describe('calculateBlueprintLayout — status', () => {
  it('nós sem resposta têm status "empty"', () => {
    const layout = calculateBlueprintLayout(twoAxleSimples, 0, 'Truck', new Set());

    for (const node of layout.nodes) {
      expect(node.status).toBe('empty');
    }
  });

  it('nós com resposta têm status "done"', () => {
    const answered = new Set(['E1', 'D1']);
    const layout = calculateBlueprintLayout(twoAxleSimples, 0, 'Truck', answered);

    const e1 = layout.nodes.find(n => n.positionCode === 'E1')!;
    const d1 = layout.nodes.find(n => n.positionCode === 'D1')!;
    const e2 = layout.nodes.find(n => n.positionCode === 'E2')!;

    expect(e1.status).toBe('done');
    expect(d1.status).toBe('done');
    expect(e2.status).toBe('empty');
  });
});

// ─── Pneus do lado esquerdo ficam à esquerda do corpo ────────────────────────

describe('calculateBlueprintLayout — posicionamento relativo ao corpo', () => {
  it('nós do lado E têm x menor que bodyX', () => {
    const layout = calculateBlueprintLayout(twoAxleSimples, 0, 'Truck');

    const leftNodes = layout.nodes.filter(n => n.side === 'E');
    for (const node of leftNodes) {
      expect(node.x + node.width).toBeLessThanOrEqual(layout.bodyX);
    }
  });

  it('nós do lado D têm x maior que bodyX + bodyWidth', () => {
    const layout = calculateBlueprintLayout(twoAxleSimples, 0, 'Truck');

    const rightNodes = layout.nodes.filter(n => n.side === 'D');
    for (const node of rightNodes) {
      expect(node.x).toBeGreaterThanOrEqual(layout.bodyX + layout.bodyWidth);
    }
  });
});
