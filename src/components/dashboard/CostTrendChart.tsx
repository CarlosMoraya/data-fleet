import React from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

interface CostTrendChartProps {
  data: { name: string; value: number }[];
  title: string;
  valueFormatter?: (v: number) => string;
}

export default function CostTrendChart({
  data,
  title,
  valueFormatter,
}: CostTrendChartProps) {
  const isEmpty = data.length === 0 || data.every((d) => d.value === 0);

  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
      <h3 className="text-base font-semibold text-zinc-900 mb-4">{title}</h3>
      {isEmpty ? (
        <p className="text-sm text-zinc-500">Sem dados de custo no período.</p>
      ) : (
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={data}
              margin={{
                top: 0,
                right: 20,
                left: valueFormatter ? 20 : -20,
                bottom: 0,
              }}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                vertical={false}
                stroke="#e4e4e7"
              />
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
                tickFormatter={valueFormatter}
                width={valueFormatter ? 80 : 40}
              />
              <Tooltip
                formatter={(value: number) =>
                  valueFormatter ? [valueFormatter(value), ''] : [value, '']
                }
                contentStyle={{
                  borderRadius: '12px',
                  border: '1px solid #e4e4e7',
                  boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                }}
              />
              <Line
                type="monotone"
                dataKey="value"
                stroke="#f97316"
                dot={false}
                strokeWidth={2}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
