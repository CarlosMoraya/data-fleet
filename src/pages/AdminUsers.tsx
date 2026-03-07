import React, { useState, useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { Pencil, Trash2, Plus, Search, X } from 'lucide-react';
import { Role } from '../types';

const ALL_ROLES: Role[] = [
  'Driver', 'Yard Auditor', 'Fleet Assistant',
  'Fleet Analyst', 'Manager', 'Director', 'Admin Master',
];

const ROLE_COLORS: Record<Role, string> = {
  'Driver':          'bg-zinc-100 text-zinc-700',
  'Yard Auditor':    'bg-amber-100 text-amber-700',
  'Fleet Assistant': 'bg-blue-100 text-blue-700',
  'Fleet Analyst':   'bg-indigo-100 text-indigo-700',
  'Manager':         'bg-green-100 text-green-700',
  'Director':        'bg-purple-100 text-purple-700',
  'Admin Master':    'bg-orange-100 text-orange-700',
};

interface UserRow {
  id: string;
  name: string;
  role: Role;
  client_id: string;
  client_name: string;
  created_at: string;
}

interface ClientOption {
  id: string;
  name: string;
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
  client_id: string;
}

const emptyCreate: CreateForm = { name: '', email: '', password: '', role: 'Driver', client_id: '' };

function CreateUserModal({
  open,
  clients,
  onClose,
  onCreated,
}: {
  open: boolean;
  clients: ClientOption[];
  onClose: () => void;
  onCreated: () => void;
}) {
  const [form, setForm] = useState<CreateForm>(emptyCreate);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (open) { setForm(emptyCreate); setError(''); }
  }, [open]);

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const { error: fnError } = await supabase.functions.invoke('create-user', {
        body: {
          email: form.email.trim(),
          password: form.password,
          name: form.name.trim(),
          role: form.role,
          client_id: form.client_id,
        },
      });
      if (fnError) throw new Error(fnError.message);
      onCreated();
      onClose();
    } catch (err: any) {
      setError(err.message ?? 'Erro ao criar usuário.');
    } finally {
      setSaving(false);
    }
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
              {ALL_ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-700">Cliente *</label>
            <select
              required value={form.client_id} onChange={set('client_id')}
              className="mt-1 block w-full rounded-xl border border-zinc-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="">Selecione um cliente...</option>
              {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>

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
              type="submit" disabled={saving}
              className="rounded-xl bg-orange-500 px-4 py-2 text-sm font-medium text-white hover:bg-orange-600 transition-colors disabled:opacity-60"
            >
              {saving ? 'Criando...' : 'Criar Usuário'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Modal: Editar usuário ─────────────────────────────────────────────────

interface EditForm {
  name: string;
  role: Role;
  client_id: string;
}

function EditUserModal({
  open,
  user,
  clients,
  onClose,
  onSaved,
}: {
  open: boolean;
  user: UserRow | null;
  clients: ClientOption[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState<EditForm>({ name: '', role: 'Driver', client_id: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (user) setForm({ name: user.name, role: user.role, client_id: user.client_id });
    setError('');
  }, [user, open]);

  if (!open || !user) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const { error: dbError } = await supabase
        .from('profiles')
        .update({ name: form.name.trim(), role: form.role, client_id: form.client_id })
        .eq('id', user.id);
      if (dbError) throw new Error(dbError.message);
      onSaved();
      onClose();
    } catch (err: any) {
      setError(err.message ?? 'Erro ao salvar.');
    } finally {
      setSaving(false);
    }
  };

  const set = (key: keyof EditForm) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

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
              type="text" required value={form.name} onChange={set('name')}
              className="mt-1 block w-full rounded-xl border border-zinc-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-700">Cargo *</label>
            <select
              required value={form.role} onChange={set('role')}
              className="mt-1 block w-full rounded-xl border border-zinc-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              {ALL_ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-700">Cliente *</label>
            <select
              required value={form.client_id} onChange={set('client_id')}
              className="mt-1 block w-full rounded-xl border border-zinc-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>

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
              type="submit" disabled={saving}
              className="rounded-xl bg-orange-500 px-4 py-2 text-sm font-medium text-white hover:bg-orange-600 transition-colors disabled:opacity-60"
            >
              {saving ? 'Salvando...' : 'Salvar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Página principal ──────────────────────────────────────────────────────

export default function AdminUsers() {
  const { user } = useAuth();
  const [users, setUsers] = useState<UserRow[]>([]);
  const [clients, setClients] = useState<ClientOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterClient, setFilterClient] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserRow | null>(null);

  if (user?.role !== 'Admin Master') return <Navigate to="/" replace />;

  const fetchUsers = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('profiles')
      .select('id, name, role, client_id, created_at, clients(name)')
      .order('name');

    if (data) {
      setUsers(
        data.map((p: any) => ({
          id: p.id,
          name: p.name,
          role: p.role as Role,
          client_id: p.client_id,
          client_name: (Array.isArray(p.clients) ? p.clients[0] : p.clients)?.name ?? '—',
          created_at: p.created_at,
        }))
      );
    }
    setLoading(false);
  };

  const fetchClients = async () => {
    const { data } = await supabase.from('clients').select('id, name').order('name');
    if (data) setClients(data);
  };

  useEffect(() => {
    fetchUsers();
    fetchClients();
  }, []);

  const filtered = users.filter((u) => {
    const matchSearch = u.name.toLowerCase().includes(search.toLowerCase());
    const matchClient = filterClient ? u.client_id === filterClient : true;
    return matchSearch && matchClient;
  });

  const handleDelete = async (u: UserRow) => {
    if (!window.confirm(`Excluir o usuário "${u.name}"? Esta ação não pode ser desfeita.`)) return;
    await supabase.from('profiles').delete().eq('id', u.id);
    await fetchUsers();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900">Usuários</h1>
          <p className="mt-1 text-sm text-zinc-500">Gerencie os usuários de todos os clientes.</p>
        </div>
        <button
          onClick={() => setCreateOpen(true)}
          className="inline-flex items-center gap-2 rounded-xl bg-orange-500 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-orange-600 transition-colors"
        >
          <Plus className="h-4 w-4" />
          Novo Usuário
        </button>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap gap-3">
        <div className="relative max-w-xs flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
          <input
            type="text" placeholder="Buscar por nome..."
            value={search} onChange={(e) => setSearch(e.target.value)}
            className="block w-full rounded-xl border border-zinc-200 py-2 pl-9 pr-3 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>
        <select
          value={filterClient} onChange={(e) => setFilterClient(e.target.value)}
          className="rounded-xl border border-zinc-200 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        >
          <option value="">Todos os clientes</option>
          {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>

      {/* Tabela */}
      <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="h-6 w-6 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center text-sm text-zinc-400">
            {search || filterClient ? 'Nenhum usuário encontrado.' : 'Nenhum usuário cadastrado ainda.'}
          </div>
        ) : (
          <table className="min-w-full divide-y divide-zinc-200">
            <thead className="bg-zinc-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wide text-zinc-500">Usuário</th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wide text-zinc-500">Cargo</th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wide text-zinc-500">Cliente</th>
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
                      <span className="text-sm font-medium text-zinc-900">{u.name}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <RoleBadge role={u.role} />
                  </td>
                  <td className="px-6 py-4 text-sm text-zinc-600">{u.client_name}</td>
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
        )}
      </div>

      <CreateUserModal
        open={createOpen}
        clients={clients}
        onClose={() => setCreateOpen(false)}
        onCreated={fetchUsers}
      />

      <EditUserModal
        open={!!editingUser}
        user={editingUser}
        clients={clients}
        onClose={() => setEditingUser(null)}
        onSaved={fetchUsers}
      />
    </div>
  );
}
