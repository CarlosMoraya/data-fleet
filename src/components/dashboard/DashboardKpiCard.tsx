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
  onClick?: () => void;
  variant?: 'default' | 'muted';
}

export default function DashboardKpiCard({
  icon: Icon,
  iconBgClass,
  iconColorClass,
  label,
  value,
  subtitle,
  isAlert,
  onClick,
  variant = 'default',
}: DashboardKpiCardProps) {
  const isMuted = variant === 'muted';
  const rootClassName = cn(
    'rounded-2xl border bg-white shadow-sm',
    isMuted ? 'p-4' : 'p-6',
    isAlert && Number(value) > 0
      ? 'border-red-200 bg-red-50'
      : 'border-zinc-200',
    onClick &&
      'w-full cursor-pointer text-left transition-colors hover:border-zinc-300 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-orange-400'
  );

  const content = (
    <div className="flex items-center gap-4">
      <div
        className={cn(
          'flex shrink-0 items-center justify-center',
          isMuted ? 'h-10 w-10 rounded-lg' : 'h-12 w-12 rounded-xl',
          isAlert && Number(value) > 0 ? 'bg-red-100 text-red-600' : iconBgClass
        )}
      >
        <Icon
          className={cn(
            isMuted ? 'h-5 w-5' : 'h-6 w-6',
            isAlert && Number(value) > 0 ? 'text-red-600' : iconColorClass
          )}
        />
      </div>
      <div className="min-w-0">
        <p className="text-sm font-medium text-zinc-500 truncate">{label}</p>
        <p
          className={cn(
            isMuted ? 'text-xl font-semibold' : 'text-2xl font-semibold',
            isAlert && Number(value) > 0 ? 'text-red-700' : 'text-zinc-900'
          )}
        >
          {value}
        </p>
        {subtitle && (
          <p className="mt-0.5 truncate text-xs text-zinc-400">{subtitle}</p>
        )}
      </div>
    </div>
  );

  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={rootClassName}>
        {content}
      </button>
    );
  }

  return <div className={rootClassName}>{content}</div>;
}
