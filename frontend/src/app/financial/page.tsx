'use client';

import { useEffect, useState } from 'react';
import AuthGuard from '@/components/layout/AuthGuard';
import Modal from '@/components/ui/Modal';
import { financialApi } from '@/services/api';
import { useAuthStore } from '@/stores/authStore';
import { FinancialDashboard, ExtraExpense } from '@/types';
import {
  Users, Building2,
  ChevronDown, ChevronUp, Plus, Pencil, Trash2, Save,
  Layers, Briefcase,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useFinanceVisibilityStore } from '@/stores/financeVisibilityStore';

const MONTHS = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

const emptyExtra = { description: '', amount: '', category: '', payment_date: '', notes: '' };

type Tab = 'client' | 'member' | 'squad' | 'role';

export default function FinancialPage() {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [data, setData] = useState<FinancialDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>('client');
  const [expandedClient, setExpandedClient] = useState<number | null>(null);
  const [expandedMember, setExpandedMember] = useState<number | null>(null);
  const { isHidden } = useFinanceVisibilityStore();
  const { user } = useAuthStore();
  const isAdmin = user?.role === 'admin';

  const [editingMonthly, setEditingMonthly] = useState(false);
  const [monthlyForm, setMonthlyForm] = useState({ total_received: '', tax_amount: '', marketing_amount: '' });
  const [savingMonthly, setSavingMonthly] = useState(false);

  const [showExtraModal, setShowExtraModal] = useState(false);
  const [editingExtra, setEditingExtra] = useState<ExtraExpense | null>(null);
  const [extraForm, setExtraForm] = useState(emptyExtra);

  useEffect(() => { loadData(); }, [month, year]);

  const loadData = async () => {
    setLoading(true);
    try {
      const { data: d } = await financialApi.getDashboard({ month, year });
      setData(d);
      setMonthlyForm({
        total_received: d.total_received != null ? String(d.total_received) : '',
        tax_amount: d.tax_amount != null ? String(d.tax_amount) : '',
        marketing_amount: d.marketing_amount != null ? String(d.marketing_amount) : '',
      });
    } catch { toast.error('Erro ao carregar dados financeiros'); }
    finally { setLoading(false); }
  };

  const fmt = (v: number | null | undefined) => {
    if (v == null) return '—';
    if (isHidden) return 'R$ •••••';
    return `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
  };

  const parseNum = (s: string) => s === '' ? null : parseFloat(s.replace(',', '.'));

  const saveMonthly = async () => {
    setSavingMonthly(true);
    try {
      await financialApi.updateMonthly(month, year, {
        total_received: parseNum(monthlyForm.total_received),
        tax_amount: parseNum(monthlyForm.tax_amount),
        marketing_amount: parseNum(monthlyForm.marketing_amount),
      });
      toast.success('Dados atualizados');
      setEditingMonthly(false);
      loadData();
    } catch { toast.error('Erro ao salvar'); }
    finally { setSavingMonthly(false); }
  };

  const openCreateExtra = () => {
    setEditingExtra(null);
    setExtraForm(emptyExtra);
    setShowExtraModal(true);
  };

  const openEditExtra = (e: ExtraExpense) => {
    setEditingExtra(e);
    setExtraForm({
      description: e.description,
      amount: String(e.amount),
      category: e.category || '',
      payment_date: e.payment_date || '',
      notes: e.notes || '',
    });
    setShowExtraModal(true);
  };

  const handleExtraSubmit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    try {
      const payload = {
        description: extraForm.description,
        amount: parseFloat(extraForm.amount),
        category: extraForm.category || null,
        payment_date: extraForm.payment_date || null,
        notes: extraForm.notes || null,
      };
      if (editingExtra) {
        await financialApi.updateExtra(editingExtra.id, payload);
        toast.success('Lançamento atualizado');
      } else {
        await financialApi.createExtra({ ...payload, month, year });
        toast.success('Lançamento criado');
      }
      setShowExtraModal(false);
      loadData();
    } catch { toast.error('Erro ao salvar lançamento'); }
  };

  const deleteExtra = async (id: number) => {
    if (!confirm('Remover este lançamento?')) return;
    try {
      await financialApi.deleteExtra(id);
      toast.success('Lançamento removido');
      loadData();
    } catch { toast.error('Erro ao remover'); }
  };

  const tabs: { key: Tab; label: string; icon: React.ElementType }[] = [
    { key: 'client', label: 'Por Cliente', icon: Building2 },
    { key: 'member', label: 'Por Colaborador', icon: Users },
    { key: 'squad', label: 'Por Squad', icon: Layers },
    { key: 'role', label: 'Por Cargo', icon: Briefcase },
  ];

  // Personal view for non-admin users
  const renderPersonalView = () => {
    if (!data) return null;
    return (
      <>
        {/* Personal summary cards */}
        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="card p-4">
            <p className="text-xs text-gray-500 mb-1">Meu Valor Mensal</p>
            <p className="text-xl font-bold text-blue-600">{fmt(data.total_receivable)}</p>
            <p className="text-xs text-gray-400 mt-1">contratos ativos</p>
          </div>
          <div className="card p-4">
            <p className="text-xs text-gray-500 mb-1">Proporcional este Mês</p>
            <p className="text-xl font-bold text-emerald-600">{fmt(data.total_operational_cost)}</p>
            <p className="text-xs text-gray-400 mt-1">{data.by_client.length} cliente{data.by_client.length !== 1 ? 's' : ''}</p>
          </div>
        </div>

        {/* Client allocations */}
        <h2 className="font-semibold mb-3">Minhas Alocações por Cliente</h2>
        <div className="space-y-3">
          {data.by_client.map(c => (
            <div key={c.client_id} className="card p-4">
              <div
                className="flex items-center justify-between cursor-pointer"
                onClick={() => setExpandedClient(expandedClient === c.client_id ? null : c.client_id)}
              >
                <div>
                  <h3 className="font-semibold">{c.client_name}</h3>
                  <p className="text-xs text-gray-400">{c.allocations.length} alocação{c.allocations.length !== 1 ? 'ões' : ''}</p>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <p className="font-bold text-emerald-600">{fmt(c.total_proportional)}</p>
                    <p className="text-xs text-gray-400">de {fmt(c.total_monthly)}/mês</p>
                  </div>
                  {expandedClient === c.client_id ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </div>
              </div>
              {expandedClient === c.client_id && (
                <div className="mt-4 space-y-2 border-t dark:border-dark-700 pt-3">
                  {c.allocations.map(a => (
                    <div key={a.allocation_id} className="flex items-center justify-between text-sm bg-gray-50 dark:bg-dark-700 p-2 rounded">
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
          {data.by_client.length === 0 && (
            <div className="card p-8 text-center">
              <p className="text-gray-400">Nenhuma alocação encontrada para o período.</p>
              <p className="text-xs text-gray-400 mt-1">Sua conta pode não estar vinculada a um membro da equipe.</p>
            </div>
          )}
        </div>
      </>
    );
  };

  // Admin full view
  const renderAdminView = () => {
    if (!data) return null;
    return (
      <>
        {/* P&L Summary Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <div className="card p-4">
            <p className="text-xs text-gray-500 mb-1">A Receber</p>
            <p className="text-xl font-bold text-blue-600">{fmt(data.total_receivable)}</p>
            <p className="text-xs text-gray-400 mt-1">contratos ativos</p>
          </div>
          <div className="card p-4">
            <p className="text-xs text-gray-500 mb-1">Recebido</p>
            <p className="text-xl font-bold text-emerald-600">{fmt(data.total_received)}</p>
            <p className="text-xs text-gray-400 mt-1">valor confirmado</p>
          </div>
          <div className="card p-4">
            <p className="text-xs text-gray-500 mb-1">Custo Operacional</p>
            <p className="text-xl font-bold text-orange-600">{fmt(data.total_operational_cost)}</p>
            <p className="text-xs text-gray-400 mt-1">equipe alocada</p>
          </div>
          <div className="card p-4">
            <p className="text-xs text-gray-500 mb-1">Lucro Líquido</p>
            <p className={`text-xl font-bold ${
              data.net_profit == null ? 'text-gray-400'
              : data.net_profit >= 0 ? 'text-emerald-600' : 'text-red-600'
            }`}>
              {data.net_profit == null ? '—' : fmt(data.net_profit)}
            </p>
            <p className="text-xs text-gray-400 mt-1">
              {data.net_profit == null ? 'informe o recebido' : data.net_profit >= 0 ? 'positivo' : 'negativo'}
            </p>
          </div>
        </div>

        {/* Manual Inputs */}
        <div className="card mb-6 p-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold">Lançamentos Manuais</h2>
            {editingMonthly ? (
              <div className="flex gap-2">
                <button onClick={() => setEditingMonthly(false)} className="btn-secondary text-sm">Cancelar</button>
                <button onClick={saveMonthly} disabled={savingMonthly} className="btn-primary text-sm flex items-center gap-1">
                  <Save className="h-3.5 w-3.5" /> Salvar
                </button>
              </div>
            ) : (
              <button onClick={() => setEditingMonthly(true)} className="btn-secondary text-sm flex items-center gap-1">
                <Pencil className="h-3.5 w-3.5" /> Editar
              </button>
            )}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Total Recebido (R$)</label>
              {editingMonthly ? (
                <input className="input-field" type="number" step="0.01"
                  value={monthlyForm.total_received}
                  onChange={e => setMonthlyForm({ ...monthlyForm, total_received: e.target.value })}
                  placeholder="0.00" />
              ) : (
                <p className="font-semibold text-emerald-600">{fmt(data.total_received)}</p>
              )}
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Imposto (R$)</label>
              {editingMonthly ? (
                <input className="input-field" type="number" step="0.01"
                  value={monthlyForm.tax_amount}
                  onChange={e => setMonthlyForm({ ...monthlyForm, tax_amount: e.target.value })}
                  placeholder="0.00" />
              ) : (
                <p className="font-semibold text-red-500">{fmt(data.tax_amount)}</p>
              )}
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Marketing (R$)</label>
              {editingMonthly ? (
                <input className="input-field" type="number" step="0.01"
                  value={monthlyForm.marketing_amount}
                  onChange={e => setMonthlyForm({ ...monthlyForm, marketing_amount: e.target.value })}
                  placeholder="0.00" />
              ) : (
                <p className="font-semibold text-red-500">{fmt(data.marketing_amount)}</p>
              )}
            </div>
          </div>
        </div>

        {/* Extra Expenses */}
        <div className="card mb-6 p-4">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="font-semibold">Lançamentos Extras</h2>
              {data.extra_expenses.length > 0 && (
                <p className="text-xs text-gray-500 mt-0.5">Total: {fmt(data.total_extras)}</p>
              )}
            </div>
            <button onClick={openCreateExtra} className="btn-primary text-sm flex items-center gap-1">
              <Plus className="h-3.5 w-3.5" /> Adicionar
            </button>
          </div>
          {data.extra_expenses.length === 0 ? (
            <p className="text-gray-400 text-sm">Nenhum lançamento extra</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 dark:bg-dark-700">
                  <tr>
                    <th className="text-left px-3 py-2 font-medium text-gray-500">Descrição</th>
                    <th className="text-left px-3 py-2 font-medium text-gray-500 hidden sm:table-cell">Categoria</th>
                    <th className="text-left px-3 py-2 font-medium text-gray-500 hidden md:table-cell">Data</th>
                    <th className="text-right px-3 py-2 font-medium text-gray-500">Valor</th>
                    <th className="px-3 py-2" />
                  </tr>
                </thead>
                <tbody className="divide-y dark:divide-dark-700">
                  {data.extra_expenses.map(e => (
                    <tr key={e.id} className="hover:bg-gray-50 dark:hover:bg-dark-700">
                      <td className="px-3 py-2">
                        <p>{e.description}</p>
                        {e.notes && <p className="text-xs text-gray-400">{e.notes}</p>}
                      </td>
                      <td className="px-3 py-2 text-gray-500 hidden sm:table-cell">{e.category || '—'}</td>
                      <td className="px-3 py-2 text-gray-500 hidden md:table-cell">
                        {e.payment_date ? new Date(e.payment_date + 'T00:00:00').toLocaleDateString('pt-BR') : '—'}
                      </td>
                      <td className="px-3 py-2 text-right font-medium text-red-600">{fmt(e.amount)}</td>
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-2 justify-end">
                          <button onClick={() => openEditExtra(e)} className="text-gray-400 hover:text-primary-600">
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          <button onClick={() => deleteExtra(e.id)} className="text-gray-400 hover:text-red-600">
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Tabs */}
        <div className="mb-4 border-b dark:border-dark-700">
          <div className="flex gap-1 overflow-x-auto">
            {tabs.map(t => (
              <button
                key={t.key}
                onClick={() => setActiveTab(t.key)}
                className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium border-b-2 transition-colors -mb-px whitespace-nowrap ${
                  activeTab === t.key
                    ? 'border-primary-600 text-primary-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                }`}
              >
                <t.icon className="h-4 w-4" />
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* Tab: Por Cliente */}
        {activeTab === 'client' && (
          <div className="space-y-3">
            {data.by_client.map(c => (
              <div key={c.client_id} className="card p-4">
                <div
                  className="flex items-center justify-between cursor-pointer"
                  onClick={() => setExpandedClient(expandedClient === c.client_id ? null : c.client_id)}
                >
                  <div>
                    <h3 className="font-semibold">{c.client_name}</h3>
                    <p className="text-xs text-gray-400">{c.allocations.length} alocações</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <p className="font-bold text-orange-600">{fmt(c.total_proportional)}</p>
                      <p className="text-xs text-gray-400">de {fmt(c.total_monthly)}/mês</p>
                    </div>
                    {expandedClient === c.client_id ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  </div>
                </div>
                {expandedClient === c.client_id && (
                  <div className="mt-4 space-y-2 border-t dark:border-dark-700 pt-3">
                    {c.allocations.map(a => (
                      <div key={a.allocation_id} className="flex items-center justify-between text-sm bg-gray-50 dark:bg-dark-700 p-2 rounded">
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
        )}

        {/* Tab: Por Colaborador */}
        {activeTab === 'member' && (
          <div className="space-y-3">
            {data.by_member.map(m => (
              <div key={m.member_id} className="card p-4">
                <div
                  className="flex items-center justify-between cursor-pointer"
                  onClick={() => setExpandedMember(expandedMember === m.member_id ? null : m.member_id)}
                >
                  <div>
                    <h3 className="font-semibold">{m.member_name}</h3>
                    <p className="text-xs text-gray-400">{m.role_title || 'Sem cargo'} · {m.allocations.length} clientes</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <p className="font-bold text-orange-600">{fmt(m.total_proportional)}</p>
                      <p className="text-xs text-gray-400">de {fmt(m.total_monthly)}/mês</p>
                    </div>
                    {expandedMember === m.member_id ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  </div>
                </div>
                {expandedMember === m.member_id && (
                  <div className="mt-4 space-y-2 border-t dark:border-dark-700 pt-3">
                    {m.allocations.map(a => (
                      <div key={a.allocation_id} className="flex items-center justify-between text-sm bg-gray-50 dark:bg-dark-700 p-2 rounded">
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
        )}

        {/* Tab: Por Squad */}
        {activeTab === 'squad' && (
          <div className="space-y-3">
            {data.by_squad.map(s => (
              <div key={s.squad_id ?? 'none'} className="card p-4 flex items-center justify-between">
                <h3 className="font-semibold">{s.squad_name}</h3>
                <div className="text-right">
                  <p className="font-bold text-orange-600">{fmt(s.total_proportional)}</p>
                  <p className="text-xs text-gray-400">de {fmt(s.total_monthly)}/mês</p>
                </div>
              </div>
            ))}
            {data.by_squad.length === 0 && <p className="text-gray-400 text-sm">Nenhuma alocação no período</p>}
          </div>
        )}

        {/* Tab: Por Cargo */}
        {activeTab === 'role' && (
          <div className="space-y-3">
            {data.by_role.map(r => (
              <div key={r.role_title} className="card p-4 flex items-center justify-between">
                <h3 className="font-semibold">{r.role_title}</h3>
                <div className="text-right">
                  <p className="font-bold text-orange-600">{fmt(r.total_proportional)}</p>
                  <p className="text-xs text-gray-400">de {fmt(r.total_monthly)}/mês</p>
                </div>
              </div>
            ))}
            {data.by_role.length === 0 && <p className="text-gray-400 text-sm">Nenhuma alocação no período</p>}
          </div>
        )}
      </>
    );
  };

  return (
    <AuthGuard>
      <div>
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-3">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold">
              {data?.is_personal ? 'Meus Recebimentos' : 'Financeiro'}
            </h1>
            <p className="text-gray-500 mt-1">{MONTHS[month - 1]} {year}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex bg-gray-100 dark:bg-dark-800 rounded-lg p-1 gap-1">
              <button
                onClick={() => { setMonth(now.getMonth() + 1); setYear(now.getFullYear()); }}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                  month === now.getMonth() + 1 && year === now.getFullYear()
                    ? 'bg-primary-300 text-dark-900'
                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900'
                }`}
              >
                Este mês
              </button>
              <button
                onClick={() => {
                  const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
                  setMonth(prev.getMonth() + 1); setYear(prev.getFullYear());
                }}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                  (() => { const p = new Date(now.getFullYear(), now.getMonth() - 1, 1); return month === p.getMonth() + 1 && year === p.getFullYear(); })()
                    ? 'bg-primary-300 text-dark-900'
                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900'
                }`}
              >
                Mês passado
              </button>
            </div>
            <select className="input-field w-full sm:w-40" value={month} onChange={e => setMonth(Number(e.target.value))}>
              {MONTHS.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
            </select>
            <select className="input-field w-full sm:w-28" value={year} onChange={e => setYear(Number(e.target.value))}>
              {[2023, 2024, 2025, 2026, 2027, 2028].map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
          </div>
        ) : data ? (
          data.is_personal ? renderPersonalView() : renderAdminView()
        ) : null}
      </div>

      {/* Extra Expense Modal (admin only) */}
      {isAdmin && (
        <Modal
          isOpen={showExtraModal}
          onClose={() => setShowExtraModal(false)}
          title={editingExtra ? 'Editar Lançamento' : 'Novo Lançamento Extra'}
        >
          <form onSubmit={handleExtraSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">Descrição *</label>
              <input
                className="input-field"
                value={extraForm.description}
                onChange={e => setExtraForm({ ...extraForm, description: e.target.value })}
                required
                placeholder="Ex: Ferramenta SaaS, Fornecedor..."
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium mb-1">Valor (R$) *</label>
                <input
                  className="input-field"
                  type="number"
                  step="0.01"
                  value={extraForm.amount}
                  onChange={e => setExtraForm({ ...extraForm, amount: e.target.value })}
                  required
                  placeholder="0.00"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Categoria</label>
                <input
                  className="input-field"
                  value={extraForm.category}
                  onChange={e => setExtraForm({ ...extraForm, category: e.target.value })}
                  placeholder="Ex: Software, Tráfego..."
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Data de Pagamento</label>
              <input
                className="input-field"
                type="date"
                value={extraForm.payment_date}
                onChange={e => setExtraForm({ ...extraForm, payment_date: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Observações</label>
              <textarea
                className="input-field"
                rows={2}
                value={extraForm.notes}
                onChange={e => setExtraForm({ ...extraForm, notes: e.target.value })}
                placeholder="Detalhes adicionais..."
              />
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button type="button" onClick={() => setShowExtraModal(false)} className="btn-secondary">Cancelar</button>
              <button type="submit" className="btn-primary">{editingExtra ? 'Salvar' : 'Adicionar'}</button>
            </div>
          </form>
        </Modal>
      )}
    </AuthGuard>
  );
}
