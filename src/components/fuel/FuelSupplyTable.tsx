import React from 'react';

import { formatDate } from '../../lib/dateUtils';

import type { FuelSupply } from '../../types/fuelSupply';

const EMPTY = '—';

const COLUMNS = [
  'Data',
  'Placa',
  'Motorista',
  'Km do veículo',
  'Litros',
  'Valor',
  'Embarcador',
  'Unidade',
  'Posto',
];

function formatOdometer(value: number | null): string {
  if (value === null) return EMPTY;
  return `${value.toLocaleString('pt-BR')} km`;
}

function formatLiters(value: number | null): string {
  if (value === null) return EMPTY;
  return value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatCurrency(value: number | null): string {
  if (value === null) return EMPTY;
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export default function FuelSupplyTable({
  supplies,
  isLoading,
}: {
  supplies: FuelSupply[];
  isLoading: boolean;
}) {
  return (
    <div className="overflow-x-auto rounded-xl border border-zinc-200 bg-white shadow-sm">
      <table className="min-w-full divide-y divide-zinc-200 text-sm">
        <thead className="bg-zinc-50">
          <tr>
            {COLUMNS.map((column) => (
              <th
                key={column}
                scope="col"
                className="px-4 py-3 text-left text-xs font-semibold tracking-wider text-zinc-500 uppercase"
              >
                {column}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-100">
          {isLoading && (
            <tr>
              <td colSpan={COLUMNS.length} className="px-4 py-8 text-center text-zinc-500">
                Carregando abastecimentos…
              </td>
            </tr>
          )}

          {!isLoading && supplies.length === 0 && (
            <tr>
              <td colSpan={COLUMNS.length} className="px-4 py-8 text-center text-zinc-500">
                Nenhum abastecimento no período selecionado.
              </td>
            </tr>
          )}

          {!isLoading &&
            supplies.map((supply) => (
              <tr key={supply.id} className="transition-colors hover:bg-zinc-50">
                <td className="px-4 py-3 whitespace-nowrap text-zinc-700">
                  {formatDate(supply.transactionDate)}
                </td>
                <td className="px-4 py-3 font-medium whitespace-nowrap text-zinc-900">
                  {supply.plate}
                </td>
                <td className="px-4 py-3 text-zinc-700">{supply.driverName ?? EMPTY}</td>
                <td className="px-4 py-3 whitespace-nowrap text-zinc-700">
                  {formatOdometer(supply.odometer)}
                </td>
                <td className="px-4 py-3 whitespace-nowrap text-zinc-700">
                  {formatLiters(supply.amountLiters)}
                </td>
                <td className="px-4 py-3 whitespace-nowrap text-zinc-700">
                  {formatCurrency(supply.totalValue)}
                </td>
                <td className="px-4 py-3 text-zinc-700">
                  {supply.vehicleId === null ? (
                    <span className="text-zinc-400 italic">Não identificado</span>
                  ) : (
                    supply.shipperName ?? EMPTY
                  )}
                </td>
                <td className="px-4 py-3 text-zinc-700">
                  {supply.vehicleId === null ? (
                    <span className="text-zinc-400 italic">Não identificado</span>
                  ) : (
                    supply.operationalUnitName ?? EMPTY
                  )}
                </td>
                <td className="px-4 py-3 text-zinc-700">{supply.supplyLocation ?? EMPTY}</td>
              </tr>
            ))}
        </tbody>
      </table>
    </div>
  );
}
