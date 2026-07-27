import { X, Loader2 } from 'lucide-react';
import React, { useState } from 'react';

import type { VehicleLoan } from '../types/vehicleLoan';

interface Props {
  loan: VehicleLoan;
  newTitularName?: string;
  onConfirm: (justificativa: string) => Promise<void>;
  onCancel: () => void;
}

const fmt = (iso?: string | null) => (iso ? new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : '—');

/**
 * Modal de confirmação exibido quando um usuário Assistant+ troca o titular
 * de um veículo que possui empréstimo ativo. Ao confirmar, finaliza o
 * empréstimo com `ended_reason='driver_changed'` (notifica o temporário) e
 * só então prossegue com a troca de titular.
 */
export default function VehicleLoanChangeTitularModal({ loan, newTitularName, onConfirm, onCancel }: Props) {
  const [justificativa, setJustificativa] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const trimmed = justificativa.trim();
  const canConfirm = trimmed.length >= 10 && !saving;
  const isTempBecomingTitular = !!newTitularName;

  const handleConfirm = async () => {
    if (!canConfirm) return;
    setSaving(true);
    setError(null);
    try {
      await onConfirm(trimmed);
    } catch (err) {
      console.error(err);
      setError('Não foi possível finalizar o empréstimo. Tente novamente.');
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/50 p-4 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget && !saving) onCancel(); }}
    >
      <div className="my-8 w-full max-w-lg rounded-2xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-zinc-100 px-6 py-4">
          <h2 className="text-lg font-semibold text-zinc-900">Confirmar troca de titular</h2>
          <button
            type="button"
            onClick={onCancel}
            disabled={saving}
            className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 disabled:opacity-50"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-4 px-6 py-6">
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
            Este veículo está emprestado para <strong>{loan.driverName ?? 'um motorista'}</strong> desde {fmt(loan.startedAt)}.
            A troca de titular <strong>finalizará automaticamente</strong> o empréstimo e notificará o motorista temporário.
          </div>

          <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
            <div>
              <p className="text-xs text-zinc-400">Motorista temporário (em empréstimo)</p>
              <p className="font-medium text-zinc-800">{loan.driverName ?? '—'}</p>
            </div>
            <div>
              <p className="text-xs text-zinc-400">Início do empréstimo</p>
              <p className="font-medium text-zinc-800">{fmt(loan.startedAt)}</p>
            </div>
            <div>
              <p className="text-xs text-zinc-400">Justificativa original do empréstimo</p>
              <p className="font-medium text-zinc-800">{loan.notes ?? '—'}</p>
            </div>
          </div>

          {isTempBecomingTitular && (
            <div className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-800">
              O motorista que você está definindo como titular é o mesmo que está com o veículo em empréstimo.
              O empréstimo será finalizado automaticamente.
            </div>
          )}

          <div>
            <label className="mb-1 block text-xs font-medium text-zinc-500">
              Justificativa da alteração do titular <span className="text-red-500">*</span>
              <span className="ml-1 text-zinc-400">(mínimo 10 caracteres)</span>
            </label>
            <textarea
              value={justificativa}
              onChange={(e) => setJustificativa(e.target.value)}
              rows={3}
              placeholder="Informe o motivo da troca de titular..."
              className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:ring-2 focus:ring-orange-400 focus:outline-none"
            />
          </div>

          {error && <div className="text-sm text-red-600">{error}</div>}
        </div>

        <div className="flex items-center justify-end gap-3 rounded-b-2xl border-t border-zinc-100 bg-zinc-50 px-6 py-4">
          <button
            type="button"
            onClick={onCancel}
            disabled={saving}
            className="rounded-xl border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-700 shadow-sm hover:bg-zinc-50 disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={() => { void handleConfirm(); }}
            disabled={!canConfirm}
            className="inline-flex items-center gap-2 rounded-xl bg-orange-500 px-4 py-2 text-sm font-medium text-white hover:bg-orange-600 disabled:opacity-50"
          >
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            {saving ? 'Confirmando...' : 'Confirmar e finalizar empréstimo'}
          </button>
        </div>
      </div>
    </div>
  );
}