import React, { useState, useEffect, useCallback } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Driver, DriverFieldSettings } from '../types';
import { Plus, Search, Edit2, Trash2, UserCircle, Truck, Eye } from 'lucide-react';
import DriverForm from '../components/DriverForm';
import DriverDetailModal from '../components/DriverDetailModal';
import { supabase } from '../lib/supabase';
import { driverFromRow, driverToRow, DriverRow } from '../lib/driverMappers';
import { uploadDriverDocument, deleteDriverDocument } from '../lib/storageHelpers';
import { driverFieldSettingsFromRow, defaultDriverFieldSettings, DriverFieldSettingsRow } from '../lib/driverFieldSettingsMappers';

const ROLES_WITH_ACCESS = ['Fleet Assistant', 'Fleet Analyst', 'Manager', 'Director', 'Admin Master'];
const ROLES_CAN_CREATE = ['Fleet Assistant', 'Fleet Analyst', 'Manager', 'Director', 'Admin Master'];
const ROLES_CAN_EDIT = ['Fleet Analyst', 'Manager', 'Director', 'Admin Master'];
const ROLES_CAN_ALWAYS_DELETE = ['Manager', 'Director', 'Admin Master'];

function formatCPF(cpf: string): string {
  const digits = cpf.replace(/\D/g, '');
  if (digits.length !== 11) return cpf;
  return digits.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
}

