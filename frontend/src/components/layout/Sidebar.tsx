'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { clsx } from 'clsx';
import {
  LayoutDashboard,
  Users,
  UserCog,
  Kanban,
  DollarSign,
  LogOut,
  Building2,
  Menu,
  X,
} from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';
import { useState, useEffect } from 'react';

const navigation = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Clientes', href: '/clients', icon: Building2 },
  { name: 'Equipe', href: '/team', icon: UserCog },
  { name: 'Demandas', href: '/demands', icon: Kanban },
  { name: 'Financeiro', href: '/financial', icon: DollarSign, roles: ['admin'] },
];

export default function Sidebar() {
  const pathname = usePathname();
  const { user, logout } = useAuthStore();
  const [open, setOpen] = useState(false);

  useEffect(() => { setOpen(false); }, [pathname]);

  return (
    <>
      {/* Mobile top bar */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-40 bg-dark-950 text-white flex items-center justify-between px-4 h-14">
        <div className="flex items-center gap-3">
          <img src="/logo.jpeg" alt="RQ" className="h-8 w-8 rounded-lg" />
          <span className="text-sm font-bold">
            <span className="text-primary-300">RQ</span>. Performance
          </span>
        </div>
        <button onClick={() => setOpen(!open)} className="p-2">
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {/* Overlay */}
      {open && (
        <div className="md:hidden fixed inset-0 z-40 bg-black/50" onClick={() => setOpen(false)} />
      )}

      {/* Sidebar */}
      <aside
        className={clsx(
          'fixed left-0 top-0 h-full w-64 bg-dark-950 text-white flex flex-col z-50 transition-transform duration-200',
          open ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        )}
      >
        <div className="p-6 border-b border-dark-800">
          <div className="flex items-center gap-3">
            <img src="/logo.jpeg" alt="RQ" className="h-9 w-9 rounded-lg" />
            <div>
              <h1 className="text-lg font-bold">
                <span className="text-primary-300">RQ</span>. Performance
              </h1>
              <p className="text-xs text-gray-500">Gestao Operacional</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 p-4 space-y-1">
          {navigation
            .filter((item) => !item.roles || (user && item.roles.includes(user.role)))
            .map((item) => {
              const isActive = pathname.startsWith(item.href);
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={clsx(
                    'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                    isActive
                      ? 'bg-primary-300/10 text-primary-300 border border-primary-300/20'
                      : 'text-gray-400 hover:bg-dark-800 hover:text-white'
                  )}
                >
                  <item.icon className="h-5 w-5" />
                  {item.name}
                </Link>
              );
            })}
        </nav>

        <div className="p-4 border-t border-dark-800">
          <div className="flex items-center gap-3 mb-3">
            <div className="h-8 w-8 bg-primary-300 rounded-full flex items-center justify-center text-sm font-bold text-dark-900">
              {user?.name?.charAt(0) || 'U'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{user?.name}</p>
              <p className="text-xs text-gray-500 capitalize">{user?.role}</p>
            </div>
          </div>
          <button
            onClick={logout}
            className="flex items-center gap-2 text-sm text-gray-500 hover:text-primary-300 transition-colors w-full"
          >
            <LogOut className="h-4 w-4" />
            Sair
          </button>
        </div>
      </aside>
    </>
  );
}
