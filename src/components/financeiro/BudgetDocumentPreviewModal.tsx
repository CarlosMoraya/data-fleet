import { X } from 'lucide-react';
import React from 'react';

interface BudgetDocumentPreviewModalProps {
  open: boolean;
  url: string;
  osNumber: string;
  onClose: () => void;
}

export default function BudgetDocumentPreviewModal({
  open,
  url,
  osNumber,
  onClose,
}: BudgetDocumentPreviewModalProps): React.ReactElement | null {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/60 p-4">
      <div className="relative my-4 w-full max-w-4xl rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b px-6 py-4">
          <div>
            <h2 className="text-base font-semibold text-zinc-900">Orçamento — OS {osNumber}</h2>
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-0.5 inline-block text-xs font-medium text-orange-600 hover:text-orange-700"
            >
              Abrir em nova aba
            </a>
          </div>
          <button onClick={onClose} className="rounded-lg p-2 hover:bg-zinc-100">
            <X className="h-5 w-5 text-zinc-500" />
          </button>
        </div>
        <div className="p-4">
          <iframe src={url} className="h-[70vh] w-full rounded-lg border border-zinc-200" title={`Orçamento ${osNumber}`} />
        </div>
      </div>
    </div>
  );
}
