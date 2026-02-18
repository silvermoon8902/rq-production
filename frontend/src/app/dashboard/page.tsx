'use client';

import { useEffect, useState } from 'react';
import AuthGuard from '@/components/layout/AuthGuard';
import { clientsApi, teamApi, demandsApi, financialApi } from '@/services/api';
import { useAuthStore } from '@/stores/authStore';
import { Building2, Users, Kanban, DollarSign, AlertTriangle, CheckCircle2, Clock } from 'lucide-react';

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
  const [loading, setLoading] = useState(true);
  const { user } = useAuthStore();

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      const [clientsRes, membersRes, demandsRes] = await Promise.all([
        clientsApi.getAll(),
        teamApi.getMembers(),
        demandsApi.getAll(),
      ]);

      const clients = clientsRes.data;
      const members = membersRes.data;
      const demands = demandsRes.data;

      let totalCost = 0;
      if (user?.role === 'admin') {
        try {
          const financialRes = await financialApi.getDashboard();
          totalCost = financialRes.data.total_cost;
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

  const cards = [
    { label: 'Clientes Ativos', value: stats.activeClients, total: stats.totalClients, icon: Building2, color: 'bg-blue-500' },
    { label: 'Membros da Equipe', value: stats.totalMembers, icon: Users, color: 'bg-purple-500' },
    { label: 'Demandas Ativas', value: stats.activeDemands, total: stats.totalDemands, icon: Kanban, color: 'bg-amber-500' },
    { label: 'Concluídas', value: stats.completedDemands, icon: CheckCircle2, color: 'bg-green-500' },
    { label: 'Atrasadas', value: stats.overdueDemands, icon: AlertTriangle, color: 'bg-red-500' },
  ];

  if (user?.role === 'admin') {
    cards.push({
      label: 'Custo Mensal',
      value: stats.totalCost,
      icon: DollarSign,
      color: 'bg-emerald-500',
    } as any);
  }

  return (
    <AuthGuard>
      <div>
        <div className="mb-8">
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <p className="text-gray-500 mt-1">Visão geral da operação</p>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {cards.map((card) => (
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
        )}
      </div>
    </AuthGuard>
  );
}
