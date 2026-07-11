import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, X } from 'lucide-react';
import React, { useMemo, useState } from 'react';

import { useAuth } from '../../context/AuthContext';
import { extractInvoiceNumber } from '../../lib/invoiceOcr';
import {
  generateInstallmentDrafts,
  remainingBudget,
  sumInstallmentsValue,
  sumNonRejectedValue,
} from '../../lib/paymentInstallments';
import { uploadFinancialDocument } from '../../lib/storageHelpers';
import { supabase } from '../../lib/supabase';
import { cn } from '../../lib/utils';
import {
  createPaymentInstallmentsBatch,
  listApprovedOrdersForPayment,
} from '../../services/paymentInstallmentService';

import InstallmentDraftTable from './InstallmentDraftTable';

import type { InstallmentDraftInput } from '../../services/paymentInstallmentService';
import type {
  InstallmentDraft,
  InstallmentInterval,
  PaymentInstallmentStatus,
  PaymentMethod,
  PixKeyType,
} from '../../types/payment';

interface PaymentInstallmentFormModalProps {
  open: boolean;
  onClose: () => void;
}

type BatchMode = 'single' | 'batch';

const INTERVALS: InstallmentInterval[] = ['mensal', 'quinzenal', 'semanal'];
const PIX_KEY_TYPES: PixKeyType[] = ['cpf', 'cnpj', 'email', 'telefone', 'aleatoria'];

