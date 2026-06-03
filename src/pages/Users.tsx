import React, { useEffect, useMemo, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { Pencil, Trash2, Plus, Search, X, Loader2 } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { OperationalUnit, OperationsManagerScope, Role, Shipper } from '../types';
import { capitalizeWords } from '../lib/inputHelpers';
import { invokeEdgeFunction } from '../lib/invokeEdgeFn';
import {
  ROLE_COLORS,
  getCreatableRoles,
  getRoleLabel,
  getRoleRank,
  canManageOperationsManagerScope,
  isOperationsManager,
} from '../lib/rolePermissions';
import {
  filterOperationalUnitsByShippers,
  hasOperationsManagerScopeChanged,
  normalizeOperationsManagerScope,
  validateOperationsManagerScope,
} from '../lib/operationsManagerScope';

export interface UserRow {
  id: string;
  name: string;
  role: Role;
  can_delete_vehicles: boolean;
  can_delete_drivers: boolean;
  can_delete_workshops: boolean;
  budget_approval_limit: number;
  created_at: string;
}

interface ScopeFormProps {
  shipperIds: string[];
  operationalUnitIds: string[];
  shippers: Shipper[];
  operationalUnits: OperationalUnit[];
  onToggleShipper: (shipperId: string) => void;
  onToggleOperationalUnit: (operationalUnitId: string) => void;
}

interface CreateForm {
  name: string;
  email: string;
  password: string;
  role: Role;
  canDeleteVehicles: boolean;
  canDeleteDrivers: boolean;
  canDeleteWorkshops: boolean;
  budgetLimit: string;
  shipperIds: string[];
  operationalUnitIds: string[];
}

const CAN_MANAGE_PERMISSIONS: Role[] = ['Manager', 'Coordinator', 'Director', 'Admin Master'];
const CAN_MANAGE_USERS: Role[] = ['Fleet Assistant', 'Fleet Analyst', 'Supervisor', 'Manager', 'Coordinator', 'Director', 'Admin Master'];
const EMPTY_SHIPPERS: Shipper[] = [];
const EMPTY_OPERATIONAL_UNITS: OperationalUnit[] = [];

export function getCreateUserRoleOptions(role: Role): Role[] {
  return getCreatableRoles(role);
}

export function getOperationsManagerScopeError(scope: Partial<OperationsManagerScope>): string | null {
  return validateOperationsManagerScope(scope);
}

export function pruneOperationsManagerOperationalUnits(
  operationalUnitIds: string[],
  shipperIds: string[],
  operationalUnits: Array<Pick<OperationalUnit, 'id' | 'shipperId'>>
): string[] {
  return filterOperationalUnitsByShippers(operationalUnitIds, shipperIds, operationalUnits);
}

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
      {getRoleLabel(role)}
    </span>
  );
}

