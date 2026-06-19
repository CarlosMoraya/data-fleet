import React from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

export interface MonthlySeries {
  key: string;
  label: string;
  color: string;
}

interface MonthlyMultiBarChartProps {
  data: Array<Record<string, string | number>>;
  series: MonthlySeries[];
  title: string;
  stacked?: boolean;
  valueFormatter?: (v: number) => string;
}

export default function MonthlyMultiBarChart({
  data,
  series,
  title,
  stacked = false,
  valueFormatter,
}: MonthlyMultiBarChartProps) {
  const isEmpty =
    data.length === 0 ||
    data.every((d) => series.every((s) => (d[s.key] as number) === 0));

  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
      <h3 className="text-base font-semibold text-zinc-900 mb-4">{title}</h3>
      {isEmpty ? (
        <p className="text-sm text-zinc-500">Sem dados no período.</p>
      ) : (
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={data}
              margin={{ top: 0, right: 20, left: valueFormatter ? 20 : -20, bottom: 0 }}
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
                tickFormatter={valueFormatter}
                width={valueFormatter ? 80 : 40}
              />
              <Tooltip
                formatter={(value: number, name: string) => [value, name]}
                contentStyle={{
                  borderRadius: '12px',
                  border: '1px solid #e4e4e7',
                  boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                }}
              />
              <Legend />
              {series.map((s) => (
                <Bar
                  key={s.key}
                  dataKey={s.key}
                  name={s.label}
                  fill={s.color}
                  stackId={stacked ? 'a' : undefined}
                  radius={[4, 4, 0, 0]}
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
