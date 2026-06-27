import { checklistItemFromRow, type ChecklistItemRow } from './checklistTemplateMappers';

import type { DraftItem } from '../components/ChecklistTemplateForm';
import type { ChecklistContext, TemplateCategory } from '../types';

export function mapItemRowsToDraftItems(rows: ChecklistItemRow[]): DraftItem[] {
  return [...rows]
    .sort((a, b) => a.order_number - b.order_number)
    .map((row, index) => {
      const item = checklistItemFromRow(row);
      return {
        title: item.title,
        description: item.description ?? '',
        isMandatory: item.isMandatory,
        requirePhotoIfIssue: item.requirePhotoIfIssue,
        canBlockVehicle: item.canBlockVehicle ?? false,
        defaultAction: item.defaultAction ?? '',
        orderNumber: index,
        enabled: true,
      };
    });
}

export function buildDuplicateName(originalName: string): string {
  return `Cópia de ${originalName.trim()}`;
}

export function resolveTemplateName(typedName: string, category: TemplateCategory, context: ChecklistContext): string {
  return typedName.trim() || `Checklist ${category} ${context}`;
}
