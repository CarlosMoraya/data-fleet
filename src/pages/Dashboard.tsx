import React, { useState, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { LayoutDashboard, DollarSign, CalendarDays } from 'lucide-react';
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

function getDefaultDateRange() {
  const now = new Date();
  const from = new Date(now.getFullYear(), now.getMonth(), 1)
    .toISOString().split('T')[0];
  const to = new Date(now.getFullYear(), now.getMonth() + 1, 0)
    .toISOString().split('T')[0];
  return { from, to };
}

export default function Dashboard() {
  const { currentClient, user } = useAuth();
  const [activeTab, setActiveTab] = useState<TabType>('operacional');
  const [filters, setFilters] = useState<DashboardFilters>({
    vehicleType: null,
    maintenanceType: null,
  });

  const [dateRange, setDateRange] = useState<{ from: string; to: string }>(() => {
    try {
      const stored = localStorage.getItem('dashboard_date_filter');
      return stored ? JSON.parse(stored) : getDefaultDateRange();
    } catch {
      return getDefaultDateRange();
    }
  });

  function handleDateChange(field: 'from' | 'to', value: string) {
    const next = { ...dateRange, [field]: value };
    setDateRange(next);
    localStorage.setItem('dashboard_date_filter', JSON.stringify(next));
  }

  function handleResetToCurrentMonth() {
    const next = getDefaultDateRange();
    setDateRange(next);
    localStorage.setItem('dashboard_date_filter', JSON.stringify(next));
  }

  // ── Queries ──────────────────────────────────────────────────────────────

  const { data: vehicles = [], isLoading: loadingVehicles } = useQuery<VehicleRow[]>({
    queryKey: ['dashboard-vehicles', currentClient?.id],
    queryFn: async () => {
      let query = supabase
        .from('vehicles')
        .select('id, type, crlv_year, driver_id, shippers(name), operational_units(name)');
      if (currentClient?.id) {
        query = query.eq('client_id', currentClient.id);
      }
      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []).map((row: Record<string, unknown>) => ({
        id: row.id as string,
        type: row.type as string,
        crlv_year: row.crlv_year as string | null,
        driver_id: row.driver_id as string | null,
        shipper_name:
          row.shippers && typeof row.shippers === 'object' && !Array.isArray(row.shippers)
            ? (row.shippers as Record<string, unknown>).name as string | null
            : null,
        operational_unit_name:
          row.operational_units && typeof row.operational_units === 'object' && !Array.isArray(row.operational_units)
            ? (row.operational_units as Record<string, unknown>).name as string | null
            : null,
      })) as VehicleRow[];
    },
    enabled: !!user,
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  });

  const { data: maintenanceOrders = [], isLoading: loadingMaintenance } =
    useQuery<MaintenanceOrderDashboard[]>({
      queryKey: ['dashboard-maintenance', currentClient?.id, dateRange.from, dateRange.to],
      queryFn: async () => {
        let query = supabase
          .from('maintenance_orders')
          .select('id, vehicle_id, type, status, approved_cost, current_km, vehicles(type)')
          .gte('entry_date', dateRange.from)
          .lte('entry_date', dateRange.to)
          .neq('status', 'Cancelado');
        if (currentClient?.id) {
          query = query.eq('client_id', currentClient.id);
        }
        const { data, error } = await query;
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
      enabled: !!user,
      staleTime: 5 * 60 * 1000,
      gcTime: 30 * 60 * 1000,
    });

  const { data: checklistRows = [], isLoading: loadingChecklists } = useQuery<
    { vehicle_id: string; context: string; completed_at: string; odometer_km: number | null }[]
  >({
    queryKey: ['dashboard-checklists', currentClient?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('checklists')
        .select('vehicle_id, context, completed_at, odometer_km')
        .eq('client_id', currentClient!.id)
        .eq('status', 'completed')
        .not('vehicle_id', 'is', null);
      if (error) throw error;
      return (data ?? []) as { vehicle_id: string; context: string; completed_at: string; odometer_km: number | null }[];
    },
    enabled: !!currentClient?.id,
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
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
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
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
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
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

  const isPanelLoading =
    loadingVehicles || loadingMaintenance || loadingChecklists || loadingDrivers;

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col gap-6 h-full">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">
          Dashboard
        </h1>
      </div>

      {/* Filtro de Período */}
      <div className="flex flex-wrap items-center gap-4 rounded-xl border border-zinc-200 bg-white px-4 py-3 shadow-sm">
        <div className="flex items-center gap-2">
          <CalendarDays className="h-4 w-4 text-zinc-500" />
          <span className="text-sm font-medium text-zinc-700">Período</span>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <label className="text-xs text-zinc-500">De</label>
            <input
              type="date"
              value={dateRange.from}
              max={dateRange.to}
              onChange={(e) => handleDateChange('from', e.target.value)}
              className="rounded-lg border border-zinc-300 bg-zinc-50 px-3 py-1.5 text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-orange-400"
            />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs text-zinc-500">Até</label>
            <input
              type="date"
              value={dateRange.to}
              min={dateRange.from}
              onChange={(e) => handleDateChange('to', e.target.value)}
              className="rounded-lg border border-zinc-300 bg-zinc-50 px-3 py-1.5 text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-orange-400"
            />
          </div>
          <button
            onClick={handleResetToCurrentMonth}
            className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-1.5 text-xs text-zinc-600 hover:bg-zinc-100 transition-colors"
          >
            Mês atual
          </button>
        </div>
      </div>

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
      <div className="flex-1 min-h-0 overflow-y-auto">
        {activeTab === 'operacional' && (
          <OperationalPanel
            vehicles={vehicles}
            maintenanceOrders={maintenanceOrders}
            overdueChecklistVehicleIds={overdueChecklistVehicleIds}
            expiredCrlvCount={expiredCrlvCount}
            expiredCnhCount={expiredCnhCount}
            filters={filters}
            onFiltersChange={setFilters}
            isLoading={isPanelLoading}
          />
        )}
        {activeTab === 'custos' && (
          <CostPanel
            vehicles={vehicles}
            maintenanceOrders={maintenanceOrders}
            checklistRows={checklistRows}
            dateRange={dateRange}
            filters={filters}
            onFiltersChange={setFilters}
            isLoading={isPanelLoading}
          />
        )}
      </div>
    </div>
  );
}
