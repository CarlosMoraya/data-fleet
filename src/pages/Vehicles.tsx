import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { MOCK_VEHICLES } from '../constants';
import { Vehicle } from '../types';
import { Plus, Search, Filter, MoreVertical, Edit2, Trash2, Truck } from 'lucide-react';
import VehicleForm from '../components/VehicleForm';
import { cn } from '../lib/utils';

export default function Vehicles() {
  const { currentClient, user } = useAuth();
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingVehicle, setEditingVehicle] = useState<Vehicle | null>(null);
  
  // In a real app, this would be fetched from an API
  const [vehicles, setVehicles] = useState<Vehicle[]>(MOCK_VEHICLES);
  
  const clientVehicles = vehicles.filter(v => v.clientId === currentClient?.id);
  const canEdit = ['Fleet Analyst', 'Manager', 'Director', 'Admin Master'].includes(user?.role || '');

  const handleSave = (vehicle: Vehicle) => {
    if (editingVehicle) {
      setVehicles(vehicles.map(v => v.id === vehicle.id ? vehicle : v));
    } else {
      setVehicles([...vehicles, { ...vehicle, id: `v${Date.now()}`, clientId: currentClient?.id || '' }]);
    }
    setIsFormOpen(false);
    setEditingVehicle(null);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">Vehicles</h1>
          <p className="text-sm text-zinc-500 mt-1">Manage your fleet inventory and details.</p>
        </div>
        
        {canEdit && (
          <button
            onClick={() => {
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
            className="block w-full rounded-xl border border-zinc-200 bg-white py-2.5 pl-10 pr-3 text-sm placeholder-zinc-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 shadow-sm"
            placeholder="Search by plate, model, or chassis..."
          />
        </div>
        <button className="inline-flex items-center justify-center rounded-xl border border-zinc-200 bg-white px-4 py-2.5 text-sm font-medium text-zinc-700 shadow-sm hover:bg-zinc-50 focus:outline-none focus:ring-2 focus:ring-zinc-500 focus:ring-offset-2 transition-colors">
          <Filter className="-ml-1 mr-2 h-5 w-5 text-zinc-400" aria-hidden="true" />
          Filters
        </button>
      </div>

      <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-zinc-200">
            <thead className="bg-zinc-50">
              <tr>
                <th scope="col" className="py-3.5 pl-4 pr-3 text-left text-xs font-semibold text-zinc-500 uppercase tracking-wider sm:pl-6">Vehicle</th>
                <th scope="col" className="px-3 py-3.5 text-left text-xs font-semibold text-zinc-500 uppercase tracking-wider">Type / Energy</th>
                <th scope="col" className="px-3 py-3.5 text-left text-xs font-semibold text-zinc-500 uppercase tracking-wider">Status</th>
                <th scope="col" className="px-3 py-3.5 text-left text-xs font-semibold text-zinc-500 uppercase tracking-wider">Owner</th>
                <th scope="col" className="relative py-3.5 pl-3 pr-4 sm:pr-6">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 bg-white">
              {clientVehicles.map((vehicle) => (
                <tr key={vehicle.id} className="hover:bg-zinc-50 transition-colors">
                  <td className="whitespace-nowrap py-4 pl-4 pr-3 sm:pl-6">
                    <div className="flex items-center">
                      <div className="h-10 w-10 flex-shrink-0 rounded-lg bg-zinc-100 flex items-center justify-center border border-zinc-200">
                        <Truck className="h-5 w-5 text-zinc-500" />
                      </div>
                      <div className="ml-4">
                        <div className="font-medium text-zinc-900">{vehicle.licensePlate}</div>
                        <div className="text-sm text-zinc-500">{vehicle.brandModel} ({vehicle.year})</div>
                      </div>
                    </div>
                  </td>
                  <td className="whitespace-nowrap px-3 py-4 text-sm text-zinc-500">
                    <div className="text-zinc-900">{vehicle.type}</div>
                    <div>{vehicle.energySource}</div>
                  </td>
                  <td className="whitespace-nowrap px-3 py-4 text-sm">
                    <span className={cn(
                      "inline-flex items-center rounded-md px-2 py-1 text-xs font-medium ring-1 ring-inset",
                      vehicle.status === 'Available' ? "bg-green-50 text-green-700 ring-green-600/20" :
                      vehicle.status === 'In Use' ? "bg-blue-50 text-blue-700 ring-blue-600/20" :
                      "bg-amber-50 text-amber-700 ring-amber-600/20"
                    )}>
                      {vehicle.status}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-3 py-4 text-sm text-zinc-500">
                    <div className="text-zinc-900">{vehicle.owner}</div>
                    <div>{vehicle.acquisition}</div>
                  </td>
                  <td className="relative whitespace-nowrap py-4 pl-3 pr-4 text-right text-sm font-medium sm:pr-6">
                    {canEdit && (
                      <button 
                        onClick={() => {
                          setEditingVehicle(vehicle);
                          setIsFormOpen(true);
                        }}
                        className="text-zinc-400 hover:text-zinc-900 transition-colors"
                      >
                        <Edit2 className="h-5 w-5" />
                        <span className="sr-only">Edit</span>
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {clientVehicles.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-10 text-center text-sm text-zinc-500">
                    No vehicles found for this client.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {isFormOpen && (
        <VehicleForm 
          vehicle={editingVehicle} 
          onClose={() => setIsFormOpen(false)} 
          onSave={handleSave} 
        />
      )}
    </div>
  );
}
