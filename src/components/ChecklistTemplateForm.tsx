import { X, Plus, Trash2, ChevronUp, ChevronDown, GripVertical, Lock, AlertTriangle } from 'lucide-react';
import React, { useState, useEffect, useCallback, useRef } from 'react';

import { useAuth } from '../context/AuthContext';
import {
  buildDuplicateName,
  mapItemRowsToDraftItems,
  resolveTemplateName,
} from '../lib/checklistTemplateImport';
import {
  templateFromRow,
  templateToRow,
  checklistItemToRow,
  checklistItemFromRow,
  suggestionFromRow,
  type SuggestionRow,
  type ChecklistItemRow,
  type ChecklistTemplateRow,
} from '../lib/checklistTemplateMappers';
import { canSaveTemplateWithoutItems } from '../lib/checklistTemplateRules';
import { supabase } from '../lib/supabase';
import { cn } from '../lib/utils';
import { ODOMETER_UPDATE_CONTEXT, type ChecklistTemplate, type ChecklistItemSuggestion, type TemplateCategory, type ChecklistContext } from '../types';

interface Props {
  duplicateSource?: ChecklistTemplate | null;
  template?: ChecklistTemplate | null;
  onClose: () => void;
  onSaved: () => void;
}

export interface DraftItem {
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
  { value: 'Semi-reboque/Implemento', label: 'Semi-reboque/Implemento' },
];

const CONTEXTS: { value: ChecklistContext; label: string; description: string }[] = [
  { value: 'Rotina', label: 'Rotina', description: 'Inspeção rotineira do veículo' },
  { value: 'Auditoria', label: 'Auditoria', description: 'Realizado por Auditores de Pátio' },
  { value: 'Guincho', label: 'Guincho', description: 'Inspeção de veículo sendo guinchado até a oficina' },
  { value: 'Entrada em Oficina', label: 'Entrada em Oficina', description: 'Registro ao enviar veículo para manutenção' },
  { value: 'Saída de Oficina', label: 'Saída de Oficina', description: 'Conferência ao receber veículo da manutenção' },
  { value: 'Segurança', label: 'Segurança', description: 'Itens críticos de segurança (pode bloquear veículo)' },
  { value: 'Atualização de Hodômetro', label: 'Atualização de Hodômetro', description: 'Registro rápido apenas do KM atual do veículo.' },
];

