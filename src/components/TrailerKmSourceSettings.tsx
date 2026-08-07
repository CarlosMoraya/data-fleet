import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Gauge, Loader2 } from 'lucide-react';
import React, { useState, useEffect } from 'react';

import { supabase } from '../lib/supabase';
import { trailerKmSettingsFromRow, trailerKmSettingsToRow, type VehicleKmSourceSettingsRow } from '../lib/trailerKmSettingsMappers';

import type { TrailerKmMode } from '../types/coupling';

interface Props {
  clientId: string;
  userId: string;
}

export default function TrailerKmSourceSettings({ clientId, userId }: Props) {
  const queryClient = useQueryClient();

  const [mode, setMode] = useState<TrailerKmMode>('coupling_accumulated');
  const [isDirty, setIsDirty] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    setMode('coupling_accumulated');
    setIsDirty(false);
    setSaveSuccess(false);
    setSaveError(null);
  }, [clientId]);

  const query = useQuery({
    queryKey: ['vehicleKmSourceSettings', clientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('vehicle_km_source_settings')
        .select('id, client_id, trailer_km_mode, updated_at, updated_by')
        .eq('client_id', clientId)
        .maybeSingle();
      if (error) throw error;
      return data as VehicleKmSourceSettingsRow | null;
    },
    enabled: !!clientId,
  });

  useEffect(() => {
    if (query.isSuccess) {
      setMode(query.data ? trailerKmSettingsFromRow(query.data).trailerKmMode : 'coupling_accumulated');
      setIsDirty(false);
    }
  }, [query.data, query.isSuccess]);

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setMode(e.target.value as TrailerKmMode);
    setIsDirty(true);
    setSaveSuccess(false);
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      const row = trailerKmSettingsToRow(clientId, mode, userId);
      const { error } = await supabase
        .from('vehicle_km_source_settings')
        .upsert(row, { onConflict: 'client_id' });
      if (error) throw error;
    },
    onSuccess: () => {
      setIsDirty(false);
      setSaveSuccess(true);
      setSaveError(null);
      void queryClient.invalidateQueries({ queryKey: ['vehicleKmSourceSettings', clientId] });
    },
    onError: (err: Error) => {
      setSaveError(err.message ?? 'Erro ao salvar configurações.');
    },
  });

  if (query.isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-zinc-400" />
      </div>
    );
  }

  return (
    <div className="animate-in fade-in overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm duration-300">
      <div className="flex items-center gap-3 border-b border-zinc-200 px-6 py-4">
        <Gauge className="h-5 w-5 text-zinc-400" />
        <div>
          <h2 className="text-lg font-medium text-zinc-900">Km da Carreta</h2>
          <p className="text-sm text-zinc-500">
            Defina como o km da carreta (semi-reboque/implemento) é calculado: por hubodômetro próprio
            ou pelo acúmulo de km rodado durante cada engate.
          </p>
        </div>
      </div>

      {saveError && (
        <div className="mx-6 mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {saveError}
        </div>
      )}
      {saveSuccess && (
        <div className="mx-6 mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          Configurações salvas com sucesso.
        </div>
      )}

      <div className="px-6 py-5">
        <div className="flex items-center justify-between gap-4">
          <div>
            <span className="text-sm font-medium text-zinc-800">Origem do km da carreta</span>
            <p className="mt-0.5 text-xs text-zinc-500">
              Hubodômetro: usa as leituras do contexto Atualização de Hodômetro da própria carreta.
              Acumulado por engate: soma o km rodado (delta) em cada engate fechado.
            </p>
          </div>
          <select
            value={mode}
            onChange={handleChange}
            className="h-9 min-w-[220px] rounded-lg border border-zinc-200 px-3 text-sm text-zinc-800 transition-colors focus:ring-2 focus:ring-orange-500 focus:outline-none"
          >
            <option value="coupling_accumulated">Acumulado por engate</option>
            <option value="hubodometer">Hubodômetro</option>
          </select>
        </div>
      </div>

      <div className="flex items-center justify-end border-t border-zinc-200 bg-zinc-50 px-6 py-4">
        <button
          onClick={() => saveMutation.mutate()}
          disabled={!isDirty || saveMutation.isPending}
          className="inline-flex cursor-pointer items-center gap-2 rounded-xl bg-orange-500 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-orange-600 focus:ring-2 focus:ring-orange-500 focus:ring-offset-2 focus:outline-none disabled:opacity-50"
        >
          {saveMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
          {saveMutation.isPending ? 'Salvando...' : 'Salvar'}
        </button>
      </div>
    </div>
  );
}
