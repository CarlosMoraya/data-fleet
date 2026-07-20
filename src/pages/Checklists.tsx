import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ClipboardCheck, ClipboardList, Play, Eye, Trash2, Truck, Loader2, Search, User, AlertCircle, AlertTriangle, Disc, Gauge, MapPinOff } from 'lucide-react';
import React, { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

import ChecklistDetailModal from '../components/ChecklistDetailModal';
import CreateActionPlanModal from '../components/CreateActionPlanModal';
import LastKmLabel from '../components/LastKmLabel';
import ChecklistMapLink from '../components/ChecklistMapLink';
import SelectClientNotice from '../components/SelectClientNotice';
import TireInspectionDetailModal from '../components/TireInspectionDetailModal';
import VehicleLinkDivergenceModal from '../components/VehicleLinkDivergenceModal';
import { useAuth } from '../context/AuthContext';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import { usePersistentTabState, usePersistentFilterState, useSessionUiState } from '../hooks/usePersistentUiState';
import { checklistFromRow, type ChecklistRow } from '../lib/checklistMappers';
import { AUDITOR_ONLY_CONTEXTS, requiresHandoverEvidence, filterTemplatesByContext, filterVehiclesForContext } from '../lib/checklistContextRules';
import { getChecklistStartBlockMessage, getTireInspectionStartBlockMessage } from '../lib/checklistStartGuard';
import { templateFromRow, type ChecklistTemplateRow } from '../lib/checklistTemplateMappers';
import { requiresClientSelection, showsAggregatedData } from '../lib/clientScope';
import { supabase } from '../lib/supabase';
import { tireInspectionFromRow, type TireInspectionRow } from '../lib/tireInspectionMappers';
import { safeParseJson } from '../lib/uiStateStorage';
import { cn } from '../lib/utils';
import {
  hasVehicleLinkDivergence,
  buildVehicleLinkDivergenceMessage,
  buildVehicleLinkBlockedMessage,
  resolveDefaultVehicleId,
  type SelectableVehicle,
  type VehicleLinkDivergence,
} from '../lib/vehicleLinkDivergence';
import {
  validateTireInspectionEligibility,
  createTireInspection,
  findOpenTireInspection,
} from '../services/tireInspectionService';
import { getVehicleLastKmMap, type VehicleLastKmInfo } from '../services/vehicleOdometerService';
import { ODOMETER_UPDATE_CONTEXT } from '../types';

import type { Checklist, ChecklistContext, ChecklistTemplate, TireInspection, AxleConfigEntry } from '../types';
import type { VehicleStatus } from '../types/vehicle';

const STATUS_LABEL: Record<string, string> = { in_progress: 'Em andamento', completed: 'Concluído' };
const STATUS_COLOR: Record<string, string> = {
  in_progress: 'bg-yellow-100 text-yellow-800',
  completed: 'bg-green-100 text-green-800',
};

export function isValidChecklistTab(value: unknown): value is 'checklists' | 'tireInspections' {
  return value === 'checklists' || value === 'tireInspections';
}

function isValidHistoryStatusFilter(value: unknown): value is 'all' | 'in_progress' | 'completed' {
  return value === 'all' || value === 'in_progress' || value === 'completed';
}

export function getStoredChecklistTab(raw: string | null): 'checklists' | 'tireInspections' {
  if (raw === null) return 'checklists';
  const parsed = safeParseJson<string>(raw, raw);
  return isValidChecklistTab(parsed) ? parsed : 'checklists';
}

export function isOdometerUpdateChecklist(checklist: Pick<Checklist, 'templateContext'>): boolean {
  return checklist.templateContext === ODOMETER_UPDATE_CONTEXT;
}

export default function Checklists() {
  const { user, currentClient, clients } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const blockWrite = requiresClientSelection(user?.role, currentClient?.id);

  const isDriver = user?.role === 'Driver';
  const isAuditor = user?.role === 'Yard Auditor';
  const isDriverOrAuditor = isDriver || isAuditor;
  const isAssistantPlus = ['Fleet Assistant', 'Fleet Analyst', 'Supervisor', 'Manager', 'Coordinator', 'Director', 'Admin Master'].includes(user?.role ?? '');
  const isAnalystPlus = ['Fleet Analyst', 'Supervisor', 'Manager', 'Coordinator', 'Director', 'Admin Master'].includes(user?.role ?? '');
  const isAdminMaster = user?.role === 'Admin Master';

  const [activeTab, setActiveTab] = usePersistentTabState('checklists', 'active', 'checklists', {
    legacyKeys: ['checklists:activeTab'],
    validator: isValidChecklistTab,
  });
  const [historySearch, setHistorySearch] = usePersistentFilterState('checklists', 'history-search', '');
  const [historyStatusFilter, setHistoryStatusFilter] = usePersistentFilterState<'all' | 'in_progress' | 'completed'>(
    'checklists', 'history-status', 'all', { validator: isValidHistoryStatusFilter },
  );
  const [onlyWithIssues, setOnlyWithIssues] = useSessionUiState<boolean>(
    'checklists', 'filter', 'only-with-issues', false,
  );
  const [onlyOdometer, setOnlyOdometer] = useSessionUiState<boolean>(
    'checklists', 'filter', 'only-odometer', false,
  );
  const [selectedVehicleId, setSelectedVehicleId] = useSessionUiState<string>(
    'checklists', 'selection', 'auditor-vehicle', '',
  );

  // Local UI state
  const [starting, setStarting] = useState<string | null>(null);
  const [viewChecklist, setViewChecklist] = useState<Checklist | null>(null);
  const [viewTireInspection, setViewTireInspection] = useState<TireInspection | null>(null);
  const [createPlanChecklist, setCreatePlanChecklist] = useState<Checklist | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Checklist | null>(null);
  const [tireInspectionError, setTireInspectionError] = useState<string | null>(null);
  const [startingTireInspection, setStartingTireInspection] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);
  const isOnline = useOnlineStatus();

  const [divergenceModal, setDivergenceModal] = useState<{
    message: string;
    blocked: boolean;
    onConfirm: () => void;
  } | null>(null);

  const [driverSelectedVehicleId, setDriverSelectedVehicleId] = useSessionUiState<string>(
    'checklists', 'selection', 'driver-vehicle', '',
  );

  type DriverRecord = { id: string; client_id: string };
  type DriverVehicleRow = { id: string; license_plate: string | null; category: string | null };
  type AuditorVehicleRow = {
    id: string;
    license_plate: string | null;
    category: string | null;
    status: string | null;
    drivers: Array<{ profiles: Array<{ name: string | null }> | null }> | null;
  };
  type UnassignedDriverRow = { id: string; name: string };
  type VehicleDriverIdRow = { driver_id: string | null };
  type IssueChecklistIdRow = { checklist_id: string };
  type DayIntervalRow = { pneus_day_interval: number | null };
  type StartedChecklistRow = { id: string };
  type SelectableVehicleRow = {
    id: string;
    license_plate: string | null;
    category: string | null;
    status: string | null;
    is_assigned_to_me: boolean;
    has_other_driver: boolean;
  };
  type EnforceLinkRow = { enforce_driver_vehicle_link: boolean };
  type DivergenceEvalRow = {
    reasons: string[] | null;
    assigned_driver_id: string | null;
    executor_vehicle_id: string | null;
    executor_vehicle_plate: string | null;
  };
  type TireInspectionConfigRpcRow = {
    axle_config: AxleConfigEntry[] | null;
    steps_count: number | null;
    vehicle_type: string | null;
  };

  // ── Queries for Driver ────────────────────────────────────────────────────
  const { data: vehicleInfo, isLoading: loadingVehicleInfo } = useQuery({
    queryKey: ['driverVehicle', user?.id, currentClient?.id],
    queryFn: async () => {
      const { data: driverRec } = await supabase
        .from('drivers')
        .select('id, client_id')
        .eq('profile_id', user!.id)
        .eq('client_id', currentClient!.id)
        .maybeSingle();

      const driver = driverRec as DriverRecord | null;
      if (!driver) return null;

      const { data: vehicleData } = await supabase
        .from('vehicles')
        .select('id, license_plate, category')
        .eq('driver_id', driver.id)
        .eq('client_id', driver.client_id)
        .maybeSingle();

      const vehicle = vehicleData as DriverVehicleRow | null;
      return vehicle ? { id: vehicle.id, plate: vehicle.license_plate, category: vehicle.category } : null;
    },
    enabled: isDriver && !!user?.id && !!currentClient?.id
  });

  const { data: driverSelectableVehicles = [], isError: driverVehiclesError } = useQuery({
    queryKey: ['driverSelectableVehicles', currentClient?.id],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('list_vehicles_for_checklist_selection');
      if (error) {
        console.error(error);
        throw error;
      }
      return ((data ?? []) as SelectableVehicleRow[]).map((v): SelectableVehicle => ({
        id: v.id,
        licensePlate: v.license_plate ?? '',
        category: v.category,
        status: v.status,
        isAssignedToMe: v.is_assigned_to_me,
        hasOtherDriver: v.has_other_driver,
      }));
    },
    enabled: isDriver && !!currentClient?.id,
    staleTime: 0,
  });

  useEffect(() => {
    if (!isDriver) return;
    if (driverSelectableVehicles.length === 0) return;
    const stillValid = driverSelectableVehicles.some(v => v.id === driverSelectedVehicleId);
    if (driverSelectedVehicleId && stillValid) return;
    setDriverSelectedVehicleId(resolveDefaultVehicleId(driverSelectableVehicles));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [driverSelectableVehicles]);

  const selectedDriverVehicle = useMemo(
    () => driverSelectableVehicles.find(v => v.id === driverSelectedVehicleId),
    [driverSelectableVehicles, driverSelectedVehicleId],
  );

  const { data: enforceDriverVehicleLink = false } = useQuery({
    queryKey: ['enforceDriverVehicleLink', currentClient?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('checklist_day_intervals')
        .select('enforce_driver_vehicle_link')
        .eq('client_id', currentClient!.id)
        .maybeSingle();
      return (data as EnforceLinkRow | null)?.enforce_driver_vehicle_link ?? false;
    },
    enabled: isDriver && !!currentClient?.id,
  });

  const { data: publishedTemplates = [] } = useQuery({
    queryKey: ['publishedTemplates', selectedDriverVehicle?.category, currentClient?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('checklist_templates')
        .select('*')
        .eq('client_id', currentClient!.id)
        .eq('vehicle_category', selectedDriverVehicle!.category)
        .eq('status', 'published')
        .not('context', 'in', `(${AUDITOR_ONLY_CONTEXTS.join(',')})`)
        .order('context');
      return (data ?? []).map(r => templateFromRow(r as ChecklistTemplateRow));
    },
    enabled: isDriver && !!selectedDriverVehicle?.category && !!currentClient?.id,
    // Templates publicados devem refletir imediatamente: ignorar o cache persistido
    // (o staleTime global de 3 min + persister em localStorage atrasava a aparição
    // de templates recém-publicados, exigindo refresh repetido pelo usuário).
    staleTime: 0,
  });

  // ── Queries for Auditor ───────────────────────────────────────────────────
  const { data: auditorVehicles = [] } = useQuery({
    queryKey: ['auditorVehicles', currentClient?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('vehicles')
        .select('id, license_plate, category, status, driver_id, drivers(profiles!profile_id(name))')
        .eq('client_id', currentClient!.id)
        .order('license_plate');

      const rows = (data ?? []) as AuditorVehicleRow[];
      return rows.map((v) => ({
        id: v.id,
        plate: v.license_plate,
        category: v.category,
        status: v.status as VehicleStatus | null,
        driverName: v.drivers?.[0]?.profiles?.[0]?.name ?? null,
      }));
    },
    enabled: isAuditor && !!currentClient?.id
  });

  const [selectedContext, setSelectedContext] = useSessionUiState<ChecklistContext | ''>(
    'checklists', 'selection', 'auditor-context', '',
  );

  const filteredAuditorVehicles = useMemo(
    () => filterVehiclesForContext(auditorVehicles, selectedContext || undefined),
    [auditorVehicles, selectedContext],
  );

  const selectedAuditorVehicle = useMemo(() =>
    auditorVehicles.find(v => v.id === selectedVehicleId),
    [auditorVehicles, selectedVehicleId]
  );

  const { data: auditorTemplates = [] } = useQuery({
    queryKey: ['auditorTemplates', selectedAuditorVehicle?.category, currentClient?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('checklist_templates')
        .select('*')
        .eq('client_id', currentClient!.id)
        .eq('vehicle_category', selectedAuditorVehicle!.category)
        .in('context', AUDITOR_ONLY_CONTEXTS)
        .eq('status', 'published');
      return (data ?? []).map(r => templateFromRow(r as ChecklistTemplateRow));
    },
    enabled: isAuditor && !!selectedAuditorVehicle?.category && !!currentClient?.id,
    // Templates publicados devem refletir imediatamente: ignorar o cache persistido
    // (o staleTime global de 3 min + persister em localStorage atrasava a aparição
    // de templates recém-publicados de auditoria, exigindo refresh repetido pelo Auditor).
    staleTime: 0,
  });

  const contextFilteredAuditorTemplates = useMemo(
    () => filterTemplatesByContext(auditorTemplates, selectedContext || undefined),
    [auditorTemplates, selectedContext],
  );

  const [selectedDriverId, setSelectedDriverId] = useSessionUiState<string>(
    'checklists', 'selection', 'auditor-driver', '',
  );

  const { data: unassignedDrivers = [] } = useQuery({
    queryKey: ['unassignedDrivers', currentClient?.id],
    queryFn: async () => {
      const [driversRes, vehiclesRes] = await Promise.all([
        supabase.from('drivers').select('id, name')
          .eq('client_id', currentClient!.id).eq('active', true).order('name'),
        supabase.from('vehicles').select('driver_id')
          .eq('client_id', currentClient!.id).not('driver_id', 'is', null),
      ]);
      const assigned = new Set((vehiclesRes.data as VehicleDriverIdRow[] ?? []).map(v => v.driver_id));
      return ((driversRes.data as UnassignedDriverRow[]) ?? []).filter(d => !assigned.has(d.id));
    },
    enabled: isAuditor && !!currentClient?.id,
    staleTime: 0,
  });

  // ── Shared Queries (Driver/Auditor/History) ────────────────────────────────
  const { data: openChecklist } = useQuery({
    queryKey: ['openChecklist', user?.id, currentClient?.id],
    queryFn: async () => {
      const response = await supabase
        .from('checklists')
        .select('*, vehicles!vehicle_id(license_plate), profiles(name), checklist_templates(name, context), drivers!driver_id(name), assigned_driver:drivers!vehicle_link_assigned_driver_id(name), executor_vehicle:vehicles!vehicle_link_executor_vehicle_id(license_plate)')
        .eq('client_id', currentClient!.id)
        .eq('filled_by', user!.id)
        .eq('status', 'in_progress')
        .order('started_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      const data = response.data as ChecklistRow | null;
      return data ? checklistFromRow(data as ChecklistRow) : null;
    },
    enabled: isDriverOrAuditor && !!user?.id && !!currentClient?.id
  });

  const { data: checklists = [], isLoading: loadingChecklists } = useQuery({
    queryKey: ['checklists', currentClient?.id ?? 'all-clients', isDriverOrAuditor ? user?.id : 'all'],
    queryFn: async () => {
      let query = supabase
        .from('checklists')
        .select('*, vehicles!vehicle_id(license_plate), profiles(name), checklist_templates(name, context), drivers!driver_id(name), assigned_driver:drivers!vehicle_link_assigned_driver_id(name), executor_vehicle:vehicles!vehicle_link_executor_vehicle_id(license_plate)')
        .order('started_at', { ascending: false });

      if (currentClient?.id) {
        query = query.eq('client_id', currentClient.id);
      }

      if (isDriverOrAuditor) {
        query = query.eq('filled_by', user!.id).limit(50);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []).map(r => checklistFromRow(r as ChecklistRow));
    },
    enabled: showsAggregatedData(user?.role, currentClient?.id),
    // Checklists recém-preenchidos por motoristas devem refletir imediatamente: ignorar o cache
    // persistido (o staleTime global de 3 min atrasava a aparição na tela do Assistente+).
    staleTime: 0,
  });

  const checklistVehicleIds = useMemo(
    () => Array.from(new Set(checklists.map((c) => c.vehicleId).filter((id): id is string => !!id))),
    [checklists],
  );

  const { data: checklistLastKmMap = new Map<string, VehicleLastKmInfo>() } = useQuery({
    queryKey: ['vehicleLastKmMap', 'checklists', checklistVehicleIds],
    queryFn: () => getVehicleLastKmMap(checklistVehicleIds),
    enabled: checklistVehicleIds.length > 0,
  });

  // Query for issues (inconformidades) - mainly for Assistant+
  const { data: rawIssueChecklistIds = [] } = useQuery<string[]>({
    queryKey: ['checklistIssues', currentClient?.id],
    queryFn: async () => {
      if (!isAssistantPlus || checklists.length === 0) return [];
      
      const ids = checklists.map(r => r.id);
      const { data } = await supabase
        .from('checklist_responses')
        .select('checklist_id')
        .in('checklist_id', ids)
        .eq('status', 'issue');
      
      const rows = (data ?? []) as IssueChecklistIdRow[];
      return rows.map((r) => r.checklist_id);
    },
    enabled: isAssistantPlus && checklists.length > 0
  });

  const issueChecklistIds = useMemo(
    () => new Set(Array.isArray(rawIssueChecklistIds) ? rawIssueChecklistIds : []),
    [rawIssueChecklistIds]
  );

  // ── Tire inspection queries ───────────────────────────────────────────────
  const { data: tireInspections = [] } = useQuery({
    queryKey: ['tireInspections', currentClient?.id ?? 'all-clients'],
    queryFn: async () => {
      let query = supabase
        .from('tire_inspections')
        .select('*, vehicles!vehicle_id(license_plate), profiles(name), assigned_driver:drivers!vehicle_link_assigned_driver_id(name), executor_vehicle:vehicles!vehicle_link_executor_vehicle_id(license_plate)')
        .order('started_at', { ascending: false });
      if (currentClient?.id) {
        query = query.eq('client_id', currentClient.id);
      }
      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []).map(r => tireInspectionFromRow(r as TireInspectionRow));
    },
    enabled: showsAggregatedData(user?.role, currentClient?.id),
  });

  const { data: pneusDayInterval = 7 } = useQuery({
    queryKey: ['pneusDayInterval', currentClient?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('checklist_day_intervals')
        .select('pneus_day_interval')
        .eq('client_id', currentClient!.id)
        .maybeSingle();
      const interval = data as DayIntervalRow | null;
      return interval?.pneus_day_interval ?? 7;
    },
    enabled: !!currentClient?.id,
  });

  const startTireInspectionMutation = useMutation({
    mutationFn: async (vehicleId: string) => {
      const openId = await findOpenTireInspection(vehicleId);
      if (openId) return openId;

      const { data: veh, error: vehErr } = await supabase.rpc('get_vehicle_tire_inspection_config', {
        p_vehicle_id: vehicleId,
      });
      if (vehErr) throw vehErr;

      const vehicle = ((veh ?? []) as TireInspectionConfigRpcRow[])[0];
      const axleConfig = vehicle?.axle_config ?? [];
      const stepsCount = vehicle?.steps_count ?? 0;
      const vehicleType = vehicle?.vehicle_type ?? '';

      await validateTireInspectionEligibility(vehicleId, axleConfig, stepsCount, vehicleType, pneusDayInterval);

      return createTireInspection({
        clientId: currentClient!.id,
        vehicleId,
        filledBy: user!.id,
        axleConfig,
        stepsCount,
        deviceInfo: navigator.userAgent,
      });
    },
    onSuccess: (inspectionId) => {
      void queryClient.invalidateQueries({ queryKey: ['tireInspections', currentClient?.id] });
      setStartingTireInspection(false);
      void navigate(`/inspecao-pneus/${inspectionId}`);
    },
    onError: (e: Error) => {
      setTireInspectionError(
        e.message?.includes('VEHICLE_LINK_DIVERGENCE_BLOCKED')
          ? 'A sua empresa exige que o checklist seja feito no veículo vinculado a você. Selecione outro veículo.'
          : e.message,
      );
      setStartingTireInspection(false);
    },
  });

  const handleStartTireInspection = (vehicleId: string) => {
    const block = getTireInspectionStartBlockMessage(isOnline);
    if (block) {
      setTireInspectionError(block);
      return;
    }
    setTireInspectionError(null);
    setStartingTireInspection(true);
    startTireInspectionMutation.mutate(vehicleId);
  };

  const checkVehicleLinkDivergence = async (
    vehicleId: string,
    onError: (message: string) => void,
    proceed: () => void,
  ) => {
    try {
      const { data, error } = await supabase.rpc('evaluate_vehicle_link_divergence', {
        p_vehicle_id: vehicleId,
        p_profile_id: user!.id,
      });
      if (error) throw error;

      const row = ((data ?? []) as DivergenceEvalRow[])[0];
      const divergence: VehicleLinkDivergence = {
        reasons: (row?.reasons ?? []) as VehicleLinkDivergence['reasons'],
        executorVehiclePlate: row?.executor_vehicle_plate ?? undefined,
      };

      if (!hasVehicleLinkDivergence(divergence)) {
        proceed();
        return;
      }

      if (enforceDriverVehicleLink) {
        setDivergenceModal({
          message: buildVehicleLinkBlockedMessage(divergence),
          blocked: true,
          onConfirm: () => {},
        });
      } else {
        setDivergenceModal({
          message: buildVehicleLinkDivergenceMessage(divergence),
          blocked: false,
          onConfirm: () => {
            setDivergenceModal(null);
            proceed();
          },
        });
      }
    } catch (err) {
      console.error(err);
      onError('Não foi possível validar o veículo selecionado. Tente novamente.');
    }
  };

  const handleDriverStartChecklist = (template: ChecklistTemplate) => {
    if (!selectedDriverVehicle) return;
    const block = getChecklistStartBlockMessage(isOnline);
    if (block) {
      setStartError(block);
      return;
    }
    setStartError(null);
    void checkVehicleLinkDivergence(selectedDriverVehicle.id, setStartError, () => {
      setStarting(template.id);
      startMutation.mutate({ template, vehicleId: selectedDriverVehicle.id });
    });
  };

  const handleDriverStartTireInspection = (vehicleId: string) => {
    const block = getTireInspectionStartBlockMessage(isOnline);
    if (block) {
      setTireInspectionError(block);
      return;
    }
    setTireInspectionError(null);
    void checkVehicleLinkDivergence(vehicleId, setTireInspectionError, () => {
      setStartingTireInspection(true);
      startTireInspectionMutation.mutate(vehicleId);
    });
  };

  const startMutation = useMutation({
    mutationFn: async ({ template, vehicleId, driverId }: { template: ChecklistTemplate; vehicleId: string; driverId?: string }) => {
      const response = await supabase
        .from('checklists')
        .insert({
          client_id: currentClient!.id,
          template_id: template.id,
          version_number: template.currentVersion,
          vehicle_id: vehicleId,
          filled_by: user!.id,
          status: 'in_progress',
          device_info: navigator.userAgent,
          driver_id: driverId ?? null,
        })
        .select()
        .single();
      const data = response.data as StartedChecklistRow | null;
      const error = response.error;
      if (error) throw error;
      if (!data) throw new Error('Checklist não retornado após criação.');
      return data;
    },
    onSuccess: (data) => {
      void queryClient.invalidateQueries({ queryKey: ['openChecklist', user?.id, currentClient?.id] });
      void queryClient.invalidateQueries({ queryKey: ['checklists', currentClient?.id] });
      setStarting(null);
      void navigate(`/checklists/preencher/${data.id}`);
    },
    onError: (err: Error) => {
      console.error(err);
      setStarting(null);
      if (err.message?.includes('VEHICLE_LINK_DIVERGENCE_BLOCKED')) {
        setStartError('A sua empresa exige que o checklist seja feito no veículo vinculado a você. Selecione outro veículo.');
      }
    },
  });

  const startChecklist = (template: ChecklistTemplate, vehicleId?: string, driverId?: string) => {
    if (!vehicleId) return;
    const block = getChecklistStartBlockMessage(isOnline);
    if (block) {
      setStartError(block);
      return;
    }
    setStartError(null);
    setStarting(template.id);
    startMutation.mutate({ template, vehicleId, driverId });
  };

  const deleteMutation = useMutation({
    mutationFn: async (checklist: Checklist) => {
      const { error } = await supabase.from('checklists').delete().eq('id', checklist.id);
      if (error) throw error;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['checklists', currentClient?.id] });
      void queryClient.invalidateQueries({ queryKey: ['openChecklist', user?.id, currentClient?.id] });
      setConfirmDelete(null);
    },
  });

  const handleDelete = () => {
    if (!confirmDelete) return;
    deleteMutation.mutate(confirmDelete);
  };

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });

  const filteredHistory = useMemo(() => {
    return checklists.filter(c => {
      if (historyStatusFilter !== 'all' && c.status !== historyStatusFilter) return false;
      if (historySearch.trim()) {
        const q = historySearch.toLowerCase();
        if (!(c.templateName ?? '').toLowerCase().includes(q) && !(c.templateContext ?? '').toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [checklists, historyStatusFilter, historySearch]);

  const isLoading = loadingVehicleInfo || loadingChecklists;

  const clientNameMap = useMemo(() => {
    const map = new Map<string, string>();
    clients.forEach(c => map.set(c.id, c.name));
    return map;
  }, [clients]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-orange-500" />
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-zinc-900">
            <ClipboardCheck className="h-6 w-6 text-orange-500" />
            Checklists
          </h1>
          <p className="mt-1 text-sm text-zinc-500">
            {isDriverOrAuditor ? 'Inicie ou continue um checklist' : 'Histórico de inspeções do tenant'}
          </p>
        </div>
      </div>

      {/* ── Driver view ─────────────────────────────── */}
      {isDriver && (
        <div className="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto">
          {openChecklist && (
            <div className="flex items-center gap-4 rounded-2xl border border-orange-200 bg-orange-50 p-4">
              <ClipboardCheck className="h-8 w-8 flex-shrink-0 text-orange-500" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-orange-800">Checklist em andamento</p>
                <p className="truncate text-xs text-orange-600">
                  {openChecklist.templateContext && <span className="font-medium">{openChecklist.templateContext} · </span>}
                  {openChecklist.templateName} — {formatDate(openChecklist.startedAt)}
                </p>
              </div>
              <div className="flex flex-shrink-0 items-center gap-2">
                <button
                  onClick={() => setConfirmDelete(openChecklist)}
                  className="flex items-center gap-1.5 rounded-xl border border-red-200 px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50"
                  title="Cancelar checklist em andamento"
                >
                  <Trash2 className="h-4 w-4" />
                  Cancelar
                </button>
                <button
                  onClick={() => { void navigate(`/checklists/preencher/${openChecklist.id}`); }}
                  className="flex items-center gap-1.5 rounded-xl bg-orange-500 px-4 py-2 text-sm font-medium text-white hover:bg-orange-600"
                >
                  <Play className="h-4 w-4" />
                  Continuar
                </button>
              </div>
            </div>
          )}

          <div className="rounded-2xl border border-zinc-200 bg-white p-5">
            <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-zinc-700">
              <Truck className="h-4 w-4 text-orange-500" />
              Meu veículo
            </h2>
            {driverVehiclesError ? (
              <p className="text-sm text-red-600">Não foi possível carregar a lista de veículos. Tente novamente.</p>
            ) : driverSelectableVehicles.length > 0 ? (
              <>
                <div className="mb-4">
                  <label className="mb-1 block text-xs font-medium text-zinc-500">Veículo</label>
                  <select
                    value={driverSelectedVehicleId}
                    onChange={e => setDriverSelectedVehicleId(e.target.value)}
                    className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:ring-2 focus:ring-orange-400 focus:outline-none"
                  >
                    {driverSelectableVehicles.map(v => (
                      <option key={v.id} value={v.id}>
                        {v.licensePlate}{v.category ? ` (${v.category})` : ''}{v.isAssignedToMe ? ' — seu veículo' : ''}
                      </option>
                    ))}
                  </select>
                </div>
                {publishedTemplates.length > 0 ? (
                  <div className="space-y-2">
                    {publishedTemplates.map(t => (
                      <div key={t.id} className="flex items-center justify-between gap-3 rounded-xl border border-zinc-100 p-3 hover:bg-zinc-50">
                        <div>
                          <p className="text-sm font-medium text-zinc-900">{t.name}</p>
                          <p className="text-xs text-zinc-500">{t.context}</p>
                        </div>
                        <button
                          disabled={!!openChecklist || starting === t.id}
                          onClick={() => handleDriverStartChecklist(t)}
                          className="flex items-center gap-1.5 rounded-lg bg-orange-500 px-3 py-2 text-xs font-medium text-white hover:bg-orange-600 disabled:opacity-50"
                        >
                          {starting === t.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Play className="h-3 w-3" />}
                          Iniciar
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-zinc-400 italic">Nenhum template publicado para {selectedDriverVehicle?.category ?? 'esta categoria'}</p>
                )}

                {startError && (
                  <p className="mt-2 text-xs text-red-600">{startError}</p>
                )}
                {/* Inspeção de Pneus */}
                {tireInspectionError && (
                  <p className="mt-2 text-xs text-red-600">{tireInspectionError}</p>
                )}
                <div className="mt-3 border-t border-zinc-100 pt-3">
                  <button
                    disabled={startingTireInspection || !!openChecklist || !driverSelectedVehicleId}
                    onClick={() => handleDriverStartTireInspection(driverSelectedVehicleId)}
                    className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-blue-300 px-3 py-2 text-xs font-medium text-blue-600 hover:bg-blue-50 disabled:opacity-50"
                  >
                    {startingTireInspection ? <Loader2 className="h-3 w-3 animate-spin" /> : <Disc className="h-3 w-3" />}
                    Inspeção de Pneus
                  </button>
                </div>
              </>
            ) : (
              <p className="text-sm text-zinc-400 italic">Nenhum veículo associado ao seu perfil.</p>
            )}
          </div>

          <HistoryCard
            checklists={filteredHistory}
            historySearch={historySearch}
            setHistorySearch={setHistorySearch}
            historyStatusFilter={historyStatusFilter}
            setHistoryStatusFilter={setHistoryStatusFilter}
            onView={setViewChecklist}
            formatDate={formatDate}
          />
        </div>
      )}

      {/* ── Auditor view ─────────────────────────────── */}
      {isAuditor && (
        <div className="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto">
          {openChecklist && (
            <div className="flex items-center gap-4 rounded-2xl border border-orange-200 bg-orange-50 p-4">
              <ClipboardCheck className="h-8 w-8 flex-shrink-0 text-orange-500" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-orange-800">Checklist em andamento</p>
                <p className="truncate text-xs text-orange-600">
                  {openChecklist.templateContext && <span className="font-medium">{openChecklist.templateContext} · </span>}
                  {openChecklist.templateName} — {formatDate(openChecklist.startedAt)}
                </p>
              </div>
              <button
                onClick={() => { void navigate(`/checklists/preencher/${openChecklist.id}`); }}
                className="flex flex-shrink-0 items-center gap-1.5 rounded-xl bg-orange-500 px-4 py-2 text-sm font-medium text-white hover:bg-orange-600"
              >
                <Play className="h-4 w-4" />
                Continuar
              </button>
              <button
                onClick={() => setConfirmDelete(openChecklist)}
                className="flex flex-shrink-0 items-center gap-1.5 rounded-xl border border-red-200 px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50"
                title="Cancelar checklist em andamento"
              >
                <Trash2 className="h-4 w-4" />
                Cancelar
              </button>
            </div>
          )}

          <div className="space-y-4 rounded-2xl border border-zinc-200 bg-white p-5">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-zinc-700">
              <Truck className="h-4 w-4 text-orange-500" />
              Iniciar Checklist
            </h2>

            <div>
              <label className="mb-1 block text-xs font-medium text-zinc-500">Selecionar contexto</label>
              <select
                value={selectedContext}
                onChange={e => setSelectedContext(e.target.value as ChecklistContext | '')}
                className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:ring-2 focus:ring-orange-400 focus:outline-none"
              >
                <option value="">— Selecione um contexto —</option>
                {AUDITOR_ONLY_CONTEXTS.map(ctx => (
                  <option key={ctx} value={ctx}>{ctx}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-zinc-500">Selecionar veículo</label>
              <select
                value={selectedVehicleId}
                onChange={e => setSelectedVehicleId(e.target.value)}
                className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:ring-2 focus:ring-orange-400 focus:outline-none"
              >
                <option value="">— Selecione um veículo —</option>
                {filteredAuditorVehicles.map(v => (
                  <option key={v.id} value={v.id}>{v.plate}{v.category ? ` (${v.category})` : ''}</option>
                ))}
              </select>
            </div>

            {selectedAuditorVehicle && (
              <div className="flex items-center gap-2 rounded-lg border border-zinc-100 bg-zinc-50 px-3 py-2">
                <User className="h-4 w-4 flex-shrink-0 text-zinc-400" />
                <span className="text-sm text-zinc-700">
                  Motorista: <strong>{selectedAuditorVehicle.driverName ?? 'Sem motorista'}</strong>
                </span>
              </div>
            )}

            {requiresHandoverEvidence(selectedContext || undefined) && (
              <div>
                <label className="mb-1 block text-xs font-medium text-zinc-500">Motorista da entrega/devolução</label>
                <select
                  value={selectedDriverId}
                  onChange={e => setSelectedDriverId(e.target.value)}
                  className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:ring-2 focus:ring-orange-400 focus:outline-none"
                >
                  <option value="">— Selecione um motorista —</option>
                  {unassignedDrivers.map(d => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
                </select>
              </div>
            )}

            {selectedVehicleId && contextFilteredAuditorTemplates.length === 0 && (
              <p className="py-2 text-center text-sm text-zinc-400 italic">
                Nenhum template publicado para {selectedAuditorVehicle?.category ?? 'esta categoria'}.
              </p>
            )}

            {contextFilteredAuditorTemplates.length > 0 && (
              <div className="space-y-2">
                {contextFilteredAuditorTemplates.map(t => (
                  <div key={t.id} className="flex items-center justify-between gap-3 rounded-xl border border-zinc-100 p-3 hover:bg-zinc-50">
                    <div>
                      <p className="text-sm font-medium text-zinc-900">{t.name}</p>
                      <p className="text-xs text-zinc-500">{t.context}</p>
                    </div>
                    <button
                      disabled={!!openChecklist || starting === t.id || (requiresHandoverEvidence(selectedContext || undefined) && !selectedDriverId)}
                      onClick={() => startChecklist(t, selectedVehicleId, selectedDriverId || undefined)}
                      className="flex items-center gap-1.5 rounded-lg bg-orange-500 px-3 py-2 text-xs font-medium text-white hover:bg-orange-600 disabled:opacity-50"
                    >
                      {starting === t.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Play className="h-3 w-3" />}
                      Iniciar
                    </button>
                  </div>
                ))}
              </div>
            )}

            {startError && (
              <p className="mt-2 text-xs text-red-600">{startError}</p>
            )}
            {/* Inspeção de Pneus — Auditor */}
            {selectedVehicleId && (
              <div className="space-y-1 border-t border-zinc-100 pt-2">
                {tireInspectionError && (
                  <p className="text-xs text-red-600">{tireInspectionError}</p>
                )}
                <button
                  disabled={startingTireInspection || !!openChecklist}
                  onClick={() => handleStartTireInspection(selectedVehicleId)}
                  className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-blue-300 px-3 py-2 text-xs font-medium text-blue-600 hover:bg-blue-50 disabled:opacity-50"
                >
                  {startingTireInspection ? <Loader2 className="h-3 w-3 animate-spin" /> : <Disc className="h-3 w-3" />}
                  Inspeção de Pneus
                </button>
              </div>
            )}
          </div>

          <HistoryCard
            checklists={filteredHistory}
            historySearch={historySearch}
            setHistorySearch={setHistorySearch}
            historyStatusFilter={historyStatusFilter}
            setHistoryStatusFilter={setHistoryStatusFilter}
            onView={setViewChecklist}
            formatDate={formatDate}
          />
        </div>
      )}

      {/* ── Fleet Assistant+ view ─────────────────────────────── */}
      {isAssistantPlus && (
        <div className="flex min-h-0 flex-1 flex-col gap-4">
          {blockWrite && <SelectClientNotice />}
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-zinc-200 bg-white">
            <div className="border-b border-zinc-200 px-4">
              <nav role="tablist" className="-mb-px flex gap-1">
                <button
                  type="button"
                  role="tab"
                  aria-selected={activeTab === 'checklists'}
                  onClick={() => setActiveTab('checklists')}
                  className={cn(
                    activeTab === 'checklists'
                      ? 'border-orange-500 font-medium text-orange-700'
                      : 'border-transparent text-zinc-500 hover:border-zinc-300 hover:text-zinc-700',
                    'flex items-center border-b-2 px-4 py-3 text-sm whitespace-nowrap transition-colors',
                  )}
                >
                  Checklists
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={activeTab === 'tireInspections'}
                  onClick={() => setActiveTab('tireInspections')}
                  className={cn(
                    activeTab === 'tireInspections'
                      ? 'border-orange-500 font-medium text-orange-700'
                      : 'border-transparent text-zinc-500 hover:border-zinc-300 hover:text-zinc-700',
                    'flex items-center border-b-2 px-4 py-3 text-sm whitespace-nowrap transition-colors',
                  )}
                >
                  Inspeções de Pneus
                </button>
              </nav>
            </div>

            {activeTab === 'checklists' && (
              <>
                <div className="flex items-center gap-2 border-b border-zinc-100 px-4 py-3">
                  <button
                    onClick={() => setOnlyWithIssues(false)}
                    className={cn(
                      'rounded-full px-3 py-1.5 text-xs font-medium transition-colors',
                      !onlyWithIssues ? 'bg-zinc-700 text-white' : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200',
                    )}
                  >
                    Todos
                  </button>
                  <button
                    onClick={() => setOnlyWithIssues(true)}
                    className={cn(
                      'flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors',
                      onlyWithIssues ? 'bg-red-500 text-white' : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200',
                    )}
                  >
                    <AlertCircle className="h-3 w-3" />
                    Com inconformidades
                    {issueChecklistIds.size > 0 && (
                      <span>({issueChecklistIds.size})</span>
                    )}
                  </button>
                  <button
                    onClick={() => setOnlyOdometer(v => !v)}
                    className={cn(
                      'flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors',
                      onlyOdometer ? 'bg-sky-500 text-white' : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200',
                    )}
                  >
                    <Gauge className="h-3 w-3" />
                    Hodômetro
                  </button>
                </div>

                {checklists.length === 0 ? (
                  <div className="py-16 text-center text-zinc-400">
                    <ClipboardCheck className="mx-auto mb-3 h-12 w-12 opacity-30" />
                    <p className="text-sm">{blockWrite ? 'Nenhum checklist realizado em nenhum cliente.' : 'Nenhum checklist realizado neste tenant.'}</p>
                  </div>
                ) : (
                  <div className="flex-1 overflow-auto">
                    <table className="min-w-full divide-y divide-zinc-100">
                      <thead className="sticky top-0 z-10 bg-zinc-50">
                        <tr>
                          {[...(blockWrite ? ['Cliente'] : []), 'Template', 'Contexto', 'Veículo', 'Preenchido por', 'Data', 'Status', 'Ações'].map(h => (
                            <th key={h} className="px-4 py-3 text-left text-xs font-semibold tracking-wider text-zinc-500 uppercase">
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-50">
                        {checklists
                          .filter(c => !onlyWithIssues || issueChecklistIds.has(c.id))
                          .filter(c => !onlyOdometer || isOdometerUpdateChecklist(c))
                          .map(c => (
                            <tr key={c.id} className="hover:bg-zinc-50">
                              {blockWrite && (
                                <td className="px-4 py-3 text-sm text-zinc-600">
                                  <span className="inline-flex items-center rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-700">
                                    {c.clientId ? (clientNameMap.get(c.clientId) ?? '—') : '—'}
                                  </span>
                                </td>
                              )}
                              <td className="px-4 py-3 text-sm text-zinc-900">
                                <div className="flex items-center gap-1.5">
                                  {issueChecklistIds.has(c.id) && (
                                    <span title="Contém inconformidades">
                                      <AlertCircle className="h-3.5 w-3.5 flex-shrink-0 text-red-400" />
                                    </span>
                                  )}
                                  {c.templateName ?? '—'}
                                </div>
                              </td>
                              <td className="px-4 py-3 text-xs text-zinc-500">{c.templateContext ?? '—'}</td>
                              <td className="px-4 py-3 text-sm text-zinc-600">
                                {c.vehicleLicensePlate ? (
                                  <>
                                    <div>{c.vehicleLicensePlate}</div>
                                    <LastKmLabel
                                      info={c.vehicleId ? checklistLastKmMap.get(c.vehicleId) : undefined}
                                      className="text-xs text-zinc-400"
                                    />
                                    <ChecklistMapLink latitude={c.latitude} longitude={c.longitude} />
                                    {c.locationStatus === 'denied' && (
                                      <span
                                        className="mt-1 inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700"
                                        title="Localização negada pelo motorista — possível tentativa de burlar o processo"
                                      >
                                        <MapPinOff className="h-3 w-3" />
                                        Localização negada
                                      </span>
                                    )}
                                    {c.vehicleLinkDivergenceReasons && (
                                      <span
                                        className="mt-1 inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700"
                                        title="Divergência de vínculo — abra o registro para ver o motorista vinculado"
                                      >
                                        <AlertTriangle className="h-3 w-3" />
                                        Divergência de vínculo
                                      </span>
                                    )}
                                  </>
                                ) : '—'}
                              </td>
                              <td className="px-4 py-3 text-sm text-zinc-600">{c.filledByName ?? '—'}</td>
                              <td className="px-4 py-3 text-xs text-zinc-500">{formatDate(c.startedAt)}</td>
                              <td className="px-4 py-3">
                                <span className={cn('rounded-full px-2 py-0.5 text-xs font-medium', STATUS_COLOR[c.status])}>
                                  {STATUS_LABEL[c.status]}
                                </span>
                              </td>
                              <td className="px-4 py-3">
                                <div className="flex items-center gap-1">
                                  <button onClick={() => setViewChecklist(c)} className="rounded p-1.5 hover:bg-zinc-100" title="Visualizar">
                                    <Eye className="h-4 w-4 text-zinc-400" />
                                  </button>
                                  {isAnalystPlus && c.status === 'completed' && issueChecklistIds.has(c.id) && !blockWrite && (
                                    <button
                                      onClick={() => setCreatePlanChecklist(c)}
                                      className="rounded p-1.5 text-orange-400 hover:bg-orange-50"
                                      title="Criar Plano de Ação"
                                    >
                                      <ClipboardList className="h-4 w-4" />
                                    </button>
                                  )}
                                  {isAdminMaster && (
                                    <button
                                      onClick={() => setConfirmDelete(c)}
                                      className="rounded p-1.5 text-red-400 hover:bg-red-50"
                                      title="Excluir (Admin Master)"
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </button>
                                  )}
                                </div>
                              </td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </>
            )}

            {activeTab === 'tireInspections' && (
              tireInspections.length === 0 ? (
                <div className="py-16 text-center text-zinc-400">
                  <Disc className="mx-auto mb-3 h-12 w-12 opacity-30" />
                  <p className="text-sm">{blockWrite ? 'Nenhuma inspeção de pneus registrada em nenhum cliente.' : 'Nenhuma inspeção de pneus registrada neste tenant.'}</p>
                </div>
              ) : (
                <div className="flex-1 overflow-auto">
                  <table className="min-w-full divide-y divide-zinc-100">
                    <thead className="sticky top-0 z-10 bg-zinc-50">
                      <tr>
                        {[...(blockWrite ? ['Cliente'] : []), 'Veículo', 'Inspetor', 'Início', 'Conclusão', 'Status', 'Ações'].map(h => (
                          <th key={h} className="px-4 py-3 text-left text-xs font-semibold tracking-wider text-zinc-500 uppercase">
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-50">
                      {tireInspections.map(ti => (
                        <tr key={ti.id} className="hover:bg-zinc-50">
                          {blockWrite && (
                            <td className="px-4 py-3 text-sm text-zinc-600">
                              <span className="inline-flex items-center rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-700">
                                {ti.clientId ? (clientNameMap.get(ti.clientId) ?? '—') : '—'}
                              </span>
                            </td>
                          )}
                          <td className="px-4 py-3 text-sm text-zinc-900">
                            <div className="flex items-center gap-1.5">
                              <Disc className="h-3.5 w-3.5 flex-shrink-0 text-blue-400" />
                              {ti.vehicleLicensePlate ?? '—'}
                            </div>
                            {ti.vehicleLinkDivergenceReasons && (
                              <span
                                className="mt-1 inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700"
                                title="Divergência de vínculo — abra o registro para ver o motorista vinculado"
                              >
                                <AlertTriangle className="h-3 w-3" />
                                Divergência de vínculo
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-sm text-zinc-600">{ti.filledByName ?? '—'}</td>
                          <td className="px-4 py-3 text-xs text-zinc-500">{formatDate(ti.startedAt)}</td>
                          <td className="px-4 py-3 text-xs text-zinc-500">{ti.completedAt ? formatDate(ti.completedAt) : '—'}</td>
                          <td className="px-4 py-3">
                            <span className={cn('rounded-full px-2 py-0.5 text-xs font-medium', STATUS_COLOR[ti.status])}>
                              {STATUS_LABEL[ti.status]}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <button onClick={() => setViewTireInspection(ti)} className="rounded p-1.5 hover:bg-zinc-100" title="Visualizar">
                              <Eye className="h-4 w-4 text-zinc-400" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )
            )}
          </div>
        </div>
      )}

      {divergenceModal && (
        <VehicleLinkDivergenceModal
          message={divergenceModal.message}
          blocked={divergenceModal.blocked}
          onConfirm={divergenceModal.onConfirm}
          onCancel={() => setDivergenceModal(null)}
        />
      )}

      {viewChecklist && (
        <ChecklistDetailModal checklist={viewChecklist} onClose={() => setViewChecklist(null)} />
      )}

      {viewTireInspection && (
        <TireInspectionDetailModal inspection={viewTireInspection} onClose={() => setViewTireInspection(null)} />
      )}

      {createPlanChecklist && (
        <CreateActionPlanModal
          checklist={createPlanChecklist}
          onClose={() => setCreatePlanChecklist(null)}
          onCreated={() => { 
            setCreatePlanChecklist(null);
            void queryClient.invalidateQueries({ queryKey: ['checklists', currentClient?.id] });
          }}
        />
      )}

      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-sm space-y-4 rounded-2xl bg-white p-6 shadow-2xl">
            <h3 className="text-lg font-semibold text-red-700">Excluir checklist</h3>
            <p className="text-sm text-zinc-600">
              Esta ação é <strong>irreversível</strong>. O checklist, todas as respostas e ações vinculadas serão removidos permanentemente.
            </p>
            <p className="text-sm font-medium text-zinc-900">
              Template: <span className="text-orange-600">{confirmDelete.templateName}</span>
            </p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setConfirmDelete(null)} disabled={deleteMutation.isPending} className="px-4 py-2 text-sm text-zinc-600">
                Cancelar
              </button>
              <button
                onClick={handleDelete}
                disabled={deleteMutation.isPending}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
              >
                {deleteMutation.isPending ? 'Excluindo...' : 'Excluir permanentemente'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── HistoryCard component ──────────────────────────────────────────────────

interface HistoryCardProps {
  checklists: Checklist[];
  historySearch: string;
  setHistorySearch: (v: string) => void;
  historyStatusFilter: 'all' | 'in_progress' | 'completed';
  setHistoryStatusFilter: (v: 'all' | 'in_progress' | 'completed') => void;
  onView: (c: Checklist) => void;
  formatDate: (iso: string) => string;
}

function HistoryCard({ checklists, historySearch, setHistorySearch, historyStatusFilter, setHistoryStatusFilter, onView, formatDate }: HistoryCardProps) {
  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-5">
      <h2 className="mb-3 text-sm font-semibold text-zinc-700">Histórico</h2>

      <div className="mb-3 flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2 text-zinc-400" />
          <input
            type="text"
            value={historySearch}
            onChange={e => setHistorySearch(e.target.value)}
            placeholder="Buscar por template ou contexto..."
            className="w-full rounded-lg border border-zinc-200 py-1.5 pr-3 pl-8 text-sm focus:ring-2 focus:ring-orange-400 focus:outline-none"
          />
        </div>
        <div className="flex gap-1">
          {(['all', 'in_progress', 'completed'] as const).map(s => (
            <button
              key={s}
              onClick={() => setHistoryStatusFilter(s)}
              className={cn(
                'rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors',
                historyStatusFilter === s ? 'bg-zinc-700 text-white' : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200',
              )}
            >
              {s === 'all' ? 'Todos' : s === 'in_progress' ? 'Em andamento' : 'Concluído'}
            </button>
          ))}
        </div>
      </div>

      {checklists.length === 0 ? (
        <p className="py-4 text-center text-sm text-zinc-400 italic">Nenhum checklist encontrado.</p>
      ) : (
        <div className="space-y-2">
          {checklists.map(c => (
            <div key={c.id} className="flex items-center gap-3 rounded-xl border border-zinc-100 p-3">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-zinc-900">{c.templateName}</p>
                <p className="text-xs text-zinc-500">{c.vehicleLicensePlate && `${c.vehicleLicensePlate} · `}{c.templateContext && `${c.templateContext} · `}{formatDate(c.startedAt)}</p>
                <ChecklistMapLink latitude={c.latitude} longitude={c.longitude} />
              </div>
              <span className={cn('flex-shrink-0 rounded-full px-2 py-0.5 text-xs font-medium', STATUS_COLOR[c.status])}>
                {STATUS_LABEL[c.status]}
              </span>
              {c.status === 'completed' && (
                <button onClick={() => onView(c)} className="flex-shrink-0 rounded-lg p-1.5 hover:bg-zinc-100">
                  <Eye className="h-4 w-4 text-zinc-400" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
