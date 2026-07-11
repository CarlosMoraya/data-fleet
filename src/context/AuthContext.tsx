import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

import { queryClient, persister } from '../lib/react-query';
import { isOperationsManager } from '../lib/rolePermissions';
import { supabase } from '../lib/supabase';
import { clearCurrentUserUiState } from '../lib/uiStateStorage';
import { User, Role, Client, WorkshopAccount, WorkshopPartnership } from '../types';

interface AuthContextType {
  user: User | null;
  currentClient: Client | null;
  clients: Client[];
  loading: boolean;
  login: (email: string, password: string) => Promise<{ error: string | null }>;
  requestPasswordReset: (email: string) => Promise<{ error: string | null }>;
  updatePassword: (newPassword: string) => Promise<{ error: string | null }>;
  reauthenticate: (password: string) => Promise<{ error: string | null }>;
  logout: () => Promise<void>;
  switchClient: (clientId: string) => void;
  canSwitchClient: boolean;
  // Workshop multi-transportadora
  workshopAccount: WorkshopAccount | null;
  workshopPartnerships: WorkshopPartnership[];
  activeWorkshopId: string | null; // legacy_workshop_id da partnership ativa
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function shouldReloadProfile(prevUserId: string | null | undefined, nextUserId: string): boolean {
  return prevUserId !== nextUserId;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [currentClient, setCurrentClient] = useState<Client | null>(null);
  const [loading, setLoading] = useState(true);
  const [allClients, setAllClients] = useState<Client[]>([]);
  const [workshopAccount, setWorkshopAccount] = useState<WorkshopAccount | null>(null);
  const [workshopPartnerships, setWorkshopPartnerships] = useState<WorkshopPartnership[]>([]);
  const [activeWorkshopId, setActiveWorkshopId] = useState<string | null>(null);

  const fetchProfile = async (userId: string, email: string) => {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, name, role, client_id, budget_approval_limit, workshop_account_id')
      .eq('id', userId)
      .single();

    if (data && !error) {
      type ProfileRow = { id: string; name: string; role: string; client_id: string | null; budget_approval_limit: number | null; workshop_account_id: string | null };
      const profile = data as ProfileRow;

      const userObj: User = {
        id: profile.id,
        name: profile.name,
        email,
        role: profile.role as Role,
        clientId: profile.client_id,
        budgetApprovalLimit: profile.budget_approval_limit ?? 0,
        workshopAccountId: profile.workshop_account_id ?? undefined,
      };

      if (profile.role === 'Workshop') {
        // ── Novo modelo: workshop_account + partnerships ──────
        if (profile.workshop_account_id) {
          const { data: waData } = await supabase
            .from('workshop_accounts')
            .select('id, profile_id, name, cnpj, phone, email, contact_person, address_street, address_number, address_complement, address_neighborhood, address_city, address_state, address_zip, specialties, notes, active')
            .eq('id', profile.workshop_account_id)
            .single();

          if (waData) {
            type WaRow = { id: string; profile_id: string; name: string; cnpj: string; phone: string | null; email: string | null; contact_person: string | null; address_street: string | null; address_number: string | null; address_complement: string | null; address_neighborhood: string | null; address_city: string | null; address_state: string | null; address_zip: string | null; specialties: string[] | null; notes: string | null; active: boolean };
            const wa = waData as WaRow;
            const account: WorkshopAccount = {
              id: wa.id,
              profileId: wa.profile_id,
              name: wa.name,
              cnpj: wa.cnpj,
              phone: wa.phone ?? undefined,
              email: wa.email ?? undefined,
              contactPerson: wa.contact_person ?? undefined,
              addressStreet: wa.address_street ?? undefined,
              addressNumber: wa.address_number ?? undefined,
              addressComplement: wa.address_complement ?? undefined,
              addressNeighborhood: wa.address_neighborhood ?? undefined,
              addressCity: wa.address_city ?? undefined,
              addressState: wa.address_state ?? undefined,
              addressZip: wa.address_zip ?? undefined,
              specialties: wa.specialties ?? undefined,
              notes: wa.notes ?? undefined,
              active: wa.active,
            };
            setWorkshopAccount(account);

            // Buscar partnerships ativas com dados dos clientes
            const { data: partnershipsData } = await supabase
              .from('workshop_partnerships')
              .select('id, workshop_account_id, client_id, legacy_workshop_id, status, invited_at, accepted_at, clients(id, name, logo_url)')
              .eq('workshop_account_id', wa.id)
              .eq('status', 'active');

            if (partnershipsData && partnershipsData.length > 0) {
              type PRow = { id: string; workshop_account_id: string; client_id: string; legacy_workshop_id: string | null; status: string; invited_at: string; accepted_at: string | null; clients: { id: string; name: string; logo_url: string | null } | null };
              const partnerships: WorkshopPartnership[] = (partnershipsData as unknown as PRow[]).map((p) => ({
                id: p.id,
                workshopAccountId: p.workshop_account_id,
                clientId: p.client_id,
                clientName: p.clients?.name,
                clientLogoUrl: p.clients?.logo_url ?? undefined,
                legacyWorkshopId: p.legacy_workshop_id ?? undefined,
                status: p.status as 'active' | 'inactive',
                invitedAt: p.invited_at,
                acceptedAt: p.accepted_at ?? undefined,
              }));
              setWorkshopPartnerships(partnerships);

              // Popular allClients com as transportadoras das partnerships
              const clients: Client[] = partnerships.map((p) => ({
                id: p.clientId,
                name: p.clientName ?? '',
                logoUrl: p.clientLogoUrl,
              }));
              setAllClients(clients);

              // Recuperar cliente ativo da sessão anterior ou usar o primeiro
              const savedClientId = localStorage.getItem('workshop_active_client');
              const activePartnership = partnerships.find((p) => p.clientId === savedClientId) ?? partnerships[0];

              setCurrentClient({
                id: activePartnership.clientId,
                name: activePartnership.clientName ?? '',
                logoUrl: activePartnership.clientLogoUrl,
              });

              setActiveWorkshopId(activePartnership.legacyWorkshopId ?? null);
              userObj.workshopId = activePartnership.legacyWorkshopId;
            }
          }
          setUser(userObj);
          return;
        }

        // ── Modelo legado: buscar workshops.id diretamente ────
        const { data: workshopData } = await supabase
          .from('workshops')
          .select('id, client_id, clients(id, name, logo_url)')
          .eq('profile_id', profile.id)
          .single();

        if (workshopData) {
          type WdRow = { id: string; client_id: string; clients: { id: string; name: string; logo_url: string | null } | null };
          const wd = workshopData as unknown as WdRow;
          userObj.workshopId = wd.id;
          userObj.clientId = wd.client_id;

          setActiveWorkshopId(wd.id);

          const clientData = wd.clients;
          if (clientData) {
            setCurrentClient({
              id: clientData.id,
              name: clientData.name,
              logoUrl: clientData.logo_url ?? undefined,
            });
          }
        }

        setUser(userObj);
        return;
      }

      setUser(userObj);

      // Se há client_id no profile, busca os dados do cliente
      type ClientRow = { id: string; name: string; logo_url: string | null };

      if (profile.client_id) {
        const clientResult = await supabase
          .from('clients')
          .select('id, name, logo_url')
          .eq('id', profile.client_id)
          .single();

        if (clientResult.data) {
          const clientData = clientResult.data as ClientRow;
          setCurrentClient({
            id: clientData.id,
            name: clientData.name,
            logoUrl: clientData.logo_url ?? undefined,
          });
        }
      } else {
        setCurrentClient(null);
      }

      if (['Admin Master', 'Director', 'Manager', 'Coordinator'].includes(profile.role)) {
        const { data: clients } = await supabase.from('clients').select('id, name, logo_url');
        if (clients) {
          const typedClients = clients as ClientRow[];
          const clientList = typedClients.map((c) => ({ id: c.id, name: c.name, logoUrl: c.logo_url ?? undefined }));
          setAllClients(clientList);
          if (profile.role === 'Admin Master') {
            const savedClientId = localStorage.getItem('adminMasterActiveClient');
            if (savedClientId) {
              const savedClient = typedClients.find((c) => c.id === savedClientId);
              if (savedClient) {
                setCurrentClient({
                  id: savedClient.id,
                  name: savedClient.name,
                  logoUrl: savedClient.logo_url ?? undefined,
                });
              }
            }
          }
        }
      }
    }
  };

  useEffect(() => {
    void supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        void fetchProfile(session.user.id, session.user.email ?? '').finally(() =>
          setLoading(false)
        );
      } else {
        setLoading(false);
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && session?.user) {
        if (!shouldReloadProfile(user?.id, session.user.id)) {
          return;
        }
        setLoading(true);
        void fetchProfile(session.user.id, session.user.email ?? '').finally(() => setLoading(false));
      } else if (event === 'SIGNED_OUT') {
        const userId = user?.id;
        setUser(null);
        setCurrentClient(null);
        setAllClients([]);
        setWorkshopAccount(null);
        setWorkshopPartnerships([]);
        setActiveWorkshopId(null);
        if (userId) {
          clearCurrentUserUiState(userId);
        } else {
          localStorage.removeItem('dashboard_date_filter');
          localStorage.removeItem('workshop_active_client');
          localStorage.removeItem('adminMasterActiveClient');
        }
      }
    });

