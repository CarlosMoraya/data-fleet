import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabase } from '../lib/supabase';
import { User, Role, Client, WorkshopAccount, WorkshopPartnership } from '../types';

interface AuthContextType {
  user: User | null;
  currentClient: Client | null;
  clients: Client[];
  loading: boolean;
  login: (email: string, password: string) => Promise<{ error: string | null }>;
  logout: () => Promise<void>;
  switchClient: (clientId: string) => void;
  canSwitchClient: boolean;
  // Workshop multi-transportadora
  workshopAccount: WorkshopAccount | null;
  workshopPartnerships: WorkshopPartnership[];
  activeWorkshopId: string | null; // legacy_workshop_id da partnership ativa
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

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
      .select('id, name, role, client_id, can_delete_vehicles, can_delete_drivers, can_delete_workshops, budget_approval_limit, workshop_account_id')
      .eq('id', userId)
      .single();

    if (data && !error) {
      const profile = data as any;

      const userObj: User = {
        id: profile.id,
        name: profile.name,
        email,
        role: profile.role as Role,
        clientId: profile.client_id,
        canDeleteVehicles: profile.can_delete_vehicles ?? false,
        canDeleteDrivers: profile.can_delete_drivers ?? false,
        canDeleteWorkshops: profile.can_delete_workshops ?? false,
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
            const wa = waData as any;
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
              const partnerships: WorkshopPartnership[] = (partnershipsData as any[]).map((p) => ({
                id: p.id,
                workshopAccountId: p.workshop_account_id,
                clientId: p.client_id,
                clientName: p.clients?.name,
                clientLogoUrl: p.clients?.logo_url ?? undefined,
                legacyWorkshopId: p.legacy_workshop_id ?? undefined,
                status: p.status,
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
          const wd = workshopData as any;
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
      if (profile.client_id) {
        const { data: clientData } = await supabase
          .from('clients')
          .select('id, name, logo_url')
          .eq('id', profile.client_id)
          .single();

        if (clientData) {
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
        if (clients) setAllClients(clients.map((c: any) => ({ id: c.id, name: c.name, logoUrl: c.logo_url ?? undefined })));
      }
    }
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        fetchProfile(session.user.id, session.user.email ?? '').finally(() =>
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
        setLoading(true);
        fetchProfile(session.user.id, session.user.email ?? '').finally(() => setLoading(false));
      } else if (event === 'SIGNED_OUT') {
        setUser(null);
        setCurrentClient(null);
        setAllClients([]);
        setWorkshopAccount(null);
        setWorkshopPartnerships([]);
        setActiveWorkshopId(null);
        localStorage.removeItem('dashboard_date_filter');
        localStorage.removeItem('workshop_active_client');
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const login = async (
    email: string,
    password: string
  ): Promise<{ error: string | null }> => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { error: error.message };
    return { error: null };
  };

  const logout = async () => {
    await supabase.auth.signOut();
  };

  const switchClient = (clientId: string) => {
    if (!clientId) {
      setCurrentClient(null);
      setActiveWorkshopId(null);
      localStorage.removeItem('workshop_active_client');
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

    const client = allClients.find((c) => c.id === clientId);
    if (client) setCurrentClient(client);
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
