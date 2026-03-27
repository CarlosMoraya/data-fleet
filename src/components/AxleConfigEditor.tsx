import React from 'react';
import { AxleConfigEntry, AxleType, RodagemType } from '../types';
import {
  getPhysicalAxles,
  getAvailableAxleTypes,
  getAvailableRodagem,
  calculateTotalTires,
  totalPhysicalAxles,
  AXLE_TYPE_LABELS,
  RODAGEM_LABELS,
} from '../lib/axleConfigUtils';

interface AxleConfigEditorProps {
  targetAxles: number;
  entries: AxleConfigEntry[];
  stepsCount: number;
  onChange: (entries: AxleConfigEntry[], stepsCount: number) => void;
  disabled?: boolean;
}

export default function AxleConfigEditor({
  targetAxles,
  entries,
  stepsCount,
  onChange,
  disabled,
}: AxleConfigEditorProps) {
  const inputClass =
    'block w-full rounded-xl border border-zinc-300 py-2 px-3 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 sm:text-sm disabled:bg-zinc-50 disabled:text-zinc-400';

  const usedSlots = totalPhysicalAxles(entries);
  const remainingSlots = targetAxles - usedSlots;
  const totalTires = calculateTotalTires(entries, stepsCount);
  const isComplete = usedSlots === targetAxles;

  // Build an array of "rows" — each entry + which physical axles it occupies
  const rows = entries.map((entry, idx) => {
    const slotsBefore = entries.slice(0, idx).reduce((s, e) => s + e.physicalAxles, 0);
    const isFirst = idx === 0;
    const slotsAfterThis = targetAxles - slotsBefore - entry.physicalAxles;
    return { entry, idx, slotsBefore, isFirst, slotsAfterThis };
  });

  // Should a new row be added?
  const canAddRow = !isComplete && usedSlots < targetAxles;

  function updateEntry(idx: number, patch: Partial<AxleConfigEntry>) {
    const next = entries.map((e, i) => {
      if (i !== idx) return e;
      const updated = { ...e, ...patch };
      // If type changed, update physicalAxles and reset subsequent entries
      if (patch.type !== undefined) {
        updated.physicalAxles = getPhysicalAxles(patch.type);
        // If changing type resets rodagem when tripla not available (first axle)
        if (idx === 0 && updated.rodagem === 'tripla') {
          updated.rodagem = 'simples';
        }
      }
      return updated;
    });

    // Truncate entries that no longer fit after a type change
    const newUsed = next.reduce((s, e, i) => (i <= idx ? s + e.physicalAxles : s), 0);
    const trimmed = newUsed > targetAxles ? next.slice(0, idx + 1) : next;

    onChange(trimmed, stepsCount);
  }

  function addNextEntry() {
    const usedNow = totalPhysicalAxles(entries);
    const remaining = targetAxles - usedNow;
    if (remaining <= 0) return;

    const nextOrder = entries.length + 1;
    const defaultType: AxleType = remaining >= 1 ? 'simples' : 'direcional';
    const newEntry: AxleConfigEntry = {
      order: nextOrder,
      type: defaultType,
      rodagem: 'simples',
      physicalAxles: getPhysicalAxles(defaultType),
    };
    onChange([...entries, newEntry], stepsCount);
  }

  function removeEntry(idx: number) {
    const next = entries.slice(0, idx);
    onChange(next, stepsCount);
  }

  function getAxleLabel(entry: AxleConfigEntry, slotsBefore: number): string {
    const start = slotsBefore + 1;
    const end = slotsBefore + entry.physicalAxles;
    if (entry.physicalAxles === 1) return `Eixo ${start}`;
    return `Eixo ${start}–${end}`;
  }

  if (targetAxles < 1) return null;

  return (
    <div className="mt-4 rounded-xl border border-blue-200 bg-blue-50 p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold text-blue-900">Configuração de Eixos</h4>
        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${isComplete ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
          {usedSlots}/{targetAxles} eixos configurados
        </span>
      </div>

      <div className="space-y-3">
        {rows.map(({ entry, idx, slotsBefore, isFirst }) => {
          const slotsRemaining = targetAxles - slotsBefore - entry.physicalAxles + entry.physicalAxles;
          const availableTypes = getAvailableAxleTypes(
            targetAxles - slotsBefore, // remaining before this entry
            isFirst,
          );
          const availableRodagem = getAvailableRodagem(isFirst);

          return (
            <div key={idx} className="flex flex-wrap items-end gap-3 rounded-xl border border-blue-100 bg-white p-3">
              <div className="flex-shrink-0 w-24">
                <label className="block text-xs font-medium text-zinc-500 mb-1">
                  {getAxleLabel(entry, slotsBefore)}
                </label>
                <div className="text-xs text-zinc-400 mt-0.5">
                  {entry.physicalAxles > 1 ? `${entry.physicalAxles} físicos` : '1 físico'}
                </div>
              </div>

              <div className="flex-1 min-w-[160px]">
                <label className="block text-xs font-medium text-zinc-700 mb-1">Tipo de Eixo</label>
                <select
                  value={entry.type}
                  disabled={disabled || isFirst}
                  onChange={(e) => updateEntry(idx, { type: e.target.value as AxleType })}
                  className={inputClass}
                >
                  {availableTypes.map((t) => (
                    <option key={t} value={t}>{AXLE_TYPE_LABELS[t]}</option>
                  ))}
                </select>
              </div>

              <div className="flex-1 min-w-[180px]">
                <label className="block text-xs font-medium text-zinc-700 mb-1">Rodagem</label>
                <select
                  value={entry.rodagem}
                  disabled={disabled}
                  onChange={(e) => updateEntry(idx, { rodagem: e.target.value as RodagemType })}
                  className={inputClass}
                >
                  {availableRodagem.map((r) => (
                    <option key={r} value={r}>{RODAGEM_LABELS[r]}</option>
                  ))}
                </select>
              </div>

              {!isFirst && !disabled && (
                <button
                  type="button"
                  onClick={() => removeEntry(idx)}
                  className="flex-shrink-0 text-xs text-red-500 hover:text-red-700 font-medium px-2 py-2 self-end"
                >
                  Remover
                </button>
              )}
            </div>
          );
        })}

        {canAddRow && !disabled && (
          <button
            type="button"
            onClick={addNextEntry}
            className="w-full rounded-xl border-2 border-dashed border-blue-300 py-2 text-sm font-medium text-blue-600 hover:border-blue-400 hover:text-blue-700 transition-colors"
          >
            + Adicionar eixo {usedSlots + 1}
            {remainingSlots > 1 ? ` (${remainingSlots} slots restantes)` : ''}
          </button>
        )}
      </div>

      {/* Estepes */}
      <div className="border-t border-blue-100 pt-3 flex items-end gap-4">
        <div className="w-48">
          <label className="block text-xs font-medium text-zinc-700 mb-1">
            Estepes de fábrica
          </label>
          <input
            type="text"
            inputMode="numeric"
            maxLength={2}
            value={stepsCount === 0 ? '0' : stepsCount || ''}
            disabled={disabled}
            onChange={(e) => {
              const v = e.target.value.replace(/\D/g, '');
              onChange(entries, v === '' ? 0 : parseInt(v, 10));
            }}
            className={inputClass}
            placeholder="Ex: 1"
          />
        </div>

        <div className="flex-1 text-right">
          <span className="text-sm text-zinc-500">Total de pneus:</span>{' '}
          <span className={`text-lg font-bold ${isComplete ? 'text-emerald-600' : 'text-zinc-400'}`}>
            {isComplete ? totalTires : '—'}
          </span>
        </div>
      </div>

      {!isComplete && (
        <p className="text-xs text-amber-600">
          Configure todos os {targetAxles} eixos para calcular o total de pneus.
        </p>
      )}
    </div>
  );
}
