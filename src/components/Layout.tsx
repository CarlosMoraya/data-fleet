import React, { Suspense, useState } from 'react';
import { Outlet, Navigate, useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';
import Topbar from './Topbar';
import RouteFallback from './RouteFallback';
import { useAuth } from '../context/AuthContext';
import { useIdleTimeout } from '../hooks/useIdleTimeout';
import { canAccessRoute, isOperationsManager } from '../lib/rolePermissions';

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

  if (isOperationsManager(user.role) && !canAccessRoute(user.role, location.pathname)) {
    return <Navigate to="/agendamentos" replace />;
  }

  return (
    <div className="flex h-screen w-full bg-zinc-50 overflow-hidden font-sans text-zinc-900">
      <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Topbar onMenuClick={() => setIsSidebarOpen(true)} />
        <main className="flex-1 overflow-hidden flex flex-col p-4 md:p-8">
          <div className="mx-auto max-w-7xl w-full flex-1 min-h-0 flex flex-col">
            <Suspense fallback={<RouteFallback />}>
              <Outlet />
            </Suspense>
          </div>
        </main>
      </div>
    </div>
  );
}
