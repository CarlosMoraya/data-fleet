import React, { useState, useEffect } from 'react';
import { Vehicle } from '../types';
import { X, FileText, ExternalLink, Loader2 } from 'lucide-react';
import { validateFile } from '../lib/storageHelpers';
import {
  filterDigitsOnly,
  filterNumericComma,
  filterText,
  filterPlate,
  filterAlpha,
  filterAlphanumeric,
} from '../lib/inputHelpers';

interface VehicleFormProps {
  vehicle: Vehicle | null;
  onClose: () => void;
  onSave: (vehicle: Partial<Vehicle>, file: File | null) => Promise<void>;
}

// Mapa de filtros por nome de campo
const FIELD_FILTERS: Record<string, (v: string) => string> = {
  licensePlate: filterPlate,
  brand: filterText,
  model: filterText,
  year: filterDigitsOnly,
  color: filterText,
  renavam: filterDigitsOnly,
  chassi: (v) => filterAlphanumeric(v, 17),
  detranUF: (v) => filterAlpha(v, 2),
  owner: filterText,
  fipePrice: filterNumericComma,
  tracker: filterText,
  antt: filterDigitsOnly,
  autonomy: filterNumericComma,
  fuelType: filterText,
  tankCapacity: filterNumericComma,
  avgConsumption: filterNumericComma,
  coolingBrand: filterText,
  placaSemiReboque: filterPlate,
};

