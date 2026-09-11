import { useQuery } from '@tanstack/react-query';
import { X } from 'lucide-react';
import { useEffect, type JSX } from 'react';

import { checklistItemFromRow, type ChecklistItemRow } from '../lib/checklistTemplateMappers';
import { supabase } from '../lib/supabase';
import { cn } from '../lib/utils';

import type { ChecklistTemplate, ChecklistItem } from '../types';

type ChecklistTemplateDetailModalProps = {
  template: ChecklistTemplate;
  onClose: () => void;
};

async function fetchChecklistTemplateItems(
  templateId: string,
  versionNumber: number,
): Promise<ChecklistItem[]> {
  const { data, error } = await supabase
    .from('checklist_items')
    .select('*')
    .eq('template_id', templateId)
    .eq('version_number', versionNumber)
    .order('order_number', { ascending: true });

  if (error) throw error;

  return ((data ?? []) as ChecklistItemRow[]).map((row) => checklistItemFromRow(row));
}

function TemplateMetadata({ template }: { template: ChecklistTemplate }): JSX.Element {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <span className="inline-flex items-center rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-800">
          Publicado
        </span>
        <span className="text-xs font-medium text-zinc-500">v{template.currentVersion}</span>
      </div>
      <div className="flex flex-wrap gap-2">
        <span className="inline-flex items-center rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-700">
          {template.vehicleCategory}
        </span>
        <span className="inline-flex items-center rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-700">
          {template.context}
        </span>
        {template.description && (
          <p className="w-full text-sm text-zinc-600">{template.description}</p>
        )}
      </div>
    </div>
  );
}

function TemplateItemCard({
  item,
  position,
}: {
  item: ChecklistItem;
  position: number;
}): JSX.Element {
  return (
    <div className="rounded-lg border border-zinc-100 bg-zinc-50 p-3">
      <div className="flex items-start gap-2">
        <span className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-orange-100 text-[10px] font-bold text-orange-700">
          {position}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-zinc-900">{item.title}</p>
          {item.description && <p className="mt-0.5 text-xs text-zinc-500">{item.description}</p>}
          <div className="mt-1.5 flex flex-wrap gap-1">
            <span
              className={cn(
                'inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium',
                item.isMandatory
                  ? 'bg-orange-100 text-orange-700'
                  : 'bg-zinc-100 text-zinc-600',
              )}
            >
              {item.isMandatory ? 'Obrigatório' : 'Opcional'}
            </span>
            {item.requirePhotoIfIssue && (
              <span className="inline-flex items-center rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-medium text-blue-700">
                Exigir foto se Problema
              </span>
            )}
            {item.canBlockVehicle && (
              <span className="inline-flex items-center rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-medium text-red-700">
                Bloqueia veículo se reprovado
              </span>
            )}
          </div>
          {item.defaultAction && (
            <p className="mt-1 text-xs text-zinc-500">
              <span className="font-medium text-zinc-700">Ação sugerida:</span> {item.defaultAction}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function ChecklistTemplateItemsState({
  context,
  isLoading,
  isError,
  items,
}: {
  context: string;
  isLoading: boolean;
  isError: boolean;
  items: ChecklistItem[];
}): JSX.Element {
  if (isLoading) {
    return <p className="text-sm text-zinc-500">Carregando estrutura do checklist...</p>;
  }

  if (isError) {
    return (
      <p className="text-sm text-red-600">
        Não foi possível carregar a estrutura do checklist. Tente fechar e abrir novamente.
      </p>
    );
  }

  if (items.length === 0) {
    if (context === 'Atualização de Hodômetro') {
      return (
        <p className="text-sm text-zinc-500">
          Este contexto registra apenas o KM atual do veículo e não possui itens de checklist.
        </p>
      );
    }
    return <p className="text-sm text-zinc-500">Nenhum item cadastrado nesta versão.</p>;
  }

  return (
    <div className="space-y-2">
      {items.map((item, idx) => (
        <TemplateItemCard key={item.id} item={item} position={idx + 1} />
      ))}
    </div>
  );
}

export default function ChecklistTemplateDetailModal(
  props: ChecklistTemplateDetailModalProps,
): JSX.Element {
  const { template, onClose } = props;

  const { data: items = [], isLoading, isError } = useQuery<ChecklistItem[]>({
    queryKey: ['checklistTemplateItems', template.id, template.currentVersion],
    queryFn: () => fetchChecklistTemplateItems(template.id, template.currentVersion),
    retry: false,
  });

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="checklist-template-detail-title"
        className="relative flex max-h-[90vh] w-full max-w-lg flex-col rounded-2xl bg-white shadow-xl"
      >
        <div className="flex flex-shrink-0 items-center justify-between border-b border-zinc-200 px-6 py-4">
          <h2 id="checklist-template-detail-title" className="text-base font-semibold text-zinc-900">
            Detalhes do Template
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="rounded-lg p-1 transition-colors hover:bg-zinc-100"
          >
            <X className="h-5 w-5 text-zinc-500" />
          </button>
        </div>

        <div className="flex-1 space-y-6 overflow-y-auto p-6">
          <div>
            <p className="text-sm font-semibold text-zinc-900">{template.name}</p>
            <div className="mt-2">
              <TemplateMetadata template={template} />
            </div>
          </div>

          <div>
            <h3 className="border-b border-zinc-100 pb-2 text-xs font-semibold tracking-wider text-zinc-400 uppercase">
              Itens do checklist ({items.length})
            </h3>
            <div className="mt-3">
              <ChecklistTemplateItemsState
                context={template.context}
                isLoading={isLoading}
                isError={isError}
                items={items}
              />
            </div>
          </div>
        </div>

        <div className="flex flex-shrink-0 justify-end border-t border-zinc-200 px-6 py-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}