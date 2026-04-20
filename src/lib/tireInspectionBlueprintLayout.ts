import type { AxleConfigEntry } from '../types/tire';
import { generatePositionsFromConfig } from './tirePositions';
import { getPhysicalAxles, tiresPerPhysicalAxle } from './axleConfigUtils';

// ─── Tipos ────────────────────────────────────────────────────────────────────

export type TireNodeStatus = 'empty' | 'partial' | 'done';

export interface TireBlueprintNode {
  positionCode: string;
  positionLabel: string;
  x: number;
  y: number;
  width: number;
  height: number;
  side: 'E' | 'D' | 'Step';
  status: TireNodeStatus;
}

export interface BlueprintLayout {
  svgWidth: number;
  svgHeight: number;
  bodyX: number;
  bodyY: number;
  bodyWidth: number;
  bodyHeight: number;
  nodes: TireBlueprintNode[];
}

// ─── Constantes de layout ─────────────────────────────────────────────────────

const TIRE_W = 32;
const TIRE_H = 52;
const TIRE_GAP = 4;        // gap entre pneus duplos/triplos empilhados
const AXLE_ROW_H = 70;     // espaço vertical por eixo físico
const BODY_W = 80;
const SIDE_PAD = 20;       // distância entre o corpo e o pneu mais externo
const MARGIN_TOP = 40;
const MARGIN_BOTTOM = 60;  // espaço para estepes
const SVG_SIDE_PAD = 24;

// ─── calculateBlueprintLayout ─────────────────────────────────────────────────

/**
 * Função pura: recebe axleConfig + stepsCount → retorna coordenadas SVG.
 * vehicleType aceita qualquer string; "Moto" recebe layout especial.
 */
export function calculateBlueprintLayout(
  entries: AxleConfigEntry[],
  stepsCount: number,
  vehicleType: string,
  answeredCodes: Set<string> = new Set(),
): BlueprintLayout {
  const positions = generatePositionsFromConfig(entries, stepsCount, vehicleType);

  // Calcular total de eixos físicos para determinar altura do SVG
  const totalPhysical = entries.reduce((sum, e) => sum + getPhysicalAxles(e.type), 0);
  const bodyHeight = totalPhysical * AXLE_ROW_H;
  const svgHeight = MARGIN_TOP + bodyHeight + MARGIN_BOTTOM;

  const tiresPerSide = maxTiresPerSide(entries);
  const tireStackW = tiresPerSide * TIRE_W + (tiresPerSide - 1) * TIRE_GAP;
  const svgWidth = SVG_SIDE_PAD * 2 + tireStackW * 2 + SIDE_PAD * 2 + BODY_W;

  const bodyX = SVG_SIDE_PAD + tireStackW + SIDE_PAD;
  const bodyY = MARGIN_TOP;

  const nodes = buildNodes(positions, answeredCodes, {
    bodyX, bodyY, tireStackW, svgWidth,
  });

  return { svgWidth, svgHeight, bodyX, bodyY, bodyWidth: BODY_W, bodyHeight, nodes };
}

function maxTiresPerSide(entries: AxleConfigEntry[]): number {
  let max = 1;
  for (const entry of entries) {
    const tires = tiresPerPhysicalAxle(entry.rodagem) / 2; // per side
    if (tires > max) max = tires;
  }
  return max;
}

interface LayoutContext {
  bodyX: number;
  bodyY: number;
  tireStackW: number;
  svgWidth: number;
}

function buildNodes(
  positions: ReturnType<typeof generatePositionsFromConfig>,
  answeredCodes: Set<string>,
  ctx: LayoutContext,
): TireBlueprintNode[] {
  const nodes: TireBlueprintNode[] = [];
  const { bodyX, bodyY, tireStackW, svgWidth } = ctx;

  // Group positions by axle number for Y positioning
  const axleGroups = new Map<number, typeof positions>();
  for (const pos of positions) {
    if (pos.side === 'Step') continue;
    if (!axleGroups.has(pos.axle)) axleGroups.set(pos.axle, []);
    axleGroups.get(pos.axle)!.push(pos);
  }

  const sortedAxles = [...axleGroups.keys()].sort((a, b) => a - b);

  for (let ai = 0; ai < sortedAxles.length; ai++) {
    const axleNum = sortedAxles[ai];
    const axlePositions = axleGroups.get(axleNum)!;
    const axleCenterY = bodyY + ai * AXLE_ROW_H + AXLE_ROW_H / 2;

    const leftPositions = axlePositions.filter(p => p.side === 'E');
    const rightPositions = axlePositions.filter(p => p.side === 'D');

    pushSideNodes(nodes, leftPositions, 'E', axleCenterY, bodyX, tireStackW, answeredCodes);
    pushSideNodes(nodes, rightPositions, 'D', axleCenterY, bodyX, tireStackW, answeredCodes, svgWidth);
  }

  // Estepes
  const spares = positions.filter(p => p.side === 'Step');
  const totalBodyH = sortedAxles.length * AXLE_ROW_H;
  const spareY = bodyY + totalBodyH + 16;
  const spareStartX = svgWidth / 2 - (spares.length * (TIRE_W + TIRE_GAP)) / 2;

  for (let si = 0; si < spares.length; si++) {
    const spare = spares[si];
    nodes.push({
      positionCode: spare.code,
      positionLabel: spare.label,
      x: spareStartX + si * (TIRE_W + TIRE_GAP),
      y: spareY,
      width: TIRE_W,
      height: TIRE_H,
      side: 'Step',
      status: resolveStatus(spare.code, answeredCodes),
    });
  }

  return nodes;
}

function pushSideNodes(
  nodes: TireBlueprintNode[],
  sidePositions: ReturnType<typeof generatePositionsFromConfig>,
  side: 'E' | 'D',
  centerY: number,
  bodyX: number,
  tireStackW: number,
  answeredCodes: Set<string>,
  svgWidth?: number,
): void {
  const count = sidePositions.length;
  const totalStackH = count * TIRE_H + (count - 1) * TIRE_GAP;
  const startY = centerY - totalStackH / 2;

  for (let ti = 0; ti < count; ti++) {
    const pos = sidePositions[ti];
    let x: number;

    if (side === 'E') {
      // Left side: stacked from bodyX leftward
      // External (index 0) is furthest from body
      x = bodyX - SIDE_PAD - TIRE_W - (count - 1 - ti) * (TIRE_W + TIRE_GAP);
    } else {
      // Right side: internal closest to body
      const rightBase = (svgWidth ?? 0) - SVG_SIDE_PAD - tireStackW;
      x = rightBase + ti * (TIRE_W + TIRE_GAP);
    }

    nodes.push({
      positionCode: pos.code,
      positionLabel: pos.label,
      x,
      y: startY + ti * (TIRE_H + TIRE_GAP),
      width: TIRE_W,
      height: TIRE_H,
      side,
      status: resolveStatus(pos.code, answeredCodes),
    });
  }
}

function resolveStatus(code: string, answered: Set<string>): TireNodeStatus {
  return answered.has(code) ? 'done' : 'empty';
}
