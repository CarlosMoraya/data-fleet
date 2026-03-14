import React from 'react';
import { X, ExternalLink, Truck } from 'lucide-react';
import { Vehicle } from '../types';

interface Props {
  vehicle: Vehicle;
  onClose: () => void;
}

function DetailField({ label, value }: { label: string; value?: string | number | null }) {
  return (
    <div>
      <p className="text-xs text-zinc-400">{label}</p>
      <p className="text-sm text-zinc-800 font-medium">{value ?? '—'}</p>
    </div>
  );
}

function BoolField({ label, value }: { label: string; value?: boolean }) {
  return (
    <div>
      <p className="text-xs text-zinc-400">{label}</p>
      <p className="text-sm text-zinc-800 font-medium">{value ? 'Sim' : 'Não'}</p>
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
          Visualizar <ExternalLink className="w-3 h-3" />
        </a>
      ) : (
        <span className="text-sm text-zinc-400">Não enviado</span>
      )}
    </div>
  );
}

function SectionTitle({ title }: { title: string }) {
  return (
    <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-400 border-b border-zinc-100 pb-2">
      {title}
    </h3>
  );
}

function formatDate(dateStr?: string | null): string | undefined {
  if (!dateStr) return undefined;
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('pt-BR');
}

export default function VehicleDetailModal({ vehicle, onClose }: Props) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 backdrop-blur-sm p-4 overflow-y-auto"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-3xl flex flex-col my-8">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-100">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-orange-50 flex items-center justify-center">
              <Truck className="h-5 w-5 text-orange-500" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-zinc-900">{vehicle.licensePlate}</h2>
              <p className="text-sm text-zinc-500">{vehicle.brand} {vehicle.model} ({vehicle.year})</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto px-6 py-6 space-y-6">

          {/* Identificação */}
          <div className="space-y-3">
            <SectionTitle title="Identificação" />
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-4">
              <DetailField label="Placa" value={vehicle.licensePlate} />
              <DetailField label="Marca" value={vehicle.brand} />
              <DetailField label="Modelo" value={vehicle.model} />
              <DetailField label="Ano" value={vehicle.year} />
              <DetailField label="Chassi" value={vehicle.chassi} />
              <DetailField label="RENAVAM" value={vehicle.renavam} />
              <DetailField label="DETRAN UF" value={vehicle.detranUF} />
              <DetailField label="Tag" value={vehicle.tag} />
              <DetailField label="Tipo" value={vehicle.type} />
              <DetailField label="Categoria" value={vehicle.category} />
            </div>
          </div>

          {/* Propriedade */}
          <div className="space-y-3">
            <SectionTitle title="Propriedade e Especificações" />
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-4">
              <DetailField label="Fonte de Energia" value={vehicle.energySource} />
              <DetailField label="Proprietário" value={vehicle.owner} />
              <DetailField label="Aquisição" value={vehicle.acquisition === 'Owned' ? 'Próprio' : 'Locado'} />
              <DetailField label="Cor" value={vehicle.color} />
              <DetailField label="Preço FIPE" value={vehicle.fipePrice ? `R$ ${vehicle.fipePrice.toLocaleString('pt-BR')}` : undefined} />
              <DetailField label="Rastreador" value={vehicle.tracker} />
              <DetailField label="ANTT" value={vehicle.antt} />
              <DetailField label="Data de Aquisição" value={formatDate(vehicle.acquisitionDate)} />
              <DetailField label="PBT (t)" value={vehicle.pbt} />
              <DetailField label="CMT (t)" value={vehicle.cmt} />
              <DetailField label="Eixos" value={vehicle.eixos} />
              <DetailField label="Autonomia" value={vehicle.autonomy} />
            </div>
          </div>

          {/* Itens opcionais */}
          <div className="space-y-3">
            <SectionTitle title="Equipamentos e Acessórios" />
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-6 gap-y-4">
              <BoolField label="Chave Reserva" value={vehicle.spareKey} />
              <BoolField label="Manual do Veículo" value={vehicle.vehicleManual} />
              <BoolField label="Equipamento de Resfriamento" value={vehicle.coolingEquipment} />
              <BoolField label="Semirreboque" value={vehicle.semiReboque} />
            </div>
          </div>

          {/* Campos condicionais */}
          {(vehicle.energySource === 'Combustão' || vehicle.coolingEquipment || vehicle.semiReboque) && (
            <div className="space-y-3">
              <SectionTitle title="Informações Adicionais" />
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-4">
                {vehicle.energySource === 'Combustão' && (
                  <>
                    <DetailField label="Tipo de Combustível" value={vehicle.fuelType} />
                    <DetailField label="Capacidade do Tanque (L)" value={vehicle.tankCapacity} />
                    <DetailField label="Consumo Médio (km/L)" value={vehicle.avgConsumption} />
                  </>
                )}
                {vehicle.coolingEquipment && (
                  <DetailField label="Marca do Resfriamento" value={vehicle.coolingBrand} />
                )}
                {vehicle.semiReboque && (
                  <DetailField label="Placa do Semirreboque" value={vehicle.placaSemiReboque} />
                )}
              </div>
            </div>
          )}

          {/* Motorista */}
          <div className="space-y-3">
            <SectionTitle title="Motorista Associado" />
            <div className="grid grid-cols-2 gap-x-6 gap-y-4">
              <DetailField
                label="Motorista"
                value={vehicle.driverName || 'Sem motorista'}
              />
            </div>
          </div>

          {/* Documentos */}
          <div className="space-y-3">
            <SectionTitle title="Documentos" />
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-4">
              <FileField label="CRLV" url={vehicle.crlvUpload} />
              <FileField label="Vistoria Sanitária" url={vehicle.sanitaryInspectionUpload} />
              <FileField label="GR (Gerenciamento de Risco)" url={vehicle.grUpload} />
              <DetailField label="Validade do GR" value={formatDate(vehicle.grExpirationDate)} />
              <FileField label="Apólice de Seguro" url={vehicle.insurancePolicyUpload} />
              <FileField label="Contrato de Manutenção" url={vehicle.maintenanceContractUpload} />
            </div>
          </div>

          {/* Garantia e Revisão */}
          <div className="space-y-3">
            <SectionTitle title="Garantia e Revisão" />
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-4">
              <BoolField label="Possui Garantia" value={vehicle.warranty} />
              <DetailField label="Vencimento da Garantia" value={formatDate(vehicle.warrantyEndDate)} />
              <DetailField label="1ª Revisão — Km Máximo" value={vehicle.firstRevisionMaxKm} />
              <DetailField label="1ª Revisão — Prazo" value={formatDate(vehicle.firstRevisionDeadline)} />
              {vehicle.coolingEquipment && (
                <DetailField label="1ª Revisão Resfriamento" value={formatDate(vehicle.coolingFirstRevisionDeadline)} />
              )}
            </div>
          </div>

          {/* Seguro e Manutenção */}
          <div className="space-y-3">
            <SectionTitle title="Seguro e Manutenção" />
            <div className="grid grid-cols-2 gap-x-6 gap-y-4">
              <BoolField label="Possui Seguro" value={vehicle.hasInsurance} />
              <BoolField label="Possui Contrato de Manutenção" value={vehicle.hasMaintenanceContract} />
            </div>
          </div>

        </div>

        {/* Footer */}
        <div className="flex justify-end px-6 py-4 border-t border-zinc-100">
          <button
            onClick={onClose}
            className="rounded-xl border border-zinc-200 px-5 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 transition-colors"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}
