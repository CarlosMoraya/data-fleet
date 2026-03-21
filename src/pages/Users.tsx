import React, { useState, useEffect, useMemo } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { Pencil, Trash2, Plus, Search, X, Loader2 } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Role } from '../types';
import { capitalizeWords } from '../lib/inputHelpers';

const ROLE_RANK: Record<Role, number> = {
  'Driver': 1,
  'Workshop': 1,
  'Yard Auditor': 2,
  'Fleet Assistant': 3,
  'Fleet Analyst': 4,
  'Supervisor': 4,
  'Manager': 5,
  'Coordinator': 5,
  'Director': 6,
  'Admin Master': 7,
};

const ALL_ROLES: Role[] = [
  'Driver', 'Yard Auditor', 'Fleet Assistant',
  'Fleet Analyst', 'Supervisor', 'Manager', 'Coordinator', 'Director', 'Admin Master',
];

const ROLE_COLORS: Record<Role, string> = {
  'Driver':          'bg-zinc-100 text-zinc-700',
  'Workshop':        'bg-orange-100 text-orange-700',
  'Yard Auditor':    'bg-amber-100 text-amber-700',
  'Fleet Assistant': 'bg-blue-100 text-blue-700',
  'Fleet Analyst':   'bg-indigo-100 text-indigo-700',
  'Supervisor':      'bg-violet-100 text-violet-700',
  'Manager':         'bg-green-100 text-green-700',
  'Coordinator':     'bg-emerald-100 text-emerald-700',
  'Director':        'bg-purple-100 text-purple-700',
  'Admin Master':    'bg-orange-100 text-orange-700',
};

/** Retorna os papéis que o usuário com `myRole` pode criar.
 *  'Driver' é excluído — motoristas são criados exclusivamente via Cadastros > Motoristas. */
function creatableRoles(myRole: Role): Role[] {
  const myRank = ROLE_RANK[myRole];
  return ALL_ROLES.filter((r) => ROLE_RANK[r] < myRank && r !== 'Driver');
}

interface UserRow {
  id: string;
  name: string;
  role: Role;
  can_delete_vehicles: boolean;
  can_delete_drivers: boolean;
  can_delete_workshops: boolean;
  budget_approval_limit: number;
  created_at: string;
}

// ─── Componentes auxiliares ────────────────────────────────────────────────

function UserInitials({ name }: { name: string }) {
  const initials = name.split(' ').slice(0, 2).map((w) => w[0]).join('').toUpperCase();
  return (
    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 text-xs font-bold text-blue-700">
      {initials}
    </span>
  );
}

