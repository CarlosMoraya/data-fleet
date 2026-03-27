import React from 'react';
import { NavLink, Outlet, Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { cn } from '../lib/utils';

const TABS = [
  {
    name: 'Veículos',
    to: '/cadastros/veiculos',
    roles: ['Fleet Assistant', 'Fleet Analyst', 'Supervisor', 'Manager', 'Coordinator', 'Director', 'Admin Master'],
  },
  {
    name: 'Motoristas',
    to: '/cadastros/motoristas',
    roles: ['Fleet Assistant', 'Fleet Analyst', 'Supervisor', 'Manager', 'Coordinator', 'Director', 'Admin Master'],
  },
  {
    name: 'Oficinas',
    to: '/cadastros/oficinas',
    roles: ['Fleet Assistant', 'Fleet Analyst', 'Supervisor', 'Manager', 'Coordinator', 'Director', 'Admin Master'],
  },
  {
    name: 'Embarcadores',
    to: '/cadastros/embarcadores',
    roles: ['Fleet Assistant', 'Fleet Analyst', 'Supervisor', 'Manager', 'Coordinator', 'Director', 'Admin Master'],
  },
  {
    name: 'Unid. Operacionais',
    to: '/cadastros/unidades-operacionais',
    roles: ['Fleet Assistant', 'Fleet Analyst', 'Supervisor', 'Manager', 'Coordinator', 'Director', 'Admin Master'],
  },
  {
    name: 'Usuários',
    to: '/cadastros/usuarios',
    roles: ['Fleet Assistant', 'Fleet Analyst', 'Supervisor', 'Manager', 'Coordinator', 'Director', 'Admin Master'],
  },
  {
    name: 'Pneus',
    to: '/cadastros/pneus',
    roles: ['Fleet Assistant', 'Fleet Analyst', 'Supervisor', 'Manager', 'Coordinator', 'Director', 'Admin Master'],
  },
];

const ROLES_WITH_ACCESS = ['Fleet Assistant', 'Fleet Analyst', 'Supervisor', 'Manager', 'Coordinator', 'Director', 'Admin Master'];

export default function Cadastros() {
  const { user } = useAuth();

  if (user && !ROLES_WITH_ACCESS.includes(user.role)) {
    return <Navigate to="/checklists" replace />;
  }

  const visibleTabs = TABS.filter((tab) => tab.roles.includes(user?.role || ''));

  return (
    <div className="flex flex-col gap-6 h-full">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">Cadastros</h1>
        <p className="text-sm text-zinc-500 mt-1">Gerencie os cadastros da sua frota.</p>
      </div>

      {/* Tab bar */}
      <div className="border-b border-zinc-200">
        <nav className="-mb-px flex gap-1">
          {visibleTabs.map((tab) => (
            <NavLink
              key={tab.to}
              to={tab.to}
              className={({ isActive }) =>
                cn(
                  isActive
                    ? 'border-orange-500 text-orange-600 font-medium'
                    : 'border-transparent text-zinc-500 hover:text-zinc-700 hover:border-zinc-300',
                  'flex items-center whitespace-nowrap border-b-2 px-4 py-3 text-sm transition-colors'
                )
              }
            >
              {tab.name}
            </NavLink>
          ))}
        </nav>
      </div>

      {/* Sub-page content */}
      <div className="flex-1 min-h-0">
        <Outlet />
      </div>
    </div>
  );
}
