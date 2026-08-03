import { Trash2, Plus, Loader2 } from 'lucide-react';
import React from 'react';

import { BUDGET_SYSTEM_OPTIONS } from '../lib/budgetSystems';
import { calcBudgetItemNet, calcBudgetTotals } from '../lib/maintenanceMappers';

import type { BudgetItem } from '../lib/maintenanceMappers';


interface BudgetItemsTableProps {
  items: BudgetItem[];
  readOnly?: boolean;
  onChange?: (items: BudgetItem[]) => void;
  onSubtotalChange?: (subtotal: number) => void;
  extracting?: boolean;
  orderDiscount?: number;
  onOrderDiscountChange?: (value: number) => void;
  discountsLocked?: boolean;
}

function emptyItem(sortOrder: number): BudgetItem {
  return { itemName: '', system: '', quantity: 1, value: 0, discount: 0, sortOrder };
}

const cellInput =
  'w-full rounded-lg border border-zinc-200 bg-white py-1.5 px-2 text-sm focus:border-orange-400 focus:outline-none focus:ring-1 focus:ring-orange-400';

const disabledDiscountClasses = 'disabled:cursor-not-allowed disabled:bg-zinc-50 disabled:text-zinc-400';

function formatBRL(value: number) {
  return value.toLocaleString('pt-BR', { minimumFractionDigits: 2 });
}

