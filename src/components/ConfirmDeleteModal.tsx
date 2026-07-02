import React, { useEffect, useState } from 'react';

interface ConfirmDeleteModalProps {
  open: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  expectedText: string;
  blockedReason?: string | null;
  isLoading?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}

export default function ConfirmDeleteModal({
  open,
  title,
  description,
  confirmLabel,
  expectedText,
  blockedReason = null,
  isLoading = false,
  onConfirm,
  onClose,
}: ConfirmDeleteModalProps): React.ReactElement | null {
  const [value, setValue] = useState('');

  useEffect(() => {
    if (open) {
      setValue('');
    }
  }, [open, expectedText]);

  if (!open) return null;

  const isConfirmed = value.trim() === expectedText;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-lg rounded-2xl bg-white shadow-xl">
        <div className="border-b border-zinc-100 px-6 py-4">
          <h2 className="text-lg font-semibold text-zinc-900">{title}</h2>
        </div>
        <div className="space-y-4 px-6 py-5">
          <p className="text-sm leading-6 text-zinc-600">{description}</p>
          {blockedReason ? (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              {blockedReason}
            </div>
          ) : (
            <div className="space-y-2">
              <label htmlFor="confirm-delete-input" className="block text-sm font-medium text-zinc-700">
                Digite <span className="font-semibold text-zinc-900">{expectedText}</span> para confirmar
              </label>
              <input
                id="confirm-delete-input"
                type="text"
                value={value}
                onChange={(event) => setValue(event.target.value)}
                className="block w-full rounded-xl border border-zinc-300 px-3 py-2 text-sm shadow-sm focus:border-red-500 focus:ring-1 focus:ring-red-500 focus:outline-none"
              />
            </div>
          )}
        </div>
        <div className="flex justify-end gap-3 border-t border-zinc-100 px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50"
          >
            Cancelar
          </button>
          {!blockedReason && (
            <button
              type="button"
              disabled={!isConfirmed || isLoading}
              onClick={onConfirm}
              className="rounded-xl bg-red-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isLoading ? 'Excluindo...' : confirmLabel}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
