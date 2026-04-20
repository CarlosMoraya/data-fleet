import { Tire, TirePositionType, AxleConfigEntry } from '../types';
import { getPhysicalAxles } from './axleConfigUtils';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface TirePosition {
  code: string;   // ex: "E1", "D2IN", "Step 1"
  label: string;  // ex: "Eixo 1 Esquerdo", "Eixo 2 Direito Interno"
  type: TirePositionType;
  axle: number;
  side: 'E' | 'D' | 'Step';
}

// ─── generatePositions ────────────────────────────────────────────────────────
/**
 * Gera array de posições para um veículo com base nos parâmetros de configuração.
 * - Eixos simples: E{n}, D{n}
 * - Eixos duplos:  E{n}IN, E{n}EX, D{n}IN, D{n}EX
 * - Estepes:       Step 1, Step 2, ...
 * - Moto:          E1 (dianteiro), D1 (traseiro)
 */
export function generatePositions(
  axleCount: number,
  dualAxles: number[],
  spareCount: number,
  vehicleType: string,
): TirePosition[] {
  const positions: TirePosition[] = [];

  if (vehicleType === 'Moto') {
    positions.push({ code: 'E1', label: 'Dianteiro', type: 'single', axle: 1, side: 'E' });
    positions.push({ code: 'D1', label: 'Traseiro', type: 'single', axle: 1, side: 'D' });
    return positions;
  }

  for (let axle = 1; axle <= axleCount; axle++) {
    if (dualAxles.includes(axle)) {
      positions.push({
        code: `E${axle}IN`,
        label: `Eixo ${axle} Esquerdo Interno`,
        type: 'dual_internal',
        axle,
        side: 'E',
      });
      positions.push({
        code: `E${axle}EX`,
        label: `Eixo ${axle} Esquerdo Externo`,
        type: 'dual_external',
        axle,
        side: 'E',
      });
      positions.push({
        code: `D${axle}IN`,
        label: `Eixo ${axle} Direito Interno`,
        type: 'dual_internal',
        axle,
        side: 'D',
      });
      positions.push({
        code: `D${axle}EX`,
        label: `Eixo ${axle} Direito Externo`,
        type: 'dual_external',
        axle,
        side: 'D',
      });
    } else {
      positions.push({
        code: `E${axle}`,
        label: `Eixo ${axle} Esquerdo`,
        type: 'single',
        axle,
        side: 'E',
      });
      positions.push({
        code: `D${axle}`,
        label: `Eixo ${axle} Direito`,
        type: 'single',
        axle,
        side: 'D',
      });
    }
  }

  for (let spare = 1; spare <= spareCount; spare++) {
    positions.push({
      code: `Step ${spare}`,
      label: `Estepe ${spare}`,
      type: 'spare',
      axle: 0,
      side: 'Step',
    });
  }

  return positions;
}

// ─── generatePositionsFromConfig ─────────────────────────────────────────────
/**
 * Gera posições de pneus a partir da configuração detalhada de eixos (AxleConfigEntry[]).
 * Suporta rodagem simples, dupla e tripla.
 * - Simples:  E{n}, D{n}
 * - Dupla:    E{n}IN, E{n}EX, D{n}IN, D{n}EX
 * - Tripla:   E{n}IN, E{n}M, E{n}EX, D{n}IN, D{n}M, D{n}EX
 * - Estepes:  Step 1, Step 2, ...
 */
export function generatePositionsFromConfig(
  entries: AxleConfigEntry[],
  stepsCount: number,
  vehicleType: string,
): TirePosition[] {
  const positions: TirePosition[] = [];

  if (vehicleType === 'Moto') {
    positions.push({ code: 'E1', label: 'Dianteiro', type: 'single', axle: 1, side: 'E' });
    positions.push({ code: 'D1', label: 'Traseiro', type: 'single', axle: 1, side: 'D' });
    return positions;
  }

  let physicalAxleIndex = 1;

  for (const entry of entries) {
    const count = getPhysicalAxles(entry.type);
    for (let i = 0; i < count; i++) {
      const n = physicalAxleIndex;
      if (entry.rodagem === 'simples') {
        positions.push({ code: `E${n}`, label: `Eixo ${n} Esquerdo`, type: 'single', axle: n, side: 'E' });
        positions.push({ code: `D${n}`, label: `Eixo ${n} Direito`, type: 'single', axle: n, side: 'D' });
      } else if (entry.rodagem === 'dupla') {
        positions.push({ code: `E${n}IN`, label: `Eixo ${n} Esquerdo Interno`, type: 'dual_internal', axle: n, side: 'E' });
        positions.push({ code: `E${n}EX`, label: `Eixo ${n} Esquerdo Externo`, type: 'dual_external', axle: n, side: 'E' });
        positions.push({ code: `D${n}IN`, label: `Eixo ${n} Direito Interno`, type: 'dual_internal', axle: n, side: 'D' });
        positions.push({ code: `D${n}EX`, label: `Eixo ${n} Direito Externo`, type: 'dual_external', axle: n, side: 'D' });
      } else {
        // tripla
        positions.push({ code: `E${n}IN`, label: `Eixo ${n} Esquerdo Interno`, type: 'triple_internal', axle: n, side: 'E' });
        positions.push({ code: `E${n}M`, label: `Eixo ${n} Esquerdo Médio`, type: 'triple_middle', axle: n, side: 'E' });
        positions.push({ code: `E${n}EX`, label: `Eixo ${n} Esquerdo Externo`, type: 'triple_external', axle: n, side: 'E' });
        positions.push({ code: `D${n}IN`, label: `Eixo ${n} Direito Interno`, type: 'triple_internal', axle: n, side: 'D' });
        positions.push({ code: `D${n}M`, label: `Eixo ${n} Direito Médio`, type: 'triple_middle', axle: n, side: 'D' });
        positions.push({ code: `D${n}EX`, label: `Eixo ${n} Direito Externo`, type: 'triple_external', axle: n, side: 'D' });
      }
      physicalAxleIndex++;
    }
  }

  for (let spare = 1; spare <= stepsCount; spare++) {
    positions.push({ code: `Step ${spare}`, label: `Estepe ${spare}`, type: 'spare', axle: 0, side: 'Step' });
  }

  return positions;
}

// ─── validatePositionAssignment ───────────────────────────────────────────────
/**
 * Verifica se a posição está disponível para o veículo.
 * Retorna null se disponível, ou mensagem de erro se ocupada.
 */
export function validatePositionAssignment(
  position: string,
  existingActiveTires: Tire[],
  excludeTireId?: string,
): string | null {
  const occupant = existingActiveTires.find(
    (t) => t.active && t.currentPosition === position && t.id !== excludeTireId,
  );
  if (occupant) {
    return `Posição já ocupada por ${occupant.tireCode}`;
  }
  return null;
}
