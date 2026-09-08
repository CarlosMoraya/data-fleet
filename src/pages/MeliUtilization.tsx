import { useQuery } from '@tanstack/react-query';
import { Download } from 'lucide-react';
import React, { useMemo, useState } from 'react';
import { Navigate, useSearchParams } from 'react-router-dom';

import MeliUtilizationFiltersBar from '../components/meli/MeliUtilizationFiltersBar';
import MeliUtilizationKpiCards from '../components/meli/MeliUtilizationKpiCards';
import MeliUtilizationTable from '../components/meli/MeliUtilizationTable';
import { useAuth } from '../context/AuthContext';
import { useMeliUtilizationAccess } from '../hooks/useMeliUtilizationAccess';
import { downloadBlobFile } from '../lib/downloadBlobFile';
import {
  buildUtilizationRows,
  calculateUtilizationKpis,
  defaultDateRange,
  filterRowsByPlate,
  filterRowsByUnit,
  filterRowsByUtilization,
  parseMeliUtilizationStatusFilter,
} from '../lib/meliUtilization';
import { supabase } from '../lib/supabase';
import { appendMultiValueParam, readMultiValueParam } from '../lib/vehicleFilters';
import { XlsxMeliUtilizationProvider } from '../services/meliExport/xlsxMeliUtilizationProvider';
import { getMeliRouteHistory } from '../services/meliUtilizationService';

import type {
  MeliEligibleVehicle,
  MeliMaintenanceWindow,
  MeliUtilizationStatusFilter,
} from '../types/meliUtilization';

