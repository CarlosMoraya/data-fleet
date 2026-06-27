import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, LayoutTemplate, Search, ShieldCheck } from 'lucide-react';
import React, { useMemo, useState } from 'react';
import { Navigate, useSearchParams } from 'react-router-dom';

import WarrantyPlanByModelModal from '../components/warranty/WarrantyPlanByModelModal';
import WarrantyPlanByPlateModal from '../components/warranty/WarrantyPlanByPlateModal';
import { useAuth } from '../context/AuthContext';
import { requiresClientSelection } from '../lib/clientScope';
import { resolveNextRevision } from '../lib/warrantyRevisionResolver';
import {
  WARRANTY_STATUS_BADGE,
  WARRANTY_STATUS_LABEL,
  formatKm,
  formatDate,
  WARRANTY_ISSUE_VALUES,
} from '../lib/warrantyRevisionStatusBadge';
import { listWarrantyOverview } from '../services/warrantyRevisionService';


const ROLES_WITH_ACCESS = ['Fleet Analyst', 'Supervisor', 'Coordinator', 'Manager', 'Director', 'Admin Master'];
const ROLES_CAN_MANAGE = ['Coordinator', 'Manager', 'Director', 'Admin Master'];

type ResolvedRow = ReturnType<typeof resolveNextRevision> & {
  vehicleId: string;
  licensePlate: string;
  brand: string;
  model: string;
  operationalUnitName?: string | null;
  warranty: boolean;
  warrantyEndDate?: string;
  currentKm: number | null;
};