export default function VehicleForm({ vehicle, onClose, onSave }: VehicleFormProps) {
  const [formData, setFormData] = useState<Partial<Vehicle>>(() => {
    try {
      const savedData = sessionStorage.getItem('vehicleFormData');
      if (savedData) {
        return JSON.parse(savedData);
      }
    } catch (e) {
      console.error('Failed to parse vehicleFormData from sessionStorage', e);
    }

    return {
      type: 'Light',
      energySource: 'Combustão',
      coolingEquipment: false,
      acquisition: 'Owned',
      ...vehicle,
    };
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  useEffect(() => {
    if (vehicle) {
      setFormData(prev => ({
        ...prev,
        ...vehicle
      }));
    }
    setError(null);
  }, [vehicle]);

  useEffect(() => {
    sessionStorage.setItem('vehicleFormData', JSON.stringify(formData));
  }, [formData]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;

    if (type === 'checkbox') {
      const checked = (e.target as HTMLInputElement).checked;
      setFormData(prev => ({ ...prev, [name]: checked }));
    } else {
      const filter = FIELD_FILTERS[name];
      const filtered = filter ? filter(value) : value;
      setFormData(prev => ({ ...prev, [name]: filtered }));
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null;
    if (!file) {
      setSelectedFile(null);
      return;
    }
    try {
      validateFile(file);
      setSelectedFile(file);
      setError(null);
    } catch (err: unknown) {
      setSelectedFile(null);
      setError((err as Error).message);
      e.target.value = ''; // reset file input
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await onSave(formData, selectedFile);
    } catch (err: unknown) {
      const pgError = err as { code?: string; message?: string };
      if (pgError?.code === '23505') {
        setError('Esta placa já está cadastrada para este cliente.');
      } else {
        setError((err as Error).message ?? 'Erro ao salvar veículo. Tente novamente.');
      }
    } finally {
      setSaving(false);
    }
  };

  const handleClose = () => {
    sessionStorage.removeItem('vehicleFormOpen');
    sessionStorage.removeItem('vehicleFormEditing');
    sessionStorage.removeItem('vehicleFormData');
    onClose();
  };

  const inputClass = "mt-1 block w-full rounded-xl border border-zinc-300 py-2 px-3 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 sm:text-sm";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 sm:p-6 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-3xl max-h-full flex flex-col my-8">
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-200">
          <h2 className="text-xl font-semibold text-zinc-900">
            {vehicle ? 'Edit Vehicle' : 'Add Vehicle'}
          </h2>
          <button onClick={handleClose} className="text-zinc-400 hover:text-zinc-500 transition-colors">
            <X className="h-6 w-6" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {error && (
            <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          <form id="vehicle-form" onSubmit={handleSubmit} className="space-y-8">
            {/* Basic Info */}
            <div>
              <h3 className="text-lg font-medium leading-6 text-zinc-900 border-b border-zinc-200 pb-2 mb-4">Basic Information</h3>
              <div className="grid grid-cols-1 gap-y-6 gap-x-4 sm:grid-cols-2">
                <div>
                  <label className="block text-sm font-medium text-zinc-700">License Plate</label>
                  <input type="text" name="licensePlate" required inputMode="text" value={formData.licensePlate || ''} onChange={handleChange} className={inputClass} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-zinc-700">Brand</label>
                  <input type="text" name="brand" required value={formData.brand || ''} onChange={handleChange} className={inputClass} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-zinc-700">Model</label>
                  <input type="text" name="model" required value={formData.model || ''} onChange={handleChange} className={inputClass} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-zinc-700">Year</label>
                  <input type="text" name="year" required inputMode="numeric" maxLength={4} value={formData.year || ''} onChange={handleChange} className={inputClass} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-zinc-700">Color</label>
                  <input type="text" name="color" required value={formData.color || ''} onChange={handleChange} className={inputClass} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-zinc-700">Renavam</label>
                  <input type="text" name="renavam" required inputMode="numeric" value={formData.renavam || ''} onChange={handleChange} className={inputClass} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-zinc-700">Chassi</label>
                  <input type="text" name="chassi" required value={formData.chassi || ''} onChange={handleChange} className={inputClass} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-zinc-700">Detran (UF)</label>
                  <input type="text" name="detranUF" required maxLength={2} value={formData.detranUF || ''} onChange={handleChange} className={inputClass} />
                </div>
              </div>
            </div>

            {/* Ownership & Tracking */}
            <div>
              <h3 className="text-lg font-medium leading-6 text-zinc-900 border-b border-zinc-200 pb-2 mb-4">Ownership & Tracking</h3>
              <div className="grid grid-cols-1 gap-y-6 gap-x-4 sm:grid-cols-2">
                <div>
                  <label className="block text-sm font-medium text-zinc-700">Acquisition</label>
                  <select name="acquisition" value={formData.acquisition || 'Owned'} onChange={handleChange} className={inputClass}>
                    <option value="Owned">Owned</option>
                    <option value="Rented">Rented</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-zinc-700">Acquisition Date</label>
                  <input type="date" name="acquisitionDate" value={formData.acquisitionDate || ''} onChange={handleChange} className={inputClass} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-zinc-700">Owner</label>
                  <input type="text" name="owner" required value={formData.owner || ''} onChange={handleChange} className={inputClass} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-zinc-700">Fipe Price (R$)</label>
                  <input type="text" name="fipePrice" required inputMode="decimal" value={formData.fipePrice || ''} onChange={handleChange} className={inputClass} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-zinc-700">Tracker</label>
                  <input type="text" name="tracker" required value={formData.tracker || ''} onChange={handleChange} className={inputClass} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-zinc-700">ANTT</label>
                  <input type="text" name="antt" required inputMode="numeric" value={formData.antt || ''} onChange={handleChange} className={inputClass} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-zinc-700">Autonomy (km)</label>
                  <input type="text" name="autonomy" required inputMode="decimal" value={formData.autonomy || ''} onChange={handleChange} className={inputClass} />
                </div>

                {/* CRLV Upload */}
                <div className="sm:col-span-2">
                  <label className="block text-sm font-medium text-zinc-700">CRLV — Documento do Veículo</label>

                  {/* Show existing document link */}
                  {formData.crlvUpload && !selectedFile && (
                    <div className="mt-2 mb-2 flex items-center gap-2 rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-700">
                      <FileText className="h-4 w-4 text-zinc-400 flex-shrink-0" />
                      <span className="flex-1 truncate">Documento atual</span>
                      <a
                        href={formData.crlvUpload}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-700 font-medium"
                      >
                        Visualizar <ExternalLink className="h-3 w-3" />
                      </a>
                    </div>
                  )}

                  <input
                    type="file"
                    name="crlvUpload"
                    accept="application/pdf,image/jpeg,image/png,image/webp"
                    onChange={handleFileChange}
                    className="mt-1 block w-full text-sm text-zinc-500 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-sm file:font-medium file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                  />
                  <p className="mt-1 text-xs text-zinc-400">
                    Formatos aceitos: PDF, JPG, PNG, WEBP. Máximo 10MB.
                    {formData.crlvUpload ? ' Selecionar um novo arquivo irá substituir o atual.' : ''}
                  </p>
                  {selectedFile && (
                    <p className="mt-1 text-xs text-emerald-600 font-medium">
                      ✓ {selectedFile.name} ({(selectedFile.size / 1024 / 1024).toFixed(2)} MB)
                      {selectedFile.type.startsWith('image/') ? ' — será comprimida antes do upload' : ''}
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Technical Specs & Conditional Logic */}
            <div>
              <h3 className="text-lg font-medium leading-6 text-zinc-900 border-b border-zinc-200 pb-2 mb-4">Technical Specifications</h3>
              <div className="grid grid-cols-1 gap-y-6 gap-x-4 sm:grid-cols-2">
                <div>
                  <label className="block text-sm font-medium text-zinc-700">Type</label>
                  <select name="type" value={formData.type || 'Light'} onChange={handleChange} className={inputClass}>
                    <option value="Light">Light</option>
                    <option value="Medium">Medium</option>
                    <option value="Heavy">Heavy</option>
                    <option value="Cavalo">Cavalo</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-zinc-700">Energy Source</label>
                  <select name="energySource" value={formData.energySource || 'Combustão'} onChange={handleChange} className={inputClass}>
                    <option value="Combustão">Combustão</option>
                    <option value="Elétrico">Elétrico</option>
                    <option value="Híbrido">Híbrido</option>
                  </select>
                </div>

                {/* Conditional: Cavalo */}
                {formData.type === 'Cavalo' && (
                  <>
                    <div className="flex items-center h-full pt-6">
                      <input id="semiReboque" name="semiReboque" type="checkbox" checked={formData.semiReboque || false} onChange={handleChange} className="h-4 w-4 rounded border-zinc-300 text-blue-600 focus:ring-blue-600" />
                      <label htmlFor="semiReboque" className="ml-2 block text-sm text-zinc-900">Has Semi-reboque?</label>
                    </div>
                    {formData.semiReboque && (
                      <div>
                        <label className="block text-sm font-medium text-zinc-700">Placa Semi-Reboque</label>
                        <input type="text" name="placaSemiReboque" required value={formData.placaSemiReboque || ''} onChange={handleChange} className={inputClass} />
                      </div>
                    )}
                  </>
                )}

                {/* Conditional: Combustão */}
                {formData.energySource === 'Combustão' && (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-zinc-700">Fuel Type</label>
                      <input type="text" name="fuelType" required value={formData.fuelType || ''} onChange={handleChange} className={inputClass} />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-zinc-700">Tank Capacity (L)</label>
                      <input type="text" name="tankCapacity" required inputMode="decimal" value={formData.tankCapacity || ''} onChange={handleChange} className={inputClass} />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-zinc-700">Avg. Consumption (Km/L)</label>
                      <input type="text" name="avgConsumption" required inputMode="decimal" value={formData.avgConsumption || ''} onChange={handleChange} className={inputClass} />
                    </div>
                  </>
                )}

                <div className="flex items-center h-full pt-6">
                  <input id="coolingEquipment" name="coolingEquipment" type="checkbox" checked={formData.coolingEquipment || false} onChange={handleChange} className="h-4 w-4 rounded border-zinc-300 text-blue-600 focus:ring-blue-600" />
                  <label htmlFor="coolingEquipment" className="ml-2 block text-sm text-zinc-900">Cooling Equipment?</label>
                </div>
                {formData.coolingEquipment && (
                  <div>
                    <label className="block text-sm font-medium text-zinc-700">Cooling Brand/Model</label>
                    <input type="text" name="coolingBrand" placeholder="e.g. Termoking, Thermo Star" required value={formData.coolingBrand || ''} onChange={handleChange} className={inputClass} />
                  </div>
                )}
              </div>
            </div>
          </form>
        </div>

        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-zinc-200 bg-zinc-50 rounded-b-2xl">
          <button type="button" onClick={handleClose} disabled={saving} className="rounded-xl border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-700 shadow-sm hover:bg-zinc-50 focus:outline-none focus:ring-2 focus:ring-zinc-500 focus:ring-offset-2 transition-colors disabled:opacity-50">
            Cancel
          </button>
          <button type="submit" form="vehicle-form" disabled={saving} className="inline-flex justify-center items-center gap-2 rounded-xl border border-transparent bg-orange-500 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-orange-600 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2 transition-colors disabled:opacity-50">
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            {saving ? 'Salvando...' : 'Save Vehicle'}
          </button>
        </div>
      </div>
    </div>
  );
}
