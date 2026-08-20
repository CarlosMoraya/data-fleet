import { ChevronRight, Loader2 } from 'lucide-react';
import React from 'react';

import { cn } from '../../lib/utils';
import VehicleTypeBarChart from '../dashboard/VehicleTypeBarChart';

import type {
  AdherenceCardData,
  AdherenceGroupSlice,
  AdherenceTableRow,
} from '../../lib/checklistAdherence';
import type { ChecklistAdherenceContext } from '../../lib/dashboardKpi';

interface ChecklistAdherencePanelProps {
  cards: AdherenceCardData[];
  selectedContext: ChecklistAdherenceContext;
  onSelectContext: (context: ChecklistAdherenceContext) => void;
  shipperSlices: AdherenceGroupSlice[];
  unitSlices: AdherenceGroupSlice[];
  selectedShipper: string | null;
  onSelectShipper: (shipper: string | null) => void;
  selectedUnit: string | null;
  onSelectUnit: (unit: string | null) => void;
  rows: AdherenceTableRow[];
  onRowClick: (row: AdherenceTableRow) => void;
  isLoading: boolean;
}

const TABLE_HEADERS = [
  'Placa',
  'Veículo',
  'Contexto',
  'Último checklist',
  'Dias em atraso',
  'Motorista',
  'Embarcador',
  'Unidade Operacional',
];

function formatChecklistDate(iso: string): string {
  const date = new Date(iso);
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `${day}/${month}/${date.getFullYear()}`;
}

interface AdherenceCardProps {
  card: AdherenceCardData;
  isSelected: boolean;
  onSelect: (context: ChecklistAdherenceContext) => void;
}

function AdherenceCard({ card, isSelected, onSelect }: AdherenceCardProps) {
  return (
    <button
      type="button"
      disabled={!card.isConfigured}
      aria-pressed={isSelected}
      aria-disabled={!card.isConfigured}
      onClick={() => onSelect(card.context)}
      className={cn(
        'flex flex-col items-start rounded-2xl border bg-white p-4 text-left transition-colors',
        isSelected ? 'border-orange-500' : 'border-zinc-200',
        card.isConfigured ? 'cursor-pointer hover:border-orange-300' : 'cursor-default opacity-60',
      )}
    >
      <span className="text-sm font-medium text-zinc-800">{card.label}</span>
      {card.isConfigured ? (
        <>
          <span className="mt-2 text-3xl font-semibold text-orange-700">{card.adherenceRate}%</span>
          <span className="mt-1 text-xs text-zinc-500">
            {card.overdueCount} {card.overdueCount === 1 ? 'veículo vencido' : 'veículos vencidos'}
          </span>
          <span className="mt-0.5 text-xs text-zinc-500">Intervalo de {card.dayInterval} dias</span>
        </>
      ) : (
        <>
          <span className="mt-2 text-xl font-semibold text-zinc-500">Não configurado</span>
          <span className="mt-1 text-xs text-zinc-500">
            Parametrize o intervalo em Configurações → Intervalo entre Checklists.
          </span>
        </>
      )}
    </button>
  );
}

interface AdherenceTableProps {
  rows: AdherenceTableRow[];
  caption: string;
  onRowClick: (row: AdherenceTableRow) => void;
}

