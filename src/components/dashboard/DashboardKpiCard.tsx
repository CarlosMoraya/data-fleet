import React from 'react';
import { LucideIcon } from 'lucide-react';
import { cn } from '../../lib/utils';

interface DashboardKpiCardProps {
  icon: LucideIcon;
  iconBgClass: string;
  iconColorClass: string;
  label: string;
  value: number | string;
  subtitle?: string;
  isAlert?: boolean;
}

export default function DashboardKpiCard({
  icon: Icon,
  iconBgClass,
  iconColorClass,
  label,
  value,
  subtitle,
  isAlert,
}: DashboardKpiCardProps) {
  return (
    <div
      className={cn(
        'rounded-2xl border bg-white p-6 shadow-sm',
        isAlert && Number(value) > 0
          ? 'border-red-200 bg-red-50'
          : 'border-zinc-200'
      )}
    >
      <div className="flex items-center gap-4">
        <div
          className={cn(
            'flex h-12 w-12 shrink-0 items-center justify-center rounded-xl',
            isAlert && Number(value) > 0 ? 'bg-red-100 text-red-600' : iconBgClass
          )}
        >
          <Icon
            className={cn(
              'h-6 w-6',
              isAlert && Number(value) > 0 ? 'text-red-600' : iconColorClass
            )}
          />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-medium text-zinc-500 truncate">{label}</p>
          <p
            className={cn(
              'text-2xl font-semibold',
              isAlert && Number(value) > 0 ? 'text-red-700' : 'text-zinc-900'
            )}
          >
            {value}
          </p>
          {subtitle && (
            <p className="text-xs text-zinc-400 mt-0.5 truncate">{subtitle}</p>
          )}
        </div>
      </div>
    </div>
  );
}
