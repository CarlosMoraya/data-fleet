import React, { useState, useEffect, useCallback } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Workshop } from '../types';
import { Plus, Search, Edit2, Trash2, Wrench, MapPin, Eye } from 'lucide-react';
import WorkshopForm from '../components/WorkshopForm';
import WorkshopDetailModal from '../components/WorkshopDetailModal';
import { supabase } from '../lib/supabase';
import { workshopFromRow, workshopToRow, formatCNPJ, WorkshopRow } from '../lib/workshopMappers';

const ROLES_WITH_ACCESS = ['Fleet Assistant', 'Fleet Analyst', 'Manager', 'Director', 'Admin Master'];
const ROLES_CAN_CREATE = ['Fleet Assistant', 'Fleet Analyst', 'Manager', 'Director', 'Admin Master'];
const ROLES_CAN_EDIT = ['Fleet Analyst', 'Manager', 'Director', 'Admin Master'];
const ROLES_CAN_ALWAYS_DELETE = ['Manager', 'Director', 'Admin Master'];

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
  const [workshops, setWorkshops] = useState<Workshop[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
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

  const canCreate = ROLES_CAN_CREATE.includes(user?.role || '');
  const canEdit = ROLES_CAN_EDIT.includes(user?.role || '');
  const canDelete =
    ROLES_CAN_ALWAYS_DELETE.includes(user?.role || '') ||
    (user?.role === 'Fleet Analyst' && user?.canDeleteWorkshops === true);

  if (user && !ROLES_WITH_ACCESS.includes(user.role)) {
    return <Navigate to="/checklists" replace />;
  }

  const fetchWorkshops = useCallback(async () => {
    if (!currentClient?.id) return;
    setLoading(true);
    setError(null);
    const { data, error: fetchError } = await supabase
      .from('workshops')
      .select('*')
      .eq('client_id', currentClient.id)
      .order('name');

    if (fetchError) {
      setError('Erro ao carregar oficinas. Tente novamente.');
    } else {
      setWorkshops((data as WorkshopRow[]).map(workshopFromRow));
    }
    setLoading(false);
  }, [currentClient?.id]);

  useEffect(() => {
    fetchWorkshops();
  }, [fetchWorkshops]);

  const handleSave = async (workshop: Partial<Workshop>): Promise<void> => {
    if (!currentClient?.id) return;
    const row = workshopToRow(workshop, currentClient.id);

    if (editingWorkshop) {
      const { error: updateError } = await supabase
        .from('workshops')
        .update(row)
        .eq('id', editingWorkshop.id);
      if (updateError) throw updateError;
    } else {
      const { error: insertError } = await supabase
        .from('workshops')
        .insert(row);
      if (insertError) throw insertError;
    }

    await fetchWorkshops();
    setIsFormOpen(false);
    setEditingWorkshop(null);
    sessionStorage.removeItem('workshopFormOpen');
    sessionStorage.removeItem('workshopFormEditing');
    sessionStorage.removeItem('workshopFormData');
  };

  const handleDelete = async (workshop: Workshop) => {
    if (!window.confirm(`Excluir a oficina "${workshop.name}"? Esta ação não pode ser desfeita.`)) return;

    const { error: deleteError } = await supabase
      .from('workshops')
      .delete()
      .eq('id', workshop.id);

    if (deleteError) {
      setError('Erro ao excluir oficina. Tente novamente.');
    } else {
      await fetchWorkshops();
    }
  };

  const filteredWorkshops = workshops.filter((w) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      w.name.toLowerCase().includes(q) ||
      w.cnpj.includes(q.replace(/\D/g, ''))
    );
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">Oficinas Parceiras</h1>
          <p className="text-sm text-zinc-500 mt-1">Gerencie as oficinas parceiras da sua frota.</p>
        </div>

        {canCreate && (
          <button
            onClick={() => {
              sessionStorage.removeItem('workshopFormData');
              sessionStorage.setItem('workshopFormOpen', 'true');
              sessionStorage.removeItem('workshopFormEditing');
              setEditingWorkshop(null);
              setIsFormOpen(true);
            }}
            className="inline-flex items-center justify-center rounded-xl bg-orange-500 px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-orange-600 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2 transition-colors"
          >
            <Plus className="-ml-1 mr-2 h-5 w-5" aria-hidden="true" />
            Adicionar Oficina
          </button>
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
          className="block w-full rounded-xl border border-zinc-200 bg-white py-2.5 pl-10 pr-3 text-sm placeholder-zinc-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 shadow-sm"
          placeholder="Buscar por nome ou CNPJ..."
        />
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-zinc-200 border-t-orange-500" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-zinc-200">
              <thead className="bg-zinc-50">
                <tr>
                  <th scope="col" className="py-3.5 pl-4 pr-3 text-left text-xs font-semibold text-zinc-500 uppercase tracking-wider sm:pl-6">Oficina</th>
                  <th scope="col" className="px-3 py-3.5 text-left text-xs font-semibold text-zinc-500 uppercase tracking-wider">CNPJ</th>
                  <th scope="col" className="px-3 py-3.5 text-left text-xs font-semibold text-zinc-500 uppercase tracking-wider">Contato</th>
                  <th scope="col" className="px-3 py-3.5 text-left text-xs font-semibold text-zinc-500 uppercase tracking-wider">Localização</th>
                  <th scope="col" className="px-3 py-3.5 text-left text-xs font-semibold text-zinc-500 uppercase tracking-wider">Especialidades</th>
                  <th scope="col" className="px-3 py-3.5 text-left text-xs font-semibold text-zinc-500 uppercase tracking-wider">Status</th>
                  <th scope="col" className="relative py-3.5 pl-3 pr-4 sm:pr-6">
                    <span className="sr-only">Ações</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 bg-white">
                {filteredWorkshops.map((workshop) => (
                  <tr key={workshop.id} className="hover:bg-zinc-50 transition-colors">
                    <td className="whitespace-nowrap py-4 pl-4 pr-3 sm:pl-6">
                      <div className="flex items-center">
                        <div className="h-10 w-10 flex-shrink-0 rounded-lg bg-zinc-100 flex items-center justify-center border border-zinc-200">
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
                    <td className="whitespace-nowrap px-3 py-4 text-sm text-zinc-500">
                      {formatCNPJ(workshop.cnpj)}
                    </td>
                    <td className="whitespace-nowrap px-3 py-4 text-sm text-zinc-500">
                      <div>{workshop.phone ? formatPhone(workshop.phone) : <span className="text-zinc-300">—</span>}</div>
                      {workshop.email && (
                        <div className="text-xs text-zinc-400 truncate max-w-[160px]">{workshop.email}</div>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-3 py-4 text-sm text-zinc-500">
                      {workshop.addressCity ? (
                        <div className="flex items-center gap-1">
                          <MapPin className="h-3.5 w-3.5 text-zinc-400 flex-shrink-0" />
                          <span>{workshop.addressCity}{workshop.addressState ? `/${workshop.addressState}` : ''}</span>
                        </div>
                      ) : (
                        <span className="text-zinc-300">—</span>
                      )}
                    </td>
                    <td className="px-3 py-4 text-sm text-zinc-500">
                      {workshop.specialties && workshop.specialties.length > 0 ? (
                        <div className="flex flex-wrap gap-1 max-w-[200px]">
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
                    <td className="whitespace-nowrap px-3 py-4 text-sm">
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
                    <td className="relative whitespace-nowrap py-4 pl-3 pr-4 text-right text-sm font-medium sm:pr-6">
                      <div className="flex items-center justify-end gap-3">
                        <button
                          onClick={() => setViewingWorkshop(workshop)}
                          title="Visualizar"
                          className="text-zinc-400 hover:text-zinc-700 transition-colors"
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
                            className="text-zinc-400 hover:text-zinc-900 transition-colors"
                          >
                            <Edit2 className="h-5 w-5" />
                            <span className="sr-only">Editar</span>
                          </button>
                        )}
                        {canDelete && (
                          <button
                            onClick={() => handleDelete(workshop)}
                            className="text-zinc-400 hover:text-red-600 transition-colors"
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
                    <td colSpan={7} className="py-10 text-center text-sm text-zinc-500">
                      {search ? 'Nenhuma oficina encontrada para esta busca.' : 'Nenhuma oficina cadastrada para este cliente.'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

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
