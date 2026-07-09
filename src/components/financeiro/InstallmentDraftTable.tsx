import { Pencil, Plus, X } from 'lucide-react';
import React, { useState } from 'react';

import { cn } from '../../lib/utils';

import type { InstallmentDraft, PaymentMethod, PixKeyType } from '../../types/payment';

interface InstallmentDraftTableProps {
  drafts: InstallmentDraft[];
  onChange: (drafts: InstallmentDraft[]) => void;
  onUploadBoleto: (index: number, file: File) => void;
  uploadingBoletoIndex?: number | null;
}

const STATUS_LABELS: Record<PixKeyType, string> = {
  cpf: 'CPF',
  cnpj: 'CNPJ',
  email: 'E-mail',
  telefone: 'Telefone',
  aleatoria: 'Aleatória',
};

function formatCurrency(value: number): string {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export default function InstallmentDraftTable({
  drafts,
  onChange,
  onUploadBoleto,
  uploadingBoletoIndex = null,
}: InstallmentDraftTableProps): React.ReactElement {
  const [editing, setEditing] = useState<number | null>(null);

  if (drafts.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-zinc-300 bg-zinc-50 px-4 py-6 text-center text-sm text-zinc-400">
        Gere as parcelas para revisar antes de salvar.
      </div>
    );
  }

  const update = (index: number, patch: Partial<InstallmentDraft>) => {
    const next = drafts.map((d, i) => (i === index ? { ...d, ...patch } : d));
    onChange(next);
  };

  const handleBoletoPick = (index: number, file: File) => {
    onUploadBoleto(index, file);
  };

  return (
    <div className="overflow-hidden rounded-xl border border-zinc-200">
      <div className="max-h-[320px] overflow-auto">
        <table className="min-w-full text-sm">
          <thead className="sticky top-0 z-10 bg-zinc-50">
            <tr className="border-b border-zinc-200">
              <th className="px-3 py-2.5 text-left text-xs font-semibold text-zinc-500 uppercase">Parc.</th>
              <th className="px-3 py-2.5 text-left text-xs font-semibold text-zinc-500 uppercase">Valor</th>
              <th className="px-3 py-2.5 text-left text-xs font-semibold text-zinc-500 uppercase">Vencimento</th>
              <th className="px-3 py-2.5 text-left text-xs font-semibold text-zinc-500 uppercase">Pagamento</th>
              <th className="px-3 py-2.5 text-left text-xs font-semibold text-zinc-500 uppercase">Dados</th>
              <th className="w-10 px-3 py-2.5" />
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100 bg-white">
            {drafts.map((d, i) => {
              const isEditing = editing === i;
              const isUploading = uploadingBoletoIndex === i;
              return (
                <tr key={i} className={cn(isEditing && 'bg-orange-50/40')}>
                  <td className="px-3 py-2 text-zinc-500">
                    {d.installmentNumber}/{drafts.length}
                  </td>
                  <td className="px-3 py-2">
                    {isEditing ? (
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={d.value}
                        onChange={(e) => update(i, { value: Number(e.target.value) })}
                        className="w-28 rounded-lg border border-zinc-300 px-2 py-1 text-sm focus:ring-1 focus:ring-orange-400 focus:outline-none"
                      />
                    ) : (
                      <span className="font-medium text-zinc-800">{formatCurrency(d.value)}</span>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    {isEditing ? (
                      <input
                        type="date"
                        value={d.dueDate}
                        onChange={(e) => update(i, { dueDate: e.target.value })}
                        className="rounded-lg border border-zinc-300 px-2 py-1 text-sm focus:ring-1 focus:ring-orange-400 focus:outline-none"
                      />
                    ) : (
                      <span className="text-zinc-600">
                        {new Date(`${d.dueDate}T00:00:00`).toLocaleDateString('pt-BR')}
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    {isEditing ? (
                      <select
                        value={d.paymentMethod ?? 'boleto'}
                        onChange={(e) => update(i, { paymentMethod: e.target.value as PaymentMethod })}
                        className="rounded-lg border border-zinc-300 px-2 py-1 text-sm focus:ring-1 focus:ring-orange-400 focus:outline-none"
                      >
                        <option value="boleto">Boleto</option>
                        <option value="pix">Pix</option>
                      </select>
                    ) : (
                      <span className="text-zinc-600">
                        {d.paymentMethod === 'pix' ? 'Pix' : 'Boleto'}
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    {d.paymentMethod === 'pix' ? (
                      isEditing ? (
                        <PixFields draft={d} onChange={(patch) => update(i, patch)} />
                      ) : (
                        <span className="text-xs text-zinc-500">
                          {d.pixKey ? `${STATUS_LABELS[d.pixKeyType ?? 'aleatoria']}: ${d.pixKey}` : '— sem chave —'}
                          {d.pixBeneficiaryName ? ` · ${d.pixBeneficiaryName}` : ''}
                        </span>
                      )
                    ) : (
                      <div className="flex items-center gap-2">
                        {d.boletoUrl ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
                            Boleto anexado
                          </span>
                        ) : (
                          <label className="inline-flex cursor-pointer items-center gap-1 rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-600 hover:bg-zinc-200">
                            {isUploading ? (
                              <span>Anexando…</span>
                            ) : (
                              <>
                                <Plus className="h-3 w-3" />
                                Boleto
                              </>
                            )}
                            <input
                              type="file"
                              accept="application/pdf,image/jpeg,image/png,image/webp"
                              className="hidden"
                              disabled={isUploading}
                              onChange={(e) => {
                                const f = e.target.files?.[0];
                                if (f) handleBoletoPick(i, f);
                                e.target.value = '';
                              }}
                            />
                          </label>
                        )}
                      </div>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <button
                      type="button"
                      onClick={() => setEditing(isEditing ? null : i)}
                      className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700"
                      title={isEditing ? 'Concluir edição' : 'Editar parcela'}
                    >
                      {isEditing ? <X className="h-4 w-4" /> : <Pencil className="h-4 w-4" />}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

interface PixFieldsProps {
  draft: InstallmentDraft;
  onChange: (patch: Partial<InstallmentDraft>) => void;
}

function PixFields({ draft, onChange }: PixFieldsProps): React.ReactElement {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex gap-1.5">
        <select
          value={draft.pixKeyType ?? 'aleatoria'}
          onChange={(e) => onChange({ pixKeyType: e.target.value as PixKeyType })}
          className="rounded-lg border border-zinc-300 px-1.5 py-1 text-xs focus:ring-1 focus:ring-orange-400 focus:outline-none"
        >
          {(Object.keys(STATUS_LABELS) as PixKeyType[]).map((k) => (
            <option key={k} value={k}>{STATUS_LABELS[k]}</option>
          ))}
        </select>
        <input
          type="text"
          placeholder="Chave Pix"
          value={draft.pixKey ?? ''}
          onChange={(e) => onChange({ pixKey: e.target.value })}
          className="flex-1 rounded-lg border border-zinc-300 px-2 py-1 text-xs focus:ring-1 focus:ring-orange-400 focus:outline-none"
        />
      </div>
      <input
        type="text"
        placeholder="Favorecido"
        value={draft.pixBeneficiaryName ?? ''}
        onChange={(e) => onChange({ pixBeneficiaryName: e.target.value })}
        className="rounded-lg border border-zinc-300 px-2 py-1 text-xs focus:ring-1 focus:ring-orange-400 focus:outline-none"
      />
    </div>
  );
}