function AdherenceTable({ rows, caption, onRowClick }: AdherenceTableProps) {
  if (rows.length === 0) {
    return (
      <div className="rounded-2xl border border-zinc-200 bg-white py-16 text-center text-sm text-zinc-500">
        Nenhum veículo vencido para a seleção atual.
      </div>
    );
  }

  const handleKeyDown = (event: React.KeyboardEvent<HTMLTableRowElement>, row: AdherenceTableRow) => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    onRowClick(row);
  };

  return (
    <div className="overflow-x-auto rounded-2xl border border-zinc-200 bg-white">
      <table className="min-w-full divide-y divide-zinc-100">
        <caption className="sr-only">{caption}</caption>
        <thead className="bg-zinc-50">
          <tr>
            {TABLE_HEADERS.map((header) => (
              <th
                key={header}
                className="px-4 py-2 text-left text-xs font-semibold tracking-wider text-zinc-500 uppercase"
              >
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-50">
          {rows.map((row) => (
            <tr
              key={row.vehicleId}
              role="button"
              tabIndex={0}
              onClick={() => onRowClick(row)}
              onKeyDown={(event) => handleKeyDown(event, row)}
              className="cursor-pointer hover:bg-zinc-50 focus:bg-zinc-50 focus:outline-none"
            >
              <td className="px-4 py-2 text-sm font-medium text-zinc-800">{row.licensePlate}</td>
              <td className="px-4 py-2 text-sm text-zinc-800">{row.vehicleLabel}</td>
              <td className="px-4 py-2 text-sm text-zinc-500">{row.contextLabel}</td>
              <td className="px-4 py-2 text-sm text-zinc-500">
                {row.lastCompletedAt ? formatChecklistDate(row.lastCompletedAt) : 'Nunca realizado'}
              </td>
              <td className="px-4 py-2 text-sm text-zinc-800">{row.daysOverdue ?? '—'}</td>
              <td className="px-4 py-2 text-sm text-zinc-500">{row.driverName}</td>
              <td className="px-4 py-2 text-sm text-zinc-500">{row.shipperName}</td>
              <td className="px-4 py-2 text-sm text-zinc-500">{row.operationalUnitName}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function buildAdherenceSubLabels(slices: AdherenceGroupSlice[]): Record<string, string> {
  return Object.fromEntries(slices.map((slice) => [slice.name, `${slice.adherenceRate}%`]));
}

export default function ChecklistAdherencePanel({
  cards,
  selectedContext,
  onSelectContext,
  shipperSlices,
  unitSlices,
  selectedShipper,
  onSelectShipper,
  selectedUnit,
  onSelectUnit,
  rows,
  onRowClick,
  isLoading,
}: ChecklistAdherencePanelProps) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-zinc-400" />
      </div>
    );
  }

  const selectedCard = cards.find((card) => card.context === selectedContext);
  const contextLabel = selectedCard?.label ?? '';
  const tableCaption = [
    `Veículos com checklist de ${contextLabel} vencido`,
    selectedShipper ? `embarcador ${selectedShipper}` : null,
    selectedUnit ? `unidade ${selectedUnit}` : null,
  ]
    .filter((part) => part !== null)
    .join(' — ');

  return (
    <div className="flex flex-col gap-4 p-4">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        {cards.map((card) => (
          <AdherenceCard
            key={card.context}
            card={card}
            isSelected={card.context === selectedContext}
            onSelect={onSelectContext}
          />
        ))}
      </div>

      <div className="flex flex-col gap-2">
        <nav aria-label="Nível do drill-down" className="flex flex-wrap items-center gap-1 text-xs text-zinc-500">
          <button
            type="button"
            onClick={() => onSelectShipper(null)}
            className="rounded px-1 py-0.5 text-zinc-800 hover:text-orange-700"
          >
            Todos os embarcadores
          </button>
          {selectedShipper !== null && (
            <>
              <ChevronRight className="h-3 w-3 text-zinc-400" />
              <button
                type="button"
                onClick={() => onSelectUnit(null)}
                className="rounded px-1 py-0.5 text-zinc-800 hover:text-orange-700"
              >
                {selectedShipper}
              </button>
            </>
          )}
          {selectedUnit !== null && (
            <>
              <ChevronRight className="h-3 w-3 text-zinc-400" />
              <span className="px-1 py-0.5 text-orange-700">{selectedUnit}</span>
            </>
          )}
        </nav>

        {shipperSlices.length === 0 ? (
          <div className="rounded-2xl border border-zinc-200 bg-white py-16 text-center text-sm text-zinc-500">
            Nenhum veículo vencido neste contexto.
          </div>
        ) : selectedShipper === null ? (
          <VehicleTypeBarChart
            data={shipperSlices}
            title="Veículos vencidos por Embarcador"
            onSelect={(name) => onSelectShipper(name)}
            selectedValues={[]}
            subLabelByName={buildAdherenceSubLabels(shipperSlices)}
          />
        ) : (
          <VehicleTypeBarChart
            data={unitSlices}
            title={`Veículos vencidos por Unidade — ${selectedShipper}`}
            onSelect={(name) => onSelectUnit(name)}
            selectedValues={selectedUnit ? [selectedUnit] : []}
            subLabelByName={buildAdherenceSubLabels(unitSlices)}
          />
        )}
      </div>

      <AdherenceTable rows={rows} caption={tableCaption} onRowClick={onRowClick} />
    </div>
  );
}
