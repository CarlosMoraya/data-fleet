import { useQuery } from '@tanstack/react-query';
import { X, Loader2, History, Circle } from 'lucide-react';
import React from 'react';

import { supabase } from '../lib/supabase';
import { TirePositionHistoryRow, tireHistoryFromRow } from '../lib/tireMappers';
import { cn } from '../lib/utils';
import { Tire, TirePositionHistory } from '../types';

interface TireHistoryModalProps {
  tire: Tire;
  onClose: () => void;
}

function classificationBadge(classification: Tire['visualClassification']) {
  switch (classification) {
    case 'Novo':      return 'bg-emerald-100 text-emerald-800';
    case 'Meia vida': return 'bg-yellow-100 text-yellow-800';
    case 'Troca':     return 'bg-red-100 text-red-800';
  }
}

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function TireHistoryModal({ tire, onClose }: TireHistoryModalProps) {
  const { data: history = [], isLoading } = useQuery({
    queryKey: ['tireHistory', tire.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tire_position_history')
        .select('*, profiles(name)')
        .eq('tire_id', tire.id)
        .order('moved_at', { ascending: false });
      if (error) throw error;
      return (data as TirePositionHistoryRow[]).map(tireHistoryFromRow);
    },
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="mx-4 flex max-h-[90vh] w-full max-w-2xl flex-col rounded-2xl bg-white shadow-xl">
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between border-b border-zinc-100 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-orange-50 p-2">
              <Circle className="h-5 w-5 text-orange-500" />
            </div>
            <div>
              <h2 className="font-mono text-lg font-semibold text-zinc-900">{tire.tireCode}</h2>
              <p className="text-sm text-zinc-500">
                {tire.vehicleLicensePlate ?? '—'}
                {tire.vehicleModel && <span className="ml-1 text-zinc-400">{tire.vehicleModel}</span>}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="rounded-lg p-2 text-zinc-400 hover:bg-zinc-100">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Dados do pneu */}
        <div className="shrink-0 border-b border-zinc-100 bg-zinc-50 px-6 py-4">
          <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
            <div>
              <span className="text-xs tracking-wide text-zinc-400 uppercase">Especificação</span>
              <p className="font-mono font-medium text-zinc-900">{tire.specification}</p>
            </div>
            <div>
              <span className="text-xs tracking-wide text-zinc-400 uppercase">Posição Atual</span>
              <p className="font-medium text-zinc-900">
                <span className="rounded bg-zinc-200 px-1.5 py-0.5 font-mono text-xs">{tire.currentPosition}</span>
              </p>
            </div>
            <div>
              <span className="text-xs tracking-wide text-zinc-400 uppercase">Classificação</span>
              <p>
                <span className={cn('rounded-full px-2 py-0.5 text-xs font-medium', classificationBadge(tire.visualClassification))}>
                  {tire.visualClassification}
                </span>
              </p>
            </div>
            {tire.manufacturer && (
              <div>
                <span className="text-xs tracking-wide text-zinc-400 uppercase">Fabricante</span>
                <p className="font-medium text-zinc-900">{tire.manufacturer}</p>
              </div>
            )}
            {tire.brand && (
              <div>
                <span className="text-xs tracking-wide text-zinc-400 uppercase">Marca</span>
                <p className="font-medium text-zinc-900">{tire.brand}</p>
              </div>
            )}
            {tire.dot && (
              <div>
                <span className="text-xs tracking-wide text-zinc-400 uppercase">DOT</span>
                <p className="font-mono font-medium text-zinc-900">{tire.dot}</p>
              </div>
            )}
            {tire.rotationIntervalKm && (
              <div>
                <span className="text-xs tracking-wide text-zinc-400 uppercase">Rodízio</span>
                <p className="font-medium text-zinc-900">{tire.rotationIntervalKm.toLocaleString('pt-BR')} km</p>
              </div>
            )}
            {tire.usefulLifeKm && (
              <div>
                <span className="text-xs tracking-wide text-zinc-400 uppercase">Vida Útil</span>
                <p className="font-medium text-zinc-900">{tire.usefulLifeKm.toLocaleString('pt-BR')} km</p>
              </div>
            )}
            {tire.retreadIntervalKm && (
              <div>
                <span className="text-xs tracking-wide text-zinc-400 uppercase">Recapagem</span>
                <p className="font-medium text-zinc-900">{tire.retreadIntervalKm.toLocaleString('pt-BR')} km</p>
              </div>
            )}
            <div>
              <span className="text-xs tracking-wide text-zinc-400 uppercase">Status</span>
              <p>
                {tire.active ? (
                  <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">Ativo</span>
                ) : (
                  <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-400">Inativo</span>
                )}
              </p>
            </div>
          </div>
        </div>

        {/* Histórico */}
        <div className="flex min-h-0 flex-1 flex-col">
          <div className="flex shrink-0 items-center gap-2 border-b border-zinc-100 px-6 py-3">
            <History className="h-4 w-4 text-zinc-400" />
            <span className="text-sm font-medium text-zinc-700">Histórico de Movimentação</span>
            {!isLoading && (
              <span className="ml-auto text-xs text-zinc-400">{history.length} registro{history.length !== 1 ? 's' : ''}</span>
            )}
          </div>

          <div className="flex-1 overflow-y-auto">
            {isLoading ? (
              <div className="flex h-32 items-center justify-center">
                <Loader2 className="h-5 w-5 animate-spin text-orange-500" />
              </div>
            ) : history.length === 0 ? (
              <div className="flex h-32 items-center justify-center text-sm text-zinc-400">
                Nenhum registro de movimentação.
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-zinc-50">
                  <tr>
                    <th className="px-4 py-2.5 text-left text-xs font-medium tracking-wide text-zinc-400 uppercase">Data/Hora</th>
                    <th className="px-4 py-2.5 text-left text-xs font-medium tracking-wide text-zinc-400 uppercase">De</th>
                    <th className="px-4 py-2.5 text-left text-xs font-medium tracking-wide text-zinc-400 uppercase">Para</th>
                    <th className="px-4 py-2.5 text-left text-xs font-medium tracking-wide text-zinc-400 uppercase">Responsável</th>
                    <th className="px-4 py-2.5 text-left text-xs font-medium tracking-wide text-zinc-400 uppercase">Km</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-50">
                  {history.map((h: TirePositionHistory) => (
                    <tr key={h.id} className="hover:bg-zinc-50/50">
                      <td className="px-4 py-3 text-xs whitespace-nowrap text-zinc-600">
                        {formatDateTime(h.movedAt)}
                      </td>
                      <td className="px-4 py-3">
                        {h.previousPosition ? (
                          <span className="rounded bg-zinc-100 px-1.5 py-0.5 font-mono text-xs text-zinc-500">
                            {h.previousPosition}
                          </span>
                        ) : (
                          <span className="text-xs text-zinc-300 italic">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className="rounded bg-orange-50 px-1.5 py-0.5 font-mono text-xs text-orange-700 text-zinc-900">
                          {h.newPosition}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-zinc-600">
                        {h.movedByName ?? h.movedBy}
                      </td>
                      <td className="px-4 py-3 text-xs text-zinc-500">
                        {h.odometerKm ? `${h.odometerKm.toLocaleString('pt-BR')} km` : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex shrink-0 justify-end border-t border-zinc-100 px-6 py-4">
          <button
            onClick={onClose}
            className="rounded-lg border border-zinc-200 px-4 py-2 text-sm text-zinc-600 hover:bg-zinc-50 hover:text-zinc-800"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}
