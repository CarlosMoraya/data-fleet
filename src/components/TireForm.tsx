import { Loader2, X, AlertTriangle } from 'lucide-react';
import React from 'react';

import { generatePositions, generatePositionsFromConfig, validatePositionAssignment } from '../lib/tirePositions';
import { cn } from '../lib/utils';
import { safeRandomUUID } from '../lib/uuid';
import { Tire, TireVisualClassification, VehicleTireConfig, AxleConfigEntry } from '../types';

interface TireFormProps {
  vehicleId: string;
  vehiclePlate: string;
  vehicleType: string;
  vehicleAxles?: number;
  vehicleAxleConfig?: AxleConfigEntry[];
  vehicleStepsCount?: number;
  existingTires: Tire[];
  tireConfig?: VehicleTireConfig;
  editingTire?: Tire | null;
  onSave: (tires: Partial<Tire> | Partial<Tire>[], previousPosition?: string, odometerKm?: number) => Promise<void>;
  onClose: () => void;
  isSaving?: boolean;
  saveError?: string;
}

const VISUAL_CLASSIFICATIONS: TireVisualClassification[] = ['Novo', 'Meia vida', 'Troca'];

export default function TireForm({
  vehicleId,
  vehiclePlate,
  vehicleType,
  vehicleAxles,
  vehicleAxleConfig,
  vehicleStepsCount,
  existingTires,
  tireConfig,
  editingTire,
  onSave,
  onClose,
  isSaving,
  saveError,
}: TireFormProps) {
  const isEditing = !!editingTire;

  const positions = React.useMemo(() => {
    if (vehicleAxleConfig && vehicleAxleConfig.length > 0) {
      return generatePositionsFromConfig(vehicleAxleConfig, vehicleStepsCount ?? 0, vehicleType);
    }
    const axleCount = vehicleAxles ?? tireConfig?.defaultAxles ?? 2;
    const dualAxles = tireConfig?.dualAxles ?? [];
    const spareCount = tireConfig?.defaultSpareCount ?? 1;
    return generatePositions(axleCount, dualAxles, spareCount, vehicleType);
  }, [vehicleAxleConfig, vehicleStepsCount, vehicleAxles, tireConfig, vehicleType]);

  // ── Estado ────────────────────────────────────────────────────────────────
  const [registerMode, setRegisterMode] = React.useState<'single' | 'all'>('single');
  const [specification, setSpecification] = React.useState(editingTire?.specification ?? '');
  const [dot, setDot] = React.useState(editingTire?.dot ?? '');
  const [fireMarking, setFireMarking] = React.useState(editingTire?.fireMarking ?? '');
  const [manufacturer, setManufacturer] = React.useState(editingTire?.manufacturer ?? '');
  const [brand, setBrand] = React.useState(editingTire?.brand ?? '');
  const [rotationIntervalKm, setRotationIntervalKm] = React.useState(
    editingTire?.rotationIntervalKm?.toString() ?? '',
  );
  const [usefulLifeKm, setUsefulLifeKm] = React.useState(
    editingTire?.usefulLifeKm?.toString() ?? '',
  );
  const [retreadIntervalKm, setRetreadIntervalKm] = React.useState(
    editingTire?.retreadIntervalKm?.toString() ?? '',
  );
  const [visualClassification, setVisualClassification] =
    React.useState<TireVisualClassification>(editingTire?.visualClassification ?? 'Novo');
  const [currentPosition, setCurrentPosition] = React.useState(editingTire?.currentPosition ?? '');
  const [positionError, setPositionError] = React.useState<string | null>(null);
  const [odometerKm, setOdometerKm] = React.useState('');

  // Posições livres para o modo "todos os pneus"
  const freePositions = React.useMemo(() => {
    return positions.filter(pos => {
      const occupant = existingTires.find(t => t.active && t.currentPosition === pos.code);
      return !occupant;
    });
  }, [positions, existingTires]);

  const occupiedPositions = React.useMemo(() => {
    return positions.filter(pos => {
      const occupant = existingTires.find(t => t.active && t.currentPosition === pos.code);
      return !!occupant;
    });
  }, [positions, existingTires]);

  function handlePositionChange(pos: string) {
    setCurrentPosition(pos);
    const err = validatePositionAssignment(pos, existingTires, editingTire?.id);
    setPositionError(err);
  }

  // Dados compartilhados para os pneus
  function buildSharedData() {
    return {
      vehicleId,
      specification: specification.trim(),
      dot: dot.trim() || undefined,
      fireMarking: fireMarking.trim() || undefined,
      manufacturer: manufacturer.trim() || undefined,
      brand: brand.trim() || undefined,
      rotationIntervalKm: rotationIntervalKm ? parseInt(rotationIntervalKm) : undefined,
      usefulLifeKm: usefulLifeKm ? parseInt(usefulLifeKm) : undefined,
      retreadIntervalKm: retreadIntervalKm ? parseInt(retreadIntervalKm) : undefined,
      visualClassification,
      active: true,
    };
  }

  // ── Submit ────────────────────────────────────────────────────────────────
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!specification.trim()) return;

    if (isEditing) {
      // Edição: sempre pneu único, mantém tireCode original
      if (!currentPosition || positionError) return;
      const selectedPos = positions.find(p => p.code === currentPosition);
      await onSave(
        {
          ...buildSharedData(),
          id: editingTire.id,
          tireCode: editingTire.tireCode,
          currentPosition,
          lastPosition: editingTire.currentPosition !== currentPosition
            ? editingTire.currentPosition
            : editingTire.lastPosition,
          positionType: selectedPos?.type ?? 'single',
        },
        editingTire.currentPosition,
        odometerKm ? parseInt(odometerKm) : undefined,
      );
      return;
    }

    if (registerMode === 'single') {
      if (!currentPosition || positionError) return;
      const selectedPos = positions.find(p => p.code === currentPosition);
      await onSave(
        {
          ...buildSharedData(),
          tireCode: safeRandomUUID(),
          currentPosition,
          positionType: selectedPos?.type ?? 'single',
        },
        undefined,
        odometerKm ? parseInt(odometerKm) : undefined,
      );
    } else {
      // Modo "todos os pneus": gera um registro por posição livre
      if (freePositions.length === 0) return;
      const tiresArray: Partial<Tire>[] = freePositions.map(pos => ({
        ...buildSharedData(),
        tireCode: safeRandomUUID(),
        currentPosition: pos.code,
        positionType: pos.type,
      }));
      await onSave(tiresArray, undefined, odometerKm ? parseInt(odometerKm) : undefined);
    }
  }

  const submitDisabled = React.useMemo(() => {
    if (isSaving || !specification.trim()) return true;
    if (isEditing || registerMode === 'single') {
      return !currentPosition || !!positionError;
    }
    return freePositions.length === 0;
  }, [isSaving, specification, isEditing, registerMode, currentPosition, positionError, freePositions.length]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="mx-4 flex max-h-[90vh] w-full max-w-lg flex-col rounded-2xl bg-white shadow-xl">
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between border-b border-zinc-100 px-6 py-4">
          <div>
            <h2 className="text-lg font-semibold text-zinc-900">
              {isEditing ? 'Editar Pneu' : 'Novo Pneu'}
            </h2>
            <p className="text-sm text-zinc-500">{vehiclePlate} — {vehicleType}</p>
          </div>
          <button onClick={onClose} className="rounded-lg p-2 text-zinc-400 hover:bg-zinc-100">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Conteúdo */}
        <form onSubmit={(e) => { void handleSubmit(e); }} className="flex min-h-0 flex-1 flex-col">
          <div className="flex-1 space-y-5 overflow-y-auto px-6 py-4">

            {/* Fallback: todas as posições ocupadas */}
            {!isEditing && freePositions.length === 0 && (
              <div className="flex flex-col items-center gap-3 py-8 text-center">
                <AlertTriangle className="h-8 w-8 text-amber-400" />
                <p className="text-sm font-medium text-zinc-700">Todas as posições deste veículo estão ocupadas.</p>
                <p className="text-xs text-zinc-400">Desative um ou mais pneus para liberar posições antes de cadastrar novos.</p>
              </div>
            )}

            {(isEditing || freePositions.length > 0) && (<>

            {/* Toggle de modo (somente na criação) */}
            {!isEditing && (
              <div className="flex overflow-hidden rounded-lg border border-zinc-200">
                <button
                  type="button"
                  onClick={() => setRegisterMode('single')}
                  className={cn(
                    'flex-1 py-2 text-sm font-medium transition-colors',
                    registerMode === 'single'
                      ? 'bg-orange-500 text-white'
                      : 'text-zinc-600 hover:bg-zinc-50',
                  )}
                >
                  Pneu único
                </button>
                <button
                  type="button"
                  onClick={() => setRegisterMode('all')}
                  className={cn(
                    'flex-1 py-2 text-sm font-medium transition-colors',
                    registerMode === 'all'
                      ? 'bg-orange-500 text-white'
                      : 'text-zinc-600 hover:bg-zinc-50',
                  )}
                >
                  Todos os pneus ({positions.length})
                </button>
              </div>
            )}

            {/* Código do pneu (somente em edição, read-only) */}
            {isEditing && (
              <section>
                <h3 className="mb-3 text-xs font-semibold tracking-wide text-zinc-400 uppercase">Identificação</h3>
                <div>
                  <label className="mb-1 block text-sm font-medium text-zinc-700">Código do Pneu</label>
                  <div className="w-full rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 font-mono text-sm text-zinc-500">
                    {editingTire.tireCode}
                  </div>
                  <p className="mt-1 text-xs text-zinc-400">O código do pneu não pode ser alterado.</p>
                </div>
              </section>
            )}

            {/* Especificação e demais campos */}
            <section>
              {!isEditing && (
                <h3 className="mb-3 text-xs font-semibold tracking-wide text-zinc-400 uppercase">Identificação</h3>
              )}
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className="mb-1 block text-sm font-medium text-zinc-700">
                    Especificação *
                  </label>
                  <input
                    value={specification}
                    onChange={e => setSpecification(e.target.value)}
                    required
                    placeholder="ex: 295/80R22.5"
                    className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm focus:ring-2 focus:ring-orange-400 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-zinc-700">DOT</label>
                  <input
                    value={dot}
                    onChange={e => setDot(e.target.value)}
                    placeholder="ex: 2524"
                    className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm focus:ring-2 focus:ring-orange-400 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-zinc-700">Marcação de Fogo</label>
                  <input
                    value={fireMarking}
                    onChange={e => setFireMarking(e.target.value)}
                    className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm focus:ring-2 focus:ring-orange-400 focus:outline-none"
                  />
                </div>
              </div>
            </section>

            {/* Fabricante */}
            <section>
              <h3 className="mb-3 text-xs font-semibold tracking-wide text-zinc-400 uppercase">Fabricante</h3>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-sm font-medium text-zinc-700">Fabricante</label>
                  <input
                    value={manufacturer}
                    onChange={e => setManufacturer(e.target.value)}
                    placeholder="ex: Bridgestone"
                    className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm focus:ring-2 focus:ring-orange-400 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-zinc-700">Marca</label>
                  <input
                    value={brand}
                    onChange={e => setBrand(e.target.value)}
                    placeholder="ex: R295"
                    className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm focus:ring-2 focus:ring-orange-400 focus:outline-none"
                  />
                </div>
              </div>
            </section>

            {/* Intervalos */}
            <section>
              <h3 className="mb-3 text-xs font-semibold tracking-wide text-zinc-400 uppercase">Intervalos (Km)</h3>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="mb-1 block text-sm font-medium text-zinc-700">Rodízio</label>
                  <input
                    type="number"
                    min="0"
                    value={rotationIntervalKm}
                    onChange={e => setRotationIntervalKm(e.target.value)}
                    placeholder="ex: 20000"
                    className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm focus:ring-2 focus:ring-orange-400 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-zinc-700">Vida Útil</label>
                  <input
                    type="number"
                    min="0"
                    value={usefulLifeKm}
                    onChange={e => setUsefulLifeKm(e.target.value)}
                    placeholder="ex: 120000"
                    className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm focus:ring-2 focus:ring-orange-400 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-zinc-700">Recapagem</label>
                  <input
                    type="number"
                    min="0"
                    value={retreadIntervalKm}
                    onChange={e => setRetreadIntervalKm(e.target.value)}
                    placeholder="ex: 60000"
                    className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm focus:ring-2 focus:ring-orange-400 focus:outline-none"
                  />
                </div>
              </div>
            </section>

            {/* Hodômetro */}
            <section>
              <h3 className="mb-3 text-xs font-semibold tracking-wide text-zinc-400 uppercase">Hodômetro</h3>
              <div>
                <label className="mb-1 block text-sm font-medium text-zinc-700">
                  Km atual do veículo
                </label>
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={odometerKm}
                  onChange={e => setOdometerKm(e.target.value)}
                  placeholder="ex: 125000"
                  className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm focus:ring-2 focus:ring-orange-400 focus:outline-none"
                />
                <p className="mt-1 text-xs text-zinc-400">Opcional — registrado no histórico de movimentação.</p>
              </div>
            </section>

            {/* Classificação e Posição */}
            <section>
              <h3 className="mb-3 text-xs font-semibold tracking-wide text-zinc-400 uppercase">
                {registerMode === 'all' && !isEditing ? 'Classificação' : 'Classificação & Posição'}
              </h3>
              <div className={cn('grid gap-3', registerMode === 'all' && !isEditing ? 'grid-cols-1' : 'grid-cols-2')}>
                <div>
                  <label className="mb-1 block text-sm font-medium text-zinc-700">Classificação Visual *</label>
                  <select
                    value={visualClassification}
                    onChange={e => setVisualClassification(e.target.value as TireVisualClassification)}
                    required
                    className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm focus:ring-2 focus:ring-orange-400 focus:outline-none"
                  >
                    {VISUAL_CLASSIFICATIONS.map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>

                {/* Seletor de posição (pneu único ou edição) */}
                {(isEditing || registerMode === 'single') && (
                  <div>
                    <label className="mb-1 block text-sm font-medium text-zinc-700">Posição *</label>
                    <select
                      value={currentPosition}
                      onChange={e => handlePositionChange(e.target.value)}
                      required
                      className={cn(
                        'w-full rounded-lg border bg-white px-3 py-2 text-sm focus:ring-2 focus:ring-orange-400 focus:outline-none',
                        positionError ? 'border-red-400' : 'border-zinc-200',
                      )}
                    >
                      <option value="">Selecionar posição</option>
                      {positions.map(pos => {
                        const occupant = existingTires.find(
                          t => t.active && t.currentPosition === pos.code && t.id !== editingTire?.id,
                        );
                        return (
                          <option key={pos.code} value={pos.code} disabled={!!occupant}>
                            {pos.label} ({pos.code}){occupant ? ` — Ocupado por ${occupant.tireCode}` : ''}
                          </option>
                        );
                      })}
                    </select>
                    {positionError && (
                      <p className="mt-1 text-xs text-red-500">{positionError}</p>
                    )}
                  </div>
                )}
              </div>
            </section>

            {/* Lista de posições no modo "todos os pneus" */}
            {!isEditing && registerMode === 'all' && (
              <section>
                <h3 className="mb-3 text-xs font-semibold tracking-wide text-zinc-400 uppercase">
                  Posições a registrar
                </h3>
                {positions.length === 0 ? (
                  <p className="text-sm text-zinc-400">Nenhuma posição disponível para este veículo.</p>
                ) : (
                  <div className="max-h-52 divide-y divide-zinc-100 overflow-hidden overflow-y-auto rounded-lg border border-zinc-200">
                    {positions.map(pos => {
                      const occupant = existingTires.find(t => t.active && t.currentPosition === pos.code);
                      return (
                        <div
                          key={pos.code}
                          className={cn(
                            'flex items-center justify-between px-3 py-2 text-sm',
                            occupant ? 'bg-zinc-50 opacity-60' : 'bg-white',
                          )}
                        >
                          <div className="flex items-center gap-2">
                            <span className="rounded bg-zinc-100 px-1.5 py-0.5 font-mono text-xs text-zinc-700">
                              {pos.code}
                            </span>
                            <span className="text-zinc-600">{pos.label}</span>
                          </div>
                          {occupant ? (
                            <span className="text-xs text-zinc-400">já registrado</span>
                          ) : (
                            <span className="text-xs font-medium text-emerald-600">livre</span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
                {occupiedPositions.length > 0 && (
                  <p className="mt-2 text-xs text-zinc-400">
                    {occupiedPositions.length} posição(ões) já registrada(s) serão ignoradas.
                  </p>
                )}
              </section>
            )}

            {saveError && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {saveError}
              </div>
            )}

            </>)}
          </div>

          {/* Footer */}
          <div className="flex shrink-0 items-center justify-end gap-3 border-t border-zinc-100 px-6 py-4">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-zinc-200 px-4 py-2 text-sm text-zinc-600 hover:bg-zinc-50 hover:text-zinc-800"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={submitDisabled}
              className="flex items-center gap-2 rounded-lg bg-orange-500 px-4 py-2 text-sm font-medium text-white hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSaving && <Loader2 className="h-4 w-4 animate-spin" />}
              {isEditing
                ? 'Salvar Alterações'
                : registerMode === 'all'
                  ? `Cadastrar ${freePositions.length} Pneu${freePositions.length !== 1 ? 's' : ''}`
                  : 'Cadastrar Pneu'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
