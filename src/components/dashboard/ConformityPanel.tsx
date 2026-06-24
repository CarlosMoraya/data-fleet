import { AlertTriangle, CalendarClock, FileWarning, FileX, Loader2, ShieldCheck, Truck, UserX } from 'lucide-react';

import ActionQueue from './ActionQueue';
import DashboardKpiCard from './DashboardKpiCard';

import type { ComplianceActionCategory, ComplianceActionItem } from '../../lib/dashboardKpi';

interface ConformityPanelProps {
  documentaryComplianceRate: number;
  expiredDocumentsCount: number;
  expiringDocumentsCount: number;
  missingDocumentsCount: number;
  irregularVehiclesCount: number;
  irregularDriversCount: number;
  criticalItemsCount: number;
  actionItems: ComplianceActionItem[];
  onActionClick?: (category: ComplianceActionCategory) => void;
  isLoading?: boolean;
}

export default function ConformityPanel({
  documentaryComplianceRate,
  expiredDocumentsCount,
  expiringDocumentsCount,
  missingDocumentsCount,
  irregularVehiclesCount,
  irregularDriversCount,
  criticalItemsCount,
  actionItems,
  onActionClick,
  isLoading = false,
}: ConformityPanelProps) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-zinc-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        <DashboardKpiCard icon={ShieldCheck} iconBgClass="bg-emerald-50" iconColorClass="text-emerald-600" label="Conformidade Documental" value={`${documentaryComplianceRate}%`} />
        <DashboardKpiCard icon={FileWarning} iconBgClass="bg-red-50" iconColorClass="text-red-600" label="Documentos Vencidos" value={expiredDocumentsCount} isAlert={expiredDocumentsCount > 0} />
        <DashboardKpiCard icon={CalendarClock} iconBgClass="bg-amber-50" iconColorClass="text-amber-600" label="Documentos a Vencer em 30 dias" value={expiringDocumentsCount} />
        <DashboardKpiCard icon={FileX} iconBgClass="bg-orange-50" iconColorClass="text-orange-600" label="Documentos Ausentes" value={missingDocumentsCount} isAlert={missingDocumentsCount > 0} />
        <DashboardKpiCard icon={Truck} iconBgClass="bg-blue-50" iconColorClass="text-blue-600" label="Veículos Irregulares" value={irregularVehiclesCount} isAlert={irregularVehiclesCount > 0} />
        <DashboardKpiCard icon={UserX} iconBgClass="bg-violet-50" iconColorClass="text-violet-600" label="Motoristas Irregulares" value={irregularDriversCount} isAlert={irregularDriversCount > 0} />
        <DashboardKpiCard icon={AlertTriangle} iconBgClass="bg-red-50" iconColorClass="text-red-600" label="Itens Críticos" value={criticalItemsCount} isAlert={criticalItemsCount > 0} />
      </div>

      <ActionQueue
        items={actionItems}
        title="Fila de Ação Documental"
        onItemClick={onActionClick ? (category) => onActionClick(category as ComplianceActionCategory) : undefined}
      />
    </div>
  );
}
