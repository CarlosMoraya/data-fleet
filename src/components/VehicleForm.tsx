import React, { useState, useEffect } from 'react';
import { Vehicle } from '../types';
import { X } from 'lucide-react';

interface VehicleFormProps {
  vehicle: Vehicle | null;
  onClose: () => void;
  onSave: (vehicle: Vehicle) => void;
}

export default function VehicleForm({ vehicle, onClose, onSave }: VehicleFormProps) {
  const [formData, setFormData] = useState<Partial<Vehicle>>({
    type: 'Light',
    energySource: 'Combustão',
    coolingEquipment: false,
    status: 'Available',
    acquisition: 'Owned',
    ...vehicle
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    
    if (type === 'checkbox') {
      const checked = (e.target as HTMLInputElement).checked;
      setFormData(prev => ({ ...prev, [name]: checked }));
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData as Vehicle);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 sm:p-6 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-3xl max-h-full flex flex-col my-8">
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-200">
          <h2 className="text-xl font-semibold text-zinc-900">
            {vehicle ? 'Edit Vehicle' : 'Add Vehicle'}
          </h2>
          <div className="flex items-center gap-4">
            {!vehicle && (
              <button
                type="button"
                onClick={() => {
                  setFormData({
                    type: 'Cavalo',
                    energySource: 'Combustão',
                    coolingEquipment: true,
                    coolingBrand: 'Thermo King',
                    status: 'Available',
                    acquisition: 'Owned',
                    licensePlate: 'ABC-1234',
                    brandModel: 'Volvo FH 540',
                    year: 2024,
                    color: 'Branco',
                    renavam: '12345678901',
                    chassi: '9BWZZZ37Z4T000001',
                    detranUF: 'SP',
                    owner: 'Acme Logistics',
                    fipePrice: 650000,
                    tracker: 'Omnilink',
                    antt: '12345678',
                    autonomy: 1400,
                    semiReboque: true,
                    placaSemiReboque: 'XYZ-9876',
                    fuelType: 'Diesel',
                    tankCapacity: 400,
                    avgConsumption: 3.5,
                  });
                }}
                className="text-sm font-medium text-zinc-600 hover:text-zinc-900 transition-colors"
              >
                Fill Mock Data
              </button>
            )}
            <button onClick={onClose} className="text-zinc-400 hover:text-zinc-500 transition-colors">
              <X className="h-6 w-6" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          <form id="vehicle-form" onSubmit={handleSubmit} className="space-y-8">
            {/* Basic Info */}
            <div>
              <h3 className="text-lg font-medium leading-6 text-zinc-900 border-b border-zinc-200 pb-2 mb-4">Basic Information</h3>
              <div className="grid grid-cols-1 gap-y-6 gap-x-4 sm:grid-cols-2">
                <div>
                  <label className="block text-sm font-medium text-zinc-700">License Plate</label>
                  <input type="text" name="licensePlate" required value={formData.licensePlate || ''} onChange={handleChange} className="mt-1 block w-full rounded-xl border border-zinc-300 py-2 px-3 shadow-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 sm:text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-zinc-700">Brand/Model</label>
                  <input type="text" name="brandModel" required value={formData.brandModel || ''} onChange={handleChange} className="mt-1 block w-full rounded-xl border border-zinc-300 py-2 px-3 shadow-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 sm:text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-zinc-700">Year</label>
                  <input type="number" name="year" required value={formData.year || ''} onChange={handleChange} className="mt-1 block w-full rounded-xl border border-zinc-300 py-2 px-3 shadow-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 sm:text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-zinc-700">Color</label>
                  <input type="text" name="color" required value={formData.color || ''} onChange={handleChange} className="mt-1 block w-full rounded-xl border border-zinc-300 py-2 px-3 shadow-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 sm:text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-zinc-700">Renavam</label>
                  <input type="text" name="renavam" required value={formData.renavam || ''} onChange={handleChange} className="mt-1 block w-full rounded-xl border border-zinc-300 py-2 px-3 shadow-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 sm:text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-zinc-700">Chassi</label>
                  <input type="text" name="chassi" required value={formData.chassi || ''} onChange={handleChange} className="mt-1 block w-full rounded-xl border border-zinc-300 py-2 px-3 shadow-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 sm:text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-zinc-700">Detran (UF)</label>
                  <input type="text" name="detranUF" required value={formData.detranUF || ''} onChange={handleChange} className="mt-1 block w-full rounded-xl border border-zinc-300 py-2 px-3 shadow-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 sm:text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-zinc-700">Status</label>
                  <select name="status" value={formData.status || 'Available'} onChange={handleChange} className="mt-1 block w-full rounded-xl border border-zinc-300 py-2 px-3 shadow-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 sm:text-sm">
                    <option value="Available">Available</option>
                    <option value="In Use">In Use</option>
                    <option value="Maintenance">Maintenance</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Ownership & Tracking */}
            <div>
              <h3 className="text-lg font-medium leading-6 text-zinc-900 border-b border-zinc-200 pb-2 mb-4">Ownership & Tracking</h3>
              <div className="grid grid-cols-1 gap-y-6 gap-x-4 sm:grid-cols-2">
                <div>
                  <label className="block text-sm font-medium text-zinc-700">Acquisition</label>
                  <select name="acquisition" value={formData.acquisition || 'Owned'} onChange={handleChange} className="mt-1 block w-full rounded-xl border border-zinc-300 py-2 px-3 shadow-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 sm:text-sm">
                    <option value="Owned">Owned</option>
                    <option value="Rented">Rented</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-zinc-700">Owner</label>
                  <input type="text" name="owner" required value={formData.owner || ''} onChange={handleChange} className="mt-1 block w-full rounded-xl border border-zinc-300 py-2 px-3 shadow-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 sm:text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-zinc-700">Fipe Price (R$)</label>
                  <input type="number" name="fipePrice" required value={formData.fipePrice || ''} onChange={handleChange} className="mt-1 block w-full rounded-xl border border-zinc-300 py-2 px-3 shadow-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 sm:text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-zinc-700">Tracker</label>
                  <input type="text" name="tracker" required value={formData.tracker || ''} onChange={handleChange} className="mt-1 block w-full rounded-xl border border-zinc-300 py-2 px-3 shadow-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 sm:text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-zinc-700">ANTT</label>
                  <input type="text" name="antt" required value={formData.antt || ''} onChange={handleChange} className="mt-1 block w-full rounded-xl border border-zinc-300 py-2 px-3 shadow-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 sm:text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-zinc-700">Autonomy (km)</label>
                  <input type="number" name="autonomy" required value={formData.autonomy || ''} onChange={handleChange} className="mt-1 block w-full rounded-xl border border-zinc-300 py-2 px-3 shadow-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 sm:text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-zinc-700">CRLV Upload</label>
                  <input type="file" name="crlvUpload" className="mt-1 block w-full text-sm text-zinc-500 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-sm file:font-medium file:bg-zinc-50 file:text-zinc-700 hover:file:bg-zinc-100" />
                </div>
              </div>
            </div>

            {/* Technical Specs & Conditional Logic */}
            <div>
              <h3 className="text-lg font-medium leading-6 text-zinc-900 border-b border-zinc-200 pb-2 mb-4">Technical Specifications</h3>
              <div className="grid grid-cols-1 gap-y-6 gap-x-4 sm:grid-cols-2">
                <div>
                  <label className="block text-sm font-medium text-zinc-700">Type</label>
                  <select name="type" value={formData.type || 'Light'} onChange={handleChange} className="mt-1 block w-full rounded-xl border border-zinc-300 py-2 px-3 shadow-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 sm:text-sm">
                    <option value="Light">Light</option>
                    <option value="Medium">Medium</option>
                    <option value="Heavy">Heavy</option>
                    <option value="Cavalo">Cavalo</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-zinc-700">Energy Source</label>
                  <select name="energySource" value={formData.energySource || 'Combustão'} onChange={handleChange} className="mt-1 block w-full rounded-xl border border-zinc-300 py-2 px-3 shadow-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 sm:text-sm">
                    <option value="Combustão">Combustão</option>
                    <option value="Elétrico">Elétrico</option>
                    <option value="Híbrido">Híbrido</option>
                  </select>
                </div>

                {/* Conditional: Cavalo */}
                {formData.type === 'Cavalo' && (
                  <>
                    <div className="flex items-center h-full pt-6">
                      <input id="semiReboque" name="semiReboque" type="checkbox" checked={formData.semiReboque || false} onChange={handleChange} className="h-4 w-4 rounded border-zinc-300 text-zinc-900 focus:ring-zinc-900" />
                      <label htmlFor="semiReboque" className="ml-2 block text-sm text-zinc-900">Has Semi-reboque?</label>
                    </div>
                    {formData.semiReboque && (
                      <div>
                        <label className="block text-sm font-medium text-zinc-700">Placa Semi-Reboque</label>
                        <input type="text" name="placaSemiReboque" required value={formData.placaSemiReboque || ''} onChange={handleChange} className="mt-1 block w-full rounded-xl border border-zinc-300 py-2 px-3 shadow-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 sm:text-sm" />
                      </div>
                    )}
                  </>
                )}

                {/* Conditional: Combustão */}
                {formData.energySource === 'Combustão' && (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-zinc-700">Fuel Type</label>
                      <input type="text" name="fuelType" required value={formData.fuelType || ''} onChange={handleChange} className="mt-1 block w-full rounded-xl border border-zinc-300 py-2 px-3 shadow-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 sm:text-sm" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-zinc-700">Tank Capacity (L)</label>
                      <input type="number" name="tankCapacity" required value={formData.tankCapacity || ''} onChange={handleChange} className="mt-1 block w-full rounded-xl border border-zinc-300 py-2 px-3 shadow-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 sm:text-sm" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-zinc-700">Avg. Consumption (Km/L)</label>
                      <input type="number" step="0.1" name="avgConsumption" required value={formData.avgConsumption || ''} onChange={handleChange} className="mt-1 block w-full rounded-xl border border-zinc-300 py-2 px-3 shadow-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 sm:text-sm" />
                    </div>
                  </>
                )}

                <div className="flex items-center h-full pt-6">
                  <input id="coolingEquipment" name="coolingEquipment" type="checkbox" checked={formData.coolingEquipment || false} onChange={handleChange} className="h-4 w-4 rounded border-zinc-300 text-zinc-900 focus:ring-zinc-900" />
                  <label htmlFor="coolingEquipment" className="ml-2 block text-sm text-zinc-900">Cooling Equipment?</label>
                </div>
                {formData.coolingEquipment && (
                  <div>
                    <label className="block text-sm font-medium text-zinc-700">Cooling Brand/Model</label>
                    <input type="text" name="coolingBrand" placeholder="e.g. Termoking, Thermo Star" required value={formData.coolingBrand || ''} onChange={handleChange} className="mt-1 block w-full rounded-xl border border-zinc-300 py-2 px-3 shadow-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 sm:text-sm" />
                  </div>
                )}
              </div>
            </div>
          </form>
        </div>

        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-zinc-200 bg-zinc-50 rounded-b-2xl">
          <button type="button" onClick={onClose} className="rounded-xl border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-700 shadow-sm hover:bg-zinc-50 focus:outline-none focus:ring-2 focus:ring-zinc-500 focus:ring-offset-2 transition-colors">
            Cancel
          </button>
          <button type="submit" form="vehicle-form" className="inline-flex justify-center rounded-xl border border-transparent bg-zinc-900 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:ring-offset-2 transition-colors">
            Save Vehicle
          </button>
        </div>
      </div>
    </div>
  );
}
