import React from 'react';

import { formatDate } from '../../lib/dateUtils';

import type { MeliUtilizationRow } from '../../types/meliUtilization';

const EMPTY = '—';
const COLUMNS = [
  'Placa',
  'Motorista',
  'Id da Rota',
  'Data da Rota',
  'Unidade Operacional',
  'Ciclo',
  'KM rodado',
  'Status',
];

function formatDistance(value: number | null): string {
  if (value === null) return EMPTY;
  return value.toLocaleString('pt-BR', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });
}

export default function MeliUtilizationTable({
  rows,
  loading,
}: {
  rows: MeliUtilizationRow[];
  loading: boolean;
}) {
  return (
    <div className="overflow-x-auto rounded-xl border border-zinc-200 bg-white shadow-sm">
      <table className="min-w-full divide-y divide-zinc-200 text-sm">
        <thead className="sticky top-0 bg-zinc-50">
          <tr>
            {COLUMNS.map((column) => (
              <th
                key={column}
                scope="col"
                className="px-4 py-3 text-left text-xs font-semibold tracking-wider whitespace-nowrap text-zinc-500 uppercase"
              >
                {column}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-100">
          {loading && (
            <tr>
              <td colSpan={COLUMNS.length} className="px-4 py-8 text-center text-zinc-500">
                Carregando utilização MELI…
              </td>
            </tr>
          )}

          {!loading && rows.length === 0 && (
            <tr>
              <td colSpan={COLUMNS.length} className="px-4 py-8 text-center text-zinc-500">
                Nenhum veículo MELI dedicado encontrado no período selecionado.
              </td>
            </tr>
          )}

          {!loading &&
            rows.map((row) => (
              <tr key={row.key} className="transition-colors hover:bg-zinc-50">
                <td className="px-4 py-3 whitespace-nowrap">
                  <p className="font-medium text-zinc-900">{row.licensePlate}</p>
                  <p className="text-xs text-zinc-500">{row.vehicleDescription || EMPTY}</p>
                  <span
                    className={
                      row.utilized
                        ? 'mt-1 inline-flex rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700'
                        : 'mt-1 inline-flex rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-600'
                    }
                  >
                    {row.utilized ? 'Utilizado' : 'Não utilizado'}
                  </span>
                </td>
                <td className="px-4 py-3 text-zinc-700">
                  <p>{row.driverName ?? EMPTY}</p>
                  {row.driverDivergent && (
                    <p
                      className="text-xs text-amber-600"
                      title="Motorista da rota diverge do motorista cadastrado no BetaFleet"
                    >
                      Cadastro: {row.fleetDriverName ?? EMPTY}
                    </p>
                  )}
                </td>
                <td className="px-4 py-3 whitespace-nowrap text-zinc-700">
                  {row.routeId ?? EMPTY}
                </td>
                <td className="px-4 py-3 whitespace-nowrap text-zinc-700">
                  {formatDate(row.routeDate)}
                </td>
                <td className="px-4 py-3 text-zinc-700">
                  <p>{row.unitCode ?? EMPTY}</p>
                  {row.unitDivergent && (
                    <p
                      className="text-xs text-amber-600"
                      title="Unidade da rota diverge da unidade cadastrada no BetaFleet"
                    >
                      Cadastro: {row.fleetUnitCode ?? EMPTY}
                    </p>
                  )}
                </td>
                <td className="px-4 py-3 text-zinc-700">{row.cycle ?? EMPTY}</td>
                <td className="px-4 py-3 whitespace-nowrap text-zinc-700">
                  {formatDistance(row.odometerDistanceKm)}
                </td>
                <td className="px-4 py-3 text-zinc-700">
                  <p>{row.unavailableOnDate ? 'Indisponível' : 'Disponível'}</p>
                  {row.statusDivergent && (
                    <p
                      className="text-xs text-amber-600"
                      title="Há uma rota registrada em data na qual o veículo estava indisponível"
                    >
                      Rota registrada com veículo indisponível
                    </p>
                  )}
                </td>
              </tr>
            ))}
        </tbody>
      </table>
    </div>
  );
}
