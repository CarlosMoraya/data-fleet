import React, { useState, useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { VehicleFieldSettings, DriverFieldSettings } from '../types';
import { supabase } from '../lib/supabase';
import {
  fieldSettingsFromRow,
  fieldSettingsToRow,
  defaultFieldSettings,
  CONFIGURABLE_FIELDS,
  VehicleFieldSettingsRow,
} from '../lib/fieldSettingsMappers';
import {
  driverFieldSettingsFromRow,
  driverFieldSettingsToRow,
  defaultDriverFieldSettings,
  DRIVER_CONFIGURABLE_FIELDS,
  DriverFieldSettingsRow,
} from '../lib/driverFieldSettingsMappers';
import { Loader2, Truck, UserCircle, Gauge } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { cn } from '../lib/utils';
import VehicleKmIntervalSettings from '../components/VehicleKmIntervalSettings';

const ROLES_CAN_MANAGE_FIELDS = ['Manager', 'Coordinator', 'Director', 'Admin Master'];
const ROLES_CAN_ACCESS_SETTINGS = ['Fleet Assistant', 'Fleet Analyst', 'Supervisor', 'Manager', 'Coordinator', 'Director', 'Admin Master'];

type TabType = 'vehicles' | 'drivers' | 'revisoes';

export default function Settings() {
  const { currentClient, user } = useAuth();

  const canManageFields = user ? ROLES_CAN_MANAGE_FIELDS.includes(user.role) : false;
  const [activeTab, setActiveTab] = useState<TabType>(canManageFields ? 'vehicles' : 'revisoes');

  // Vehicle field settings state
  const [settings, setSettings] = useState<VehicleFieldSettings | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Driver field settings state
  const [driverSettings, setDriverSettings] = useState<DriverFieldSettings | null>(null);
  const [isDriverNew, setIsDriverNew] = useState(false);
  const [driverSuccess, setDriverSuccess] = useState(false);
  const [driverError, setDriverError] = useState<string | null>(null);

  if (user && !ROLES_CAN_ACCESS_SETTINGS.includes(user.role)) {
    return <Navigate to="/" replace />;
  }

  const queryClient = useQueryClient();

  const vehicleSettingsQuery = useQuery({
    queryKey: ['vehicleSettings', currentClient?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('vehicle_field_settings')
        .select('*')
        .eq('client_id', currentClient?.id)
        .maybeSingle();

      if (error) throw error;
      return data as VehicleFieldSettingsRow | null;
    },
    enabled: !!currentClient?.id
  });

  const driverSettingsQuery = useQuery({
    queryKey: ['driverSettings', currentClient?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('driver_field_settings')
        .select('*')
        .eq('client_id', currentClient?.id)
        .maybeSingle();

      if (error) throw error;
      return data as DriverFieldSettingsRow | null;
    },
    enabled: !!currentClient?.id
  });

  useEffect(() => {
    if (vehicleSettingsQuery.isSuccess && currentClient?.id) {
      if (vehicleSettingsQuery.data) {
        setSettings(fieldSettingsFromRow(vehicleSettingsQuery.data));
        setIsNew(false);
      } else {
        setSettings(defaultFieldSettings(currentClient.id));
        setIsNew(true);
      }
    }
    if (vehicleSettingsQuery.isError) {
      setError('Erro ao carregar configurações de veículos.');
    }
  }, [vehicleSettingsQuery.data, vehicleSettingsQuery.isSuccess, vehicleSettingsQuery.isError, currentClient?.id]);

  useEffect(() => {
    if (driverSettingsQuery.isSuccess && currentClient?.id) {
      if (driverSettingsQuery.data) {
        setDriverSettings(driverFieldSettingsFromRow(driverSettingsQuery.data));
        setIsDriverNew(false);
      } else {
        setDriverSettings(defaultDriverFieldSettings(currentClient.id));
        setIsDriverNew(true);
      }
    }
    if (driverSettingsQuery.isError) {
      setDriverError('Erro ao carregar configurações de motoristas.');
    }
  }, [driverSettingsQuery.data, driverSettingsQuery.isSuccess, driverSettingsQuery.isError, currentClient?.id]);

  const handleToggle = (key: keyof VehicleFieldSettings) => {
    if (!settings) return;
    setSettings(prev => prev ? { ...prev, [key]: !prev[key] } : prev);
    setSuccess(false);
  };

  const handleToggleAllVehicles = (makeOptional: boolean) => {
    if (!settings) return;
    const newSettings = { ...settings };
    CONFIGURABLE_FIELDS.forEach(field => {
      newSettings[field.key as keyof VehicleFieldSettings] = makeOptional as never;
    });
    setSettings(newSettings);
    setSuccess(false);
  };

  const handleDriverToggle = (key: keyof DriverFieldSettings) => {
    if (!driverSettings) return;
    setDriverSettings(prev => prev ? { ...prev, [key]: !prev[key] } : prev);
    setDriverSuccess(false);
  };

  const handleToggleAllDrivers = (makeOptional: boolean) => {
    if (!driverSettings) return;
    const newSettings = { ...driverSettings };
    DRIVER_CONFIGURABLE_FIELDS.forEach(field => {
      newSettings[field.key as keyof DriverFieldSettings] = makeOptional as never;
    });
    setDriverSettings(newSettings);
    setDriverSuccess(false);
  };

  const saveVehicleMutation = useMutation({
    mutationFn: async () => {
      if (!settings || !currentClient?.id) return;
      const row = fieldSettingsToRow(settings, currentClient.id);
      
      if (isNew) {
        const { error } = await supabase.from('vehicle_field_settings').insert(row);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('vehicle_field_settings').update(row).eq('client_id', currentClient.id);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      setIsNew(false);
      setSuccess(true);
      queryClient.invalidateQueries({ queryKey: ['vehicleSettings', currentClient?.id] });
    },
    onError: () => {
      setError('Erro ao salvar configurações.');
    }
  });

  const handleSave = () => {
    setError(null);
    setSuccess(false);
    saveVehicleMutation.mutate();
  };

  const saveDriverMutation = useMutation({
    mutationFn: async () => {
      if (!driverSettings || !currentClient?.id) return;
      const row = driverFieldSettingsToRow(driverSettings, currentClient.id);
      
      if (isDriverNew) {
        const { error } = await supabase.from('driver_field_settings').insert(row);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('driver_field_settings').update(row).eq('client_id', currentClient.id);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      setIsDriverNew(false);
      setDriverSuccess(true);
      queryClient.invalidateQueries({ queryKey: ['driverSettings', currentClient?.id] });
    },
    onError: () => {
      setDriverError('Erro ao salvar configurações.');
    }
  });

  const handleDriverSave = () => {
    setDriverError(null);
    setDriverSuccess(false);
    saveDriverMutation.mutate();
  };

  if (canManageFields && (vehicleSettingsQuery.isLoading || driverSettingsQuery.isLoading)) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-zinc-400" />
      </div>
    );
  }

  // Agrupa campos de veículo por seção
  const vehicleSections = CONFIGURABLE_FIELDS.reduce((acc, field) => {
    if (!acc[field.section]) acc[field.section] = [];
    acc[field.section].push(field);
    return acc;
  }, {} as Record<string, typeof CONFIGURABLE_FIELDS>);

  // Agrupa campos de motorista por seção
  const driverSections = DRIVER_CONFIGURABLE_FIELDS.reduce((acc, field) => {
    if (!acc[field.section]) acc[field.section] = [];
    acc[field.section].push(field);
    return acc;
  }, {} as Record<string, typeof DRIVER_CONFIGURABLE_FIELDS>);

  const tabs = [
    ...(canManageFields ? [
      { id: 'vehicles', name: 'Veículos', icon: Truck },
      { id: 'drivers', name: 'Motoristas', icon: UserCircle },
    ] : []),
    { id: 'revisoes', name: 'Revisões', icon: Gauge },
  ];

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">Configurações</h1>
        <p className="text-sm text-zinc-500 mt-1">Gerencie as configurações do sistema para este cliente.</p>
      </div>

      {/* Bar de abas */}
      <div className="border-b border-zinc-200">
        <nav className="-mb-px flex gap-1">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as TabType)}
                className={cn(
                  isActive
                    ? 'border-orange-500 text-orange-600 font-medium'
                    : 'border-transparent text-zinc-500 hover:text-zinc-700 hover:border-zinc-300',
                  'flex items-center gap-2 whitespace-nowrap border-b-2 px-4 py-3 text-sm transition-colors cursor-pointer'
                )}
              >
                <Icon className={cn("h-4 w-4", isActive ? "text-orange-500" : "text-zinc-400")} />
                {tab.name}
              </button>
            );
          })}
        </nav>
      </div>

      {activeTab === 'vehicles' && (
        /* ─── Card: Campos Obrigatórios do Veículo ─── */
        <div className="bg-white rounded-2xl shadow-sm border border-zinc-200 overflow-hidden animate-in fade-in duration-300">
          <div className="px-6 py-4 border-b border-zinc-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <Truck className="h-5 w-5 text-zinc-400" />
              <div>
                <h2 className="text-lg font-medium text-zinc-900">Campos Obrigatórios do Veículo</h2>
                <p className="text-sm text-zinc-500">Controle quais campos são obrigatórios no cadastro de veículos.</p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => handleToggleAllVehicles(false)}
                className="text-xs px-2.5 py-1.5 rounded-lg bg-orange-50 text-orange-700 hover:bg-orange-100 font-medium transition-colors border border-orange-200 cursor-pointer"
              >
                Marcar Todos
              </button>
              <button
                onClick={() => handleToggleAllVehicles(true)}
                className="text-xs px-2.5 py-1.5 rounded-lg bg-zinc-50 text-zinc-700 hover:bg-zinc-100 font-medium transition-colors border border-zinc-200 cursor-pointer"
              >
                Desmarcar Todos
              </button>
            </div>
          </div>

          {error && (
            <div className="mx-6 mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}
          {success && (
            <div className="mx-6 mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
              Configurações de veículos salvas com sucesso.
            </div>
          )}

          <div className="divide-y divide-zinc-100">
            {Object.entries(vehicleSections).map(([sectionName, fields]) => (
              <div key={sectionName} className="px-6 py-4">
                <h3 className="text-sm font-semibold text-zinc-500 uppercase tracking-wider mb-3">{sectionName}</h3>
                {sectionName === 'Campos Condicionais' && (
                  <p className="text-xs text-zinc-400 mb-3">Estes campos só são exigidos quando a condição correspondente está ativa no formulário.</p>
                )}
                <div className="space-y-3">
                  {fields.map(field => {
                    const isOptional = settings ? (settings[field.key] as boolean) : false;
                    return (
                      <div key={field.key} className="flex items-center justify-between py-1">
                        <div>
                          <span className="text-sm text-zinc-800">{field.label}</span>
                          {field.note && <span className="ml-2 text-xs text-zinc-400">({field.note})</span>}
                        </div>
                        <button
                          type="button"
                          onClick={() => handleToggle(field.key)}
                          className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2 ${
                            !isOptional ? 'bg-orange-500' : 'bg-zinc-200'
                          }`}
                          role="switch"
                          aria-checked={!isOptional}
                          aria-label={`${field.label} obrigatório`}
                        >
                          <span
                            className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                              !isOptional ? 'translate-x-5' : 'translate-x-0'
                            }`}
                          />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          <div className="px-6 py-4 border-t border-zinc-200 bg-zinc-50 flex items-center justify-between">
            <p className="text-xs text-zinc-400">
              <span className="inline-block w-3 h-3 rounded-full bg-orange-500 mr-1 align-middle" /> Obrigatório
              <span className="inline-block w-3 h-3 rounded-full bg-zinc-200 ml-3 mr-1 align-middle" /> Opcional
            </p>
            <button
              onClick={handleSave}
              disabled={saveVehicleMutation.isPending}
              className="inline-flex items-center gap-2 rounded-xl bg-orange-500 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-orange-600 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2 transition-colors disabled:opacity-50 cursor-pointer"
            >
              {saveVehicleMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              {saveVehicleMutation.isPending ? 'Salvando...' : 'Salvar'}
            </button>
          </div>
        </div>
      )}

      {activeTab === 'drivers' && (
        /* ─── Card: Campos Obrigatórios do Motorista ─── */
        <div className="bg-white rounded-2xl shadow-sm border border-zinc-200 overflow-hidden animate-in fade-in duration-300">
          <div className="px-6 py-4 border-b border-zinc-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <UserCircle className="h-5 w-5 text-zinc-400" />
              <div>
                <h2 className="text-lg font-medium text-zinc-900">Campos Obrigatórios do Motorista</h2>
                <p className="text-sm text-zinc-500">Controle quais campos são obrigatórios no cadastro de motoristas.</p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => handleToggleAllDrivers(false)}
                className="text-xs px-2.5 py-1.5 rounded-lg bg-orange-50 text-orange-700 hover:bg-orange-100 font-medium transition-colors border border-orange-200 cursor-pointer"
              >
                Marcar Todos
              </button>
              <button
                onClick={() => handleToggleAllDrivers(true)}
                className="text-xs px-2.5 py-1.5 rounded-lg bg-zinc-50 text-zinc-700 hover:bg-zinc-100 font-medium transition-colors border border-zinc-200 cursor-pointer"
              >
                Desmarcar Todos
              </button>
            </div>
          </div>

          {driverError && (
            <div className="mx-6 mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {driverError}
            </div>
          )}
          {driverSuccess && (
            <div className="mx-6 mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
              Configurações de motoristas salvas com sucesso.
            </div>
          )}

          <div className="divide-y divide-zinc-100">
            {Object.entries(driverSections).map(([sectionName, fields]) => (
              <div key={sectionName} className="px-6 py-4">
                <h3 className="text-sm font-semibold text-zinc-500 uppercase tracking-wider mb-3">{sectionName}</h3>
                <div className="space-y-3">
                  {fields.map(field => {
                    const isOptional = driverSettings ? (driverSettings[field.key] as boolean) : false;
                    return (
                      <div key={field.key} className="flex items-center justify-between py-1">
                        <div>
                          <span className="text-sm text-zinc-800">{field.label}</span>
                          {field.note && <span className="ml-2 text-xs text-zinc-400">({field.note})</span>}
                        </div>
                        <button
                          type="button"
                          onClick={() => handleDriverToggle(field.key)}
                          className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2 ${
                            !isOptional ? 'bg-orange-500' : 'bg-zinc-200'
                          }`}
                          role="switch"
                          aria-checked={!isOptional}
                          aria-label={`${field.label} obrigatório`}
                        >
                          <span
                            className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                              !isOptional ? 'translate-x-5' : 'translate-x-0'
                            }`}
                          />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          <div className="px-6 py-4 border-t border-zinc-200 bg-zinc-50 flex items-center justify-between">
            <p className="text-xs text-zinc-400">
              <span className="inline-block w-3 h-3 rounded-full bg-orange-500 mr-1 align-middle" /> Obrigatório
              <span className="inline-block w-3 h-3 rounded-full bg-zinc-200 ml-3 mr-1 align-middle" /> Opcional
            </p>
            <button
              onClick={handleDriverSave}
              disabled={saveDriverMutation.isPending}
              className="inline-flex items-center gap-2 rounded-xl bg-orange-500 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-orange-600 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2 transition-colors disabled:opacity-50 cursor-pointer"
            >
              {saveDriverMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              {saveDriverMutation.isPending ? 'Salvando...' : 'Salvar'}
            </button>
          </div>
        </div>
      )}

      {activeTab === 'revisoes' && currentClient?.id && user && (
        <VehicleKmIntervalSettings clientId={currentClient.id} userId={user.id} />
      )}
    </div>
  );
}
