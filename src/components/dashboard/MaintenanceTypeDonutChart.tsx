import React from 'react';
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

interface MaintenanceTypeDonutChartProps {
  data: { name: string; value: number }[];
  activeFilter: string | null;
  onFilterChange: (type: string | null) => void;
  title: string;
  valueFormatter?: (v: number) => string;
}

const COLORS: Record<string, string> = {
  Corretiva: '#ef4444',
  Preventiva: '#3b82f6',
  Preditiva: '#8b5cf6',
};
const DEFAULT_COLOR = '#a1a1aa';

export default function MaintenanceTypeDonutChart({
  data,
  activeFilter,
  onFilterChange,
  title,
  valueFormatter,
}: MaintenanceTypeDonutChartProps) {
  const handleClick = (entry: unknown) => {
    const name = String((entry as { name?: string | number })?.name ?? '');
    if (!name) return;
    if (activeFilter === name) {
      onFilterChange(null);
    } else {
      onFilterChange(name);
    }
  };

  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
      <h3 className="text-base font-semibold text-zinc-900 mb-1">{title}</h3>
      {activeFilter && (
        <p className="text-xs text-blue-600 mb-2">
          Filtro ativo: <span className="font-medium">{activeFilter}</span>{' '}
          <button
            onClick={() => onFilterChange(null)}
            className="underline ml-1 text-zinc-400 hover:text-zinc-600"
          >
            limpar
          </button>
        </p>
      )}
      {!activeFilter && <div className="mb-2" />}
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
              cursor="pointer"
            >
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
      <p className="text-xs text-zinc-400 mt-1 text-center">
        Clique em uma fatia para filtrar
      </p>
    </div>
  );
}
