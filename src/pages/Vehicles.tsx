import React, { useState, useEffect, useCallback } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Vehicle, VehicleFieldSettings } from '../types';
import { Plus, Search, Filter, Edit2, Trash2, Truck, User, Eye } from 'lucide-react';
import VehicleForm from '../components/VehicleForm';
import VehicleDetailModal from '../components/VehicleDetailModal';
import { supabase } from '../lib/supabase';
import { vehicleFromRow, vehicleToRow, VehicleRow } from '../lib/vehicleMappers';
import { uploadVehicleDocument, deleteVehicleDocument } from '../lib/storageHelpers';
import { fieldSettingsFromRow, defaultFieldSettings, VehicleFieldSettingsRow } from '../lib/fieldSettingsMappers';

interface AvailableDriver {
  id: string;
  name: string;
  cpf: string;
}

const ROLES_WITH_ACCESS = ['Fleet Assistant', 'Fleet Analyst', 'Manager', 'Director', 'Admin Master'];
const ROLES_CAN_CREATE = ['Fleet Assistant', 'Fleet Analyst', 'Manager', 'Director', 'Admin Master'];
const ROLES_CAN_EDIT = ['Fleet Analyst', 'Manager', 'Director', 'Admin Master'];
const ROLES_CAN_ALWAYS_DELETE = ['Manager', 'Director', 'Admin Master'];

