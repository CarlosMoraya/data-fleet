import { useQuery } from '@tanstack/react-query';
import { X, ExternalLink, Truck } from 'lucide-react';
import React, { useState } from 'react';

import { couplingFromRow, type VehicleCouplingRow } from '../lib/couplingMappers';
import { supabase } from '../lib/supabase';
import { Vehicle } from '../types';

import VehicleKmHistoryTab from './VehicleKmHistoryTab';

interface Props {
  vehicle: Vehicle;
  onClose: () => void;
}

function DetailField({ label, value }: { label: string; value?: string | number | null }) {
  return (
    <div>
      <p className="text-xs text-zinc-400">{label}</p>
      <p className="text-sm font-medium text-zinc-800">{value ?? '—'}</p>
    </div>
  );
}

function BoolField({ label, value }: { label: string; value?: boolean }) {
  return (
    <div>
      <p className="text-xs text-zinc-400">{label}</p>
      <p className="text-sm font-medium text-zinc-800">{value ? 'Sim' : 'Não'}</p>
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

function formatDate(dateStr?: string | null): string | undefined {
  if (!dateStr) return undefined;
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('pt-BR');
}

export default function VehicleDetailModal({ vehicle, onClose }: Props) {
  const [activeTab, setActiveTab] = useState<'general' | 'kmHistory' | 'couplingHistory'>('general');
  const isImplement = vehicle.category === 'Semi-reboque/Implemento';
  const showCouplingHistory = isImplement || vehicle.type === 'Cavalo';

  const { data: couplingHistory = [] } = useQuery({
    queryKey: ['vehicleDetailCouplings', vehicle.id, vehicle.type, vehicle.category],
    enabled: showCouplingHistory,
    queryFn: async () => {
      let query = supabase
        .from('vehicle_couplings')
        .select(`
          *,
          trailers:vehicles!vehicle_couplings_trailer_id_fkey(license_plate),
          tractors:vehicles!vehicle_couplings_tractor_id_fkey(license_plate)
        `)
        .order('coupled_at', { ascending: false });

      query = isImplement ? query.eq('trailer_id', vehicle.id) : query.eq('tractor_id', vehicle.id);

      const { data, error } = await query;
      if (error) throw error;

      return (data as Array<VehicleCouplingRow & {
        trailers?: { license_plate: string } | null;
        tractors?: { license_plate: string } | null;
      }> ?? []).map((row) => ({
        ...couplingFromRow(row),
        trailerPlate: row.trailers?.license_plate ?? '—',
        resolvedTractorPlate: row.tractor_plate ?? row.tractors?.license_plate ?? '—',
      }));
    },
  });

  const openCoupling = couplingHistory.find((coupling) => !coupling.uncoupledAt);

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
              <Truck className="h-5 w-5 text-orange-500" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-semibold text-zinc-900">{vehicle.licensePlate}</h2>
                {isImplement ? (
                  <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${openCoupling ? 'bg-green-100 text-green-700' : 'bg-zinc-100 text-zinc-700'}`}>
                    {openCoupling ? 'Engatado' : 'Desvinculado'}
                  </span>
                ) : null}
              </div>
              <p className="text-sm text-zinc-500">{vehicle.brand} {vehicle.model} ({vehicle.year})</p>
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
          <div className="flex gap-2 border-b border-zinc-100" role="tablist" aria-label="Detalhes do veículo">
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'general'}
              onClick={() => setActiveTab('general')}
              className={`rounded-t-xl px-4 py-2 text-sm font-medium transition-colors ${
                activeTab === 'general'
                  ? 'border-b-2 border-orange-500 text-orange-600'
                  : 'text-zinc-500 hover:text-zinc-800'
              }`}
            >
              Dados gerais
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'kmHistory'}
              onClick={() => setActiveTab('kmHistory')}
              className={`rounded-t-xl px-4 py-2 text-sm font-medium transition-colors ${
                activeTab === 'kmHistory'
                  ? 'border-b-2 border-orange-500 text-orange-600'
                  : 'text-zinc-500 hover:text-zinc-800'
              }`}
            >
              Histórico de KM
            </button>
            {showCouplingHistory ? (
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === 'couplingHistory'}
                onClick={() => setActiveTab('couplingHistory')}
                className={`rounded-t-xl px-4 py-2 text-sm font-medium transition-colors ${
                  activeTab === 'couplingHistory'
                    ? 'border-b-2 border-orange-500 text-orange-600'
                    : 'text-zinc-500 hover:text-zinc-800'
                }`}
              >
                Histórico de Engates
              </button>
            ) : null}
          </div>

          {activeTab === 'general' ? (
            <>
              {/* Identificação */}
              <div className="space-y-3">
                <SectionTitle title="Identificação" />
                <div className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3">
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
            <div className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3">
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
            <div className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-4">
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
              <div className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3">
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
            <div className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3">
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
            <div className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3">
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
            </>
          ) : activeTab === 'kmHistory' ? (
            <VehicleKmHistoryTab vehicleId={vehicle.id} />
          ) : (
            <div className="space-y-3">
              {couplingHistory.length === 0 ? (
                <p className="text-sm text-zinc-500">Nenhum engate registrado para este ativo.</p>
              ) : couplingHistory.map((coupling) => (
                <article key={coupling.id} className="rounded-2xl border border-zinc-200 p-4">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="text-sm font-semibold text-zinc-900">
                        {isImplement ? coupling.resolvedTractorPlate : coupling.trailerPlate}
                      </p>
                      <p className="text-xs text-zinc-500">
                        {coupling.tractorDriverName ?? 'Condutor não informado'}
                      </p>
                    </div>
                    <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${coupling.uncoupledAt ? 'bg-zinc-100 text-zinc-700' : 'bg-green-100 text-green-700'}`}>
                      {coupling.uncoupledAt ? 'Fechado' : 'Aberto'}
                    </span>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-3 text-xs text-zinc-500">
                    <p>Engate: {new Date(coupling.coupledAt).toLocaleString('pt-BR')}</p>
                    <p>Desengate: {coupling.uncoupledAt ? new Date(coupling.uncoupledAt).toLocaleString('pt-BR') : '—'}</p>
                    <p>KM engate: {coupling.odometerCoupled?.toLocaleString('pt-BR') ?? '—'}</p>
                    <p>KM rodado: {coupling.distanceKm?.toLocaleString('pt-BR') ?? '—'}</p>
                  </div>
                </article>
              ))}
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
