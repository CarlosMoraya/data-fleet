import React, { useState, useEffect } from 'react';
import { X, Package } from 'lucide-react';
import { Shipper } from '../types';
import { shipperToRow } from '../lib/shipperMappers';
import { filterText, filterCNPJ, filterPhone } from '../lib/inputHelpers';

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

interface ShipperFormProps {
  shipper: Shipper | null;
  onClose: () => void;
  onSave: (shipper: Partial<Shipper>) => Promise<void>;
}

// ─── Filtros por campo ────────────────────────────────────────────────────────

const FIELD_FILTERS: Record<string, (v: string) => string> = {
  name: filterText,
  cnpj: filterCNPJ,
  phone: filterPhone,
};

// ─── Componente Principal ─────────────────────────────────────────────────────

export default function ShipperForm({ shipper, onClose, onSave }: ShipperFormProps) {
  const [formData, setFormData] = useState<Partial<Shipper>>(() => {
    try {
      const saved = sessionStorage.getItem('shipperFormData');
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const initial = shipper ? { ...shipper } : { active: true };
    setFormData(initial);
    sessionStorage.setItem('shipperFormData', JSON.stringify(initial));
  }, [shipper]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    const filter = FIELD_FILTERS[name];
    const filtered = filter ? filter(value) : value;
    setFormData((prev) => {
      const next = { ...prev, [name]: filtered };
      sessionStorage.setItem('shipperFormData', JSON.stringify(next));
      return next;
    });
  };

  const handleActiveToggle = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData((prev) => {
      const next = { ...prev, active: e.target.checked };
      sessionStorage.setItem('shipperFormData', JSON.stringify(next));
      return next;
    });
  };

  const handleClose = () => {
    sessionStorage.removeItem('shipperFormOpen');
    sessionStorage.removeItem('shipperFormEditing');
    sessionStorage.removeItem('shipperFormData');
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
        setError('Este CNPJ já está cadastrado para este cliente.');
      } else {
        setError(err?.message ?? 'Erro ao salvar embarcador. Tente novamente.');
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="relative flex w-full max-w-xl flex-col rounded-2xl bg-white shadow-xl max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-200 px-6 py-4 flex-shrink-0">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-100">
              <Package className="h-4 w-4 text-blue-600" />
            </div>
            <h2 className="text-base font-semibold text-zinc-900">
              {shipper ? 'Editar Embarcador' : 'Novo Embarcador'}
            </h2>
          </div>
          <button onClick={handleClose} className="rounded-lg p-1 hover:bg-zinc-100 transition-colors">
            <X className="h-5 w-5 text-zinc-500" />
          </button>
        </div>

        {/* Content */}
        <div className="overflow-y-auto flex-1">
          <form id="shipper-form" onSubmit={handleSubmit} className="space-y-8 p-6">

            {/* Seção 1: Dados do Embarcador */}
            <div>
              <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-zinc-500">
                Dados do Embarcador
              </h3>
              <div className="grid grid-cols-1 gap-y-4 gap-x-4 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <Label htmlFor="name" required>Nome do Embarcador</Label>
                  <input
                    id="name" name="name" type="text" required
                    value={formData.name ?? ''}
                    onChange={handleChange}
                    className={inputClass}
                    placeholder="Ex: Transportadora ABC Ltda"
                  />
                </div>
                <div>
                  <Label htmlFor="cnpj">CNPJ</Label>
                  <input
                    id="cnpj" name="cnpj" type="text"
                    value={formData.cnpj ?? ''}
                    onChange={handleChange}
                    className={inputClass}
                    placeholder="Somente números (14 dígitos)"
                    maxLength={14}
                  />
                </div>
                <div>
                  <Label htmlFor="phone">Telefone</Label>
                  <input
                    id="phone" name="phone" type="text"
                    value={formData.phone ?? ''}
                    onChange={handleChange}
                    className={inputClass}
                    placeholder="Somente números"
                    maxLength={11}
                  />
                </div>
                <div>
                  <Label htmlFor="email">E-mail</Label>
                  <input
                    id="email" name="email" type="email"
                    value={formData.email ?? ''}
                    onChange={handleChange}
                    className={inputClass}
                    placeholder="contato@embarcador.com"
                  />
                </div>
                <div>
                  <Label htmlFor="contactPerson">Pessoa de Contato</Label>
                  <input
                    id="contactPerson" name="contactPerson" type="text"
                    value={formData.contactPerson ?? ''}
                    onChange={handleChange}
                    className={inputClass}
                    placeholder="Nome do responsável"
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
                    placeholder="Informações adicionais sobre o embarcador..."
                  />
                </div>

                <div className="flex items-center gap-3 rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3">
                  <input
                    id="active"
                    type="checkbox"
                    checked={formData.active ?? true}
                    onChange={handleActiveToggle}
                    className="h-4 w-4 rounded border-zinc-300 text-blue-500 focus:ring-blue-500"
                  />
                  <div>
                    <label htmlFor="active" className="block text-sm font-medium text-zinc-700 cursor-pointer">
                      Embarcador ativo
                    </label>
                    <p className="text-xs text-zinc-500 mt-0.5">
                      Embarcadores inativos não aparecem para seleção em veículos.
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
              form="shipper-form"
              disabled={saving}
              className="rounded-xl bg-blue-500 px-4 py-2 text-sm font-medium text-white hover:bg-blue-600 transition-colors disabled:opacity-60"
            >
              {saving ? 'Salvando...' : shipper ? 'Salvar Alterações' : 'Cadastrar Embarcador'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