function OperationsManagerScopeFields({
  shipperIds,
  operationalUnitIds,
  shippers,
  operationalUnits,
  onToggleShipper,
  onToggleOperationalUnit,
}: ScopeFormProps) {
  const selectedShippers = new Set(shipperIds);
  const filteredUnits = operationalUnits.filter((unit) => selectedShippers.has(unit.shipperId));

  return (
    <div className="space-y-4 rounded-2xl border border-cyan-200 bg-cyan-50/60 p-4">
      <div>
        <h3 className="text-sm font-semibold text-cyan-900">Escopo do Gestor de Operações</h3>
        <p className="mt-1 text-xs text-cyan-700">
          Selecione pelo menos 1 embarcador e 1 base operacional pertencente aos embarcadores marcados.
        </p>
      </div>

      <div className="space-y-2">
        <p className="text-sm font-medium text-zinc-700">Embarcadores *</p>
        <div className="max-h-40 space-y-2 overflow-y-auto rounded-xl border border-zinc-200 bg-white p-3">
          {shippers.length === 0 ? (
            <p className="text-sm text-zinc-500">Nenhum embarcador ativo encontrado.</p>
          ) : (
            shippers.map((shipper) => (
              <label key={shipper.id} className="flex items-center gap-3 text-sm text-zinc-700">
                <input
                  type="checkbox"
                  checked={shipperIds.includes(shipper.id)}
                  onChange={() => onToggleShipper(shipper.id)}
                />
                <span>{shipper.name}</span>
              </label>
            ))
          )}
        </div>
      </div>

      <div className="space-y-2">
        <p className="text-sm font-medium text-zinc-700">Bases Operacionais *</p>
        <div className="max-h-48 space-y-2 overflow-y-auto rounded-xl border border-zinc-200 bg-white p-3">
          {filteredUnits.length === 0 ? (
            <p className="text-sm text-zinc-500">Selecione embarcadores para habilitar as bases.</p>
          ) : (
            filteredUnits.map((unit) => (
              <label key={unit.id} className="flex items-center gap-3 text-sm text-zinc-700">
                <input
                  type="checkbox"
                  checked={operationalUnitIds.includes(unit.id)}
                  onChange={() => onToggleOperationalUnit(unit.id)}
                />
                <span>{unit.name}</span>
              </label>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

function useOperationsManagerOptions(enabled: boolean, clientId?: string | null) {
  const shippersQuery = useQuery({
    queryKey: ['operations-manager-shippers', clientId],
    enabled: enabled && !!clientId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('shippers')
        .select('id, client_id, name, cnpj, phone, email, contact_person, notes, active')
        .eq('client_id', clientId!)
        .eq('active', true)
        .order('name');

      if (error) throw error;

      return (data ?? []).map((row: any) => ({
        id: row.id,
        clientId: row.client_id,
        name: row.name,
        cnpj: row.cnpj ?? undefined,
        phone: row.phone ?? undefined,
        email: row.email ?? undefined,
        contactPerson: row.contact_person ?? undefined,
        notes: row.notes ?? undefined,
        active: row.active,
      })) as Shipper[];
    },
  });

  const operationalUnitsQuery = useQuery({
    queryKey: ['operations-manager-operational-units', clientId],
    enabled: enabled && !!clientId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('operational_units')
        .select('id, client_id, shipper_id, name, code, city, state, notes, active')
        .eq('client_id', clientId!)
        .eq('active', true)
        .order('name');

      if (error) throw error;

      return (data ?? []).map((row: any) => ({
        id: row.id,
        clientId: row.client_id,
        shipperId: row.shipper_id,
        name: row.name,
        code: row.code ?? undefined,
        city: row.city ?? undefined,
        state: row.state ?? undefined,
        notes: row.notes ?? undefined,
        active: row.active,
      })) as OperationalUnit[];
    },
  });

  return {
    shippers: shippersQuery.data ?? EMPTY_SHIPPERS,
    operationalUnits: operationalUnitsQuery.data ?? EMPTY_OPERATIONAL_UNITS,
    isLoading: shippersQuery.isLoading || operationalUnitsQuery.isLoading,
  };
}

function useOperationsManagerScope(profileId: string | null, enabled: boolean) {
  return useQuery({
    queryKey: ['operations-manager-scope', profileId],
    enabled: enabled && !!profileId,
    queryFn: async (): Promise<OperationsManagerScope> => {
      const [{ data: shipperRows, error: shipperError }, { data: unitRows, error: unitError }] = await Promise.all([
        supabase.from('profile_shipper_scopes').select('shipper_id').eq('profile_id', profileId!),
        supabase.from('profile_operational_unit_scopes').select('operational_unit_id').eq('profile_id', profileId!),
      ]);

      if (shipperError) throw shipperError;
      if (unitError) throw unitError;

      return normalizeOperationsManagerScope({
        shipperIds: (shipperRows ?? []).map((row: any) => row.shipper_id),
        operationalUnitIds: (unitRows ?? []).map((row: any) => row.operational_unit_id),
      });
    },
  });
}

export function CreateUserModal({
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
  const [form, setForm] = useState<CreateForm>({
    name: '',
    email: '',
    password: '',
    role: defaultRole,
    canDeleteVehicles: false,
    canDeleteDrivers: false,
    canDeleteWorkshops: false,
    budgetLimit: '',
    shipperIds: [],
    operationalUnitIds: [],
  });
  const [error, setError] = useState('');

  const { currentClient } = useAuth();
  const queryClient = useQueryClient();
  const isOperationsRole = isOperationsManager(form.role);
  const { shippers, operationalUnits, isLoading: loadingScopeOptions } = useOperationsManagerOptions(open && isOperationsRole, currentClient?.id);

  const createMutation = useMutation({
    mutationFn: async () => {
      const scopeValidation = isOperationsRole
        ? validateOperationsManagerScope({
            shipperIds: form.shipperIds,
            operationalUnitIds: form.operationalUnitIds,
          })
        : null;

      if (scopeValidation) {
        throw new Error(scopeValidation);
      }

      const payload = {
        email: form.email.trim().toLowerCase(),
        password: form.password,
        name: capitalizeWords(form.name),
        role: form.role,
        client_id: currentClient?.id,
        can_delete_vehicles: isOperationsRole ? false : form.canDeleteVehicles,
        can_delete_drivers: isOperationsRole ? false : form.canDeleteDrivers,
        can_delete_workshops: isOperationsRole ? false : form.canDeleteWorkshops,
        budget_approval_limit: isOperationsRole ? 0 : canManagePermissions ? (parseFloat(form.budgetLimit) || 0) : 0,
        shipper_ids: isOperationsRole ? form.shipperIds : undefined,
        operational_unit_ids: isOperationsRole ? form.operationalUnitIds : undefined,
      };

      await invokeEdgeFunction('create-user', payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users', currentClient?.id] });
      onCreated();
      onClose();
    },
    onError: (err: any) => {
      setError(err.message ?? 'Erro ao criar usuário.');
    },
  });

  useEffect(() => {
    if (!open) return;

    setForm({
      name: '',
      email: '',
      password: '',
      role: availableRoles[availableRoles.length - 1] ?? 'Driver',
      canDeleteVehicles: false,
      canDeleteDrivers: false,
      canDeleteWorkshops: false,
      budgetLimit: '',
      shipperIds: [],
      operationalUnitIds: [],
    });
    setError('');
  }, [open, currentUserRole]);

  useEffect(() => {
    if (!isOperationsRole) return;

    setForm((previous) => ({
      ...previous,
      canDeleteVehicles: false,
      canDeleteDrivers: false,
      canDeleteWorkshops: false,
      budgetLimit: '0',
      operationalUnitIds: filterOperationalUnitsByShippers(
        previous.operationalUnitIds,
        previous.shipperIds,
        operationalUnits
      ),
    }));
  }, [isOperationsRole, operationalUnits]);

  if (!open) return null;

  const handleToggleShipper = (shipperId: string) => {
    setForm((previous) => {
      const shipperIds = previous.shipperIds.includes(shipperId)
        ? previous.shipperIds.filter((value) => value !== shipperId)
        : [...previous.shipperIds, shipperId];

      return {
        ...previous,
        shipperIds,
        operationalUnitIds: filterOperationalUnitsByShippers(
          previous.operationalUnitIds,
          shipperIds,
          operationalUnits
        ),
      };
    });
  };

  const handleToggleOperationalUnit = (operationalUnitId: string) => {
    setForm((previous) => ({
      ...previous,
      operationalUnitIds: previous.operationalUnitIds.includes(operationalUnitId)
        ? previous.operationalUnitIds.filter((value) => value !== operationalUnitId)
        : [...previous.operationalUnitIds, operationalUnitId],
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    createMutation.mutate();
  };

  const set = (key: keyof CreateForm) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((previous) => ({ ...previous, [key]: e.target.value }));

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
              type="text"
              required
              value={form.name}
              onChange={set('name')}
              placeholder="Ex: João Silva"
              className="mt-1 block w-full rounded-xl border border-zinc-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-700">E-mail *</label>
            <input
              type="email"
              required
              value={form.email}
              onChange={set('email')}
              placeholder="joao@empresa.com"
              className="mt-1 block w-full rounded-xl border border-zinc-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-700">Senha temporária *</label>
            <input
              type="password"
              required
              minLength={6}
              value={form.password}
              onChange={set('password')}
              placeholder="Mínimo 6 caracteres"
              className="mt-1 block w-full rounded-xl border border-zinc-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-700">Cargo *</label>
            <select
              required
              value={form.role}
              onChange={(e) => {
                const role = e.target.value as Role;
                setForm((previous) => ({
                  ...previous,
                  role,
                  shipperIds: role === 'Operations Manager' ? previous.shipperIds : [],
                  operationalUnitIds: role === 'Operations Manager' ? previous.operationalUnitIds : [],
                }));
              }}
              className="mt-1 block w-full rounded-xl border border-zinc-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              {availableRoles.map((role) => (
                <option key={role} value={role}>
                  {getRoleLabel(role)}
                </option>
              ))}
            </select>
          </div>

          {isOperationsRole && (
            loadingScopeOptions ? (
              <div className="flex items-center justify-center rounded-2xl border border-zinc-200 bg-zinc-50 py-6">
                <Loader2 className="h-5 w-5 animate-spin text-cyan-600" />
              </div>
            ) : (
              <OperationsManagerScopeFields
                shipperIds={form.shipperIds}
                operationalUnitIds={form.operationalUnitIds}
                shippers={shippers}
                operationalUnits={operationalUnits}
                onToggleShipper={handleToggleShipper}
                onToggleOperationalUnit={handleToggleOperationalUnit}
              />
            )
          )}

          {canManagePermissions && !isOperationsRole && (
            <div className="space-y-2">
              <div className="flex items-start gap-3 rounded-xl border border-zinc-200 bg-zinc-50 p-3">
                <input
                  id="create-can-delete-vehicles"
                  type="checkbox"
                  checked={form.canDeleteVehicles}
                  onChange={(e) => setForm((previous) => ({ ...previous, canDeleteVehicles: e.target.checked }))}
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
                  onChange={(e) => setForm((previous) => ({ ...previous, canDeleteDrivers: e.target.checked }))}
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
                  onChange={(e) => setForm((previous) => ({ ...previous, canDeleteWorkshops: e.target.checked }))}
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

          {canManagePermissions && !isOperationsRole && (
            <div>
              <label className="block text-sm font-medium text-zinc-700">Limite de Aprovação de Orçamentos</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={form.budgetLimit}
                onChange={(e) => setForm((previous) => ({ ...previous, budgetLimit: e.target.value }))}
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
              type="button"
              onClick={onClose}
              className="rounded-xl border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={createMutation.isPending}
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
  const [scope, setScope] = useState<OperationsManagerScope>({ shipperIds: [], operationalUnitIds: [] });
  const [error, setError] = useState('');

  const isOperationsRole = isOperationsManager(user?.role);
  const { shippers, operationalUnits, isLoading: loadingScopeOptions } = useOperationsManagerOptions(
    open && isOperationsRole,
    currentClient?.id
  );
  const scopeQuery = useOperationsManagerScope(user?.id ?? null, open && isOperationsRole);

  const editMutation = useMutation({
    mutationFn: async () => {
      if (!user) return;

      const updates: Record<string, unknown> = { name: capitalizeWords(name) };
      if (canManagePermissions && !isOperationsRole) {
        updates.can_delete_vehicles = canDeleteVehicles;
        updates.can_delete_drivers = canDeleteDrivers;
        updates.can_delete_workshops = canDeleteWorkshops;
        updates.budget_approval_limit = parseFloat(budgetLimit) || 0;
      }

      const { error: dbError } = await supabase.from('profiles').update(updates).eq('id', user.id);
      if (dbError) throw new Error(dbError.message);

      if (isOperationsRole) {
        const scopeValidation = validateOperationsManagerScope(scope);
        if (scopeValidation) throw new Error(scopeValidation);

        await invokeEdgeFunction('create-user', {
          action: 'sync_operations_scope',
          target_user_id: user.id,
          shipper_ids: scope.shipperIds,
          operational_unit_ids: scope.operationalUnitIds,
        });
      }
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['users', currentClient?.id] }),
        queryClient.invalidateQueries({ queryKey: ['operations-manager-scope', user?.id] }),
      ]);
      onSaved();
      onClose();
    },
    onError: (err: any) => {
      setError(err.message ?? 'Erro ao salvar.');
    },
  });

  useEffect(() => {
    if (!user) return;

    setName(user.name);
    setCanDeleteVehicles(user.can_delete_vehicles);
    setCanDeleteDrivers(user.can_delete_drivers);
    setCanDeleteWorkshops(user.can_delete_workshops);
    setBudgetLimit(user.budget_approval_limit ? user.budget_approval_limit.toString() : '');
    setError('');
  }, [user, open]);

  useEffect(() => {
    if (!scopeQuery.data || !isOperationsRole) return;
    setScope(scopeQuery.data);
  }, [scopeQuery.data, isOperationsRole]);

  useEffect(() => {
    if (!isOperationsRole) return;

    setScope((previous) => ({
      ...previous,
      operationalUnitIds: filterOperationalUnitsByShippers(
        previous.operationalUnitIds,
        previous.shipperIds,
        operationalUnits
      ),
    }));
  }, [isOperationsRole, operationalUnits]);

  if (!open || !user) return null;

  const handleToggleShipper = (shipperId: string) => {
    setScope((previous) => {
      const shipperIds = previous.shipperIds.includes(shipperId)
        ? previous.shipperIds.filter((value) => value !== shipperId)
        : [...previous.shipperIds, shipperId];

      return {
        shipperIds,
        operationalUnitIds: filterOperationalUnitsByShippers(
          previous.operationalUnitIds,
          shipperIds,
          operationalUnits
        ),
      };
    });
  };

  const handleToggleOperationalUnit = (operationalUnitId: string) => {
    setScope((previous) => ({
      ...previous,
      operationalUnitIds: previous.operationalUnitIds.includes(operationalUnitId)
        ? previous.operationalUnitIds.filter((value) => value !== operationalUnitId)
        : [...previous.operationalUnitIds, operationalUnitId],
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    editMutation.mutate();
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
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1 block w-full rounded-xl border border-zinc-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-700">Cargo</label>
            <p className="mt-1 rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-500">
              {getRoleLabel(user.role)} <span className="text-zinc-400">(não editável aqui)</span>
            </p>
          </div>

          {isOperationsRole && (
            loadingScopeOptions || scopeQuery.isLoading ? (
              <div className="flex items-center justify-center rounded-2xl border border-zinc-200 bg-zinc-50 py-6">
                <Loader2 className="h-5 w-5 animate-spin text-cyan-600" />
              </div>
            ) : (
              <OperationsManagerScopeFields
                shipperIds={scope.shipperIds}
                operationalUnitIds={scope.operationalUnitIds}
                shippers={shippers}
                operationalUnits={operationalUnits}
                onToggleShipper={handleToggleShipper}
                onToggleOperationalUnit={handleToggleOperationalUnit}
              />
            )
          )}

          {canManagePermissions && !isOperationsRole && (
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

          {canManagePermissions && !isOperationsRole && (
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
              type="button"
              onClick={onClose}
              className="rounded-xl border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={editMutation.isPending}
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

export default function Users() {
  const { user, currentClient } = useAuth();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserRow | null>(null);

  if (!user || !CAN_MANAGE_USERS.includes(user.role)) return <Navigate to="/" replace />;

  const myRank = getRoleRank(user.role);
  const availableRoles = useMemo(() => getCreateUserRoleOptions(user.role), [user.role]);

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
      return data as UserRow[];
    },
    enabled: !!currentClient?.id || !currentClient,
  });

  const visibleUsers = useMemo(
    () => users.filter((listedUser) => getRoleRank(listedUser.role) < myRank && listedUser.id !== user.id),
    [users, myRank, user.id]
  );

  const filtered = useMemo(
    () => visibleUsers.filter((listedUser) => listedUser.name.toLowerCase().includes(search.toLowerCase())),
    [visibleUsers, search]
  );

  const deleteMutation = useMutation({
    mutationFn: async (userId: string) => {
      await invokeEdgeFunction('create-user', { action: 'delete', user_id: userId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users', currentClient?.id] });
    },
    onError: (err: any) => {
      alert(err.message || 'Erro ao deletar usuário.');
    },
  });

  const handleDelete = (targetUser: UserRow) => {
    if (!window.confirm(`Excluir o usuário "${targetUser.name}"? Esta ação não pode ser desfeita.`)) return;
    deleteMutation.mutate(targetUser.id);
  };

  return (
    <div className="flex flex-col gap-6 h-full">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900">Usuários</h1>
          <p className="mt-1 text-sm text-zinc-500">
            Gerencie os usuários da unidade <span className="font-medium text-zinc-700">{currentClient?.name || 'Todos os Clientes'}</span>.
          </p>
        </div>
        {availableRoles.length > 0 && (
          <button
            onClick={() => setCreateOpen(true)}
            className="inline-flex items-center gap-2 rounded-xl bg-orange-500 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-orange-600 transition-colors"
          >
            <Plus className="h-4 w-4" />
            Novo Usuário
          </button>
        )}
      </div>

      <div className="relative max-w-xs">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
        <input
          type="text"
          placeholder="Buscar por nome..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="block w-full rounded-xl border border-zinc-200 py-2 pl-9 pr-3 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
      </div>

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
                {filtered.map((listedUser) => (
                  <tr key={listedUser.id} className="hover:bg-zinc-50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <UserInitials name={listedUser.name} />
                        <span className="truncate text-sm font-medium text-zinc-900">{listedUser.name}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <RoleBadge role={listedUser.role} />
                    </td>
                    <td className="px-6 py-4 text-sm text-zinc-500">
                      {new Date(listedUser.created_at).toLocaleDateString('pt-BR')}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {listedUser.id !== user.id && (!isOperationsManager(listedUser.role) || canManageOperationsManagerScope(user.role)) && (
                          <button
                            onClick={() => setEditingUser(listedUser)}
                            className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 transition-colors"
                            title="Editar"
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                        )}
                        {listedUser.id !== user.id && (
                          <button
                            onClick={() => handleDelete(listedUser)}
                            className="rounded-lg p-1.5 text-zinc-400 hover:bg-red-50 hover:text-red-600 transition-colors"
                            title="Excluir"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
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
        availableRoles={availableRoles}
        currentUserRole={user.role}
        onClose={() => setCreateOpen(false)}
        onCreated={() => {}}
      />

      <EditUserModal
        open={!!editingUser}
        user={editingUser}
        currentUserRole={user.role}
        onClose={() => setEditingUser(null)}
        onSaved={() => {}}
      />
    </div>
  );
}
