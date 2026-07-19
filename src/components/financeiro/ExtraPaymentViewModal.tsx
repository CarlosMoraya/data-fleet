import { useQuery } from '@tanstack/react-query';
import { X } from 'lucide-react';
import React from 'react';

import { getFinancialDocumentSignedUrl } from '../../lib/storageHelpers';
import { cn } from '../../lib/utils';
import { listPaymentInstallments } from '../../services/paymentInstallmentService';
import { getExtraPaymentAuditors } from '../../services/serviceExpenseService';

import type { ExtraPaymentCategory, ExtraPaymentRequest, ExtraPaymentStatus } from '../../types/serviceExpense';

const STATUS_LABELS: Record<ExtraPaymentStatus, string> = {
  pendente_aprovacao: 'Pendente de aprovação',
  aprovado: 'Aprovado',
  reprovado: 'Reprovado',
  pago: 'Pago',
  cancelado: 'Cancelado',
};

const STATUS_BADGE: Record<ExtraPaymentStatus, string> = {
  pendente_aprovacao: 'bg-amber-100 text-amber-700',
  aprovado: 'bg-blue-100 text-blue-700',
  reprovado: 'bg-red-100 text-red-700',
  pago: 'bg-green-100 text-green-700',
  cancelado: 'bg-zinc-100 text-zinc-500',
};

const CATEGORY_LABELS: Record<ExtraPaymentCategory, string> = {
  guincho: 'Guincho',
  borracheiro: 'Borracheiro',
  chaveiro: 'Chaveiro',
  uber: 'Uber',
  taxi: 'Táxi',
  frete_apoio: 'Frete de apoio',
  outro: 'Outro',
};

interface ExtraPaymentViewModalProps {
  open: boolean;
  request: ExtraPaymentRequest;
  onClose: () => void;
}

function formatCurrency(value: number): string {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function formatDate(iso?: string): string {
  if (!iso) return '—';
  const date = iso.includes('T') ? new Date(iso) : new Date(`${iso}T00:00:00`);
  return date.toLocaleDateString('pt-BR');
}

function formatDateTime(iso?: string): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('pt-BR');
}

async function openSignedUrl(path: string): Promise<void> {
  try {
    const url = await getFinancialDocumentSignedUrl(path);
    window.open(url, '_blank', 'noopener,noreferrer');
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Falha ao abrir documento.';
    window.alert(msg);
  }
}

