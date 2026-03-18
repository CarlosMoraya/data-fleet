import React, { useState, useEffect, useCallback } from 'react';
import { X, Plus, Trash2, ChevronUp, ChevronDown, GripVertical, Lock, AlertTriangle } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import {
  templateToRow,
  checklistItemToRow,
  checklistItemFromRow,
  suggestionFromRow,
  type SuggestionRow,
  type ChecklistItemRow,
} from '../lib/checklistTemplateMappers';
import type { ChecklistTemplate, ChecklistItem, ChecklistItemSuggestion, TemplateCategory, ChecklistContext } from '../types';
import { cn } from '../lib/utils';

interface Props {
  template?: ChecklistTemplate | null;
  onClose: () => void;
  onSaved: () => void;
}

interface DraftItem {
  id?: string;
  title: string;
  description: string;
  isMandatory: boolean;
  requirePhotoIfIssue: boolean;
  canBlockVehicle: boolean;
  defaultAction: string;
  orderNumber: number;
  fromSuggestion?: boolean;
  enabled?: boolean;
}

const CATEGORIES: { value: TemplateCategory; label: string }[] = [
  { value: 'Leve', label: 'Leve' },
  { value: 'Médio', label: 'Médio' },
  { value: 'Pesado', label: 'Pesado' },
  { value: 'Elétrico', label: 'Elétrico' },
];

const CONTEXTS: { value: ChecklistContext; label: string; description: string }[] = [
  { value: 'Rotina', label: 'Rotina', description: 'Inspeção rotineira do veículo' },
  { value: 'Auditoria', label: 'Auditoria', description: 'Realizado por Auditores de Pátio' },
  { value: 'Reboque', label: 'Reboque', description: 'Inspeção específica para reboques' },
  { value: 'Entrada em Oficina', label: 'Entrada em Oficina', description: 'Registro ao enviar veículo para manutenção' },
  { value: 'Saída de Oficina', label: 'Saída de Oficina', description: 'Conferência ao receber veículo da manutenção' },
  { value: 'Segurança', label: 'Segurança', description: 'Itens críticos de segurança (pode bloquear veículo)' },
];

