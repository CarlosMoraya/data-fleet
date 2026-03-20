import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  LayoutDashboard,
  Truck,
  FolderOpen,
  ClipboardCheck,
  Settings,
  LogOut,
  Users,
  Shield,
  FileStack,
  ClipboardList,
  Wrench,
  CalendarClock,
  BadgeCheck,
} from 'lucide-react';
import { cn } from '../lib/utils';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function Sidebar({ isOpen, onClose }: SidebarProps) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const navItems = [
    { name: 'Dashboard', to: '/', icon: LayoutDashboard, roles: ['Fleet Analyst', 'Supervisor', 'Manager', 'Coordinator', 'Director', 'Admin Master'] },
    { name: 'Cadastros', to: '/cadastros', icon: FolderOpen, roles: ['Fleet Assistant', 'Fleet Analyst', 'Supervisor', 'Manager', 'Coordinator', 'Director', 'Admin Master'] },
    { name: 'Checklists', to: '/checklists', icon: ClipboardCheck, roles: ['Driver', 'Yard Auditor', 'Fleet Assistant', 'Fleet Analyst', 'Supervisor', 'Manager', 'Coordinator', 'Director', 'Admin Master'] },
    { name: 'Plano de Ação', to: '/acoes', icon: ClipboardList, roles: ['Fleet Assistant', 'Fleet Analyst', 'Supervisor', 'Manager', 'Coordinator', 'Director', 'Admin Master'] },
    { name: 'Agendamentos', to: '/agendamentos', icon: CalendarClock, roles: ['Driver', 'Fleet Assistant', 'Fleet Analyst', 'Supervisor', 'Manager', 'Coordinator', 'Director', 'Admin Master'] },
    { name: 'Manutenção', to: '/manutencao', icon: Wrench, roles: ['Workshop', 'Fleet Assistant', 'Fleet Analyst', 'Supervisor', 'Manager', 'Coordinator', 'Director', 'Admin Master'] },
    { name: 'Aprovação de Orçamentos', to: '/aprovacao-orcamentos', icon: BadgeCheck, roles: ['Fleet Assistant', 'Fleet Analyst', 'Supervisor', 'Manager', 'Coordinator', 'Director', 'Admin Master'] },
    { name: 'Templates', to: '/checklist-templates', icon: FileStack, roles: ['Fleet Analyst', 'Supervisor', 'Manager', 'Coordinator', 'Director', 'Admin Master'] },
    { name: 'Configurações', to: '/settings', icon: Settings, roles: ['Fleet Assistant', 'Fleet Analyst', 'Supervisor', 'Manager', 'Coordinator', 'Director', 'Admin Master'] },
  ];

  const visibleNavItems = navItems.filter(item => item.roles.includes(user?.role || ''));

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-zinc-900/80 backdrop-blur-sm lg:hidden transition-opacity"
          onClick={onClose}
        />
      )}

      {/* Sidebar */}
      <div
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex h-full w-64 flex-col border-r border-blue-800 bg-blue-900 transition-transform duration-300 ease-in-out lg:static lg:translate-x-0",
          isOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
      <div className="flex h-[80px] shrink-0 items-center px-6 border-b border-blue-800 bg-blue-900">
        <div className="flex flex-col justify-center w-full" aria-label="BetaFleet Logo">
          <span className="text-[30px] font-bold tracking-tight text-white leading-none flex items-baseline">
            <span className="text-orange-500 mr-[2px] text-[32px]">β</span>etaFleet
          </span>
          <span className="text-[10px] font-medium text-blue-200/80 uppercase tracking-[0.25em] ml-5 mt-1">
            Fleet Management
          </span>
        </div>
      </div>

      <div className="flex flex-1 flex-col overflow-y-auto pt-5 pb-4">
        <nav className="mt-2 flex-1 space-y-1 px-3">
          {visibleNavItems.map((item) => (
            <NavLink
              key={item.name}
              to={item.to}
              end={item.to === '/'}
              onClick={onClose}
              className={({ isActive }) =>
                cn(
                  isActive
                    ? 'bg-blue-700 text-white font-medium'
                    : 'text-blue-200 hover:bg-blue-800 hover:text-white',
                  'group flex items-center rounded-xl px-3 py-2.5 text-sm font-medium transition-colors'
                )
              }
            >
              <item.icon
                className={cn('mr-3 h-5 w-5 flex-shrink-0')}
                aria-hidden="true"
              />
              {item.name}
            </NavLink>
          ))}
        </nav>
      </div>
      
      {user?.role === 'Admin Master' && (
        <div className="border-t border-blue-800 px-3 py-4">
          <p className="mb-1 px-3 text-xs font-semibold uppercase tracking-wider text-blue-400">Admin</p>
          <NavLink
            to="/admin/clients"
            onClick={onClose}
            className={({ isActive }) =>
              cn(
                isActive
                  ? 'bg-blue-700 text-white font-medium'
                  : 'text-blue-200 hover:bg-blue-800 hover:text-white',
                'group flex items-center rounded-xl px-3 py-2.5 text-sm font-medium transition-colors'
              )
            }
          >
            <Shield className="mr-3 h-5 w-5 flex-shrink-0" aria-hidden="true" />
            Clientes
          </NavLink>
          <NavLink
            to="/admin/users"
            onClick={onClose}
            className={({ isActive }) =>
              cn(
                isActive
                  ? 'bg-blue-700 text-white font-medium'
                  : 'text-blue-200 hover:bg-blue-800 hover:text-white',
                'group flex items-center rounded-xl px-3 py-2.5 text-sm font-medium transition-colors'
              )
            }
          >
            <Users className="mr-3 h-5 w-5 flex-shrink-0" aria-hidden="true" />
            Usuários
          </NavLink>
        </div>
      )}

      <div className="border-t border-blue-800 p-4">
        <button
          onClick={handleLogout}
          className="group flex w-full items-center rounded-xl px-3 py-2.5 text-sm font-medium text-blue-200 hover:bg-blue-800 hover:text-white transition-colors"
        >
          <LogOut className="mr-3 h-5 w-5 text-blue-300 group-hover:text-blue-200" aria-hidden="true" />
          Logout
        </button>
      </div>
      </div>
    </>
  );
}