export default function Vehicles() {
  const { currentClient, user } = useAuth();
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [isFormOpen, setIsFormOpen] = useState(() => {
    return sessionStorage.getItem('vehicleFormOpen') === 'true';
  });
  const [editingVehicle, setEditingVehicle] = useState<Vehicle | null>(() => {
    try {
      const savedVehicle = sessionStorage.getItem('vehicleFormEditing');
      return savedVehicle ? JSON.parse(savedVehicle) : null;
    } catch {
      return null;
    }
  });
  const [fieldSettings, setFieldSettings] = useState<VehicleFieldSettings | null>(null);
  const [availableDrivers, setAvailableDrivers] = useState<AvailableDriver[]>([]);
  const [viewingVehicle, setViewingVehicle] = useState<Vehicle | null>(null);

  const canCreate = ROLES_CAN_CREATE.includes(user?.role || '');
  const canEdit = ROLES_CAN_EDIT.includes(user?.role || '');
  const canDelete = ROLES_CAN_ALWAYS_DELETE.includes(user?.role || '') || (user?.canDeleteVehicles === true);

  // Redirect Drivers and Yard Auditors
  if (user && !ROLES_WITH_ACCESS.includes(user.role)) {
    return <Navigate to="/checklists" replace />;
  }

  const fetchVehicles = useCallback(async () => {
    if (!currentClient?.id) return;
    setLoading(true);
    setError(null);
    const { data, error: fetchError } = await supabase
      .from('vehicles')
      .select('*, drivers(name)')
      .eq('client_id', currentClient.id)
      .order('license_plate');

    if (fetchError) {
      setError('Erro ao carregar veículos. Tente novamente.');
    } else {
      setVehicles((data as VehicleRow[]).map(vehicleFromRow));
    }
    setLoading(false);
  }, [currentClient?.id]);

  const fetchAvailableDrivers = useCallback(async (currentDriverId?: string) => {
    if (!currentClient?.id) return;

    // Busca todos os motoristas do cliente
    const { data: allDrivers } = await supabase
      .from('drivers')
      .select('id, name, cpf')
      .eq('client_id', currentClient.id)
      .order('name');

    // Busca os driver_ids já ocupados por outros veículos
    const { data: usedRows } = await supabase
      .from('vehicles')
      .select('driver_id')
      .eq('client_id', currentClient.id)
      .not('driver_id', 'is', null);

    const usedIds = new Set(
      (usedRows ?? [])
        .map((r: { driver_id: string }) => r.driver_id)
        .filter((id: string) => id !== currentDriverId) // exclui o motorista atual do veículo sendo editado
    );

    setAvailableDrivers(
      (allDrivers ?? []).filter((d: AvailableDriver) => !usedIds.has(d.id))
    );
  }, [currentClient?.id]);

  const fetchFieldSettings = useCallback(async () => {
    if (!currentClient?.id) return;
    const { data } = await supabase
      .from('vehicle_field_settings')
      .select('*')
      .eq('client_id', currentClient.id)
      .maybeSingle();
    setFieldSettings(data ? fieldSettingsFromRow(data as VehicleFieldSettingsRow) : defaultFieldSettings(currentClient.id));
  }, [currentClient?.id]);

  useEffect(() => {
    fetchVehicles();
    fetchFieldSettings();
  }, [fetchVehicles, fetchFieldSettings]);

  useEffect(() => {
    if (isFormOpen) {
      fetchAvailableDrivers(editingVehicle?.driverId);
    }
  }, [isFormOpen, editingVehicle?.driverId, fetchAvailableDrivers]);

  const handleSave = async (
    vehicle: Partial<Vehicle>,
    files: { crlv: File | null; sanitaryInspection: File | null; gr: File | null; insurancePolicy: File | null; maintenanceContract: File | null }
  ): Promise<void> => {
    if (!currentClient?.id) return;
    const row = vehicleToRow(vehicle, currentClient.id);

    let savedId = editingVehicle?.id;

    if (editingVehicle) {
      const { error: updateError } = await supabase
        .from('vehicles')
        .update(row)
        .eq('id', editingVehicle.id);
      if (updateError) throw updateError;
    } else {
      const { data: inserted, error: insertError } = await supabase
        .from('vehicles')
        .insert(row)
        .select('id')
        .single();
      if (insertError) throw insertError;
      savedId = inserted.id;
    }

    if (savedId) {
      const urlUpdates: Record<string, string> = {};

      if (files.crlv) {
        if (vehicle.crlvUpload) await deleteVehicleDocument(vehicle.crlvUpload);
        urlUpdates.crlv_upload = await uploadVehicleDocument(currentClient.id, savedId, files.crlv, 'crlv');
      }
      if (files.sanitaryInspection) {
        if (vehicle.sanitaryInspectionUpload) await deleteVehicleDocument(vehicle.sanitaryInspectionUpload);
        urlUpdates.sanitary_inspection_upload = await uploadVehicleDocument(currentClient.id, savedId, files.sanitaryInspection, 'sanitary-inspection');
      }
      if (files.gr) {
        if (vehicle.grUpload) await deleteVehicleDocument(vehicle.grUpload);
        urlUpdates.gr_upload = await uploadVehicleDocument(currentClient.id, savedId, files.gr, 'gr');
      }
      if (files.insurancePolicy) {
        if (vehicle.insurancePolicyUpload) await deleteVehicleDocument(vehicle.insurancePolicyUpload);
        urlUpdates.insurance_policy_upload = await uploadVehicleDocument(currentClient.id, savedId, files.insurancePolicy, 'insurance-policy');
      }
      if (files.maintenanceContract) {
        if (vehicle.maintenanceContractUpload) await deleteVehicleDocument(vehicle.maintenanceContractUpload);
        urlUpdates.maintenance_contract_upload = await uploadVehicleDocument(currentClient.id, savedId, files.maintenanceContract, 'maintenance-contract');
      }

      if (Object.keys(urlUpdates).length > 0) {
        const { error: updateUrlError } = await supabase
          .from('vehicles')
          .update(urlUpdates)
          .eq('id', savedId);
        if (updateUrlError) throw updateUrlError;
      }
    }

    await fetchVehicles();
    setIsFormOpen(false);
    setEditingVehicle(null);
    sessionStorage.removeItem('vehicleFormOpen');
    sessionStorage.removeItem('vehicleFormEditing');
    sessionStorage.removeItem('vehicleFormData');
  };

  const handleDelete = async (vehicle: Vehicle) => {
    if (!window.confirm(`Excluir o veículo ${vehicle.licensePlate}? Esta ação não pode ser desfeita.`)) return;

    // Delete documents from Storage first (if exists)
    if (vehicle.crlvUpload) await deleteVehicleDocument(vehicle.crlvUpload);
    if (vehicle.sanitaryInspectionUpload) await deleteVehicleDocument(vehicle.sanitaryInspectionUpload);
    if (vehicle.grUpload) await deleteVehicleDocument(vehicle.grUpload);
    if (vehicle.insurancePolicyUpload) await deleteVehicleDocument(vehicle.insurancePolicyUpload);
    if (vehicle.maintenanceContractUpload) await deleteVehicleDocument(vehicle.maintenanceContractUpload);

    const { error: deleteError } = await supabase
      .from('vehicles')
      .delete()
      .eq('id', vehicle.id);
    if (deleteError) {
      setError('Erro ao excluir veículo. Tente novamente.');
    } else {
      await fetchVehicles();
    }
  };

  const filteredVehicles = vehicles.filter(v => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      v.licensePlate.toLowerCase().includes(q) ||
      `${v.brand} ${v.model}`.toLowerCase().includes(q) ||
      v.chassi.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">Vehicles</h1>
          <p className="text-sm text-zinc-500 mt-1">Manage your fleet inventory and details.</p>
        </div>

        {canCreate && (
          <button
            onClick={() => {
              sessionStorage.removeItem('vehicleFormData'); // clear any drafts for adding new
              sessionStorage.setItem('vehicleFormOpen', 'true');
              sessionStorage.removeItem('vehicleFormEditing');
              setEditingVehicle(null);
              setIsFormOpen(true);
            }}
            className="inline-flex items-center justify-center rounded-xl bg-orange-500 px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-orange-600 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2 transition-colors"
          >
            <Plus className="-ml-1 mr-2 h-5 w-5" aria-hidden="true" />
            Add Vehicle
          </button>
        )}
      </div>

      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
            <Search className="h-5 w-5 text-zinc-400" aria-hidden="true" />
          </div>
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="block w-full rounded-xl border border-zinc-200 bg-white py-2.5 pl-10 pr-3 text-sm placeholder-zinc-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 shadow-sm"
            placeholder="Search by plate, model, or chassis..."
          />
        </div>
        <button className="inline-flex items-center justify-center rounded-xl border border-zinc-200 bg-white px-4 py-2.5 text-sm font-medium text-zinc-700 shadow-sm hover:bg-zinc-50 focus:outline-none focus:ring-2 focus:ring-zinc-500 focus:ring-offset-2 transition-colors">
          <Filter className="-ml-1 mr-2 h-5 w-5 text-zinc-400" aria-hidden="true" />
          Filters
        </button>
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
                  <th scope="col" className="py-3.5 pl-4 pr-3 text-left text-xs font-semibold text-zinc-500 uppercase tracking-wider sm:pl-6">Vehicle</th>
                  <th scope="col" className="px-3 py-3.5 text-left text-xs font-semibold text-zinc-500 uppercase tracking-wider">Tipo / Energia</th>
                  <th scope="col" className="px-3 py-3.5 text-left text-xs font-semibold text-zinc-500 uppercase tracking-wider">Proprietário</th>
                  <th scope="col" className="px-3 py-3.5 text-left text-xs font-semibold text-zinc-500 uppercase tracking-wider">Motorista</th>
                  <th scope="col" className="relative py-3.5 pl-3 pr-4 sm:pr-6">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 bg-white">
                {filteredVehicles.map((vehicle) => (
                  <tr key={vehicle.id} className="hover:bg-zinc-50 transition-colors">
                    <td className="whitespace-nowrap py-4 pl-4 pr-3 sm:pl-6">
                      <div className="flex items-center">
                        <div className="h-10 w-10 flex-shrink-0 rounded-lg bg-zinc-100 flex items-center justify-center border border-zinc-200">
                          <Truck className="h-5 w-5 text-zinc-500" />
                        </div>
                        <div className="ml-4">
                          <div className="font-medium text-zinc-900">{vehicle.licensePlate}</div>
                          <div className="text-sm text-zinc-500">{vehicle.brand} {vehicle.model} ({vehicle.year})</div>
                        </div>
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-3 py-4 text-sm text-zinc-500">
                      <div className="text-zinc-900">{vehicle.type}</div>
                      <div>{vehicle.energySource}</div>
                    </td>
                    <td className="whitespace-nowrap px-3 py-4 text-sm text-zinc-500">
                      <div className="text-zinc-900">{vehicle.owner}</div>
                      <div>{vehicle.acquisition}</div>
                    </td>
                    <td className="whitespace-nowrap px-3 py-4 text-sm text-zinc-500">
                      {vehicle.driverName ? (
                        <div className="flex items-center gap-1.5">
                          <User className="h-3.5 w-3.5 text-orange-500 flex-shrink-0" />
                          <span className="text-zinc-900">{vehicle.driverName}</span>
                        </div>
                      ) : (
                        <span className="text-zinc-400 italic">Sem motorista</span>
                      )}
                    </td>
                    <td className="relative whitespace-nowrap py-4 pl-3 pr-4 text-right text-sm font-medium sm:pr-6">
                      <div className="flex items-center justify-end gap-3">
                        <button
                          onClick={() => setViewingVehicle(vehicle)}
                          title="Visualizar"
                          className="text-zinc-400 hover:text-zinc-700 transition-colors"
                        >
                          <Eye className="h-5 w-5" />
                          <span className="sr-only">Visualizar</span>
                        </button>
                        {canEdit && (
                          <button
                            onClick={() => {
                              sessionStorage.removeItem('vehicleFormData'); // draft
                              sessionStorage.setItem('vehicleFormOpen', 'true');
                              sessionStorage.setItem('vehicleFormEditing', JSON.stringify(vehicle));
                              setEditingVehicle(vehicle);
                              setIsFormOpen(true);
                            }}
                            className="text-zinc-400 hover:text-zinc-900 transition-colors"
                          >
                            <Edit2 className="h-5 w-5" />
                            <span className="sr-only">Edit</span>
                          </button>
                        )}
                        {canDelete && (
                          <button
                            onClick={() => handleDelete(vehicle)}
                            className="text-zinc-400 hover:text-red-600 transition-colors"
                          >
                            <Trash2 className="h-5 w-5" />
                            <span className="sr-only">Delete</span>
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {filteredVehicles.length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-10 text-center text-sm text-zinc-500">
                      {search ? 'No vehicles match your search.' : 'No vehicles found for this client.'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {viewingVehicle && (
        <VehicleDetailModal
          vehicle={viewingVehicle}
          onClose={() => setViewingVehicle(null)}
        />
      )}

      {isFormOpen && (
        <VehicleForm
          vehicle={editingVehicle}
          fieldSettings={fieldSettings}
          availableDrivers={availableDrivers}
          onClose={() => {
            setIsFormOpen(false);
            setEditingVehicle(null);
          }}
          onSave={handleSave}
        />
      )}
    </div>
  );
}