export default function ChecklistTemplateForm({ template, duplicateSource, onClose, onSaved }: Props) {
  const { user, currentClient } = useAuth();
  const isEdit = !!template;
  const isDuplicate = !isEdit && !!duplicateSource;
  const canEditName = !isEdit || template?.status === 'draft';
  const initializedDuplicateIdRef = useRef<string | null>(null);

  // Step 1: Metadata
  const [name, setName] = useState(isDuplicate ? buildDuplicateName(duplicateSource.name) : template?.name ?? '');
  const [description, setDescription] = useState(template?.description ?? duplicateSource?.description ?? '');
  const [category, setCategory] = useState<TemplateCategory>(template?.vehicleCategory ?? duplicateSource?.vehicleCategory ?? 'Leve');
  const [context, setContext] = useState<ChecklistContext>(template?.context ?? duplicateSource?.context ?? 'Rotina');

  // Step 2: Items
  const [items, setItems] = useState<DraftItem[]>([]);
  const [suggestions, setSuggestions] = useState<ChecklistItemSuggestion[]>([]);
  const [itemSource, setItemSource] = useState<'suggestions' | 'imported'>('suggestions');
  const [importTemplates, setImportTemplates] = useState<ChecklistTemplate[]>([]);
  const [selectedImportId, setSelectedImportId] = useState('');
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);

  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const isSecurityContext = context === 'Segurança';
  const isOdometerContext = context === ODOMETER_UPDATE_CONTEXT;

  const loadSuggestions = useCallback(async (cat: TemplateCategory) => {
    setLoadingSuggestions(true);
    const { data } = await supabase
      .from('checklist_item_suggestions')
      .select('*')
      .eq('vehicle_category', cat)
      .order('order_number');
    const nextSuggestions = (data ?? []).map(r => suggestionFromRow(r as SuggestionRow));
    setSuggestions(nextSuggestions);
    setLoadingSuggestions(false);
    return nextSuggestions;
  }, []);

  const buildSuggestionItems = useCallback((sourceSuggestions: ChecklistItemSuggestion[]) => {
    return sourceSuggestions.map((s, idx) => ({
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
  }, []);

  useEffect(() => {
    if (!isEdit) {
      void loadSuggestions(category);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (isEdit || !currentClient?.id) return;
    void (async () => {
      const { data, error: importError } = await supabase
        .from('checklist_templates')
        .select('id, name, vehicle_category, context, current_version, status')
        .eq('client_id', currentClient.id)
        .order('created_at', { ascending: false });
      if (importError) {
        console.error('Erro ao carregar templates para importação:', importError);
        setImportTemplates([]);
        return;
      }
      setImportTemplates(((data ?? []) as ChecklistTemplateRow[]).map(row => templateFromRow({
        ...row,
        client_id: currentClient.id,
        description: null,
        created_by: null,
        created_at: '',
        updated_at: '',
      })));
    })();
  }, [currentClient?.id, isEdit]);

  useEffect(() => {
    if (!isEdit || !template) return;
    void (async () => {
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

  useEffect(() => {
    if (!isDuplicate || !duplicateSource) return;
    if (initializedDuplicateIdRef.current === duplicateSource.id) return;
    initializedDuplicateIdRef.current = duplicateSource.id;
    setName(buildDuplicateName(duplicateSource.name));
    setDescription(duplicateSource.description ?? '');
    setCategory(duplicateSource.vehicleCategory);
    setContext(duplicateSource.context);
  }, [duplicateSource, isDuplicate]);

  useEffect(() => {
    if (!isDuplicate || !duplicateSource) return;
    void (async () => {
      const { data, error: duplicateError } = await supabase
        .from('checklist_items')
        .select('*')
        .eq('template_id', duplicateSource.id)
        .eq('version_number', duplicateSource.currentVersion)
        .order('order_number');
      if (duplicateError) {
        setError('Não foi possível carregar os itens do template para duplicar.');
        return;
      }
      setItems(mapItemRowsToDraftItems((data ?? []) as ChecklistItemRow[]));
    })();
  }, [duplicateSource, isDuplicate]);

  const handleCategoryChange = async (newCat: TemplateCategory) => {
    setCategory(newCat);
    if (isEdit) return;
    await loadSuggestions(newCat);
    setItems([]);
  };

  const buildItemsFromSuggestions = () => {
    if (isEdit) return;
    if (isOdometerContext) return;
    if (itemSource !== 'suggestions') return;
    if (items.length > 0) return;
    setItems(buildSuggestionItems(suggestions));
  };

  const handleImportFromTemplate = async (selectedId: string): Promise<void> => {
    setSelectedImportId(selectedId);
    if (!selectedId) return;
    const selectedTemplate = importTemplates.find(item => item.id === selectedId);
    if (!selectedTemplate) return;
    const { data, error: importError } = await supabase
      .from('checklist_items')
      .select('*')
      .eq('template_id', selectedId)
      .eq('version_number', selectedTemplate.currentVersion)
      .order('order_number');
    if (importError) {
      setError('Não foi possível importar os itens do template selecionado. Tente novamente.');
      return;
    }
    setError('');
    setItems(mapItemRowsToDraftItems((data ?? []) as ChecklistItemRow[]));
  };

  const handleItemSourceChange = async (source: 'suggestions' | 'imported') => {
    setError('');
    setItemSource(source);
    if (source === 'suggestions') {
      const nextSuggestions = await loadSuggestions(category);
      setItems([]);
      setItems(buildSuggestionItems(nextSuggestions));
      return;
    }
    if (selectedImportId) {
      await handleImportFromTemplate(selectedImportId);
      return;
    }
    setItems([]);
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
    if (!isEdit && !canSaveTemplateWithoutItems(context) && enabledItems.length === 0) { setError('Adicione pelo menos um item ao checklist.'); return; }

    setSaving(true);
    try {
      if (isEdit && template) {
        const { error: upErr } = await supabase
          .from('checklist_templates')
          .update({
            ...templateToRow({
              ...(template.status === 'draft' ? { name: resolveTemplateName(name, category, context) } : {}),
              description: description || undefined,
            }),
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
        const response = await supabase
          .from('checklist_templates')
          .insert({
            client_id: currentClient.id,
            vehicle_category: category,
            context,
            name: resolveTemplateName(name, category, context),
            description: description.trim() || null,
            current_version: 1,
            status: 'draft',
            created_by: user?.id ?? null,
          })
          .select()
          .single();
        const newTemplateData = response.data as { id: string } | null;
        const tplErr = response.error;
        if (tplErr) throw tplErr;
        if (!newTemplateData) throw new Error('Template não retornado após criação.');
        const newTemplate = newTemplateData;

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
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/60 p-4">
      <div className="relative my-4 w-full max-w-2xl rounded-2xl bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b px-6 py-4">
          <div>
            <h2 className="text-lg font-semibold text-zinc-900">
              {isEdit ? 'Editar Template' : 'Novo Template de Checklist'}
            </h2>
            <p className="text-sm text-zinc-500">Passo {step} de 2</p>
          </div>
          <button onClick={onClose} className="rounded-lg p-2 hover:bg-zinc-100">
            <X className="h-5 w-5 text-zinc-500" />
          </button>
        </div>

        {/* Step indicator */}
        <div className="flex gap-2 px-6 pt-4">
          {['Metadados', 'Itens'].map((label, i) => (
            <div key={label} className="flex flex-1 items-center gap-2">
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
                  'flex h-7 w-7 items-center justify-center rounded-full text-sm font-medium transition-colors',
                  step === i + 1 ? 'bg-orange-500 text-white' : step > i + 1 ? 'bg-green-500 text-white' : 'bg-zinc-200 text-zinc-500',
                )}
              >
                {i + 1}
              </button>
              <span className={cn('text-sm', step === i + 1 ? 'font-medium text-zinc-900' : 'text-zinc-400')}>{label}</span>
              {i < 1 && <div className="mx-1 h-px flex-1 bg-zinc-200" />}
            </div>
          ))}
        </div>

        <div className="space-y-4 px-6 py-4">
          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
          )}

          {/* ── Step 1: Metadata ─────────────────────────────────────────────── */}
          {step === 1 && (
            <div className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-zinc-700">Categoria</label>
                <div className="grid grid-cols-2 gap-2">
                  {CATEGORIES.map(cat => (
                    <label
                      key={cat.value}
                      className={cn(
                        'flex cursor-pointer items-center gap-3 rounded-lg border px-4 py-3 transition-colors',
                        category === cat.value ? 'border-orange-400 bg-orange-50' : 'border-zinc-200 hover:border-zinc-300',
                        isEdit && 'cursor-not-allowed opacity-60',
                      )}
                    >
                      <input
                        type="radio"
                        name="category"
                        value={cat.value}
                        checked={category === cat.value}
                        onChange={() => { if (!isEdit) { void handleCategoryChange(cat.value); } }}
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
                <label className="mb-1 block text-sm font-medium text-zinc-700">Contexto</label>
                <div className="grid grid-cols-1 gap-2">
                  {CONTEXTS.map(ctx => (
                    <label
                      key={ctx.value}
                      className={cn(
                        'flex cursor-pointer items-start gap-3 rounded-lg border px-4 py-3 transition-colors',
                        context === ctx.value ? 'border-orange-400 bg-orange-50' : 'border-zinc-200 hover:border-zinc-300',
                        isEdit && 'cursor-not-allowed opacity-60',
                      )}
                    >
                      <input
                        type="radio"
                        name="context"
                        value={ctx.value}
                        checked={context === ctx.value}
                        onChange={() => !isEdit && setContext(ctx.value)}
                        disabled={isEdit}
                        className="mt-0.5 accent-orange-500"
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

              {canEditName && (
                <div>
                  <label className="mb-1 block text-sm font-medium text-zinc-700">Nome do template (opcional)</label>
                  <input
                    type="text"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    placeholder={`Checklist ${category} ${context}`}
                    className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:ring-2 focus:ring-orange-400 focus:outline-none"
                  />
                </div>
              )}

              <div>
                <label className="mb-1 block text-sm font-medium text-zinc-700">Descrição (opcional)</label>
                <textarea
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  rows={2}
                  placeholder="Descreva o objetivo deste checklist..."
                  className="w-full resize-none rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:ring-2 focus:ring-orange-400 focus:outline-none"
                />
              </div>
            </div>
          )}

          {/* ── Step 2: Items ─────────────────────────────────────────────────── */}
          {step === 2 && (
            <div className="space-y-3">
              {!isEdit && !isOdometerContext && (
                <div className="space-y-3 rounded-lg border border-zinc-200 bg-zinc-50 p-3">
                  <div>
                    <p className="text-sm font-medium text-zinc-900">Origem dos itens</p>
                    <p className="text-xs text-zinc-500">Escolha entre sugestões padrão da categoria ou importar os itens de um template existente.</p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => void handleItemSourceChange('suggestions')}
                      className={cn(
                        'rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                        itemSource === 'suggestions' ? 'bg-orange-500 text-white' : 'bg-white text-zinc-600 hover:bg-zinc-100',
                      )}
                    >
                      Sugestões padrão
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleItemSourceChange('imported')}
                      className={cn(
                        'rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                        itemSource === 'imported' ? 'bg-orange-500 text-white' : 'bg-white text-zinc-600 hover:bg-zinc-100',
                      )}
                    >
                      Importar de template existente
                    </button>
                  </div>

                  {itemSource === 'imported' && (
                    <select
                      value={selectedImportId}
                      onChange={e => void handleImportFromTemplate(e.target.value)}
                      className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm focus:ring-2 focus:ring-orange-400 focus:outline-none"
                    >
                      <option value="">Selecione um template para importar</option>
                      {importTemplates.map(importTemplate => (
                        <option key={importTemplate.id} value={importTemplate.id}>
                          {`${importTemplate.name} — ${importTemplate.vehicleCategory} / ${importTemplate.context}`}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              )}

              {isSecurityContext && (
                <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                  <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" />
                  <span>Template de <strong>Segurança</strong>: ative &quot;Bloqueia veículo&quot; nos itens críticos. Quando implementado, veículos serão alertados visualmente.</span>
                </div>
              )}

              {isOdometerContext && (
                <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                  <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" />
                  <span>Este contexto coleta apenas o KM atual do veículo. A foto do hodômetro é exigida somente quando a leitura excede a tolerância configurada. Não é necessário cadastrar perguntas.</span>
                </div>
              )}

              {!isOdometerContext && loadingSuggestions && (
                <div className="py-8 text-center text-sm text-zinc-400">Carregando sugestões...</div>
              )}

              {!isOdometerContext && !loadingSuggestions && items.length === 0 && (
                <div className="py-8 text-center text-sm text-zinc-400">Nenhuma sugestão encontrada para esta categoria.</div>
              )}

              {!isOdometerContext && items.map((item, idx) => {
                const isLocked = item.fromSuggestion && item.isMandatory;
                return (
                  <div
                    key={idx}
                    className={cn(
                      'space-y-2 rounded-lg border p-3',
                      item.enabled === false ? 'border-zinc-200 bg-zinc-50 opacity-60' : 'border-zinc-200',
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <GripVertical className="h-4 w-4 flex-shrink-0 text-zinc-300" />

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
                              'ml-0.5 block h-4 w-4 rounded-full bg-white shadow transition-transform',
                              item.enabled ? 'translate-x-4' : 'translate-x-0',
                            )}
                          />
                        </button>
                      )}

                      {isLocked && (
                        <span title="Item obrigatório do sistema">
                          <Lock className="h-4 w-4 flex-shrink-0 text-zinc-400" />
                        </span>
                      )}

                      <input
                        type="text"
                        value={item.title}
                        onChange={e => updateItem(idx, { title: e.target.value })}
                        disabled={!!isLocked}
                        placeholder="Título do item *"
                        className="flex-1 rounded-md border border-zinc-300 px-2 py-1.5 text-sm focus:ring-2 focus:ring-orange-400 focus:outline-none disabled:bg-zinc-50 disabled:text-zinc-400"
                      />

                      {item.canBlockVehicle && (
                        <span className="flex-shrink-0 rounded-full bg-red-100 px-1.5 py-0.5 text-xs font-medium text-red-700">⚠ Bloqueio</span>
                      )}

                      <div className="flex gap-1">
                        <button type="button" onClick={() => moveItem(idx, -1)} disabled={idx === 0} className="rounded p-1 hover:bg-zinc-100 disabled:opacity-30">
                          <ChevronUp className="h-4 w-4" />
                        </button>
                        <button type="button" onClick={() => moveItem(idx, 1)} disabled={idx === items.length - 1} className="rounded p-1 hover:bg-zinc-100 disabled:opacity-30">
                          <ChevronDown className="h-4 w-4" />
                        </button>
                        {!isLocked && (
                          <button type="button" onClick={() => removeItem(idx)} className="rounded p-1 text-red-500 hover:bg-red-50">
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </div>

                    {item.enabled !== false && (
                      <div className="space-y-2 pl-8">
                        <input
                          type="text"
                          value={item.description}
                          onChange={e => updateItem(idx, { description: e.target.value })}
                          placeholder="Descrição (opcional)"
                          className="w-full rounded-md border border-zinc-300 px-2 py-1.5 text-sm focus:ring-2 focus:ring-orange-400 focus:outline-none"
                        />
                        <input
                          type="text"
                          value={item.defaultAction}
                          onChange={e => updateItem(idx, { defaultAction: e.target.value })}
                          placeholder="Ação sugerida se não conforme (opcional)"
                          className="w-full rounded-md border border-zinc-300 px-2 py-1.5 text-sm focus:ring-2 focus:ring-orange-400 focus:outline-none"
                        />

                        <div className="flex flex-wrap gap-4">
                          <label className="flex cursor-pointer items-center gap-2 text-sm">
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

                          <label className="flex cursor-pointer items-center gap-2 text-sm">
                            <input
                              type="checkbox"
                              checked={item.requirePhotoIfIssue}
                              onChange={e => updateItem(idx, { requirePhotoIfIssue: e.target.checked })}
                              className="accent-orange-500"
                            />
                            <span className="text-zinc-700">Exigir foto se Problema</span>
                          </label>

                          {isSecurityContext && (
                            <label className="flex cursor-pointer items-center gap-2 text-sm">
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

              {!isOdometerContext && (
                <button
                  type="button"
                  onClick={addItem}
                  className="flex w-full items-center justify-center gap-2 rounded-lg border-2 border-dashed border-zinc-300 py-3 text-sm text-zinc-500 transition-colors hover:border-orange-400 hover:text-orange-500"
                >
                  <Plus className="h-4 w-4" />
                  Adicionar item
                </button>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between rounded-b-2xl border-t bg-zinc-50 px-6 py-4">
          <button
            onClick={() => step > 1 ? setStep(step - 1) : onClose()}
            className="px-4 py-2 text-sm font-medium text-zinc-600 hover:text-zinc-900"
          >
            {step > 1 ? 'Voltar' : 'Cancelar'}
          </button>

          {step < 2 ? (
            <button
              onClick={goToStep2}
              className="rounded-lg bg-orange-500 px-5 py-2 text-sm font-medium text-white hover:bg-orange-600"
            >
              Próximo
            </button>
          ) : (
            <button
              onClick={() => { void handleSave(); }}
              disabled={saving}
              className="rounded-lg bg-orange-500 px-5 py-2 text-sm font-medium text-white hover:bg-orange-600 disabled:opacity-50"
            >
              {saving ? 'Salvando...' : isEdit ? 'Salvar alterações' : 'Criar template'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
