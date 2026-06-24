import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { X, Link2, Copy, Check, Loader2, Trash2, Building2, RefreshCw } from 'lucide-react';
import { useState } from 'react';

import { useAuth } from '../context/AuthContext';
import { invokeEdgeFunction } from '../lib/invokeEdgeFn';
import { supabase } from '../lib/supabase';
import { workshopInvitationFromRow, workshopPartnershipFromRow } from '../lib/workshopAccountMappers';
import { WorkshopInvitation, WorkshopPartnership } from '../types';

interface Props {
  onClose: () => void;
}

export default function InviteWorkshopModal({ onClose }: Props) {
  const { currentClient, user } = useAuth();
  const queryClient = useQueryClient();
  const [copiedToken, setCopiedToken] = useState<string | null>(null);

  // Buscar convites pendentes
  const { data: invitations = [], isLoading: loadingInvitations } = useQuery({
    queryKey: ['workshopInvitations', currentClient?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('workshop_invitations')
        .select('*')
        .eq('client_id', currentClient!.id)
        .in('status', ['pending'])
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data).map(workshopInvitationFromRow);
    },
    enabled: !!currentClient?.id,
  });

  // Buscar partnerships ativas
  const { data: partnerships = [], isLoading: loadingPartnerships } = useQuery({
    queryKey: ['workshopPartnerships', currentClient?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('workshop_partnerships')
        .select('*, workshop_accounts(name, cnpj, email, address_city, address_state)')
        .eq('client_id', currentClient!.id)
        .eq('status', 'active')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!currentClient?.id,
  });

  // Gerar novo convite
  const createMutation = useMutation({
    mutationFn: async () => {
      return invokeEdgeFunction('workshop-invitation', { action: 'create', client_id: currentClient?.id });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workshopInvitations', currentClient?.id] });
    },
  });

  // Revogar convite
  const revokeMutation = useMutation({
    mutationFn: async (invitationId: string) => {
      return invokeEdgeFunction('workshop-invitation', { action: 'revoke', invitation_id: invitationId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workshopInvitations', currentClient?.id] });
    },
  });

  // Desativar partnership
  const deactivateMutation = useMutation({
    mutationFn: async (partnershipId: string) => {
      return invokeEdgeFunction('workshop-partnership-manage', { action: 'deactivate', partnership_id: partnershipId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workshopPartnerships', currentClient?.id] });
    },
  });

  const copyTextToClipboard = async (text: string) => {
    if (navigator.clipboard && window.isSecureContext) {
      try {
        await navigator.clipboard.writeText(text);
        return;
      } catch {
        // Fall through to the legacy copy path when browser permission blocks Clipboard API.
      }
    }

    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.setAttribute('readonly', '');
    textarea.style.position = 'fixed';
    textarea.style.top = '-9999px';
    textarea.style.left = '-9999px';
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();

    let copied = false;
    try {
      copied = document.execCommand('copy');
    } finally {
      document.body.removeChild(textarea);
    }

    if (!copied) {
      throw new Error('Não foi possível copiar o link.');
    }
  };

  const handleCopy = async (url: string, token: string) => {
    await copyTextToClipboard(url);
    setCopiedToken(token);
    setTimeout(() => setCopiedToken(null), 2000);
  };

  const isLocalInviteOrigin = (hostname: string) =>
    hostname === 'localhost'
    || hostname === '127.0.0.1'
    || hostname.startsWith('192.168.')
    || hostname.startsWith('10.')
    || /^172\.(1[6-9]|2\d|3[0-1])\./.test(hostname);

  const getInviteBaseUrl = () => {
    const configuredUrl = import.meta.env.VITE_FRONTEND_URL as string | undefined;
    if (configuredUrl) return configuredUrl.replace(/\/+$/, '');

    if (isLocalInviteOrigin(window.location.hostname)) {
      return 'https://app.betafleet.com.br';
    }

    return window.location.origin;
  };

  const getInviteUrl = (token: string) =>
    `${getInviteBaseUrl()}/workshop/join?token=${token}`;

  const formatExpiry = (expiresAt: string) => {
    const d = new Date(expiresAt);
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      <div className="relative flex max-h-[90vh] w-full max-w-2xl flex-col rounded-2xl bg-white shadow-xl">

        {/* Header */}
        <div className="flex flex-shrink-0 items-center justify-between border-b border-zinc-200 px-6 py-4">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-orange-100">
              <Link2 className="h-4 w-4 text-orange-600" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-zinc-900">Convidar Oficina Parceira</h2>
              <p className="text-xs text-zinc-500">Gere um link de convite para a oficina aceitar</p>
            </div>
          </div>
          <button onClick={onClose} className="rounded-lg p-1 transition-colors hover:bg-zinc-100">
            <X className="h-5 w-5 text-zinc-500" />
          </button>
        </div>

        <div className="flex-1 space-y-6 overflow-y-auto p-6">

          {/* Botão gerar convite */}
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-zinc-800">Link de convite</h3>
              <p className="mt-0.5 text-xs text-zinc-500">Válido por 30 dias. Compartilhe com a oficina.</p>
            </div>
            <button
              onClick={() => createMutation.mutate()}
              disabled={createMutation.isPending}
              className="inline-flex items-center gap-2 rounded-xl bg-orange-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-orange-600 disabled:opacity-60"
            >
              {createMutation.isPending
                ? <Loader2 className="h-4 w-4 animate-spin" />
                : <RefreshCw className="h-4 w-4" />}
              Gerar Link
            </button>
          </div>

          {createMutation.isError && (
            <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
              Erro ao gerar convite: {(createMutation.error as any)?.message}
            </p>
          )}

          {/* Convites pendentes */}
          {loadingInvitations ? (
            <div className="flex justify-center py-4">
              <Loader2 className="h-5 w-5 animate-spin text-zinc-300" />
            </div>
          ) : invitations.length > 0 && (
            <div>
              <h3 className="mb-3 text-xs font-semibold tracking-wider text-zinc-500 uppercase">
                Convites pendentes ({invitations.length})
              </h3>
              <div className="space-y-2">
                {invitations.map((inv: WorkshopInvitation) => {
                  const url = getInviteUrl(inv.token);
                  const copied = copiedToken === inv.token;
                  return (
                    <div key={inv.id} className="flex items-center gap-3 rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3">
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-mono text-xs text-zinc-600">{url}</p>
                        <p className="mt-0.5 text-xs text-zinc-400">Expira em {formatExpiry(inv.expiresAt)}</p>
                      </div>
                      <button
                        onClick={() => handleCopy(url, inv.token)}
                        className="flex-shrink-0 rounded-lg p-2 text-zinc-400 transition-colors hover:bg-orange-50 hover:text-orange-600"
                        title="Copiar link"
                      >
                        {copied ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
                      </button>
                      <button
                        onClick={() => revokeMutation.mutate(inv.id)}
                        disabled={revokeMutation.isPending}
                        className="flex-shrink-0 rounded-lg p-2 text-zinc-400 transition-colors hover:bg-red-50 hover:text-red-600"
                        title="Revogar convite"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Partnerships ativas */}
          {loadingPartnerships ? (
            <div className="flex justify-center py-4">
              <Loader2 className="h-5 w-5 animate-spin text-zinc-300" />
            </div>
          ) : partnerships.length > 0 && (
            <div>
              <h3 className="mb-3 text-xs font-semibold tracking-wider text-zinc-500 uppercase">
                Parcerias ativas ({partnerships.length})
              </h3>
              <div className="space-y-2">
                {partnerships.map((p: any) => {
                  const wa = p.workshop_accounts;
                  return (
                    <div key={p.id} className="flex items-center gap-3 rounded-xl border border-zinc-200 bg-white px-4 py-3">
                      <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-zinc-100">
                        <Building2 className="h-4 w-4 text-zinc-500" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-zinc-900">{wa?.name ?? '—'}</p>
                        <p className="text-xs text-zinc-400">
                          {wa?.address_city && wa?.address_state
                            ? `${wa.address_city}/${wa.address_state} · `
                            : ''}
                          {p.status === 'active' ? 'Ativa' : 'Inativa'}
                        </p>
                      </div>
                      {p.status === 'active' && (
                        <button
                          onClick={() => {
                            if (!window.confirm(`Desvincular a oficina "${wa?.name}"? Ela perderá acesso às OS deste cliente.`)) return;
                            deactivateMutation.mutate(p.id);
                          }}
                          disabled={deactivateMutation.isPending}
                          className="flex-shrink-0 rounded-lg border border-zinc-200 px-3 py-1.5 text-xs text-zinc-500 transition-colors hover:border-red-300 hover:text-red-600"
                        >
                          Desvincular
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {!loadingPartnerships && partnerships.length === 0 && invitations.length === 0 && (
            <div className="py-8 text-center text-zinc-400">
              <Building2 className="mx-auto mb-2 h-10 w-10 opacity-30" />
              <p className="text-sm">Nenhuma oficina parceira ainda.</p>
              <p className="mt-1 text-xs">Gere um link e compartilhe com a oficina.</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex flex-shrink-0 justify-end border-t border-zinc-200 px-6 py-4">
          <button
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
