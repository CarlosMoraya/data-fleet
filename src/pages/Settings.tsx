import React, { useState, useEffect, useCallback } from 'react';
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
import { Loader2, Truck, UserCircle } from 'lucide-react';

const ROLES_CAN_MANAGE = ['Manager', 'Director', 'Admin Master'];

export default function Settings() {
  const { currentClient, user } = useAuth();

  // Vehicle field settings state
  const [settings, setSettings] = useState<VehicleFieldSettings | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Driver field settings state
  const [driverSettings, setDriverSettings] = useState<DriverFieldSettings | null>(null);
  const [isDriverNew, setIsDriverNew] = useState(false);
  const [driverSaving, setDriverSaving] = useState(false);
  const [driverSuccess, setDriverSuccess] = useState(false);
  const [driverError, setDriverError] = useState<string | null>(null);

  const [loading, setLoading] = useState(true);

  if (user && !ROLES_CAN_MANAGE.includes(user.role)) {
    return <Navigate to="/" replace />;
  }

  const fetchSettings = useCallback(async () => {
    if (!currentClient?.id) return;
    const { data, error: fetchError } = await supabase
      .from('vehicle_field_settings')
      .select('*')
      .eq('client_id', currentClient.id)
      .maybeSingle();

    if (fetchError) {
      setError('Erro ao carregar configurações de veículos.');
    } else if (data) {
      setSettings(fieldSettingsFromRow(data as VehicleFieldSettingsRow));
      setIsNew(false);
    } else {
      setSettings(defaultFieldSettings(currentClient.id));
      setIsNew(true);
    }
  }, [currentClient?.id]);

  const fetchDriverSettings = useCallback(async () => {
    if (!currentClient?.id) return;
    const { data, error: fetchError } = await supabase
      .from('driver_field_settings')
      .select('*')
      .eq('client_id', currentClient.id)
      .maybeSingle();

    if (fetchError) {
      setDriverError('Erro ao carregar configurações de motoristas.');
    } else if (data) {
      setDriverSettings(driverFieldSettingsFromRow(data as DriverFieldSettingsRow));
      setIsDriverNew(false);
    } else {
      setDriverSettings(defaultDriverFieldSettings(currentClient.id));
      setIsDriverNew(true);
    }
  }, [currentClient?.id]);

  useEffect(() => {
    setLoading(true);
    Promise.all([fetchSettings(), fetchDriverSettings()]).finally(() => setLoading(false));
  }, [fetchSettings, fetchDriverSettings]);

  const handleToggle = (key: keyof VehicleFieldSettings) => {
    if (!settings) return;
    setSettings(prev => prev ? { ...prev, [key]: !prev[key] } : prev);
    setSuccess(false);
  };

  const handleDriverToggle = (key: keyof DriverFieldSettings) => {
    if (!driverSettings) return;
    setDriverSettings(prev => prev ? { ...prev, [key]: !prev[key] } : prev);
    setDriverSuccess(false);
  };

  const handleSave = async () => {
    if (!settings || !currentClient?.id) return;
    setSaving(true);
    setError(null);
    setSuccess(false);

    const row = fieldSettingsToRow(settings, currentClient.id);

    if (isNew) {
      const { error: insertError } = await supabase
        .from('vehicle_field_settings')
        .insert(row);
      if (insertError) {
        setError('Erro ao salvar configurações.');
      } else {
        setIsNew(false);
        setSuccess(true);
      }
    } else {
      const { error: updateError } = await supabase
        .from('vehicle_field_settings')
        .update(row)
        .eq('client_id', currentClient.id);
      if (updateError) {
        setError('Erro ao salvar configurações.');
      } else {
        setSuccess(true);
      }
    }
    setSaving(false);
  };

  const handleDriverSave = async () => {
    if (!driverSettings || !currentClient?.id) return;
    setDriverSaving(true);
    setDriverError(null);
    setDriverSuccess(false);

    const row = driverFieldSettingsToRow(driverSettings, currentClient.id);

    if (isDriverNew) {
      const { error: insertError } = await supabase
        .from('driver_field_settings')
        .insert(row);
      if (insertError) {
        setDriverError('Erro ao salvar configurações.');
      } else {
        setIsDriverNew(false);
        setDriverSuccess(true);
      }
    } else {
      const { error: updateError } = await supabase
        .from('driver_field_settings')
        .update(row)
        .eq('client_id', currentClient.id);
      if (updateError) {
        setDriverError('Erro ao salvar configurações.');
      } else {
        setDriverSuccess(true);
      }
    }
    setDriverSaving(false);
  };

  if (loading) {
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

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">Configurações</h1>
        <p className="text-sm text-zinc-500 mt-1">Gerencie as configurações do sistema para este cliente.</p>
      </div>

      {/* ─── Card: Campos Obrigatórios do Veículo ─── */}
      <div className="bg-white rounded-2xl shadow-sm border border-zinc-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-zinc-200 flex items-center gap-3">
          <Truck className="h-5 w-5 text-zinc-400" />
          <div>
            <h2 className="text-lg font-medium text-zinc-900">Campos Obrigatórios do Veículo</h2>
            <p className="text-sm text-zinc-500">Controle quais campos são obrigatórios no cadastro de veículos. Campos marcados como "Obrigatório" devem ser preenchidos para salvar.</p>
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
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-xl bg-orange-500 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-orange-600 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2 transition-colors disabled:opacity-50"
          >
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            {saving ? 'Salvando...' : 'Salvar'}
          </button>
        </div>
      </div>

      {/* ─── Card: Campos Obrigatórios do Motorista ─── */}
      <div className="bg-white rounded-2xl shadow-sm border border-zinc-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-zinc-200 flex items-center gap-3">
          <UserCircle className="h-5 w-5 text-zinc-400" />
          <div>
            <h2 className="text-lg font-medium text-zinc-900">Campos Obrigatórios do Motorista</h2>
            <p className="text-sm text-zinc-500">Controle quais campos são obrigatórios no cadastro de motoristas. Campos marcados como "Obrigatório" devem ser preenchidos para salvar.</p>
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
            disabled={driverSaving}
            className="inline-flex items-center gap-2 rounded-xl bg-orange-500 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-orange-600 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2 transition-colors disabled:opacity-50"
          >
            {driverSaving && <Loader2 className="h-4 w-4 animate-spin" />}
            {driverSaving ? 'Salvando...' : 'Salvar'}
          </button>
        </div>
      </div>
    </div>
  );
}
