import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { 
  LayoutDashboard, 
  Truck, 
  ClipboardCheck, 
  Settings, 
  LogOut,
  Building2,
  Users
} from 'lucide-react';
import { cn } from '../lib/utils';

export default function Sidebar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const navItems = [
    { name: 'Dashboard', to: '/', icon: LayoutDashboard, roles: ['Fleet Analyst', 'Manager', 'Director', 'Admin Master'] },
    { name: 'Vehicles', to: '/vehicles', icon: Truck, roles: ['Fleet Assistant', 'Fleet Analyst', 'Manager', 'Director', 'Admin Master'] },
    { name: 'Checklists', to: '/checklists', icon: ClipboardCheck, roles: ['Driver', 'Yard Auditor', 'Fleet Assistant', 'Fleet Analyst', 'Manager', 'Director', 'Admin Master'] },
    { name: 'Users', to: '/users', icon: Users, roles: ['Manager', 'Director', 'Admin Master'] },
    { name: 'Settings', to: '/settings', icon: Settings, roles: ['Manager', 'Director', 'Admin Master'] },
  ];

  const visibleNavItems = navItems.filter(item => item.roles.includes(user?.role || ''));

  return (
    <div className="flex h-full w-64 flex-col border-r border-zinc-200 bg-zinc-50">
      <div className="flex h-16 shrink-0 items-center px-6 border-b border-zinc-200 bg-white">
        <div className="flex items-center gap-2">
          <div className="bg-zinc-900 p-1.5 rounded-lg">
            <Truck className="h-5 w-5 text-white" />
          </div>
          <span className="text-lg font-semibold tracking-tight text-zinc-900">Data Fleet</span>
        </div>
      </div>
      
      <div className="flex flex-1 flex-col overflow-y-auto pt-5 pb-4">
        <nav className="mt-2 flex-1 space-y-1 px-3">
          {visibleNavItems.map((item) => (
            <NavLink
              key={item.name}
              to={item.to}
              className={({ isActive }) =>
                cn(
                  isActive
                    ? 'bg-zinc-200 text-zinc-900 font-medium'
                    : 'text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900',
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
      
      <div className="border-t border-zinc-200 p-4">
        <button
          onClick={handleLogout}
          className="group flex w-full items-center rounded-xl px-3 py-2.5 text-sm font-medium text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 transition-colors"
        >
          <LogOut className="mr-3 h-5 w-5 text-zinc-400 group-hover:text-zinc-500" aria-hidden="true" />
          Logout
        </button>
      </div>
    </div>
  );
}
