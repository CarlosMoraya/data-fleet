import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, X } from 'lucide-react';
import React, { useMemo, useState } from 'react';

import { useAuth } from '../../context/AuthContext';
import { generateInstallmentDrafts, sumInstallmentsValue } from '../../lib/paymentInstallments';
import {
  applySharedBoletoToDrafts,
  clearSharedBoletoFromDrafts,
  countDraftsWithDistinctBoleto,
} from '../../lib/sharedBoleto';
import { uploadFinancialDocument } from '../../lib/storageHelpers';
import { supabase } from '../../lib/supabase';
import { cn } from '../../lib/utils';
import {
  createExtraPaymentInstallmentsBatch,
  type InstallmentDraftInput,
} from '../../services/paymentInstallmentService';
import {
  createExtraPaymentRequest,
  listExtraPaymentDrivers,
  listExtraPaymentVehicles,
} from '../../services/serviceExpenseService';

import ExtraPaymentEvidencePhotos from './ExtraPaymentEvidencePhotos';
import InstallmentDraftTable from './InstallmentDraftTable';

import type {
  InstallmentDraft,
  InstallmentInterval,
  PaymentMethod,
  PixKeyType,
} from '../../types/payment';
import type {
  ExtraPaymentCategory,
  ExtraPaymentDriverOption,
  ExtraPaymentVehicleOption,
} from '../../types/serviceExpense';

interface ExtraPaymentFormModalProps {
  open: boolean;
  onClose: () => void;
}

type BatchMode = 'single' | 'batch';

const INTERVALS: InstallmentInterval[] = ['mensal', 'quinzenal', 'semanal'];
const PIX_KEY_TYPES: PixKeyType[] = ['cpf', 'cnpj', 'email', 'telefone', 'aleatoria'];

const CATEGORY_OPTIONS: { value: ExtraPaymentCategory; label: string }[] = [
  { value: 'guincho', label: 'Guincho' },
  { value: 'borracheiro', label: 'Borracheiro' },
  { value: 'chaveiro', label: 'Chaveiro' },
  { value: 'uber', label: 'Uber' },
  { value: 'taxi', label: 'Táxi' },
  { value: 'frete_apoio', label: 'Frete de apoio' },
  { value: 'outro', label: 'Outro' },
];

const CATEGORY_DESCRIPTION_SUGGESTIONS: Record<ExtraPaymentCategory, string> = {
  guincho: 'Serviço de guincho',
  borracheiro: 'Serviço de borracheiro',
  chaveiro: 'Serviço de chaveiro',
  uber: 'Corrida de Uber',
  taxi: 'Corrida de táxi',
  frete_apoio: 'Frete de apoio',
  outro: '',
};

