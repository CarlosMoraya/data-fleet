import React, { useRef, useEffect } from 'react';
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
  activeFilter?: string | null;
  onFilterChange?: (type: string | null) => void;
  title: string;
  valueFormatter?: (v: number) => string;
  yAxisLabel?: string;
  selectedValues?: string[];
  onSelect?: (name: string, additive: boolean) => void;
  onClearAll?: () => void;
  multiSelectHint?: boolean;
}

const ACTIVE_COLOR = '#2563eb';
const DIMMED_COLOR = '#bfdbfe';
const LONG_PRESS_MS = 600;

export default function VehicleTypeBarChart({
  data,
  activeFilter,
  onFilterChange,
  title,
  valueFormatter,
  yAxisLabel,
  selectedValues,
  onSelect,
  onClearAll,
  multiSelectHint,
}: VehicleTypeBarChartProps) {
  const isMultiMode = typeof onSelect === 'function';

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressFiredRef = useRef(false);
  const suppressClickRef = useRef(false);
  const pressNameRef = useRef<string | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const startPress = (name: string | undefined, _event: unknown) => {
    if (!name || !onSelect) return;
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }
    pressNameRef.current = name;
    longPressFiredRef.current = false;
    timerRef.current = setTimeout(() => {
      longPressFiredRef.current = true;
      suppressClickRef.current = true;
      onSelect(name, true);
    }, LONG_PRESS_MS);
  };

  const endPress = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  const cancelPress = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  const handleClickSingle = (entry: unknown) => {
    if (!onFilterChange) return;
    const name = (entry as { name?: string })?.name;
    if (!name) return;
    if (activeFilter === name) {
      onFilterChange(null);
    } else {
      onFilterChange(name);
    }
  };

  const handleClickMulti = (entry: unknown, _index: number, event: React.MouseEvent | undefined) => {
    if (!onSelect) return;
    if (suppressClickRef.current) {
      suppressClickRef.current = false;
      return;
    }
    const name = (entry as { name?: string })?.name;
    if (!name) return;
    const additive = Boolean(event?.ctrlKey || event?.metaKey);
    onSelect(name, additive);
  };

  const formatTick = (v: number) =>
    valueFormatter ? valueFormatter(v) : String(v);

  const getBarFill = (entryName: string): string => {
    if (isMultiMode) {
      if (!selectedValues || selectedValues.length === 0) return ACTIVE_COLOR;
      return selectedValues.includes(entryName) ? ACTIVE_COLOR : DIMMED_COLOR;
    }
    return activeFilter === null || activeFilter === undefined || activeFilter === entryName
      ? ACTIVE_COLOR
      : DIMMED_COLOR;
  };

  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
      <h3 className="mb-1 text-base font-semibold text-zinc-900">{title}</h3>
      {isMultiMode && selectedValues && selectedValues.length > 0 && (
        <div className="mb-4 flex flex-wrap items-center gap-1.5">
          {selectedValues.map((value) => (
            <span
              key={value}
              className="inline-flex items-center gap-1 rounded-full border border-zinc-200 bg-zinc-50 px-2 py-1 text-xs text-blue-600"
            >
              {value}
              <button
                type="button"
                onClick={() => onSelect!(value, true)}
                className="ml-0.5 text-zinc-400 hover:text-zinc-600"
                aria-label={`Remover ${value}`}
              >
                ×
              </button>
            </span>
          ))}
          {onClearAll && (
            <button
              type="button"
              onClick={onClearAll}
              className="ml-1 text-xs text-zinc-400 underline hover:text-zinc-600"
            >
              limpar
            </button>
          )}
        </div>
      )}
      {!isMultiMode && activeFilter && (
        <p className="mb-4 text-xs text-blue-600">
          Filtro ativo: <span className="font-medium">{activeFilter}</span>{' '}
          <button
            type="button"
            onClick={() => onFilterChange?.(null)}
            className="ml-1 text-zinc-400 underline hover:text-zinc-600"
          >
            limpar
          </button>
        </p>
      )}
      {((isMultiMode && (!selectedValues || selectedValues.length === 0)) || (!isMultiMode && !activeFilter)) && <div className="mb-4" />}
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
              onClick={isMultiMode ? handleClickMulti : handleClickSingle}
              onMouseDown={isMultiMode ? (entry: unknown, _index: number, event: unknown) => startPress((entry as { name?: string })?.name, event) : undefined}
              onMouseUp={isMultiMode ? endPress : undefined}
              onMouseLeave={isMultiMode ? cancelPress : undefined}
            >
              {data.map((entry) => (
                <Cell
                  key={entry.name}
                  fill={getBarFill(entry.name)}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <p className="mt-2 text-center text-xs text-zinc-400">
        {multiSelectHint
          ? 'Clique para filtrar · Ctrl/Cmd ou pressione e segure para selecionar vários'
          : 'Clique em uma barra para filtrar'}
      </p>
    </div>
  );
}
