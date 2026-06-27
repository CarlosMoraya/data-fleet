import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { CalendarDays, Loader2 } from 'lucide-react';
import React, { useState, useEffect } from 'react';

import { supabase } from '../lib/supabase';

interface Props {
  clientId: string;
  userId: string;
}


export default function ChecklistDayIntervalSettings({ clientId, userId }: Props) {
  const queryClient = useQueryClient();

  const [rotinaDays, setRotinaDays] = useState<string>('');
  const [segurancaDays, setSegurancaDays] = useState<string>('');
  const [pneusDays, setPneusDays] = useState<string>('7');
  const [odometerDays, setOdometerDays] = useState<string>('');
  const [odometerTolerance, setOdometerTolerance] = useState<string>('');
  const [isDirty, setIsDirty] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Reset local state when client changes (Admin Master switching tenants)
  useEffect(() => {
    setRotinaDays('');
    setSegurancaDays('');
    setPneusDays('7');
    setOdometerDays('');
    setOdometerTolerance('');
    setIsDirty(false);
    setSaveSuccess(false);
    setSaveError(null);
  }, [clientId]);

  const query = useQuery({
    queryKey: ['checklistDayIntervals', clientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('checklist_day_intervals')
        .select('id, client_id, rotina_day_interval, seguranca_day_interval, pneus_day_interval, odometer_update_day_interval, odometer_km_tolerance_per_day')
        .eq('client_id', clientId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!clientId,
  });

  // Seed local state when query resolves
  useEffect(() => {
    if (query.isSuccess) {
      setRotinaDays(query.data?.rotina_day_interval != null ? String(query.data.rotina_day_interval) : '');
      setSegurancaDays(query.data?.seguranca_day_interval != null ? String(query.data.seguranca_day_interval) : '');
      setPneusDays(query.data?.pneus_day_interval != null ? String(query.data.pneus_day_interval) : '7');
      setOdometerDays(query.data?.odometer_update_day_interval != null ? String(query.data.odometer_update_day_interval) : '');
      setOdometerTolerance(query.data?.odometer_km_tolerance_per_day != null ? String(query.data.odometer_km_tolerance_per_day) : '');
      setIsDirty(false);
    }
  }, [query.data, query.isSuccess]);

  const handleChange = (setter: React.Dispatch<React.SetStateAction<string>>) =>
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const v = e.target.value;
      if (v === '' || (/^\d+$/.test(v) && parseInt(v, 10) > 0)) {
        setter(v);
        setIsDirty(true);
        setSaveSuccess(false);
      }
    };

  const saveMutation = useMutation({
    mutationFn: async () => {
      const pneusVal = pneusDays === '' ? 7 : Math.max(0, parseInt(pneusDays, 10));
      const row = {
        client_id: clientId,
        rotina_day_interval: rotinaDays === '' ? null : parseInt(rotinaDays, 10),
        seguranca_day_interval: segurancaDays === '' ? null : parseInt(segurancaDays, 10),
        pneus_day_interval: pneusVal,
        odometer_update_day_interval: odometerDays === '' ? null : parseInt(odometerDays, 10),
        odometer_km_tolerance_per_day: odometerTolerance === '' ? null : parseInt(odometerTolerance, 10),
        updated_by: userId,
        updated_at: new Date().toISOString(),
      };
      const { error } = await supabase
        .from('checklist_day_intervals')
        .upsert(row, { onConflict: 'client_id' });
      if (error) throw error;
    },
    onSuccess: () => {
      setIsDirty(false);
      setSaveSuccess(true);
      setSaveError(null);
      void queryClient.invalidateQueries({ queryKey: ['checklistDayIntervals', clientId] });
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
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-zinc-200 px-6 py-4">
        <CalendarDays className="h-5 w-5 text-zinc-400" />
        <div>
          <h2 className="text-lg font-medium text-zinc-900">Intervalo entre Checklists</h2>
          <p className="text-sm text-zinc-500">
            Configure o número de dias entre checklists consecutivos de Rotina e Segurança.
            Estes valores serão usados para gerar alertas de checklists em atraso.
          </p>
        </div>
      </div>

      {/* Feedback */}
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

      {/* Rows */}
      <div className="divide-y divide-zinc-100 px-6">
        {/* Rotina */}
        <div className="flex items-center justify-between py-5">
          <div>
            <span className="text-sm font-medium text-zinc-800">Rotina</span>
            <p className="mt-0.5 text-xs text-zinc-500">
              Intervalo máximo em dias entre checklists de Rotina consecutivos.
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <input
              type="number"
              min="1"
              value={rotinaDays}
              onChange={handleChange(setRotinaDays)}
              placeholder="—"
              className="h-9 w-24 rounded-lg border border-zinc-200 px-3 text-right text-sm text-zinc-800 transition-colors placeholder:text-zinc-400 focus:ring-2 focus:ring-orange-500 focus:outline-none"
            />
            <span className="w-8 text-xs text-zinc-400">dias</span>
          </div>
        </div>

        {/* Segurança */}
        <div className="flex items-center justify-between py-5">
          <div>
            <span className="text-sm font-medium text-zinc-800">Segurança</span>
            <p className="mt-0.5 text-xs text-zinc-500">
              Intervalo máximo em dias entre checklists de Segurança consecutivos.
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <input
              type="number"
              min="1"
              value={segurancaDays}
              onChange={handleChange(setSegurancaDays)}
              placeholder="—"
              className="h-9 w-24 rounded-lg border border-zinc-200 px-3 text-right text-sm text-zinc-800 transition-colors placeholder:text-zinc-400 focus:ring-2 focus:ring-orange-500 focus:outline-none"
            />
            <span className="w-8 text-xs text-zinc-400">dias</span>
          </div>
        </div>

        {/* Pneus */}
        <div className="flex items-center justify-between py-5">
          <div>
            <span className="text-sm font-medium text-zinc-800">Pneus (Inspeção)</span>
            <p className="mt-0.5 text-xs text-zinc-500">
              Intervalo mínimo entre inspeções de pneus consecutivas. Defina 0 para não exigir intervalo.
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <input
              type="number"
              min="0"
              value={pneusDays}
              onChange={e => {
                const v = e.target.value;
                if (v === '' || (/^\d+$/.test(v) && parseInt(v, 10) >= 0)) {
                  setPneusDays(v);
                  setIsDirty(true);
                  setSaveSuccess(false);
                }
              }}
              placeholder="7"
              title="Mínimo: 0 dias"
              className="h-9 w-24 rounded-lg border border-zinc-200 px-3 text-right text-sm text-zinc-800 transition-colors placeholder:text-zinc-400 focus:ring-2 focus:ring-orange-500 focus:outline-none"
            />
            <span className="w-8 text-xs text-zinc-400">dias</span>
          </div>
        </div>

        {/* Atualização de Hodômetro */}
        <div className="flex items-center justify-between py-5">
          <div>
            <span className="text-sm font-medium text-zinc-800">Atualização de Hodômetro</span>
            <p className="mt-0.5 text-xs text-zinc-500">
              Frequência esperada e tolerância máxima de KM por dia para o contexto Atualização de Hodômetro.
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap items-center justify-end gap-3">
            <label className="flex items-center gap-2">
              <span className="text-xs text-zinc-500">Frequência (dias)</span>
              <input
                type="number"
                min="1"
                value={odometerDays}
                onChange={handleChange(setOdometerDays)}
                placeholder="—"
                className="h-9 w-24 rounded-lg border border-zinc-200 px-3 text-right text-sm text-zinc-800 transition-colors placeholder:text-zinc-400 focus:ring-2 focus:ring-orange-500 focus:outline-none"
              />
            </label>
            <label className="flex items-center gap-2">
              <span className="text-xs text-zinc-500">Tolerância (km/dia)</span>
              <input
                type="number"
                min="1"
                value={odometerTolerance}
                onChange={handleChange(setOdometerTolerance)}
                placeholder="—"
                className="h-9 w-24 rounded-lg border border-zinc-200 px-3 text-right text-sm text-zinc-800 transition-colors placeholder:text-zinc-400 focus:ring-2 focus:ring-orange-500 focus:outline-none"
              />
            </label>
          </div>
        </div>
      </div>

      {/* Footer */}
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
