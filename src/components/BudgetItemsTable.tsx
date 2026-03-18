import React from 'react';
import { Trash2, Plus, Loader2 } from 'lucide-react';
import type { BudgetItem } from '../lib/maintenanceMappers';
import { calcBudgetSubtotal } from '../lib/maintenanceMappers';

interface BudgetItemsTableProps {
  items: BudgetItem[];
  readOnly?: boolean;
  onChange?: (items: BudgetItem[]) => void;
  onSubtotalChange?: (subtotal: number) => void;
  extracting?: boolean;
}

function emptyItem(sortOrder: number): BudgetItem {
  return { itemName: '', system: '', quantity: 1, value: 0, sortOrder };
}

const cellInput =
  'w-full rounded-lg border border-zinc-200 bg-white py-1.5 px-2 text-sm focus:border-orange-400 focus:outline-none focus:ring-1 focus:ring-orange-400';

export default function BudgetItemsTable({
  items,
  readOnly = false,
  onChange,
  onSubtotalChange,
  extracting = false,
}: BudgetItemsTableProps) {
  const displayItems = React.useMemo(() => {
    if (!readOnly && items.length === 0) {
      return Array.from({ length: 5 }, (_, i) => emptyItem(i));
    }
    return items;
  }, [items, readOnly]);

  const subtotal = React.useMemo(() => calcBudgetSubtotal(displayItems), [displayItems]);

  const notify = (next: BudgetItem[]) => {
    onChange?.(next);
    onSubtotalChange?.(calcBudgetSubtotal(next));
  };

  const handleChange = (
    idx: number,
    field: keyof BudgetItem,
    raw: string,
  ) => {
    const next = displayItems.map((item, i) => {
      if (i !== idx) return item;
      if (field === 'quantity' || field === 'value') {
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

  if (readOnly) {
    return (
      <div className="border border-zinc-200 rounded-xl overflow-hidden text-sm">
        <table className="min-w-full">
          <thead>
            <tr className="bg-zinc-50 border-b border-zinc-200">
              <th className="px-3 py-2 text-left text-xs font-semibold text-zinc-500 uppercase">Item</th>
              <th className="px-3 py-2 text-left text-xs font-semibold text-zinc-500 uppercase w-40">Sistema</th>
              <th className="px-3 py-2 text-right text-xs font-semibold text-zinc-500 uppercase w-16">Qtd</th>
              <th className="px-3 py-2 text-right text-xs font-semibold text-zinc-500 uppercase w-28">Valor (R$)</th>
              <th className="px-3 py-2 text-right text-xs font-semibold text-zinc-500 uppercase w-28">Total (R$)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {displayItems.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-3 py-4 text-center text-zinc-400 text-xs">Nenhum item cadastrado</td>
              </tr>
            ) : (
              displayItems.map((item, i) => (
                <tr key={i} className="bg-white">
                  <td className="px-3 py-2 text-zinc-800">{item.itemName || '—'}</td>
                  <td className="px-3 py-2 text-zinc-500 w-40">{item.system || '—'}</td>
                  <td className="px-3 py-2 text-right text-zinc-700 w-16">{item.quantity}</td>
                  <td className="px-3 py-2 text-right text-zinc-700 w-28">
                    {item.value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </td>
                  <td className="px-3 py-2 text-right font-semibold text-zinc-800 w-28">
                    {(item.quantity * item.value).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
        <div className="bg-zinc-50 border-t border-zinc-200 px-3 py-2 text-right text-sm font-semibold text-zinc-700">
          Subtotal: R${' '}
          <span className="text-orange-600">
            {subtotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="relative border border-zinc-200 rounded-xl overflow-hidden text-sm">
      {extracting && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/80 backdrop-blur-sm rounded-xl">
          <div className="flex flex-col items-center gap-2">
            <Loader2 className="h-6 w-6 animate-spin text-orange-500" />
            <span className="text-xs text-zinc-500">Extraindo dados do PDF...</span>
          </div>
        </div>
      )}

      <table className="min-w-full">
        <thead>
          <tr className="bg-zinc-50 border-b border-zinc-200">
            <th className="px-2 py-2 text-left text-xs font-semibold text-zinc-500 uppercase">Item</th>
            <th className="px-2 py-2 text-left text-xs font-semibold text-zinc-500 uppercase w-40">Sistema</th>
            <th className="px-2 py-2 text-left text-xs font-semibold text-zinc-500 uppercase w-16">Qtd</th>
            <th className="px-2 py-2 text-left text-xs font-semibold text-zinc-500 uppercase w-24">Valor (R$)</th>
            <th className="px-2 py-2 text-right text-xs font-semibold text-zinc-500 uppercase w-28">Total (R$)</th>
            <th className="px-2 py-2 w-8" />
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
              <td className="px-2 py-1.5 w-40">
                <input
                  type="text"
                  value={item.system}
                  onChange={e => handleChange(idx, 'system', e.target.value)}
                  placeholder="Sistema"
                  className={cellInput}
                />
              </td>
              <td className="px-2 py-1.5 w-16">
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
              <td className="px-2 py-1.5 w-24">
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
              <td className="px-2 py-1.5 w-28 text-right font-semibold text-zinc-800">
                {(item.quantity * item.value).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </td>
              <td className="px-2 py-1.5 w-8 text-center">
                <button
                  type="button"
                  onClick={() => handleDelete(idx)}
                  className="p-1 rounded text-zinc-300 hover:text-red-500 hover:bg-red-50 transition-colors"
                  title="Remover linha"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="bg-zinc-50 border-t border-zinc-200 px-3 py-2 flex items-center justify-between">
        <button
          type="button"
          onClick={handleAdd}
          className="flex items-center gap-1 text-xs text-orange-600 hover:text-orange-700 font-medium transition-colors"
        >
          <Plus className="h-3.5 w-3.5" />
          Adicionar linha
        </button>
        <span className="text-sm font-semibold text-zinc-700">
          Subtotal: R${' '}
          <span className="text-orange-600">
            {subtotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </span>
        </span>
      </div>
    </div>
  );
}
