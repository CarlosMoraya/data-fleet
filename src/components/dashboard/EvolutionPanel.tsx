import { Loader2 } from 'lucide-react';
import React, { useMemo, lazy, Suspense } from 'react';

import {
  buildCostTrendSeries,
  buildMonthlyOrderCounts,
  buildMonthlyAverageCompletionDays,
  buildMonthlyMaintenanceTypeCounts,
} from '../../lib/dashboardKpi';
import RouteFallback from '../RouteFallback';

import HorizonSelector from './HorizonSelector';

import type { HorizonOption } from '../../lib/dashboardKpi';
import type { MaintenanceOrderDashboard } from '../../types/maintenance';

const CostTrendChart = lazy(() => import('./CostTrendChart'));
const MonthlyMultiBarChart = lazy(() => import('./MonthlyMultiBarChart'));

const fmt = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const formatCurrency = (v: number) => fmt.format(v);

interface EvolutionPanelProps {
  orders: MaintenanceOrderDashboard[];
  horizon: HorizonOption;
  onHorizonChange: (h: HorizonOption) => void;
  dateRange: { from: string; to: string };
  isLoading?: boolean;
}

export default function EvolutionPanel({
  orders,
  horizon,
  onHorizonChange,
  dateRange,
  isLoading = false,
}: EvolutionPanelProps) {
  const costSeries = useMemo(
    () => buildCostTrendSeries(orders, dateRange.from, dateRange.to, 'month'),
    [orders, dateRange.from, dateRange.to],
  );

  const avgDaysSeries = useMemo(
    () => buildMonthlyAverageCompletionDays(orders, dateRange.from, dateRange.to),
    [orders, dateRange.from, dateRange.to],
  );

  const orderCountsData = useMemo(() => {
    const raw = buildMonthlyOrderCounts(orders, dateRange.from, dateRange.to);
    return raw.map((r) => ({
      name: r.name,
      Abertas: r.opened,
      Concluidas: r.completed,
    }));
  }, [orders, dateRange.from, dateRange.to]);

  const typeCountsData = useMemo(
    () => buildMonthlyMaintenanceTypeCounts(orders, dateRange.from, dateRange.to),
    [orders, dateRange.from, dateRange.to],
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-zinc-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <HorizonSelector value={horizon} onChange={onHorizonChange} />

      <Suspense fallback={<RouteFallback />}>
        <CostTrendChart
          data={costSeries}
          title="Custo Mensal de Manutenção"
          valueFormatter={formatCurrency}
        />

        <CostTrendChart
          data={avgDaysSeries}
          title="Tempo Médio de Conclusão de OS por Mês"
          valueFormatter={(v) => `${v}d`}
        />

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <MonthlyMultiBarChart
            data={orderCountsData}
            title="OS por Mês (Abertas vs Concluídas)"
            stacked={false}
            series={[
              { key: 'Abertas', label: 'Abertas', color: '#3b82f6' },
              { key: 'Concluidas', label: 'Concluídas', color: '#10b981' },
            ]}
          />

          <MonthlyMultiBarChart
            data={typeCountsData}
            title="Distribuição Mensal por Tipo de Manutenção"
            stacked={true}
            series={[
              { key: 'Corretiva', label: 'Corretiva', color: '#ef4444' },
              { key: 'Preventiva', label: 'Preventiva', color: '#3b82f6' },
              { key: 'Preditiva', label: 'Preditiva', color: '#8b5cf6' },
            ]}
          />
        </div>
      </Suspense>
    </div>
  );
}
