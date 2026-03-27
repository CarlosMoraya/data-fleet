import React from 'react';
import { Loader2, X, AlertTriangle } from 'lucide-react';
import { cn } from '../lib/utils';
import { Tire, TireVisualClassification, VehicleTireConfig, AxleConfigEntry } from '../types';
import { generatePositions, generatePositionsFromConfig, validatePositionAssignment } from '../lib/tirePositions';

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
  onSave: (tires: Partial<Tire> | Partial<Tire>[], previousPosition?: string) => Promise<void>;
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
      );
      return;
    }

    if (registerMode === 'single') {
      if (!currentPosition || positionError) return;
      const selectedPos = positions.find(p => p.code === currentPosition);
      await onSave({
        ...buildSharedData(),
        tireCode: crypto.randomUUID(),
        currentPosition,
        positionType: selectedPos?.type ?? 'single',
      });
    } else {
      // Modo "todos os pneus": gera um registro por posição livre
      if (freePositions.length === 0) return;
      const tiresArray: Partial<Tire>[] = freePositions.map(pos => ({
        ...buildSharedData(),
        tireCode: crypto.randomUUID(),
        currentPosition: pos.code,
        positionType: pos.type,
      }));
      await onSave(tiresArray);
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
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg mx-4 flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-100 shrink-0">
          <div>
            <h2 className="text-lg font-semibold text-zinc-900">
              {isEditing ? 'Editar Pneu' : 'Novo Pneu'}
            </h2>
            <p className="text-sm text-zinc-500">{vehiclePlate} — {vehicleType}</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-zinc-100 text-zinc-400">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Conteúdo */}
        <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
          <div className="overflow-y-auto flex-1 px-6 py-4 space-y-5">

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
              <div className="flex rounded-lg border border-zinc-200 overflow-hidden">
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
                <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-wide mb-3">Identificação</h3>
                <div>
                  <label className="block text-sm font-medium text-zinc-700 mb-1">Código do Pneu</label>
                  <div className="w-full border border-zinc-200 rounded-lg px-3 py-2 text-sm bg-zinc-50 text-zinc-500 font-mono">
                    {editingTire.tireCode}
                  </div>
                  <p className="text-xs text-zinc-400 mt-1">O código do pneu não pode ser alterado.</p>
                </div>
              </section>
            )}

            {/* Especificação e demais campos */}
            <section>
              {!isEditing && (
                <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-wide mb-3">Identificação</h3>
              )}
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-zinc-700 mb-1">
                    Especificação *
                  </label>
                  <input
                    value={specification}
                    onChange={e => setSpecification(e.target.value)}
                    required
                    placeholder="ex: 295/80R22.5"
                    className="w-full border border-zinc-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-zinc-700 mb-1">DOT</label>
                  <input
                    value={dot}
                    onChange={e => setDot(e.target.value)}
                    placeholder="ex: 2524"
                    className="w-full border border-zinc-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-zinc-700 mb-1">Marcação de Fogo</label>
                  <input
                    value={fireMarking}
                    onChange={e => setFireMarking(e.target.value)}
                    className="w-full border border-zinc-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                  />
                </div>
              </div>
            </section>

            {/* Fabricante */}
            <section>
              <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-wide mb-3">Fabricante</h3>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-zinc-700 mb-1">Fabricante</label>
                  <input
                    value={manufacturer}
                    onChange={e => setManufacturer(e.target.value)}
                    placeholder="ex: Bridgestone"
                    className="w-full border border-zinc-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-zinc-700 mb-1">Marca</label>
                  <input
                    value={brand}
                    onChange={e => setBrand(e.target.value)}
                    placeholder="ex: R295"
                    className="w-full border border-zinc-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                  />
                </div>
              </div>
            </section>

            {/* Intervalos */}
            <section>
              <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-wide mb-3">Intervalos (Km)</h3>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-sm font-medium text-zinc-700 mb-1">Rodízio</label>
                  <input
                    type="number"
                    min="0"
                    value={rotationIntervalKm}
                    onChange={e => setRotationIntervalKm(e.target.value)}
                    placeholder="ex: 20000"
                    className="w-full border border-zinc-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-zinc-700 mb-1">Vida Útil</label>
                  <input
                    type="number"
                    min="0"
                    value={usefulLifeKm}
                    onChange={e => setUsefulLifeKm(e.target.value)}
                    placeholder="ex: 120000"
                    className="w-full border border-zinc-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-zinc-700 mb-1">Recapagem</label>
                  <input
                    type="number"
                    min="0"
                    value={retreadIntervalKm}
                    onChange={e => setRetreadIntervalKm(e.target.value)}
                    placeholder="ex: 60000"
                    className="w-full border border-zinc-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                  />
                </div>
              </div>
            </section>

            {/* Classificação e Posição */}
            <section>
              <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-wide mb-3">
                {registerMode === 'all' && !isEditing ? 'Classificação' : 'Classificação & Posição'}
              </h3>
              <div className={cn('grid gap-3', registerMode === 'all' && !isEditing ? 'grid-cols-1' : 'grid-cols-2')}>
                <div>
                  <label className="block text-sm font-medium text-zinc-700 mb-1">Classificação Visual *</label>
                  <select
                    value={visualClassification}
                    onChange={e => setVisualClassification(e.target.value as TireVisualClassification)}
                    required
                    className="w-full border border-zinc-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 bg-white"
                  >
                    {VISUAL_CLASSIFICATIONS.map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>

                {/* Seletor de posição (pneu único ou edição) */}
                {(isEditing || registerMode === 'single') && (
                  <div>
                    <label className="block text-sm font-medium text-zinc-700 mb-1">Posição *</label>
                    <select
                      value={currentPosition}
                      onChange={e => handlePositionChange(e.target.value)}
                      required
                      className={cn(
                        'w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 bg-white',
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
                      <p className="text-xs text-red-500 mt-1">{positionError}</p>
                    )}
                  </div>
                )}
              </div>
            </section>

            {/* Lista de posições no modo "todos os pneus" */}
            {!isEditing && registerMode === 'all' && (
              <section>
                <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-wide mb-3">
                  Posições a registrar
                </h3>
                {positions.length === 0 ? (
                  <p className="text-sm text-zinc-400">Nenhuma posição disponível para este veículo.</p>
                ) : (
                  <div className="border border-zinc-200 rounded-lg overflow-hidden divide-y divide-zinc-100 max-h-52 overflow-y-auto">
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
                            <span className="font-mono text-zinc-700 text-xs bg-zinc-100 px-1.5 py-0.5 rounded">
                              {pos.code}
                            </span>
                            <span className="text-zinc-600">{pos.label}</span>
                          </div>
                          {occupant ? (
                            <span className="text-xs text-zinc-400">já registrado</span>
                          ) : (
                            <span className="text-xs text-emerald-600 font-medium">livre</span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
                {occupiedPositions.length > 0 && (
                  <p className="text-xs text-zinc-400 mt-2">
                    {occupiedPositions.length} posição(ões) já registrada(s) serão ignoradas.
                  </p>
                )}
              </section>
            )}

            {saveError && (
              <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
                {saveError}
              </div>
            )}

            </>)}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-zinc-100 shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm text-zinc-600 hover:text-zinc-800 border border-zinc-200 rounded-lg hover:bg-zinc-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={submitDisabled}
              className="flex items-center gap-2 px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white text-sm font-medium rounded-lg disabled:opacity-60 disabled:cursor-not-allowed"
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
