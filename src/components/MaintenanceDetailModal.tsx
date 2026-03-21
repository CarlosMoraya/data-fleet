import React from 'react';
import { X, Wrench, Building2, Calendar, User, FileText, DollarSign, Clock, ExternalLink, BadgeCheck } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { cn } from '../lib/utils';
import type { MaintenanceOrder } from '../pages/Maintenance';
import { supabase } from '../lib/supabase';
import BudgetItemsTable from './BudgetItemsTable';
import { budgetItemFromRow, type MaintenanceBudgetItemRow } from '../lib/maintenanceMappers';

interface Props {
  order: MaintenanceOrder;
  onClose: () => void;
}

function statusColor(status: MaintenanceOrder['status']) {
  switch (status) {
    case 'Aguardando orçamento':  return 'bg-yellow-100 text-yellow-800';
    case 'Aguardando aprovação':  return 'bg-orange-100 text-orange-800';
    case 'Orçamento aprovado':    return 'bg-blue-100 text-blue-800';
    case 'Serviço em execução':   return 'bg-orange-100 text-orange-800';
    case 'Concluído':             return 'bg-green-100 text-green-800';
    case 'Cancelado':             return 'bg-zinc-100 text-zinc-500';
  }
}

function budgetStatusLabel(status: string) {
  switch (status) {
    case 'pendente':   return { label: 'Aguardando Aprovação', cls: 'bg-yellow-100 text-yellow-800' };
    case 'aprovado':   return { label: 'Aprovado', cls: 'bg-green-100 text-green-800' };
    case 'reprovado':  return { label: 'Reprovado', cls: 'bg-red-100 text-red-800' };
    default:           return { label: 'Sem Orçamento', cls: 'bg-zinc-100 text-zinc-500' };
  }
}

function typeColor(type: MaintenanceOrder['type']) {
  switch (type) {
    case 'Corretiva':  return 'bg-red-100 text-red-800';
    case 'Preventiva': return 'bg-blue-100 text-blue-800';
    case 'Preditiva':  return 'bg-purple-100 text-purple-800';
  }
}

function daysInWorkshop(entryDate: string) {
  const entry = new Date(entryDate);
  const today = new Date();
  return Math.floor((today.getTime() - entry.getTime()) / 86400000);
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('pt-BR');
}

