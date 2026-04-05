import React, { useState } from 'react';
import { X, Link2, Copy, Check, Loader2, Trash2, Building2, RefreshCw } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { WorkshopInvitation, WorkshopPartnership } from '../types';
import { workshopInvitationFromRow, workshopPartnershipFromRow } from '../lib/workshopAccountMappers';

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
      return (data as any[]).map(workshopInvitationFromRow);
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
      return data as any[];
    },
    enabled: !!currentClient?.id,
  });

  const invokeFn = async (fnName: string, body: object) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error('Sessão expirada. Faça login novamente.');

    const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/${fnName}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`,
        'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
      },
      body: JSON.stringify(body),
    });
    const json = await res.json().catch(() => null);
    if (!res.ok) throw new Error(json?.error ?? json?.message ?? json?.msg ?? `HTTP ${res.status}: ${JSON.stringify(json)}`);
    return json;
  };

  // Gerar novo convite
  const createMutation = useMutation({
    mutationFn: async () => {
      return invokeFn('workshop-invitation', { action: 'create', client_id: currentClient?.id });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workshopInvitations', currentClient?.id] });
    },
  });

  // Revogar convite
  const revokeMutation = useMutation({
    mutationFn: async (invitationId: string) => {
      return invokeFn('workshop-invitation', { action: 'revoke', invitation_id: invitationId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workshopInvitations', currentClient?.id] });
    },
  });

  // Desativar partnership
  const deactivateMutation = useMutation({
    mutationFn: async (partnershipId: string) => {
      return invokeFn('workshop-partnership-manage', { action: 'deactivate', partnership_id: partnershipId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workshopPartnerships', currentClient?.id] });
    },
  });

  const handleCopy = async (url: string, token: string) => {
    await navigator.clipboard.writeText(url);
    setCopiedToken(token);
    setTimeout(() => setCopiedToken(null), 2000);
  };

  const getInviteUrl = (token: string) =>
    `${window.location.origin}/workshop/join?token=${token}`;

  const formatExpiry = (expiresAt: string) => {
    const d = new Date(expiresAt);
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="relative flex w-full max-w-2xl flex-col rounded-2xl bg-white shadow-xl max-h-[90vh]">

        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-200 px-6 py-4 flex-shrink-0">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-orange-100">
              <Link2 className="h-4 w-4 text-orange-600" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-zinc-900">Convidar Oficina Parceira</h2>
              <p className="text-xs text-zinc-500">Gere um link de convite para a oficina aceitar</p>
            </div>
          </div>
          <button onClick={onClose} className="rounded-lg p-1 hover:bg-zinc-100 transition-colors">
            <X className="h-5 w-5 text-zinc-500" />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 p-6 space-y-6">

          {/* Botão gerar convite */}
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-zinc-800">Link de convite</h3>
              <p className="text-xs text-zinc-500 mt-0.5">Válido por 30 dias. Compartilhe com a oficina.</p>
            </div>
            <button
              onClick={() => createMutation.mutate()}
              disabled={createMutation.isPending}
              className="inline-flex items-center gap-2 rounded-xl bg-orange-500 px-4 py-2 text-sm font-medium text-white hover:bg-orange-600 transition-colors disabled:opacity-60"
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
              <Loader2 className="h-5 w-5 text-zinc-300 animate-spin" />
            </div>
          ) : invitations.length > 0 && (
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-3">
                Convites pendentes ({invitations.length})
              </h3>
              <div className="space-y-2">
                {invitations.map((inv: WorkshopInvitation) => {
                  const url = getInviteUrl(inv.token);
                  const copied = copiedToken === inv.token;
                  return (
                    <div key={inv.id} className="flex items-center gap-3 rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-mono text-zinc-600 truncate">{url}</p>
                        <p className="text-xs text-zinc-400 mt-0.5">Expira em {formatExpiry(inv.expiresAt)}</p>
                      </div>
                      <button
                        onClick={() => handleCopy(url, inv.token)}
                        className="flex-shrink-0 p-2 rounded-lg text-zinc-400 hover:text-orange-600 hover:bg-orange-50 transition-colors"
                        title="Copiar link"
                      >
                        {copied ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
                      </button>
                      <button
                        onClick={() => revokeMutation.mutate(inv.id)}
                        disabled={revokeMutation.isPending}
                        className="flex-shrink-0 p-2 rounded-lg text-zinc-400 hover:text-red-600 hover:bg-red-50 transition-colors"
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
              <Loader2 className="h-5 w-5 text-zinc-300 animate-spin" />
            </div>
          ) : partnerships.length > 0 && (
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-3">
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
                      <div className="flex-1 min-w-0">
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
                          className="flex-shrink-0 rounded-lg border border-zinc-200 px-3 py-1.5 text-xs text-zinc-500 hover:border-red-300 hover:text-red-600 transition-colors"
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
            <div className="text-center py-8 text-zinc-400">
              <Building2 className="h-10 w-10 mx-auto mb-2 opacity-30" />
              <p className="text-sm">Nenhuma oficina parceira ainda.</p>
              <p className="text-xs mt-1">Gere um link e compartilhe com a oficina.</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex-shrink-0 border-t border-zinc-200 px-6 py-4 flex justify-end">
          <button
            onClick={onClose}
            className="rounded-xl border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 transition-colors"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}