export default function ExtraPaymentViewModal({
  open,
  request,
  onClose,
}: ExtraPaymentViewModalProps): React.ReactElement | null {
  const { data: auditors } = useQuery({
    queryKey: ['extraPaymentAuditors', request.id],
    queryFn: () => getExtraPaymentAuditors(request.id),
    enabled: open,
    staleTime: 60_000,
  });

  const { data: installments = [] } = useQuery({
    queryKey: ['paymentInstallments', 'byExtraPaymentRequest', request.id],
    queryFn: () => listPaymentInstallments({ sourceType: 'extra_payment' }),
    enabled: open,
    select: (list) => list.filter((i) => i.extraPaymentRequestId === request.id),
  });

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/60 p-4">
      <div className="relative my-4 w-full max-w-2xl rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b px-6 py-4">
          <div>
            <h2 className="text-base font-semibold text-zinc-900">{request.requestNumber}</h2>
            <p className="mt-0.5 text-xs text-zinc-500">Detalhes do Pagamento Extra</p>
          </div>
          <button onClick={onClose} className="rounded-lg p-2 hover:bg-zinc-100">
            <X className="h-5 w-5 text-zinc-500" />
          </button>
        </div>

        <div className="space-y-5 px-6 py-4">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <ReadField label="Categoria" value={CATEGORY_LABELS[request.category]} />
            <div>
              <p className="mb-1 text-xs font-medium text-zinc-500">Status</p>
              <span className={cn('inline-flex rounded-full px-2 py-0.5 text-xs font-medium', STATUS_BADGE[request.status])}>
                {STATUS_LABELS[request.status]}
              </span>
            </div>
            <ReadField label="Data do serviço" value={formatDate(request.serviceDate)} />
            <ReadField label="Valor" value={formatCurrency(request.amount)} />
            <ReadField label="Fornecedor" value={request.supplierName} />
            <ReadField label="CPF/CNPJ do fornecedor" value={request.supplierDocument ?? '—'} />
            <ReadField label="Veículo" value={request.vehicleLicensePlate ?? '—'} />
            <ReadField label="Motorista" value={request.driverName ?? '—'} />
            <ReadField label="Descrição" value={request.description ?? '—'} wide />
            <ReadField label="Justificativa" value={request.justification ?? '—'} wide />
            <ReadField label="Observações" value={request.notes ?? '—'} wide />
            {request.status === 'reprovado' && (
              <ReadField label="Motivo da reprovação" value={request.rejectionReason ?? '—'} wide />
            )}
          </div>

          <section className="rounded-xl border border-zinc-200 p-4">
            <h3 className="mb-3 text-xs font-semibold tracking-wider text-zinc-500 uppercase">Documentos</h3>
            <div className="flex flex-wrap gap-2">
              {request.invoiceUrl && <DocumentButton label="NF/Fatura" path={request.invoiceUrl} />}
              {request.receiptUrl && <DocumentButton label="Comprovante/recibo" path={request.receiptUrl} />}
              {!request.invoiceUrl && !request.receiptUrl && (
                <span className="text-sm text-zinc-400">Nenhum documento anexado.</span>
              )}
            </div>
          </section>

          <section className="rounded-xl border border-zinc-200 p-4">
            <h3 className="mb-3 text-xs font-semibold tracking-wider text-zinc-500 uppercase">Evidências do serviço</h3>
            <div className="flex flex-wrap gap-2">
              {request.evidenceUrls && request.evidenceUrls.length > 0 ? (
                request.evidenceUrls.map((path, index) => (
                  <DocumentButton key={path} label={`Foto ${index + 1}`} path={path} />
                ))
              ) : (
                <span className="text-sm text-zinc-400">Nenhuma evidência anexada.</span>
              )}
            </div>
          </section>

          <section className="rounded-xl border border-zinc-200 p-4">
            <h3 className="mb-3 text-xs font-semibold tracking-wider text-zinc-500 uppercase">Parcelas</h3>
            {installments.length === 0 ? (
              <p className="text-sm text-zinc-400">Nenhuma parcela cadastrada.</p>
            ) : (
              <div className="overflow-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="border-b border-zinc-200">
                      <th className="px-2 py-1.5 text-left text-xs font-semibold text-zinc-500 uppercase">Parc.</th>
                      <th className="px-2 py-1.5 text-left text-xs font-semibold text-zinc-500 uppercase">Valor</th>
                      <th className="px-2 py-1.5 text-left text-xs font-semibold text-zinc-500 uppercase">Vencimento</th>
                      <th className="px-2 py-1.5 text-left text-xs font-semibold text-zinc-500 uppercase">Forma</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100">
                    {installments.map((i) => (
                      <tr key={i.id}>
                        <td className="px-2 py-1.5 text-zinc-600">{i.installmentNumber}/{i.installmentsTotal}</td>
                        <td className="px-2 py-1.5 font-medium text-zinc-800">{formatCurrency(i.value)}</td>
                        <td className="px-2 py-1.5 text-zinc-600">{formatDate(i.dueDate)}</td>
                        <td className="px-2 py-1.5 text-zinc-600">{i.paymentMethod === 'pix' ? 'Pix' : 'Boleto'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section className="rounded-xl border border-zinc-200 p-4">
            <h3 className="mb-3 text-xs font-semibold tracking-wider text-zinc-500 uppercase">Auditoria</h3>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <ReadField label="Solicitado por" value={auditors?.createdByName ?? '—'} />
              <ReadField label="Criado em" value={formatDateTime(request.createdAt)} />
              <ReadField label="Aprovado por" value={auditors?.approvedByName ?? '—'} />
              <ReadField label="Aprovado em" value={formatDateTime(request.approvedAt)} />
              <ReadField label="Reprovado por" value={auditors?.rejectedByName ?? '—'} />
              <ReadField label="Reprovado em" value={formatDateTime(request.rejectedAt)} />
              <ReadField label="Pago por" value={auditors?.paidByName ?? '—'} />
              <ReadField label="Pago em" value={formatDateTime(request.paidAt)} />
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

function ReadField({
  label,
  value,
  wide = false,
}: {
  label: string;
  value: string;
  wide?: boolean;
}): React.ReactElement {
  return (
    <div className={wide ? 'md:col-span-2' : undefined}>
      <p className="mb-1 text-xs font-medium text-zinc-500">{label}</p>
      <p className="text-sm font-medium break-words text-zinc-800">{value}</p>
    </div>
  );
}

function DocumentButton({ label, path }: { label: string; path: string }): React.ReactElement {
  return (
    <button
      type="button"
      onClick={() => { void openSignedUrl(path); }}
      className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
    >
      {label}
    </button>
  );
}