function RoleBadge({ role }: { role: Role }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${ROLE_COLORS[role]}`}>
      {role}
    </span>
  );
}

// ─── Modal: Criar usuário ──────────────────────────────────────────────────

interface CreateForm {
  name: string;
  email: string;
  password: string;
  role: Role;
  canDeleteVehicles: boolean;
  canDeleteDrivers: boolean;
  canDeleteWorkshops: boolean;
  budgetLimit: string;
}

const CAN_MANAGE_PERMISSIONS: Role[] = ['Manager', 'Coordinator', 'Director', 'Admin Master'];

function CreateUserModal({
  open,
  availableRoles,
  currentUserRole,
  onClose,
  onCreated,
}: {
  open: boolean;
  availableRoles: Role[];
  currentUserRole: Role;
  onClose: () => void;
  onCreated: () => void;
}) {
  const canManagePermissions = CAN_MANAGE_PERMISSIONS.includes(currentUserRole);
  const defaultRole = availableRoles[availableRoles.length - 1] ?? 'Driver';
  const [form, setForm] = useState<CreateForm>({ name: '', email: '', password: '', role: defaultRole, canDeleteVehicles: false, canDeleteDrivers: false, canDeleteWorkshops: false, budgetLimit: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const { currentClient } = useAuth();
  const queryClient = useQueryClient();

  const createMutation = useMutation({
    mutationFn: async (payload: any) => {
      const { data, error: fnError } = await supabase.functions.invoke('create-user', {
        body: payload,
      });
      if (fnError) {
        const msg = typeof data === 'object' && data?.error ? data.error : fnError.message;
        throw new Error(msg);
      }

      if (canManagePermissions && form.budgetLimit) {
        const budgetLimit = parseFloat(form.budgetLimit) || 0;
        const profileId = typeof data === 'object' && data?.profileId ? data.profileId : null;
        if (profileId) {
          const { error: updateError } = await supabase
            .from('profiles')
            .update({ budget_approval_limit: budgetLimit })
            .eq('id', profileId);
          if (updateError) throw new Error(updateError.message);
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users', currentClient?.id] });
      onCreated();
      onClose();
    },
    onError: (err: any) => {
      setError(err.message ?? 'Erro ao criar usuário.');
    }
  });

  useEffect(() => {
    if (open) {
      setForm({ name: '', email: '', password: '', role: availableRoles[availableRoles.length - 1] ?? 'Driver', canDeleteVehicles: false, canDeleteDrivers: false, canDeleteWorkshops: false, budgetLimit: '' });
      setError('');
    }
  }, [open, availableRoles]);

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    createMutation.mutate({
      email: form.email.trim().toLowerCase(),
      password: form.password,
      name: capitalizeWords(form.name),
      role: form.role,
      can_delete_vehicles: form.canDeleteVehicles,
      can_delete_drivers: form.canDeleteDrivers,
      can_delete_workshops: form.canDeleteWorkshops,
    });
  };

  const set = (key: keyof CreateForm) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="w-full max-w-md rounded-2xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-zinc-200 px-6 py-4">
          <h2 className="text-base font-semibold text-zinc-900">Novo Usuário</h2>
          <button onClick={onClose} className="rounded-lg p-1 hover:bg-zinc-100 transition-colors">
            <X className="h-5 w-5 text-zinc-500" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 p-6">
          <div>
            <label className="block text-sm font-medium text-zinc-700">Nome *</label>
            <input
              type="text" required value={form.name} onChange={set('name')}
              placeholder="Ex: João Silva"
              className="mt-1 block w-full rounded-xl border border-zinc-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-700">E-mail *</label>
            <input
              type="email" required value={form.email} onChange={set('email')}
              placeholder="joao@empresa.com"
              className="mt-1 block w-full rounded-xl border border-zinc-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-700">Senha temporária *</label>
            <input
              type="password" required minLength={6} value={form.password} onChange={set('password')}
              placeholder="Mínimo 6 caracteres"
              className="mt-1 block w-full rounded-xl border border-zinc-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-700">Cargo *</label>
            <select
              required value={form.role} onChange={set('role')}
              className="mt-1 block w-full rounded-xl border border-zinc-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              {availableRoles.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>

          {canManagePermissions && (
            <div className="space-y-2">
              <div className="flex items-start gap-3 rounded-xl border border-zinc-200 bg-zinc-50 p-3">
                <input
                  id="create-can-delete-vehicles"
                  type="checkbox"
                  checked={form.canDeleteVehicles}
                  onChange={(e) => setForm((f) => ({ ...f, canDeleteVehicles: e.target.checked }))}
                  className="mt-0.5 h-4 w-4 rounded border-zinc-300 text-orange-500 focus:ring-orange-500"
                />
                <div>
                  <label htmlFor="create-can-delete-vehicles" className="block text-sm font-medium text-zinc-700 cursor-pointer">
                    Pode excluir veículos
                  </label>
                  <p className="text-xs text-zinc-500 mt-0.5">
                    Permite que este usuário exclua cadastros de veículos da frota.
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3 rounded-xl border border-zinc-200 bg-zinc-50 p-3">
                <input
                  id="create-can-delete-drivers"
                  type="checkbox"
                  checked={form.canDeleteDrivers}
                  onChange={(e) => setForm((f) => ({ ...f, canDeleteDrivers: e.target.checked }))}
                  className="mt-0.5 h-4 w-4 rounded border-zinc-300 text-orange-500 focus:ring-orange-500"
                />
                <div>
                  <label htmlFor="create-can-delete-drivers" className="block text-sm font-medium text-zinc-700 cursor-pointer">
                    Pode excluir motoristas
                  </label>
                  <p className="text-xs text-zinc-500 mt-0.5">
                    Permite que este usuário exclua cadastros de motoristas da frota.
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3 rounded-xl border border-zinc-200 bg-zinc-50 p-3">
                <input
                  id="create-can-delete-workshops"
                  type="checkbox"
                  checked={form.canDeleteWorkshops}
                  onChange={(e) => setForm((f) => ({ ...f, canDeleteWorkshops: e.target.checked }))}
                  className="mt-0.5 h-4 w-4 rounded border-zinc-300 text-orange-500 focus:ring-orange-500"
                />
                <div>
                  <label htmlFor="create-can-delete-workshops" className="block text-sm font-medium text-zinc-700 cursor-pointer">
                    Pode excluir oficinas
                  </label>
                  <p className="text-xs text-zinc-500 mt-0.5">
                    Permite que este usuário exclua cadastros de oficinas parceiras.
                  </p>
                </div>
              </div>
            </div>
          )}

          {canManagePermissions && (
            <div>
              <label className="block text-sm font-medium text-zinc-700">Limite de Aprovação de Orçamentos</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={form.budgetLimit}
                onChange={(e) => setForm((f) => ({ ...f, budgetLimit: e.target.value }))}
                placeholder="R$ 0,00"
                className="mt-1 block w-full rounded-xl border border-zinc-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
              <p className="text-xs text-zinc-500 mt-1">
                Defina o valor máximo que este usuário pode aprovar. Use 0 para não permitir aprovações.
              </p>
            </div>
          )}

          {error && (
            <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button" onClick={onClose}
              className="rounded-xl border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit" disabled={createMutation.isPending}
              className="rounded-xl bg-orange-500 px-4 py-2 text-sm font-medium text-white hover:bg-orange-600 transition-colors disabled:opacity-60 flex items-center justify-center min-w-[120px]"
            >
              {createMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin text-white" /> : 'Criar Usuário'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Modal: Editar usuário ─────────────────────────────────────────────────

function EditUserModal({
  open,
  user,
  currentUserRole,
  onClose,
  onSaved,
}: {
  open: boolean;
  user: UserRow | null;
  currentUserRole: Role;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { currentClient } = useAuth();
  const queryClient = useQueryClient();
  const canManagePermissions = CAN_MANAGE_PERMISSIONS.includes(currentUserRole);
  const [name, setName] = useState('');
  const [canDeleteVehicles, setCanDeleteVehicles] = useState(false);
  const [canDeleteDrivers, setCanDeleteDrivers] = useState(false);
  const [canDeleteWorkshops, setCanDeleteWorkshops] = useState(false);
  const [budgetLimit, setBudgetLimit] = useState('');
  const [error, setError] = useState('');

  const editMutation = useMutation({
    mutationFn: async (updates: Record<string, unknown>) => {
      if (!user) return;
      await supabase.auth.refreshSession();
      const { error: dbError } = await supabase
        .from('profiles')
        .update(updates)
        .eq('id', user.id);
      if (dbError) throw new Error(dbError.message);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users', currentClient?.id] });
      onSaved();
      onClose();
    },
    onError: (err: any) => {
      setError(err.message ?? 'Erro ao salvar.');
    }
  });

  useEffect(() => {
    if (user) {
      setName(user.name);
      setCanDeleteVehicles(user.can_delete_vehicles);
      setCanDeleteDrivers(user.can_delete_drivers);
      setCanDeleteWorkshops(user.can_delete_workshops);
      setBudgetLimit(user.budget_approval_limit ? user.budget_approval_limit.toString() : '');
    }
    setError('');
  }, [user, open]);

  if (!open || !user) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const updates: Record<string, unknown> = { name: capitalizeWords(name) };
    if (canManagePermissions) {
      updates.can_delete_vehicles = canDeleteVehicles;
      updates.can_delete_drivers = canDeleteDrivers;
      updates.can_delete_workshops = canDeleteWorkshops;
      updates.budget_approval_limit = parseFloat(budgetLimit) || 0;
    }
    editMutation.mutate(updates);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="w-full max-w-md rounded-2xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-zinc-200 px-6 py-4">
          <h2 className="text-base font-semibold text-zinc-900">Editar Usuário</h2>
          <button onClick={onClose} className="rounded-lg p-1 hover:bg-zinc-100 transition-colors">
            <X className="h-5 w-5 text-zinc-500" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 p-6">
          <div>
            <label className="block text-sm font-medium text-zinc-700">Nome *</label>
            <input
              type="text" required value={name} onChange={(e) => setName(e.target.value)}
              className="mt-1 block w-full rounded-xl border border-zinc-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-700">Cargo</label>
            <p className="mt-1 rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-500">
              {user.role} <span className="text-zinc-400">(não editável aqui)</span>
            </p>
          </div>

          {canManagePermissions && (
            <div className="space-y-2">
              <div className="flex items-start gap-3 rounded-xl border border-zinc-200 bg-zinc-50 p-3">
                <input
                  id="edit-can-delete-vehicles"
                  type="checkbox"
                  checked={canDeleteVehicles}
                  onChange={(e) => setCanDeleteVehicles(e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-zinc-300 text-orange-500 focus:ring-orange-500"
                />
                <div>
                  <label htmlFor="edit-can-delete-vehicles" className="block text-sm font-medium text-zinc-700 cursor-pointer">
                    Pode excluir veículos
                  </label>
                  <p className="text-xs text-zinc-500 mt-0.5">
                    Permite que este usuário exclua cadastros de veículos da frota.
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3 rounded-xl border border-zinc-200 bg-zinc-50 p-3">
                <input
                  id="edit-can-delete-drivers"
                  type="checkbox"
                  checked={canDeleteDrivers}
                  onChange={(e) => setCanDeleteDrivers(e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-zinc-300 text-orange-500 focus:ring-orange-500"
                />
                <div>
                  <label htmlFor="edit-can-delete-drivers" className="block text-sm font-medium text-zinc-700 cursor-pointer">
                    Pode excluir motoristas
                  </label>
                  <p className="text-xs text-zinc-500 mt-0.5">
                    Permite que este usuário exclua cadastros de motoristas da frota.
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3 rounded-xl border border-zinc-200 bg-zinc-50 p-3">
                <input
                  id="edit-can-delete-workshops"
                  type="checkbox"
                  checked={canDeleteWorkshops}
                  onChange={(e) => setCanDeleteWorkshops(e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-zinc-300 text-orange-500 focus:ring-orange-500"
                />
                <div>
                  <label htmlFor="edit-can-delete-workshops" className="block text-sm font-medium text-zinc-700 cursor-pointer">
                    Pode excluir oficinas
                  </label>
                  <p className="text-xs text-zinc-500 mt-0.5">
                    Permite que este usuário exclua cadastros de oficinas parceiras.
                  </p>
                </div>
              </div>
            </div>
          )}

          {canManagePermissions && (
            <div>
              <label className="block text-sm font-medium text-zinc-700">Limite de Aprovação de Orçamentos</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={budgetLimit}
                onChange={(e) => setBudgetLimit(e.target.value)}
                placeholder="R$ 0,00"
                className="mt-1 block w-full rounded-xl border border-zinc-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
              <p className="text-xs text-zinc-500 mt-1">
                Defina o valor máximo que este usuário pode aprovar. Use 0 para não permitir aprovações.
              </p>
            </div>
          )}

          {error && (
            <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button" onClick={onClose}
              className="rounded-xl border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit" disabled={editMutation.isPending}
              className="rounded-xl bg-orange-500 px-4 py-2 text-sm font-medium text-white hover:bg-orange-600 transition-colors disabled:opacity-60 flex items-center justify-center min-w-[120px]"
            >
              {editMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin text-white" /> : 'Salvar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Página principal ──────────────────────────────────────────────────────

const CAN_MANAGE: Role[] = ['Fleet Assistant', 'Fleet Analyst', 'Supervisor', 'Manager', 'Coordinator', 'Director', 'Admin Master'];

export default function Users() {
  const { user, currentClient } = useAuth();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserRow | null>(null);

  if (!user || !CAN_MANAGE.includes(user.role)) return <Navigate to="/" replace />;

  const myRank = ROLE_RANK[user.role];
  const available = creatableRoles(user.role);

  const { data: users = [], isLoading: loading } = useQuery({
    queryKey: ['users', currentClient?.id],
    queryFn: async () => {
      let query = supabase
        .from('profiles')
        .select('id, name, role, can_delete_vehicles, can_delete_drivers, can_delete_workshops, budget_approval_limit, created_at');

      if (currentClient?.id) {
        query = query.eq('client_id', currentClient.id);
      }

      const { data, error } = await query.order('name');
      if (error) throw error;
      
      return (data as UserRow[]).filter(
        (u) => ROLE_RANK[u.role] < myRank && u.id !== user.id && u.role !== 'Driver'
      );
    },
    enabled: !!currentClient?.id || !currentClient, // allows fetching if user has no client but is probably master
  });

  const filtered = useMemo(() => {
    return users.filter((u) => u.name.toLowerCase().includes(search.toLowerCase()));
  }, [users, search]);

  const deleteMutation = useMutation({
    mutationFn: async (userId: string) => {
      const { data, error } = await supabase.functions.invoke('create-user', {
        body: { action: 'delete', user_id: userId },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users', currentClient?.id] });
    },
    onError: (err: any) => {
      alert(err.message || 'Erro ao deletar usuário.');
    }
  });

  const handleDelete = (u: UserRow) => {
    if (!window.confirm(`Excluir o usuário "${u.name}"? Esta ação não pode ser desfeita.`)) return;
    deleteMutation.mutate(u.id);
  };

  return (
    <div className="flex flex-col gap-6 h-full">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900">Usuários</h1>
          <p className="mt-1 text-sm text-zinc-500">
            Gerencie os usuários da unidade <span className="font-medium text-zinc-700">{currentClient?.name || 'Todos os Clientes'}</span>.
          </p>
        </div>
        {available.length > 0 && (
          <button
            onClick={() => setCreateOpen(true)}
            className="inline-flex items-center gap-2 rounded-xl bg-orange-500 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-orange-600 transition-colors"
          >
            <Plus className="h-4 w-4" />
            Novo Usuário
          </button>
        )}
      </div>

      {/* Busca */}
      <div className="relative max-w-xs">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
        <input
          type="text" placeholder="Buscar por nome..."
          value={search} onChange={(e) => setSearch(e.target.value)}
          className="block w-full rounded-xl border border-zinc-200 py-2 pl-9 pr-3 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
      </div>

      {/* Tabela */}
      <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm flex-1 min-h-0 flex flex-col">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="h-6 w-6 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center text-sm text-zinc-400">
            {search ? 'Nenhum usuário encontrado.' : 'Nenhum usuário cadastrado nesta unidade.'}
          </div>
        ) : (
          <div className="flex-1 overflow-auto">
          <table className="min-w-full divide-y divide-zinc-200">
            <thead className="bg-zinc-50 sticky top-0 z-10">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wide text-zinc-500">Usuário</th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wide text-zinc-500">Cargo</th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wide text-zinc-500">Cadastrado em</th>
                <th className="px-6 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {filtered.map((u) => (
                <tr key={u.id} className="hover:bg-zinc-50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <UserInitials name={u.name} />
                      <span className="truncate text-sm font-medium text-zinc-900">{u.name}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <RoleBadge role={u.role} />
                  </td>
                  <td className="px-6 py-4 text-sm text-zinc-500">
                    {new Date(u.created_at).toLocaleDateString('pt-BR')}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => setEditingUser(u)}
                        className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 transition-colors"
                        title="Editar"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(u)}
                        className="rounded-lg p-1.5 text-zinc-400 hover:bg-red-50 hover:text-red-600 transition-colors"
                        title="Excluir"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        )}
      </div>

      <CreateUserModal
        open={createOpen}
        availableRoles={available}
        currentUserRole={user.role}
        onClose={() => setCreateOpen(false)}
        onCreated={() => {}} // queryClient handles invalidation in the modal itself
      />

      <EditUserModal
        open={!!editingUser}
        user={editingUser}
        currentUserRole={user.role}
        onClose={() => setEditingUser(null)}
        onSaved={() => {}} // queryClient handles invalidation in the modal itself
      />
    </div>
  );
}
