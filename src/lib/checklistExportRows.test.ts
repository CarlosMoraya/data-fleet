import { describe, expect, it } from 'vitest';

import {
  buildChecklistSheetCells,
  buildChecklistSheetHeaders,
  buildIssueSheetCells,
  buildIssueSheetHeaders,
  flattenChecklistIssueRows,
  type ChecklistExportRow,
} from './checklistExportRows';

function baseRow(overrides: Partial<ChecklistExportRow> = {}): ChecklistExportRow {
  return {
    clientDisplayName: 'Transportadora Alfa',
    templateName: 'Checklist Diário',
    templateContext: 'Rotina',
    licensePlate: 'ABC1D23',
    shipperName: 'MERCADO LIVRE',
    operationalUnitName: 'SRJ10',
    vehicleDriverName: 'Motorista do Veículo',
    filledByName: 'Responsável pelo Checklist',
    startedAt: '2026-08-20T10:30:00Z',
    statusLabel: 'Concluído',
    lastKmText: '123.456',
    actionPlanLabel: 'Plano de ação em andamento',
    locationDeniedLabel: '',
    vehicleLinkDivergenceLabel: '',
    issues: [],
    ...overrides,
  };
}

describe('checklistExportRows', () => {
  it('cabeçalhos e células da aba Checklists têm o mesmo comprimento', () => {
    for (const includeClientColumn of [true, false]) {
      expect(buildChecklistSheetCells(baseRow(), includeClientColumn)).toHaveLength(
        buildChecklistSheetHeaders(includeClientColumn).length,
      );
    }
  });

  it('cabeçalhos e células da aba Inconformidades têm o mesmo comprimento', () => {
    const issueRow = flattenChecklistIssueRows([
      baseRow({ issues: [{ itemTitle: 'Freio', observation: 'Desgaste', photoUrl: 'https://foto' }] }),
    ])[0];

    for (const includeClientColumn of [true, false]) {
      expect(buildIssueSheetCells(issueRow, includeClientColumn)).toHaveLength(
        buildIssueSheetHeaders(includeClientColumn).length,
      );
    }
  });

  it('a coluna Cliente só aparece quando includeClientColumn é true', () => {
    expect(buildChecklistSheetHeaders(true)[0]).toBe('Cliente');
    expect(buildChecklistSheetCells(baseRow(), true)[0]).toBe('Transportadora Alfa');
    expect(buildChecklistSheetHeaders(false)).not.toContain('Cliente');
    expect(buildIssueSheetHeaders(false)).not.toContain('Cliente');
  });

  it('Qtd. inconformidades reflete o número de issues', () => {
    const countIndex = buildChecklistSheetHeaders(false).indexOf('Qtd. inconformidades');
    const issues = Array.from({ length: 3 }, (_, index) => ({
      itemTitle: `Item ${index + 1}`,
      observation: '',
      photoUrl: '',
    }));

    expect(buildChecklistSheetCells(baseRow({ issues }), false)[countIndex]).toBe('3');
    expect(buildChecklistSheetCells(baseRow(), false)[countIndex]).toBe('0');
  });

  it('flattenChecklistIssueRows gera uma linha por inconformidade', () => {
    const rows = [
      baseRow({
        licensePlate: 'ABC1D23',
        issues: Array.from({ length: 3 }, (_, index) => ({
          itemTitle: `Item ${index + 1}`,
          observation: '',
          photoUrl: '',
        })),
      }),
      baseRow({ licensePlate: 'XYZ9A87', issues: [] }),
    ];

    const flattened = flattenChecklistIssueRows(rows);

    expect(flattened).toHaveLength(3);
    expect(flattened.every((row) => row.licensePlate === 'ABC1D23')).toBe(true);
  });

  it('checklist sem inconformidade não aparece na aba Inconformidades', () => {
    expect(flattenChecklistIssueRows([baseRow({ issues: [] })])).toEqual([]);
  });

  it('inconformidade sem foto produz célula vazia, não a string undefined', () => {
    const issueRow = flattenChecklistIssueRows([
      baseRow({ issues: [{ itemTitle: 'Freio', observation: 'Desgaste', photoUrl: '' }] }),
    ])[0];
    const photoIndex = buildIssueSheetHeaders(false).indexOf('Foto (link)');

    expect(buildIssueSheetCells(issueRow, false)[photoIndex]).toBe('');
  });

  it('os dados do checklist se repetem em todas as linhas da mesma inconformidade', () => {
    const issueRows = flattenChecklistIssueRows([
      baseRow({
        issues: Array.from({ length: 3 }, (_, index) => ({
          itemTitle: `Item ${index + 1}`,
          observation: '',
          photoUrl: '',
        })),
      }),
    ]);

    expect(issueRows.map((row) => row.licensePlate)).toEqual(['ABC1D23', 'ABC1D23', 'ABC1D23']);
    expect(issueRows.map((row) => row.shipperName)).toEqual([
      'MERCADO LIVRE',
      'MERCADO LIVRE',
      'MERCADO LIVRE',
    ]);
    expect(issueRows.map((row) => row.startedAt)).toEqual([
      '2026-08-20T10:30:00Z',
      '2026-08-20T10:30:00Z',
      '2026-08-20T10:30:00Z',
    ]);
    expect(issueRows.map((row) => row.issue.itemTitle)).toEqual(['Item 1', 'Item 2', 'Item 3']);
  });
});
