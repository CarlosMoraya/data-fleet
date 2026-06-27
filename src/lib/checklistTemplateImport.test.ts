import { describe, expect, it } from 'vitest';

import { buildDuplicateName, mapItemRowsToDraftItems, resolveTemplateName } from './checklistTemplateImport';

import type { ChecklistItemRow } from './checklistTemplateMappers';

const baseRow = (overrides: Partial<ChecklistItemRow>): ChecklistItemRow => ({
  id: 'row-id',
  template_id: 'template-id',
  version_number: 1,
  title: 'Item',
  description: 'Desc',
  is_mandatory: true,
  require_photo_if_issue: false,
  can_block_vehicle: false,
  default_action: 'Ação',
  order_number: 0,
  ...overrides,
});

describe('mapItemRowsToDraftItems', () => {
  it('orders by order_number and reindexes drafts as editable copies', () => {
    const rows: ChecklistItemRow[] = [
      baseRow({ id: '3', title: 'Third', order_number: 2 }),
      baseRow({ id: '1', title: 'First', order_number: 0, default_action: null }),
      baseRow({ id: '2', title: 'Second', order_number: 1, description: null }),
    ];

    const result = mapItemRowsToDraftItems(rows);

    expect(result).toEqual([
      {
        title: 'First',
        description: 'Desc',
        isMandatory: true,
        requirePhotoIfIssue: false,
        canBlockVehicle: false,
        defaultAction: '',
        orderNumber: 0,
        enabled: true,
      },
      {
        title: 'Second',
        description: '',
        isMandatory: true,
        requirePhotoIfIssue: false,
        canBlockVehicle: false,
        defaultAction: 'Ação',
        orderNumber: 1,
        enabled: true,
      },
      {
        title: 'Third',
        description: 'Desc',
        isMandatory: true,
        requirePhotoIfIssue: false,
        canBlockVehicle: false,
        defaultAction: 'Ação',
        orderNumber: 2,
        enabled: true,
      },
    ]);
    expect(result.every(item => !('id' in item))).toBe(true);
    expect(result.every(item => !('fromSuggestion' in item))).toBe(true);
  });

  it('returns independent copies', () => {
    const rows = [baseRow({ title: 'Original' })];

    const result = mapItemRowsToDraftItems(rows);
    result[0].title = 'Changed';

    expect(rows[0].title).toBe('Original');
  });

  it('returns empty array for empty input', () => {
    expect(mapItemRowsToDraftItems([])).toEqual([]);
  });
});

describe('buildDuplicateName', () => {
  it('prefixes the trimmed original name', () => {
    expect(buildDuplicateName('  Checklist Leve Rotina  ')).toBe('Cópia de Checklist Leve Rotina');
  });
});

describe('resolveTemplateName', () => {
  it('prefers typed name when present', () => {
    expect(resolveTemplateName('  Meu template  ', 'Leve', 'Rotina')).toBe('Meu template');
  });

  it('falls back to automatic name when typed name is blank', () => {
    expect(resolveTemplateName('   ', 'Pesado', 'Segurança')).toBe('Checklist Pesado Segurança');
  });
});
