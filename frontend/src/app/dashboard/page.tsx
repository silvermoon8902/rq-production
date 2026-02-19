'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import AuthGuard from '@/components/layout/AuthGuard';
import StatusBadge from '@/components/ui/StatusBadge';
import { clientsApi, teamApi, demandsApi, financialApi } from '@/services/api';
import { useAuthStore } from '@/stores/authStore';
import { Client, Allocation } from '@/types';
import { Building2, Users, Kanban, DollarSign, AlertTriangle, CheckCircle2, Briefcase } from 'lucide-react';

interface DashboardStats {
  totalClients: number;
  activeClients: number;
  totalMembers: number;
  totalDemands: number;
  activeDemands: number;
  overdueDemands: number;
  completedDemands: number;
  totalCost: number;
}

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats>({
    totalClients: 0, activeClients: 0, totalMembers: 0,
    totalDemands: 0, activeDemands: 0, overdueDemands: 0,
    completedDemands: 0, totalCost: 0,
  });
  const [myClients, setMyClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuthStore();

  const isAdmin = user?.role === 'admin';
  const isColaborador = user?.role === 'colaborador';

  useEffect(() => {
    if (user) loadStats();
  }, [user]);

  const loadStats = async () => {
    try {
      const [clientsRes, membersRes, demandsRes] = await Promise.all([
        clientsApi.getAll(),
        teamApi.getMembers(),
        demandsApi.getAll(),
      ]);

      const clients: Client[] = clientsRes.data;
      const members = membersRes.data;
      const demands = demandsRes.data;

      let totalCost = 0;
      if (isAdmin) {
        try {
          const financialRes = await financialApi.getDashboard();
          totalCost = financialRes.data.total_cost;
        } catch {}
      }

      // For colaborador: find their team member and show their client portfolio
      if (isColaborador && user) {
        try {
          const allocsRes = await teamApi.getAllocations();
          const allocations: Allocation[] = allocsRes.data;
          const myMember = members.find((m: any) => m.email === user.email || m.user_id === user.id);
          if (myMember) {
            const now = new Date();
            const myAllocClientIds = allocations
              .filter((a: Allocation) => a.member_id === myMember.id && (!a.end_date || new Date(a.end_date) >= now))
              .map((a: Allocation) => a.client_id);
            setMyClients(clients.filter((c: Client) => myAllocClientIds.includes(c.id)));
          }
        } catch {}
      }

      setStats({
        totalClients: clients.length,
        activeClients: clients.filter((c: any) => c.status === 'active').length,
        totalMembers: members.length,
        totalDemands: demands.length,
        activeDemands: demands.filter((d: any) => d.status !== 'done').length,
        overdueDemands: demands.filter((d: any) => d.sla_status === 'overdue').length,
        completedDemands: demands.filter((d: any) => d.status === 'done').length,
        totalCost,
      });
    } catch (err) {
      console.error('Error loading dashboard stats:', err);
    } finally {
      setLoading(false);
    }
  };

  const adminCards = [
    { label: 'Clientes Ativos', value: stats.activeClients, total: stats.totalClients, icon: Building2, color: 'bg-blue-500' },
    { label: 'Membros da Equipe', value: stats.totalMembers, icon: Users, color: 'bg-purple-500' },
    { label: 'Demandas Ativas', value: stats.activeDemands, total: stats.totalDemands, icon: Kanban, color: 'bg-amber-500' },
    { label: 'Concluídas', value: stats.completedDemands, icon: CheckCircle2, color: 'bg-green-500' },
    { label: 'Atrasadas', value: stats.overdueDemands, icon: AlertTriangle, color: 'bg-red-500' },
    ...(isAdmin ? [{ label: 'Custo Mensal', value: stats.totalCost, icon: DollarSign, color: 'bg-emerald-500' }] : []),
  ];

  const colaboradorCards = [
    { label: 'Minha Carteira', value: myClients.length, icon: Briefcase, color: 'bg-blue-500' },
    { label: 'Clientes Ativos', value: myClients.filter(c => c.status === 'active').length, icon: Building2, color: 'bg-green-500' },
    { label: 'Demandas Ativas', value: stats.activeDemands, total: stats.totalDemands, icon: Kanban, color: 'bg-amber-500' },
    { label: 'Atrasadas', value: stats.overdueDemands, icon: AlertTriangle, color: 'bg-red-500' },
  ];

  const cards = isColaborador ? colaboradorCards : adminCards;

  return (
    <AuthGuard>
      <div>
        <div className="mb-8">
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <p className="text-gray-500 mt-1">
            {isColaborador ? `Olá, ${user?.name}` : 'Visão geral da operação'}
          </p>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
              {cards.map((card: any) => (
                <div key={card.label} className="card flex items-center gap-4">
                  <div className={`${card.color} p-3 rounded-lg`}>
                    <card.icon className="h-6 w-6 text-white" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">{card.label}</p>
                    <p className="text-2xl font-bold">
                      {card.label === 'Custo Mensal'
                        ? `R$ ${(card.value as number).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
                        : card.value}
                    </p>
                    {'total' in card && card.total !== undefined && (
                      <p className="text-xs text-gray-400">de {card.total} total</p>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Colaborador: client portfolio */}
            {isColaborador && myClients.length > 0 && (
              <div>
                <h2 className="text-lg font-semibold mb-4">Minha Carteira de Clientes</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {myClients.map((client) => (
                    <Link key={client.id} href={`/clients/${client.id}`}>
                      <div className="card hover:shadow-md transition-shadow cursor-pointer">
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex items-center gap-3">
                            <div className="bg-primary-100 p-2 rounded-lg">
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
                          <p className="text-xs text-gray-400">Segmento: {client.segment}</p>
                        )}
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </AuthGuard>
  );
}
