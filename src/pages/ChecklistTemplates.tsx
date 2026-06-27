import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Edit2, CheckCircle, XCircle, RefreshCw, Trash2, FileStack, Copy } from 'lucide-react';
import React, { useState, useMemo } from 'react';

import ChecklistTemplateForm from '../components/ChecklistTemplateForm';
import SelectClientNotice from '../components/SelectClientNotice';
import { useAuth } from '../context/AuthContext';
import { templateFromRow, type ChecklistTemplateRow } from '../lib/checklistTemplateMappers';
import { requiresClientSelection, showsAggregatedData } from '../lib/clientScope';
import { supabase } from '../lib/supabase';
import { cn } from '../lib/utils';

import type { ChecklistTemplate, TemplateCategory, TemplateStatus, ChecklistContext } from '../types';

type TemplateActionError = { code?: string; message?: string };
type ChecklistItemInsertCloneRow = Omit<Record<string, unknown>, 'id'> & { version_number: number };


const STATUS_LABEL: Record<TemplateStatus, string> = {
  draft: 'Rascunho',
  published: 'Publicado',
  deprecated: 'Descontinuado',
};

const STATUS_COLOR: Record<TemplateStatus, string> = {
  draft: 'bg-yellow-100 text-yellow-800',
  published: 'bg-green-100 text-green-800',
  deprecated: 'bg-zinc-100 text-zinc-600',
};

const CATEGORY_LABEL: Record<string, string> = {
  Leve: 'Leve',
  Médio: 'Médio',
  Pesado: 'Pesado',
  Elétrico: 'Elétrico',
};