export default function WarrantyRevisions() {
  const { currentClient, user } = useAuth();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();

  const unitFilter = searchParams.get('unit') ?? '';
  const qFilter = searchParams.get('q') ?? '';
  const issueFilter = searchParams.get('issue') ?? '';

  const [byPlateOpen, setByPlateOpen] = useState(false);
  const [byModelOpen, setByModelOpen] = useState(false);

  const blockWrite = requiresClientSelection(user?.role, currentClient?.id);
  const canManage = ROLES_CAN_MANAGE.includes(user?.role || '') && !blockWrite;

  if (user && !ROLES_WITH_ACCESS.includes(user.role)) {
    return <Navigate to="/checklists" replace />;
  }

  const today = new Date().toISOString().split('T')[0];

  const { data: overview = [], isLoading } = useQuery({
    queryKey: ['warrantyOverview', currentClient?.id],
    queryFn: () => listWarrantyOverview(currentClient!.id),
    enabled: !!currentClient?.id,
  });

  const rows = useMemo<ResolvedRow[]>(() => {
    return overview.map((row) => {
      const result = resolveNextRevision({
        currentKm: row.currentKm,
        today,
        warrantyActive: row.activeAssignmentId != null,
        pendingEvents: row.pendingEvents,
        lastRevisionKm: row.lastRevisionKm,
        kmInterval: row.kmInterval,
      });
      return {
        ...result,
        vehicleId: row.vehicle.id,
        licensePlate: row.vehicle.licensePlate,
        brand: row.vehicle.brand,
        model: row.vehicle.model,
        operationalUnitName: row.vehicle.operationalUnitName,
        warranty: row.vehicle.warranty,
        warrantyEndDate: row.vehicle.warrantyEndDate,
        currentKm: row.currentKm,
      };
    });
  }, [overview, today]);

  const filteredRows = useMemo(() => {
    return rows.filter((r) => {
      if (unitFilter && (r.operationalUnitName ?? '') !== unitFilter) return false;
      if (issueFilter && r.status !== issueFilter) return false;
      if (qFilter) {
        const q = qFilter.toLowerCase();
        const hay = `${r.licensePlate} ${r.brand} ${r.model}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [rows, unitFilter, issueFilter, qFilter]);

  const units = useMemo(() => {
    const set = new Set<string>();
    overview.forEach((r) => {
      if (r.vehicle.operationalUnitName) set.add(r.vehicle.operationalUnitName);
    });
    return [...set].sort((a, b) => a.localeCompare(b, 'pt-BR'));
  }, [overview]);

  const kpis = useMemo(() => {
    let inWarranty = 0;
    let aVencer = 0;
    let vencidas = 0;
    let aguardando = 0;
    for (const row of overview) {
      if (row.activeAssignmentId) inWarranty += 1;
    }
    for (const r of rows) {
      if (r.status === 'a_vencer') aVencer += 1;
      if (r.status === 'vencida') vencidas += 1;
      if (r.status === 'aguardando_proxima') aguardando += 1;
    }
    return { inWarranty, aVencer, vencidas, aguardando };
  }, [overview, rows]);

  const setParam = (key: string, value: string, replace = false) => {
    const next = new URLSearchParams(searchParams);
    if (value) next.set(key, value);
    else next.delete(key);
    setSearchParams(next, { replace });
  };

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ['warrantyOverview', currentClient?.id] });
  };

  return (
    <div className="flex h-full flex-col gap-6">
      {/* Header */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight text-zinc-900">
            <ShieldCheck className="h-6 w-6 text-blue-600" />
            Revisões de Garantia
          </h1>
          <p className="mt-1 text-sm text-zinc-500">
            Programação de revisões em garantia com precedência sobre a regra preventiva.
          </p>
        </div>
        {canManage && (
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setByPlateOpen(true)}
              className="inline-flex items-center justify-center rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-blue-700"
            >
              <Plus className="mr-2 -ml-1 h-5 w-5" />
              Cadastrar por placa
            </button>
            <button
              onClick={() => setByModelOpen(true)}
              className="inline-flex items-center justify-center rounded-xl border border-zinc-300 bg-white px-4 py-2.5 text-sm font-medium text-zinc-700 shadow-sm transition-colors hover:bg-zinc-50"
            >
              <LayoutTemplate className="mr-2 -ml-1 h-5 w-5" />
              Cadastrar por modelo
            </button>
          </div>
        )}
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard label="Veículos em garantia" value={kpis.inWarranty} tone="blue" />
        <KpiCard label="Revisões a vencer" value={kpis.aVencer} tone="amber" />
        <KpiCard label="Revisões vencidas" value={kpis.vencidas} tone="red" />
        <KpiCard label="Aguardando próxima revisão" value={kpis.aguardando} tone="zinc" />
      </div>

      {/* Filtros */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="relative">
          <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
            <Search className="h-4 w-4 text-zinc-400" />
          </div>
          <input
            type="text"
            value={qFilter}
            onChange={(e) => setParam('q', e.target.value, true)}
            placeholder="Buscar por placa, marca ou modelo"
            className="block w-full rounded-xl border border-zinc-200 bg-white py-2 pr-3 pl-9 text-sm shadow-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
          />
        </div>
        <select
          value={unitFilter}
          onChange={(e) => setParam('unit', e.target.value)}
          className="block w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
        >
          <option value="">Todas as unidades</option>
          {units.map((u) => (
            <option key={u} value={u}>{u}</option>
          ))}
        </select>
        <select
          value={issueFilter}
          onChange={(e) => setParam('issue', e.target.value)}
          className="block w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
        >
          <option value="">Todos os status</option>
          {WARRANTY_ISSUE_VALUES.map((s) => (
            <option key={s} value={s}>{WARRANTY_STATUS_LABEL[s]}</option>
          ))}
        </select>
      </div>

      {/* Tabela */}
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-zinc-200 border-t-blue-500" />
          </div>
        ) : (
          <div className="flex-1 overflow-auto">
            <table className="min-w-full divide-y divide-zinc-200">
              <thead className="sticky top-0 z-10 bg-zinc-50">
                <tr>
                  <Th>Placa</Th>
                  <Th>Modelo</Th>
                  <Th>Unidade</Th>
                  <Th>Garantia</Th>
                  <Th className="text-right">KM atual</Th>
                  <Th className="text-right">Próxima revisão</Th>
                  <Th>Status</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 bg-white">
                {filteredRows.map((r) => (
                  <tr key={r.vehicleId} className="transition-colors hover:bg-zinc-50">
                    <td className="py-4 pr-3 pl-4 text-sm font-medium whitespace-nowrap text-zinc-900 sm:pl-6">
                      {r.licensePlate}
                    </td>
                    <td className="px-3 py-4 text-sm whitespace-nowrap text-zinc-700">
                      {r.brand} {r.model}
                    </td>
                    <td className="px-3 py-4 text-sm whitespace-nowrap text-zinc-500">
                      {r.operationalUnitName ?? <span className="text-zinc-300">—</span>}
                    </td>
                    <td className="px-3 py-4 text-sm whitespace-nowrap text-zinc-500">
                      {r.warranty ? formatDate(r.warrantyEndDate) : <span className="text-zinc-300">—</span>}
                    </td>
                    <td className="px-3 py-4 text-right text-sm whitespace-nowrap text-zinc-700">
                      {formatKm(r.currentKm)}
                    </td>
                    <td className="px-3 py-4 text-right text-sm whitespace-nowrap text-zinc-700">
                      {r.regime === 'none' ? <span className="text-zinc-300">—</span> : formatKm(r.nextRevisionKm)}
                    </td>
                    <td className="px-3 py-4 text-sm whitespace-nowrap">
                      <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${WARRANTY_STATUS_BADGE[r.status]}`}>
                        {WARRANTY_STATUS_LABEL[r.status]}
                      </span>
                    </td>
                  </tr>
                ))}
                {filteredRows.length === 0 && (
                  <tr>
                    <td colSpan={7} className="py-10 text-center text-sm text-zinc-500">
                      Nenhum veículo encontrado para os filtros selecionados.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {byPlateOpen && (
        <WarrantyPlanByPlateModal
          onClose={() => setByPlateOpen(false)}
          onSaved={() => {
            setByPlateOpen(false);
            refresh();
          }}
        />
      )}
      {byModelOpen && (
        <WarrantyPlanByModelModal
          onClose={() => setByModelOpen(false)}
          onSaved={() => {
            setByModelOpen(false);
            refresh();
          }}
        />
      )}
    </div>
  );
}

function Th({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <th
      scope="col"
      className={`py-3.5 pr-3 pl-4 text-left text-xs font-semibold tracking-wider text-zinc-500 uppercase sm:pl-6 ${className}`}
    >
      {children}
    </th>
  );
}

const KPI_TONES: Record<string, string> = {
  blue: 'text-blue-700',
  amber: 'text-amber-700',
  red: 'text-red-700',
  zinc: 'text-zinc-700',
};

function KpiCard({ label, value, tone }: { label: string; value: number; tone: keyof typeof KPI_TONES }) {
  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
      <p className="text-xs font-semibold tracking-wider text-zinc-500 uppercase">{label}</p>
      <p className={`mt-2 text-3xl font-bold ${KPI_TONES[tone]}`}>{value}</p>
    </div>
  );
}