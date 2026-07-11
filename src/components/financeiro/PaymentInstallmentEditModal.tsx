import { useQueryClient } from '@tanstack/react-query';
import { Loader2, X } from 'lucide-react';
import React, { useMemo, useState } from 'react';

import { useAuth } from '../../context/AuthContext';
import { extractInvoiceNumber } from '../../lib/invoiceOcr';
import { remainingBudget } from '../../lib/paymentInstallments';
import { uploadFinancialDocument } from '../../lib/storageHelpers';
import {
  updatePaymentInstallment,
  type PaymentInstallmentPatch,
} from '../../services/paymentInstallmentService';

import PixFields from './PixFields';

import type { PaymentInstallment, PaymentInstallmentStatus, PaymentMethod, PixKeyType } from '../../types/payment';

interface PaymentInstallmentEditModalProps {
  open: boolean;
  installment: PaymentInstallment;
  approvedCost: number;
  existing: { id: string; value: number; status?: PaymentInstallmentStatus }[];
  onClose: () => void;
}

function formatCurrency(value: number): string {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export default function PaymentInstallmentEditModal({
  open,
  installment,
  approvedCost,
  existing,
  onClose,
}: PaymentInstallmentEditModalProps): React.ReactElement | null {
  const { currentClient } = useAuth();
  const queryClient = useQueryClient();

  const [value, setValue] = useState(installment.value);
  const [dueDate, setDueDate] = useState(installment.dueDate);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(installment.paymentMethod);
  const [pixKeyType, setPixKeyType] = useState<PixKeyType | undefined>(installment.pixKeyType);
  const [pixKey, setPixKey] = useState(installment.pixKey ?? '');
  const [pixBeneficiaryName, setPixBeneficiaryName] = useState(installment.pixBeneficiaryName ?? '');
  const [categoria, setCategoria] = useState(installment.categoria ?? '');
  const [centroCusto, setCentroCusto] = useState(installment.centroCusto ?? '');
  const [competenciaDate, setCompetenciaDate] = useState(installment.competenciaDate ?? '');
  const [descricao, setDescricao] = useState(installment.descricao ?? '');
  const [invoiceNumber, setInvoiceNumber] = useState(installment.invoiceNumber ?? '');
  const [boletoUrl, setBoletoUrl] = useState(installment.boletoUrl);
  const [notaFiscalUrl, setNotaFiscalUrl] = useState(installment.notaFiscalUrl);
  const [notaFiscalUrl2, setNotaFiscalUrl2] = useState(installment.notaFiscalUrl2);
  const [uploading, setUploading] = useState<'boleto' | 'nota' | 'nota2' | null>(null);
  const [extractingInvoice, setExtractingInvoice] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const saldoSemEsta = useMemo(
    () => remainingBudget(approvedCost, existing.filter((e) => e.id !== installment.id)),
    [approvedCost, existing, installment.id],
  );
  const overBudget = value > saldoSemEsta;

  if (!open) return null;

  const handleUpload = async (kind: 'boleto' | 'nota' | 'nota2', file: File) => {
    if (!currentClient?.id) return;
    setUploading(kind);
    try {
      const path = await uploadFinancialDocument(
        currentClient.id,
        installment.maintenanceOrderId,
        file,
        kind === 'boleto' ? 'boleto' : 'nota',
      );
      if (kind === 'boleto') setBoletoUrl(path);
      else if (kind === 'nota') {
        setNotaFiscalUrl(path);
        setExtractingInvoice(true);
        try {
          const result = await extractInvoiceNumber(file);
          if (result.invoiceNumber && !invoiceNumber) setInvoiceNumber(result.invoiceNumber);
        } finally {
          setExtractingInvoice(false);
        }
      } else setNotaFiscalUrl2(path);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Falha ao anexar documento.';
      setError(msg);
    } finally {
      setUploading(null);
    }
  };

  const handleSave = async () => {
    setError('');
    if (overBudget) {
      setError('A soma das parcelas ultrapassa o saldo do orçamento. Ajuste os valores para continuar.');
      return;
    }

    const patch: PaymentInstallmentPatch = {
      value,
      due_date: dueDate,
      payment_method: paymentMethod,
      competencia_date: competenciaDate || null,
      categoria: categoria || null,
      centro_custo: centroCusto || null,
      descricao: descricao || null,
      invoice_number: invoiceNumber || null,
      boleto_url: boletoUrl ?? null,
      nota_fiscal_url: notaFiscalUrl ?? null,
      nota_fiscal_url_2: notaFiscalUrl2 ?? null,
      pix_key_type: paymentMethod === 'pix' ? (pixKeyType ?? null) : null,
      pix_key: paymentMethod === 'pix' ? (pixKey || null) : null,
      pix_beneficiary_name: paymentMethod === 'pix' ? (pixBeneficiaryName || null) : null,
    };

    setSaving(true);
    try {
      await updatePaymentInstallment(installment.id, patch);
      await queryClient.invalidateQueries({ queryKey: ['paymentInstallments'] });
      onClose();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Falha ao salvar parcela.';
      setError(msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/60 p-4">
      <div className="relative my-4 w-full max-w-2xl rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b px-6 py-4">
          <div>
            <h2 className="text-base font-semibold text-zinc-900">
              Editar parcela {installment.installmentNumber}/{installment.installmentsTotal}
            </h2>
            <p className="mt-0.5 text-xs text-zinc-500">Só é possível editar parcelas pendentes de aprovação</p>
          </div>
          <button onClick={onClose} className="rounded-lg p-2 hover:bg-zinc-100">
            <X className="h-5 w-5 text-zinc-500" />
          </button>
        </div>

        <div className="space-y-4 px-6 py-4">
          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">{error}</div>
          )}

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-zinc-700">Valor</label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={value}
                onChange={(e) => setValue(Number(e.target.value))}
                className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:ring-2 focus:ring-orange-400 focus:outline-none"
              />
              <p className={cnBudgetText(overBudget)}>
                Saldo disponível (sem esta parcela): {formatCurrency(saldoSemEsta)}
              </p>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-zinc-700">Vencimento</label>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:ring-2 focus:ring-orange-400 focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-zinc-700">Forma de pagamento</label>
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
                className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:ring-2 focus:ring-orange-400 focus:outline-none"
              >
                <option value="boleto">Boleto</option>
                <option value="pix">Pix</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-zinc-700">Data de Competência</label>
              <input
                type="date"
                value={competenciaDate}
                onChange={(e) => setCompetenciaDate(e.target.value)}
                className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:ring-2 focus:ring-orange-400 focus:outline-none"
              />
            </div>
            {paymentMethod === 'pix' && (
              <div className="md:col-span-2">
                <label className="mb-1 block text-sm font-medium text-zinc-700">Dados Pix</label>
                <PixFields
                  pixKeyType={pixKeyType}
                  pixKey={pixKey}
                  pixBeneficiaryName={pixBeneficiaryName}
                  onChange={(patch) => {
                    if (patch.pixKeyType !== undefined) setPixKeyType(patch.pixKeyType);
                    if (patch.pixKey !== undefined) setPixKey(patch.pixKey);
                    if (patch.pixBeneficiaryName !== undefined) setPixBeneficiaryName(patch.pixBeneficiaryName);
                  }}
                />
              </div>
            )}
            <div>
              <label className="mb-1 block text-sm font-medium text-zinc-700">Categoria</label>
              <input
                type="text"
                value={categoria}
                onChange={(e) => setCategoria(e.target.value)}
                className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:ring-2 focus:ring-orange-400 focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-zinc-700">Centro de Custo</label>
              <input
                type="text"
                value={centroCusto}
                onChange={(e) => setCentroCusto(e.target.value)}
                className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:ring-2 focus:ring-orange-400 focus:outline-none"
              />
            </div>
            <div className="md:col-span-2">
              <label className="mb-1 flex items-center gap-2 text-sm font-medium text-zinc-700">
                <span>NF / Fatura</span>
                {extractingInvoice && (
                  <span className="inline-flex items-center gap-1 text-xs font-normal text-zinc-500">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    Lendo documento…
                  </span>
                )}
              </label>
              <input
                type="text"
                value={invoiceNumber}
                onChange={(e) => setInvoiceNumber(e.target.value)}
                className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:ring-2 focus:ring-orange-400 focus:outline-none"
              />
            </div>
            <div className="md:col-span-2">
              <label className="mb-1 block text-sm font-medium text-zinc-700">Descrição</label>
              <input
                type="text"
                value={descricao}
                onChange={(e) => setDescricao(e.target.value)}
                className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:ring-2 focus:ring-orange-400 focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            {paymentMethod === 'boleto' && (
              <AttachmentField
                label="Boleto"
                url={boletoUrl}
                uploading={uploading === 'boleto'}
                onPick={(f) => { void handleUpload('boleto', f); }}
              />
            )}
            <AttachmentField
              label="Nota fiscal (opcional)"
              url={notaFiscalUrl}
              uploading={uploading === 'nota'}
              onPick={(f) => { void handleUpload('nota', f); }}
            />
            <AttachmentField
              label="2º documento (opcional)"
              url={notaFiscalUrl2}
              uploading={uploading === 'nota2'}
              onPick={(f) => { void handleUpload('nota2', f); }}
            />
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 rounded-b-2xl border-t bg-zinc-50 px-6 py-4">
          {overBudget && (
            <p className="mr-auto text-xs font-medium text-red-600">
              A soma das parcelas ultrapassa o saldo do orçamento. Ajuste os valores para continuar.
            </p>
          )}
          <button onClick={onClose} className="px-4 py-2 text-sm text-zinc-600 hover:text-zinc-900">
            Cancelar
          </button>
          <button
            type="button"
            onClick={() => { void handleSave(); }}
            disabled={saving || overBudget}
            className="flex items-center gap-2 rounded-lg bg-orange-500 px-5 py-2 text-sm font-medium text-white hover:bg-orange-600 disabled:opacity-50"
          >
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            Salvar
          </button>
        </div>
      </div>
    </div>
  );
}

function cnBudgetText(overBudget: boolean): string {
  return overBudget ? 'mt-1 text-xs font-medium text-red-600' : 'mt-1 text-xs text-zinc-500';
}

interface AttachmentFieldProps {
  label: string;
  url?: string;
  uploading: boolean;
  onPick: (file: File) => void;
}

function AttachmentField({ label, url, uploading, onPick }: AttachmentFieldProps): React.ReactElement {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium text-zinc-700">{label}</label>
      {url ? (
        <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
          Anexado
        </span>
      ) : (
        <input
          type="file"
          accept="application/pdf,image/jpeg,image/png,image/webp"
          disabled={uploading}
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) onPick(f);
            e.target.value = '';
          }}
          className="block w-full text-sm text-zinc-600 file:mr-3 file:rounded-lg file:border-0 file:bg-zinc-100 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-zinc-700 hover:file:bg-zinc-200"
        />
      )}
      {uploading && <span className="text-xs text-zinc-400">Anexando…</span>}
    </div>
  );
}
