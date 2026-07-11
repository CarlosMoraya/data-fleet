import React, { Suspense } from 'react';
import { NavLink, Outlet, Navigate } from 'react-router-dom';

import RouteFallback from '../components/RouteFallback';
import { useAuth } from '../context/AuthContext';
import { canFillCoupling, getDefaultRouteForRole, hasRoleAccess } from '../lib/rolePermissions';
import { cn } from '../lib/utils';

import type { Role } from '../types';
import type { JSX } from 'react';

const TABS: { name: string; to: string; canShow: (role: Role | undefined) => boolean }[] = [
  { name: 'Histórico de engates', to: '/controle-carretas/historico', canShow: hasRoleAccess },
  { name: 'Engate', to: '/controle-carretas/engate', canShow: canFillCoupling },
];

export default function ControleCarretas(): JSX.Element {
  const { user } = useAuth();

  const visibleTabs = TABS.filter((tab) => tab.canShow(user?.role));

  if (visibleTabs.length === 0) {
    return <Navigate to={getDefaultRouteForRole(user?.role)} replace />;
  }

  return (
    <div className="flex h-full flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">Controle de carretas</h1>
        <p className="mt-1 text-sm text-zinc-500">Engates e histórico de acoplamento da frota.</p>
      </div>

      {visibleTabs.length > 1 && (
        <div className="border-b border-zinc-200">
          <nav className="-mb-px flex gap-1">
            {visibleTabs.map((tab) => (
              <NavLink
                key={tab.to}
                to={tab.to}
                className={({ isActive }) =>
                  cn(
                    isActive
                      ? 'border-orange-500 font-medium text-orange-700'
                      : 'border-transparent text-zinc-500 hover:border-zinc-300 hover:text-zinc-700',
                    'flex items-center border-b-2 px-4 py-3 text-sm whitespace-nowrap transition-colors'
                  )
                }
              >
                {tab.name}
              </NavLink>
            ))}
          </nav>
        </div>
      )}

      <div className="min-h-0 flex-1">
        <Suspense fallback={<RouteFallback />}>
          <Outlet />
        </Suspense>
      </div>
    </div>
  );
}