import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabase } from '../lib/supabase';
import { User, Role, Client } from '../types';

interface AuthContextType {
  user: User | null;
  currentClient: Client | null;
  clients: Client[];
  loading: boolean;
  login: (email: string, password: string) => Promise<{ error: string | null }>;
  logout: () => Promise<void>;
  switchClient: (clientId: string) => void;
  canSwitchClient: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [currentClient, setCurrentClient] = useState<Client | null>(null);
  const [loading, setLoading] = useState(true);
  const [allClients, setAllClients] = useState<Client[]>([]);

  const fetchProfile = async (userId: string, email: string) => {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, name, role, client_id, can_delete_vehicles, can_delete_drivers, can_delete_workshops, budget_approval_limit, clients(id, name, logo_url)')
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
      };

      // Busca workshopId para usuários com role 'Workshop'
      if (profile.role === 'Workshop') {
        const { data: workshopData } = await supabase
          .from('workshops')
          .select('id')
          .eq('profile_id', profile.id)
          .single();
        if (workshopData) {
          userObj.workshopId = workshopData.id;
        }
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
        localStorage.removeItem('dashboard_date_filter');
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
      return;
    }
    const client = allClients.find((c) => c.id === clientId);
    if (client) setCurrentClient(client);
  };

  const canSwitchClient =
    allClients.length > 1 &&
    (user?.role === 'Manager' ||
      user?.role === 'Coordinator' ||
      user?.role === 'Director' ||
      user?.role === 'Admin Master');

  return (
    <AuthContext.Provider
      value={{ user, currentClient, clients: allClients, loading, login, logout, switchClient, canSwitchClient }}
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
