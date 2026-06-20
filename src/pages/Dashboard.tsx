import React, { useMemo, Suspense } from 'react';
import { useAuth } from '../context/AuthContext';
import { useUiPreference, usePersistentTabState, usePersistentFilterState } from '../hooks/usePersistentUiState';
import { LayoutDashboard, DollarSign, Activity, LineChart, ShieldCheck } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { cn } from '../lib/utils';
import OperationalPanel from '../components/dashboard/OperationalPanel';
import CostPanel from '../components/dashboard/CostPanel';
import OverviewPanel from '../components/dashboard/OverviewPanel';
import ConformityPanel from '../components/dashboard/ConformityPanel';
import PeriodRangeFilter from '../components/dashboard/PeriodRangeFilter';
import RouteFallback from '../components/RouteFallback';
import type { VehicleRow } from '../components/dashboard/OperationalPanel';
import type { MaintenanceOrderDashboard } from '../types/maintenance';
import {
  buildComplianceActionQueue,
  calculateFleetAvailability,
  countVehiclesInMaintenance,
  calculateChecklistComplianceRate,
  calculateDocumentaryComplianceRate,
  countOverdueMaintenanceOrders,
  countPendingApprovalOrders,
  calculateInsuranceCoverageRate,
  calculateTrackerCoverageRate,
  buildOperationalActionQueue,
  mapVehicleIdsToPlates,
  getDriversMissingCnhUploadNames,
  getDriversWithVehicleMissingGrNames,
  getExpiredGrDriverNames,
  getExpiredGrVehiclePlates,
  countVehiclesWithoutDriver,
  getVehiclesWithoutDriverPlates,
  countOpenOrders,
  getEndOfWeekIso,
  countActiveOrdersExitingByEndOfWeek,
  getActiveOrdersExitingByEndOfWeekVehicleIds,
  getActiveOrdersDueWithinDaysVehicleIds,
  getPendingBudgetVehicleIds,
  getTrailingMonthKeys,
  countIrregularDrivers,
  countIrregularVehicles,
  computeOverdueChecklistVehicleIds,
  getExpiredCnhNames,
  getExpiredCrlvPlates,
  getExpiringSoonCnhNames,
  getExpiringSoonCrlvPlates,
  getExpiringSoonGrDriverNames,
  getExpiringSoonGrPlates,
  getVehiclesMissingCrlvUploadPlates,
  getVehiclesMissingGrPlates,
  getVehiclesMissingInsurancePlates,
  getVehiclesMissingMaintenanceContractPlates,
  resolveHorizonRange,
  type ComplianceActionCategory,
  type ComplianceActionItem,
  type CostDashboardFilters,
  type OperationalActionItem,
  type OperationalActionCategory,
  type HorizonOption,
  type BudgetItemForCost,
} from '../lib/dashboardKpi';
import { COMPLIANCE_ACTION_ROUTES, OPERATIONAL_QUEUE_ROUTES } from '../lib/actionQueueRoutes';

const EvolutionPanel = React.lazy(() => import('../components/dashboard/EvolutionPanel'));

type TabType = 'geral' | 'operacional' | 'conformidade' | 'custos' | 'evolucao';
const PROJECTION_TRAILING_MONTHS = 3;

const tabs: { id: TabType; label: string; icon: typeof LayoutDashboard }[] = [
  { id: 'geral', label: 'Visão Geral', icon: LayoutDashboard },
  { id: 'operacional', label: 'Operação', icon: Activity },
  { id: 'conformidade', label: 'Conformidade', icon: ShieldCheck },
  { id: 'custos', label: 'Custos', icon: DollarSign },
  { id: 'evolucao', label: 'Evolução', icon: LineChart },
];

const EXPIRING_SOON_WINDOW_DAYS = 30;

function getDefaultDateRange() {
  const now = new Date();
  const from = new Date(now.getFullYear(), now.getMonth(), 1)
    .toISOString().split('T')[0];
  const to = new Date(now.getFullYear(), now.getMonth() + 1, 0)
    .toISOString().split('T')[0];
  return { from, to };
}

const DEFAULT_COST_FILTERS: CostDashboardFilters = {
  category: null,
  model: null,
  shipper: null,
  operationalUnit: null,
  maintenanceType: null,
};

