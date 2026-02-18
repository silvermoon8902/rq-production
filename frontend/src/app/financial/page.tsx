'use client';

import { useEffect, useState } from 'react';
import AuthGuard from '@/components/layout/AuthGuard';
import { financialApi } from '@/services/api';
import { FinancialDashboard } from '@/types';
import { DollarSign, TrendingUp, Users, Building2, ChevronDown, ChevronUp } from 'lucide-react';
import toast from 'react-hot-toast';

const MONTHS = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

export default function FinancialPage() {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [data, setData] = useState<FinancialDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedClient, setExpandedClient] = useState<number | null>(null);
  const [expandedMember, setExpandedMember] = useState<number | null>(null);

  useEffect(() => { loadData(); }, [month, year]);

  const loadData = async () => {
    setLoading(true);
    try {
      const { data } = await financialApi.getDashboard({ month, year });
      setData(data);
    } catch { toast.error('Erro ao carregar dados financeiros'); }
    finally { setLoading(false); }
  };

  const fmt = (v: number) => `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;

  return (
    <AuthGuard>
      <div>
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold">Financeiro</h1>
            <p className="text-gray-500 mt-1">Custos proporcionais por cliente e colaborador</p>
          </div>
          <div className="flex items-center gap-3">
            <select className="input-field w-40" value={month} onChange={e => setMonth(Number(e.target.value))}>
              {MONTHS.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
            </select>
            <select className="input-field w-28" value={year} onChange={e => setYear(Number(e.target.value))}>
              {[2024, 2025, 2026, 2027].map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
          </div>
        ) : data ? (
          <>
            <div className="card mb-8 flex items-center gap-4">
              <div className="bg-emerald-100 p-3 rounded-lg">
                <DollarSign className="h-8 w-8 text-emerald-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Custo Total Proporcional — {MONTHS[month - 1]} {year}</p>
                <p className="text-3xl font-bold">{fmt(data.total_cost)}</p>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* By Client */}
              <div>
                <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <Building2 className="h-5 w-5" /> Por Cliente
                </h2>
                <div className="space-y-3">
                  {data.by_client.map((client) => (
                    <div key={client.client_id} className="card p-4">
                      <div
                        className="flex items-center justify-between cursor-pointer"
                        onClick={() => setExpandedClient(expandedClient === client.client_id ? null : client.client_id)}
                      >
                        <div>
                          <h3 className="font-semibold">{client.client_name}</h3>
                          <p className="text-xs text-gray-400">{client.allocations.length} alocações</p>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="text-right">
                            <p className="font-bold text-emerald-600">{fmt(client.total_proportional)}</p>
                            <p className="text-xs text-gray-400">de {fmt(client.total_monthly)}/mês</p>
                          </div>
                          {expandedClient === client.client_id ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                        </div>
                      </div>
                      {expandedClient === client.client_id && (
                        <div className="mt-4 space-y-2 border-t pt-3">
                          {client.allocations.map((a) => (
                            <div key={a.allocation_id} className="flex items-center justify-between text-sm bg-gray-50 p-2 rounded">
                              <div>
                                <p className="font-medium">{a.member_name}</p>
                                <p className="text-xs text-gray-400">{a.active_days}/{a.days_in_month} dias</p>
                              </div>
                              <p className="font-medium">{fmt(a.proportional_value)}</p>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                  {data.by_client.length === 0 && <p className="text-gray-400 text-sm">Nenhuma alocação no período</p>}
                </div>
              </div>

              {/* By Member */}
              <div>
                <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <Users className="h-5 w-5" /> Por Colaborador
                </h2>
                <div className="space-y-3">
                  {data.by_member.map((member) => (
                    <div key={member.member_id} className="card p-4">
                      <div
                        className="flex items-center justify-between cursor-pointer"
                        onClick={() => setExpandedMember(expandedMember === member.member_id ? null : member.member_id)}
                      >
                        <div>
                          <h3 className="font-semibold">{member.member_name}</h3>
                          <p className="text-xs text-gray-400">{member.allocations.length} clientes</p>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="text-right">
                            <p className="font-bold text-emerald-600">{fmt(member.total_proportional)}</p>
                            <p className="text-xs text-gray-400">de {fmt(member.total_monthly)}/mês</p>
                          </div>
                          {expandedMember === member.member_id ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                        </div>
                      </div>
                      {expandedMember === member.member_id && (
                        <div className="mt-4 space-y-2 border-t pt-3">
                          {member.allocations.map((a) => (
                            <div key={a.allocation_id} className="flex items-center justify-between text-sm bg-gray-50 p-2 rounded">
                              <div>
                                <p className="font-medium">{a.client_name}</p>
                                <p className="text-xs text-gray-400">{a.active_days}/{a.days_in_month} dias</p>
                              </div>
                              <p className="font-medium">{fmt(a.proportional_value)}</p>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                  {data.by_member.length === 0 && <p className="text-gray-400 text-sm">Nenhuma alocação no período</p>}
                </div>
              </div>
            </div>
          </>
        ) : null}
      </div>
    </AuthGuard>
  );
}
