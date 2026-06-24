import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Search, Edit2, Trash2, Wrench, MapPin, Eye, Link2 } from 'lucide-react';
import React, { useState, useMemo } from 'react';
import { Navigate } from 'react-router-dom';

import InviteWorkshopModal from '../components/InviteWorkshopModal';
import WorkshopDetailModal from '../components/WorkshopDetailModal';
import WorkshopForm from '../components/WorkshopForm';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { workshopFromRow, workshopToRow, formatCNPJ, WorkshopRow } from '../lib/workshopMappers';
import { Workshop } from '../types';


const ROLES_WITH_ACCESS = ['Fleet Assistant', 'Fleet Analyst', 'Supervisor', 'Manager', 'Coordinator', 'Director', 'Admin Master'];
const ROLES_CAN_CREATE = ['Fleet Assistant', 'Fleet Analyst', 'Supervisor', 'Manager', 'Coordinator', 'Director', 'Admin Master'];
const ROLES_CAN_EDIT = ['Fleet Analyst', 'Supervisor', 'Manager', 'Coordinator', 'Director', 'Admin Master'];
const ROLES_CAN_ALWAYS_DELETE = ['Manager', 'Coordinator', 'Director', 'Admin Master'];

function formatPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 11) {
    return digits.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3');
  }
  if (digits.length === 10) {
    return digits.replace(/(\d{2})(\d{4})(\d{4})/, '($1) $2-$3');
  }
  return phone;
}

