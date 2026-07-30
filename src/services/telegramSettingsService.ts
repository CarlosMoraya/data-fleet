import { invokeEdgeFunction } from '../lib/invokeEdgeFn';
import {
  telegramSettingsFromRow,
  telegramSettingsToRow,
  type ClientTelegramSettingsRow,
} from '../lib/fleetTicketMappers';
import { supabase } from '../lib/supabase';

import type { ClientTelegramSettings } from '../types/fleetTicket';

export async function getTelegramSettings(clientId: string): Promise<ClientTelegramSettings> {
  const { data, error } = await supabase
    .from('client_telegram_settings')
    .select('*')
    .eq('client_id', clientId)
    .maybeSingle();
  if (error) throw error;
  return telegramSettingsFromRow(data as ClientTelegramSettingsRow | null, clientId);
}

export async function saveTelegramSettings(
  settings: ClientTelegramSettings,
  userId: string,
): Promise<ClientTelegramSettings> {
  const chatId = settings.chatId.trim();
  if (settings.enabled && !chatId) {
    throw new Error('Informe o chat_id para ativar as notificações Telegram.');
  }

  const row = telegramSettingsToRow({ ...settings, chatId }, userId);
  const { data, error } = await supabase
    .from('client_telegram_settings')
    .upsert(row)
    .select('*')
    .single();
  if (error) throw error;
  return telegramSettingsFromRow(data as ClientTelegramSettingsRow, settings.clientId);
}

export async function sendTelegramTestMessage(clientId: string): Promise<void> {
  await invokeEdgeFunction('notify-fleet-ticket-telegram', { action: 'test', clientId });
}