export default function Dashboard() {
  const { currentClient, user } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = usePersistentTabState('dashboard', 'active', 'geral');
  const [costFilters, setCostFilters] = usePersistentFilterState<CostDashboardFilters>(
    'dashboard',
    'cost-filters',
    DEFAULT_COST_FILTERS,
  );

  const [dateRange, setDateRange] = useUiPreference<{ from: string; to: string }>(
    'dashboard',
    'filter',
    'date-range',
    getDefaultDateRange(),
    { legacyKeys: ['dashboard_date_filter'] },
  );
  const [horizon, setHorizon] = useUiPreference<HorizonOption>('dashboard', 'filter', 'evolution-horizon', '6m');
  const currentMonthRange = useMemo(() => getDefaultDateRange(), []);
  const today = new Date().toISOString().split('T')[0];
  const evolutionRange = useMemo(() => resolveHorizonRange(horizon, today), [horizon, today]);

  // ── Queries ──────────────────────────────────────────────────────────────

  const { data: vehicles = [], isLoading: loadingVehicles } = useQuery<VehicleRow[]>({
    queryKey: ['dashboard-vehicles', currentClient?.id],
    queryFn: async () => {
      let query = supabase
        .from('vehicles')
        .select('id, type, crlv_year, crlv_expiration_date, driver_id, license_plate, gr_expiration_date, client_id, category, brand, model, acquisition, crlv_upload, gr_upload, insurance_policy_upload, has_insurance, has_maintenance_contract, maintenance_contract_upload, tracker, shippers(name), operational_units(name)');
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
        category: row.category != null ? (row.category as string) : null,
        brand: row.brand != null ? (row.brand as string) : null,
        model: row.model != null ? (row.model as string) : null,
        acquisition: row.acquisition != null ? (row.acquisition as string) : null,
        crlv_upload: row.crlv_upload != null ? (row.crlv_upload as string) : null,
        gr_upload: row.gr_upload != null ? (row.gr_upload as string) : null,
        insurance_policy_upload: row.insurance_policy_upload != null ? (row.insurance_policy_upload as string) : null,
        has_insurance: row.has_insurance != null ? Boolean(row.has_insurance) : null,
        has_maintenance_contract: row.has_maintenance_contract != null ? Boolean(row.has_maintenance_contract) : null,
        maintenance_contract_upload: row.maintenance_contract_upload != null ? (row.maintenance_contract_upload as string) : null,
        tracker: row.tracker != null ? (row.tracker as string) : null,
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

  const { data: drivers = [], isLoading: loadingDrivers } = useQuery<{
    id: string;
    name: string | null;
    expiration_date: string | null;
    gr_expiration_date: string | null;
    cnh_upload: string | null;
    gr_upload: string | null;
  }[]>({
    queryKey: ['dashboard-drivers', currentClient?.id],
    queryFn: async () => {
      let query = supabase
        .from('drivers')
        .select('id, name, expiration_date, gr_expiration_date, cnh_upload, gr_upload');
      if (currentClient?.id) {
        query = query.eq('client_id', currentClient.id);
      }
      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []).map((row: Record<string, unknown>) => ({
        id: row.id as string,
        name: row.name != null ? (row.name as string) : null,
        expiration_date: row.expiration_date != null ? (row.expiration_date as string) : null,
        gr_expiration_date: row.gr_expiration_date != null ? (row.gr_expiration_date as string) : null,
        cnh_upload: row.cnh_upload != null ? (row.cnh_upload as string) : null,
        gr_upload: row.gr_upload != null ? (row.gr_upload as string) : null,
      }));
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

  const { data: currentMonthOrders = [], isLoading: loadingCurrentMonthOrders } =
    useQuery<MaintenanceOrderDashboard[]>({
      queryKey: ['dashboard-maintenance-current-month', currentClient?.id],
      queryFn: async () => {
        let query = supabase
          .from('maintenance_orders')
          .select('id, vehicle_id, type, status, approved_cost, current_km, expected_exit_date, entry_date, actual_exit_date, vehicles(type)')
          .gte('entry_date', currentMonthRange.from)
          .lte('entry_date', currentMonthRange.to)
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

  const { data: projectionSourceOrders = [], isLoading: loadingProjectionSource } =
    useQuery<MaintenanceOrderDashboard[]>({
    queryKey: ['dashboard-maintenance-projection-source', currentClient?.id],
    queryFn: async () => {
      const keys = getTrailingMonthKeys(today, PROJECTION_TRAILING_MONTHS);
      const inicio = `${keys[0]}-01`;
      const [y, m] = today.substring(0, 7).split('-').map(Number);
      const inicioMesCorrente = `${y}-${String(m).padStart(2, '0')}-01`;
      let query = supabase
        .from('maintenance_orders')
        .select('id, vehicle_id, type, status, approved_cost, entry_date')
        .gte('entry_date', inicio)
        .lt('entry_date', inicioMesCorrente)
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
        current_km: null,
        vehicle_type: null,
        expected_exit_date: null,
        entry_date: row.entry_date != null ? (row.entry_date as string) : null,
        actual_exit_date: null,
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

  const { data: checklistRows = [], isLoading: loadingLastChecklists } = useQuery<
    { vehicle_id: string; context: string; completed_at: string }[]
  >({
    queryKey: ['dashboard-last-checklists', currentClient?.id],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('dashboard_last_checklist_per_vehicle', {
        p_client_id: currentClient?.id ?? null,
      });
      if (error) throw error;
      return (data ?? []).map((row: Record<string, unknown>) => ({
        vehicle_id: row.vehicle_id as string,
        context: (row.context as string) ?? '',
        completed_at: row.completed_at as string,
      }));
    },
    enabled: !!user,
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  });

  const { data: openActionPlans = [], isLoading: loadingActionPlans } = useQuery<
    { id: string; vehicle_id: string | null; status: string }[]
  >({
    queryKey: ['dashboard-action-plans-open', currentClient?.id],
    queryFn: async () => {
      let query = supabase
        .from('action_plans')
        .select('id, vehicle_id, status')
        .in('status', ['pending', 'in_progress', 'awaiting_conclusion']);
      if (currentClient?.id) {
        query = query.eq('client_id', currentClient.id);
      }
      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []).map((row: Record<string, unknown>) => ({
        id: row.id as string,
        vehicle_id: row.vehicle_id != null ? (row.vehicle_id as string) : null,
        status: row.status as string,
      }));
    },
    enabled: !!user,
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  });

  const { data: vehicleKmRows = [], isLoading: loadingVehicleKm } = useQuery<
    { vehicle_id: string; km_driven: number }[]
  >({
    queryKey: ['dashboard-vehicle-km', currentClient?.id, dateRange.from, dateRange.to],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('dashboard_vehicle_km_in_period', {
        p_client_id: currentClient?.id ?? null,
        p_from: dateRange.from,
        p_to: dateRange.to,
      });
      if (error) throw error;
      return (data ?? []).map((row: Record<string, unknown>) => ({
        vehicle_id: row.vehicle_id as string,
        km_driven: Number(row.km_driven ?? 0),
      }));
    },
    enabled: !!user,
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  });

  const { data: budgetItems = [] } = useQuery<BudgetItemForCost[]>({
    queryKey: ['dashboard-budget-items', currentClient?.id, dateRange.from, dateRange.to],
    queryFn: async () => {
      let query = supabase
        .from('maintenance_budget_items')
        .select('maintenance_order_id, system, value, maintenance_orders!inner(entry_date, status, client_id)')
        .gte('maintenance_orders.entry_date', dateRange.from)
        .lte('maintenance_orders.entry_date', dateRange.to)
        .neq('maintenance_orders.status', 'Cancelado');
      if (currentClient?.id) {
        query = query.eq('maintenance_orders.client_id', currentClient.id);
      }
      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []).map((row: Record<string, unknown>) => ({
        maintenance_order_id: row.maintenance_order_id as string,
        system: row.system != null ? (row.system as string) : null,
        value: row.value != null ? Number(row.value) : 0,
      }));
    },
    enabled: !!user && activeTab === 'custos',
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

  const { data: evolutionOrders = [], isLoading: loadingEvolution } =
    useQuery<MaintenanceOrderDashboard[]>({
      queryKey: ['dashboard-evolution', currentClient?.id, evolutionRange.from, evolutionRange.to],
      queryFn: async () => {
        let query = supabase
          .from('maintenance_orders')
          .select('id, vehicle_id, type, status, approved_cost, current_km, expected_exit_date, entry_date, actual_exit_date, vehicles(type)')
          .neq('status', 'Cancelado')
          .or(`and(entry_date.gte.${evolutionRange.from},entry_date.lte.${evolutionRange.to}),and(actual_exit_date.gte.${evolutionRange.from},actual_exit_date.lte.${evolutionRange.to})`);
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
      enabled: !!user && activeTab === 'evolucao',
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

  const currentYear = today.slice(0, 4);

  const driverIdsWithVehicle = useMemo(
    () => new Set(vehicles.filter((vehicle) => vehicle.driver_id).map((vehicle) => vehicle.driver_id as string)),
    [vehicles]
  );

  const crlvExpired = useMemo(
    () => getExpiredCrlvPlates(vehicles, currentYear, today),
    [vehicles, currentYear, today]
  );

  const cnhExpired = useMemo(
    () => getExpiredCnhNames(drivers, today),
    [drivers, today]
  );

  const grVehicleExpired = useMemo(
    () => getExpiredGrVehiclePlates(vehicles, today),
    [vehicles, today]
  );

  const grDriverExpired = useMemo(
    () => getExpiredGrDriverNames(drivers, today),
    [drivers, today]
  );

  const crlvExpiring = useMemo(
    () => getExpiringSoonCrlvPlates(vehicles, today, EXPIRING_SOON_WINDOW_DAYS),
    [vehicles, today]
  );

  const cnhExpiring = useMemo(
    () => getExpiringSoonCnhNames(drivers, today, EXPIRING_SOON_WINDOW_DAYS),
    [drivers, today]
  );

  const grVehicleExpiring = useMemo(
    () => getExpiringSoonGrPlates(vehicles, today, EXPIRING_SOON_WINDOW_DAYS),
    [vehicles, today]
  );

  const grDriverExpiring = useMemo(
    () => getExpiringSoonGrDriverNames(drivers, today, EXPIRING_SOON_WINDOW_DAYS),
    [drivers, today]
  );

  const crlvMissing = useMemo(
    () => getVehiclesMissingCrlvUploadPlates(vehicles),
    [vehicles]
  );

  const cnhMissing = useMemo(
    () => getDriversMissingCnhUploadNames(drivers),
    [drivers]
  );

  const grVehicleMissing = useMemo(
    () => getVehiclesMissingGrPlates(vehicles),
    [vehicles]
  );

  const grDriverMissing = useMemo(
    () => getDriversWithVehicleMissingGrNames(drivers, driverIdsWithVehicle),
    [drivers, driverIdsWithVehicle]
  );

  const insuranceMissing = useMemo(
    () => getVehiclesMissingInsurancePlates(vehicles),
    [vehicles]
  );

  const maintenanceContractMissing = useMemo(
    () => getVehiclesMissingMaintenanceContractPlates(vehicles),
    [vehicles]
  );

  const complianceActionItems = useMemo<ComplianceActionItem[]>(
    () => buildComplianceActionQueue({
      crlvExpired,
      cnhExpired,
      grVehicleExpired,
      grDriverExpired,
      crlvExpiring,
      cnhExpiring,
      grVehicleExpiring,
      grDriverExpiring,
      crlvMissing,
      cnhMissing,
      grVehicleMissing,
      grDriverMissing,
      insuranceMissing,
      maintenanceContractMissing,
    }),
    [
      cnhExpired,
      cnhExpiring,
      cnhMissing,
      crlvExpired,
      crlvExpiring,
      crlvMissing,
      grDriverExpired,
      grDriverExpiring,
      grDriverMissing,
      grVehicleExpired,
      grVehicleExpiring,
      grVehicleMissing,
      insuranceMissing,
      maintenanceContractMissing,
    ]
  );

  const expiredDocumentsCount = useMemo(
    () => crlvExpired.length + cnhExpired.length + grVehicleExpired.length + grDriverExpired.length,
    [crlvExpired.length, cnhExpired.length, grVehicleExpired.length, grDriverExpired.length]
  );

  const expiringDocumentsCount = useMemo(
    () => crlvExpiring.length + cnhExpiring.length + grVehicleExpiring.length + grDriverExpiring.length,
    [crlvExpiring.length, cnhExpiring.length, grVehicleExpiring.length, grDriverExpiring.length]
  );

  const missingDocumentsCount = useMemo(
    () => crlvMissing.length + cnhMissing.length + grVehicleMissing.length + grDriverMissing.length + insuranceMissing.length + maintenanceContractMissing.length,
    [crlvMissing.length, cnhMissing.length, grVehicleMissing.length, grDriverMissing.length, insuranceMissing.length, maintenanceContractMissing.length]
  );

  const criticalItemsCount = useMemo(
    () => expiredDocumentsCount + missingDocumentsCount,
    [expiredDocumentsCount, missingDocumentsCount]
  );

  const irregularVehiclesCount = useMemo(
    () => countIrregularVehicles(vehicles, currentYear, today, EXPIRING_SOON_WINDOW_DAYS),
    [vehicles, currentYear, today]
  );

  const irregularDriversCount = useMemo(
    () => countIrregularDrivers(drivers, driverIdsWithVehicle, today, EXPIRING_SOON_WINDOW_DAYS),
    [drivers, driverIdsWithVehicle, today]
  );

  const documentaryComplianceRate = useMemo(
    () => calculateDocumentaryComplianceRate(vehicles.length + drivers.length, irregularVehiclesCount + irregularDriversCount),
    [vehicles.length, drivers.length, irregularVehiclesCount, irregularDriversCount]
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

  const unavailableVehicles = vehiclesInMaintenance;

  const availableVehicles = useMemo(
    () => Math.max(0, vehicles.length - vehiclesInMaintenance),
    [vehicles.length, vehiclesInMaintenance]
  );

  const overdueOrdersCount = useMemo(
    () => countOverdueMaintenanceOrders(activeMaintenanceOrders, today),
    [activeMaintenanceOrders, today]
  );

  const insuranceCoverageRate = useMemo(
    () => calculateInsuranceCoverageRate(vehicles),
    [vehicles]
  );

  const trackerCoverageRate = useMemo(
    () => calculateTrackerCoverageRate(vehicles),
    [vehicles]
  );

  const totalApprovedCost = useMemo(
    () =>
      currentMonthOrders
        .filter((o) => o.approved_cost !== null && o.approved_cost > 0)
        .reduce((sum, o) => sum + (o.approved_cost ?? 0), 0),
    [currentMonthOrders]
  );

  const complianceRate = useMemo(
    () => calculateChecklistComplianceRate(vehicles.length, overdueChecklistVehicleIds.size),
    [vehicles.length, overdueChecklistVehicleIds.size]
  );

  const plateByVehicleId = useMemo(
    () => new Map(vehicles.map((vehicle) => [vehicle.id, vehicle.license_plate ?? null])),
    [vehicles]
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

  const endOfWeekIso = useMemo(() => getEndOfWeekIso(today), [today]);

  const vehiclesWithoutDriverCount = useMemo(
    () => countVehiclesWithoutDriver(vehicles),
    [vehicles]
  );

  const openOrdersCount = useMemo(
    () => countOpenOrders(activeMaintenanceOrders),
    [activeMaintenanceOrders]
  );

  const exitByEndOfWeekCount = useMemo(
    () => countActiveOrdersExitingByEndOfWeek(activeMaintenanceOrders, today, endOfWeekIso),
    [activeMaintenanceOrders, today, endOfWeekIso]
  );

  const pendingApprovalCount = useMemo(
    () => countPendingApprovalOrders(activeMaintenanceOrders),
    [activeMaintenanceOrders]
  );

  const unavailableVehiclePlates = useMemo(
    () => mapVehicleIdsToPlates([...new Set(activeMaintenanceOrders.map((order) => order.vehicle_id))], plateByVehicleId),
    [activeMaintenanceOrders, plateByVehicleId]
  );

  const operationalActionItems = useMemo<OperationalActionItem[]>(
    () =>
      buildOperationalActionQueue({
        vehiclesUnavailable: unavailableVehiclePlates,
        vehiclesNoDriver: getVehiclesWithoutDriverPlates(vehicles),
        osOverdue: overdueOrderPlates,
        checklistOverdue: mapVehicleIdsToPlates([...overdueChecklistVehicleIds], plateByVehicleId),
        osExitThisWeek: mapVehicleIdsToPlates(
          getActiveOrdersExitingByEndOfWeekVehicleIds(activeMaintenanceOrders, today, endOfWeekIso),
          plateByVehicleId
        ),
        osPendingApproval: pendingApprovalPlates,
        osPendingBudget: mapVehicleIdsToPlates(
          getPendingBudgetVehicleIds(activeMaintenanceOrders),
          plateByVehicleId
        ),
        actionPlansOpen: mapVehicleIdsToPlates(
          openActionPlans.map((plan) => plan.vehicle_id).filter(Boolean) as string[],
          plateByVehicleId
        ),
        osDueSoon: mapVehicleIdsToPlates(
          getActiveOrdersDueWithinDaysVehicleIds(activeMaintenanceOrders, today, 7),
          plateByVehicleId
        ),
      }),
    [
      activeMaintenanceOrders,
      endOfWeekIso,
      openActionPlans,
      overdueChecklistVehicleIds,
      overdueOrderPlates,
      pendingApprovalPlates,
      plateByVehicleId,
      today,
      unavailableVehiclePlates,
      vehicles,
    ]
  );

  const handleOperationalActionClick = (category: OperationalActionCategory) => {
    navigate(OPERATIONAL_QUEUE_ROUTES[category]);
  };

  const handleComplianceActionClick = (category: ComplianceActionCategory) => {
    navigate(COMPLIANCE_ACTION_ROUTES[category]);
  };

  const handleViewVehicleHistory = (plate: string) => {
    navigate(`/manutencao?placa=${encodeURIComponent(plate)}`);
  };

  // ── Loading state ─────────────────────────────────────────────────────────

  const isPanelLoading =
    loadingVehicles ||
    loadingDrivers ||
    loadingMaintenance ||
    loadingCurrentMonthOrders ||
    loadingActiveMaintenance ||
    loadingProjectionSource ||
    loadingLastChecklists ||
    loadingActionPlans ||
    loadingVehicleKm ||
    loadingIntervals;

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col gap-6 h-full">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">
          Dashboard
        </h1>
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
            vehicles={vehicles}
            totalVehicles={vehicles.length}
            availableVehicles={availableVehicles}
            unavailableVehicles={unavailableVehicles}
            availabilityRate={availabilityRate}
            totalApprovedCost={totalApprovedCost}
            complianceRate={complianceRate}
            trackerCoverageRate={trackerCoverageRate}
            insuranceCoverageRate={insuranceCoverageRate}
            isLoading={isPanelLoading}
          />
        )}
        {activeTab === 'operacional' && (
          <OperationalPanel
            unavailableVehiclesCount={unavailableVehicles}
            vehiclesWithoutDriverCount={vehiclesWithoutDriverCount}
            openOrdersCount={openOrdersCount}
            overdueOrdersCount={overdueOrdersCount}
            exitByEndOfWeekCount={exitByEndOfWeekCount}
            pendingApprovalCount={pendingApprovalCount}
            overdueChecklistsCount={overdueChecklistVehicleIds.size}
            openActionPlansCount={openActionPlans.length}
            actionItems={operationalActionItems}
            onActionClick={handleOperationalActionClick}
            isLoading={isPanelLoading}
          />
        )}
        {activeTab === 'conformidade' && (
          <ConformityPanel
            documentaryComplianceRate={documentaryComplianceRate}
            expiredDocumentsCount={expiredDocumentsCount}
            expiringDocumentsCount={expiringDocumentsCount}
            missingDocumentsCount={missingDocumentsCount}
            irregularVehiclesCount={irregularVehiclesCount}
            irregularDriversCount={irregularDriversCount}
            criticalItemsCount={criticalItemsCount}
            actionItems={complianceActionItems}
            onActionClick={handleComplianceActionClick}
            isLoading={isPanelLoading}
          />
        )}
        {activeTab === 'custos' && (
          <div className="space-y-6">
            <PeriodRangeFilter
              value={dateRange}
              onChange={setDateRange}
              onReset={() => setDateRange(getDefaultDateRange())}
            />
            <CostPanel
              vehicles={vehicles}
              maintenanceOrders={maintenanceOrders}
              currentMonthOrders={currentMonthOrders}
              projectionSourceOrders={projectionSourceOrders}
              vehicleKmRows={vehicleKmRows}
              dateRange={dateRange}
              filters={costFilters}
              onFiltersChange={setCostFilters}
              onResetFilters={() => setCostFilters(DEFAULT_COST_FILTERS)}
              isLoading={isPanelLoading}
              budgetItems={budgetItems}
              onViewVehicleHistory={handleViewVehicleHistory}
            />
          </div>
        )}
        {activeTab === 'evolucao' && (
          <Suspense fallback={<RouteFallback />}>
            <EvolutionPanel
              orders={evolutionOrders}
              horizon={horizon}
              onHorizonChange={setHorizon}
              dateRange={evolutionRange}
              isLoading={loadingEvolution}
            />
          </Suspense>
        )}
      </div>
    </div>
  );
}