export default function Workshops() {
  const { currentClient, user } = useAuth();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [isFormOpen, setIsFormOpen] = useState(() => {
    return sessionStorage.getItem('workshopFormOpen') === 'true';
  });
  const [editingWorkshop, setEditingWorkshop] = useState<Workshop | null>(() => {
    try {
      const saved = sessionStorage.getItem('workshopFormEditing');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  const [viewingWorkshop, setViewingWorkshop] = useState<Workshop | null>(null);
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);

  const canCreate = ROLES_CAN_CREATE.includes(user?.role || '');
  const canEdit = ROLES_CAN_EDIT.includes(user?.role || '');
  const canDelete =
    ROLES_CAN_ALWAYS_DELETE.includes(user?.role || '') ||
    ((user?.role === 'Fleet Analyst' || user?.role === 'Supervisor') && user?.canDeleteWorkshops === true);

  // Queries
  const { data: workshops = [], isLoading: loadingWorkshops, isError: workshopsError } = useQuery({
    queryKey: ['workshops', currentClient?.id],
    queryFn: async () => {
      let query = supabase.from('workshops').select('*');
      if (currentClient?.id) {
        query = query.eq('client_id', currentClient.id);
      }
      const { data, error } = await query.order('name');
      if (error) throw error;
      return (data as WorkshopRow[]).map(workshopFromRow);
    },
    enabled: !!user
  });

  const { data: partnerWorkshopIds = new Set<string>() } = useQuery({
    queryKey: ['workshopPartnerIds', currentClient?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('workshop_partnerships')
        .select('legacy_workshop_id')
        .eq('client_id', currentClient!.id)
        .eq('status', 'active');
      if (error) throw error;
      return new Set(
        (data ?? []).map((p: any) => p.legacy_workshop_id).filter(Boolean) as string[]
      );
    },
    enabled: !!currentClient?.id,
  });

  if (user && !ROLES_WITH_ACCESS.includes(user.role)) {
    return <Navigate to="/checklists" replace />;
  }

  const saveMutation = useMutation({
    mutationFn: async ({ workshop }: { workshop: Partial<Workshop> }) => {
      if (!currentClient?.id) throw new Error('Sessão inválida');
      const row = workshopToRow(workshop, currentClient.id);

      if (editingWorkshop) {
        const { error: updateError } = await supabase
          .from('workshops')
          .update(row)
          .eq('id', editingWorkshop.id);
        if (updateError) throw updateError;
      } else {
        const { data: existing } = await supabase
          .from('workshops')
          .select('id')
          .eq('client_id', currentClient.id)
          .eq('cnpj', row.cnpj)
          .maybeSingle();
        if (existing) {
          throw { code: '23505', message: 'Este CNPJ já está cadastrado para este cliente.' };
        }
        const { error: insertError } = await supabase
          .from('workshops')
          .insert(row);
        if (insertError) throw insertError;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workshops', currentClient?.id] });
      setIsFormOpen(false);
      setEditingWorkshop(null);
      sessionStorage.removeItem('workshopFormOpen');
      sessionStorage.removeItem('workshopFormEditing');
      sessionStorage.removeItem('workshopFormData');
    },
  });

  const handleSave = async (workshop: Partial<Workshop>): Promise<void> => {
    await saveMutation.mutateAsync({ workshop });
  };

  const deleteMutation = useMutation({
    mutationFn: async (workshop: Workshop) => {
      const { error: deleteError } = await supabase
        .from('workshops')
        .delete()
        .eq('id', workshop.id);
      if (deleteError) throw deleteError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workshops', currentClient?.id] });
    },
    onError: () => {
      alert('Erro ao excluir oficina. Tente novamente.');
    },
  });

  const handleDelete = async (workshop: Workshop) => {
    if (!window.confirm(`Excluir a oficina "${workshop.name}"? Esta ação não pode ser desfeita.`)) return;
    deleteMutation.mutate(workshop);
  };

  const filteredWorkshops = useMemo(() => {
    return workshops.filter((w) => {
      if (!search) return true;
      const q = search.toLowerCase();
      return (
        w.name.toLowerCase().includes(q) ||
        w.cnpj.includes(q.replace(/\D/g, ''))
      );
    });
  }, [workshops, search]);

  return (
    <div className="flex h-full flex-col gap-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">Oficinas Parceiras</h1>
          <p className="mt-1 text-sm text-zinc-500">Gerencie as oficinas parceiras da sua frota.</p>
        </div>

        {canCreate && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsInviteModalOpen(true)}
              className="inline-flex items-center justify-center rounded-xl border border-orange-300 bg-orange-50 px-4 py-2.5 text-sm font-medium text-orange-700 shadow-sm transition-colors hover:bg-orange-100 focus:ring-2 focus:ring-orange-500 focus:ring-offset-2 focus:outline-none"
            >
              <Link2 className="mr-2 -ml-1 h-5 w-5" aria-hidden="true" />
              Convidar Oficina
            </button>
            <button
              onClick={() => {
                sessionStorage.removeItem('workshopFormData');
                sessionStorage.setItem('workshopFormOpen', 'true');
                sessionStorage.removeItem('workshopFormEditing');
                setEditingWorkshop(null);
                setIsFormOpen(true);
              }}
              className="inline-flex items-center justify-center rounded-xl bg-orange-500 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-orange-600 focus:ring-2 focus:ring-orange-500 focus:ring-offset-2 focus:outline-none"
            >
              <Plus className="mr-2 -ml-1 h-5 w-5" aria-hidden="true" />
              Cadastrar Oficina
            </button>
          </div>
        )}
      </div>

      <div className="relative">
        <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
          <Search className="h-5 w-5 text-zinc-400" aria-hidden="true" />
        </div>
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="block w-full rounded-xl border border-zinc-200 bg-white py-2.5 pr-3 pl-10 text-sm placeholder-zinc-500 shadow-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
          placeholder="Buscar por nome ou CNPJ..."
        />
      </div>

      {workshopsError && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          Erro ao carregar oficinas. Tente novamente.
        </div>
      )}

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">
        {loadingWorkshops ? (
          <div className="flex items-center justify-center py-16">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-zinc-200 border-t-orange-500" />
          </div>
        ) : (
          <div className="flex-1 overflow-auto">
            <table className="min-w-full divide-y divide-zinc-200">
              <thead className="sticky top-0 z-10 bg-zinc-50">
                <tr>
                  <th scope="col" className="py-3.5 pr-3 pl-4 text-left text-xs font-semibold tracking-wider text-zinc-500 uppercase sm:pl-6">Oficina</th>
                  <th scope="col" className="px-3 py-3.5 text-left text-xs font-semibold tracking-wider text-zinc-500 uppercase">CNPJ</th>
                  <th scope="col" className="px-3 py-3.5 text-left text-xs font-semibold tracking-wider text-zinc-500 uppercase">Contato</th>
                  <th scope="col" className="px-3 py-3.5 text-left text-xs font-semibold tracking-wider text-zinc-500 uppercase">Localização</th>
                  <th scope="col" className="px-3 py-3.5 text-left text-xs font-semibold tracking-wider text-zinc-500 uppercase">Especialidades</th>
                  <th scope="col" className="px-3 py-3.5 text-left text-xs font-semibold tracking-wider text-zinc-500 uppercase">Tipo</th>
                  <th scope="col" className="px-3 py-3.5 text-left text-xs font-semibold tracking-wider text-zinc-500 uppercase">Status</th>
                  <th scope="col" className="relative py-3.5 pr-4 pl-3 sm:pr-6">
                    <span className="sr-only">Ações</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 bg-white">
                {filteredWorkshops.map((workshop) => (
                  <tr key={workshop.id} className="transition-colors hover:bg-zinc-50">
                    <td className="py-4 pr-3 pl-4 whitespace-nowrap sm:pl-6">
                      <div className="flex items-center">
                        <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg border border-zinc-200 bg-zinc-100">
                          <Wrench className="h-5 w-5 text-zinc-500" />
                        </div>
                        <div className="ml-4">
                          <div className="font-medium text-zinc-900">{workshop.name}</div>
                          {workshop.contactPerson && (
                            <div className="text-xs text-zinc-400">{workshop.contactPerson}</div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-4 text-sm whitespace-nowrap text-zinc-500">
                      {formatCNPJ(workshop.cnpj)}
                    </td>
                    <td className="px-3 py-4 text-sm whitespace-nowrap text-zinc-500">
                      <div>{workshop.phone ? formatPhone(workshop.phone) : <span className="text-zinc-300">—</span>}</div>
                      {workshop.email && (
                        <div className="max-w-[160px] truncate text-xs text-zinc-400">{workshop.email}</div>
                      )}
                    </td>
                    <td className="px-3 py-4 text-sm whitespace-nowrap text-zinc-500">
                      {workshop.addressCity ? (
                        <div className="flex items-center gap-1">
                          <MapPin className="h-3.5 w-3.5 flex-shrink-0 text-zinc-400" />
                          <span>{workshop.addressCity}{workshop.addressState ? `/${workshop.addressState}` : ''}</span>
                        </div>
                      ) : (
                        <span className="text-zinc-300">—</span>
                      )}
                    </td>
                    <td className="px-3 py-4 text-sm text-zinc-500">
                      {workshop.specialties && workshop.specialties.length > 0 ? (
                        <div className="flex max-w-[200px] flex-wrap gap-1">
                          {workshop.specialties.slice(0, 2).map((s) => (
                            <span key={s} className="inline-flex items-center rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700">
                              {s}
                            </span>
                          ))}
                          {workshop.specialties.length > 2 && (
                            <span className="inline-flex items-center rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-500">
                              +{workshop.specialties.length - 2}
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-zinc-300">—</span>
                      )}
                    </td>
                    <td className="px-3 py-4 text-sm whitespace-nowrap">
                      {partnerWorkshopIds.has(workshop.id) ? (
                        <span className="inline-flex items-center rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-medium text-blue-700">
                          Parceira
                        </span>
                      ) : (
                        <span className="inline-flex items-center rounded-full bg-zinc-100 px-2.5 py-0.5 text-xs font-medium text-zinc-500">
                          Referência
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-4 text-sm whitespace-nowrap">
                      {workshop.active ? (
                        <span className="inline-flex items-center rounded-full bg-green-50 px-2.5 py-0.5 text-xs font-medium text-green-700">
                          Ativa
                        </span>
                      ) : (
                        <span className="inline-flex items-center rounded-full bg-zinc-100 px-2.5 py-0.5 text-xs font-medium text-zinc-500">
                          Inativa
                        </span>
                      )}
                    </td>
                    <td className="relative py-4 pr-4 pl-3 text-right text-sm font-medium whitespace-nowrap sm:pr-6">
                      <div className="flex items-center justify-end gap-3">
                        <button
                          onClick={() => setViewingWorkshop(workshop)}
                          title="Visualizar"
                          className="text-zinc-400 transition-colors hover:text-zinc-700"
                        >
                          <Eye className="h-5 w-5" />
                          <span className="sr-only">Visualizar</span>
                        </button>
                        {canEdit && (
                          <button
                            onClick={() => {
                              sessionStorage.removeItem('workshopFormData');
                              sessionStorage.setItem('workshopFormOpen', 'true');
                              sessionStorage.setItem('workshopFormEditing', JSON.stringify(workshop));
                              setEditingWorkshop(workshop);
                              setIsFormOpen(true);
                            }}
                            title="Editar"
                            className="text-zinc-400 transition-colors hover:text-zinc-900"
                          >
                            <Edit2 className="h-5 w-5" />
                            <span className="sr-only">Editar</span>
                          </button>
                        )}
                        {canDelete && (
                          <button
                            onClick={() => handleDelete(workshop)}
                            className="text-zinc-400 transition-colors hover:text-red-600"
                          >
                            <Trash2 className="h-5 w-5" />
                            <span className="sr-only">Excluir</span>
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {filteredWorkshops.length === 0 && (
                  <tr>
                    <td colSpan={8} className="py-10 text-center text-sm text-zinc-500">
                      {search ? 'Nenhuma oficina encontrada para esta busca.' : 'Nenhuma oficina cadastrada para este cliente.'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {isInviteModalOpen && (
        <InviteWorkshopModal onClose={() => setIsInviteModalOpen(false)} />
      )}

      {viewingWorkshop && (
        <WorkshopDetailModal
          workshop={viewingWorkshop}
          onClose={() => setViewingWorkshop(null)}
        />
      )}

      {isFormOpen && (
        <WorkshopForm
          workshop={editingWorkshop}
          onClose={() => {
            setIsFormOpen(false);
            setEditingWorkshop(null);
          }}
          onSave={handleSave}
        />
      )}
    </div>
  );
}
