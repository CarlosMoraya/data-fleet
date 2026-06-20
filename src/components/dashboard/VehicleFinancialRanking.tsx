import type { VehicleFinancialRankingRow } from '../../lib/dashboardKpi';

const VEHICLE_RANKING_DISPLAY_LIMIT = 50;

interface VehicleFinancialRankingProps {
  rows: VehicleFinancialRankingRow[];
  onViewHistory: (plate: string) => void;
  valueFormatter: (v: number) => string;
}

export default function VehicleFinancialRanking({
  rows,
  onViewHistory,
  valueFormatter,
}: VehicleFinancialRankingProps) {
  const displayRows = rows.slice(0, VEHICLE_RANKING_DISPLAY_LIMIT);

  if (rows.length === 0) {
    return (
      <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
        <h3 className="text-base font-semibold text-zinc-900">Veículos para Análise</h3>
        <p className="text-xs text-zinc-500 mt-1">Fila de ação financeira — período e filtros aplicados</p>
        <p className="text-sm text-zinc-400 mt-4 text-center">Nenhum veículo com custo no período/filtros selecionados.</p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
      <h3 className="text-base font-semibold text-zinc-900">Veículos para Análise</h3>
      <p className="text-xs text-zinc-500 mt-1">Fila de ação financeira — período e filtros aplicados</p>

      <div className="mt-4 overflow-x-auto">
        <table className="min-w-full divide-y divide-zinc-100">
          <thead>
            <tr className="border-b border-zinc-200">
              <th scope="col" className="px-3 py-2 text-left text-xs font-semibold text-zinc-500 uppercase tracking-wider">Veículo</th>
              <th scope="col" className="px-3 py-2 text-right text-xs font-semibold text-zinc-500 uppercase tracking-wider">Custo Total</th>
              <th scope="col" className="px-3 py-2 text-right text-xs font-semibold text-zinc-500 uppercase tracking-wider">Custo por KM</th>
              <th scope="col" className="px-3 py-2 text-center text-xs font-semibold text-zinc-500 uppercase tracking-wider">Qtd OS</th>
              <th scope="col" className="px-3 py-2 text-center text-xs font-semibold text-zinc-500 uppercase tracking-wider">OS Corretivas</th>
              <th scope="col" className="px-3 py-2 text-center text-xs font-semibold text-zinc-500 uppercase tracking-wider">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-50">
            {displayRows.map((row) => (
              <tr key={row.vehicleId} className="hover:bg-zinc-50 transition-colors">
                <td className="px-3 py-2">
                  <div className="text-sm font-semibold text-zinc-900">{row.plate ?? 'Sem placa'}</div>
                  {row.model && <div className="text-xs text-zinc-500">{row.model}</div>}
                </td>
                <td className="px-3 py-2 text-right text-sm font-medium text-zinc-900">{valueFormatter(row.totalCost)}</td>
                <td className="px-3 py-2 text-right text-sm text-zinc-700">
                  {row.costPerKm != null ? valueFormatter(row.costPerKm) : <span className="text-zinc-400">Sem KM</span>}
                </td>
                <td className="px-3 py-2 text-center text-sm text-zinc-700">{row.orderCount}</td>
                <td className="px-3 py-2 text-center text-sm text-zinc-700">{row.correctiveOrderCount}</td>
                <td className="px-3 py-2 text-center">
                  <button
                    onClick={() => row.plate != null && onViewHistory(row.plate)}
                    disabled={row.plate == null}
                    aria-label={row.plate != null ? `Ver histórico de ${row.plate}` : 'Ver histórico indisponível'}
                    className={
                      row.plate != null
                        ? 'text-xs font-medium text-orange-600 hover:text-orange-700 transition-colors'
                        : 'text-xs font-medium text-zinc-300 cursor-not-allowed'
                    }
                  >
                    Ver histórico
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
