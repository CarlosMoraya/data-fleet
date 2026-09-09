import { describe, expect, it } from 'vitest';

import {
  formatScheduleDate,
  SCHEDULE_STATUS_BADGE_CLASS,
  SCHEDULE_STATUS_LABELS,
} from './workshopScheduleDisplay';

describe('formatScheduleDate', () => {
  it('formats 2026-09-16', () => {
    expect(formatScheduleDate('2026-09-16')).toBe('16/09/2026');
  });

  it('formats 2026-01-05', () => {
    expect(formatScheduleDate('2026-01-05')).toBe('05/01/2026');
  });

  it('returns dash for empty string', () => {
    expect(formatScheduleDate('')).toBe('-');
  });

  it('returns dash for undefined', () => {
    expect(formatScheduleDate(undefined)).toBe('-');
  });

  it('returns dash for null', () => {
    expect(formatScheduleDate(null)).toBe('-');
  });
});

describe('SCHEDULE_STATUS_LABELS', () => {
  it('scheduled → Agendado', () => {
    expect(SCHEDULE_STATUS_LABELS.scheduled).toBe('Agendado');
  });

  it('completed → Concluído', () => {
    expect(SCHEDULE_STATUS_LABELS.completed).toBe('Concluído');
  });

  it('cancelled → Cancelado', () => {
    expect(SCHEDULE_STATUS_LABELS.cancelled).toBe('Cancelado');
  });
});

describe('SCHEDULE_STATUS_BADGE_CLASS', () => {
  it('scheduled badge class', () => {
    expect(SCHEDULE_STATUS_BADGE_CLASS.scheduled).toBe('bg-blue-100 text-blue-700');
  });

  it('completed badge class', () => {
    expect(SCHEDULE_STATUS_BADGE_CLASS.completed).toBe('bg-green-100 text-green-700');
  });

  it('cancelled badge class', () => {
    expect(SCHEDULE_STATUS_BADGE_CLASS.cancelled).toBe('bg-zinc-100 text-zinc-500');
  });
});
