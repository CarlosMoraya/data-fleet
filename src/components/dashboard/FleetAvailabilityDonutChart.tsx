import React from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';

import type { AvailabilityValue } from '../../lib/overviewFleetFilters';
import { AVAILABILITY_AVAILABLE, AVAILABILITY_UNAVAILABLE } from '../../lib/overviewFleetFilters';

interface FleetAvailabilityDonutChartProps {
  data: { name: AvailabilityValue; value: number }[];
  selectedValues: AvailabilityValue[];
  onSelect: (name: AvailabilityValue, additive: boolean) => void;
  onClearAll: () => void;
}

const AVAILABLE_COLOR = '#16a34a';
const UNAVAILABLE_COLOR = '#f59e0b';
const DIMMED_OPACITY = 0.25;

const COLORS: Record<AvailabilityValue, string> = {
  [AVAILABILITY_AVAILABLE]: AVAILABLE_COLOR,
  [AVAILABILITY_UNAVAILABLE]: UNAVAILABLE_COLOR,
};

const ICONS: Record<AvailabilityValue, string> = {
  [AVAILABILITY_AVAILABLE]: '🟢',
  [AVAILABILITY_UNAVAILABLE]: '🟠',
};

export default function FleetAvailabilityDonutChart({
  data,
  selectedValues,
  onSelect,
  onClearAll,
}: FleetAvailabilityDonutChartProps) {
  const total = data.reduce((sum, entry) => sum + entry.value, 0);

  const getFillOpacity = (name: AvailabilityValue): number => {
    if (selectedValues.length === 0) return 1;
    return selectedValues.includes(name) ? 1 : DIMMED_OPACITY;
  };

  const handleClick = (name: AvailabilityValue, event?: React.MouseEvent) => {
    const additive = Boolean(event?.ctrlKey || event?.metaKey);
    onSelect(name, additive);
  };

  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
      <h3 className="mb-1 text-base font-semibold text-zinc-900">Disponibilidade da Frota</h3>
      {selectedValues.length > 0 && (
        <div className="mb-4 flex flex-wrap items-center gap-1.5">
          {selectedValues.map((value) => (
            <span
              key={value}
              className="inline-flex items-center gap-1 rounded-full border border-zinc-200 bg-zinc-50 px-2 py-1 text-xs text-blue-600"
            >
              {value}
              <button
                type="button"
                onClick={() => onSelect(value, true)}
                className="ml-0.5 text-zinc-400 hover:text-zinc-600"
                aria-label={`Remover ${value}`}
              >
                ×
              </button>
            </span>
          ))}
          <button
            type="button"
            onClick={onClearAll}
            className="ml-1 text-xs text-zinc-400 underline hover:text-zinc-600"
          >
            limpar
          </button>
        </div>
      )}
      {selectedValues.length === 0 && <div className="mb-4" />}
      {total === 0 ? (
        <div className="flex h-64 items-center justify-center text-sm text-zinc-400">
          Nenhum veículo na frota.
        </div>
      ) : (
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                dataKey="value"
                nameKey="name"
                innerRadius={60}
                outerRadius={90}
                paddingAngle={2}
                cursor="pointer"
                onClick={(entry: unknown, _index: number, event: React.MouseEvent) =>
                  handleClick((entry as { name: AvailabilityValue }).name, event)
                }
              >
                {data.map((entry) => (
                  <Cell
                    key={entry.name}
                    fill={COLORS[entry.name]}
                    fillOpacity={getFillOpacity(entry.name)}
                  />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
        </div>
      )}
      <div className="mt-2 flex flex-col items-center gap-1">
        {data.map((entry) => {
          const percent = total === 0 ? 0 : Math.round((entry.value / total) * 100);
          return (
            <button
              key={entry.name}
              type="button"
              onClick={(event) => handleClick(entry.name, event)}
              className="text-sm text-zinc-700 hover:underline"
            >
              {ICONS[entry.name]} {entry.name} — {entry.value} ({percent}%)
            </button>
          );
        })}
      </div>
      <p className="mt-2 text-center text-xs text-zinc-400">
        Clique para filtrar · Ctrl/Cmd para selecionar vários
      </p>
    </div>
  );
}
