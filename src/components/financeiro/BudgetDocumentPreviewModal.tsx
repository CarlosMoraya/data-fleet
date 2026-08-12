import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, ExternalLink, FileText, X } from 'lucide-react';
import React, { useEffect, useId, useState } from 'react';

import { useStorageFileUrl } from '../../hooks/useStorageFileUrl';
import { cn } from '../../lib/utils';
import { getMaintenanceBudgetApprovalDetails } from '../../services/maintenanceService';
import BudgetItemsTable from '../BudgetItemsTable';

interface BudgetDocumentPreviewModalProps {
  open: boolean;
  maintenanceOrderId: string;
  osNumber: string;
  pendingInstallmentCount: number;
  pendingInstallmentTotal: number;
  onClose: () => void;
}

type ModalView = 'items' | 'pdf';

function formatCurrency(value: number): string {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export default function BudgetDocumentPreviewModal({
  open,
  maintenanceOrderId,
  osNumber,
  pendingInstallmentCount,
  pendingInstallmentTotal,
  onClose,
}: BudgetDocumentPreviewModalProps): React.ReactElement | null {
  const titleId = useId();
  const [view, setView] = useState<ModalView>('items');

  useEffect(() => {
    if (open) setView('items');
  }, [open, maintenanceOrderId]);

  useEffect(() => {
    if (!open) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open, onClose]);

  const { data, isLoading, error } = useQuery({
    queryKey: ['maintenanceBudgetApprovalDetails', maintenanceOrderId],
    queryFn: () => getMaintenanceBudgetApprovalDetails(maintenanceOrderId),
    enabled: open,
  });

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/60 p-2 sm:p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="my-4 flex max-h-[calc(100vh-2rem)] w-full max-w-4xl flex-col rounded-2xl bg-white shadow-2xl"
      >
        <div className="flex items-center justify-between border-b px-4 py-4 sm:px-6">
          <div>
            <h2 id={titleId} className="text-base font-semibold text-zinc-900">
              Orçamento — OS {osNumber}
            </h2>
            <p className="mt-0.5 text-xs text-zinc-500">
              {pendingInstallmentCount} parcela(s) pendente(s) — {formatCurrency(pendingInstallmentTotal)}
            </p>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-2 hover:bg-zinc-100">
            <X className="h-5 w-5 text-zinc-500" />
          </button>
        </div>

        <div className="flex gap-1 border-b px-4 pt-2 sm:px-6" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={view === 'items'}
            onClick={() => setView('items')}
            className={cn(
              'rounded-t-lg border-b-2 px-3 py-2 text-sm font-medium transition-colors',
              view === 'items' ? 'border-orange-500 text-zinc-900' : 'border-transparent text-zinc-500 hover:text-zinc-700',
            )}
          >
            Itens
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={view === 'pdf'}
            onClick={() => setView('pdf')}
            className={cn(
              'rounded-t-lg border-b-2 px-3 py-2 text-sm font-medium transition-colors',
              view === 'pdf' ? 'border-orange-500 text-zinc-900' : 'border-transparent text-zinc-500 hover:text-zinc-700',
            )}
          >
            PDF
          </button>
        </div>

        <div className="flex-1 overflow-auto p-4 sm:p-6">
          {isLoading ? (
            <div className="flex items-center justify-center py-16">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-zinc-200 border-t-orange-500" />
            </div>
          ) : view === 'items' ? (
            error ? (
              <div className="flex flex-col items-center gap-2 py-12 text-center text-zinc-400">
                <AlertTriangle className="h-8 w-8 text-red-400" />
                <p className="text-sm font-medium">Não foi possível carregar os itens do orçamento.</p>
              </div>
            ) : !data || data.items.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-12 text-center text-zinc-400">
                <FileText className="h-8 w-8" />
                <p className="text-sm font-medium">Nenhum item cadastrado no orçamento.</p>
              </div>
            ) : (
              <BudgetItemsTable items={data.items} readOnly orderDiscount={data.budgetDiscount} />
            )
          ) : (
            <PdfView url={data?.budgetPdfUrl} error={!!error} osNumber={osNumber} />
          )}
        </div>
      </div>
    </div>
  );
}

interface PdfViewProps {
  url?: string;
  error: boolean;
  osNumber: string;
}

/**
 * `url` é o ponteiro persistido do orçamento — caminho no bucket privado
 * 'vehicle-documents' ou URL pública legada. Precisa virar URL assinada antes
 * de alimentar o `iframe`/`href` do visualizador.
 */
function PdfView({ url, error, osNumber }: PdfViewProps): React.ReactElement {
  const { url: signedUrl, isLoading, error: signError } = useStorageFileUrl(url, 'vehicle-documents');

  if (error || (url && signError)) {
    return (
      <div className="flex flex-col items-center gap-2 py-12 text-center text-zinc-400">
        <AlertTriangle className="h-8 w-8 text-red-400" />
        <p className="text-sm font-medium">Não foi possível carregar o PDF do orçamento.</p>
      </div>
    );
  }
  if (!url) {
    return (
      <div className="flex flex-col items-center gap-2 py-12 text-center text-zinc-400">
        <FileText className="h-8 w-8" />
        <p className="text-sm font-medium">Nenhum PDF de orçamento anexado.</p>
      </div>
    );
  }
  if (isLoading || !signedUrl) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-zinc-200 border-t-orange-500" />
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-2">
      <a
        href={signedUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1 self-end text-xs font-medium text-orange-600 hover:text-orange-700"
      >
        <ExternalLink className="h-3.5 w-3.5" />
        Abrir em nova aba
      </a>
      <iframe src={signedUrl} className="h-[65vh] w-full rounded-lg border border-zinc-200" title={`Orçamento ${osNumber}`} />
    </div>
  );
}
