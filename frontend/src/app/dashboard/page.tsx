'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import AuthGuard from '@/components/layout/AuthGuard';
import StatusBadge from '@/components/ui/StatusBadge';
import { dashboardApi, teamApi, clientsApi } from '@/services/api';
import { useAuthStore } from '@/stores/authStore';
import { Client, Allocation } from '@/types';
import {
  Building2, Users, DollarSign, AlertTriangle,
  ArrowRight, CalendarDays, Layers, TrendingUp,
} from 'lucide-react';
import { useFinanceVisibilityStore } from '@/stores/financeVisibilityStore';

interface Stats {
  clients_total: number;
  clients_active: number;
  clients_onboarding: number;
  clients_churned: number;
  clients_inactive: number;
  total_receivable: number;
  members_active: number;
  members_total: number;
  squads_total: number;
  demands_backlog: number;
  demands_todo: number;
  demands_in_progress: number;
  demands_in_review: number;
  demands_done: number;
  demands_overdue: number;
  meetings_this_month: number;
}

const emptyStats: Stats = {
  clients_total: 0, clients_active: 0, clients_onboarding: 0,
  clients_churned: 0, clients_inactive: 0, total_receivable: 0,
  members_active: 0, members_total: 0, squads_total: 0,
  demands_backlog: 0, demands_todo: 0, demands_in_progress: 0,
  demands_in_review: 0, demands_done: 0, demands_overdue: 0,
  meetings_this_month: 0,
};

function SectionHeader({ title, href, label }: { title: string; href?: string; label?: string }) {
  return (
    <div className="flex items-center justify-between mb-3">
      <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">{title}</h2>
      {href && (
        <Link href={href} className="text-xs text-primary-600 hover:underline flex items-center gap-1">
          {label || 'Ver mais'} <ArrowRight className="h-3 w-3" />
        </Link>
      )}
    </div>
  );
}

function KpiCard({
  label, value, sub, icon: Icon, color, warn,
}: {
  label: string; value: string | number; sub?: string;
  icon: React.ElementType; color: string; warn?: boolean;
}) {
  return (
    <div className={`card flex items-center gap-4 ${warn ? 'border-l-4 border-red-500' : ''}`}>
      <div className={`${color} p-3 rounded-lg shrink-0`}>
        <Icon className="h-5 w-5 text-white" />
      </div>
      <div className="min-w-0">
        <p className="text-xs text-gray-500 truncate">{label}</p>
        <p className={`text-2xl font-bold ${warn ? 'text-red-600' : ''}`}>{value}</p>
        {sub && <p className="text-xs text-gray-400">{sub}</p>}
      </div>
    </div>
  );
}

type PeriodPreset = 'this_month' | 'last_month' | 'custom';

function getMonthRange(offset: number) {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth() + offset; // offset=0 → this month, -1 → last month
  const first = new Date(y, m, 1);
  const last = new Date(y, m + 1, 0);
  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  return { from: fmt(first), to: fmt(last) };
}