    return () => subscription.unsubscribe();
  }, [user?.id]);

  const login = async (
    email: string,
    password: string
  ): Promise<{ error: string | null }> => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { error: error.message };
    return { error: null };
  };

  const requestPasswordReset = async (email: string): Promise<{ error: string | null }> => {
    const redirectTo = `${window.location.origin}/redefinir-senha`;
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });
    if (error) {
      console.error('requestPasswordReset error:', error.message);
    }
    return { error: null };
  };

  const updatePassword = async (newPassword: string): Promise<{ error: string | null }> => {
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    return { error: error ? error.message : null };
  };

  const reauthenticate = async (password: string): Promise<{ error: string | null }> => {
    if (!user?.email) return { error: 'Sessão inválida. Faça login novamente.' };
    const { error } = await supabase.auth.signInWithPassword({ email: user.email, password });
    return { error: error ? 'Senha atual incorreta.' : null };
  };

  const logout = async () => {
    await supabase.auth.signOut();
    queryClient.clear();
    await persister.removeClient();
  };

  const switchClient = (clientId: string) => {
    if (!clientId) {
      setCurrentClient(null);
      setActiveWorkshopId(null);
      localStorage.removeItem('workshop_active_client');
      localStorage.removeItem('adminMasterActiveClient');
      return;
    }

    // Para Workshop: trocar transportadora ativa e atualizar activeWorkshopId
    if (user?.role === 'Workshop' && workshopPartnerships.length > 0) {
      const partnership = workshopPartnerships.find((p) => p.clientId === clientId);
      if (partnership) {
        setCurrentClient({
          id: partnership.clientId,
          name: partnership.clientName ?? '',
          logoUrl: partnership.clientLogoUrl,
        });
        setActiveWorkshopId(partnership.legacyWorkshopId ?? null);
        localStorage.setItem('workshop_active_client', clientId);
      }
      return;
    }

    if (isOperationsManager(user?.role)) {
      return;
    }

    const client = allClients.find((c) => c.id === clientId);
    if (client) {
      setCurrentClient(client);
      if (user?.role === 'Admin Master') {
        localStorage.setItem('adminMasterActiveClient', clientId);
      }
    }
  };

  const canSwitchClient =
    (user?.role === 'Admin Master' ? allClients.length >= 1 : allClients.length > 1) &&
    (user?.role === 'Manager' ||
      user?.role === 'Coordinator' ||
      user?.role === 'Director' ||
      user?.role === 'Admin Master' ||
      (user?.role === 'Workshop' && workshopPartnerships.length > 1));

  return (
    <AuthContext.Provider
      value={{
        user,
        currentClient,
        clients: allClients,
        loading,
        login,
        requestPasswordReset,
        updatePassword,
        reauthenticate,
        logout,
        switchClient,
        canSwitchClient,
        workshopAccount,
        workshopPartnerships,
        activeWorkshopId,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
