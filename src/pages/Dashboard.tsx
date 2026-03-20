import React, { useState, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { Loader2, LayoutDashboard, DollarSign, AlertTriangle } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { cn } from '../lib/utils';
import OperationalPanel from '../components/dashboard/OperationalPanel';
import CostPanel from '../components/dashboard/CostPanel';
import type {
  VehicleRow,
  MaintenanceOrderDashboard,
  DashboardFilters,
} from '../components/dashboard/OperationalPanel';

type TabType = 'operacional' | 'custos';

const tabs: { id: TabType; label: string; icon: typeof LayoutDashboard }[] = [
  { id: 'operacional', label: 'Painel Operacional', icon: LayoutDashboard },
  { id: 'custos', label: 'Painel de Custos de Manutenção', icon: DollarSign },
];

function daysBetween(a: Date, b: Date) {
  return Math.floor((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24));
}

export default function Dashboard() {
  const { currentClient, user } = useAuth();
  const [activeTab, setActiveTab] = useState<TabType>('operacional');
  const [filters, setFilters] = useState<DashboardFilters>({
    vehicleType: null,
    maintenanceType: null,
  });

  // ── Queries ──────────────────────────────────────────────────────────────

  const { data: vehicles = [], isLoading: loadingVehicles, error: vehiclesError } = useQuery<VehicleRow[]>({
    queryKey: ['dashboard-vehicles', currentClient?.id],
    queryFn: async () => {
      let query = supabase.from('vehicles').select('id, type, crlv_year, driver_id');
      if (currentClient?.id) {
        query = query.eq('client_id', currentClient.id);
      }
      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as VehicleRow[];
    },
    enabled: !!user,
  });

  const { data: maintenanceOrders = [], isLoading: loadingMaintenance } =
    useQuery<MaintenanceOrderDashboard[]>({
      queryKey: ['dashboard-maintenance', currentClient?.id],
      queryFn: async () => {
        const { data, error } = await supabase
          .from('maintenance_orders')
          .select('id, vehicle_id, type, status, approved_cost, current_km, vehicles(type)')
          .eq('client_id', currentClient!.id);
        if (error) throw error;
        return (data ?? []).map((row: Record<string, unknown>) => ({
          id: row.id as string,
          vehicle_id: row.vehicle_id as string,
          type: row.type as MaintenanceOrderDashboard['type'],
          status: row.status as string,
          approved_cost: row.approved_cost != null ? Number(row.approved_cost) : null,
          current_km: row.current_km != null ? Number(row.current_km) : null,
          vehicle_type:
            row.vehicles && typeof row.vehicles === 'object' && !Array.isArray(row.vehicles)
              ? (row.vehicles as Record<string, unknown>).type as string | null
              : Array.isArray(row.vehicles) && row.vehicles.length > 0
              ? (row.vehicles[0] as Record<string, unknown>).type as string | null
              : null,
        }));
      },
      enabled: !!currentClient?.id,
    });

  const { data: checklistRows = [], isLoading: loadingChecklists } = useQuery<
    { vehicle_id: string; context: string; completed_at: string }[]
  >({
    queryKey: ['dashboard-checklists', currentClient?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('checklists')
        .select('vehicle_id, context, completed_at')
        .eq('client_id', currentClient!.id)
        .eq('status', 'completed')
        .not('vehicle_id', 'is', null);
      if (error) throw error;
      return (data ?? []) as { vehicle_id: string; context: string; completed_at: string }[];
    },
    enabled: !!currentClient?.id,
  });

  const { data: intervals } = useQuery<{
    rotina_day_interval: number | null;
    seguranca_day_interval: number | null;
  } | null>({
    queryKey: ['dashboard-intervals', currentClient?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('checklist_day_intervals')
        .select('rotina_day_interval, seguranca_day_interval')
        .eq('client_id', currentClient!.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!currentClient?.id,
  });

  const { data: drivers = [], isLoading: loadingDrivers } = useQuery<
    { id: string; expiration_date: string | null }[]
  >({
    queryKey: ['dashboard-drivers', currentClient?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('drivers')
        .select('id, expiration_date')
        .eq('client_id', currentClient!.id);
      if (error) throw error;
      return (data ?? []) as { id: string; expiration_date: string | null }[];
    },
    enabled: !!currentClient?.id,
  });

  // ── Computed values ───────────────────────────────────────────────────────

  const overdueChecklistVehicleIds = useMemo(() => {
    const overdue = new Set<string>();
    if (!intervals) return overdue;
    if (!intervals.rotina_day_interval && !intervals.seguranca_day_interval)
      return overdue;

    // Build map: vehicle_id → { lastRotina, lastSeguranca }
    const lastByVehicle = new Map<
      string,
      { rotina?: string; seguranca?: string }
    >();
    for (const c of checklistRows) {
      if (!c.vehicle_id || !c.completed_at) continue;
      const entry = lastByVehicle.get(c.vehicle_id) ?? {};
      if (
        c.context === 'Rotina' &&
        (!entry.rotina || c.completed_at > entry.rotina)
      ) {
        entry.rotina = c.completed_at;
      }
      if (
        c.context === 'Segurança' &&
        (!entry.seguranca || c.completed_at > entry.seguranca)
      ) {
        entry.seguranca = c.completed_at;
      }
      lastByVehicle.set(c.vehicle_id, entry);
    }

    const today = new Date();
    for (const v of vehicles) {
      const last = lastByVehicle.get(v.id);
      if (intervals.rotina_day_interval != null) {
        const lastDate = last?.rotina ? new Date(last.rotina) : null;
        if (!lastDate || daysBetween(lastDate, today) > intervals.rotina_day_interval) {
          overdue.add(v.id);
          continue;
        }
      }
      if (intervals.seguranca_day_interval != null) {
        const lastDate = last?.seguranca ? new Date(last.seguranca) : null;
        if (
          !lastDate ||
          daysBetween(lastDate, today) > intervals.seguranca_day_interval
        ) {
          overdue.add(v.id);
        }
      }
    }

    return overdue;
  }, [vehicles, checklistRows, intervals]);

  const currentYear = new Date().getFullYear().toString();
  const expiredCrlvCount = useMemo(
    () =>
      vehicles.filter((v) => v.crlv_year !== null && v.crlv_year < currentYear)
        .length,
    [vehicles, currentYear]
  );

  const today = new Date().toISOString().split('T')[0];
  const expiredCnhCount = useMemo(
    () =>
      drivers.filter(
        (d) => d.expiration_date !== null && d.expiration_date < today
      ).length,
    [drivers, today]
  );

  // ── Loading state ─────────────────────────────────────────────────────────

  const isLoading =
    loadingVehicles || loadingMaintenance || loadingChecklists || loadingDrivers;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">
          Dashboard
        </h1>
      </div>

      {/* Debug: erro temporário de veículos */}
      {vehiclesError && (
        <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span>Erro ao carregar veículos: {(vehiclesError as Error).message}</span>
        </div>
      )}

      {/* Tabs */}
      <div className="border-b border-zinc-200">
        <nav className="-mb-px flex gap-1">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  'flex items-center gap-2 border-b-2 px-4 py-3 text-sm transition-colors',
                  isActive
                    ? 'border-orange-500 text-orange-600 font-medium'
                    : 'border-transparent text-zinc-500 hover:text-zinc-700 hover:border-zinc-300'
                )}
              >
                <Icon className="h-4 w-4" />
                {tab.label}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Panels */}
      {activeTab === 'operacional' && (
        <OperationalPanel
          vehicles={vehicles}
          maintenanceOrders={maintenanceOrders}
          overdueChecklistVehicleIds={overdueChecklistVehicleIds}
          expiredCrlvCount={expiredCrlvCount}
          expiredCnhCount={expiredCnhCount}
          filters={filters}
          onFiltersChange={setFilters}
        />
      )}
      {activeTab === 'custos' && (
        <CostPanel
          vehicles={vehicles}
          maintenanceOrders={maintenanceOrders}
          filters={filters}
          onFiltersChange={setFilters}
        />
      )}
    </div>
  );
}