export default function MeliUtilization() {
  const { currentClient } = useAuth();
  const { canView } = useMeliUtilizationAccess();
  const [searchParams, setSearchParams] = useSearchParams();
  const [range, setRange] = useState(() => defaultDateRange(new Date()));

  const selectedUnits = useMemo(() => readMultiValueParam(searchParams, 'unit'), [searchParams]);
  const plateQuery = searchParams.get('plate') ?? '';
  const utilizationFilter = parseMeliUtilizationStatusFilter(searchParams.get('utilization'));

  const vehiclesQuery = useQuery({
    queryKey: ['meliUtilizationVehicles', currentClient?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('vehicles')
        .select('id, license_plate, brand, model, driver_id, drivers(name), operational_units(code), shippers(name)')
        .eq('client_id', currentClient!.id)
        .eq('is_dedicated', true)
        .eq('shippers.name', 'MERCADO LIVRE');
      if (error) throw error;
      return data as unknown as Array<{
        id: string;
        license_plate: string;
        brand: string | null;
        model: string | null;
        drivers: { name: string } | null;
        operational_units: { code: string } | null;
      }>;
    },
    enabled: canView && !!currentClient?.id,
  });

  const historyQuery = useQuery({
    queryKey: ['meliUtilizationHistory', currentClient?.id, range.from, range.to],
    queryFn: () => getMeliRouteHistory(range),
    enabled: canView && !!currentClient?.id,
  });

  const maintenanceQuery = useQuery({
    queryKey: ['meliUtilizationMaintenance', currentClient?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('maintenance_orders')
        .select('vehicle_id, entry_date, actual_exit_date, status')
        .eq('client_id', currentClient!.id);
      if (error) throw error;
      return data as Array<{
        vehicle_id: string;
        entry_date: string;
        actual_exit_date: string | null;
        status: string;
      }>;
    },
    enabled: canView && !!currentClient?.id,
  });

  const eligibleVehicles = useMemo<MeliEligibleVehicle[]>(() => {
    return (vehiclesQuery.data ?? []).map((row) => ({
      id: row.id,
      licensePlate: row.license_plate,
      brand: row.brand,
      model: row.model,
      driverName: row.drivers?.name ?? null,
      unitCode: row.operational_units?.code ?? null,
    }));
  }, [vehiclesQuery.data]);

  const maintenanceWindows = useMemo<MeliMaintenanceWindow[]>(() => {
    return (maintenanceQuery.data ?? []).map((row) => ({
      vehicleId: row.vehicle_id,
      entryDate: row.entry_date,
      exitDate: row.actual_exit_date,
      status: row.status,
    }));
  }, [maintenanceQuery.data]);

  const rows = useMemo(() => {
    if (!eligibleVehicles.length) return [];
    return buildUtilizationRows({
      vehicles: eligibleVehicles,
      routes: historyQuery.data ?? [],
      maintenanceWindows,
      from: range.from,
      to: range.to,
    });
  }, [eligibleVehicles, historyQuery.data, maintenanceWindows, range.from, range.to]);

  const filteredRows = useMemo(
    () =>
      filterRowsByUtilization(
        filterRowsByPlate(filterRowsByUnit(rows, selectedUnits), plateQuery),
        utilizationFilter,
      ),
    [rows, selectedUnits, plateQuery, utilizationFilter],
  );
  const kpis = useMemo(() => calculateUtilizationKpis(filteredRows), [filteredRows]);

  const unitOptions = useMemo(() => {
    const codes = new Set<string>();
    for (const row of rows) {
      if (row.unitCode) codes.add(row.unitCode);
    }
    return [...codes]
      .sort((left, right) => left.localeCompare(right, undefined, { sensitivity: 'base' }))
      .map((code) => ({ value: code, label: code }));
  }, [rows]);

  if (!canView) return <Navigate to="/" replace />;

  const handleUnitsChange = (next: string[]) => {
    const params = new URLSearchParams(searchParams);
    params.delete('unit');
    appendMultiValueParam(params, 'unit', next);
    setSearchParams(params);
  };

  const handlePlateQueryChange = (next: string) => {
    const params = new URLSearchParams(searchParams);
    if (next) params.set('plate', next);
    else params.delete('plate');
    setSearchParams(params);
  };

  const handleUtilizationFilterChange = (next: MeliUtilizationStatusFilter) => {
    const params = new URLSearchParams(searchParams);
    if (next === 'all') params.delete('utilization');
    else params.set('utilization', next);
    setSearchParams(params);
  };

  const handleExportXlsx = async () => {
    try {
      if (filteredRows.length === 0) {
        window.alert('Nada a exportar.');
        return;
      }
      const provider = new XlsxMeliUtilizationProvider();
      const result = await provider.exportData(currentClient?.id ?? '', filteredRows);
      if (!result.success || !result.blob) {
        window.alert('Nada a exportar.');
        return;
      }
      downloadBlobFile(result.blob, `utilizacao_meli_${new Date().toISOString().slice(0, 10)}.xlsx`);
    } catch (err) {
      window.alert(err instanceof Error ? err.message : 'Falha ao gerar XLSX.');
    }
  };

  const loading =
    vehiclesQuery.isLoading || historyQuery.isLoading || maintenanceQuery.isLoading;

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-900">Utilização MELI</h1>
          <p className="text-sm text-zinc-500">
            Espelho do histórico de rotas do Mercado Livre cruzado com a frota dedicada.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => { void handleExportXlsx(); }}
            className="flex items-center gap-1.5 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50"
          >
            <Download className="h-4 w-4" />
            Baixar XLSX
          </button>
        </div>
      </div>

      <MeliUtilizationFiltersBar
        range={range}
        onRangeChange={setRange}
        plateQuery={plateQuery}
        onPlateQueryChange={handlePlateQueryChange}
        utilizationFilter={utilizationFilter}
        onUtilizationFilterChange={handleUtilizationFilterChange}
        unitOptions={unitOptions}
        selectedUnits={selectedUnits}
        onUnitsChange={handleUnitsChange}
        disabled={loading}
      />

      {historyQuery.isError ? (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <span>Não foi possível carregar o histórico de rotas.</span>
          <button
            type="button"
            onClick={() => void historyQuery.refetch()}
            className="rounded-lg border border-red-300 bg-white px-3 py-1.5 text-xs font-medium text-red-700 transition-colors hover:bg-red-100"
          >
            Tentar novamente
          </button>
        </div>
      ) : (
        <>
          <MeliUtilizationKpiCards kpis={kpis} loading={loading} />
          <MeliUtilizationTable rows={filteredRows} loading={loading} />
        </>
      )}
    </div>
  );
}