export default function DashboardPage() {
  const [stats, setStats] = useState<Stats>(emptyStats);
  const [myClients, setMyClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [periodPreset, setPeriodPreset] = useState<PeriodPreset>('this_month');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [showCustom, setShowCustom] = useState(false);
  const { user } = useAuthStore();
  const { isHidden } = useFinanceVisibilityStore();

  const isAdmin = user?.role === 'admin';
  const isNonAdmin = !isAdmin;

  const fmtMoney = (v: number) =>
    isHidden ? 'R$ •••••' : `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;

  const getDateParams = () => {
    if (periodPreset === 'this_month') {
      const r = getMonthRange(0);
      return { date_from: r.from, date_to: r.to };
    }
    if (periodPreset === 'last_month') {
      const r = getMonthRange(-1);
      return { date_from: r.from, date_to: r.to };
    }
    return { date_from: customFrom || undefined, date_to: customTo || undefined };
  };

  useEffect(() => {
    if (user) loadStats();
  }, [user, periodPreset, customFrom, customTo]);

  const loadStats = async () => {
    setLoading(true);
    try {
      const { data } = await dashboardApi.getStats(getDateParams());
      setStats(data);

      if (isNonAdmin) {
        const [clientsRes, membersRes, allocsRes] = await Promise.all([
          clientsApi.getAll(),
          teamApi.getMembers(),
          teamApi.getAllocations(),
        ]);
        const clients: Client[] = clientsRes.data;
        const members = membersRes.data;
        const allocations: Allocation[] = allocsRes.data;
        const myMember = members.find((m: any) => m.email === user?.email || m.user_id === user?.id);
        if (myMember) {
          const now = new Date();
          const myClientIds = allocations
            .filter((a) => a.member_id === myMember.id && (!a.end_date || new Date(a.end_date) >= now))
            .map((a) => a.client_id);
          setMyClients(clients.filter((c) => myClientIds.includes(c.id)));
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthGuard>
      <div>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-3">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold">Dashboard</h1>
            <p className="text-gray-500 mt-1">
              {isNonAdmin ? `Olá, ${user?.name}` : 'Visão geral da operação'}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => { setPeriodPreset('this_month'); setShowCustom(false); }}
              className={`text-sm px-3 py-1.5 rounded-lg border transition-colors ${periodPreset === 'this_month' ? 'bg-primary-600 text-white border-primary-600' : 'border-gray-200 dark:border-dark-600 hover:bg-gray-50 dark:hover:bg-dark-700'}`}
            >Este mês</button>
            <button
              onClick={() => { setPeriodPreset('last_month'); setShowCustom(false); }}
              className={`text-sm px-3 py-1.5 rounded-lg border transition-colors ${periodPreset === 'last_month' ? 'bg-primary-600 text-white border-primary-600' : 'border-gray-200 dark:border-dark-600 hover:bg-gray-50 dark:hover:bg-dark-700'}`}
            >Mês passado</button>
            <button
              onClick={() => { setPeriodPreset('custom'); setShowCustom(true); }}
              className={`text-sm px-3 py-1.5 rounded-lg border transition-colors ${periodPreset === 'custom' ? 'bg-primary-600 text-white border-primary-600' : 'border-gray-200 dark:border-dark-600 hover:bg-gray-50 dark:hover:bg-dark-700'}`}
            >Personalizado</button>
            {showCustom && (
              <div className="flex items-center gap-2 flex-wrap">
                <input
                  type="date"
                  className="input-field text-sm py-1 w-auto"
                  value={customFrom}
                  onChange={e => setCustomFrom(e.target.value)}
                />
                <span className="text-gray-400 text-sm">até</span>
                <input
                  type="date"
                  className="input-field text-sm py-1 w-auto"
                  value={customTo}
                  onChange={e => setCustomTo(e.target.value)}
                />
              </div>
            )}
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
          </div>
        ) : (
          <div className="space-y-8">

            {/* ── FINANCEIRO (admin only) ── */}
            {isAdmin && (
              <div>
                <SectionHeader title="Financeiro" href="/financial" label="Ir para financeiro" />
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  <KpiCard
                    label="A Receber (contratos ativos)"
                    value={fmtMoney(stats.total_receivable)}
                    icon={DollarSign}
                    color="bg-blue-500"
                  />
                  <KpiCard
                    label="Reuniões este mês"
                    value={stats.meetings_this_month}
                    sub="daily + 1:1"
                    icon={CalendarDays}
                    color="bg-indigo-500"
                  />
                </div>
              </div>
            )}

            {/* ── CLIENTES ── */}
            <div>
              <SectionHeader title="Clientes" href="/clients" />
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <KpiCard
                  label="Ativos"
                  value={stats.clients_active}
                  sub={`de ${stats.clients_total} total`}
                  icon={Building2}
                  color="bg-green-500"
                />
                <KpiCard
                  label="Onboarding"
                  value={stats.clients_onboarding}
                  icon={TrendingUp}
                  color="bg-blue-500"
                />
                <KpiCard
                  label="Churn"
                  value={stats.clients_churned}
                  icon={AlertTriangle}
                  color="bg-red-500"
                  warn={stats.clients_churned > 0}
                />
                <KpiCard
                  label="Inativos"
                  value={stats.clients_inactive}
                  icon={Building2}
                  color="bg-gray-400"
                />
              </div>
            </div>

            {/* ── DEMANDAS ── */}
            <div>
              <SectionHeader
                title={`Demandas${periodPreset === 'this_month' ? ' — este mês' : periodPreset === 'last_month' ? ' — mês passado' : ''}`}
                href="/demands"
              />
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                <div className="card p-3 text-center">
                  <p className="text-xs text-gray-400 mb-1">Backlog</p>
                  <p className="text-2xl font-bold">{stats.demands_backlog}</p>
                </div>
                <div className="card p-3 text-center">
                  <p className="text-xs text-gray-400 mb-1">A Fazer</p>
                  <p className="text-2xl font-bold">{stats.demands_todo}</p>
                </div>
                <div className="card p-3 text-center border-l-2 border-amber-400">
                  <p className="text-xs text-gray-400 mb-1">Em Andamento</p>
                  <p className="text-2xl font-bold text-amber-600">{stats.demands_in_progress}</p>
                </div>
                <div className="card p-3 text-center border-l-2 border-purple-400">
                  <p className="text-xs text-gray-400 mb-1">Em Revisão</p>
                  <p className="text-2xl font-bold text-purple-600">{stats.demands_in_review}</p>
                </div>
                <div className="card p-3 text-center border-l-2 border-green-400">
                  <p className="text-xs text-gray-400 mb-1">Concluídas</p>
                  <p className="text-2xl font-bold text-green-600">{stats.demands_done}</p>
                </div>
                <div className={`card p-3 text-center ${stats.demands_overdue > 0 ? 'border-l-2 border-red-500' : ''}`}>
                  <p className="text-xs text-gray-400 mb-1">Atrasadas</p>
                  <p className={`text-2xl font-bold ${stats.demands_overdue > 0 ? 'text-red-600' : ''}`}>
                    {stats.demands_overdue}
                  </p>
                </div>
              </div>
            </div>

            {/* ── EQUIPE ── */}
            {!isNonAdmin && (
              <div>
                <SectionHeader title="Equipe" href="/team" />
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <KpiCard
                    label="Membros Ativos"
                    value={stats.members_active}
                    sub={`de ${stats.members_total} total`}
                    icon={Users}
                    color="bg-purple-500"
                  />
                  <KpiCard
                    label="Squads"
                    value={stats.squads_total}
                    icon={Layers}
                    color="bg-violet-500"
                  />
                </div>
              </div>
            )}

            {/* ── COLABORADOR: Minha Carteira ── */}
            {isNonAdmin && myClients.length > 0 && (
              <div>
                <SectionHeader title={`Minha Carteira (${myClients.length})`} href="/clients" />
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {myClients.map((client) => (
                    <Link key={client.id} href={`/clients/${client.id}`}>
                      <div className="card hover:shadow-md transition-shadow cursor-pointer">
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex items-center gap-3">
                            <div className="bg-primary-100 dark:bg-primary-900/30 p-2 rounded-lg">
                              <Building2 className="h-5 w-5 text-primary-600" />
                            </div>
                            <div>
                              <h3 className="font-semibold">{client.name}</h3>
                              {client.company && <p className="text-sm text-gray-500">{client.company}</p>}
                            </div>
                          </div>
                          <StatusBadge status={client.status} />
                        </div>
                        {client.segment && (
                          <p className="text-xs text-gray-400 mt-1">Segmento: {client.segment}</p>
                        )}
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            )}

          </div>
        )}
      </div>
    </AuthGuard>
  );
}
