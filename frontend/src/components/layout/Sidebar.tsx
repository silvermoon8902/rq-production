'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { clsx } from 'clsx';
import {
  LayoutDashboard,
  UserCog,
  Kanban,
  DollarSign,
  LogOut,
  Building2,
  Menu,
  X,
  Sun,
  Moon,
  Bell,
  CalendarCheck,
  Eye,
  EyeOff,
  ShieldCheck,
} from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';
import { useThemeStore } from '@/stores/themeStore';
import { useNotificationStore } from '@/stores/notificationStore';
import { useFinanceVisibilityStore } from '@/stores/financeVisibilityStore';
import { demandsApi } from '@/services/api';
import { useState, useEffect, useRef } from 'react';

const navigation = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Clientes', href: '/clients', icon: Building2 },
  { name: 'Equipe', href: '/team', icon: UserCog },
  { name: 'Demandas', href: '/demands', icon: Kanban },
  { name: 'Daily / 1:1', href: '/daily', icon: CalendarCheck },
  { name: 'Financeiro', href: '/financial', icon: DollarSign, roles: ['admin'] },
  { name: 'Usuários', href: '/users', icon: ShieldCheck, roles: ['admin'] },
];

export default function Sidebar() {
  const pathname = usePathname();
  const { user, logout } = useAuthStore();
  const { isDark, toggle } = useThemeStore();
  const { isHidden, toggle: toggleFinance } = useFinanceVisibilityStore();
  const isAdmin = user?.role === 'admin';
  const { lastSeenAt, markAllRead } = useNotificationStore();
  const [open, setOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [newDemands, setNewDemands] = useState<{ id: number; title: string; client_name: string | null }[]>([]);
  const notifRef = useRef<HTMLDivElement>(null);

  useEffect(() => { setOpen(false); }, [pathname]);

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      try {
        const res = await demandsApi.getAll({});
        const demands = res.data as { id: number; title: string; client_name: string | null; created_at: string }[];
        const cutoff = lastSeenAt ? new Date(lastSeenAt) : new Date(Date.now() - 48 * 3600000);
        const fresh = demands.filter(d => new Date(d.created_at) > cutoff);
        setNewDemands(fresh.slice(0, 10));
      } catch {
        // silently ignore
      }
    };
    load();
  }, [user, lastSeenAt]);

  // Close notif dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setNotifOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleMarkRead = () => {
    markAllRead();
    setNewDemands([]);
    setNotifOpen(false);
  };

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
        <div className="flex items-center gap-2">
          {newDemands.length > 0 && (
            <button onClick={() => setNotifOpen(!notifOpen)} className="relative p-2">
              <Bell className="h-5 w-5" />
              <span className="absolute top-1 right-1 bg-red-500 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center font-bold">
                {newDemands.length}
              </span>
            </button>
          )}
          <button onClick={() => setOpen(!open)} className="p-2">
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
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
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <img src="/logo.jpeg" alt="RQ" className="h-9 w-9 rounded-lg" />
              <div>
                <h1 className="text-lg font-bold">
                  <span className="text-primary-300">RQ</span>. Performance
                </h1>
                <p className="text-xs text-gray-500">Gestao Operacional</p>
              </div>
            </div>
            {/* Notification bell */}
            <div className="relative" ref={notifRef}>
              <button
                onClick={() => setNotifOpen(!notifOpen)}
                className="relative p-1.5 text-gray-400 hover:text-primary-300 transition-colors"
                title="Notificações"
              >
                <Bell className="h-5 w-5" />
                {newDemands.length > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 bg-red-500 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center font-bold">
                    {newDemands.length > 9 ? '9+' : newDemands.length}
                  </span>
                )}
              </button>

              {notifOpen && (
                <div className="absolute left-0 top-full mt-2 w-72 bg-dark-800 border border-dark-700 rounded-xl shadow-xl z-50">
                  <div className="flex items-center justify-between px-4 py-3 border-b border-dark-700">
                    <span className="text-sm font-semibold">Notificações</span>
                    {newDemands.length > 0 && (
                      <button onClick={handleMarkRead} className="text-xs text-primary-300 hover:text-primary-400">
                        Marcar como lido
                      </button>
                    )}
                  </div>
                  <div className="max-h-64 overflow-y-auto">
                    {newDemands.length === 0 ? (
                      <p className="text-xs text-gray-500 px-4 py-3">Nenhuma nova demanda</p>
                    ) : (
                      newDemands.map(d => (
                        <Link
                          key={d.id}
                          href="/demands"
                          onClick={() => setNotifOpen(false)}
                          className="block px-4 py-3 hover:bg-dark-700 border-b border-dark-700 last:border-0 transition-colors"
                        >
                          <p className="text-sm font-medium truncate">{d.title}</p>
                          {d.client_name && (
                            <p className="text-xs text-gray-500 mt-0.5">{d.client_name}</p>
                          )}
                        </Link>
                      ))
                    )}
                  </div>
                </div>
              )}
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
          <div className="flex items-center gap-2 mb-2">
            <button
              onClick={toggle}
              className="flex items-center gap-2 text-sm text-gray-500 hover:text-primary-300 transition-colors"
              title={isDark ? 'Modo claro' : 'Modo escuro'}
            >
              {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              {isDark ? 'Claro' : 'Escuro'}
            </button>
            {isAdmin && (
              <button
                onClick={toggleFinance}
                className={`ml-auto flex items-center gap-1.5 text-sm transition-colors ${isHidden ? 'text-amber-400 hover:text-amber-300' : 'text-gray-500 hover:text-primary-300'}`}
                title={isHidden ? 'Mostrar valores financeiros' : 'Ocultar valores financeiros'}
              >
                {isHidden ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            )}
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
