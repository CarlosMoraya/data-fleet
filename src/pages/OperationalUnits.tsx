import React, { useState, useEffect, useCallback } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { OperationalUnit } from '../types';
import { Plus, Search, Edit2, Trash2, Building2, MapPin } from 'lucide-react';
import OperationalUnitForm from '../components/OperationalUnitForm';
import { supabase } from '../lib/supabase';
import { operationalUnitFromRow, operationalUnitToRow, OperationalUnitRow } from '../lib/operationalUnitMappers';

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
  const [units, setUnits] = useState<OperationalUnit[]>([]);
  const [availableShippers, setAvailableShippers] = useState<AvailableShipper[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [isFormOpen, setIsFormOpen] = useState(() => {
    return sessionStorage.getItem('operationalUnitFormOpen') === 'true';
  });
  const [editingUnit, setEditingUnit] = useState<OperationalUnit | null>(() => {
    try {
      const saved = sessionStorage.getItem('operationalUnitFormEditing');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  const canCreate = ROLES_CAN_CREATE.includes(user?.role || '');
  const canEdit = ROLES_CAN_EDIT.includes(user?.role || '');
  const canDelete = ROLES_CAN_DELETE.includes(user?.role || '');

  if (user && !ROLES_WITH_ACCESS.includes(user.role)) {
    return <Navigate to="/checklists" replace />;
  }

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);

    // Fetch unidades + join shippers
    let unitsQuery = supabase
      .from('operational_units')
      .select('*, shippers(name)');
    if (currentClient?.id) {
      unitsQuery = unitsQuery.eq('client_id', currentClient.id);
    }
    const { data: unitsData, error: unitsError } = await unitsQuery.order('name');

    // Fetch embarcadores ativos para o formulário
    let shippersQuery = supabase
      .from('shippers')
      .select('id, name')
      .eq('active', true);
    if (currentClient?.id) {
      shippersQuery = shippersQuery.eq('client_id', currentClient.id);
    }
    const { data: shippersData } = await shippersQuery.order('name');

    if (unitsError) {
      setError('Erro ao carregar unidades operacionais. Tente novamente.');
    } else {
      setUnits((unitsData as OperationalUnitRow[]).map(operationalUnitFromRow));
    }

    setAvailableShippers((shippersData ?? []) as AvailableShipper[]);
    setLoading(false);
  }, [currentClient?.id]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleSave = async (unit: Partial<OperationalUnit>): Promise<void> => {
    if (!currentClient?.id) return;
    const row = operationalUnitToRow(unit, currentClient.id);

    if (editingUnit) {
      const { error: updateError } = await supabase
        .from('operational_units')
        .update(row)
        .eq('id', editingUnit.id);
      if (updateError) throw updateError;
    } else {
      const { error: insertError } = await supabase
        .from('operational_units')
        .insert(row);
      if (insertError) throw insertError;
    }

    await fetchData();
    setIsFormOpen(false);
    setEditingUnit(null);
    sessionStorage.removeItem('operationalUnitFormOpen');
    sessionStorage.removeItem('operationalUnitFormEditing');
    sessionStorage.removeItem('operationalUnitFormData');
  };

  const handleDelete = async (unit: OperationalUnit) => {
    if (!window.confirm(`Excluir a unidade "${unit.name}"? Esta ação não pode ser desfeita.`)) return;

    const { error: deleteError } = await supabase
      .from('operational_units')
      .delete()
      .eq('id', unit.id);

    if (deleteError) {
      if (deleteError.code === '23503') {
        setError('Esta unidade está vinculada a veículos. Desvincule os veículos antes de excluir.');
      } else {
        setError('Erro ao excluir unidade. Tente novamente.');
      }
    } else {
      await fetchData();
    }
  };

  const filteredUnits = units.filter((u) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      u.name.toLowerCase().includes(q) ||
      (u.code ?? '').toLowerCase().includes(q) ||
      (u.shipperName ?? '').toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">Unidades Operacionais</h1>
          <p className="text-sm text-zinc-500 mt-1">Gerencie as bases e depósitos da sua operação.</p>
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
            className="inline-flex items-center justify-center rounded-xl bg-indigo-500 px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 transition-colors"
          >
            <Plus className="-ml-1 mr-2 h-5 w-5" aria-hidden="true" />
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
          className="block w-full rounded-xl border border-zinc-200 bg-white py-2.5 pl-10 pr-3 text-sm placeholder-zinc-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 shadow-sm"
          placeholder="Buscar por nome, código ou embarcador..."
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
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-zinc-200 border-t-indigo-500" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-zinc-200">
              <thead className="bg-zinc-50">
                <tr>
                  <th scope="col" className="py-3.5 pl-4 pr-3 text-left text-xs font-semibold text-zinc-500 uppercase tracking-wider sm:pl-6">Unidade</th>
                  <th scope="col" className="px-3 py-3.5 text-left text-xs font-semibold text-zinc-500 uppercase tracking-wider">Embarcador</th>
                  <th scope="col" className="px-3 py-3.5 text-left text-xs font-semibold text-zinc-500 uppercase tracking-wider">Código</th>
                  <th scope="col" className="px-3 py-3.5 text-left text-xs font-semibold text-zinc-500 uppercase tracking-wider">Localização</th>
                  <th scope="col" className="px-3 py-3.5 text-left text-xs font-semibold text-zinc-500 uppercase tracking-wider">Status</th>
                  <th scope="col" className="relative py-3.5 pl-3 pr-4 sm:pr-6">
                    <span className="sr-only">Ações</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 bg-white">
                {filteredUnits.map((unit) => (
                  <tr key={unit.id} className="hover:bg-zinc-50 transition-colors">
                    <td className="whitespace-nowrap py-4 pl-4 pr-3 sm:pl-6">
                      <div className="flex items-center">
                        <div className="h-10 w-10 flex-shrink-0 rounded-lg bg-zinc-100 flex items-center justify-center border border-zinc-200">
                          <Building2 className="h-5 w-5 text-zinc-500" />
                        </div>
                        <div className="ml-4">
                          <div className="font-medium text-zinc-900">{unit.name}</div>
                        </div>
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-3 py-4 text-sm text-zinc-500">
                      {unit.shipperName ?? <span className="text-zinc-300">—</span>}
                    </td>
                    <td className="whitespace-nowrap px-3 py-4 text-sm text-zinc-500">
                      {unit.code ? (
                        <span className="inline-flex items-center rounded-full bg-zinc-100 px-2.5 py-0.5 text-xs font-medium text-zinc-600">
                          {unit.code}
                        </span>
                      ) : (
                        <span className="text-zinc-300">—</span>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-3 py-4 text-sm text-zinc-500">
                      {unit.city ? (
                        <div className="flex items-center gap-1">
                          <MapPin className="h-3.5 w-3.5 text-zinc-400 flex-shrink-0" />
                          <span>{unit.city}{unit.state ? `/${unit.state}` : ''}</span>
                        </div>
                      ) : (
                        <span className="text-zinc-300">—</span>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-3 py-4 text-sm">
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
                    <td className="relative whitespace-nowrap py-4 pl-3 pr-4 text-right text-sm font-medium sm:pr-6">
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
                            className="text-zinc-400 hover:text-zinc-900 transition-colors"
                          >
                            <Edit2 className="h-5 w-5" />
                            <span className="sr-only">Editar</span>
                          </button>
                        )}
                        {canDelete && (
                          <button
                            onClick={() => handleDelete(unit)}
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
