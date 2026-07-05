import { useQuery } from '@tanstack/react-query';
import { Clock3, Link2, Unlink } from 'lucide-react';
import React from 'react';
import { Navigate } from 'react-router-dom';

import SelectClientNotice from '../components/SelectClientNotice';
import { useAuth } from '../context/AuthContext';
import { requiresClientSelection } from '../lib/clientScope';
import { couplingFromRow, type VehicleCouplingRow } from '../lib/couplingMappers';
import { hasRoleAccess } from '../lib/rolePermissions';
import { supabase } from '../lib/supabase';

function formatDateTime(value?: string | null): string {
  if (!value) return '—';
  return new Date(value).toLocaleString('pt-BR');
}

function formatKm(value?: number | null): string {
  if (value == null) return '—';
  return `${value.toLocaleString('pt-BR')} km`;
}

export default function CouplingsPanel() {
  const { user, currentClient } = useAuth();
  const blockWrite = requiresClientSelection(user?.role, currentClient?.id);

  const canView = user?.role === 'Admin Master' || hasRoleAccess(user?.role);
  const isCouplingAgent = user?.role === 'Coupling Agent';

  const { data: couplings = [], isLoading } = useQuery({
    queryKey: ['vehicleCouplings', currentClient?.id],
    enabled: !!currentClient?.id && canView && !isCouplingAgent,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('vehicle_couplings')
        .select(`
          *,
          trailers:vehicles!vehicle_couplings_trailer_id_fkey(license_plate),
          tractors:vehicles!vehicle_couplings_tractor_id_fkey(license_plate)
        `)
        .eq('client_id', currentClient!.id)
        .order('coupled_at', { ascending: false });

      if (error) throw error;
      return (data as Array<VehicleCouplingRow & {
        trailers?: { license_plate: string } | null;
        tractors?: { license_plate: string } | null;
      }> ?? []).map((row) => ({
        ...couplingFromRow(row),
        trailerPlate: row.trailers?.license_plate ?? '—',
        resolvedTractorPlate: row.tractor_plate ?? row.tractors?.license_plate ?? '—',
      }));
    },
  });

  if (!canView || isCouplingAgent) {
    return <Navigate to="/" replace />;
  }

  if (blockWrite) {
    return (
      <div className="space-y-4">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-900">Engates e desengates</h1>
          <p className="mt-2 text-sm text-zinc-600">
            Selecione uma transportadora no topo para consultar o pátio e o histórico de vínculos.
          </p>
        </div>
        <SelectClientNotice />
      </div>
    );
  }

  const openCouplings = couplings.filter((coupling) => !coupling.uncoupledAt);
  const closedCouplings = couplings.filter((coupling) => !!coupling.uncoupledAt);

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
      <div className="rounded-[28px] border border-zinc-200 bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-xs font-semibold tracking-[0.24em] text-zinc-400 uppercase">Pátio</p>
            <h1 className="mt-2 text-2xl font-semibold text-zinc-900">Engates e desengates</h1>
            <p className="mt-2 text-sm text-zinc-600">
              Lista temporal dos vínculos entre cavalos e implementos do tenant atual.
            </p>
          </div>
          <div className="rounded-2xl bg-orange-50 p-3 text-orange-600">
            <Link2 className="h-6 w-6" />
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="rounded-[28px] border border-zinc-200 bg-white p-8 text-sm text-zinc-500 shadow-sm">
          Carregando engates...
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          <section className="rounded-[28px] border border-zinc-200 bg-white p-6 shadow-sm">
            <div className="flex items-center gap-2">
              <Clock3 className="h-4 w-4 text-orange-500" />
              <h2 className="text-sm font-semibold text-zinc-900">Engates abertos</h2>
            </div>
            <div className="mt-4 space-y-4">
              {openCouplings.length === 0 ? (
                <p className="text-sm text-zinc-500">Nenhum vínculo ativo.</p>
              ) : openCouplings.map((coupling) => (
                <article key={coupling.id} className="rounded-3xl border border-zinc-200 p-4">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="text-sm font-semibold text-zinc-900">{coupling.trailerPlate}</p>
                      <p className="text-xs text-zinc-500">{coupling.resolvedTractorPlate} · {coupling.tractorDriverName ?? 'Condutor não informado'}</p>
                    </div>
                    <span className="rounded-full bg-green-100 px-2.5 py-1 text-xs font-medium text-green-700">
                      Engatado
                    </span>
                  </div>
                  <div className="mt-3 grid gap-2 text-xs text-zinc-500 sm:grid-cols-2">
                    <p>Início: {formatDateTime(coupling.coupledAt)}</p>
                    <p>KM engate: {formatKm(coupling.odometerCoupled)}</p>
                  </div>
                </article>
              ))}
            </div>
          </section>

          <section className="rounded-[28px] border border-zinc-200 bg-white p-6 shadow-sm">
            <div className="flex items-center gap-2">
              <Unlink className="h-4 w-4 text-zinc-500" />
              <h2 className="text-sm font-semibold text-zinc-900">Histórico fechado</h2>
            </div>
            <div className="mt-4 space-y-4">
              {closedCouplings.length === 0 ? (
                <p className="text-sm text-zinc-500">Nenhum desengate registrado.</p>
              ) : closedCouplings.map((coupling) => (
                <article key={coupling.id} className="rounded-3xl border border-zinc-200 p-4">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="text-sm font-semibold text-zinc-900">{coupling.trailerPlate}</p>
                      <p className="text-xs text-zinc-500">{coupling.resolvedTractorPlate} · {coupling.tractorDriverName ?? 'Condutor não informado'}</p>
                    </div>
                    <span className="rounded-full bg-zinc-100 px-2.5 py-1 text-xs font-medium text-zinc-700">
                      Desvinculado
                    </span>
                  </div>
                  <div className="mt-3 grid gap-2 text-xs text-zinc-500 sm:grid-cols-2">
                    <p>Início: {formatDateTime(coupling.coupledAt)}</p>
                    <p>Fim: {formatDateTime(coupling.uncoupledAt)}</p>
                    <p>KM rodado: {formatKm(coupling.distanceKm)}</p>
                    <p>KM desengate: {formatKm(coupling.odometerUncoupled)}</p>
                  </div>
                </article>
              ))}
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
