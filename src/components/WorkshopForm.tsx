import React, { useState, useEffect } from 'react';
import { X, Wrench, AlertCircle } from 'lucide-react';
import { Workshop } from '../types';
import { workshopToRow, WORKSHOP_SPECIALTIES } from '../lib/workshopMappers';
import { filterText, filterCNPJ, filterPhone, filterCEP, filterAlpha } from '../lib/inputHelpers';
import { isValidCNPJ } from '../lib/cnpjValidator';
import { supabase } from '../lib/supabase';

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

interface WorkshopFormProps {
  workshop: Workshop | null;
  onClose: () => void;
  onSave: (workshop: Partial<Workshop>) => Promise<void>;
}

// ─── Filtros por campo ────────────────────────────────────────────────────────

const FIELD_FILTERS: Record<string, (v: string) => string> = {
  name: filterText,
  cnpj: filterCNPJ,
  phone: filterPhone,
  addressZip: filterCEP,
  addressState: (v) => filterAlpha(v, 2),
};

// ─── Componente Principal ─────────────────────────────────────────────────────

export default function WorkshopForm({ workshop, onClose, onSave }: WorkshopFormProps) {
  const [formData, setFormData] = useState<Partial<Workshop>>(() => {
    try {
      const saved = sessionStorage.getItem('workshopFormData');
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cnpjGlobalExists, setCnpjGlobalExists] = useState(false);

  // Inicializa form com dados do workshop ao editar
  useEffect(() => {
    const initial = workshop
      ? { ...workshop }
      : { active: true, specialties: [] };
    setFormData(initial);
    sessionStorage.setItem('workshopFormData', JSON.stringify(initial));
  }, [workshop]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    const filter = FIELD_FILTERS[name];
    const filtered = filter ? filter(value) : value;
    setFormData((prev) => {
      const next = { ...prev, [name]: filtered };
      sessionStorage.setItem('workshopFormData', JSON.stringify(next));
      return next;
    });

    // Verificar se CNPJ já existe globalmente (em workshop_accounts) ao criar nova oficina
    if (name === 'cnpj' && !workshop && filtered.length === 14 && isValidCNPJ(filtered)) {
      supabase
        .from('workshop_accounts')
        .select('id')
        .eq('cnpj', filtered)
        .maybeSingle()
        .then(({ data }) => setCnpjGlobalExists(!!data));
    } else if (name === 'cnpj') {
      setCnpjGlobalExists(false);
    }
  };

  const handleActiveToggle = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData((prev) => {
      const next = { ...prev, active: e.target.checked };
      sessionStorage.setItem('workshopFormData', JSON.stringify(next));
      return next;
    });
  };

  const handleSpecialtyToggle = (specialty: string) => {
    setFormData((prev) => {
      const current = prev.specialties ?? [];
      const next = current.includes(specialty)
        ? current.filter((s) => s !== specialty)
        : [...current, specialty];
      const updated = { ...prev, specialties: next };
      sessionStorage.setItem('workshopFormData', JSON.stringify(updated));
      return updated;
    });
  };

  const handleClose = () => {
    sessionStorage.removeItem('workshopFormOpen');
    sessionStorage.removeItem('workshopFormEditing');
    sessionStorage.removeItem('workshopFormData');
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
        setError(err?.message ?? 'Erro ao salvar oficina. Tente novamente.');
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="relative flex w-full max-w-2xl flex-col rounded-2xl bg-white shadow-xl max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-200 px-6 py-4 flex-shrink-0">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-orange-100">
              <Wrench className="h-4 w-4 text-orange-600" />
            </div>
            <h2 className="text-base font-semibold text-zinc-900">
              {workshop ? 'Editar Oficina' : 'Nova Oficina'}
            </h2>
          </div>
          <button onClick={handleClose} className="rounded-lg p-1 hover:bg-zinc-100 transition-colors">
            <X className="h-5 w-5 text-zinc-500" />
          </button>
        </div>

        {/* Content */}
        <div className="overflow-y-auto flex-1">
          <form id="workshop-form" onSubmit={handleSubmit} className="space-y-8 p-6">

            {/* Seção 1: Dados da Oficina */}
            <div>
              <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-zinc-500">
                Dados da Oficina
              </h3>
              <div className="grid grid-cols-1 gap-y-4 gap-x-4 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <Label htmlFor="name" required>Nome da Oficina</Label>
                  <input
                    id="name" name="name" type="text" required
                    value={formData.name ?? ''}
                    onChange={handleChange}
                    className={inputClass}
                    placeholder="Ex: Oficina Central Ltda"
                  />
                </div>
                <div>
                  <Label htmlFor="cnpj" required>CNPJ</Label>
                  <input
                    id="cnpj" name="cnpj" type="text" required
                    value={formData.cnpj ?? ''}
                    onChange={handleChange}
                    className={inputClass}
                    placeholder="Somente números (14 dígitos)"
                    maxLength={14}
                  />
                  {!workshop && cnpjGlobalExists && (
                    <div className="mt-1.5 flex items-start gap-1.5 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2">
                      <AlertCircle className="h-3.5 w-3.5 text-blue-500 flex-shrink-0 mt-0.5" />
                      <p className="text-xs text-blue-700">
                        Este CNPJ já possui conta no sistema. Use <strong>Convidar Oficina</strong> para vinculá-la ao seu cliente.
                      </p>
                    </div>
                  )}
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
                    placeholder="contato@oficina.com"
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

            {/* Seção 2: Endereço */}
            <div>
              <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-zinc-500">
                Endereço
              </h3>
              <div className="grid grid-cols-1 gap-y-4 gap-x-4 sm:grid-cols-6">
                <div className="sm:col-span-4">
                  <Label htmlFor="addressStreet">Logradouro</Label>
                  <input
                    id="addressStreet" name="addressStreet" type="text"
                    value={formData.addressStreet ?? ''}
                    onChange={handleChange}
                    className={inputClass}
                    placeholder="Rua, Av, etc."
                  />
                </div>
                <div className="sm:col-span-2">
                  <Label htmlFor="addressNumber">Número</Label>
                  <input
                    id="addressNumber" name="addressNumber" type="text"
                    value={formData.addressNumber ?? ''}
                    onChange={handleChange}
                    className={inputClass}
                    placeholder="123"
                  />
                </div>
                <div className="sm:col-span-3">
                  <Label htmlFor="addressComplement">Complemento</Label>
                  <input
                    id="addressComplement" name="addressComplement" type="text"
                    value={formData.addressComplement ?? ''}
                    onChange={handleChange}
                    className={inputClass}
                    placeholder="Sala, Galpão, etc."
                  />
                </div>
                <div className="sm:col-span-3">
                  <Label htmlFor="addressNeighborhood">Bairro</Label>
                  <input
                    id="addressNeighborhood" name="addressNeighborhood" type="text"
                    value={formData.addressNeighborhood ?? ''}
                    onChange={handleChange}
                    className={inputClass}
                  />
                </div>
                <div className="sm:col-span-3">
                  <Label htmlFor="addressCity">Cidade</Label>
                  <input
                    id="addressCity" name="addressCity" type="text"
                    value={formData.addressCity ?? ''}
                    onChange={handleChange}
                    className={inputClass}
                  />
                </div>
                <div className="sm:col-span-1">
                  <Label htmlFor="addressState">UF</Label>
                  <input
                    id="addressState" name="addressState" type="text"
                    value={formData.addressState ?? ''}
                    onChange={handleChange}
                    className={inputClass}
                    placeholder="SP"
                    maxLength={2}
                  />
                </div>
                <div className="sm:col-span-2">
                  <Label htmlFor="addressZip">CEP</Label>
                  <input
                    id="addressZip" name="addressZip" type="text"
                    value={formData.addressZip ?? ''}
                    onChange={handleChange}
                    className={inputClass}
                    placeholder="Somente números"
                    maxLength={8}
                  />
                </div>
              </div>
            </div>

            {/* Seção: Especialidades e Detalhes */}
            <div>
              <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-zinc-500">
                Especialidades e Detalhes
              </h3>
              <div className="space-y-4">
                <div>
                  <Label>Especialidades</Label>
                  <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
                    {WORKSHOP_SPECIALTIES.map((specialty) => (
                      <label
                        key={specialty}
                        className="flex cursor-pointer items-center gap-2 rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 hover:bg-zinc-100 transition-colors"
                      >
                        <input
                          type="checkbox"
                          checked={formData.specialties?.includes(specialty) ?? false}
                          onChange={() => handleSpecialtyToggle(specialty)}
                          className="h-4 w-4 rounded border-zinc-300 text-orange-500 focus:ring-orange-500"
                        />
                        <span className="text-sm text-zinc-700">{specialty}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div>
                  <Label htmlFor="notes">Observações</Label>
                  <textarea
                    id="notes" name="notes"
                    value={formData.notes ?? ''}
                    onChange={handleChange}
                    rows={3}
                    className={`${inputClass} resize-none`}
                    placeholder="Informações adicionais sobre a oficina..."
                  />
                </div>

                <div className="flex items-center gap-3 rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3">
                  <input
                    id="active"
                    type="checkbox"
                    checked={formData.active ?? true}
                    onChange={handleActiveToggle}
                    className="h-4 w-4 rounded border-zinc-300 text-orange-500 focus:ring-orange-500"
                  />
                  <div>
                    <label htmlFor="active" className="block text-sm font-medium text-zinc-700 cursor-pointer">
                      Oficina ativa
                    </label>
                    <p className="text-xs text-zinc-500 mt-0.5">
                      Oficinas inativas não aparecem para seleção em manutenções.
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
              form="workshop-form"
              disabled={saving}
              className="rounded-xl bg-orange-500 px-4 py-2 text-sm font-medium text-white hover:bg-orange-600 transition-colors disabled:opacity-60"
            >
              {saving ? 'Salvando...' : workshop ? 'Salvar Alterações' : 'Cadastrar Oficina'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
