import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Bell, Loader2, Send } from 'lucide-react';
import React, { useEffect, useState } from 'react';

import { getTelegramSettings, saveTelegramSettings, sendTelegramTestMessage } from '../services/telegramSettingsService';

import type { ClientTelegramSettings } from '../types/fleetTicket';

export interface TelegramSettingsPanelProps {
  clientId: string;
  userId: string;
}

const defaultSettings = (clientId: string): ClientTelegramSettings => ({
  clientId,
  enabled: false,
  chatId: '',
  notifySos: true,
  notifyCritical: true,
  notifyHigh: false,
});

export default function TelegramSettingsPanel({ clientId, userId }: TelegramSettingsPanelProps) {
  const queryClient = useQueryClient();
  const [settings, setSettings] = useState<ClientTelegramSettings>(() => defaultSettings(clientId));
  const [isDirty, setIsDirty] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const settingsQuery = useQuery({
    queryKey: ['telegramSettings', clientId],
    queryFn: () => getTelegramSettings(clientId),
    enabled: !!clientId,
  });

  useEffect(() => {
    if (settingsQuery.data) {
      setSettings(settingsQuery.data);
      setIsDirty(false);
    }
  }, [settingsQuery.data]);

  const saveMutation = useMutation({
    mutationFn: () => saveTelegramSettings(settings, userId),
    onSuccess: (saved) => {
      setSettings(saved);
      setIsDirty(false);
      setError(null);
      setSuccess('Configurações do Telegram salvas com sucesso.');
      void queryClient.invalidateQueries({ queryKey: ['telegramSettings', clientId] });
    },
    onError: (mutationError: Error) => {
      setSuccess(null);
      setError(mutationError.message || 'Não foi possível salvar as configurações do Telegram.');
    },
  });

  const testMutation = useMutation({
    mutationFn: () => sendTelegramTestMessage(clientId),
    onSuccess: () => {
      setError(null);
      setSuccess('Mensagem de teste enviada com sucesso.');
    },
    onError: (mutationError: Error) => {
      setSuccess(null);
      setError(mutationError.message
        ? 'Não foi possível enviar. Verifique se o bot foi adicionado ao grupo e se o chat_id está correto.'
        : 'Não foi possível enviar a mensagem de teste.');
    },
  });

  const updateSettings = (update: Partial<ClientTelegramSettings>) => {
    setSettings((current) => ({ ...current, ...update }));
    setIsDirty(true);
    setSuccess(null);
    setError(null);
  };

  if (settingsQuery.isLoading) {
    return <div className="flex items-center justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-zinc-400" /></div>;
  }

  return (
    <div className="animate-in fade-in overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm duration-300">
      <div className="flex items-center gap-3 border-b border-zinc-200 px-6 py-4">
        <Bell className="h-5 w-5 text-zinc-400" />
        <div>
          <h2 className="text-lg font-medium text-zinc-900">Notificações Telegram</h2>
          <p className="text-sm text-zinc-500">Configure as notificações de chamados para este cliente.</p>
        </div>
      </div>

      {(settingsQuery.isError || error) && (
        <div className="mx-6 mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error ?? 'Não foi possível carregar as configurações do Telegram.'}
        </div>
      )}
      {success && (
        <div className="mx-6 mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{success}</div>
      )}

      <div className="space-y-6 px-6 py-5">
        <label className="flex items-center justify-between gap-4">
          <span>
            <span className="block text-sm font-medium text-zinc-800">Ativar notificações Telegram</span>
            <span className="block text-xs text-zinc-500">Envie alertas de chamados conforme as opções abaixo.</span>
          </span>
          <input
            type="checkbox"
            role="switch"
            aria-label="Ativar notificações Telegram"
            checked={settings.enabled}
            onChange={(event) => updateSettings({ enabled: event.target.checked })}
            className="h-5 w-5 accent-orange-500"
          />
        </label>

        <label className="block">
          <span className="mb-1 block text-sm font-medium text-zinc-800">chat_id</span>
          <input
            value={settings.chatId}
            onChange={(event) => updateSettings({ chatId: event.target.value })}
            placeholder="Ex.: -1001234567890"
            className="w-full rounded-xl border border-zinc-300 px-3 py-2.5 text-sm focus:border-orange-500 focus:ring-2 focus:ring-orange-100 focus:outline-none"
          />
        </label>

        <div className="space-y-3">
          <label className="flex items-center gap-3 text-sm text-zinc-700">
            <input type="checkbox" checked={settings.notifySos} onChange={(event) => updateSettings({ notifySos: event.target.checked })} className="h-4 w-4 accent-orange-500" />
            Notificar S.O.S. de motorista
          </label>
          <label className="flex items-center gap-3 text-sm text-zinc-700">
            <input type="checkbox" checked={settings.notifyCritical} onChange={(event) => updateSettings({ notifyCritical: event.target.checked })} className="h-4 w-4 accent-orange-500" />
            Notificar chamados classificados como crítico
          </label>
          <label className="flex items-center gap-3 text-sm text-zinc-700">
            <input type="checkbox" checked={settings.notifyHigh} onChange={(event) => updateSettings({ notifyHigh: event.target.checked })} className="h-4 w-4 accent-orange-500" />
            Notificar chamados classificados como alto
          </label>
        </div>

        <div className="rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-600">
          <p className="mb-2 font-medium text-zinc-800">Como configurar</p>
          <ol className="list-decimal space-y-1 pl-5">
            <li>Crie um grupo no Telegram.</li>
            <li>Adicione o bot global do BetaFleet ao grupo.</li>
            <li>Use @getidsbot ou suporte para descobrir o chat_id.</li>
            <li>Cole o chat_id nesta tela.</li>
            <li>Envie uma mensagem de teste.</li>
          </ol>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-end gap-3 border-t border-zinc-200 bg-zinc-50 px-6 py-4">
        <button
          type="button"
          onClick={() => testMutation.mutate()}
          disabled={isDirty || !settings.enabled || !settings.chatId.trim() || testMutation.isPending}
          className="inline-flex items-center gap-2 rounded-xl border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {testMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          Enviar mensagem de teste
        </button>
        <button
          type="button"
          onClick={() => saveMutation.mutate()}
          disabled={saveMutation.isPending || !isDirty || (settings.enabled && !settings.chatId.trim())}
          className="inline-flex items-center gap-2 rounded-xl bg-orange-500 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {saveMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
          {saveMutation.isPending ? 'Salvando...' : 'Salvar configurações'}
        </button>
      </div>
    </div>
  );
}
