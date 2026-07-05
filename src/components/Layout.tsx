import React, { Suspense, useState } from 'react';
import { Outlet, Navigate, useLocation } from 'react-router-dom';

import { useAuth } from '../context/AuthContext';
import { useIdleTimeout } from '../hooks/useIdleTimeout';
import { canAccessRoute, isOperationsManager } from '../lib/rolePermissions';

import RouteFallback from './RouteFallback';
import Sidebar from './Sidebar';
import Topbar from './Topbar';

export default function Layout() {
  const { user, loading } = useAuth();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const location = useLocation();

  // Ativa o timeout de inatividade (60 minutos por padrão)
  useIdleTimeout();

  if (loading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-zinc-50">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (!canAccessRoute(user.role, location.pathname)) {
    return <Navigate to={isOperationsManager(user.role) ? '/agendamentos' : '/engate'} replace />;
  }

  return (
    <div className="flex h-screen w-full overflow-hidden bg-zinc-50 font-sans text-zinc-900">
      <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Topbar onMenuClick={() => setIsSidebarOpen(true)} />
        <main className="flex flex-1 flex-col overflow-hidden p-4 md:p-8">
          <div className="mx-auto flex min-h-0 w-full max-w-7xl flex-1 flex-col">
            <Suspense fallback={<RouteFallback />}>
              <Outlet />
            </Suspense>
          </div>
        </main>
      </div>
    </div>
  );
}
