import { supabase } from './supabase';

/**
 * Auto-completa um agendamento de oficina quando um checklist
 * do contexto "Entrada em Oficina" é finalizado.
 *
 * Seleciona o agendamento "scheduled" mais próximo para o veículo+oficina
 * e marca como "completed", vinculando ao checklist.
 */
export async function autoCompleteWorkshopSchedule(
  vehicleId: string,
  workshopId: string,
  completedAt: string,
  checklistId: string,
): Promise<void> {
  const { data: matchingSchedule } = await supabase
    .from('workshop_schedules')
    .select('id')
    .eq('vehicle_id', vehicleId)
    .eq('workshop_id', workshopId)
    .eq('status', 'scheduled')
    .order('scheduled_date', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (matchingSchedule) {
    const { error } = await supabase
      .from('workshop_schedules')
      .update({
        status: 'completed',
        completed_at: completedAt,
        checklist_id: checklistId,
      })
      .eq('id', matchingSchedule.id);
    if (error) throw error;
  }
}

/**
 * Auto-transiciona uma ordem de serviço para 'Veículo retirado' quando um checklist
 * do contexto "Saída de Oficina" é finalizado.
 *
 * Seleciona a ordem mais recente em status 'Concluído' para o veículo+oficina
 * e marca como 'Veículo retirado', gravando a data de saída real.
 */
export async function autoRetireVehicleFromWorkshop(
  vehicleId: string,
  workshopId: string,
  _checklistId: string,
): Promise<void> {
  const { data: matchingOrder } = await supabase
    .from('maintenance_orders')
    .select('id')
    .eq('vehicle_id', vehicleId)
    .eq('workshop_id', workshopId)
    .eq('status', 'Concluído')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (matchingOrder) {
    const { error } = await supabase
      .from('maintenance_orders')
      .update({
        status: 'Veículo retirado',
        actual_exit_date: new Date().toISOString(),
      })
      .eq('id', matchingOrder.id);
    if (error) throw error;
  }
}