export default function ChecklistTemplateForm({ template, onClose, onSaved }: Props) {
  const { user, currentClient } = useAuth();
  const isEdit = !!template;

  // Step 1: Metadata
  const [description, setDescription] = useState(template?.description ?? '');
  const [category, setCategory] = useState<TemplateCategory>(template?.vehicleCategory ?? 'Leve');
  const [context, setContext] = useState<ChecklistContext>(template?.context ?? 'Rotina');

  // Step 2: Items
  const [items, setItems] = useState<DraftItem[]>([]);
  const [suggestions, setSuggestions] = useState<ChecklistItemSuggestion[]>([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);

  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const isSecurityContext = context === 'Segurança';

  const loadSuggestions = useCallback(async (cat: TemplateCategory) => {
    setLoadingSuggestions(true);
    const { data } = await supabase
      .from('checklist_item_suggestions')
      .select('*')
      .eq('vehicle_category', cat)
      .order('order_number');
    setSuggestions((data ?? []).map(r => suggestionFromRow(r as SuggestionRow)));
    setLoadingSuggestions(false);
  }, []);

  useEffect(() => {
    if (!isEdit) loadSuggestions(category);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!isEdit || !template) return;
    (async () => {
      const { data } = await supabase
        .from('checklist_items')
        .select('*')
        .eq('template_id', template.id)
        .eq('version_number', template.currentVersion)
        .order('order_number');
      if (data) {
        setItems(
          (data as ChecklistItemRow[]).map((row, idx) => {
            const item = checklistItemFromRow(row);
            return {
              id: item.id,
              title: item.title,
              description: item.description ?? '',
              isMandatory: item.isMandatory,
              requirePhotoIfIssue: item.requirePhotoIfIssue,
              canBlockVehicle: item.canBlockVehicle ?? false,
              defaultAction: item.defaultAction ?? '',
              orderNumber: idx,
              enabled: true,
            };
          }),
        );
      }
    })();
  }, [isEdit, template]);

  const handleCategoryChange = async (newCat: TemplateCategory) => {
    setCategory(newCat);
    if (isEdit) return;
    await loadSuggestions(newCat);
    setItems([]);
  };

  const buildItemsFromSuggestions = () => {
    if (isEdit) return;
    if (items.length > 0) return;
    const built: DraftItem[] = suggestions.map((s, idx) => ({
      title: s.title,
      description: s.description ?? '',
      isMandatory: s.isMandatory,
      requirePhotoIfIssue: s.requirePhotoIfIssue,
      canBlockVehicle: false,
      defaultAction: s.defaultAction ?? '',
      orderNumber: idx,
      fromSuggestion: true,
      enabled: s.isMandatory,
    }));
    setItems(built);
  };

  const addItem = () => {
    setItems(prev => [
      ...prev,
      {
        title: '',
        description: '',
        isMandatory: false,
        requirePhotoIfIssue: false,
        canBlockVehicle: false,
        defaultAction: '',
        orderNumber: prev.length,
        enabled: true,
      },
    ]);
  };

  const removeItem = (idx: number) => {
    setItems(prev => prev.filter((_, i) => i !== idx).map((it, i) => ({ ...it, orderNumber: i })));
  };

  const moveItem = (idx: number, dir: -1 | 1) => {
    const next = idx + dir;
    if (next < 0 || next >= items.length) return;
    setItems(prev => {
      const arr = [...prev];
      [arr[idx], arr[next]] = [arr[next], arr[idx]];
      return arr.map((it, i) => ({ ...it, orderNumber: i }));
    });
  };

  const updateItem = (idx: number, patch: Partial<DraftItem>) => {
    setItems(prev => prev.map((it, i) => (i === idx ? { ...it, ...patch } : it)));
  };

  const goToStep2 = () => {
    setError('');
    buildItemsFromSuggestions();
    setStep(2);
  };

  const handleSave = async () => {
    setError('');
    const enabledItems = items.filter(it => it.enabled !== false);
    const hasEmptyTitles = enabledItems.some(it => !it.title.trim());
    if (hasEmptyTitles) { setError('Todos os itens devem ter um título.'); return; }
    if (!isEdit && enabledItems.length === 0) { setError('Adicione pelo menos um item ao checklist.'); return; }

    setSaving(true);
    try {
      if (isEdit && template) {
        const { error: upErr } = await supabase
          .from('checklist_templates')
          .update({
            ...templateToRow({ description: description || undefined }),
            updated_at: new Date().toISOString(),
          })
          .eq('id', template.id);
        if (upErr) throw upErr;

        if (template.status === 'draft') {
          await supabase.from('checklist_items').delete().eq('template_id', template.id).eq('version_number', template.currentVersion);
          const itemsToInsert = enabledItems.map((it, i) => ({
            ...checklistItemToRow({ ...it, templateId: template.id, versionNumber: template.currentVersion, orderNumber: i }),
          }));
          if (itemsToInsert.length > 0) {
            const { error: insertErr } = await supabase.from('checklist_items').insert(itemsToInsert);
            if (insertErr) throw insertErr;
          }
        }
      } else {
        const { data: newTemplate, error: tplErr } = await supabase
          .from('checklist_templates')
          .insert({
            client_id: currentClient.id,
            vehicle_category: category,
            context,
            name: `Checklist ${category} ${context}`,
            description: description.trim() || null,
            current_version: 1,
            status: 'draft',
            created_by: user?.id ?? null,
          })
          .select()
          .single();
        if (tplErr) throw tplErr;

        const itemsToInsert = enabledItems.map((it, i) => checklistItemToRow({
          templateId: newTemplate.id,
          versionNumber: 1,
          title: it.title,
          description: it.description || undefined,
          isMandatory: it.isMandatory,
          requirePhotoIfIssue: it.requirePhotoIfIssue,
          canBlockVehicle: it.canBlockVehicle,
          defaultAction: it.defaultAction || undefined,
          orderNumber: i,
        }));
        if (itemsToInsert.length > 0) {
          const { error: insertErr } = await supabase.from('checklist_items').insert(itemsToInsert);
          if (insertErr) throw insertErr;
        }
      }
      onSaved();
    } catch (err: unknown) {
      console.error('Erro ao salvar template:', err);
      const msg = err instanceof Error
        ? err.message
        : (err as Record<string, unknown>)?.message as string | undefined
          ?? 'Erro ao salvar template';
      setError(msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 p-4 overflow-y-auto">
      <div className="relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl my-4">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <div>
            <h2 className="text-lg font-semibold text-zinc-900">
              {isEdit ? 'Editar Template' : 'Novo Template de Checklist'}
            </h2>
            <p className="text-sm text-zinc-500">Passo {step} de 2</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-zinc-100">
            <X className="h-5 w-5 text-zinc-500" />
          </button>
        </div>

        {/* Step indicator */}
        <div className="flex px-6 pt-4 gap-2">
          {['Metadados', 'Itens'].map((label, i) => (
            <div key={label} className="flex items-center gap-2 flex-1">
              <button
                onClick={() => {
                  if (i + 1 < step) setStep(i + 1);
                  else if (i + 1 === 2 && step === 1) {
                    setError('');
                    buildItemsFromSuggestions();
                    setStep(2);
                  }
                }}
                className={cn(
                  'w-7 h-7 rounded-full flex items-center justify-center text-sm font-medium transition-colors',
                  step === i + 1 ? 'bg-orange-500 text-white' : step > i + 1 ? 'bg-green-500 text-white' : 'bg-zinc-200 text-zinc-500',
                )}
              >
                {i + 1}
              </button>
              <span className={cn('text-sm', step === i + 1 ? 'text-zinc-900 font-medium' : 'text-zinc-400')}>{label}</span>
              {i < 1 && <div className="flex-1 h-px bg-zinc-200 mx-1" />}
            </div>
          ))}
        </div>

        <div className="px-6 py-4 space-y-4">
          {error && (
            <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{error}</div>
          )}

          {/* ── Step 1: Metadata ─────────────────────────────────────────────── */}
          {step === 1 && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-1">Categoria</label>
                <div className="grid grid-cols-2 gap-2">
                  {CATEGORIES.map(cat => (
                    <label
                      key={cat.value}
                      className={cn(
                        'flex items-center gap-3 rounded-lg border px-4 py-3 cursor-pointer transition-colors',
                        category === cat.value ? 'border-orange-400 bg-orange-50' : 'border-zinc-200 hover:border-zinc-300',
                        isEdit && 'opacity-60 cursor-not-allowed',
                      )}
                    >
                      <input
                        type="radio"
                        name="category"
                        value={cat.value}
                        checked={category === cat.value}
                        onChange={() => !isEdit && handleCategoryChange(cat.value)}
                        disabled={isEdit}
                        className="accent-orange-500"
                      />
                      <span className="text-sm font-medium">{cat.label}</span>
                    </label>
                  ))}
                </div>
                {isEdit && (
                  <p className="mt-1 text-xs text-zinc-400">A categoria não pode ser alterada após a criação.</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-1">Contexto</label>
                <div className="grid grid-cols-1 gap-2">
                  {CONTEXTS.map(ctx => (
                    <label
                      key={ctx.value}
                      className={cn(
                        'flex items-start gap-3 rounded-lg border px-4 py-3 cursor-pointer transition-colors',
                        context === ctx.value ? 'border-orange-400 bg-orange-50' : 'border-zinc-200 hover:border-zinc-300',
                        isEdit && 'opacity-60 cursor-not-allowed',
                      )}
                    >
                      <input
                        type="radio"
                        name="context"
                        value={ctx.value}
                        checked={context === ctx.value}
                        onChange={() => !isEdit && setContext(ctx.value)}
                        disabled={isEdit}
                        className="accent-orange-500 mt-0.5"
                      />
                      <div>
                        <p className="text-sm font-medium">{ctx.label}</p>
                        <p className="text-xs text-zinc-500">{ctx.description}</p>
                      </div>
                    </label>
                  ))}
                </div>
                {isEdit && (
                  <p className="mt-1 text-xs text-zinc-400">O contexto não pode ser alterado após a criação.</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-1">Descrição (opcional)</label>
                <textarea
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  rows={2}
                  placeholder="Descreva o objetivo deste checklist..."
                  className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 resize-none"
                />
              </div>
            </div>
          )}

          {/* ── Step 2: Items ─────────────────────────────────────────────────── */}
          {step === 2 && (
            <div className="space-y-3">
              {isSecurityContext && (
                <div className="rounded-lg bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-800 flex items-start gap-2">
                  <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                  <span>Template de <strong>Segurança</strong>: ative "Bloqueia veículo" nos itens críticos. Quando implementado, veículos serão alertados visualmente.</span>
                </div>
              )}

              {loadingSuggestions && (
                <div className="text-center py-8 text-zinc-400 text-sm">Carregando sugestões...</div>
              )}

              {!loadingSuggestions && items.length === 0 && (
                <div className="text-center py-8 text-zinc-400 text-sm">Nenhuma sugestão encontrada para esta categoria.</div>
              )}

              {items.map((item, idx) => {
                const isLocked = item.fromSuggestion && item.isMandatory;
                return (
                  <div
                    key={idx}
                    className={cn(
                      'rounded-lg border p-3 space-y-2',
                      item.enabled === false ? 'bg-zinc-50 border-zinc-200 opacity-60' : 'border-zinc-200',
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <GripVertical className="h-4 w-4 text-zinc-300 flex-shrink-0" />

                      {item.fromSuggestion && !isLocked && (
                        <button
                          type="button"
                          onClick={() => updateItem(idx, { enabled: !item.enabled })}
                          className={cn(
                            'h-5 w-9 flex-shrink-0 rounded-full transition-colors',
                            item.enabled ? 'bg-orange-500' : 'bg-zinc-300',
                          )}
                        >
                          <span
                            className={cn(
                              'block h-4 w-4 rounded-full bg-white shadow ml-0.5 transition-transform',
                              item.enabled ? 'translate-x-4' : 'translate-x-0',
                            )}
                          />
                        </button>
                      )}

                      {isLocked && <Lock className="h-4 w-4 text-zinc-400 flex-shrink-0" title="Item obrigatório do sistema" />}

                      <input
                        type="text"
                        value={item.title}
                        onChange={e => updateItem(idx, { title: e.target.value })}
                        disabled={!!isLocked}
                        placeholder="Título do item *"
                        className="flex-1 rounded-md border border-zinc-300 px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 disabled:bg-zinc-50 disabled:text-zinc-400"
                      />

                      {item.canBlockVehicle && (
                        <span className="flex-shrink-0 text-xs bg-red-100 text-red-700 px-1.5 py-0.5 rounded-full font-medium">⚠ Bloqueio</span>
                      )}

                      <div className="flex gap-1">
                        <button type="button" onClick={() => moveItem(idx, -1)} disabled={idx === 0} className="p-1 rounded hover:bg-zinc-100 disabled:opacity-30">
                          <ChevronUp className="h-4 w-4" />
                        </button>
                        <button type="button" onClick={() => moveItem(idx, 1)} disabled={idx === items.length - 1} className="p-1 rounded hover:bg-zinc-100 disabled:opacity-30">
                          <ChevronDown className="h-4 w-4" />
                        </button>
                        {!isLocked && (
                          <button type="button" onClick={() => removeItem(idx)} className="p-1 rounded hover:bg-red-50 text-red-500">
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </div>

                    {item.enabled !== false && (
                      <div className="pl-8 space-y-2">
                        <input
                          type="text"
                          value={item.description}
                          onChange={e => updateItem(idx, { description: e.target.value })}
                          placeholder="Descrição (opcional)"
                          className="w-full rounded-md border border-zinc-300 px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                        />
                        <input
                          type="text"
                          value={item.defaultAction}
                          onChange={e => updateItem(idx, { defaultAction: e.target.value })}
                          placeholder="Ação sugerida se não conforme (opcional)"
                          className="w-full rounded-md border border-zinc-300 px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                        />

                        <div className="flex flex-wrap gap-4">
                          <label className="flex items-center gap-2 text-sm cursor-pointer">
                            <button
                              type="button"
                              onClick={() => updateItem(idx, { isMandatory: !item.isMandatory })}
                              className={cn(
                                'relative h-5 w-9 flex-shrink-0 rounded-full transition-colors',
                                item.isMandatory ? 'bg-orange-500' : 'bg-zinc-300',
                              )}
                            >
                              <span className={cn('absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform', item.isMandatory ? 'translate-x-4' : 'translate-x-0')} />
                            </button>
                            <span className={cn('text-zinc-700', item.isMandatory && 'font-medium text-orange-600')}>Obrigatório</span>
                          </label>

                          <label className="flex items-center gap-2 text-sm cursor-pointer">
                            <input
                              type="checkbox"
                              checked={item.requirePhotoIfIssue}
                              onChange={e => updateItem(idx, { requirePhotoIfIssue: e.target.checked })}
                              className="accent-orange-500"
                            />
                            <span className="text-zinc-700">Exigir foto se Problema</span>
                          </label>

                          {isSecurityContext && (
                            <label className="flex items-center gap-2 text-sm cursor-pointer">
                              <button
                                type="button"
                                onClick={() => updateItem(idx, { canBlockVehicle: !item.canBlockVehicle })}
                                className={cn(
                                  'relative h-5 w-9 flex-shrink-0 rounded-full transition-colors',
                                  item.canBlockVehicle ? 'bg-red-500' : 'bg-zinc-300',
                                )}
                              >
                                <span className={cn('absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform', item.canBlockVehicle ? 'translate-x-4' : 'translate-x-0')} />
                              </button>
                              <span className={cn('text-zinc-700', item.canBlockVehicle && 'font-medium text-red-600')}>Bloqueia veículo se reprovado</span>
                            </label>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}

              <button
                type="button"
                onClick={addItem}
                className="w-full flex items-center justify-center gap-2 rounded-lg border-2 border-dashed border-zinc-300 py-3 text-sm text-zinc-500 hover:border-orange-400 hover:text-orange-500 transition-colors"
              >
                <Plus className="h-4 w-4" />
                Adicionar item
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t bg-zinc-50 rounded-b-2xl">
          <button
            onClick={() => step > 1 ? setStep(step - 1) : onClose()}
            className="px-4 py-2 text-sm font-medium text-zinc-600 hover:text-zinc-900"
          >
            {step > 1 ? 'Voltar' : 'Cancelar'}
          </button>

          {step < 2 ? (
            <button
              onClick={goToStep2}
              className="px-5 py-2 bg-orange-500 text-white text-sm font-medium rounded-lg hover:bg-orange-600"
            >
              Próximo
            </button>
          ) : (
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-5 py-2 bg-orange-500 text-white text-sm font-medium rounded-lg hover:bg-orange-600 disabled:opacity-50"
            >
              {saving ? 'Salvando...' : isEdit ? 'Salvar alterações' : 'Criar template'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