export default function ChecklistTemplates() {
  const { user, currentClient, clients } = useAuth();
  const queryClient = useQueryClient();
  const blockWrite = requiresClientSelection(user?.role, currentClient?.id);
  const [filterCategory, setFilterCategory] = useState<TemplateCategory | 'Todos'>('Todos');
  const [filterContext, setFilterContext] = useState<ChecklistContext | 'Todos'>('Todos');

  const [showForm, setShowForm] = useState<boolean>(() =>
    sessionStorage.getItem('checklistTemplateFormOpen') === 'true'
  );
  const [editingTemplate, setEditingTemplate] = useState<ChecklistTemplate | null>(() => {
    const saved = sessionStorage.getItem('checklistTemplateFormEditing');
    return saved ? (JSON.parse(saved) as ChecklistTemplate) : null;
  });
  const [duplicatingTemplate, setDuplicatingTemplate] = useState<ChecklistTemplate | null>(null);

  // Sincronizar estado do formulário com sessionStorage
  React.useEffect(() => {
    sessionStorage.setItem('checklistTemplateFormOpen', String(showForm));
    sessionStorage.setItem('checklistTemplateFormEditing', JSON.stringify(editingTemplate));
  }, [showForm, editingTemplate]);

  const [confirmAction, setConfirmAction] = useState<{
    type: 'publish' | 'deprecate' | 'delete' | 'new-version';
    template: ChecklistTemplate;
  } | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const isManager = ['Manager', 'Coordinator', 'Director', 'Admin Master'].includes(user?.role ?? '');
  const isAdminMaster = user?.role === 'Admin Master';
  const canCreate = isManager && !blockWrite;

  const { data: templates = [], isLoading: loadingTemplates, isError: templatesError } = useQuery({
    queryKey: ['checklistTemplates', currentClient?.id ?? 'all-clients'],
    queryFn: async () => {
      let query = supabase
        .from('checklist_templates')
        .select('*')
        .order('created_at', { ascending: false });
      if (currentClient?.id) {
        query = query.eq('client_id', currentClient.id);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []).map(r => templateFromRow(r as ChecklistTemplateRow));
    },
    enabled: showsAggregatedData(user?.role, currentClient?.id)
  });

  const filtered = useMemo(() => {
    return templates.filter(t => {
      if (filterCategory !== 'Todos' && t.vehicleCategory !== filterCategory) return false;
      if (filterContext !== 'Todos' && t.context !== filterContext) return false;
      return true;
    });
  }, [templates, filterCategory, filterContext]);

  const templateActionMutation = useMutation({
    mutationFn: async ({ type, template: t }: { type: 'publish' | 'deprecate' | 'delete' | 'new-version'; template: ChecklistTemplate }) => {
      if (type === 'publish') {
        await supabase.from('checklist_template_versions').insert({
          template_id: t.id,
          version_number: t.currentVersion,
          published_by: user?.id ?? null,
        });
        const { error: updateError } = await supabase
          .from('checklist_templates')
          .update({ status: 'published', updated_at: new Date().toISOString() })
          .eq('id', t.id);

        if (updateError) {
          const isDuplicate = updateError.code === '23P01' || updateError.message.includes('unique_published_category');
          if (isDuplicate) {
            setActionError(`Já existe um template publicado para "${t.vehicleCategory} — ${t.context}". Descontinue-o antes de publicar este.`);
            throw updateError;
          }
          throw updateError;
        }
      } else if (type === 'deprecate') {
        const { error } = await supabase.from('checklist_templates').update({ status: 'deprecated', updated_at: new Date().toISOString() }).eq('id', t.id);
        if (error) throw error;
      } else if (type === 'new-version') {
        const newVersion = t.currentVersion + 1;
        const { error } = await supabase.from('checklist_templates').update({
          status: 'draft',
          current_version: newVersion,
          updated_at: new Date().toISOString(),
        }).eq('id', t.id);
        if (error) throw error;

        const { data: oldItems } = await supabase
          .from('checklist_items')
          .select('*')
          .eq('template_id', t.id)
          .eq('version_number', t.currentVersion);

        if (oldItems && oldItems.length > 0) {
          const sourceItems = oldItems as Array<Record<string, unknown>>;
          const rowsToInsert = sourceItems.map(({ id: _id, ...rest }) => ({
            ...rest,
            version_number: newVersion,
          })) as unknown as ChecklistItemInsertCloneRow[];
          await supabase.from('checklist_items').insert(rowsToInsert);
        }
      } else if (type === 'delete') {
        const { error } = await supabase.from('checklist_templates').delete().eq('id', t.id);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['checklistTemplates', currentClient?.id] });
      setConfirmAction(null);
    },
    onError: (err: TemplateActionError) => {
      console.error(err);
      if (err.code === '23503') {
        alert('Não é possível excluir este template pois existem relatórios/checklists preenchidos vinculados a ele.\n\nExclua primeiro o histórico de checklists deste modelo na aba Checklists.');
      } else if (!actionError) {
        alert('Erro ao executar ação: ' + (err.message || 'Erro desconhecido.'));
      }
    },
  });

  const executeConfirm = () => {
    if (!confirmAction) return;
    setActionError(null);
    templateActionMutation.mutate(confirmAction);
  };

  const CONFIRM_TEXTS: Record<string, { title: string; body: string; confirm: string; color: string }> = {
    publish: {
      title: 'Publicar template',
      body: 'Uma vez publicado, o template se torna imutável e ficará disponível para preenchimento. Para editar será necessário criar uma nova versão.',
      confirm: 'Publicar',
      color: 'bg-green-600 hover:bg-green-700',
    },
    deprecate: {
      title: 'Descontinuar template',
      body: 'O template será marcado como descontinuado e não ficará mais disponível para novos checklists. Checklists anteriores são preservados.',
      confirm: 'Descontinuar',
      color: 'bg-zinc-600 hover:bg-zinc-700',
    },
    'new-version': {
      title: 'Criar nova versão',
      body: 'O template atual será convertido para rascunho com uma nova versão. Os itens serão copiados e você poderá editá-los antes de publicar.',
      confirm: 'Criar nova versão',
      color: 'bg-blue-600 hover:bg-blue-700',
    },
    delete: {
      title: 'Excluir template',
      body: 'O template e todos os seus itens serão permanentemente excluídos. Esta ação não pode ser desfeita.',
      confirm: 'Excluir',
      color: 'bg-red-600 hover:bg-red-700',
    },
  };

  const clientNameMap = useMemo(() => {
    const map = new Map<string, string>();
    clients.forEach(c => map.set(c.id, c.name));
    return map;
  }, [clients]);

  return (
    <div className="flex h-full flex-col gap-6">
      {blockWrite && <SelectClientNotice />}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-zinc-900">
            <FileStack className="h-6 w-6 text-orange-500" />
            Templates de Checklist
          </h1>
          <p className="mt-1 text-sm text-zinc-500">Gerencie os modelos de inspeção da frota</p>
        </div>
        {canCreate && (
          <button
            onClick={() => { setEditingTemplate(null); setDuplicatingTemplate(null); setShowForm(true); }}
            className="flex items-center gap-2 rounded-lg bg-orange-500 px-4 py-2 text-sm font-medium text-white hover:bg-orange-600"
          >
            <Plus className="h-4 w-4" />
            Novo Template
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="space-y-2">
        <div className="flex flex-wrap gap-2">
          {(['Todos', 'Leve', 'Médio', 'Pesado', 'Elétrico'] as const).map(cat => (
            <button
              key={cat}
              onClick={() => setFilterCategory(cat)}
              className={cn(
                'rounded-full px-3 py-1.5 text-sm font-medium transition-colors',
                filterCategory === cat ? 'bg-orange-500 text-white' : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200',
              )}
            >
              {cat}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          {(['Todos', 'Rotina', 'Auditoria', 'Reboque', 'Entrada em Oficina', 'Saída de Oficina', 'Segurança'] as const).map(ctx => (
            <button
              key={ctx}
              onClick={() => setFilterContext(ctx)}
              className={cn(
                'rounded-full px-3 py-1.5 text-xs font-medium transition-colors',
                filterContext === ctx ? 'bg-zinc-700 text-white' : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200',
              )}
            >
              {ctx}
            </button>
          ))}
        </div>
      </div>

      {templatesError && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          Erro ao carregar templates de checklist. Tente novamente.
        </div>
      )}

      {/* Table */}
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-zinc-200 bg-white">
        {loadingTemplates ? (
          <div className="py-16 text-center text-sm text-zinc-400">Carregando templates...</div>
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center text-zinc-400">
            <FileStack className="mx-auto mb-3 h-12 w-12 opacity-30" />
            <p className="text-sm">Nenhum template encontrado.</p>
            {canCreate && (
              <button
                onClick={() => { setEditingTemplate(null); setDuplicatingTemplate(null); setShowForm(true); }}
                className="mt-4 text-sm text-orange-500 hover:underline"
              >
                Criar primeiro template
              </button>
            )}
          </div>
        ) : (
          <div className="flex-1 overflow-auto">
            <table className="min-w-full divide-y divide-zinc-100">
              <thead className="sticky top-0 z-10">
                <tr className="bg-zinc-50">
                  {[...(blockWrite ? ['Cliente'] : []), 'Nome', 'Contexto', 'Categoria', 'Status', 'Versão', 'Ações'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold tracking-wider text-zinc-500 uppercase">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-50">
                {filtered.map(t => (
                  <tr key={t.id} className="transition-colors hover:bg-zinc-50">
                    {blockWrite && (
                      <td className="px-4 py-3 text-sm text-zinc-600">
                        <span className="inline-flex items-center rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-700">
                          {t.clientId ? (clientNameMap.get(t.clientId) ?? '—') : '—'}
                        </span>
                      </td>
                    )}
                    <td className="px-4 py-3">
                      <div>
                        <p className="text-sm font-medium text-zinc-900">{t.name}</p>
                        {t.description && <p className="max-w-xs truncate text-xs text-zinc-400">{t.description}</p>}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-sm text-zinc-700">{t.context}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-sm text-zinc-700">{CATEGORY_LABEL[t.vehicleCategory] ?? t.vehicleCategory}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={cn('inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium', STATUS_COLOR[t.status])}>
                        {STATUS_LABEL[t.status]}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-zinc-600">v{t.currentVersion}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        {/* Edit (only draft) */}
                        {t.status === 'draft' && isManager && !blockWrite && (
                          <button
                            title="Editar"
                            onClick={() => { setEditingTemplate(t); setDuplicatingTemplate(null); setShowForm(true); }}
                            className="rounded p-1.5 text-zinc-500 hover:bg-zinc-100"
                          >
                            <Edit2 className="h-4 w-4" />
                          </button>
                        )}

                        {t.status === 'published' && isManager && !blockWrite && (
                          <button
                            title="Duplicar"
                            onClick={() => { setEditingTemplate(null); setDuplicatingTemplate(t); setShowForm(true); }}
                            className="rounded p-1.5 text-orange-600 hover:bg-orange-50"
                          >
                            <Copy className="h-4 w-4" />
                          </button>
                        )}

                        {/* Publish (draft → published) */}
                        {t.status === 'draft' && isManager && !blockWrite && (
                          <button
                            title="Publicar"
                            onClick={() => setConfirmAction({ type: 'publish', template: t })}
                            className="rounded p-1.5 text-green-600 hover:bg-green-50"
                          >
                            <CheckCircle className="h-4 w-4" />
                          </button>
                        )}

                        {/* New version (published → draft with v+1) */}
                        {t.status === 'published' && isManager && !blockWrite && (
                          <button
                            title="Nova versão"
                            onClick={() => setConfirmAction({ type: 'new-version', template: t })}
                            className="rounded p-1.5 text-blue-600 hover:bg-blue-50"
                          >
                            <RefreshCw className="h-4 w-4" />
                          </button>
                        )}

                        {/* Deprecate (published → deprecated) */}
                        {t.status === 'published' && isManager && !blockWrite && (
                          <button
                            title="Descontinuar"
                            onClick={() => setConfirmAction({ type: 'deprecate', template: t })}
                            className="rounded p-1.5 text-zinc-500 hover:bg-zinc-100"
                          >
                            <XCircle className="h-4 w-4" />
                          </button>
                        )}

                        {/* Delete */}
                        {((t.status === 'draft' && isManager && !blockWrite) || (isAdminMaster && !blockWrite)) && (
                          <button
                            title="Excluir"
                            onClick={() => setConfirmAction({ type: 'delete', template: t })}
                            className="rounded p-1.5 text-red-500 hover:bg-red-50"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Forms/Modals */}
      {showForm && (
        <ChecklistTemplateForm
          duplicateSource={duplicatingTemplate}
          template={editingTemplate}
          onClose={() => {
            setShowForm(false);
            setEditingTemplate(null);
            setDuplicatingTemplate(null);
            sessionStorage.removeItem('checklistTemplateFormOpen');
            sessionStorage.removeItem('checklistTemplateFormEditing');
          }}
          onSaved={() => {
            setShowForm(false);
            setEditingTemplate(null);
            setDuplicatingTemplate(null);
            sessionStorage.removeItem('checklistTemplateFormOpen');
            sessionStorage.removeItem('checklistTemplateFormEditing');
            void queryClient.invalidateQueries({ queryKey: ['checklistTemplates', currentClient?.id] });
          }}
        />
      )}

      {/* Confirm Dialog */}
      {confirmAction && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-sm space-y-4 rounded-2xl bg-white p-6 shadow-2xl">
            <h3 className="text-lg font-semibold text-zinc-900">{CONFIRM_TEXTS[confirmAction.type].title}</h3>
            <p className="text-sm text-zinc-600">{CONFIRM_TEXTS[confirmAction.type].body}</p>
            <p className="text-sm font-medium text-zinc-900">Template: <span className="text-orange-600">{confirmAction.template.name}</span></p>
            {actionError && (
              <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{actionError}</p>
            )}
            <div className="flex justify-end gap-3">
              <button
                onClick={() => { setConfirmAction(null); setActionError(null); }}
                className="px-4 py-2 text-sm text-zinc-600 hover:text-zinc-900"
                disabled={templateActionMutation.isPending}
              >
                Cancelar
              </button>
              {!actionError && (
                <button
                  onClick={executeConfirm}
                  disabled={templateActionMutation.isPending}
                  className={cn('rounded-lg px-4 py-2 text-sm font-medium text-white disabled:opacity-50', CONFIRM_TEXTS[confirmAction.type].color)}
                >
                  {templateActionMutation.isPending ? 'Aguarde...' : CONFIRM_TEXTS[confirmAction.type].confirm}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