export default function Drivers() {
  const { currentClient, user } = useAuth();
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [isFormOpen, setIsFormOpen] = useState(() => {
    return sessionStorage.getItem('driverFormOpen') === 'true';
  });
  const [editingDriver, setEditingDriver] = useState<Driver | null>(() => {
    try {
      const savedDriver = sessionStorage.getItem('driverFormEditing');
      return savedDriver ? JSON.parse(savedDriver) : null;
    } catch {
      return null;
    }
  });
  const [fieldSettings, setFieldSettings] = useState<DriverFieldSettings | null>(null);
  // Mapa driver_id → placa do veículo associado
  const [driverVehicleMap, setDriverVehicleMap] = useState<Record<string, string>>({});
  const [viewingDriver, setViewingDriver] = useState<Driver | null>(null);

  const canCreate = ROLES_CAN_CREATE.includes(user?.role || '');
  const canEdit = ROLES_CAN_EDIT.includes(user?.role || '');
  const canDelete = ROLES_CAN_ALWAYS_DELETE.includes(user?.role || '') || (user?.role === 'Fleet Analyst' && user?.canDeleteDrivers === true);

  // Redirect Drivers and Yard Auditors
  if (user && !ROLES_WITH_ACCESS.includes(user.role)) {
    return <Navigate to="/checklists" replace />;
  }

  const fetchDrivers = useCallback(async () => {
    setLoading(true);
    setError(null);
    let query = supabase.from('drivers').select('*');
    if (currentClient?.id) {
      query = query.eq('client_id', currentClient.id);
    }
    const { data, error: fetchError } = await query.order('name');

    if (fetchError) {
      setError('Erro ao carregar motoristas. Tente novamente.');
    } else {
      setDrivers((data as DriverRow[]).map(driverFromRow));
    }
    setLoading(false);
  }, [currentClient?.id]);

  const fetchDriverVehicleMap = useCallback(async () => {
    let query = supabase.from('vehicles').select('driver_id, license_plate').not('driver_id', 'is', null);
    if (currentClient?.id) {
      query = query.eq('client_id', currentClient.id);
    }
    const { data } = await query;

    const map: Record<string, string> = {};
    (data ?? []).forEach((row: { driver_id: string; license_plate: string }) => {
      map[row.driver_id] = row.license_plate;
    });
    setDriverVehicleMap(map);
  }, [currentClient?.id]);

  const fetchFieldSettings = useCallback(async () => {
    if (!currentClient?.id) {
      setFieldSettings(null);
      return;
    }
    const { data } = await supabase
      .from('driver_field_settings')
      .select('*')
      .eq('client_id', currentClient.id)
      .maybeSingle();
    setFieldSettings(data ? driverFieldSettingsFromRow(data as DriverFieldSettingsRow) : defaultDriverFieldSettings(currentClient.id));
  }, [currentClient?.id]);

  useEffect(() => {
    fetchDrivers();
    fetchFieldSettings();
    fetchDriverVehicleMap();
  }, [fetchDrivers, fetchFieldSettings, fetchDriverVehicleMap]);

  const handleSave = async (
    driver: Partial<Driver>,
    files: { cnh: File | null; gr: File | null; certificate1: File | null; certificate2: File | null; certificate3: File | null }
  ): Promise<void> => {
    if (!currentClient?.id) return;
    const row = driverToRow(driver, currentClient.id);

    let savedId = editingDriver?.id;

    if (editingDriver) {
      const { error: updateError } = await supabase
        .from('drivers')
        .update(row)
        .eq('id', editingDriver.id);
      if (updateError) throw updateError;
    } else {
      const { data: inserted, error: insertError } = await supabase
        .from('drivers')
        .insert(row)
        .select('id')
        .single();
      if (insertError) throw insertError;
      savedId = inserted.id;
    }

    if (savedId) {
      const urlUpdates: Record<string, string> = {};

      if (files.cnh) {
        if (driver.cnhUpload) await deleteDriverDocument(driver.cnhUpload);
        urlUpdates.cnh_upload = await uploadDriverDocument(currentClient.id, savedId, files.cnh, 'cnh');
      }
      if (files.gr) {
        if (driver.grUpload) await deleteDriverDocument(driver.grUpload);
        urlUpdates.gr_upload = await uploadDriverDocument(currentClient.id, savedId, files.gr, 'gr');
      }
      if (files.certificate1) {
        if (driver.certificate1Upload) await deleteDriverDocument(driver.certificate1Upload);
        urlUpdates.certificate1_upload = await uploadDriverDocument(currentClient.id, savedId, files.certificate1, 'certificate-1');
      }
      if (files.certificate2) {
        if (driver.certificate2Upload) await deleteDriverDocument(driver.certificate2Upload);
        urlUpdates.certificate2_upload = await uploadDriverDocument(currentClient.id, savedId, files.certificate2, 'certificate-2');
      }
      if (files.certificate3) {
        if (driver.certificate3Upload) await deleteDriverDocument(driver.certificate3Upload);
        urlUpdates.certificate3_upload = await uploadDriverDocument(currentClient.id, savedId, files.certificate3, 'certificate-3');
      }

      if (Object.keys(urlUpdates).length > 0) {
        const { error: updateUrlError } = await supabase
          .from('drivers')
          .update(urlUpdates)
          .eq('id', savedId);
        if (updateUrlError) throw updateUrlError;
      }
    }

    await fetchDrivers();
    await fetchDriverVehicleMap();
    setIsFormOpen(false);
    setEditingDriver(null);
    sessionStorage.removeItem('driverFormOpen');
    sessionStorage.removeItem('driverFormEditing');
    sessionStorage.removeItem('driverFormData');
  };

  const handleDelete = async (driver: Driver) => {
    if (!window.confirm(`Excluir o motorista ${driver.name}? Esta ação não pode ser desfeita.`)) return;

    // Delete documents from Storage first
    if (driver.cnhUpload) await deleteDriverDocument(driver.cnhUpload);
    if (driver.grUpload) await deleteDriverDocument(driver.grUpload);
    if (driver.certificate1Upload) await deleteDriverDocument(driver.certificate1Upload);
    if (driver.certificate2Upload) await deleteDriverDocument(driver.certificate2Upload);
    if (driver.certificate3Upload) await deleteDriverDocument(driver.certificate3Upload);

    const { error: deleteError } = await supabase
      .from('drivers')
      .delete()
      .eq('id', driver.id);

    if (deleteError) {
      setError('Erro ao excluir motorista. Tente novamente.');
      return;
    }

    // Delete associated user account (profile + auth.users)
    if (driver.profileId) {
      await supabase.functions.invoke('create-user', {
        body: { action: 'delete', user_id: driver.profileId },
      });
    }

    await fetchDrivers();
    await fetchDriverVehicleMap();
  };

  const filteredDrivers = drivers.filter(d => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      d.name.toLowerCase().includes(q) ||
      d.cpf.includes(q.replace(/\D/g, ''))
    );
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">Motoristas</h1>
          <p className="text-sm text-zinc-500 mt-1">Gerencie os motoristas da sua frota.</p>
        </div>

        {canCreate && (
          <button
            onClick={() => {
              sessionStorage.removeItem('driverFormData');
              sessionStorage.setItem('driverFormOpen', 'true');
              sessionStorage.removeItem('driverFormEditing');
              setEditingDriver(null);
              setIsFormOpen(true);
            }}
            className="inline-flex items-center justify-center rounded-xl bg-orange-500 px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-orange-600 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2 transition-colors"
          >
            <Plus className="-ml-1 mr-2 h-5 w-5" aria-hidden="true" />
            Adicionar Motorista
          </button>
        )}
      </div>

      <div className="relative">
        <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
          <Search className="h-5 w-5 text-zinc-400" aria-hidden="true" />
        </div>
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="block w-full rounded-xl border border-zinc-200 bg-white py-2.5 pl-10 pr-3 text-sm placeholder-zinc-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 shadow-sm"
          placeholder="Buscar por nome ou CPF..."
        />
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-zinc-200 border-t-orange-500" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-zinc-200">
              <thead className="bg-zinc-50">
                <tr>
                  <th scope="col" className="py-3.5 pl-4 pr-3 text-left text-xs font-semibold text-zinc-500 uppercase tracking-wider sm:pl-6">Motorista</th>
                  <th scope="col" className="px-3 py-3.5 text-left text-xs font-semibold text-zinc-500 uppercase tracking-wider">CPF</th>
                  <th scope="col" className="px-3 py-3.5 text-left text-xs font-semibold text-zinc-500 uppercase tracking-wider">Categoria CNH</th>
                  <th scope="col" className="px-3 py-3.5 text-left text-xs font-semibold text-zinc-500 uppercase tracking-wider">Validade CNH</th>
                  <th scope="col" className="px-3 py-3.5 text-left text-xs font-semibold text-zinc-500 uppercase tracking-wider">Veículo</th>
                  <th scope="col" className="relative py-3.5 pl-3 pr-4 sm:pr-6">
                    <span className="sr-only">Ações</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 bg-white">
                {filteredDrivers.map((driver) => (
                  <tr key={driver.id} className="hover:bg-zinc-50 transition-colors">
                    <td className="whitespace-nowrap py-4 pl-4 pr-3 sm:pl-6">
                      <div className="flex items-center">
                        <div className="h-10 w-10 flex-shrink-0 rounded-lg bg-zinc-100 flex items-center justify-center border border-zinc-200">
                          <UserCircle className="h-5 w-5 text-zinc-500" />
                        </div>
                        <div className="ml-4">
                          <div className="font-medium text-zinc-900">{driver.name}</div>
                        </div>
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-3 py-4 text-sm text-zinc-500">
                      {formatCPF(driver.cpf)}
                    </td>
                    <td className="whitespace-nowrap px-3 py-4 text-sm text-zinc-500">
                      {driver.category || <span className="text-zinc-300">—</span>}
                    </td>
                    <td className="whitespace-nowrap px-3 py-4 text-sm text-zinc-500">
                      {driver.expirationDate
                        ? new Date(driver.expirationDate + 'T00:00:00').toLocaleDateString('pt-BR')
                        : <span className="text-zinc-300">—</span>
                      }
                    </td>
                    <td className="whitespace-nowrap px-3 py-4 text-sm text-zinc-500">
                      {driverVehicleMap[driver.id] ? (
                        <div className="flex items-center gap-1.5">
                          <Truck className="h-3.5 w-3.5 text-orange-500 flex-shrink-0" />
                          <span className="text-zinc-900 font-medium">{driverVehicleMap[driver.id]}</span>
                        </div>
                      ) : (
                        <span className="text-zinc-400 italic">Sem veículo</span>
                      )}
                    </td>
                    <td className="relative whitespace-nowrap py-4 pl-3 pr-4 text-right text-sm font-medium sm:pr-6">
                      <div className="flex items-center justify-end gap-3">
                        <button
                          onClick={() => setViewingDriver(driver)}
                          title="Visualizar"
                          className="text-zinc-400 hover:text-zinc-700 transition-colors"
                        >
                          <Eye className="h-5 w-5" />
                          <span className="sr-only">Visualizar</span>
                        </button>
                        {canEdit && (
                          <button
                            onClick={() => {
                              sessionStorage.removeItem('driverFormData');
                              sessionStorage.setItem('driverFormOpen', 'true');
                              sessionStorage.setItem('driverFormEditing', JSON.stringify(driver));
                              setEditingDriver(driver);
                              setIsFormOpen(true);
                            }}
                            className="text-zinc-400 hover:text-zinc-900 transition-colors"
                          >
                            <Edit2 className="h-5 w-5" />
                            <span className="sr-only">Editar</span>
                          </button>
                        )}
                        {canDelete && (
                          <button
                            onClick={() => handleDelete(driver)}
                            className="text-zinc-400 hover:text-red-600 transition-colors"
                          >
                            <Trash2 className="h-5 w-5" />
                            <span className="sr-only">Excluir</span>
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {filteredDrivers.length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-10 text-center text-sm text-zinc-500">
                      {search ? 'Nenhum motorista encontrado para esta busca.' : 'Nenhum motorista cadastrado para este cliente.'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {viewingDriver && (
        <DriverDetailModal
          driver={viewingDriver}
          vehiclePlate={driverVehicleMap[viewingDriver.id]}
          onClose={() => setViewingDriver(null)}
        />
      )}

      {isFormOpen && (
        <DriverForm
          driver={editingDriver}
          fieldSettings={fieldSettings}
          clientId={currentClient?.id ?? ''}
          onClose={() => {
            setIsFormOpen(false);
            setEditingDriver(null);
          }}
          onSave={handleSave}
        />
      )}
    </div>
  );
}
