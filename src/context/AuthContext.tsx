import React, { createContext, useContext, useState, ReactNode } from 'react';
import { User, Role, Client } from '../types';
import { MOCK_CLIENTS } from '../constants';

interface AuthContextType {
  user: User | null;
  currentClient: Client | null;
  login: (email: string, role: Role, clientId: string) => void;
  logout: () => void;
  switchClient: (clientId: string) => void;
  canSwitchClient: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [currentClient, setCurrentClient] = useState<Client | null>(null);

  const login = (email: string, role: Role, clientId: string) => {
    const newUser: User = {
      id: 'u1',
      name: email.split('@')[0],
      email,
      role,
      clientId,
    };
    setUser(newUser);
    const client = MOCK_CLIENTS.find((c) => c.id === clientId) || MOCK_CLIENTS[0];
    setCurrentClient(client);
  };

  const logout = () => {
    setUser(null);
    setCurrentClient(null);
  };

  const switchClient = (clientId: string) => {
    const client = MOCK_CLIENTS.find((c) => c.id === clientId);
    if (client) {
      setCurrentClient(client);
    }
  };

  const canSwitchClient = user?.role === 'Manager' || user?.role === 'Director' || user?.role === 'Admin Master';

  return (
    <AuthContext.Provider value={{ user, currentClient, login, logout, switchClient, canSwitchClient }}>
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
