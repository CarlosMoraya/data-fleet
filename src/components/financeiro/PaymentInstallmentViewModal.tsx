import { useQuery } from '@tanstack/react-query';
import { X } from 'lucide-react';
import React from 'react';

import { getFinancialDocumentSignedUrl } from '../../lib/storageHelpers';
import { cn } from '../../lib/utils';
import { getPaymentInstallmentAuditors } from '../../services/paymentInstallmentService';

import type { PaymentInstallment, PaymentInstallmentStatus } from '../../types/payment';

const STATUS_LABELS: Record<PaymentInstallmentStatus, string> = {
  pendente_aprovacao: 'Pendente de aprovação',
  aprovado: 'Aprovado',
  reprovado: 'Reprovado',
  pago: 'Pago',
};

const STATUS_BADGE: Record<PaymentInstallmentStatus, string> = {
  pendente_aprovacao: 'bg-amber-100 text-amber-700',
  aprovado: 'bg-blue-100 text-blue-700',
  reprovado: 'bg-red-100 text-red-700',
  pago: 'bg-green-100 text-green-700',
};

interface PaymentInstallmentViewModalProps {
  open: boolean;
  installment: PaymentInstallment;
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

async function openSignedUrl(path: string): Promise<void> {
  try {
    const url = await getFinancialDocumentSignedUrl(path);
    window.open(url, '_blank', 'noopener,noreferrer');
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Falha ao abrir documento.';
    window.alert(msg);
  }
}

export default function PaymentInstallmentViewModal({
  open,
  installment,
  onClose,
}: PaymentInstallmentViewModalProps): React.ReactElement | null {
  const { data: auditors } = useQuery({
    queryKey: ['paymentInstallmentAuditors', installment.id],
    queryFn: () => getPaymentInstallmentAuditors(installment.id),
    enabled: open,
    staleTime: 60_000,
  });

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/60 p-4">
      <div className="relative my-4 w-full max-w-2xl rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b px-6 py-4">
          <div>
            <h2 className="text-base font-semibold text-zinc-900">
              Parcela {installment.installmentNumber}/{installment.installmentsTotal}
            </h2>
            <p className="mt-0.5 text-xs text-zinc-500">Detalhes do pagamento</p>
          </div>
          <button onClick={onClose} className="rounded-lg p-2 hover:bg-zinc-100">
            <X className="h-5 w-5 text-zinc-500" />
          </button>
        </div>

        <div className="space-y-5 px-6 py-4">
          <section className="rounded-xl border border-zinc-200 p-4">
            <h3 className="mb-3 text-xs font-semibold tracking-wider text-zinc-500 uppercase">Origem</h3>
            {installment.sourceType === 'extra_payment' ? (
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <ReadField label="Número do pagamento extra" value={installment.extraPaymentNumber ?? '—'} />
                <ReadField label="Categoria" value={installment.extraPaymentCategory ?? '—'} />
                <ReadField label="Fornecedor" value={installment.extraPaymentSupplierName ?? '—'} />
                <ReadField label="CPF/CNPJ" value={installment.extraPaymentSupplierDocument ?? '—'} />
                <ReadField label="Veículo" value={installment.extraPaymentVehiclePlate ?? '—'} />
                <ReadField label="Motorista" value={installment.extraPaymentDriverName ?? '—'} />
                <ReadField label="Aprovado por" value={installment.extraPaymentApprovedByName ?? '—'} />
              </div>
            ) : (
              <ReadField label="Ordem de Serviço" value={installment.maintenanceOrderOs ?? installment.maintenanceOrderId ?? '—'} />
            )}
          </section>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <ReadField label="NF/Fatura" value={installment.invoiceNumber ?? '—'} />
            <ReadField label="Valor" value={formatCurrency(installment.value)} />
            <ReadField label="Vencimento" value={formatDate(installment.dueDate)} />
            <ReadField label="Competência" value={formatDate(installment.competenciaDate)} />
            <ReadField label="Forma de pagamento" value={installment.paymentMethod === 'pix' ? 'Pix' : 'Boleto'} />
            <div>
              <p className="mb-1 text-xs font-medium text-zinc-500">Status</p>
              <span className={cn('inline-flex rounded-full px-2 py-0.5 text-xs font-medium', STATUS_BADGE[installment.status])}>
                {STATUS_LABELS[installment.status]}
              </span>
            </div>
            <ReadField label="Categoria" value={installment.categoria ?? '—'} />
            <ReadField label="Cliente/Fornecedor" value={installment.workshopName ?? '—'} />
            <ReadField label="CNPJ/CPF Cliente/Fornecedor" value={installment.workshopCnpj ?? '—'} />
            <ReadField label="Centro de custo" value={installment.centroCusto ?? '—'} />
            <ReadField label="Descrição" value={installment.descricao ?? '—'} wide />
            <ReadField label="Observações" value={installment.notes ?? '—'} wide />
          </div>

          {installment.paymentMethod === 'pix' && (
            <section className="rounded-xl border border-zinc-200 p-4">
              <h3 className="mb-3 text-xs font-semibold tracking-wider text-zinc-500 uppercase">Pix</h3>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                <ReadField label="Tipo" value={installment.pixKeyType ?? '—'} />
                <ReadField label="Chave" value={installment.pixKey ?? '—'} />
                <ReadField label="Beneficiário" value={installment.pixBeneficiaryName ?? '—'} />
              </div>
            </section>
          )}

          <section className="rounded-xl border border-zinc-200 p-4">
            <h3 className="mb-3 text-xs font-semibold tracking-wider text-zinc-500 uppercase">Documentos</h3>
            <div className="flex flex-wrap gap-2">
              {installment.budgetPdfUrl && (
                <a
                  href={installment.budgetPdfUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
                >
                  Orçamento
                </a>
              )}
              {installment.boletoUrl && (
                <DocumentButton label="Boleto" path={installment.boletoUrl} />
              )}
              {installment.notaFiscalUrl && (
                <DocumentButton label="Nota fiscal" path={installment.notaFiscalUrl} />
              )}
              {installment.notaFiscalUrl2 && (
                <DocumentButton label="2º documento" path={installment.notaFiscalUrl2} />
              )}
              {!installment.budgetPdfUrl && !installment.boletoUrl && !installment.notaFiscalUrl && !installment.notaFiscalUrl2 && (
                <span className="text-sm text-zinc-400">Nenhum documento anexado.</span>
              )}
            </div>
          </section>

          <section className="rounded-xl border border-zinc-200 p-4">
            <h3 className="mb-3 text-xs font-semibold tracking-wider text-zinc-500 uppercase">Auditoria</h3>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <ReadField label="Orçamento aprovado por" value={auditors?.budgetApprovedByName ?? installment.budgetApprovedByName ?? '—'} />
              <ReadField label="Pagamento aprovado por" value={auditors?.paymentApprovedByName ?? '—'} />
              <ReadField label="Aprovação do pagamento" value={formatDate(installment.paymentApprovedAt)} />
              <ReadField label="Pago por" value={auditors?.paidByName ?? '—'} />
              <ReadField label="Pagamento" value={formatDate(installment.paidAt)} />
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
