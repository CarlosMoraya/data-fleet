import React from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';

interface VehicleTypeBarChartProps {
  data: { name: string; value: number }[];
  activeFilter: string | null;
  onFilterChange: (type: string | null) => void;
  title: string;
  valueFormatter?: (v: number) => string;
  yAxisLabel?: string;
}

const ACTIVE_COLOR = '#2563eb';
const DIMMED_COLOR = '#bfdbfe';

export default function VehicleTypeBarChart({
  data,
  activeFilter,
  onFilterChange,
  title,
  valueFormatter,
  yAxisLabel,
}: VehicleTypeBarChartProps) {
  const handleClick = (entry: unknown) => {
    const name = (entry as { name?: string })?.name;
    if (!name) return;
    if (activeFilter === name) {
      onFilterChange(null);
    } else {
      onFilterChange(name);
    }
  };

  const formatTick = (v: number) =>
    valueFormatter ? valueFormatter(v) : String(v);

  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
      <h3 className="text-base font-semibold text-zinc-900 mb-1">{title}</h3>
      {activeFilter && (
        <p className="text-xs text-blue-600 mb-4">
          Filtro ativo: <span className="font-medium">{activeFilter}</span>{' '}
          <button
            onClick={() => onFilterChange(null)}
            className="underline ml-1 text-zinc-400 hover:text-zinc-600"
          >
            limpar
          </button>
        </p>
      )}
      {!activeFilter && <div className="mb-4" />}
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={data}
            margin={{ top: 0, right: 0, left: valueFormatter ? 20 : -20, bottom: 0 }}
          >
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e4e4e7" />
            <XAxis
              dataKey="name"
              axisLine={false}
              tickLine={false}
              tick={{ fill: '#71717a', fontSize: 11 }}
              dy={10}
            />
            <YAxis
              axisLine={false}
              tickLine={false}
              tick={{ fill: '#71717a', fontSize: 11 }}
              tickFormatter={yAxisLabel ? formatTick : undefined}
              width={yAxisLabel ? 80 : 40}
            />
            <Tooltip
              cursor={{ fill: '#f4f4f5' }}
              formatter={(value: number) =>
                valueFormatter ? [valueFormatter(value), ''] : [value, '']
              }
              contentStyle={{
                borderRadius: '12px',
                border: '1px solid #e4e4e7',
                boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
              }}
            />
            <Bar
              dataKey="value"
              radius={[4, 4, 0, 0]}
              barSize={36}
              cursor="pointer"
              onClick={handleClick}
            >
              {data.map((entry) => (
                <Cell
                  key={entry.name}
                  fill={
                    activeFilter === null || activeFilter === entry.name
                      ? ACTIVE_COLOR
                      : DIMMED_COLOR
                  }
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <p className="text-xs text-zinc-400 mt-2 text-center">
        Clique em uma barra para filtrar
      </p>
    </div>
  );
}
