import { X, Wrench, MapPin } from 'lucide-react';
import React from 'react';

import { formatCNPJ } from '../lib/workshopMappers';
import { Workshop } from '../types';

interface Props {
  workshop: Workshop;
  onClose: () => void;
}

function DetailField({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <p className="text-xs text-zinc-400">{label}</p>
      <p className="text-sm font-medium text-zinc-800">{value || '—'}</p>
    </div>
  );
}

function SectionTitle({ title }: { title: string }) {
  return (
    <h3 className="border-b border-zinc-100 pb-2 text-xs font-semibold tracking-wider text-zinc-400 uppercase">
      {title}
    </h3>
  );
}

function formatPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 11) return digits.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3');
  if (digits.length === 10) return digits.replace(/(\d{2})(\d{4})(\d{4})/, '($1) $2-$3');
  return phone;
}

export default function WorkshopDetailModal({ workshop, onClose }: Props) {
  const fullAddress = [
    workshop.addressStreet && workshop.addressNumber
      ? `${workshop.addressStreet}, ${workshop.addressNumber}`
      : workshop.addressStreet,
    workshop.addressComplement,
    workshop.addressNeighborhood,
    workshop.addressCity && workshop.addressState
      ? `${workshop.addressCity} — ${workshop.addressState}`
      : workshop.addressCity || workshop.addressState,
    workshop.addressZip,
  ].filter(Boolean).join(' • ');

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-4 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="my-8 flex w-full max-w-3xl flex-col rounded-2xl bg-white shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-100 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-orange-50">
              <Wrench className="h-5 w-5 text-orange-500" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-zinc-900">{workshop.name}</h2>
              <p className="text-sm text-zinc-500">{formatCNPJ(workshop.cnpj)}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-700"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="space-y-6 overflow-y-auto px-6 py-6">

          {/* Identificação */}
          <div className="space-y-3">
            <SectionTitle title="Identificação" />
            <div className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3">
              <DetailField label="Nome" value={workshop.name} />
              <DetailField label="CNPJ" value={formatCNPJ(workshop.cnpj)} />
              <DetailField label="Pessoa de Contato" value={workshop.contactPerson} />
              <div>
                <p className="text-xs text-zinc-400">Status</p>
                {workshop.active ? (
                  <span className="inline-flex items-center rounded-full bg-green-50 px-2.5 py-0.5 text-xs font-medium text-green-700">
                    Ativa
                  </span>
                ) : (
                  <span className="inline-flex items-center rounded-full bg-zinc-100 px-2.5 py-0.5 text-xs font-medium text-zinc-500">
                    Inativa
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Contato */}
          <div className="space-y-3">
            <SectionTitle title="Contato" />
            <div className="grid grid-cols-2 gap-x-6 gap-y-4">
              <DetailField label="Telefone" value={workshop.phone ? formatPhone(workshop.phone) : null} />
              <DetailField label="E-mail" value={workshop.email} />
            </div>
          </div>

          {/* Endereço */}
          <div className="space-y-3">
            <SectionTitle title="Endereço" />
            {fullAddress ? (
              <div className="flex items-start gap-2 text-sm text-zinc-700">
                <MapPin className="mt-0.5 h-4 w-4 flex-shrink-0 text-zinc-400" />
                <span>{fullAddress}</span>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3">
                <DetailField label="Logradouro" value={workshop.addressStreet} />
                <DetailField label="Número" value={workshop.addressNumber} />
                <DetailField label="Complemento" value={workshop.addressComplement} />
                <DetailField label="Bairro" value={workshop.addressNeighborhood} />
                <DetailField label="Cidade" value={workshop.addressCity} />
                <DetailField label="Estado" value={workshop.addressState} />
                <DetailField label="CEP" value={workshop.addressZip} />
              </div>
            )}
          </div>

          {/* Especialidades */}
          <div className="space-y-3">
            <SectionTitle title="Especialidades" />
            {workshop.specialties && workshop.specialties.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {workshop.specialties.map((s) => (
                  <span
                    key={s}
                    className="inline-flex items-center rounded-full bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700"
                  >
                    {s}
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-sm text-zinc-400">Nenhuma especialidade cadastrada</p>
            )}
          </div>

          {/* Observações */}
          {workshop.notes && (
            <div className="space-y-3">
              <SectionTitle title="Observações" />
              <p className="text-sm leading-relaxed whitespace-pre-wrap text-zinc-700">{workshop.notes}</p>
            </div>
          )}

        </div>

        {/* Footer */}
        <div className="flex justify-end border-t border-zinc-100 px-6 py-4">
          <button
            onClick={onClose}
            className="rounded-xl border border-zinc-200 px-5 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}
