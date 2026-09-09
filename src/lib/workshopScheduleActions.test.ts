import { describe, expect, it } from 'vitest';

import {
  buildScheduleConfirmMessage,
  isScheduleActionAvailable,
} from './workshopScheduleActions';

import type { WorkshopSchedule } from '../types';


const schedule = {
  id: 'sch-1',
  vehicleLicensePlate: 'TXS8A77',
  workshopName: 'VAMOS',
} as WorkshopSchedule;

const full = { canWriteSchedules: true, canDelete: true };
const writerOnly = { canWriteSchedules: true, canDelete: false };
const readOnly = { canWriteSchedules: false, canDelete: true };

describe('isScheduleActionAvailable', () => {
  it('sem permissão de escrita, nenhuma ação está disponível', () => {
    expect(isScheduleActionAvailable('edit', 'scheduled', readOnly)).toBe(false);
    expect(isScheduleActionAvailable('complete', 'scheduled', readOnly)).toBe(false);
    expect(isScheduleActionAvailable('cancel', 'scheduled', readOnly)).toBe(false);
    expect(isScheduleActionAvailable('generateMaintenance', 'scheduled', readOnly)).toBe(false);
    expect(isScheduleActionAvailable('delete', 'completed', readOnly)).toBe(false);
  });

  it('agendamento agendado libera editar, concluir, cancelar e gerar OS, e bloqueia excluir', () => {
    expect(isScheduleActionAvailable('edit', 'scheduled', full)).toBe(true);
    expect(isScheduleActionAvailable('complete', 'scheduled', full)).toBe(true);
    expect(isScheduleActionAvailable('cancel', 'scheduled', full)).toBe(true);
    expect(isScheduleActionAvailable('generateMaintenance', 'scheduled', full)).toBe(true);
    expect(isScheduleActionAvailable('delete', 'scheduled', full)).toBe(false);
  });

  it('agendamento concluído libera gerar OS e excluir, e bloqueia editar, concluir e cancelar', () => {
    expect(isScheduleActionAvailable('edit', 'completed', full)).toBe(false);
    expect(isScheduleActionAvailable('complete', 'completed', full)).toBe(false);
    expect(isScheduleActionAvailable('cancel', 'completed', full)).toBe(false);
    expect(isScheduleActionAvailable('generateMaintenance', 'completed', full)).toBe(true);
    expect(isScheduleActionAvailable('delete', 'completed', full)).toBe(true);
  });

  it('agendamento cancelado libera apenas excluir', () => {
    expect(isScheduleActionAvailable('edit', 'cancelled', full)).toBe(false);
    expect(isScheduleActionAvailable('complete', 'cancelled', full)).toBe(false);
    expect(isScheduleActionAvailable('cancel', 'cancelled', full)).toBe(false);
    expect(isScheduleActionAvailable('generateMaintenance', 'cancelled', full)).toBe(false);
    expect(isScheduleActionAvailable('delete', 'cancelled', full)).toBe(true);
  });

  it('quem pode escrever mas não pode excluir não recebe a ação de excluir', () => {
    expect(isScheduleActionAvailable('delete', 'completed', writerOnly)).toBe(false);
    expect(isScheduleActionAvailable('generateMaintenance', 'completed', writerOnly)).toBe(true);
  });
});

describe('buildScheduleConfirmMessage', () => {
  it('as mensagens de confirmação citam placa e oficina', () => {
    expect(buildScheduleConfirmMessage('complete', schedule)).toBe(
      'Marcar como concluído o agendamento do veículo TXS8A77 na oficina VAMOS?',
    );
    expect(buildScheduleConfirmMessage('cancel', schedule)).toBe(
      'Cancelar o agendamento do veículo TXS8A77 na oficina VAMOS? Esta ação não pode ser desfeita.',
    );
    expect(buildScheduleConfirmMessage('delete', schedule)).toBe(
      'Excluir o agendamento do veículo TXS8A77 na oficina VAMOS? Esta ação não pode ser desfeita.',
    );
  });

  it('agendamento sem placa ou sem oficina não quebra a mensagem', () => {
    const incomplete = {
      ...schedule,
      vehicleLicensePlate: undefined,
      workshopName: undefined,
    } as WorkshopSchedule;

    expect(buildScheduleConfirmMessage('delete', incomplete)).toBe(
      'Excluir o agendamento do veículo sem placa na oficina sem oficina? Esta ação não pode ser desfeita.',
    );
  });
});
