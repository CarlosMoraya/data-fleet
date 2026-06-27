import React from 'react';
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Label,
} from 'recharts';

import type { MaintenanceType } from '../../types/maintenance';
import type { Props as RechartsLabelProps } from 'recharts/types/component/Label';


interface MaintenanceTypeDonutChartProps {
  data: { name: MaintenanceType; value: number }[];
  activeFilter: MaintenanceType | null;
  onFilterChange: (type: MaintenanceType | null) => void;
  title: string;
  valueFormatter?: (v: number) => string;
}

const COLORS: Record<MaintenanceType, string> = {
  Corretiva: '#ef4444',
  Preventiva: '#3b82f6',
  Preditiva: '#8b5cf6',
};
const DEFAULT_COLOR = '#a1a1aa';

export interface DonutDisplayState {
  total: number;
  isEmpty: boolean;
  isFilterable: boolean;
}

export function deriveDonutState(
  data: { name: MaintenanceType; value: number }[]
): DonutDisplayState {
  return {
    total: data.reduce((sum, entry) => sum + entry.value, 0),
    isEmpty: data.length === 0,
    isFilterable: data.length > 1,
  };
}

export default function MaintenanceTypeDonutChart({
  data,
  activeFilter,
  onFilterChange,
  title,
  valueFormatter,
}: MaintenanceTypeDonutChartProps) {
  const { total, isEmpty, isFilterable } = deriveDonutState(data);

  const renderCenterTotal = ({ viewBox }: RechartsLabelProps): React.ReactElement | null => {
    if (!viewBox || !('cx' in viewBox) || !('cy' in viewBox)) {
      return null;
    }

    const cx = viewBox.cx;
    const cy = viewBox.cy;

    if (cx === undefined || cy === undefined) {
      return null;
    }

    return (
      <text x={cx} y={cy} textAnchor="middle">
        <tspan
          x={cx}
          dy="-0.2em"
          fontSize="20"
          fontWeight="600"
          fill="#18181b"
        >
          {valueFormatter ? valueFormatter(total) : String(total)}
        </tspan>
        <tspan x={cx} dy="1.4em" fontSize="11" fill="#a1a1aa">
          Total
        </tspan>
      </text>
    );
  };

  const handleClick = (entry: unknown) => {
    if (!isFilterable) return;
    const name = (entry as { name?: MaintenanceType })?.name;
    if (!name) return;
    if (activeFilter === name) {
      onFilterChange(null);
    } else {
      onFilterChange(name);
    }
  };

  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
      <h3 className="mb-1 text-base font-semibold text-zinc-900">{title}</h3>
      {activeFilter && (
        <p className="mb-2 text-xs text-blue-600">
          Filtro ativo: <span className="font-medium">{activeFilter}</span>{' '}
          <button
            onClick={() => onFilterChange(null)}
            className="ml-1 text-zinc-400 underline hover:text-zinc-600"
          >
            limpar
          </button>
        </p>
      )}
      {!activeFilter && <div className="mb-2" />}
      {isEmpty ? (
        <div className="flex h-64 items-center justify-center">
          <p className="text-sm text-zinc-400">Sem dados no período.</p>
        </div>
      ) : (
        <>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data}
                  cx="50%"
                  cy="45%"
                  innerRadius={55}
                  outerRadius={90}
                  paddingAngle={4}
                  dataKey="value"
                  onClick={handleClick}
                  cursor={isFilterable ? 'pointer' : 'default'}
                >
                  <Label position="center" content={renderCenterTotal} />
                  {data.map((entry) => {
                    const color = COLORS[entry.name] ?? DEFAULT_COLOR;
                    const isActive =
                      activeFilter === null || activeFilter === entry.name;
                    return (
                      <Cell
                        key={entry.name}
                        fill={color}
                        opacity={isActive ? 1 : 0.25}
                        stroke="none"
                      />
                    );
                  })}
                </Pie>
                <Tooltip
                  formatter={(value: number) =>
                    valueFormatter
                      ? [valueFormatter(value), '']
                      : [value, '']
                  }
                  contentStyle={{
                    borderRadius: '12px',
                    border: '1px solid #e4e4e7',
                    boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                  }}
                />
                <Legend
                  verticalAlign="bottom"
                  height={36}
                  iconType="circle"
                  iconSize={10}
                  formatter={(value) => (
                    <span style={{ fontSize: 12, color: '#52525b' }}>{value}</span>
                  )}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          {isFilterable && (
            <p className="mt-1 text-center text-xs text-zinc-400">
              Clique em uma fatia para filtrar
            </p>
          )}
        </>
      )}
    </div>
  );
}
