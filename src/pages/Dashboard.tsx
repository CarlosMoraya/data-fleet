import React, { useState, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { LayoutDashboard, DollarSign, CalendarDays, Activity } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { cn } from '../lib/utils';
import OperationalPanel from '../components/dashboard/OperationalPanel';
import CostPanel from '../components/dashboard/CostPanel';
import OverviewPanel from '../components/dashboard/OverviewPanel';
import type { VehicleRow, DashboardFilters } from '../components/dashboard/OperationalPanel';
import type { MaintenanceOrderDashboard } from '../types/maintenance';
import {
  calculateFleetAvailability,
  countVehiclesInMaintenance,
  calculateChecklistComplianceRate,
  countOverdueMaintenanceOrders,
  countPendingApprovalOrders,
  buildActionQueue,
  calculatePreviousPeriodRange,
  countExpiringSoon,
  mapVehicleIdsToPlates,
  isCrlvExpired,
  getExpiredCrlvPlates,
  getExpiringSoonCrlvPlates,
  getExpiredCnhNames,
  getExpiringSoonCnhNames,
  getExpiringSoonGrPlates,
  getExpiringSoonGrDriverNames,
  getTrailingMonthKeys,
  sumApprovedCostByMonthKeys,
  calculateMovingAverageProjection,
  computeOverdueChecklistVehicleIds,
  type ActionItem,
} from '../lib/dashboardKpi';
import { OPERATIONAL_ACTION_ROUTES } from '../lib/operationalActionRoutes';

type TabType = 'geral' | 'operacional' | 'custos';
const EXPIRING_SOON_WINDOW_DAYS = 30;
const PROJECTION_TRAILING_MONTHS = 3;

const tabs: { id: TabType; label: string; icon: typeof LayoutDashboard }[] = [
  { id: 'geral', label: 'Visão Geral', icon: LayoutDashboard },
  { id: 'operacional', label: 'Operação', icon: Activity },
  { id: 'custos', label: 'Custos', icon: DollarSign },
];

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
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<TabType>('geral');
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
        .select('id, type, crlv_year, crlv_expiration_date, driver_id, license_plate, gr_expiration_date, client_id, shippers(name), operational_units(name)');
      if (currentClient?.id) {
        query = query.eq('client_id', currentClient.id);
      }
      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []).map((row: Record<string, unknown>) => ({
        id: row.id as string,
        type: row.type as string,
        crlv_year: row.crlv_year as string | null,
        crlv_expiration_date: row.crlv_expiration_date != null ? (row.crlv_expiration_date as string) : null,
        driver_id: row.driver_id as string | null,
        client_id: row.client_id as string | null,
        license_plate: row.license_plate != null ? (row.license_plate as string) : null,
        gr_expiration_date: row.gr_expiration_date != null ? (row.gr_expiration_date as string) : null,
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
          .select('id, vehicle_id, type, status, approved_cost, current_km, expected_exit_date, entry_date, actual_exit_date, vehicles(type)')
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
          expected_exit_date: row.expected_exit_date != null ? (row.expected_exit_date as string) : null,
          entry_date: row.entry_date != null ? (row.entry_date as string) : null,
          actual_exit_date: row.actual_exit_date != null ? (row.actual_exit_date as string) : null,
        }));
      },
      enabled: !!user,
      staleTime: 5 * 60 * 1000,
      gcTime: 30 * 60 * 1000,
    });

  const { data: previousMaintenanceOrders = [], isLoading: loadingPreviousMaintenance } = useQuery<
    { approved_cost: number | null }[]
  >({
    queryKey: ['dashboard-maintenance-previous', currentClient?.id, dateRange.from, dateRange.to],
    queryFn: async () => {
      const previous = calculatePreviousPeriodRange(dateRange.from, dateRange.to);
      let query = supabase
        .from('maintenance_orders')
        .select('id, approved_cost')
        .gte('entry_date', previous.from)
        .lte('entry_date', previous.to)
        .neq('status', 'Cancelado');
      if (currentClient?.id) {
        query = query.eq('client_id', currentClient.id);
      }
      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []).map((row: Record<string, unknown>) => ({
        approved_cost: row.approved_cost != null ? Number(row.approved_cost) : null,
      }));
    },
    enabled: !!user,
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  });

  const { data: costProjectionRows = [], isLoading: loadingCostProjection } = useQuery<
    { entry_date: string | null; approved_cost: number | null }[]
  >({
    queryKey: ['dashboard-cost-projection', currentClient?.id],
    queryFn: async () => {
      const keys = getTrailingMonthKeys(today, PROJECTION_TRAILING_MONTHS);
      const inicio = `${keys[0]}-01`;
      const [y, m] = today.substring(0, 7).split('-').map(Number);
      const inicioMesCorrente = `${y}-${String(m).padStart(2, '0')}-01`;
      let query = supabase
        .from('maintenance_orders')
        .select('entry_date, approved_cost')
        .gte('entry_date', inicio)
        .lt('entry_date', inicioMesCorrente)
        .neq('status', 'Cancelado');
      if (currentClient?.id) {
        query = query.eq('client_id', currentClient.id);
      }
      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []).map((row: Record<string, unknown>) => ({
        entry_date: row.entry_date != null ? (row.entry_date as string) : null,
        approved_cost: row.approved_cost != null ? Number(row.approved_cost) : null,
      }));
    },
    enabled: !!user,
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  });

  const { data: activeMaintenanceOrders = [], isLoading: loadingActiveMaintenance } =
    useQuery<MaintenanceOrderDashboard[]>({
      queryKey: ['dashboard-active-maintenance', currentClient?.id],
      queryFn: async () => {
        let query = supabase
          .from('maintenance_orders')
          .select('id, vehicle_id, type, status, approved_cost, current_km, expected_exit_date, entry_date, vehicles(type)')
          .not('status', 'in', '("Concluído","Cancelado")');
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
          expected_exit_date: row.expected_exit_date != null ? (row.expected_exit_date as string) : null,
          entry_date: row.entry_date != null ? (row.entry_date as string) : null,
          actual_exit_date: row.actual_exit_date != null ? (row.actual_exit_date as string) : null,
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
      let query = supabase
        .from('checklists')
        .select('vehicle_id, completed_at, odometer_km, checklist_templates(context)')
        .eq('status', 'completed')
        .not('vehicle_id', 'is', null);
      if (currentClient?.id) {
        query = query.eq('client_id', currentClient.id);
      }
      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []).map((row: Record<string, unknown>) => ({
        vehicle_id: row.vehicle_id as string,
        context:
          row.checklist_templates && typeof row.checklist_templates === 'object' && !Array.isArray(row.checklist_templates)
            ? ((row.checklist_templates as Record<string, unknown>).context as string)
            : Array.isArray(row.checklist_templates) && row.checklist_templates.length > 0
              ? ((row.checklist_templates[0] as Record<string, unknown>).context as string)
              : '',
        completed_at: row.completed_at as string,
        odometer_km: row.odometer_km != null ? Number(row.odometer_km) : null,
      }));
    },
    enabled: !!user,
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  });

  const { data: intervalRows = [], isLoading: loadingIntervals } = useQuery<
    { client_id: string; rotina_day_interval: number | null; seguranca_day_interval: number | null }[]
  >({
    queryKey: ['dashboard-intervals', currentClient?.id],
    queryFn: async () => {
      let query = supabase
        .from('checklist_day_intervals')
        .select('client_id, rotina_day_interval, seguranca_day_interval');
      if (currentClient?.id) {
        query = query.eq('client_id', currentClient.id);
      }
      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as { client_id: string; rotina_day_interval: number | null; seguranca_day_interval: number | null }[];
    },
    enabled: !!user,
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  });

  const intervalsByClient = useMemo(() => {
    const map = new Map<string, { rotina_day_interval: number | null; seguranca_day_interval: number | null }>();
    for (const row of intervalRows) {
      map.set(row.client_id, { rotina_day_interval: row.rotina_day_interval, seguranca_day_interval: row.seguranca_day_interval });
    }
    return map;
  }, [intervalRows]);

  const { data: drivers = [], isLoading: loadingDrivers } = useQuery<
    { id: string; name: string | null; expiration_date: string | null; gr_expiration_date: string | null }[]
  >({
    queryKey: ['dashboard-drivers', currentClient?.id],
    queryFn: async () => {
      let query = supabase
        .from('drivers')
        .select('id, name, expiration_date, gr_expiration_date');
      if (currentClient?.id) {
        query = query.eq('client_id', currentClient.id);
      }
      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as { id: string; name: string | null; expiration_date: string | null; gr_expiration_date: string | null }[];
    },
    enabled: !!user,
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  });

  // ── Computed values ───────────────────────────────────────────────────────

  const overdueChecklistVehicleIds = useMemo(
    () =>
      computeOverdueChecklistVehicleIds({
        vehicles,
        checklistRows,
        intervalsByClient,
        today: new Date(),
      }),
    [vehicles, checklistRows, intervalsByClient]
  );

  const currentYear = new Date().getFullYear().toString();
  const today = new Date().toISOString().split('T')[0];
  const expiredCrlvCount = useMemo(
    () =>
      vehicles.filter((v) => isCrlvExpired(v, currentYear, today)).length,
    [vehicles, currentYear, today]
  );

  const expiredCnhCount = useMemo(
    () =>
      drivers.filter(
        (d) => d.expiration_date !== null && d.expiration_date < today
      ).length,
    [drivers, today]
  );

  // ── Executive KPIs (Visão Geral) ─────────────────────────────────────────

  const vehiclesInMaintenance = useMemo(
    () => countVehiclesInMaintenance(activeMaintenanceOrders, null, vehicles),
    [activeMaintenanceOrders, vehicles]
  );

  const availabilityRate = useMemo(
    () => calculateFleetAvailability(vehicles.length, vehiclesInMaintenance),
    [vehicles.length, vehiclesInMaintenance]
  );

  const openOrdersCount = activeMaintenanceOrders.length;

  const overdueOrdersCount = useMemo(
    () => countOverdueMaintenanceOrders(activeMaintenanceOrders, today),
    [activeMaintenanceOrders, today]
  );

  const pendingApprovalCount = useMemo(
    () => countPendingApprovalOrders(activeMaintenanceOrders),
    [activeMaintenanceOrders]
  );

  const totalApprovedCost = useMemo(
    () =>
      maintenanceOrders
        .filter((o) => o.approved_cost !== null && o.approved_cost > 0)
        .reduce((sum, o) => sum + (o.approved_cost ?? 0), 0),
    [maintenanceOrders]
  );

  const previousPeriodCost = useMemo(
    () =>
      previousMaintenanceOrders
        .filter((o) => o.approved_cost !== null && o.approved_cost > 0)
        .reduce((sum, o) => sum + (o.approved_cost ?? 0), 0),
    [previousMaintenanceOrders]
  );

  const projectedNextMonthCost = useMemo(() => {
    const monthKeys = getTrailingMonthKeys(today, PROJECTION_TRAILING_MONTHS);
    const monthlyTotals = sumApprovedCostByMonthKeys(costProjectionRows, monthKeys);
    return calculateMovingAverageProjection(monthlyTotals);
  }, [today, costProjectionRows]);

  const complianceRate = useMemo(
    () => calculateChecklistComplianceRate(vehicles.length, overdueChecklistVehicleIds.size),
    [vehicles.length, overdueChecklistVehicleIds.size]
  );

  const expiredDocsCount = expiredCrlvCount + expiredCnhCount;

  const plateByVehicleId = useMemo(
    () => new Map(vehicles.map((vehicle) => [vehicle.id, vehicle.license_plate ?? null])),
    [vehicles]
  );

  const expiringSoonDocsCount = useMemo(
    () =>
      countExpiringSoon(drivers.map((driver) => driver.expiration_date), today, EXPIRING_SOON_WINDOW_DAYS) +
      countExpiringSoon(drivers.map((driver) => driver.gr_expiration_date), today, EXPIRING_SOON_WINDOW_DAYS) +
      countExpiringSoon(vehicles.map((vehicle) => vehicle.gr_expiration_date ?? null), today, EXPIRING_SOON_WINDOW_DAYS) +
      countExpiringSoon(vehicles.map((vehicle) => vehicle.crlv_expiration_date ?? null), today, EXPIRING_SOON_WINDOW_DAYS),
    [drivers, today, vehicles]
  );

  const overdueOrderPlates = useMemo(
    () =>
      mapVehicleIdsToPlates(
        activeMaintenanceOrders
          .filter(
            (order) =>
              order.status !== 'Concluído' &&
              order.status !== 'Cancelado' &&
              order.expected_exit_date != null &&
              order.expected_exit_date < today
          )
          .map((order) => order.vehicle_id),
        plateByVehicleId
      ),
    [activeMaintenanceOrders, plateByVehicleId, today]
  );

  const pendingApprovalPlates = useMemo(
    () =>
      mapVehicleIdsToPlates(
        activeMaintenanceOrders
          .filter((order) => order.status === 'Aguardando aprovação')
          .map((order) => order.vehicle_id),
        plateByVehicleId
      ),
    [activeMaintenanceOrders, plateByVehicleId]
  );

  const actionItems = useMemo(
    () =>
      buildActionQueue({
        checklist: mapVehicleIdsToPlates([...overdueChecklistVehicleIds], plateByVehicleId),
        crlv: getExpiredCrlvPlates(vehicles, currentYear, today),
        crlvExpiring: getExpiringSoonCrlvPlates(vehicles, today, EXPIRING_SOON_WINDOW_DAYS),
        cnh: getExpiredCnhNames(drivers, today),
        osOverdue: overdueOrderPlates,
        osPendingApproval: pendingApprovalPlates,
      }),
    [currentYear, drivers, overdueChecklistVehicleIds, overdueOrderPlates, pendingApprovalPlates, plateByVehicleId, today, vehicles]
  );

  const operationalActionItems = useMemo(
    () =>
      buildActionQueue({
        checklist: mapVehicleIdsToPlates([...overdueChecklistVehicleIds], plateByVehicleId),
        crlv: getExpiredCrlvPlates(vehicles, currentYear, today),
        crlvExpiring: getExpiringSoonCrlvPlates(vehicles, today, EXPIRING_SOON_WINDOW_DAYS),
        cnh: getExpiredCnhNames(drivers, today),
        osOverdue: overdueOrderPlates,
        osPendingApproval: pendingApprovalPlates,
        cnhExpiring: getExpiringSoonCnhNames(drivers, today, EXPIRING_SOON_WINDOW_DAYS),
        grVehicleExpiring: getExpiringSoonGrPlates(vehicles, today, EXPIRING_SOON_WINDOW_DAYS),
        grDriverExpiring: getExpiringSoonGrDriverNames(drivers, today, EXPIRING_SOON_WINDOW_DAYS),
      }),
    [currentYear, drivers, overdueChecklistVehicleIds, overdueOrderPlates, pendingApprovalPlates, plateByVehicleId, today, vehicles]
  );

  const handleActionClick = (category: ActionItem['category']) => {
    const routes: Record<ActionItem['category'], string> = {
      checklist: '/checklists',
      crlv: '/cadastros/veiculos',
      crlv_expiring: '/cadastros/veiculos',
      cnh: '/cadastros/motoristas',
      cnh_expiring: '/cadastros/motoristas',
      os_overdue: '/manutencao',
      os_pending_approval: '/manutencao',
      gr_vehicle_expiring: '/cadastros/veiculos',
      gr_driver_expiring: '/cadastros/motoristas',
    };
    navigate(routes[category]);
  };

  const handleOperationalActionClick = (category: ActionItem['category']) => {
    navigate(OPERATIONAL_ACTION_ROUTES[category]);
  };

  // ── Loading state ─────────────────────────────────────────────────────────

  const isPanelLoading =
    loadingVehicles ||
    loadingMaintenance ||
    loadingActiveMaintenance ||
    loadingPreviousMaintenance ||
    loadingCostProjection ||
    loadingChecklists ||
    loadingIntervals ||
    loadingDrivers;

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
        {activeTab === 'geral' && (
          <OverviewPanel
            totalVehicles={vehicles.length}
            vehiclesInMaintenance={vehiclesInMaintenance}
            availabilityRate={availabilityRate}
            openOrdersCount={openOrdersCount}
            overdueOrdersCount={overdueOrdersCount}
            pendingApprovalCount={pendingApprovalCount}
            totalApprovedCost={totalApprovedCost}
            complianceRate={complianceRate}
            expiredDocsCount={expiredDocsCount}
            expiringSoonDocsCount={expiringSoonDocsCount}
            actionItems={actionItems}
            onActionClick={handleActionClick}
            isLoading={isPanelLoading}
          />
        )}
        {activeTab === 'operacional' && (
          <OperationalPanel
            vehicles={vehicles}
            maintenanceOrders={maintenanceOrders}
            activeMaintenanceOrders={activeMaintenanceOrders}
            overdueChecklistVehicleIds={overdueChecklistVehicleIds}
            expiredCrlvCount={expiredCrlvCount}
            expiredCnhCount={expiredCnhCount}
            overdueOrdersCount={overdueOrdersCount}
            expiringSoonDocsCount={expiringSoonDocsCount}
            actionItems={operationalActionItems}
            filters={filters}
            onFiltersChange={setFilters}
            onActionClick={handleOperationalActionClick}
            isLoading={isPanelLoading}
          />
        )}
        {activeTab === 'custos' && (
          <CostPanel
            vehicles={vehicles}
            maintenanceOrders={maintenanceOrders}
            previousPeriodCost={previousPeriodCost}
            projectedNextMonthCost={projectedNextMonthCost}
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
