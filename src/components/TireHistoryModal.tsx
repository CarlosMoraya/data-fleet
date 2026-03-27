import React from 'react';
import { X, Loader2, History, Circle } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { Tire, TirePositionHistory } from '../types';
import { TirePositionHistoryRow, tireHistoryFromRow } from '../lib/tireMappers';
import { cn } from '../lib/utils';

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
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl mx-4 flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-100 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-orange-50 rounded-lg">
              <Circle className="h-5 w-5 text-orange-500" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-zinc-900 font-mono">{tire.tireCode}</h2>
              <p className="text-sm text-zinc-500">
                {tire.vehicleLicensePlate ?? '—'}
                {tire.vehicleModel && <span className="ml-1 text-zinc-400">{tire.vehicleModel}</span>}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-zinc-100 text-zinc-400">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Dados do pneu */}
        <div className="px-6 py-4 border-b border-zinc-100 bg-zinc-50 shrink-0">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
            <div>
              <span className="text-zinc-400 text-xs uppercase tracking-wide">Especificação</span>
              <p className="font-medium text-zinc-900 font-mono">{tire.specification}</p>
            </div>
            <div>
              <span className="text-zinc-400 text-xs uppercase tracking-wide">Posição Atual</span>
              <p className="font-medium text-zinc-900">
                <span className="font-mono bg-zinc-200 px-1.5 py-0.5 rounded text-xs">{tire.currentPosition}</span>
              </p>
            </div>
            <div>
              <span className="text-zinc-400 text-xs uppercase tracking-wide">Classificação</span>
              <p>
                <span className={cn('px-2 py-0.5 rounded-full text-xs font-medium', classificationBadge(tire.visualClassification))}>
                  {tire.visualClassification}
                </span>
              </p>
            </div>
            {tire.manufacturer && (
              <div>
                <span className="text-zinc-400 text-xs uppercase tracking-wide">Fabricante</span>
                <p className="font-medium text-zinc-900">{tire.manufacturer}</p>
              </div>
            )}
            {tire.brand && (
              <div>
                <span className="text-zinc-400 text-xs uppercase tracking-wide">Marca</span>
                <p className="font-medium text-zinc-900">{tire.brand}</p>
              </div>
            )}
            {tire.dot && (
              <div>
                <span className="text-zinc-400 text-xs uppercase tracking-wide">DOT</span>
                <p className="font-medium text-zinc-900 font-mono">{tire.dot}</p>
              </div>
            )}
            {tire.rotationIntervalKm && (
              <div>
                <span className="text-zinc-400 text-xs uppercase tracking-wide">Rodízio</span>
                <p className="font-medium text-zinc-900">{tire.rotationIntervalKm.toLocaleString('pt-BR')} km</p>
              </div>
            )}
            {tire.usefulLifeKm && (
              <div>
                <span className="text-zinc-400 text-xs uppercase tracking-wide">Vida Útil</span>
                <p className="font-medium text-zinc-900">{tire.usefulLifeKm.toLocaleString('pt-BR')} km</p>
              </div>
            )}
            {tire.retreadIntervalKm && (
              <div>
                <span className="text-zinc-400 text-xs uppercase tracking-wide">Recapagem</span>
                <p className="font-medium text-zinc-900">{tire.retreadIntervalKm.toLocaleString('pt-BR')} km</p>
              </div>
            )}
            <div>
              <span className="text-zinc-400 text-xs uppercase tracking-wide">Status</span>
              <p>
                {tire.active ? (
                  <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700">Ativo</span>
                ) : (
                  <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-zinc-100 text-zinc-400">Inativo</span>
                )}
              </p>
            </div>
          </div>
        </div>

        {/* Histórico */}
        <div className="flex flex-col flex-1 min-h-0">
          <div className="flex items-center gap-2 px-6 py-3 border-b border-zinc-100 shrink-0">
            <History className="h-4 w-4 text-zinc-400" />
            <span className="text-sm font-medium text-zinc-700">Histórico de Movimentação</span>
            {!isLoading && (
              <span className="text-xs text-zinc-400 ml-auto">{history.length} registro{history.length !== 1 ? 's' : ''}</span>
            )}
          </div>

          <div className="flex-1 overflow-y-auto">
            {isLoading ? (
              <div className="flex items-center justify-center h-32">
                <Loader2 className="h-5 w-5 animate-spin text-orange-500" />
              </div>
            ) : history.length === 0 ? (
              <div className="flex items-center justify-center h-32 text-zinc-400 text-sm">
                Nenhum registro de movimentação.
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-zinc-50 sticky top-0">
                  <tr>
                    <th className="px-4 py-2.5 text-left text-xs font-medium text-zinc-400 uppercase tracking-wide">Data/Hora</th>
                    <th className="px-4 py-2.5 text-left text-xs font-medium text-zinc-400 uppercase tracking-wide">De</th>
                    <th className="px-4 py-2.5 text-left text-xs font-medium text-zinc-400 uppercase tracking-wide">Para</th>
                    <th className="px-4 py-2.5 text-left text-xs font-medium text-zinc-400 uppercase tracking-wide">Responsável</th>
                    <th className="px-4 py-2.5 text-left text-xs font-medium text-zinc-400 uppercase tracking-wide">Km</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-50">
                  {history.map((h: TirePositionHistory) => (
                    <tr key={h.id} className="hover:bg-zinc-50/50">
                      <td className="px-4 py-3 text-zinc-600 text-xs whitespace-nowrap">
                        {formatDateTime(h.movedAt)}
                      </td>
                      <td className="px-4 py-3">
                        {h.previousPosition ? (
                          <span className="font-mono text-zinc-500 bg-zinc-100 px-1.5 py-0.5 rounded text-xs">
                            {h.previousPosition}
                          </span>
                        ) : (
                          <span className="text-zinc-300 text-xs italic">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className="font-mono text-zinc-900 bg-orange-50 text-orange-700 px-1.5 py-0.5 rounded text-xs">
                          {h.newPosition}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-zinc-600 text-xs">
                        {h.movedByName ?? h.movedBy}
                      </td>
                      <td className="px-4 py-3 text-zinc-500 text-xs">
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
        <div className="px-6 py-4 border-t border-zinc-100 shrink-0 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-zinc-600 hover:text-zinc-800 border border-zinc-200 rounded-lg hover:bg-zinc-50"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}