function formatCurrency(value: number): string {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export default function PaymentInstallmentFormModal({
  open,
  onClose,
}: PaymentInstallmentFormModalProps): React.ReactElement | null {
  const { user, currentClient } = useAuth();
  const queryClient = useQueryClient();

  const [orderId, setOrderId] = useState('');
  const [batchMode, setBatchMode] = useState<BatchMode>('batch');
  const [count, setCount] = useState(1);
  const [firstDueDate, setFirstDueDate] = useState('');
  const [interval, setInterval] = useState<InstallmentInterval>('mensal');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('boleto');
  const [pixKeyType, setPixKeyType] = useState<PixKeyType>('aleatoria');
  const [pixKey, setPixKey] = useState('');
  const [pixBeneficiaryName, setPixBeneficiaryName] = useState('');
  const [categoria, setCategoria] = useState('');
  const [centroCusto, setCentroCusto] = useState('');
  const [competenciaDate, setCompetenciaDate] = useState('');
  const [descricao, setDescricao] = useState('');
  const [notaFile, setNotaFile] = useState<File | null>(null);
  const [notaFile2, setNotaFile2] = useState<File | null>(null);
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [extractingInvoice, setExtractingInvoice] = useState(false);
  const [drafts, setDrafts] = useState<InstallmentDraft[]>([]);
  const [uploadingBoletoIndex, setUploadingBoletoIndex] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [uploadWarnings, setUploadWarnings] = useState<string[]>([]);

  const { data: approvedOrders = [], isLoading: loadingOrders } = useQuery({
    queryKey: ['approvedOrdersForPayment', currentClient?.id],
    enabled: open,
    queryFn: () => listApprovedOrdersForPayment(currentClient?.id),
  });

  const selectedOrder = useMemo(
    () => approvedOrders.find((o) => o.id === orderId) ?? null,
    [approvedOrders, orderId],
  );

  const { data: existingInstallments = [] } = useQuery({
    queryKey: ['paymentInstallments', { maintenanceOrderId: orderId }],
    enabled: open && !!orderId,
    queryFn: async () => {
      const { data, error: qErr } = await supabase
        .from('payment_installments')
        .select('value, status')
        .eq('maintenance_order_id', orderId);
      if (qErr) throw qErr;
      return ((data ?? []) as { value: number; status: PaymentInstallmentStatus }[]).map((r) => ({
        value: Number(r.value),
        status: r.status,
      }));
    },
  });

  const alreadyRegistered = existingInstallments.length;
  const alreadyRegisteredSum = sumNonRejectedValue(existingInstallments);
  const saldo = selectedOrder
    ? remainingBudget(selectedOrder.approvedCost, existingInstallments)
    : 0;
  const draftsSum = useMemo(() => sumInstallmentsValue(drafts), [drafts]);
  const saldoAfterSave = useMemo(() => saldo - draftsSum, [saldo, draftsSum]);
  const overBudget = selectedOrder != null && draftsSum > saldo;

  if (!open) return null;

  const reset = () => {
    setOrderId(''); setBatchMode('batch'); setCount(1); setFirstDueDate('');
    setInterval('mensal'); setPaymentMethod('boleto'); setPixKeyType('aleatoria');
    setPixKey(''); setPixBeneficiaryName(''); setCategoria(''); setCentroCusto('');
    setCompetenciaDate(''); setDescricao(''); setNotaFile(null); setNotaFile2(null); setDrafts([]);
    setInvoiceNumber(''); setExtractingInvoice(false);
    setError(''); setUploadWarnings([]);
  };

  const handleNotaFileChange = async (file: File | null) => {
    setNotaFile(file);
    if (!file) return;

    setExtractingInvoice(true);
    try {
      const result = await extractInvoiceNumber(file);
      if (result.invoiceNumber) setInvoiceNumber(result.invoiceNumber);
    } finally {
      setExtractingInvoice(false);
    }
  };

  const handleGenerate = () => {
    setError('');
    if (!selectedOrder) { setError('Selecione uma OS aprovada.'); return; }
    const effectiveCount = batchMode === 'single' ? 1 : count;
    if (effectiveCount <= 0) { setError('Informe a quantidade de parcelas.'); return; }
    if (!firstDueDate) { setError('Informe o primeiro vencimento.'); return; }

    const generated = generateInstallmentDrafts({
      total: selectedOrder.approvedCost,
      count: effectiveCount,
      firstDueDate,
      interval,
    }).map<InstallmentDraft>((d) => ({
      ...d,
      paymentMethod,
      pixKeyType: paymentMethod === 'pix' ? pixKeyType : undefined,
      pixKey: paymentMethod === 'pix' ? pixKey || undefined : undefined,
      pixBeneficiaryName: paymentMethod === 'pix' ? pixBeneficiaryName || undefined : undefined,
    }));

    setDrafts(generated);
  };

  const handleUploadBoleto = async (index: number, file: File) => {
    if (!selectedOrder || !currentClient?.id) return;
    setUploadingBoletoIndex(index);
    try {
      const path = await uploadFinancialDocument(currentClient.id, selectedOrder.id, file, 'boleto');
      setDrafts((prev) => prev.map((d, i) => (i === index ? { ...d, boletoUrl: path } : d)));
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Falha ao anexar boleto.';
      setUploadWarnings((prev) => [...prev, `Parcela ${index + 1}: ${msg}`]);
    } finally {
      setUploadingBoletoIndex(null);
    }
  };

  const handleSave = async () => {
    setError('');
    setUploadWarnings([]);

    if (!selectedOrder) { setError('Selecione uma OS aprovada.'); return; }
    if (!user?.id || !currentClient?.id) { setError('Sessão inválida.'); return; }
    if (drafts.length === 0) { setError('Gere as parcelas antes de salvar.'); return; }
    if (!firstDueDate) { setError('Informe o primeiro vencimento.'); return; }

    setSaving(true);
    try {
      // Nota fiscal única (best-effort): falha não bloqueia o cadastro.
      let notaFiscalUrl: string | null = null;
      if (notaFile) {
        try {
          notaFiscalUrl = await uploadFinancialDocument(
            currentClient.id, selectedOrder.id, notaFile, 'nota',
          );
        } catch (err) {
          const msg = err instanceof Error ? err.message : 'Falha ao anexar nota fiscal.';
          setUploadWarnings((prev) => [...prev, msg]);
        }
      }

      let notaFiscalUrl2: string | null = null;
      if (notaFile2) {
        try {
          notaFiscalUrl2 = await uploadFinancialDocument(
            currentClient.id, selectedOrder.id, notaFile2, 'nota',
          );
        } catch (err) {
          const msg = err instanceof Error ? err.message : 'Falha ao anexar 2º documento.';
          setUploadWarnings((prev) => [...prev, msg]);
        }
      }

      const inputs: InstallmentDraftInput[] = drafts.map((d) => ({
        installmentNumber: d.installmentNumber,
        value: d.value,
        dueDate: d.dueDate,
        paymentMethod: d.paymentMethod ?? 'boleto',
        pixKeyType: d.pixKeyType ?? null,
        pixKey: d.pixKey ?? null,
        pixBeneficiaryName: d.pixBeneficiaryName ?? null,
        boletoUrl: d.boletoUrl ?? null,
      }));

      await createPaymentInstallmentsBatch({
        maintenanceOrderId: selectedOrder.id,
        clientId: currentClient.id,
        createdById: user.id,
        installmentsTotal: drafts.length,
        competenciaDate: competenciaDate || null,
        categoria: categoria || null,
        centroCusto: centroCusto || null,
        descricao: descricao || null,
        notaFiscalUrl,
        notaFiscalUrl2,
        invoiceNumber: invoiceNumber || null,
        drafts: inputs,
      });

      await queryClient.invalidateQueries({ queryKey: ['paymentInstallments'] });
      reset();
      onClose();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Falha ao cadastrar parcelas.';
      setError(msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/60 p-4">
      <div className="relative my-4 w-full max-w-3xl rounded-2xl bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b px-6 py-4">
          <div>
            <h2 className="text-base font-semibold text-zinc-900">Cadastrar Pagamento</h2>
            <p className="mt-0.5 text-xs text-zinc-500">Desdobre o orçamento aprovado em parcelas</p>
          </div>
          <button onClick={() => { reset(); onClose(); }} className="rounded-lg p-2 hover:bg-zinc-100">
            <X className="h-5 w-5 text-zinc-500" />
          </button>
        </div>

        <div className="space-y-5 px-6 py-4">
          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">{error}</div>
          )}
          {uploadWarnings.length > 0 && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-800">
              <p className="font-medium">Avisos de anexo:</p>
              <ul className="mt-1 list-inside list-disc">
                {uploadWarnings.map((w, i) => <li key={i}>{w}</li>)}
              </ul>
              <p className="mt-1 text-xs">As parcelas serão salvas mesmo sem os documentos (cadastre depois).</p>
            </div>
          )}

          {/* OS dropdown */}
          <div>
            <label className="mb-1 block text-sm font-medium text-zinc-700">
              Ordem de Serviço (orçamento aprovado) <span className="text-red-500">*</span>
            </label>
            {loadingOrders ? (
              <div className="flex items-center gap-2 py-2 text-zinc-400">
                <Loader2 className="h-4 w-4 animate-spin" /> <span className="text-sm">Carregando OS…</span>
              </div>
            ) : (
              <select
                value={orderId}
                onChange={(e) => { setOrderId(e.target.value); setDrafts([]); }}
                className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:ring-2 focus:ring-orange-400 focus:outline-none"
              >
                <option value="">— Selecione —</option>
                {approvedOrders.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.osNumber} — {o.workshopName} ({formatCurrency(o.approvedCost)})
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Order summary */}
          {selectedOrder && (
            <div className="rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3">
              <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                <div className="space-y-0.5">
                  <p className="font-medium text-zinc-800">{selectedOrder.workshopName}</p>
                  {selectedOrder.workshopCnpj && (
                    <p className="text-xs text-zinc-500">CNPJ: {selectedOrder.workshopCnpj}</p>
                  )}
                </div>
                <div className="text-right text-xs">
                  <p className="text-zinc-500">
                    Aprovado: <span className="font-semibold text-zinc-700">{formatCurrency(selectedOrder.approvedCost)}</span>
                  </p>
                  <p className="text-zinc-500">
                    Já cadastrado: <span className="font-semibold text-zinc-700">{formatCurrency(alreadyRegisteredSum)}</span> ({alreadyRegistered} parc.)
                  </p>
                  <p className="text-zinc-500">
                    Saldo restante: <span className="font-semibold text-zinc-700">{formatCurrency(saldo)}</span>
                  </p>
                </div>
                {selectedOrder.budgetPdfUrl && (
                  <a
                    href={selectedOrder.budgetPdfUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs font-medium text-orange-600 hover:text-orange-700"
                  >
                    📄 Ver orçamento
                  </a>
                )}
              </div>
            </div>
          )}

          {/* Batch fields */}
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
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
            {paymentMethod === 'pix' && (
              <>
                <div>
                  <label className="mb-1 block text-sm font-medium text-zinc-700">Tipo de chave Pix</label>
                  <select
                    value={pixKeyType}
                    onChange={(e) => setPixKeyType(e.target.value as PixKeyType)}
                    className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:ring-2 focus:ring-orange-400 focus:outline-none"
                  >
                    {PIX_KEY_TYPES.map((k) => <option key={k} value={k}>{k}</option>)}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-zinc-700">Chave Pix</label>
                  <input
                    type="text"
                    value={pixKey}
                    onChange={(e) => setPixKey(e.target.value)}
                    className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:ring-2 focus:ring-orange-400 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-zinc-700">Favorecido Pix</label>
                  <input
                    type="text"
                    value={pixBeneficiaryName}
                    onChange={(e) => setPixBeneficiaryName(e.target.value)}
                    className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:ring-2 focus:ring-orange-400 focus:outline-none"
                  />
                </div>
              </>
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
            <div>
              <label className="mb-1 block text-sm font-medium text-zinc-700">Data de Competência</label>
              <input
                type="date"
                value={competenciaDate}
                onChange={(e) => setCompetenciaDate(e.target.value)}
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

            {/* Nota fiscal (até 2 documentos, ambos opcionais) */}
            <div>
              <label className="mb-1 block text-sm font-medium text-zinc-700">Nota fiscal (opcional)</label>
              <input
                type="file"
                accept="application/pdf,image/jpeg,image/png,image/webp"
                onChange={(e) => { void handleNotaFileChange(e.target.files?.[0] ?? null); }}
                className="block w-full text-sm text-zinc-600 file:mr-3 file:rounded-lg file:border-0 file:bg-zinc-100 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-zinc-700 hover:file:bg-zinc-200"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-zinc-700">2º documento (opcional)</label>
              <input
                type="file"
                accept="application/pdf,image/jpeg,image/png,image/webp"
                onChange={(e) => setNotaFile2(e.target.files?.[0] ?? null)}
                className="block w-full text-sm text-zinc-600 file:mr-3 file:rounded-lg file:border-0 file:bg-zinc-100 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-zinc-700 hover:file:bg-zinc-200"
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
          </div>

          {/* Mode toggle + generation */}
          <div className="rounded-xl border border-zinc-200 p-4">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setBatchMode('single')}
                className={cn(
                  'rounded-lg px-3 py-1.5 text-sm font-medium transition-colors',
                  batchMode === 'single' ? 'bg-orange-500 text-white' : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200',
                )}
              >
                Parcela única
              </button>
              <button
                type="button"
                onClick={() => setBatchMode('batch')}
                className={cn(
                  'rounded-lg px-3 py-1.5 text-sm font-medium transition-colors',
                  batchMode === 'batch' ? 'bg-orange-500 text-white' : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200',
                )}
              >
                Gerar em lote
              </button>
            </div>

            <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-3">
              {batchMode === 'batch' && (
                <div>
                  <label className="mb-1 block text-sm font-medium text-zinc-700">Nº de parcelas</label>
                  <input
                    type="number"
                    min="1"
                    value={count}
                    onChange={(e) => setCount(Math.max(1, Number(e.target.value)))}
                    className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:ring-2 focus:ring-orange-400 focus:outline-none"
                  />
                </div>
              )}
              <div>
                <label className="mb-1 block text-sm font-medium text-zinc-700">1º vencimento</label>
                <input
                  type="date"
                  value={firstDueDate}
                  onChange={(e) => setFirstDueDate(e.target.value)}
                  className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:ring-2 focus:ring-orange-400 focus:outline-none"
                />
              </div>
              {batchMode === 'batch' && (
                <div>
                  <label className="mb-1 block text-sm font-medium text-zinc-700">Intervalo</label>
                  <select
                    value={interval}
                    onChange={(e) => setInterval(e.target.value as InstallmentInterval)}
                    className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:ring-2 focus:ring-orange-400 focus:outline-none"
                  >
                    {INTERVALS.map((i) => <option key={i} value={i}>{i}</option>)}
                  </select>
                </div>
              )}
            </div>

            <div className="mt-3 flex items-center gap-3">
              <button
                type="button"
                onClick={handleGenerate}
                disabled={!selectedOrder}
                className="rounded-lg border border-orange-300 bg-orange-50 px-4 py-2 text-sm font-medium text-orange-700 transition-colors hover:bg-orange-100 disabled:opacity-50"
              >
                Gerar parcelas
              </button>
              {drafts.length > 0 && (
                <span className="text-xs text-zinc-500">
                  {drafts.length} parcela(s) · total {formatCurrency(draftsSum)}
                  {' · saldo após salvar '}
                  <span className={cn('font-medium', overBudget ? 'text-red-600' : 'text-zinc-600')}>
                    {formatCurrency(saldoAfterSave)}
                  </span>
                  {overBudget && (
                    <span className="ml-1 text-amber-600">⚠ soma maior que o saldo</span>
                  )}
                </span>
              )}
            </div>
          </div>

          {/* Drafts table */}
          {drafts.length > 0 && (
            <div>
              <h3 className="mb-2 text-xs font-semibold tracking-wider text-zinc-500 uppercase">
                Revisão das parcelas
              </h3>
              <InstallmentDraftTable
                drafts={drafts}
                onChange={setDrafts}
                onUploadBoleto={(index, file) => { void handleUploadBoleto(index, file); }}
                uploadingBoletoIndex={uploadingBoletoIndex}
              />
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 rounded-b-2xl border-t bg-zinc-50 px-6 py-4">
          {overBudget && (
            <p className="mr-auto text-xs font-medium text-red-600">
              A soma das parcelas ultrapassa o saldo do orçamento. Ajuste os valores para continuar.
            </p>
          )}
          <button onClick={() => { reset(); onClose(); }} className="px-4 py-2 text-sm text-zinc-600 hover:text-zinc-900">
            Cancelar
          </button>
          <button
            type="button"
            onClick={() => { void handleSave(); }}
            disabled={saving || drafts.length === 0 || overBudget}
            className="flex items-center gap-2 rounded-lg bg-orange-500 px-5 py-2 text-sm font-medium text-white hover:bg-orange-600 disabled:opacity-50"
          >
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            Salvar {drafts.length > 0 ? `${drafts.length} parcela(s)` : ''}
          </button>
        </div>
      </div>
    </div>
  );
}