function formatCurrency(value: number) {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function Field({ label, value, className }: { label: string; value: React.ReactNode; className?: string }) {
  return (
    <div className={cn('flex flex-col gap-0.5', className)}>
      <span className="text-xs font-medium text-zinc-400 uppercase tracking-wide">{label}</span>
      <span className="text-sm text-zinc-800">{value ?? '—'}</span>
    </div>
  );
}

export default function MaintenanceDetailModal({ order, onClose }: Props) {
  const days = daysInWorkshop(order.entryDate);

  const hasBudget = order.budgetStatus && order.budgetStatus !== 'sem_orcamento';

  const { data: budgetItems = [] } = useQuery({
    queryKey: ['budgetItems', order.id],
    enabled: !!hasBudget,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('maintenance_budget_items')
        .select('*')
        .eq('maintenance_order_id', order.id)
        .order('sort_order');
      if (error) throw error;
      return (data as MaintenanceBudgetItemRow[]).map(budgetItemFromRow);
    },
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">

        {/* Header */}
        <div className="flex items-start justify-between p-6 border-b border-zinc-100">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Wrench className="h-5 w-5 text-orange-500" />
              <h2 className="text-lg font-bold text-zinc-900">{order.os}</h2>
            </div>
            <div className="flex items-center gap-2">
              <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium', typeColor(order.type))}>
                {order.type}
              </span>
              <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium', statusColor(order.status))}>
                {order.status}
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-zinc-400 hover:text-zinc-600 transition-colors p-1 rounded-lg hover:bg-zinc-100"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto p-6 space-y-6">

          {/* Seção 1 — Identificação */}
          <section>
            <div className="flex items-center gap-2 mb-3">
              <FileText className="h-4 w-4 text-zinc-400" />
              <h3 className="text-sm font-semibold text-zinc-600 uppercase tracking-wide">Identificação</h3>
            </div>
            <div className="grid grid-cols-2 gap-4 bg-zinc-50 rounded-xl p-4">
              <Field label="Número da OS" value={order.os} />
              <Field label="Placa do Veículo" value={
                <span className="font-mono font-semibold text-zinc-900">{order.licensePlate}</span>
              } />
            </div>
          </section>

          {/* Seção 2 — Oficina */}
          <section>
            <div className="flex items-center gap-2 mb-3">
              <Building2 className="h-4 w-4 text-zinc-400" />
              <h3 className="text-sm font-semibold text-zinc-600 uppercase tracking-wide">Oficina</h3>
            </div>
            <div className="grid grid-cols-2 gap-4 bg-zinc-50 rounded-xl p-4">
              <Field label="Nome da Oficina" value={order.workshop} className="col-span-2" />
              <Field label="Data de Entrada" value={
                <span className="flex items-center gap-1.5">
                  <Calendar className="h-3.5 w-3.5 text-zinc-400" />
                  {formatDate(order.entryDate)}
                </span>
              } />
              <Field label="Previsão de Saída" value={
                <span className="flex items-center gap-1.5">
                  <Calendar className="h-3.5 w-3.5 text-zinc-400" />
                  {formatDate(order.expectedExitDate)}
                </span>
              } />
              <Field label="Dias em Oficina" value={
                <span className={cn(
                  'flex items-center gap-1.5 font-semibold',
                  days > 10 ? 'text-red-600' : days > 5 ? 'text-orange-600' : 'text-zinc-800'
                )}>
                  <Clock className="h-3.5 w-3.5" />
                  {days} {days === 1 ? 'dia' : 'dias'}
                </span>
              } />
            </div>
          </section>

          {/* Seção 3 — Serviço */}
          <section>
            <div className="flex items-center gap-2 mb-3">
              <Wrench className="h-4 w-4 text-zinc-400" />
              <h3 className="text-sm font-semibold text-zinc-600 uppercase tracking-wide">Serviço</h3>
            </div>
            <div className="grid grid-cols-2 gap-4 bg-zinc-50 rounded-xl p-4">
              <Field label="Descrição do Serviço" value={order.description} className="col-span-2" />
              <Field label="Mecânico Responsável" value={
                <span className="flex items-center gap-1.5">
                  <User className="h-3.5 w-3.5 text-zinc-400" />
                  {order.mechanicName}
                </span>
              } />
              <Field label="Valor Estimado" value={
                <span className="flex items-center gap-1.5">
                  <DollarSign className="h-3.5 w-3.5 text-zinc-400" />
                  {formatCurrency(order.estimatedCost)}
                </span>
              } />
              {order.approvedCost !== undefined && (
                <Field label="Valor Aprovado" value={
                  <span className="flex items-center gap-1.5 text-green-700 font-semibold">
                    <DollarSign className="h-3.5 w-3.5" />
                    {formatCurrency(order.approvedCost)}
                  </span>
                } />
              )}
            </div>
          </section>

          {/* Seção 4 — Orçamento */}
          {(hasBudget || order.budgetPdfUrl) && (
            <section>
              <div className="flex items-center gap-2 mb-3">
                <BadgeCheck className="h-4 w-4 text-zinc-400" />
                <h3 className="text-sm font-semibold text-zinc-600 uppercase tracking-wide">Orçamento</h3>
              </div>
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-4 bg-zinc-50 rounded-xl p-4">
                  {order.budgetStatus && (
                    <div className="flex flex-col gap-0.5">
                      <span className="text-xs font-medium text-zinc-400 uppercase tracking-wide">Status</span>
                      <span className={cn(
                        'self-start text-xs px-2 py-0.5 rounded-full font-medium',
                        budgetStatusLabel(order.budgetStatus).cls
                      )}>
                        {budgetStatusLabel(order.budgetStatus).label}
                      </span>
                    </div>
                  )}
                  {order.budgetPdfUrl && (
                    <div className="flex flex-col gap-0.5">
                      <span className="text-xs font-medium text-zinc-400 uppercase tracking-wide">PDF do Orçamento</span>
                      <a
                        href={order.budgetPdfUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 text-sm text-orange-600 hover:text-orange-700 font-medium"
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                        Ver PDF
                      </a>
                    </div>
                  )}
                  {order.budgetReviewedBy && (
                    <Field label="Revisado por" value={order.budgetReviewedBy} />
                  )}
                  {order.budgetReviewedAt && (
                    <Field label="Revisado em" value={formatDate(order.budgetReviewedAt)} />
                  )}
                </div>
                {budgetItems.length > 0 && (
                  <BudgetItemsTable items={budgetItems} readOnly />
                )}
              </div>
            </section>
          )}

          {/* Seção 5 — Registro */}
          <section>
            <div className="flex items-center gap-2 mb-3">
              <User className="h-4 w-4 text-zinc-400" />
              <h3 className="text-sm font-semibold text-zinc-600 uppercase tracking-wide">Registro</h3>
            </div>
            <div className="grid grid-cols-2 gap-4 bg-zinc-50 rounded-xl p-4">
              <Field label="Criado por" value={order.createdBy} />
              <Field label="Criado em" value={formatDate(order.createdAt)} />
              {order.notes && (
                <Field label="Observações" value={order.notes} className="col-span-2" />
              )}
            </div>
          </section>
        </div>

        {/* Footer */}
        <div className="border-t border-zinc-100 p-4 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-lg bg-zinc-100 text-zinc-700 text-sm font-medium hover:bg-zinc-200 transition-colors"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}
