import React, { useEffect, useMemo, useState } from 'react';
import { Filter, RotateCcw, Search } from 'lucide-react';
import type { CostDashboardFilters } from '../../lib/dashboardKpi';

interface CostFiltersProps {
  value: CostDashboardFilters;
  options: {
    categories: string[];
    models: string[];
    shippers: string[];
    operationalUnits: string[];
  };
  onChange: (next: CostDashboardFilters) => void;
  onReset: () => void;
}

function CompactSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string | null;
  options: string[];
  onChange: (next: string | null) => void;
}) {
  return (
    <label className="flex min-w-0 flex-col gap-1">
      <span className="text-xs font-medium text-zinc-500">{label}</span>
      <select
        value={value ?? ''}
        onChange={(event) => onChange(event.target.value || null)}
        className="h-10 rounded-xl border border-zinc-200 bg-white px-3 text-sm text-zinc-900 shadow-sm outline-none transition focus:border-orange-400 focus:ring-2 focus:ring-orange-200"
      >
        <option value="">Todos</option>
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </label>
  );
}

export default function CostFilters({ value, options, onChange, onReset }: CostFiltersProps) {
  const [modelQuery, setModelQuery] = useState(value.model ?? '');
  const [isModelOpen, setIsModelOpen] = useState(false);

  useEffect(() => {
    setModelQuery(value.model ?? '');
  }, [value.model]);

  const filteredModels = useMemo(() => {
    const query = modelQuery.trim().toLocaleLowerCase('pt-BR');
    if (!query) return options.models.slice(0, 12);
    return options.models
      .filter((model) => model.toLocaleLowerCase('pt-BR').includes(query))
      .slice(0, 12);
  }, [modelQuery, options.models]);

  const handleModelSelect = (model: string | null) => {
    setModelQuery(model ?? '');
    setIsModelOpen(false);
    onChange({ ...value, model });
  };

  const hasActiveFilters = Boolean(
    value.category || value.model || value.shipper || value.operationalUnit || value.maintenanceType
  );

  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-50 text-orange-500">
            <Filter className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-zinc-900">Filtros de custos</h3>
            <p className="text-sm text-zinc-500">Categoria, modelo, embarcador e unidade operacional</p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => {
            setModelQuery('');
            setIsModelOpen(false);
            onReset();
          }}
          className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-zinc-200 bg-zinc-50 px-3 text-sm font-medium text-zinc-700 transition hover:bg-zinc-100"
        >
          <RotateCcw className="h-4 w-4" />
          Limpar filtros
        </button>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <CompactSelect
          label="Categoria"
          value={value.category}
          options={options.categories}
          onChange={(category) => onChange({ ...value, category })}
        />

        <div className="relative flex min-w-0 flex-col gap-1">
          <span className="text-xs font-medium text-zinc-500">Modelo</span>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
            <input
              type="text"
              role="combobox"
              aria-expanded={isModelOpen}
              aria-label="Modelo"
              value={modelQuery}
              onFocus={() => setIsModelOpen(true)}
              onChange={(event) => {
                setModelQuery(event.target.value);
                setIsModelOpen(true);
                if (event.target.value.trim().length === 0 && value.model !== null) {
                  onChange({ ...value, model: null });
                }
              }}
              placeholder="Buscar modelo"
              className="h-10 w-full rounded-xl border border-zinc-200 bg-white py-2 pl-9 pr-3 text-sm text-zinc-900 shadow-sm outline-none transition focus:border-orange-400 focus:ring-2 focus:ring-orange-200"
            />
          </div>
          {isModelOpen && filteredModels.length > 0 && (
            <div className="absolute left-0 right-0 top-full z-10 mt-1 overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-lg">
              <div className="max-h-56 overflow-y-auto py-1">
                {filteredModels.map((model) => (
                  <button
                    key={model}
                    type="button"
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => handleModelSelect(model)}
                    className="flex w-full items-center justify-between px-3 py-2 text-left text-sm text-zinc-700 transition hover:bg-orange-50 hover:text-zinc-900"
                  >
                    <span>{model}</span>
                    {value.model === model && <span className="text-xs font-medium text-orange-500">ativo</span>}
                  </button>
                ))}
              </div>
            </div>
          )}
          {isModelOpen && filteredModels.length === 0 && (
            <div className="absolute left-0 right-0 top-full z-10 mt-1 rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-500 shadow-lg">
              Nenhum modelo encontrado.
            </div>
          )}
        </div>

        <CompactSelect
          label="Embarcador"
          value={value.shipper}
          options={options.shippers}
          onChange={(shipper) => onChange({ ...value, shipper })}
        />

        <CompactSelect
          label="Unidade Operacional"
          value={value.operationalUnit}
          options={options.operationalUnits}
          onChange={(operationalUnit) => onChange({ ...value, operationalUnit })}
        />
      </div>

      {hasActiveFilters && (
        <p className="mt-4 text-xs text-zinc-500">Os cards e graficos abaixo usam o mesmo conjunto filtrado.</p>
      )}
    </div>
  );
}
