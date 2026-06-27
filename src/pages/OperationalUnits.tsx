import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Search, Edit2, Trash2, Building2, MapPin } from 'lucide-react';
import React, { useState, useMemo } from 'react';
import { Navigate } from 'react-router-dom';

import OperationalUnitForm from '../components/OperationalUnitForm';
import { useAuth } from '../context/AuthContext';
import { operationalUnitFromRow, operationalUnitToRow, OperationalUnitRow } from '../lib/operationalUnitMappers';
import { supabase } from '../lib/supabase';
import { OperationalUnit } from '../types';


const ROLES_WITH_ACCESS = ['Fleet Assistant', 'Fleet Analyst', 'Supervisor', 'Manager', 'Coordinator', 'Director', 'Admin Master'];
const ROLES_CAN_CREATE = ['Fleet Assistant', 'Fleet Analyst', 'Supervisor', 'Manager', 'Coordinator', 'Director', 'Admin Master'];
const ROLES_CAN_EDIT = ['Fleet Analyst', 'Supervisor', 'Manager', 'Coordinator', 'Director', 'Admin Master'];
const ROLES_CAN_DELETE = ['Manager', 'Coordinator', 'Director', 'Admin Master'];

interface AvailableShipper {
  id: string;
  name: string;
}

export default function OperationalUnits() {
  const { currentClient, user } = useAuth();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [isFormOpen, setIsFormOpen] = useState(() => {
    return sessionStorage.getItem('operationalUnitFormOpen') === 'true';
  });
  const [editingUnit, setEditingUnit] = useState<OperationalUnit | null>(() => {
    try {
      const saved = sessionStorage.getItem('operationalUnitFormEditing');
      return saved ? JSON.parse(saved) as OperationalUnit : null;
    } catch {
      return null;
    }
  });

  const canCreate = ROLES_CAN_CREATE.includes(user?.role || '');
  const canEdit = ROLES_CAN_EDIT.includes(user?.role || '');
  const canDelete = ROLES_CAN_DELETE.includes(user?.role || '');

  // Queries
  const { data: units = [], isLoading: loadingUnits, isError: unitsError } = useQuery({
    queryKey: ['operationalUnits', currentClient?.id],
    queryFn: async () => {
      let query = supabase
        .from('operational_units')
        .select('*, shippers(name)');
      if (currentClient?.id) {
        query = query.eq('client_id', currentClient.id);
      }
      const { data, error } = await query.order('name');
      if (error) throw error;
      return (data as OperationalUnitRow[]).map(operationalUnitFromRow);
    },
    enabled: !!user
  });

  const { data: availableShippers = [] } = useQuery<AvailableShipper[]>({
    queryKey: ['availableShippers', currentClient?.id],
    queryFn: async () => {
      let query = supabase
        .from('shippers')
        .select('id, name')
        .eq('active', true);
      if (currentClient?.id) {
        query = query.eq('client_id', currentClient.id);
      }
      const { data, error } = await query.order('name');
      if (error) throw error;
      return data;
    },
    enabled: !!user
  });

  if (user && !ROLES_WITH_ACCESS.includes(user.role)) {
    return <Navigate to="/checklists" replace />;
  }

  const saveMutation = useMutation({
    mutationFn: async (unit: Partial<OperationalUnit>) => {
      if (!currentClient?.id) return;
      const row = operationalUnitToRow(unit, currentClient.id);
      if (editingUnit) {
        const { error } = await supabase
          .from('operational_units')
          .update(row)
          .eq('id', editingUnit.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('operational_units')
          .insert(row);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['operationalUnits', currentClient?.id] });
      setIsFormOpen(false);
      setEditingUnit(null);
      sessionStorage.removeItem('operationalUnitFormOpen');
      sessionStorage.removeItem('operationalUnitFormEditing');
      sessionStorage.removeItem('operationalUnitFormData');
    },
    onError: (err: unknown) => {
      console.error('Erro ao salvar unidade operacional:', err);
    }
  });

  const handleSave = async (unit: Partial<OperationalUnit>): Promise<void> => {
    await saveMutation.mutateAsync(unit);
  };

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('operational_units')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['operationalUnits', currentClient?.id] });
    },
    onError: (err: unknown) => {
      const pgErr = err as { code?: string };
      if (pgErr.code === '23503') {
        alert('Esta unidade está vinculada a veículos. Desvincule os veículos antes de excluir.');
      } else {
        alert('Erro ao excluir unidade. Tente novamente.');
      }
    }
  });

  const handleDelete = (unit: OperationalUnit) => {
    if (!window.confirm(`Excluir a unidade "${unit.name}"? Esta ação não pode ser desfeita.`)) return;
    deleteMutation.mutate(unit.id);
  };

  const filteredUnits = useMemo(() => {
    return units.filter((u) => {
      if (!search) return true;
      const q = search.toLowerCase();
      return (
        u.name.toLowerCase().includes(q) ||
        (u.code ?? '').toLowerCase().includes(q) ||
        (u.shipperName ?? '').toLowerCase().includes(q)
      );
    });
  }, [units, search]);

  return (
    <div className="flex h-full flex-col gap-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">Unidades Operacionais</h1>
          <p className="mt-1 text-sm text-zinc-500">Gerencie as bases e depósitos da sua operação.</p>
        </div>

        {canCreate && (
          <button
            onClick={() => {
              sessionStorage.removeItem('operationalUnitFormData');
              sessionStorage.setItem('operationalUnitFormOpen', 'true');
              sessionStorage.removeItem('operationalUnitFormEditing');
              setEditingUnit(null);
              setIsFormOpen(true);
            }}
            className="inline-flex items-center justify-center rounded-xl bg-indigo-500 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-indigo-600 focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:outline-none"
          >
            <Plus className="mr-2 -ml-1 h-5 w-5" aria-hidden="true" />
            Adicionar Unidade
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
          className="block w-full rounded-xl border border-zinc-200 bg-white py-2.5 pr-3 pl-10 text-sm placeholder-zinc-500 shadow-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
          placeholder="Buscar por nome, código ou embarcador..."
        />
      </div>

      {unitsError && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          Erro ao carregar unidades operacionais. Tente novamente.
        </div>
      )}

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">
        {loadingUnits ? (
          <div className="flex items-center justify-center py-16">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-zinc-200 border-t-indigo-500" />
          </div>
        ) : (
          <div className="flex-1 overflow-auto">
            <table className="min-w-full divide-y divide-zinc-200">
              <thead className="sticky top-0 z-10 bg-zinc-50">
                <tr>
                  <th scope="col" className="py-3.5 pr-3 pl-4 text-left text-xs font-semibold tracking-wider text-zinc-500 uppercase sm:pl-6">Unidade</th>
                  <th scope="col" className="px-3 py-3.5 text-left text-xs font-semibold tracking-wider text-zinc-500 uppercase">Embarcador</th>
                  <th scope="col" className="px-3 py-3.5 text-left text-xs font-semibold tracking-wider text-zinc-500 uppercase">Código</th>
                  <th scope="col" className="px-3 py-3.5 text-left text-xs font-semibold tracking-wider text-zinc-500 uppercase">Localização</th>
                  <th scope="col" className="px-3 py-3.5 text-left text-xs font-semibold tracking-wider text-zinc-500 uppercase">Status</th>
                  <th scope="col" className="relative py-3.5 pr-4 pl-3 sm:pr-6">
                    <span className="sr-only">Ações</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 bg-white">
                {filteredUnits.map((unit) => (
                  <tr key={unit.id} className="transition-colors hover:bg-zinc-50">
                    <td className="py-4 pr-3 pl-4 whitespace-nowrap sm:pl-6">
                      <div className="flex items-center">
                        <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg border border-zinc-200 bg-zinc-100">
                          <Building2 className="h-5 w-5 text-zinc-500" />
                        </div>
                        <div className="ml-4">
                          <div className="font-medium text-zinc-900">{unit.name}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-4 text-sm whitespace-nowrap text-zinc-500">
                      {unit.shipperName ?? <span className="text-zinc-300">—</span>}
                    </td>
                    <td className="px-3 py-4 text-sm whitespace-nowrap text-zinc-500">
                      {unit.code ? (
                        <span className="inline-flex items-center rounded-full bg-zinc-100 px-2.5 py-0.5 text-xs font-medium text-zinc-600">
                          {unit.code}
                        </span>
                      ) : (
                        <span className="text-zinc-300">—</span>
                      )}
                    </td>
                    <td className="px-3 py-4 text-sm whitespace-nowrap text-zinc-500">
                      {unit.city ? (
                        <div className="flex items-center gap-1">
                          <MapPin className="h-3.5 w-3.5 flex-shrink-0 text-zinc-400" />
                          <span>{unit.city}{unit.state ? `/${unit.state}` : ''}</span>
                        </div>
                      ) : (
                        <span className="text-zinc-300">—</span>
                      )}
                    </td>
                    <td className="px-3 py-4 text-sm whitespace-nowrap">
                      {unit.active ? (
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
                        {canEdit && (
                          <button
                            onClick={() => {
                              sessionStorage.removeItem('operationalUnitFormData');
                              sessionStorage.setItem('operationalUnitFormOpen', 'true');
                              sessionStorage.setItem('operationalUnitFormEditing', JSON.stringify(unit));
                              setEditingUnit(unit);
                              setIsFormOpen(true);
                            }}
                            className="text-zinc-400 transition-colors hover:text-zinc-900"
                          >
                            <Edit2 className="h-5 w-5" />
                            <span className="sr-only">Editar</span>
                          </button>
                        )}
                        {canDelete && (
                          <button
                            onClick={() => { handleDelete(unit); }}
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
                {filteredUnits.length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-10 text-center text-sm text-zinc-500">
                      {search ? 'Nenhuma unidade encontrada para esta busca.' : 'Nenhuma unidade operacional cadastrada para este cliente.'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {isFormOpen && (
        <OperationalUnitForm
          unit={editingUnit}
          availableShippers={availableShippers}
          onClose={() => {
            setIsFormOpen(false);
            setEditingUnit(null);
          }}
          onSave={handleSave}
        />
      )}
    </div>
  );
}
