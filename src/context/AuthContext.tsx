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
      .select('id, name, role, client_id, clients(id, name, logo_url)')
      .eq('id', userId)
      .single();

    if (data && !error) {
      const profile = data as any;
      const rawClient = Array.isArray(profile.clients)
        ? profile.clients[0]
        : profile.clients;

      const client: Client = rawClient
        ? { id: rawClient.id, name: rawClient.name, logoUrl: rawClient.logo_url ?? undefined }
        : rawClient;

      setUser({
        id: profile.id,
        name: profile.name,
        email,
        role: profile.role as Role,
        clientId: profile.client_id,
      });
      setCurrentClient(client ?? null);

      if (['Admin Master', 'Director', 'Manager'].includes(profile.role)) {
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
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        fetchProfile(session.user.id, session.user.email ?? '');
      } else {
        setUser(null);
        setCurrentClient(null);
        setAllClients([]);
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
    const client = allClients.find((c) => c.id === clientId);
    if (client) setCurrentClient(client);
  };

  const canSwitchClient =
    allClients.length > 1 &&
    (user?.role === 'Manager' ||
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
