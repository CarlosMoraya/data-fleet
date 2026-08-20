import { describe, expect, it } from 'vitest';

import { buildAdherenceSubLabels } from './ChecklistAdherencePanel';

describe('buildAdherenceSubLabels', () => {
  it('converte fatias em mapa de nome para percentual formatado', () => {
    expect(buildAdherenceSubLabels([
      { name: 'SRJ10', value: 12, adherenceRate: 75 },
    ])).toEqual({ SRJ10: '75%' });
  });

  it('array vazio produz mapa vazio', () => {
    expect(buildAdherenceSubLabels([])).toEqual({});
  });

  it('aderência zero é formatada como 0%, não omitida', () => {
    expect(buildAdherenceSubLabels([
      { name: 'X', value: 2, adherenceRate: 0 },
    ])).toEqual({ X: '0%' });
  });
});
