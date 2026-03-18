import React, { useState, useMemo } from 'react';
import { Plus, Edit2, CheckCircle, XCircle, RefreshCw, Trash2, FileStack } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { templateFromRow, type ChecklistTemplateRow } from '../lib/checklistTemplateMappers';
import type { ChecklistTemplate, TemplateCategory, TemplateStatus, ChecklistContext } from '../types';
import ChecklistTemplateForm from '../components/ChecklistTemplateForm';
import { cn } from '../lib/utils';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

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
  const { user, currentClient } = useAuth();
  const queryClient = useQueryClient();
  const [filterCategory, setFilterCategory] = useState<TemplateCategory | 'Todos'>('Todos');
  const [filterContext, setFilterContext] = useState<ChecklistContext | 'Todos'>('Todos');

  const [showForm, setShowForm] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<ChecklistTemplate | null>(null);

  const [confirmAction, setConfirmAction] = useState<{
    type: 'publish' | 'deprecate' | 'delete' | 'new-version';
    template: ChecklistTemplate;
  } | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const isManager = ['Manager', 'Coordinator', 'Director', 'Admin Master'].includes(user?.role ?? '');
  const isAdminMaster = user?.role === 'Admin Master';
  const canCreate = isManager;

  const { data: templates = [], isLoading: loadingTemplates, isError: templatesError } = useQuery({
    queryKey: ['checklistTemplates', currentClient?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('checklist_templates')
        .select('*')
        .eq('client_id', currentClient.id)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return (data ?? []).map(r => templateFromRow(r as ChecklistTemplateRow));
    },
    enabled: !!currentClient?.id
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
            return; // Don't close modal — user sees error
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
          await supabase.from('checklist_items').insert(
            oldItems.map(({ id: _id, ...rest }: Record<string, unknown>) => ({ ...rest, version_number: newVersion })),
          );
        }
      } else if (type === 'delete') {
        const { error } = await supabase.from('checklist_templates').delete().eq('id', t.id);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['checklistTemplates', currentClient?.id] });
      setConfirmAction(null);
    },
    onError: (err: any) => {
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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900 flex items-center gap-2">
            <FileStack className="h-6 w-6 text-orange-500" />
            Templates de Checklist
          </h1>
          <p className="text-sm text-zinc-500 mt-1">Gerencie os modelos de inspeção da frota</p>
        </div>
        {canCreate && (
          <button
            onClick={() => { setEditingTemplate(null); setShowForm(true); }}
            className="flex items-center gap-2 px-4 py-2 bg-orange-500 text-white text-sm font-medium rounded-lg hover:bg-orange-600"
          >
            <Plus className="h-4 w-4" />
            Novo Template
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="space-y-2">
        <div className="flex gap-2 flex-wrap">
          {(['Todos', 'Leve', 'Médio', 'Pesado', 'Elétrico'] as const).map(cat => (
            <button
              key={cat}
              onClick={() => setFilterCategory(cat)}
              className={cn(
                'px-3 py-1.5 rounded-full text-sm font-medium transition-colors',
                filterCategory === cat ? 'bg-orange-500 text-white' : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200',
              )}
            >
              {cat}
            </button>
          ))}
        </div>
        <div className="flex gap-2 flex-wrap">
          {(['Todos', 'Rotina', 'Auditoria', 'Reboque', 'Entrada em Oficina', 'Saída de Oficina', 'Segurança'] as const).map(ctx => (
            <button
              key={ctx}
              onClick={() => setFilterContext(ctx)}
              className={cn(
                'px-3 py-1.5 rounded-full text-xs font-medium transition-colors',
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
      <div className="bg-white rounded-2xl border border-zinc-200 overflow-hidden">
        {loadingTemplates ? (
          <div className="text-center py-16 text-zinc-400 text-sm">Carregando templates...</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-zinc-400">
            <FileStack className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p className="text-sm">Nenhum template encontrado.</p>
            {canCreate && (
              <button
                onClick={() => { setEditingTemplate(null); setShowForm(true); }}
                className="mt-4 text-sm text-orange-500 hover:underline"
              >
                Criar primeiro template
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-zinc-100">
              <thead>
                <tr className="bg-zinc-50">
                  {['Nome', 'Contexto', 'Categoria', 'Status', 'Versão', 'Ações'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-zinc-500 uppercase tracking-wider">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-50">
                {filtered.map(t => (
                  <tr key={t.id} className="hover:bg-zinc-50 transition-colors">
                    <td className="px-4 py-3">
                      <div>
                        <p className="text-sm font-medium text-zinc-900">{t.name}</p>
                        {t.description && <p className="text-xs text-zinc-400 truncate max-w-xs">{t.description}</p>}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-sm text-zinc-700">{t.context}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-sm text-zinc-700">{CATEGORY_LABEL[t.vehicleCategory] ?? t.vehicleCategory}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={cn('inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium', STATUS_COLOR[t.status])}>
                        {STATUS_LABEL[t.status]}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-zinc-600">v{t.currentVersion}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        {/* Edit (only draft) */}
                        {t.status === 'draft' && isManager && (
                          <button
                            title="Editar"
                            onClick={() => { setEditingTemplate(t); setShowForm(true); }}
                            className="p-1.5 rounded hover:bg-zinc-100 text-zinc-500"
                          >
                            <Edit2 className="h-4 w-4" />
                          </button>
                        )}

                        {/* Publish (draft → published) */}
                        {t.status === 'draft' && isManager && (
                          <button
                            title="Publicar"
                            onClick={() => setConfirmAction({ type: 'publish', template: t })}
                            className="p-1.5 rounded hover:bg-green-50 text-green-600"
                          >
                            <CheckCircle className="h-4 w-4" />
                          </button>
                        )}

                        {/* New version (published → draft with v+1) */}
                        {t.status === 'published' && isManager && (
                          <button
                            title="Nova versão"
                            onClick={() => setConfirmAction({ type: 'new-version', template: t })}
                            className="p-1.5 rounded hover:bg-blue-50 text-blue-600"
                          >
                            <RefreshCw className="h-4 w-4" />
                          </button>
                        )}

                        {/* Deprecate (published → deprecated) */}
                        {t.status === 'published' && isManager && (
                          <button
                            title="Descontinuar"
                            onClick={() => setConfirmAction({ type: 'deprecate', template: t })}
                            className="p-1.5 rounded hover:bg-zinc-100 text-zinc-500"
                          >
                            <XCircle className="h-4 w-4" />
                          </button>
                        )}

                        {/* Delete */}
                        {((t.status === 'draft' && isManager) || isAdminMaster) && (
                          <button
                            title="Excluir"
                            onClick={() => setConfirmAction({ type: 'delete', template: t })}
                            className="p-1.5 rounded hover:bg-red-50 text-red-500"
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
          template={editingTemplate}
          onClose={() => setShowForm(false)}
          onSaved={() => { setShowForm(false); queryClient.invalidateQueries({ queryKey: ['checklistTemplates', currentClient?.id] }); }}
        />
      )}

      {/* Confirm Dialog */}
      {confirmAction && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6 space-y-4">
            <h3 className="text-lg font-semibold text-zinc-900">{CONFIRM_TEXTS[confirmAction.type].title}</h3>
            <p className="text-sm text-zinc-600">{CONFIRM_TEXTS[confirmAction.type].body}</p>
            <p className="text-sm font-medium text-zinc-900">Template: <span className="text-orange-600">{confirmAction.template.name}</span></p>
            {actionError && (
              <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{actionError}</p>
            )}
            <div className="flex gap-3 justify-end">
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
                  className={cn('px-4 py-2 text-sm font-medium text-white rounded-lg disabled:opacity-50', CONFIRM_TEXTS[confirmAction.type].color)}
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
