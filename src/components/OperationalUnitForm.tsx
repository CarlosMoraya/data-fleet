import React, { useState, useEffect } from 'react';
import { X, Building2 } from 'lucide-react';
import { OperationalUnit } from '../types';
import { filterText, filterAlpha, filterAlphanumeric } from '../lib/inputHelpers';

// ─── Estilos ─────────────────────────────────────────────────────────────────

const inputClass =
  'mt-1 block w-full rounded-xl border border-zinc-300 py-2 px-3 text-sm shadow-sm ' +
  'focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500';

const labelClass = 'block text-sm font-medium text-zinc-700';

// ─── Subcomponente Label ──────────────────────────────────────────────────────

function Label({ htmlFor, required, children }: { htmlFor?: string; required?: boolean; children: React.ReactNode }) {
  return (
    <label htmlFor={htmlFor} className={labelClass}>
      {children}
      {required && <span className="ml-0.5 text-red-500">*</span>}
    </label>
  );
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface AvailableShipper {
  id: string;
  name: string;
}

interface OperationalUnitFormProps {
  unit: OperationalUnit | null;
  availableShippers: AvailableShipper[];
  onClose: () => void;
  onSave: (unit: Partial<OperationalUnit>) => Promise<void>;
}

// ─── Filtros por campo ────────────────────────────────────────────────────────

const FIELD_FILTERS: Record<string, (v: string) => string> = {
  name: filterText,
  code: (v) => filterAlphanumeric(v, 20),
  city: filterText,
  state: (v) => filterAlpha(v, 2),
};

// ─── Componente Principal ─────────────────────────────────────────────────────

export default function OperationalUnitForm({ unit, availableShippers, onClose, onSave }: OperationalUnitFormProps) {
  const [formData, setFormData] = useState<Partial<OperationalUnit>>(() => {
    try {
      const saved = sessionStorage.getItem('operationalUnitFormData');
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const initial = unit ? { ...unit } : { active: true };
    setFormData(initial);
    sessionStorage.setItem('operationalUnitFormData', JSON.stringify(initial));
  }, [unit]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    const filter = FIELD_FILTERS[name];
    const filtered = filter ? filter(value) : value;
    setFormData((prev) => {
      const next = { ...prev, [name]: filtered || undefined };
      if (name === 'shipperId') {
        next.shipperId = value || undefined;
      }
      sessionStorage.setItem('operationalUnitFormData', JSON.stringify(next));
      return next;
    });
  };

  const handleActiveToggle = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData((prev) => {
      const next = { ...prev, active: e.target.checked };
      sessionStorage.setItem('operationalUnitFormData', JSON.stringify(next));
      return next;
    });
  };

  const handleClose = () => {
    sessionStorage.removeItem('operationalUnitFormOpen');
    sessionStorage.removeItem('operationalUnitFormEditing');
    sessionStorage.removeItem('operationalUnitFormData');
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await onSave(formData);
    } catch (err: any) {
      const pgError = err as { code?: string; message?: string };
      if (pgError?.code === '23505') {
        setError('Este código já está cadastrado para este cliente.');
      } else {
        setError(err?.message ?? 'Erro ao salvar unidade operacional. Tente novamente.');
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" role="dialog" aria-modal="true">
      <div className="relative flex w-full max-w-xl flex-col rounded-2xl bg-white shadow-xl max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-200 px-6 py-4 flex-shrink-0">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-100">
              <Building2 className="h-4 w-4 text-indigo-600" />
            </div>
            <h2 className="text-base font-semibold text-zinc-900">
              {unit ? 'Editar Unidade Operacional' : 'Nova Unidade Operacional'}
            </h2>
          </div>
          <button onClick={handleClose} className="rounded-lg p-1 hover:bg-zinc-100 transition-colors">
            <X className="h-5 w-5 text-zinc-500" />
          </button>
        </div>

        {/* Content */}
        <div className="overflow-y-auto flex-1">
          <form id="operational-unit-form" onSubmit={handleSubmit} className="space-y-8 p-6">

            {/* Seção 1: Dados da Unidade */}
            <div>
              <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-zinc-500">
                Dados da Unidade
              </h3>
              <div className="grid grid-cols-1 gap-y-4 gap-x-4 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <Label htmlFor="shipperId" required>Embarcador</Label>
                  <select
                    id="shipperId" name="shipperId" required
                    value={formData.shipperId ?? ''}
                    onChange={handleChange}
                    className={inputClass}
                  >
                    <option value="">Selecione um embarcador...</option>
                    {availableShippers.map((s) => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>
                <div className="sm:col-span-2">
                  <Label htmlFor="name" required>Nome da Unidade</Label>
                  <input
                    id="name" name="name" type="text" required
                    value={formData.name ?? ''}
                    onChange={handleChange}
                    className={inputClass}
                    placeholder="Ex: Base Sul - Santos"
                  />
                </div>
                <div>
                  <Label htmlFor="code">Código</Label>
                  <input
                    id="code" name="code" type="text"
                    value={formData.code ?? ''}
                    onChange={handleChange}
                    className={inputClass}
                    placeholder="Ex: BSS001"
                    maxLength={20}
                  />
                </div>
                <div>
                  <Label htmlFor="city">Cidade</Label>
                  <input
                    id="city" name="city" type="text"
                    value={formData.city ?? ''}
                    onChange={handleChange}
                    className={inputClass}
                    placeholder="Ex: Santos"
                  />
                </div>
                <div className="sm:col-span-1">
                  <Label htmlFor="state">UF</Label>
                  <input
                    id="state" name="state" type="text"
                    value={formData.state ?? ''}
                    onChange={handleChange}
                    className={inputClass}
                    placeholder="SP"
                    maxLength={2}
                  />
                </div>
              </div>
            </div>

            {/* Seção 2: Observações & Status */}
            <div>
              <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-zinc-500">
                Observações & Status
              </h3>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="notes">Observações</Label>
                  <textarea
                    id="notes" name="notes"
                    value={formData.notes ?? ''}
                    onChange={handleChange}
                    rows={3}
                    className={`${inputClass} resize-none`}
                    placeholder="Informações adicionais sobre a unidade..."
                  />
                </div>

                <div className="flex items-center gap-3 rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3">
                  <input
                    id="active"
                    type="checkbox"
                    checked={formData.active ?? true}
                    onChange={handleActiveToggle}
                    className="h-4 w-4 rounded border-zinc-300 text-indigo-500 focus:ring-indigo-500"
                  />
                  <div>
                    <label htmlFor="active" className="block text-sm font-medium text-zinc-700 cursor-pointer">
                      Unidade ativa
                    </label>
                    <p className="text-xs text-zinc-500 mt-0.5">
                      Unidades inativas não aparecem para seleção em veículos.
                    </p>
                  </div>
                </div>
              </div>
            </div>

          </form>
        </div>

        {/* Footer */}
        <div className="flex-shrink-0 border-t border-zinc-200 px-6 py-4">
          {error && (
            <p className="mb-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
              {error}
            </p>
          )}
          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={handleClose}
              className="rounded-xl border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              form="operational-unit-form"
              disabled={saving}
              className="rounded-xl bg-indigo-500 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-600 transition-colors disabled:opacity-60"
            >
              {saving ? 'Salvando...' : unit ? 'Salvar Alterações' : 'Cadastrar Unidade'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