function formatCurrency(value: number): string {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

/** Acha o motorista vinculado a um veículo, se houver. */
export function resolveVehicleDriverPrefill(
  vehicleId: string,
  vehicles: ExtraPaymentVehicleOption[],
): { driverId: string; driverName: string } | null {
  const vehicle = vehicles.find((v) => v.id === vehicleId);
  if (!vehicle?.driverId || !vehicle.driverName) return null;
  return { driverId: vehicle.driverId, driverName: vehicle.driverName };
}

/** Acha o veículo vinculado a um motorista, se houver. */
export function resolveDriverVehiclePrefill(
  driverId: string,
  drivers: ExtraPaymentDriverOption[],
): { vehicleId: string; licensePlate: string } | null {
  const driver = drivers.find((d) => d.id === driverId);
  if (!driver?.vehicleId || !driver.vehicleLicensePlate) return null;
  return { vehicleId: driver.vehicleId, licensePlate: driver.vehicleLicensePlate };
}

export default function ExtraPaymentFormModal({
  open,
  onClose,
}: ExtraPaymentFormModalProps): React.ReactElement | null {
  const { user, currentClient } = useAuth();
  const queryClient = useQueryClient();

  const [category, setCategory] = useState<ExtraPaymentCategory>('guincho');
  const [serviceDate, setServiceDate] = useState('');
  const [supplierName, setSupplierName] = useState('');
  const [supplierDocument, setSupplierDocument] = useState('');
  const [vehicleId, setVehicleId] = useState('');
  const [driverId, setDriverId] = useState('');
  const [description, setDescription] = useState('');
  const [centroCusto, setCentroCusto] = useState('');
  const [justification, setJustification] = useState('');
  const [notes, setNotes] = useState('');
  const [amount, setAmount] = useState(0);
  const [batchMode, setBatchMode] = useState<BatchMode>('single');
  const [count, setCount] = useState(1);
  const [firstDueDate, setFirstDueDate] = useState('');
  const [interval, setInterval] = useState<InstallmentInterval>('mensal');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('boleto');
  const [pixKeyType, setPixKeyType] = useState<PixKeyType>('aleatoria');
  const [pixKey, setPixKey] = useState('');
  const [pixBeneficiaryName, setPixBeneficiaryName] = useState('');
  const [invoiceFile, setInvoiceFile] = useState<File | null>(null);
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [evidenceFiles, setEvidenceFiles] = useState<File[]>([]);
  const [drafts, setDrafts] = useState<InstallmentDraft[]>([]);
  const [uploadingBoletoIndex, setUploadingBoletoIndex] = useState<number | null>(null);
  const [sharedBoletoPath, setSharedBoletoPath] = useState<string>('');
  const [uploadingSharedBoleto, setUploadingSharedBoleto] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [uploadWarnings, setUploadWarnings] = useState<string[]>([]);

  const { data: vehicles = [], isLoading: loadingVehicles, error: vehiclesError } = useQuery({
    queryKey: ['extraPaymentVehicles', currentClient?.id],
    enabled: open,
    queryFn: () => listExtraPaymentVehicles(currentClient?.id),
  });

  const { data: drivers = [], isLoading: loadingDrivers, error: driversError } = useQuery({
    queryKey: ['extraPaymentDrivers', currentClient?.id],
    enabled: open,
    queryFn: () => listExtraPaymentDrivers(currentClient?.id),
  });

  const draftsSum = useMemo(() => sumInstallmentsValue(drafts), [drafts]);

  if (!open) return null;

  const reset = () => {
    setCategory('guincho'); setServiceDate(''); setSupplierName(''); setSupplierDocument('');
    setVehicleId(''); setDriverId(''); setDescription(''); setCentroCusto(''); setJustification(''); setNotes('');
    setAmount(0); setBatchMode('single'); setCount(1); setFirstDueDate(''); setInterval('mensal');
    setPaymentMethod('boleto'); setPixKeyType('aleatoria'); setPixKey(''); setPixBeneficiaryName('');
    setInvoiceFile(null); setReceiptFile(null); setDrafts([]);
    setSharedBoletoPath(''); setUploadingSharedBoleto(false); setEvidenceFiles([]);
    setError(''); setUploadWarnings([]);
  };

  const handleVehicleChange = (nextVehicleId: string) => {
    setVehicleId(nextVehicleId);
    const prefill = resolveVehicleDriverPrefill(nextVehicleId, vehicles);
    if (prefill) setDriverId(prefill.driverId);
    if (!description) {
      const suggestion = CATEGORY_DESCRIPTION_SUGGESTIONS[category];
      if (suggestion) setDescription(suggestion);
    }
  };

  const handleDriverChange = (nextDriverId: string) => {
    setDriverId(nextDriverId);
    const prefill = resolveDriverVehiclePrefill(nextDriverId, drivers);
    if (prefill) setVehicleId(prefill.vehicleId);
  };

  const handleCategoryChange = (nextCategory: ExtraPaymentCategory) => {
    setCategory(nextCategory);
    if (!description) {
      const suggestion = CATEGORY_DESCRIPTION_SUGGESTIONS[nextCategory];
      if (suggestion) setDescription(suggestion);
    }
  };

  const handleSupplierNameChange = (value: string) => {
    setSupplierName(value);
    if (!pixBeneficiaryName) setPixBeneficiaryName(value);
  };

  const handleGenerate = () => {
    setError('');
    if (amount <= 0) { setError('Informe o valor.'); return; }
    const effectiveCount = batchMode === 'single' ? 1 : count;
    if (effectiveCount <= 0) { setError('Informe a quantidade de parcelas.'); return; }
    if (!firstDueDate) { setError('Informe o primeiro vencimento.'); return; }

    const generated = generateInstallmentDrafts({
      total: amount,
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

    setDrafts(sharedBoletoPath ? applySharedBoletoToDrafts(generated, sharedBoletoPath) : generated);
  };

  const handleUploadBoleto = async (index: number, file: File) => {
    if (!currentClient?.id) return;
    setUploadingBoletoIndex(index);
    try {
      const path = await uploadFinancialDocument(currentClient.id, 'extra', file, 'boleto');
      setDrafts((prev) => prev.map((d, i) => (i === index ? { ...d, boletoUrl: path } : d)));
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Falha ao anexar boleto.';
      setUploadWarnings((prev) => [...prev, `Parcela ${index + 1}: ${msg}`]);
    } finally {
      setUploadingBoletoIndex(null);
    }
  };

  const handleSharedBoletoPick = async (file: File) => {
    if (!currentClient?.id) return;

    const distintos = countDraftsWithDistinctBoleto(drafts, sharedBoletoPath);
    if (distintos > 0) {
      const confirmed = window.confirm(
        `Isso vai substituir o boleto de ${distintos} parcela(s) já anexado(s). Continuar?`,
      );
      if (!confirmed) return;
    }

    setUploadingSharedBoleto(true);
    try {
      const path = await uploadFinancialDocument(currentClient.id, 'extra', file, 'boleto');
      setSharedBoletoPath(path);
      setDrafts((prev) => applySharedBoletoToDrafts(prev, path));
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Falha ao anexar boleto único.';
      setUploadWarnings((prev) => [...prev, msg]);
    } finally {
      setUploadingSharedBoleto(false);
    }
  };

  const handleRemoveSharedBoleto = () => {
    setDrafts((prev) => clearSharedBoletoFromDrafts(prev, sharedBoletoPath));
    setSharedBoletoPath('');
  };

  const handleSave = async () => {
    setError('');
    setUploadWarnings([]);

    if (!user?.id || !currentClient?.id) { setError('Sessão inválida.'); return; }
    if (!serviceDate) { setError('Informe a data do serviço.'); return; }
    if (!supplierName.trim()) { setError('Informe o fornecedor.'); return; }
    if (amount <= 0) { setError('Informe o valor.'); return; }
    if (drafts.length === 0) { setError('Gere as parcelas antes de salvar.'); return; }

    setSaving(true);
    try {
      const requestId = await createExtraPaymentRequest({
        input: {
          category,
          serviceDate,
          supplierName: supplierName.trim(),
          supplierDocument: supplierDocument || undefined,
          vehicleId: vehicleId || undefined,
          driverId: driverId || undefined,
          amount,
          description: description || undefined,
          justification: justification || undefined,
          notes: notes || undefined,
        },
        clientId: currentClient.id,
        userId: user.id,
      });

      let invoiceUrl: string | null = null;
      if (invoiceFile) {
        try {
          invoiceUrl = await uploadFinancialDocument(currentClient.id, requestId, invoiceFile, 'nota');
        } catch (err) {
          const msg = err instanceof Error ? err.message : 'Falha ao anexar NF/Fatura.';
          setUploadWarnings((prev) => [...prev, msg]);
        }
      }

      let receiptUrl: string | null = null;
      if (receiptFile) {
        try {
          receiptUrl = await uploadFinancialDocument(currentClient.id, requestId, receiptFile, 'nota');
        } catch (err) {
          const msg = err instanceof Error ? err.message : 'Falha ao anexar comprovante/recibo.';
          setUploadWarnings((prev) => [...prev, msg]);
        }
      }

      const evidenceUrls: string[] = [];
      for (const file of evidenceFiles) {
        try {
          evidenceUrls.push(
            await uploadFinancialDocument(currentClient.id, requestId, file, 'evidencia'),
          );
        } catch (err) {
          const msg = err instanceof Error ? err.message : 'Falha ao anexar foto de evidência.';
          setUploadWarnings((prev) => [...prev, msg]);
        }
      }

      if (invoiceUrl || receiptUrl || evidenceUrls.length > 0) {
        await supabase
          .from('extra_payment_requests')
          .update({
            invoice_url: invoiceUrl,
            receipt_url: receiptUrl,
            evidence_urls: evidenceUrls.length > 0 ? evidenceUrls : null,
          })
          .eq('id', requestId);
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

      await createExtraPaymentInstallmentsBatch({
        extraPaymentRequestId: requestId,
        clientId: currentClient.id,
        createdById: user.id,
        installmentsTotal: drafts.length,
        centroCusto: centroCusto || undefined,
        drafts: inputs,
      });

      await queryClient.invalidateQueries({ queryKey: ['extraPaymentRequests'] });
      await queryClient.invalidateQueries({ queryKey: ['paymentInstallments'] });
      reset();
      onClose();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Falha ao cadastrar o pagamento extra.';
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
            <h2 className="text-base font-semibold text-zinc-900">Novo Pagamento Extra</h2>
            <p className="mt-0.5 text-xs text-zinc-500">Despesa operacional sem vínculo com manutenção</p>
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
            </div>
          )}
          {(vehiclesError || driversError) && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-800">
              Falha ao carregar veículos/motoristas. É possível cadastrar sem vínculo operacional.
            </div>
          )}

          {/* Contexto */}
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-zinc-700">
                Categoria <span className="text-red-500">*</span>
              </label>
              <select
                value={category}
                onChange={(e) => handleCategoryChange(e.target.value as ExtraPaymentCategory)}
                className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:ring-2 focus:ring-orange-400 focus:outline-none"
              >
                {CATEGORY_OPTIONS.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-zinc-700">
                Data do serviço <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                value={serviceDate}
                onChange={(e) => setServiceDate(e.target.value)}
                className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:ring-2 focus:ring-orange-400 focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-zinc-700">
                Fornecedor <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={supplierName}
                onChange={(e) => handleSupplierNameChange(e.target.value)}
                className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:ring-2 focus:ring-orange-400 focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-zinc-700">CPF/CNPJ do fornecedor</label>
              <input
                type="text"
                value={supplierDocument}
                onChange={(e) => setSupplierDocument(e.target.value)}
                className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:ring-2 focus:ring-orange-400 focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-zinc-700">Veículo</label>
              {loadingVehicles ? (
                <div className="flex items-center gap-2 py-2 text-zinc-400">
                  <Loader2 className="h-4 w-4 animate-spin" /> <span className="text-sm">Carregando…</span>
                </div>
              ) : (
                <select
                  value={vehicleId}
                  onChange={(e) => handleVehicleChange(e.target.value)}
                  className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:ring-2 focus:ring-orange-400 focus:outline-none"
                >
                  <option value="">— Sem vínculo —</option>
                  {vehicles.map((v) => <option key={v.id} value={v.id}>{v.licensePlate}</option>)}
                </select>
              )}
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-zinc-700">Motorista</label>
              {loadingDrivers ? (
                <div className="flex items-center gap-2 py-2 text-zinc-400">
                  <Loader2 className="h-4 w-4 animate-spin" /> <span className="text-sm">Carregando…</span>
                </div>
              ) : (
                <select
                  value={driverId}
                  onChange={(e) => handleDriverChange(e.target.value)}
                  className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:ring-2 focus:ring-orange-400 focus:outline-none"
                >
                  <option value="">— Sem vínculo —</option>
                  {drivers.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              )}
            </div>
            <div className="md:col-span-2">
              <label className="mb-1 block text-sm font-medium text-zinc-700">Descrição</label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
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
              <label className="mb-1 block text-sm font-medium text-zinc-700">Justificativa</label>
              <input
                type="text"
                value={justification}
                onChange={(e) => setJustification(e.target.value)}
                className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:ring-2 focus:ring-orange-400 focus:outline-none"
              />
            </div>
            <div className="md:col-span-2">
              <label className="mb-1 block text-sm font-medium text-zinc-700">Observações</label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:ring-2 focus:ring-orange-400 focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-zinc-700">NF/Fatura (opcional)</label>
              <input
                type="file"
                accept="application/pdf,image/jpeg,image/png,image/webp"
                onChange={(e) => setInvoiceFile(e.target.files?.[0] ?? null)}
                className="block w-full text-sm text-zinc-600 file:mr-3 file:rounded-lg file:border-0 file:bg-zinc-100 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-zinc-700 hover:file:bg-zinc-200"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-zinc-700">Comprovante/recibo (opcional)</label>
              <input
                type="file"
                accept="application/pdf,image/jpeg,image/png,image/webp"
                onChange={(e) => setReceiptFile(e.target.files?.[0] ?? null)}
                className="block w-full text-sm text-zinc-600 file:mr-3 file:rounded-lg file:border-0 file:bg-zinc-100 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-zinc-700 hover:file:bg-zinc-200"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-zinc-700">Boleto único (opcional)</label>
              {sharedBoletoPath ? (
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
                    Boleto único anexado
                  </span>
                  <button type="button" onClick={handleRemoveSharedBoleto}
                    className="text-xs font-medium text-zinc-500 hover:text-red-600">
                    Remover
                  </button>
                </div>
              ) : (
                <input type="file" accept="application/pdf,image/jpeg,image/png,image/webp"
                  disabled={uploadingSharedBoleto}
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) void handleSharedBoletoPick(f); e.target.value = ''; }}
                  className="block w-full text-sm text-zinc-600 file:mr-3 file:rounded-lg file:border-0 file:bg-zinc-100 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-zinc-700 hover:file:bg-zinc-200" />
              )}
              <p className="mt-1 text-xs text-zinc-500">
                Um único arquivo com todos os boletos. Ao anexar, o boleto individual por parcela fica desabilitado.
              </p>
            </div>
            <div className="md:col-span-2">
              <ExtraPaymentEvidencePhotos files={evidenceFiles} onChange={setEvidenceFiles} disabled={saving} />
            </div>
          </div>

          {/* Pagamento */}
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-zinc-700">
                Valor <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={amount}
                onChange={(e) => setAmount(Number(e.target.value))}
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
                <div className="md:col-span-2">
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
                className="rounded-lg border border-orange-300 bg-orange-50 px-4 py-2 text-sm font-medium text-orange-700 transition-colors hover:bg-orange-100 disabled:opacity-50"
              >
                Gerar parcelas
              </button>
              {drafts.length > 0 && (
                <span className="text-xs text-zinc-500">
                  {drafts.length} parcela(s) · total {formatCurrency(draftsSum)}
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
                sharedBoletoPath={sharedBoletoPath}
              />
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 rounded-b-2xl border-t bg-zinc-50 px-6 py-4">
          <button onClick={() => { reset(); onClose(); }} className="px-4 py-2 text-sm text-zinc-600 hover:text-zinc-900">
            Cancelar
          </button>
          <button
            type="button"
            onClick={() => { void handleSave(); }}
            disabled={saving || drafts.length === 0}
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
