'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import AuthGuard from '@/components/layout/AuthGuard';
import StatusBadge from '@/components/ui/StatusBadge';
import Modal from '@/components/ui/Modal';
import { clientsApi, teamApi, demandsApi } from '@/services/api';
import { useAuthStore } from '@/stores/authStore';
import { ClientDetail, TeamMember, Demand } from '@/types';
import { ArrowLeft, Building2, Users, Kanban, Trash2, Plus, DollarSign, Calendar, Globe, AtSign } from 'lucide-react';
import toast from 'react-hot-toast';

const priorityEmoji: Record<string, string> = {
  low: '🟢', medium: '🟡', high: '🟠', urgent: '🚨',
};

const slaColors: Record<string, string> = {
  on_time: 'border-l-green-500', warning: 'border-l-yellow-500', overdue: 'border-l-red-500',
};

export default function ClientDetailPage() {
  const params = useParams();
  const router = useRouter();
  const clientId = Number(params.id);
  const [client, setClient] = useState<ClientDetail | null>(null);
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [demands, setDemands] = useState<Demand[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'info' | 'team' | 'demands'>('info');
  const [showAllocModal, setShowAllocModal] = useState(false);
  const [allocForm, setAllocForm] = useState({ member_id: '', monthly_value: '', start_date: '' });
  const { user } = useAuthStore();
  const isAdmin = user?.role === 'admin';
  const canEdit = user?.role === 'admin' || user?.role === 'gerente';

  useEffect(() => { loadAll(); }, [clientId]);

  const loadAll = async () => {
    try {
      const [clientRes, membersRes, demandsRes] = await Promise.all([
        clientsApi.getById(clientId),
        teamApi.getMembers(),
        demandsApi.getAll({ client_id: clientId }),
      ]);
      setClient(clientRes.data);
      setMembers(membersRes.data);
      setDemands(demandsRes.data);
    } catch {
      toast.error('Erro ao carregar cliente');
      router.push('/clients');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteAllocation = async (allocId: number) => {
    if (!confirm('Remover alocação?')) return;
    try {
      await teamApi.deleteAllocation(allocId);
      toast.success('Alocação removida');
      loadAll();
    } catch { toast.error('Erro ao remover alocação'); }
  };

  const handleAllocate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await teamApi.createAllocation({
        member_id: Number(allocForm.member_id),
        client_id: clientId,
        monthly_value: Number(allocForm.monthly_value) || 0,
        start_date: allocForm.start_date,
      });
      toast.success('Membro alocado');
      setShowAllocModal(false);
      setAllocForm({ member_id: '', monthly_value: '', start_date: '' });
      loadAll();
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || 'Erro ao alocar membro');
    }
  };

  const handleDeleteClient = async () => {
    if (!confirm(`Excluir cliente "${client?.name}"? Esta ação não pode ser desfeita.`)) return;
    try {
      await clientsApi.delete(clientId);
      toast.success('Cliente excluído');
      router.push('/clients');
    } catch { toast.error('Erro ao excluir cliente'); }
  };

  const formatActiveDays = (days: number | null) => {
    if (!days || days <= 0) return null;
    if (days < 30) return `${days} dias`;
    if (days < 365) {
      const months = Math.floor(days / 30);
      return `${months} ${months === 1 ? 'mês' : 'meses'}`;
    }
    const years = Math.floor(days / 365);
    const months = Math.floor((days % 365) / 30);
    return months > 0 ? `${years}a ${months}m` : `${years} ${years === 1 ? 'ano' : 'anos'}`;
  };

  const formatTimeAgo = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const hours = Math.floor(diff / 3600000);
    if (hours < 1) return 'Agora';
    if (hours < 24) return `Criado há ${hours}h`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `Criado há ${days}d`;
    return `Criado há ${Math.floor(days / 7)}sem`;
  };

  if (loading) {
    return (
      <AuthGuard>
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
        </div>
      </AuthGuard>
    );
  }

  if (!client) return null;

  const ltv = client.monthly_value && client.active_days && client.active_days > 0
    ? (client.monthly_value * (client.active_days / 30))
    : null;

  const margin = client.monthly_value && client.operational_cost
    ? client.monthly_value - client.operational_cost
    : null;

  const marginPct = margin && client.monthly_value
    ? Math.round((margin / client.monthly_value) * 100)
    : null;

  const minContractEndDate = client.start_date && client.min_contract_months
    ? (() => {
        const d = new Date(client.start_date + 'T12:00:00');
        d.setMonth(d.getMonth() + client.min_contract_months);
        return d.toLocaleDateString('pt-BR');
      })()
    : null;

  const availableMembers = members.filter(m =>
    !client.allocations.some(a => a.member_id === m.id)
  );

  return (
    <AuthGuard>
      <div>
        {/* Top nav */}
        <div className="flex items-center justify-between mb-6">
          <button onClick={() => router.push('/clients')} className="flex items-center gap-2 text-gray-500 hover:text-gray-700 text-sm">
            <ArrowLeft className="h-4 w-4" /> Voltar para Clientes
          </button>
          {isAdmin && (
            <button onClick={handleDeleteClient} className="flex items-center gap-2 text-red-500 hover:text-red-700 text-sm">
              <Trash2 className="h-4 w-4" /> Excluir Cliente
            </button>
          )}
        </div>

        {/* Client header */}
        <div className="flex items-start justify-between mb-6 gap-4">
          <div className="flex items-center gap-4">
            <div className="bg-primary-100 p-3 rounded-xl flex-shrink-0">
              <Building2 className="h-7 w-7 text-primary-600" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold">{client.name}</h1>
              {client.company && <p className="text-gray-500 text-sm">{client.company}</p>}
              {client.active_days && client.active_days > 0 && (
                <p className="text-xs text-gray-400 mt-0.5">Ativo há {formatActiveDays(client.active_days)}</p>
              )}
            </div>
          </div>
          <StatusBadge status={client.status} />
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          <div className="card flex items-center gap-3 p-4">
            <div className="bg-blue-100 p-2 rounded-lg"><Kanban className="h-4 w-4 text-blue-600" /></div>
            <div>
              <p className="text-xs text-gray-500">Demandas Ativas</p>
              <p className="text-lg font-bold">{client.active_demands_count}</p>
            </div>
          </div>
          <div className="card flex items-center gap-3 p-4">
            <div className="bg-purple-100 p-2 rounded-lg"><Users className="h-4 w-4 text-purple-600" /></div>
            <div>
              <p className="text-xs text-gray-500">Equipe</p>
              <p className="text-lg font-bold">{client.allocations.length}</p>
            </div>
          </div>
          {isAdmin && client.monthly_value ? (
            <div className="card flex items-center gap-3 p-4">
              <div className="bg-emerald-100 p-2 rounded-lg"><DollarSign className="h-4 w-4 text-emerald-600" /></div>
              <div>
                <p className="text-xs text-gray-500">Valor Mensal</p>
                <p className="text-lg font-bold">R$ {client.monthly_value.toLocaleString('pt-BR', { minimumFractionDigits: 0 })}</p>
              </div>
            </div>
          ) : <div />}
          {client.start_date ? (
            <div className="card flex items-center gap-3 p-4">
              <div className="bg-amber-100 p-2 rounded-lg"><Calendar className="h-4 w-4 text-amber-600" /></div>
              <div>
                <p className="text-xs text-gray-500">Início</p>
                <p className="text-lg font-bold">{new Date(client.start_date + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' })}</p>
              </div>
            </div>
          ) : <div />}
        </div>

        {/* Tabs */}
        <div className="flex gap-1 border-b mb-6">
          {(['info', 'team', 'demands'] as const).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                tab === t ? 'border-primary-600 text-primary-600' : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {t === 'info' ? 'Informações' : t === 'team' ? `Equipe (${client.allocations.length})` : `Demandas (${demands.length})`}
            </button>
          ))}
        </div>

        {/* Tab: Informações */}
        {tab === 'info' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="card space-y-4">
              <h2 className="font-semibold text-gray-700">Contato e Dados</h2>
              <dl className="space-y-3 text-sm">
                {client.cnpj && (
                  <div className="flex justify-between">
                    <dt className="text-gray-500">CNPJ</dt>
                    <dd className="font-medium">{client.cnpj}</dd>
                  </div>
                )}
                {client.responsible_name && (
                  <div className="flex justify-between">
                    <dt className="text-gray-500">Responsável</dt>
                    <dd className="font-medium">{client.responsible_name}</dd>
                  </div>
                )}
                {client.phone && (
                  <div className="flex justify-between">
                    <dt className="text-gray-500">Celular</dt>
                    <dd className="font-medium">{client.phone}</dd>
                  </div>
                )}
                {client.email && (
                  <div className="flex justify-between">
                    <dt className="text-gray-500">Email</dt>
                    <dd className="font-medium">{client.email}</dd>
                  </div>
                )}
                {client.segment && (
                  <div className="flex justify-between">
                    <dt className="text-gray-500">Nicho</dt>
                    <dd className="font-medium">{client.segment}</dd>
                  </div>
                )}
                {client.instagram && (
                  <div className="flex justify-between items-center">
                    <dt className="text-gray-500 flex items-center gap-1"><AtSign className="h-3 w-3" /> Instagram</dt>
                    <dd className="font-medium">{client.instagram}</dd>
                  </div>
                )}
                {client.website && (
                  <div className="flex justify-between items-center">
                    <dt className="text-gray-500 flex items-center gap-1"><Globe className="h-3 w-3" /> Site</dt>
                    <dd>
                      <a href={client.website} target="_blank" rel="noopener noreferrer" className="text-primary-600 hover:underline truncate max-w-[200px] block">
                        {client.website}
                      </a>
                    </dd>
                  </div>
                )}
              </dl>
              {client.notes && (
                <div className="pt-3 border-t">
                  <p className="text-xs text-gray-500 mb-1">Observações</p>
                  <p className="text-sm whitespace-pre-wrap text-gray-700">{client.notes}</p>
                </div>
              )}
            </div>

            <div className="space-y-4">
              <div className="card space-y-3">
                <h2 className="font-semibold text-gray-700">Período de Contrato</h2>
                <dl className="space-y-2 text-sm">
                  {client.start_date && (
                    <div className="flex justify-between">
                      <dt className="text-gray-500">Data Início</dt>
                      <dd className="font-medium">{new Date(client.start_date + 'T12:00:00').toLocaleDateString('pt-BR')}</dd>
                    </div>
                  )}
                  {client.end_date && (
                    <div className="flex justify-between">
                      <dt className="text-gray-500">Data Final</dt>
                      <dd className="font-medium text-amber-600">{new Date(client.end_date + 'T12:00:00').toLocaleDateString('pt-BR')}</dd>
                    </div>
                  )}
                  {client.min_contract_months && (
                    <div className="flex justify-between">
                      <dt className="text-gray-500">Período Mínimo</dt>
                      <dd className="font-medium">{client.min_contract_months} meses</dd>
                    </div>
                  )}
                  {minContractEndDate && (
                    <div className="flex justify-between">
                      <dt className="text-gray-500">Fim do Mínimo</dt>
                      <dd className="font-medium">{minContractEndDate}</dd>
                    </div>
                  )}
                  {client.active_days && client.active_days > 0 && (
                    <div className="flex justify-between">
                      <dt className="text-gray-500">Tempo Ativo</dt>
                      <dd className="font-medium">{formatActiveDays(client.active_days)}</dd>
                    </div>
                  )}
                </dl>
              </div>

              {isAdmin && (
                <div className="card space-y-3 border-2 border-emerald-100">
                  <h2 className="font-semibold text-gray-700 flex items-center gap-2">
                    <DollarSign className="h-4 w-4 text-emerald-600" /> Financeiro (Admin)
                  </h2>
                  <dl className="space-y-2 text-sm">
                    {client.monthly_value ? (
                      <div className="flex justify-between">
                        <dt className="text-gray-500">Valor Mensal</dt>
                        <dd className="font-semibold text-emerald-700">
                          R$ {client.monthly_value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </dd>
                      </div>
                    ) : null}
                    {client.operational_cost ? (
                      <div className="flex justify-between">
                        <dt className="text-gray-500">Custo Operacional</dt>
                        <dd className="font-medium text-red-600">
                          R$ {client.operational_cost.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </dd>
                      </div>
                    ) : null}
                    {margin !== null && client.monthly_value ? (
                      <div className="flex justify-between border-t pt-2">
                        <dt className="text-gray-600 font-medium">Margem</dt>
                        <dd className={`font-semibold ${margin >= 0 ? 'text-emerald-700' : 'text-red-600'}`}>
                          R$ {margin.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                          {marginPct !== null && (
                            <span className="text-xs text-gray-400 ml-1">({marginPct}%)</span>
                          )}
                        </dd>
                      </div>
                    ) : null}
                    {ltv ? (
                      <div className="flex justify-between">
                        <dt className="text-gray-500">LTV estimado</dt>
                        <dd className="font-semibold">R$ {ltv.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</dd>
                      </div>
                    ) : null}
                  </dl>
                  {!client.monthly_value && (
                    <p className="text-xs text-gray-400">Nenhum dado financeiro cadastrado</p>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Tab: Equipe */}
        {tab === 'team' && (
          <div>
            {canEdit && (
              <div className="flex justify-end mb-4">
                <button onClick={() => setShowAllocModal(true)} className="btn-primary flex items-center gap-2 text-sm">
                  <Plus className="h-4 w-4" /> Alocar Membro
                </button>
              </div>
            )}
            {client.allocations.length === 0 ? (
              <p className="text-center py-12 text-gray-400">Nenhum membro alocado</p>
            ) : (
              <div className="space-y-3">
                {client.allocations.map((alloc) => (
                  <div key={alloc.id} className="card flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div className="bg-purple-100 p-2 rounded-lg">
                        <Users className="h-4 w-4 text-purple-600" />
                      </div>
                      <div>
                        <p className="font-semibold">{alloc.member_name}</p>
                        <p className="text-sm text-gray-500">{alloc.role_title}</p>
                        <p className="text-xs text-gray-400">Desde {new Date(alloc.start_date + 'T12:00:00').toLocaleDateString('pt-BR')}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      {isAdmin && alloc.monthly_value > 0 && (
                        <span className="text-sm font-medium text-emerald-700">
                          R$ {alloc.monthly_value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}/mês
                        </span>
                      )}
                      {canEdit && (
                        <button
                          onClick={() => handleDeleteAllocation(alloc.id)}
                          className="text-red-400 hover:text-red-600 transition-colors"
                          title="Remover alocação"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Tab: Demandas */}
        {tab === 'demands' && (
          <div>
            {demands.length === 0 ? (
              <p className="text-center py-12 text-gray-400">Nenhuma demanda para este cliente</p>
            ) : (
              <div className="space-y-3">
                {demands.map((d) => (
                  <div key={d.id} className={`card border-l-4 ${slaColors[d.sla_status] || 'border-l-gray-200'}`}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <span className="text-base">{priorityEmoji[d.priority]}</span>
                          <h3 className="font-medium">{d.title}</h3>
                          <StatusBadge status={d.sla_status} />
                        </div>
                        {d.description && (
                          <p className="text-sm text-gray-500 line-clamp-2 mb-2">{d.description}</p>
                        )}
                        <div className="flex flex-wrap gap-3 text-xs text-gray-400">
                          {d.demand_type && (
                            <span className="bg-gray-100 px-2 py-0.5 rounded">{d.demand_type}</span>
                          )}
                          {d.assigned_to_name && <span>Resp.: {d.assigned_to_name}</span>}
                          <span>{formatTimeAgo(d.created_at)}</span>
                          {d.due_date && (
                            <span className={new Date(d.due_date) < new Date() ? 'text-red-500 font-medium' : ''}>
                              Prazo: {new Date(d.due_date).toLocaleDateString('pt-BR')}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Allocate Modal */}
        <Modal isOpen={showAllocModal} onClose={() => setShowAllocModal(false)} title="Alocar Membro">
          <form onSubmit={handleAllocate} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">Membro *</label>
              <select
                className="input-field"
                value={allocForm.member_id}
                onChange={e => setAllocForm({...allocForm, member_id: e.target.value})}
                required
              >
                <option value="">Selecione...</option>
                {availableMembers.map(m => (
                  <option key={m.id} value={m.id}>{m.name} — {m.role_title}</option>
                ))}
              </select>
              {availableMembers.length === 0 && (
                <p className="text-xs text-amber-600 mt-1">Todos os membros já estão alocados neste cliente</p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Data Início *</label>
              <input
                type="date"
                className="input-field"
                value={allocForm.start_date}
                onChange={e => setAllocForm({...allocForm, start_date: e.target.value})}
                required
              />
            </div>
            {isAdmin && (
              <div>
                <label className="block text-sm font-medium mb-1">Valor Mensal (R$)</label>
                <input
                  type="number"
                  step="0.01"
                  className="input-field"
                  value={allocForm.monthly_value}
                  onChange={e => setAllocForm({...allocForm, monthly_value: e.target.value})}
                  placeholder="0,00"
                />
              </div>
            )}
            <div className="flex justify-end gap-3 pt-2">
              <button type="button" onClick={() => setShowAllocModal(false)} className="btn-secondary">Cancelar</button>
              <button type="submit" className="btn-primary" disabled={availableMembers.length === 0}>Alocar</button>
            </div>
          </form>
        </Modal>
      </div>
    </AuthGuard>
  );
}