export default function BudgetItemsTable({
  items,
  readOnly = false,
  onChange,
  onSubtotalChange,
  extracting = false,
  orderDiscount,
  onOrderDiscountChange,
  discountsLocked = false,
}: BudgetItemsTableProps) {
  const displayItems = React.useMemo(() => {
    if (!readOnly && items.length === 0) {
      return Array.from({ length: 5 }, (_, i) => emptyItem(i));
    }
    return items;
  }, [items, readOnly]);

  const totals = React.useMemo(
    () => calcBudgetTotals(displayItems, orderDiscount),
    [displayItems, orderDiscount],
  );
  const hasItemDiscount = React.useMemo(
    () => displayItems.some((i) => (i.discount ?? 0) > 0),
    [displayItems],
  );
  const hasOrderDiscount = (orderDiscount ?? 0) > 0;

  const notify = (next: BudgetItem[]) => {
    onChange?.(next);
    onSubtotalChange?.(calcBudgetTotals(next, orderDiscount).subtotal);
  };

  const handleChange = (
    idx: number,
    field: keyof BudgetItem,
    raw: string,
  ) => {
    const next = displayItems.map((item, i) => {
      if (i !== idx) return item;
      if (field === 'quantity' || field === 'value' || field === 'discount') {
        return { ...item, [field]: parseFloat(raw) || 0 };
      }
      return { ...item, [field]: raw };
    });
    notify(next);
  };

  const handleDelete = (idx: number) => {
    const next = displayItems
      .filter((_, i) => i !== idx)
      .map((item, i) => ({ ...item, sortOrder: i }));
    notify(next);
  };

  const handleAdd = () => {
    const next = [...displayItems, emptyItem(displayItems.length)];
    notify(next);
  };

  const totalDiscount = totals.itemsDiscount + totals.orderDiscount;
  const showDiscountRow = totalDiscount > 0;
  const helpText = (hasItemDiscount || hasOrderDiscount)
    ? 'Use desconto por item ou desconto geral — nunca os dois.'
    : null;

  if (readOnly) {
    return (
      <div className="overflow-hidden rounded-xl border border-zinc-200 text-sm">
        <table className="min-w-full">
          <thead>
            <tr className="border-b border-zinc-200 bg-zinc-50">
              <th className="px-3 py-2 text-left text-xs font-semibold text-zinc-500 uppercase">Item</th>
              <th className="w-48 px-3 py-2 text-left text-xs font-semibold text-zinc-500 uppercase">Sistema</th>
              <th className="w-12 px-3 py-2 text-right text-xs font-semibold text-zinc-500 uppercase">Qtd</th>
              <th className="w-24 px-3 py-2 text-right text-xs font-semibold text-zinc-500 uppercase">Valor (R$)</th>
              <th className="w-24 px-3 py-2 text-right text-xs font-semibold text-zinc-500 uppercase">Desc. (R$)</th>
              <th className="w-24 px-3 py-2 text-right text-xs font-semibold text-zinc-500 uppercase">Total (R$)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {displayItems.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-3 py-4 text-center text-xs text-zinc-400">Nenhum item cadastrado</td>
              </tr>
            ) : (
              displayItems.map((item, i) => (
                <tr key={i} className="bg-white">
                  <td className="px-3 py-2 text-zinc-800">{item.itemName || '—'}</td>
                  <td className="w-48 px-3 py-2 text-zinc-500">{item.system || '—'}</td>
                  <td className="w-12 px-3 py-2 text-right text-zinc-700">{item.quantity}</td>
                  <td className="w-24 px-3 py-2 text-right text-zinc-700">
                    {item.value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </td>
                  <td className="w-24 px-3 py-2 text-right text-zinc-700">
                    {(item.discount ?? 0) > 0
                      ? formatBRL(item.discount ?? 0)
                      : '—'}
                  </td>
                  <td className="w-24 px-3 py-2 text-right font-semibold text-zinc-800">
                    {calcBudgetItemNet(item).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
        <div className="border-t border-zinc-200 bg-zinc-50 px-3 py-2 text-right text-sm">
          <div className="font-semibold text-zinc-700">
            Subtotal: R$ <span className="text-orange-600">{formatBRL(totals.subtotal)}</span>
          </div>
          {showDiscountRow && (
            <div className="text-red-600">
              Desconto: − R$ {formatBRL(totalDiscount)}
            </div>
          )}
          <div className="font-semibold text-orange-600">
            Total: R$ {formatBRL(totals.total)}
          </div>
        </div>
        {helpText && (
          <div className="border-t border-zinc-100 bg-zinc-50 px-3 py-1 text-xs text-zinc-500">
            {helpText}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="relative overflow-hidden rounded-xl border border-zinc-200 text-sm">
      {extracting && (
        <div className="absolute inset-0 z-10 flex items-center justify-center rounded-xl bg-white/80 backdrop-blur-sm">
          <div className="flex flex-col items-center gap-2">
            <Loader2 className="h-6 w-6 animate-spin text-orange-500" />
            <span className="text-xs text-zinc-500">Extraindo dados do PDF...</span>
          </div>
        </div>
      )}

      <table className="min-w-full">
        <thead>
          <tr className="border-b border-zinc-200 bg-zinc-50">
            <th className="px-2 py-2 text-left text-xs font-semibold text-zinc-500 uppercase">Item</th>
            <th className="w-48 px-2 py-2 text-left text-xs font-semibold text-zinc-500 uppercase">Sistema</th>
            <th className="w-16 px-2 py-2 text-left text-xs font-semibold text-zinc-500 uppercase">Qtd</th>
            <th className="w-24 px-2 py-2 text-left text-xs font-semibold text-zinc-500 uppercase">Valor (R$)</th>
            <th className="w-24 px-2 py-2 text-right text-xs font-semibold text-zinc-500 uppercase">Desc. (R$)</th>
            <th className="w-24 px-2 py-2 text-right text-xs font-semibold text-zinc-500 uppercase">Total (R$)</th>
            <th className="w-8 px-2 py-2" />
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-100 bg-white">
          {displayItems.map((item, idx) => (
            <tr key={idx}>
              <td className="px-2 py-1.5">
                <input
                  type="text"
                  value={item.itemName}
                  onChange={e => handleChange(idx, 'itemName', e.target.value)}
                  placeholder="Ex: Pastilha de freio"
                  className={cellInput}
                />
              </td>
              <td className="w-48 px-2 py-1.5">
                <select
                  value={item.system || ''}
                  onChange={e => handleChange(idx, 'system', e.target.value)}
                  className={cellInput}
                >
                  <option value="">Selecione...</option>
                  {BUDGET_SYSTEM_OPTIONS.map(sys => (
                    <option key={sys} value={sys}>{sys}</option>
                  ))}
                </select>
              </td>
              <td className="w-16 px-2 py-1.5">
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={item.quantity || ''}
                  onChange={e => handleChange(idx, 'quantity', e.target.value)}
                  placeholder="1"
                  className={cellInput}
                />
              </td>
              <td className="w-24 px-2 py-1.5">
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={item.value || ''}
                  onChange={e => handleChange(idx, 'value', e.target.value)}
                  placeholder="0,00"
                  className={cellInput}
                />
              </td>
              <td className="w-24 px-2 py-1.5">
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={(item.discount ?? 0) || ''}
                  onChange={e => handleChange(idx, 'discount', e.target.value)}
                  placeholder="0,00"
                  disabled={hasOrderDiscount || discountsLocked}
                  className={`${cellInput} ${disabledDiscountClasses}`}
                />
              </td>
              <td className="w-24 px-2 py-1.5 text-right font-semibold text-zinc-800">
                {calcBudgetItemNet(item).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </td>
              <td className="w-8 px-2 py-1.5 text-center">
                <button
                  type="button"
                  onClick={() => handleDelete(idx)}
                  className="rounded p-1 text-zinc-300 transition-colors hover:bg-red-50 hover:text-red-500"
                  title="Remover linha"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="flex flex-col gap-2 border-t border-zinc-200 bg-zinc-50 px-3 py-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleAdd}
            className="flex items-center gap-1 text-xs font-medium text-orange-600 transition-colors hover:text-orange-700"
          >
            <Plus className="h-3.5 w-3.5" />
            Adicionar linha
          </button>
          {onOrderDiscountChange && (
            <label className="flex items-center gap-1 text-xs text-zinc-600">
              Desconto geral (R$)
              <input
                type="number"
                min="0"
                step="0.01"
                value={orderDiscount ?? ''}
                onChange={e => onOrderDiscountChange(parseFloat(e.target.value) || 0)}
                disabled={hasItemDiscount || discountsLocked || !onOrderDiscountChange}
                placeholder="0,00"
                className={`w-24 rounded-lg border border-zinc-200 bg-white px-2 py-1 text-sm focus:border-orange-400 focus:ring-1 focus:ring-orange-400 focus:outline-none ${disabledDiscountClasses}`}
              />
            </label>
          )}
        </div>
        <div className="text-right text-sm sm:text-right">
          <div className="font-semibold text-zinc-700">
            Subtotal: R$ <span className="text-orange-600">{formatBRL(totals.subtotal)}</span>
          </div>
          {showDiscountRow && (
            <div className="text-red-600">
              Desconto: − R$ {formatBRL(totalDiscount)}
            </div>
          )}
          <div className="font-semibold text-orange-600">
            Total: R$ {formatBRL(totals.total)}
          </div>
        </div>
      </div>
      {helpText && (
        <div className="border-t border-zinc-100 bg-zinc-50 px-3 py-1 text-xs text-zinc-500">
          {helpText}
        </div>
      )}
    </div>
  );
}