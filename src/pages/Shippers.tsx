import React, { useState, useEffect, useCallback } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Shipper } from '../types';
import { Plus, Search, Edit2, Trash2, Package } from 'lucide-react';
import ShipperForm from '../components/ShipperForm';
import { supabase } from '../lib/supabase';
import { shipperFromRow, shipperToRow, formatCNPJ, ShipperRow } from '../lib/shipperMappers';

const ROLES_WITH_ACCESS = ['Fleet Assistant', 'Fleet Analyst', 'Supervisor', 'Manager', 'Coordinator', 'Director', 'Admin Master'];
const ROLES_CAN_CREATE = ['Fleet Assistant', 'Fleet Analyst', 'Supervisor', 'Manager', 'Coordinator', 'Director', 'Admin Master'];
const ROLES_CAN_EDIT = ['Fleet Analyst', 'Supervisor', 'Manager', 'Coordinator', 'Director', 'Admin Master'];
const ROLES_CAN_DELETE = ['Manager', 'Coordinator', 'Director', 'Admin Master'];

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

export default function Shippers() {
  const { currentClient, user } = useAuth();
  const [shippers, setShippers] = useState<Shipper[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [isFormOpen, setIsFormOpen] = useState(() => {
    return sessionStorage.getItem('shipperFormOpen') === 'true';
  });
  const [editingShipper, setEditingShipper] = useState<Shipper | null>(() => {
    try {
      const saved = sessionStorage.getItem('shipperFormEditing');
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

  const fetchShippers = useCallback(async () => {
    setLoading(true);
    setError(null);
    let query = supabase.from('shippers').select('*');
    if (currentClient?.id) {
      query = query.eq('client_id', currentClient.id);
    }
    const { data, error: fetchError } = await query.order('name');

    if (fetchError) {
      setError('Erro ao carregar embarcadores. Tente novamente.');
    } else {
      setShippers((data as ShipperRow[]).map(shipperFromRow));
    }
    setLoading(false);
  }, [currentClient?.id]);

  useEffect(() => {
    fetchShippers();
  }, [fetchShippers]);

  const handleSave = async (shipper: Partial<Shipper>): Promise<void> => {
    if (!currentClient?.id) return;
    const row = shipperToRow(shipper, currentClient.id);

    if (editingShipper) {
      const { error: updateError } = await supabase
        .from('shippers')
        .update(row)
        .eq('id', editingShipper.id);
      if (updateError) throw updateError;
    } else {
      const { error: insertError } = await supabase
        .from('shippers')
        .insert(row);
      if (insertError) throw insertError;
    }

    await fetchShippers();
    setIsFormOpen(false);
    setEditingShipper(null);
    sessionStorage.removeItem('shipperFormOpen');
    sessionStorage.removeItem('shipperFormEditing');
    sessionStorage.removeItem('shipperFormData');
  };

  const handleDelete = async (shipper: Shipper) => {
    if (!window.confirm(`Excluir o embarcador "${shipper.name}"? Esta ação não pode ser desfeita.`)) return;

    const { error: deleteError } = await supabase
      .from('shippers')
      .delete()
      .eq('id', shipper.id);

    if (deleteError) {
      if (deleteError.code === '23503') {
        setError('Este embarcador possui unidades operacionais vinculadas. Exclua as unidades antes de excluir o embarcador.');
      } else {
        setError('Erro ao excluir embarcador. Tente novamente.');
      }
    } else {
      await fetchShippers();
    }
  };

  const filteredShippers = shippers.filter((s) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      s.name.toLowerCase().includes(q) ||
      (s.cnpj ?? '').includes(q.replace(/\D/g, ''))
    );
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">Embarcadores</h1>
          <p className="text-sm text-zinc-500 mt-1">Gerencie os embarcadores da sua frota.</p>
        </div>

        {canCreate && (
          <button
            onClick={() => {
              sessionStorage.removeItem('shipperFormData');
              sessionStorage.setItem('shipperFormOpen', 'true');
              sessionStorage.removeItem('shipperFormEditing');
              setEditingShipper(null);
              setIsFormOpen(true);
            }}
            className="inline-flex items-center justify-center rounded-xl bg-blue-500 px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors"
          >
            <Plus className="-ml-1 mr-2 h-5 w-5" aria-hidden="true" />
            Adicionar Embarcador
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
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-zinc-200 border-t-blue-500" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-zinc-200">
              <thead className="bg-zinc-50">
                <tr>
                  <th scope="col" className="py-3.5 pl-4 pr-3 text-left text-xs font-semibold text-zinc-500 uppercase tracking-wider sm:pl-6">Embarcador</th>
                  <th scope="col" className="px-3 py-3.5 text-left text-xs font-semibold text-zinc-500 uppercase tracking-wider">CNPJ</th>
                  <th scope="col" className="px-3 py-3.5 text-left text-xs font-semibold text-zinc-500 uppercase tracking-wider">Contato</th>
                  <th scope="col" className="px-3 py-3.5 text-left text-xs font-semibold text-zinc-500 uppercase tracking-wider">Status</th>
                  <th scope="col" className="relative py-3.5 pl-3 pr-4 sm:pr-6">
                    <span className="sr-only">Ações</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 bg-white">
                {filteredShippers.map((shipper) => (
                  <tr key={shipper.id} className="hover:bg-zinc-50 transition-colors">
                    <td className="whitespace-nowrap py-4 pl-4 pr-3 sm:pl-6">
                      <div className="flex items-center">
                        <div className="h-10 w-10 flex-shrink-0 rounded-lg bg-zinc-100 flex items-center justify-center border border-zinc-200">
                          <Package className="h-5 w-5 text-zinc-500" />
                        </div>
                        <div className="ml-4">
                          <div className="font-medium text-zinc-900">{shipper.name}</div>
                          {shipper.contactPerson && (
                            <div className="text-xs text-zinc-400">{shipper.contactPerson}</div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-3 py-4 text-sm text-zinc-500">
                      {shipper.cnpj ? formatCNPJ(shipper.cnpj) : <span className="text-zinc-300">—</span>}
                    </td>
                    <td className="whitespace-nowrap px-3 py-4 text-sm text-zinc-500">
                      <div>{shipper.phone ? formatPhone(shipper.phone) : <span className="text-zinc-300">—</span>}</div>
                      {shipper.email && (
                        <div className="text-xs text-zinc-400 truncate max-w-[160px]">{shipper.email}</div>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-3 py-4 text-sm">
                      {shipper.active ? (
                        <span className="inline-flex items-center rounded-full bg-green-50 px-2.5 py-0.5 text-xs font-medium text-green-700">
                          Ativo
                        </span>
                      ) : (
                        <span className="inline-flex items-center rounded-full bg-zinc-100 px-2.5 py-0.5 text-xs font-medium text-zinc-500">
                          Inativo
                        </span>
                      )}
                    </td>
                    <td className="relative whitespace-nowrap py-4 pl-3 pr-4 text-right text-sm font-medium sm:pr-6">
                      <div className="flex items-center justify-end gap-3">
                        {canEdit && (
                          <button
                            onClick={() => {
                              sessionStorage.removeItem('shipperFormData');
                              sessionStorage.setItem('shipperFormOpen', 'true');
                              sessionStorage.setItem('shipperFormEditing', JSON.stringify(shipper));
                              setEditingShipper(shipper);
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
                            onClick={() => handleDelete(shipper)}
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
                {filteredShippers.length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-10 text-center text-sm text-zinc-500">
                      {search ? 'Nenhum embarcador encontrado para esta busca.' : 'Nenhum embarcador cadastrado para este cliente.'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {isFormOpen && (
        <ShipperForm
          shipper={editingShipper}
          onClose={() => {
            setIsFormOpen(false);
            setEditingShipper(null);
          }}
          onSave={handleSave}
        />
      )}
    </div>
  );
}
