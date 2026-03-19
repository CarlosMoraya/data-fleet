import React, { useState, useMemo, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Gauge, Loader2, ChevronLeft, ChevronRight, X } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { cn } from '../lib/utils';

interface Props {
  clientId: string;
  userId: string;
}

interface VehicleRow {
  id: string;
  license_plate: string;
  brand: string;
  model: string;
  category: string | null;
}

interface IntervalRow {
  id: string;
  vehicle_id: string;
  km_interval: number | null;
}

interface VehicleWithInterval extends VehicleRow {
  kmInterval: number | null;
  intervalId: string | null;
}

const PAGE_SIZE = 50;

export default function VehicleKmIntervalSettings({ clientId, userId }: Props) {
  const queryClient = useQueryClient();

  const [filterBrand, setFilterBrand] = useState('');
  const [filterModel, setFilterModel] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [dirty, setDirty] = useState<Record<string, number | null>>({});
  const [bulkKm, setBulkKm] = useState('');
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Reset on client change
  useEffect(() => {
    setDirty({});
    setCurrentPage(1);
    setFilterBrand('');
    setFilterModel('');
    setFilterCategory('');
    setSaveSuccess(false);
    setSaveError(null);
    setBulkKm('');
  }, [clientId]);

  const vehiclesQuery = useQuery({
    queryKey: ['vehiclesForKmIntervals', clientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('vehicles')
        .select('id, license_plate, brand, model, category')
        .eq('client_id', clientId)
        .order('license_plate');
      if (error) throw error;
      return data as VehicleRow[];
    },
    enabled: !!clientId,
  });

  const intervalsQuery = useQuery({
    queryKey: ['vehicleKmIntervals', clientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('vehicle_km_intervals')
        .select('id, vehicle_id, km_interval')
        .eq('client_id', clientId);
      if (error) throw error;
      return data as IntervalRow[];
    },
    enabled: !!clientId,
  });

  const allVehicles = useMemo<VehicleWithInterval[]>(() => {
    const vehicles = vehiclesQuery.data ?? [];
    const intervals = intervalsQuery.data ?? [];
    const intervalMap = new Map(intervals.map(i => [i.vehicle_id, i]));
    return vehicles.map(v => {
      const interval = intervalMap.get(v.id);
      return {
        ...v,
        kmInterval: interval?.km_interval ?? null,
        intervalId: interval?.id ?? null,
      };
    });
  }, [vehiclesQuery.data, intervalsQuery.data]);

  const availableBrands = useMemo(() => {
    const brands = new Set(allVehicles.map(v => v.brand).filter(Boolean));
    return Array.from(brands).sort();
  }, [allVehicles]);

  const filteredVehicles = useMemo(() => {
    return allVehicles.filter(v => {
      if (filterBrand && v.brand !== filterBrand) return false;
      if (filterModel && !v.model.toLowerCase().includes(filterModel.toLowerCase())) return false;
      if (filterCategory && v.category !== filterCategory) return false;
      return true;
    });
  }, [allVehicles, filterBrand, filterModel, filterCategory]);

  const totalPages = Math.max(1, Math.ceil(filteredVehicles.length / PAGE_SIZE));
  const safePage = Math.min(currentPage, totalPages);
  const paginatedVehicles = filteredVehicles.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
  const dirtyCount = Object.keys(dirty).length;

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [filterBrand, filterModel, filterCategory]);

  const handleKmChange = (vehicleId: string, value: string) => {
    setSaveSuccess(false);
    if (value === '') {
      setDirty(prev => ({ ...prev, [vehicleId]: null }));
    } else {
      const parsed = parseInt(value, 10);
      if (!isNaN(parsed) && parsed > 0) {
        setDirty(prev => ({ ...prev, [vehicleId]: parsed }));
      }
    }
  };

  const handleBulkApply = () => {
    const km = parseInt(bulkKm, 10);
    if (isNaN(km) || km <= 0) return;
    const newDirty = { ...dirty };
    filteredVehicles.forEach(v => { newDirty[v.id] = km; });
    setDirty(newDirty);
    setSaveSuccess(false);
  };

  const handleClearFilters = () => {
    setFilterBrand('');
    setFilterModel('');
    setFilterCategory('');
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      const rows = Object.entries(dirty).map(([vehicleId, km]) => ({
        client_id: clientId,
        vehicle_id: vehicleId,
        km_interval: km,
        updated_by: userId,
        updated_at: new Date().toISOString(),
      }));
      if (rows.length === 0) return;
      const { error } = await supabase
        .from('vehicle_km_intervals')
        .upsert(rows, { onConflict: 'vehicle_id' });
      if (error) throw error;
    },
    onSuccess: () => {
      setDirty({});
      setSaveSuccess(true);
      setSaveError(null);
      queryClient.invalidateQueries({ queryKey: ['vehicleKmIntervals', clientId] });
    },
    onError: (err: Error) => {
      setSaveError(err.message ?? 'Erro ao salvar configurações.');
    },
  });

  const isLoading = vehiclesQuery.isLoading || intervalsQuery.isLoading;
  const hasFilters = !!filterBrand || !!filterModel || !!filterCategory;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-zinc-400" />
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-zinc-200 overflow-hidden animate-in fade-in duration-300">
      {/* Header */}
      <div className="px-6 py-4 border-b border-zinc-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Gauge className="h-5 w-5 text-zinc-400" />
          <div>
            <h2 className="text-lg font-medium text-zinc-900">Km entre Revisões</h2>
            <p className="text-sm text-zinc-500">Configure o quilometragem máxima entre revisões para cada veículo.</p>
          </div>
        </div>
        {dirtyCount > 0 && (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-orange-100 px-3 py-1 text-xs font-medium text-orange-700 shrink-0">
            {dirtyCount} {dirtyCount === 1 ? 'alteração pendente' : 'alterações pendentes'}
          </span>
        )}
      </div>

      {/* Filters */}
      <div className="px-6 py-3 border-b border-zinc-100 bg-zinc-50 flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1">
          <label className="text-xs text-zinc-500 font-medium">Marca</label>
          <select
            value={filterBrand}
            onChange={e => setFilterBrand(e.target.value)}
            className="h-8 rounded-lg border border-zinc-200 bg-white px-2 text-sm text-zinc-800 focus:outline-none focus:ring-2 focus:ring-orange-500"
          >
            <option value="">Todas</option>
            {availableBrands.map(b => (
              <option key={b} value={b}>{b}</option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs text-zinc-500 font-medium">Modelo</label>
          <input
            type="text"
            value={filterModel}
            onChange={e => setFilterModel(e.target.value)}
            placeholder="Buscar modelo..."
            className="h-8 rounded-lg border border-zinc-200 bg-white px-2 text-sm text-zinc-800 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-orange-500"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs text-zinc-500 font-medium">Categoria</label>
          <select
            value={filterCategory}
            onChange={e => setFilterCategory(e.target.value)}
            className="h-8 rounded-lg border border-zinc-200 bg-white px-2 text-sm text-zinc-800 focus:outline-none focus:ring-2 focus:ring-orange-500"
          >
            <option value="">Todas</option>
            <option value="Leve">Leve</option>
            <option value="Médio">Médio</option>
            <option value="Pesado">Pesado</option>
          </select>
        </div>

        {hasFilters && (
          <button
            onClick={handleClearFilters}
            className="flex items-center gap-1 h-8 px-2.5 rounded-lg border border-zinc-200 bg-white text-xs text-zinc-600 hover:bg-zinc-100 transition-colors cursor-pointer"
          >
            <X className="h-3 w-3" />
            Limpar
          </button>
        )}
      </div>

      {/* Bulk apply */}
      <div className="px-6 py-3 border-b border-zinc-100 flex flex-wrap items-center gap-3">
        <span className="text-sm text-zinc-600">
          Aplicar em todos os <span className="font-medium text-zinc-800">{filteredVehicles.length}</span> veículos{hasFilters ? ' filtrados' : ''}:
        </span>
        <div className="flex items-center gap-2">
          <input
            type="number"
            min="1"
            value={bulkKm}
            onChange={e => setBulkKm(e.target.value)}
            placeholder="Ex: 10000"
            className="h-8 w-32 rounded-lg border border-zinc-200 px-2 text-sm text-zinc-800 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-orange-500"
          />
          <span className="text-sm text-zinc-500">km</span>
          <button
            onClick={handleBulkApply}
            disabled={!bulkKm || parseInt(bulkKm, 10) <= 0}
            className="h-8 px-3 rounded-lg bg-orange-50 border border-orange-200 text-xs font-medium text-orange-700 hover:bg-orange-100 transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
          >
            Aplicar
          </button>
        </div>
      </div>

      {/* Feedback */}
      {saveError && (
        <div className="mx-6 mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {saveError}
        </div>
      )}
      {saveSuccess && (
        <div className="mx-6 mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          Configurações salvas com sucesso.
        </div>
      )}

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-100 bg-zinc-50">
              <th className="px-6 py-3 text-left text-xs font-semibold text-zinc-500 uppercase tracking-wider">Placa</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-500 uppercase tracking-wider">Marca</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-500 uppercase tracking-wider">Modelo</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-500 uppercase tracking-wider">Categoria</th>
              <th className="px-6 py-3 text-right text-xs font-semibold text-zinc-500 uppercase tracking-wider">Km entre Revisões</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {paginatedVehicles.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-6 py-12 text-center text-sm text-zinc-400">
                  {allVehicles.length === 0
                    ? 'Nenhum veículo cadastrado para este cliente.'
                    : 'Nenhum veículo encontrado com os filtros aplicados.'}
                </td>
              </tr>
            ) : (
              paginatedVehicles.map(v => {
                const isDirty = v.id in dirty;
                const displayValue = isDirty
                  ? (dirty[v.id] === null ? '' : String(dirty[v.id]))
                  : (v.kmInterval !== null ? String(v.kmInterval) : '');

                return (
                  <tr key={v.id} className={cn('hover:bg-zinc-50 transition-colors', isDirty && 'bg-orange-50/30')}>
                    <td className="px-6 py-3 font-mono text-xs font-medium text-zinc-800">{v.license_plate}</td>
                    <td className="px-4 py-3 text-zinc-700">{v.brand}</td>
                    <td className="px-4 py-3 text-zinc-700">{v.model}</td>
                    <td className="px-4 py-3">
                      {v.category ? (
                        <span className="inline-flex items-center rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-600">
                          {v.category}
                        </span>
                      ) : (
                        <span className="text-zinc-400">—</span>
                      )}
                    </td>
                    <td className="px-6 py-3">
                      <div className="flex items-center justify-end gap-2">
                        <input
                          type="number"
                          min="1"
                          value={displayValue}
                          onChange={e => handleKmChange(v.id, e.target.value)}
                          placeholder="—"
                          className={cn(
                            'w-28 h-8 rounded-lg border px-2 text-sm text-right text-zinc-800 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-orange-500 transition-colors',
                            isDirty ? 'border-orange-300 bg-orange-50' : 'border-zinc-200 bg-white'
                          )}
                        />
                        <span className="text-xs text-zinc-400 w-4">km</span>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="px-6 py-3 border-t border-zinc-100 flex items-center justify-between">
          <span className="text-xs text-zinc-500">
            Página {safePage} de {totalPages} — {filteredVehicles.length} veículos
          </span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={safePage === 1}
              className="flex items-center gap-1 h-8 px-2.5 rounded-lg border border-zinc-200 text-xs text-zinc-600 hover:bg-zinc-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
              Anterior
            </button>
            <button
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={safePage === totalPages}
              className="flex items-center gap-1 h-8 px-2.5 rounded-lg border border-zinc-200 text-xs text-zinc-600 hover:bg-zinc-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
            >
              Próxima
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="px-6 py-4 border-t border-zinc-200 bg-zinc-50 flex items-center justify-end">
        <button
          onClick={() => saveMutation.mutate()}
          disabled={dirtyCount === 0 || saveMutation.isPending}
          className="inline-flex items-center gap-2 rounded-xl bg-orange-500 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-orange-600 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2 transition-colors disabled:opacity-50 cursor-pointer"
        >
          {saveMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
          {saveMutation.isPending
            ? 'Salvando...'
            : dirtyCount > 0
              ? `Salvar ${dirtyCount} ${dirtyCount === 1 ? 'alteração' : 'alterações'}`
              : 'Salvar'}
        </button>
      </div>
    </div>
  );
}
