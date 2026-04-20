import React from 'react';
import type { AxleConfigEntry } from '../types/tire';
import { calculateBlueprintLayout, type TireNodeStatus } from '../lib/tireInspectionBlueprintLayout';

// ─── Props ────────────────────────────────────────────────────────────────────

interface VehicleBlueprintDiagramProps {
  axleConfig: AxleConfigEntry[];
  stepsCount: number;
  vehicleType?: string;
  answeredCodes: Set<string>;
  onTireClick: (positionCode: string) => void;
}

// ─── Status colors ────────────────────────────────────────────────────────────

const STATUS_FILL: Record<TireNodeStatus, string> = {
  empty: '#EF4444',
  partial: '#F59E0B',
  done: '#22C55E',
};

const STATUS_TEXT: Record<TireNodeStatus, string> = {
  empty: '#FFFFFF',
  partial: '#FFFFFF',
  done: '#FFFFFF',
};

// ─── Component ────────────────────────────────────────────────────────────────

export function VehicleBlueprintDiagram({
  axleConfig,
  stepsCount,
  vehicleType = '',
  answeredCodes,
  onTireClick,
}: VehicleBlueprintDiagramProps) {
  const layout = calculateBlueprintLayout(axleConfig, stepsCount, vehicleType, answeredCodes);
  const { svgWidth, svgHeight, bodyX, bodyY, bodyWidth, bodyHeight, nodes } = layout;

  return (
    <svg
      viewBox={`0 0 ${svgWidth} ${svgHeight}`}
      className="w-full max-w-sm mx-auto"
      aria-label="Diagrama de pneus do veículo"
    >
      {/* Vehicle body */}
      <rect
        x={bodyX}
        y={bodyY}
        width={bodyWidth}
        height={bodyHeight}
        rx={10}
        ry={10}
        fill="#E5E7EB"
        stroke="#9CA3AF"
        strokeWidth={2}
      />

      {/* Axle lines */}
      {renderAxleLines(nodes, bodyX, bodyWidth)}

      {/* Tire nodes */}
      {nodes.map(node => (
        <g
          key={node.positionCode}
          role="button"
          aria-label={`${node.positionLabel} — ${node.status}`}
          onClick={() => onTireClick(node.positionCode)}
          style={{ cursor: 'pointer' }}
        >
          <rect
            x={node.x}
            y={node.y}
            width={node.width}
            height={node.height}
            rx={4}
            ry={4}
            fill={STATUS_FILL[node.status]}
          />
          <text
            x={node.x + node.width / 2}
            y={node.y + node.height / 2 + 4}
            textAnchor="middle"
            fontSize={9}
            fontWeight="bold"
            fill={STATUS_TEXT[node.status]}
          >
            {node.positionCode}
          </text>
        </g>
      ))}
    </svg>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function renderAxleLines(
  nodes: ReturnType<typeof calculateBlueprintLayout>['nodes'],
  bodyX: number,
  bodyWidth: number,
) {
  // Collect unique Y centers of non-spare nodes
  const axleYs = new Set<number>();
  for (const node of nodes) {
    if (node.side !== 'Step') {
      axleYs.add(Math.round(node.y + node.height / 2));
    }
  }

  return [...axleYs].map(y => (
    <line
      key={`axle-${y}`}
      x1={bodyX}
      y1={y}
      x2={bodyX + bodyWidth}
      y2={y}
      stroke="#6B7280"
      strokeWidth={2}
    />
  ));
}
