import { X, ExternalLink, UserCircle } from 'lucide-react';
import React from 'react';

import { Driver } from '../types';

interface Props {
  driver: Driver;
  vehiclePlate?: string;
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

function FileField({ label, url }: { label: string; url?: string | null }) {
  return (
    <div>
      <p className="text-xs text-zinc-400">{label}</p>
      {url ? (
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-sm text-orange-600 underline underline-offset-2 hover:text-orange-700"
        >
          Visualizar <ExternalLink className="h-3 w-3" />
        </a>
      ) : (
        <span className="text-sm text-zinc-400">Não enviado</span>
      )}
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

function formatCPF(cpf: string): string {
  const digits = cpf.replace(/\D/g, '');
  if (digits.length !== 11) return cpf;
  return digits.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
}

function formatDate(dateStr?: string | null): string | undefined {
  if (!dateStr) return undefined;
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('pt-BR');
}

function formatPhone(phone?: string | null): string | undefined {
  if (!phone) return undefined;
  const d = phone.replace(/\D/g, '');
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return phone;
}

export default function DriverDetailModal({ driver, vehiclePlate, onClose }: Props) {
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
              <UserCircle className="h-5 w-5 text-orange-500" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-zinc-900">{driver.name}</h2>
              <p className="text-sm text-zinc-500">{formatCPF(driver.cpf)}</p>
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

          {/* Dados Pessoais */}
          <div className="space-y-3">
            <SectionTitle title="Dados Pessoais" />
            <div className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3">
              <DetailField label="Nome" value={driver.name} />
              <DetailField label="CPF" value={formatCPF(driver.cpf)} />
              <DetailField label="Telefone de Contato" value={formatPhone(driver.phone)} />
            </div>
          </div>

          {/* CNH */}
          <div className="space-y-3">
            <SectionTitle title="CNH" />
            <div className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3">
              <DetailField label="Número de Registro" value={driver.registrationNumber} />
              <DetailField label="Categoria" value={driver.category} />
              <DetailField label="RENACH" value={driver.renach} />
              <DetailField label="Data de Emissão" value={formatDate(driver.issueDate)} />
              <DetailField label="Validade" value={formatDate(driver.expirationDate)} />
              <FileField label="Arquivo CNH" url={driver.cnhUpload} />
            </div>
          </div>

          {/* GR */}
          <div className="space-y-3">
            <SectionTitle title="GR — Gerenciamento de Risco" />
            <div className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3">
              <DetailField label="Validade do GR" value={formatDate(driver.grExpirationDate)} />
              <FileField label="Arquivo GR" url={driver.grUpload} />
            </div>
          </div>

          {/* Certificados */}
          <div className="space-y-3">
            <SectionTitle title="Certificados" />
            <div className="space-y-4">
              {/* Certificado 1 */}
              <div className="grid grid-cols-2 gap-x-6 gap-y-4">
                <DetailField label="Curso 1" value={driver.courseName1} />
                <FileField label="Certificado 1" url={driver.certificate1Upload} />
              </div>
              {/* Certificado 2 */}
              <div className="grid grid-cols-2 gap-x-6 gap-y-4">
                <DetailField label="Curso 2" value={driver.courseName2} />
                <FileField label="Certificado 2" url={driver.certificate2Upload} />
              </div>
              {/* Certificado 3 */}
              <div className="grid grid-cols-2 gap-x-6 gap-y-4">
                <DetailField label="Curso 3" value={driver.courseName3} />
                <FileField label="Certificado 3" url={driver.certificate3Upload} />
              </div>
            </div>
          </div>

          {/* Veículo Associado */}
          <div className="space-y-3">
            <SectionTitle title="Veículo Associado" />
            <div className="grid grid-cols-2 gap-x-6 gap-y-4">
              <DetailField
                label="Placa do Veículo"
                value={vehiclePlate || 'Sem veículo associado'}
              />
            </div>
          </div>

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
