'use client';

import { useEffect, useState, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import AuthGuard from '@/components/layout/AuthGuard';
import StatusBadge from '@/components/ui/StatusBadge';
import Modal from '@/components/ui/Modal';
import { clientsApi, teamApi, demandsApi, meetingsApi } from '@/services/api';
import { useAuthStore } from '@/stores/authStore';
import { useFinanceVisibilityStore } from '@/stores/financeVisibilityStore';
import { ClientDetail, TeamMember, Demand, ClientMeeting } from '@/types';
import { ArrowLeft, Building2, Users, Kanban, Trash2, Plus, DollarSign, Calendar, Globe, AtSign, Heart, Pencil, MessageSquare, Layers } from 'lucide-react';
import DemandPreviewModal from '@/components/ui/DemandPreviewModal';
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
  const [tab, setTab] = useState<'info' | 'team' | 'demands' | 'meetings'>('info');
  const [meetings, setMeetings] = useState<ClientMeeting[]>([]);
  const [meetingsLoaded, setMeetingsLoaded] = useState(false);
  const [meetingsLoading, setMeetingsLoading] = useState(false);
  const [meetingTypeFilter, setMeetingTypeFilter] = useState<'all' | 'daily' | 'one_a_one'>('all');
  const [showAllocModal, setShowAllocModal] = useState(false);
  const [allocForm, setAllocForm] = useState({ member_id: '', monthly_value: '', start_date: '' });
  const [showEditModal, setShowEditModal] = useState(false);
  const [niches, setNiches] = useState<string[]>([]);
  const [editForm, setEditForm] = useState({
    name: '', company: '', cnpj: '', responsible_name: '', phone: '', email: '',
    segment: '', status: 'active', instagram: '', website: '', notes: '',
    start_date: '', end_date: '',
    monthly_value: '', min_contract_months: '', operational_cost: '',
  });
  const [filterDemandMember, setFilterDemandMember] = useState('');
  const [filterDemandType, setFilterDemandType] = useState('');
  const [filterDemandStatus, setFilterDemandStatus] = useState('');
  const [previewDemand, setPreviewDemand] = useState<import('@/types').Demand | null>(null);
  const { user } = useAuthStore();
  const isAdmin = user?.role === 'admin';
  const canEdit = user?.role === 'admin' || user?.role === 'gerente';
  const { isHidden } = useFinanceVisibilityStore();
  const fmtMoney = (v: number) => isHidden ? 'R$ •••••' : `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;

  const demandTypes = useMemo(() => {
    const types = new Set(demands.map(d => d.demand_type).filter(Boolean) as string[]);
    return Array.from(types).sort();
  }, [demands]);

  const filteredDemands = useMemo(() => demands.filter(d => {
    if (filterDemandMember && d.assigned_to_id !== Number(filterDemandMember)) return false;
    if (filterDemandType && d.demand_type !== filterDemandType) return false;
    if (filterDemandStatus && d.sla_status !== filterDemandStatus) return false;
    return true;
  }), [demands, filterDemandMember, filterDemandType, filterDemandStatus]);

  const assignedMembers = useMemo(() => {
    const ids = new Set(demands.map(d => d.assigned_to_id).filter(Boolean));
    return members.filter(m => ids.has(m.id));
  }, [demands, members]);

  useEffect(() => { loadAll(); }, [clientId]);

  const loadAll = async () => {
    try {
      const [clientRes, membersRes, demandsRes, nichesRes] = await Promise.all([
        clientsApi.getById(clientId),
        teamApi.getMembers(),
        demandsApi.getAll({ client_id: clientId }),
        clientsApi.getNiches(),
      ]);
      setClient(clientRes.data);
      setMembers(membersRes.data);
      setDemands(demandsRes.data);
      setNiches(nichesRes.data);
    } catch {
      toast.error('Erro ao carregar cliente');
      router.push('/clients');
    } finally {
      setLoading(false);
    }
  };

  const loadMeetings = async () => {
    if (meetingsLoaded) return;
    setMeetingsLoading(true);
    try {
      const res = await meetingsApi.getAll({ client_id: clientId });
      setMeetings(res.data);
      setMeetingsLoaded(true);
    } catch { toast.error('Erro ao carregar reuniões'); }
    finally { setMeetingsLoading(false); }
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

  const openEdit = () => {
    if (!client) return;
    setEditForm({
      name: client.name, company: client.company || '', cnpj: client.cnpj || '',
      responsible_name: client.responsible_name || '', phone: client.phone || '',
      email: client.email || '', segment: client.segment || '', status: client.status,
      instagram: client.instagram || '', website: client.website || '',
      notes: client.notes || '', start_date: client.start_date || '',
      end_date: client.end_date || '',
      monthly_value: client.monthly_value?.toString() || '',
      min_contract_months: client.min_contract_months?.toString() || '',
      operational_cost: client.operational_cost?.toString() || '',
    });
    setShowEditModal(true);
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload: any = {
        name: editForm.name,
        company: editForm.company || null, cnpj: editForm.cnpj || null,
        responsible_name: editForm.responsible_name || null, phone: editForm.phone || null,
        email: editForm.email || null, segment: editForm.segment || null,
        status: editForm.status, instagram: editForm.instagram || null,
        website: editForm.website || null, notes: editForm.notes || null,
        start_date: editForm.start_date || null, end_date: editForm.end_date || null,
      };
      if (isAdmin) {
        payload.monthly_value = editForm.monthly_value ? Number(editForm.monthly_value) : null;
        payload.min_contract_months = editForm.min_contract_months ? Number(editForm.min_contract_months) : null;
        payload.operational_cost = editForm.operational_cost ? Number(editForm.operational_cost) : null;
      }
      await clientsApi.update(clientId, payload);
      toast.success('Cliente atualizado');
      setShowEditModal(false);
      loadAll();
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || 'Erro ao salvar cliente');
    }
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

  const ltv = client.monthly_value && client.min_contract_months
    ? (client.monthly_value * client.min_contract_months)
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
          <div className="flex items-center gap-3">
            {canEdit && (
              <button onClick={openEdit} className="flex items-center gap-2 text-primary-600 hover:text-primary-700 text-sm font-medium">
                <Pencil className="h-4 w-4" /> Editar
              </button>
            )}
            {isAdmin && (
              <button onClick={handleDeleteClient} className="flex items-center gap-2 text-red-500 hover:text-red-700 text-sm">
                <Trash2 className="h-4 w-4" /> Excluir
              </button>
            )}
          </div>
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
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
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
          <div className="card flex items-center gap-3 p-4">
            <div className={`p-2 rounded-lg ${client.health_score === null ? 'bg-gray-100' : client.health_score >= 8 ? 'bg-green-100' : client.health_score >= 5 ? 'bg-yellow-100' : 'bg-red-100'}`}>
              <Heart className={`h-4 w-4 ${client.health_score === null ? 'text-gray-400' : client.health_score >= 8 ? 'text-green-600' : client.health_score >= 5 ? 'text-yellow-600' : 'text-red-600'}`} />
            </div>
            <div>
              <p className="text-xs text-gray-500">Health Score</p>
              <p className={`text-lg font-bold ${client.health_score === null ? 'text-gray-400' : client.health_score >= 8 ? 'text-green-600' : client.health_score >= 5 ? 'text-yellow-600' : 'text-red-600'}`}>
                {client.health_score !== null ? client.health_score.toFixed(1) : '—'}
              </p>
            </div>
          </div>
          {isAdmin && client.monthly_value ? (
            <div className="card flex items-center gap-3 p-4">
              <div className="bg-emerald-100 p-2 rounded-lg"><DollarSign className="h-4 w-4 text-emerald-600" /></div>
              <div>
                <p className="text-xs text-gray-500">Valor Mensal</p>
                <p className="text-lg font-bold">{isHidden ? 'R$ •••••' : `R$ ${client.monthly_value.toLocaleString('pt-BR', { minimumFractionDigits: 0 })}`}</p>
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
        <div className="flex gap-1 border-b mb-6 overflow-x-auto">
          {([
            { key: 'info', label: 'Informações' },
            { key: 'team', label: `Equipe (${client.allocations.length})` },
            { key: 'demands', label: `Demandas (${demands.length})` },
            { key: 'meetings', label: 'Reuniões' },
          ] as { key: typeof tab; label: string }[]).map(t => (
            <button
              key={t.key}
              onClick={() => {
                setTab(t.key);
                if (t.key === 'meetings') loadMeetings();
              }}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                tab === t.key ? 'border-primary-600 text-primary-600' : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {t.label}
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
                          {fmtMoney(client.monthly_value)}
                        </dd>
                      </div>
                    ) : null}
                    {client.operational_cost ? (
                      <div className="flex justify-between">
                        <dt className="text-gray-500">Custo Operacional</dt>
                        <dd className="font-medium text-red-600">
                          {fmtMoney(client.operational_cost)}
                        </dd>
                      </div>
                    ) : null}
                    {margin !== null && client.monthly_value ? (
                      <div className="flex justify-between border-t pt-2">
                        <dt className="text-gray-600 font-medium">Margem</dt>
                        <dd className={`font-semibold ${margin >= 0 ? 'text-emerald-700' : 'text-red-600'}`}>
                          {isHidden ? 'R$ •••••' : `R$ ${margin.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
                          {!isHidden && marginPct !== null && (
                            <span className="text-xs text-gray-400 ml-1">({marginPct}%)</span>
                          )}
                        </dd>
                      </div>
                    ) : null}
                    {ltv ? (
                      <div className="flex justify-between">
                        <dt className="text-gray-500">LTV contrato mínimo</dt>
                        <dd className="font-semibold">{fmtMoney(ltv)}</dd>
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
                          {isHidden ? 'R$ •••••' : `R$ ${alloc.monthly_value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}/mês
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
            {demands.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
                <select className="input-field text-sm" value={filterDemandMember} onChange={e => setFilterDemandMember(e.target.value)}>
                  <option value="">Todos colaboradores</option>
                  {assignedMembers.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                </select>
                <select className="input-field text-sm" value={filterDemandType} onChange={e => setFilterDemandType(e.target.value)}>
                  <option value="">Todos os tipos</option>
                  {demandTypes.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
                <select className="input-field text-sm" value={filterDemandStatus} onChange={e => setFilterDemandStatus(e.target.value)}>
                  <option value="">Todos os status SLA</option>
                  <option value="on_time">No prazo</option>
                  <option value="warning">Atenção</option>
                  <option value="overdue">Atrasado</option>
                </select>
              </div>
            )}
            {filteredDemands.length === 0 ? (
              <p className="text-center py-12 text-gray-400">
                {demands.length === 0 ? 'Nenhuma demanda para este cliente' : 'Nenhuma demanda encontrada'}
              </p>
            ) : (
              <div className="space-y-3">
                {filteredDemands.map((d) => (
                  <div
                    key={d.id}
                    className={`card border-l-4 cursor-pointer hover:shadow-md transition-shadow ${slaColors[d.sla_status] || 'border-l-gray-200'}`}
                    onClick={() => setPreviewDemand(d)}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <span className="text-base">{priorityEmoji[d.priority]}</span>
                          <h3 className="font-medium">{d.title}</h3>
                          <StatusBadge status={d.sla_status} />
                          {d.column_name && (
                            <span className="inline-flex items-center gap-1 text-xs bg-gray-100 dark:bg-dark-700 px-2 py-0.5 rounded">
                              <Layers className="h-3 w-3" /> {d.column_name}
                            </span>
                          )}
                        </div>
                        {d.description && (
                          <p className="text-sm text-gray-500 line-clamp-2 mb-2">{d.description}</p>
                        )}
                        <div className="flex flex-wrap gap-3 text-xs text-gray-400">
                          {d.demand_type && (
                            <span className="bg-gray-100 dark:bg-dark-700 px-2 py-0.5 rounded">{d.demand_type}</span>
                          )}
                          {d.assigned_to_name && <span>Resp.: {d.assigned_to_name}</span>}
                          <span>{formatTimeAgo(d.created_at)}</span>
                          {d.due_date && (
                            <span className={new Date(d.due_date) < new Date() ? 'text-red-500 font-medium' : ''}>
                              Prazo: {new Date(d.due_date).toLocaleDateString('pt-BR')}
                            </span>
                          )}
                          {d.comments_count > 0 && (
                            <span className="flex items-center gap-1">
                              <MessageSquare className="h-3 w-3" /> {d.comments_count}
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

        {/* Tab: Reuniões */}
        {tab === 'meetings' && (
          <div>
            {/* Sub-filter */}
            <div className="flex gap-2 mb-4">
              {(['all', 'daily', 'one_a_one'] as const).map(t => (
                <button
                  key={t}
                  onClick={() => setMeetingTypeFilter(t)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-full transition-colors ${
                    meetingTypeFilter === t
                      ? 'bg-primary-300 text-dark-900'
                      : 'bg-gray-100 dark:bg-dark-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200'
                  }`}
                >
                  {t === 'all' ? 'Todos' : t === 'daily' ? 'Daily' : '1:1'}
                </button>
              ))}
            </div>

            {meetingsLoading ? (
              <div className="flex justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
              </div>
            ) : (() => {
              const filtered = meetings.filter(m =>
                meetingTypeFilter === 'all' || m.meeting_type === meetingTypeFilter
              );
              if (filtered.length === 0) {
                return (
                  <p className="text-center py-12 text-gray-400">
                    Nenhuma reunião registrada
                  </p>
                );
              }
              return (
                <div className="space-y-3">
                  {filtered.map(m => (
                    <div key={m.id} className="card p-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                              m.meeting_type === 'daily'
                                ? 'bg-blue-100 text-blue-700'
                                : 'bg-purple-100 text-purple-700'
                            }`}>
                              {m.meeting_type === 'daily' ? 'Daily' : '1:1'}
                            </span>
                            {m.member_name && (
                              <span className="text-sm text-gray-600">{m.member_name}</span>
                            )}
                          </div>
                          {m.notes && (
                            <p className="text-sm text-gray-600 dark:text-gray-300 mt-1 whitespace-pre-wrap">{m.notes}</p>
                          )}
                        </div>
                        <div className="text-right flex-shrink-0">
                          <p className="text-sm text-gray-500">
                            {new Date(m.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                          </p>
                          {m.health_score != null && (
                            <p className={`text-sm font-bold mt-0.5 ${
                              m.health_score >= 8 ? 'text-green-600' : m.health_score >= 5 ? 'text-yellow-600' : 'text-red-600'
                            }`}>
                              HS: {m.health_score}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              );
            })()}
          </div>
        )}

        {/* Edit Client Modal */}
        <Modal isOpen={showEditModal} onClose={() => setShowEditModal(false)} title="Editar Cliente" size="lg">
          <form onSubmit={handleEditSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Nome Fantasia *</label>
                <input className="input-field" value={editForm.name} onChange={e => setEditForm({...editForm, name: e.target.value})} required />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Razão Social</label>
                <input className="input-field" value={editForm.company} onChange={e => setEditForm({...editForm, company: e.target.value})} />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">CNPJ</label>
                <input className="input-field" value={editForm.cnpj} onChange={e => setEditForm({...editForm, cnpj: e.target.value})} />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Status</label>
                <select className="input-field" value={editForm.status} onChange={e => setEditForm({...editForm, status: e.target.value})}>
                  <option value="active">Ativo</option>
                  <option value="onboarding">Onboarding</option>
                  <option value="churned">Churned</option>
                  <option value="inactive">Inativo</option>
                </select>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Responsável</label>
                <input className="input-field" value={editForm.responsible_name} onChange={e => setEditForm({...editForm, responsible_name: e.target.value})} />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Celular</label>
                <input className="input-field" value={editForm.phone} onChange={e => setEditForm({...editForm, phone: e.target.value})} />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Email</label>
                <input type="email" className="input-field" value={editForm.email} onChange={e => setEditForm({...editForm, email: e.target.value})} />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Nicho / Segmento</label>
                <input className="input-field" value={editForm.segment} onChange={e => setEditForm({...editForm, segment: e.target.value})}
                  list="edit-niches-list" placeholder="Ex: Odontologia..." />
                <datalist id="edit-niches-list">
                  {niches.map(n => <option key={n} value={n} />)}
                </datalist>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Instagram</label>
                <input className="input-field" value={editForm.instagram} onChange={e => setEditForm({...editForm, instagram: e.target.value})} placeholder="@perfil" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Site</label>
                <input className="input-field" value={editForm.website} onChange={e => setEditForm({...editForm, website: e.target.value})} placeholder="https://..." />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Data Início</label>
                <input type="date" className="input-field" value={editForm.start_date} onChange={e => setEditForm({...editForm, start_date: e.target.value})} />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Data Final</label>
                <input type="date" className="input-field" value={editForm.end_date} onChange={e => setEditForm({...editForm, end_date: e.target.value})} />
                {editForm.end_date && <p className="text-xs text-amber-600 mt-1">Status será alterado para Churned</p>}
              </div>
            </div>
            {isAdmin && (
              <div className="bg-gray-50 dark:bg-dark-700 rounded-lg p-4 border dark:border-dark-600">
                <p className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide mb-3">Financeiro (Admin)</p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">Valor Mensal (R$)</label>
                    <input type="number" step="0.01" className="input-field" value={editForm.monthly_value} onChange={e => setEditForm({...editForm, monthly_value: e.target.value})} placeholder="0,00" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Período Mínimo (meses)</label>
                    <input type="number" className="input-field" value={editForm.min_contract_months} onChange={e => setEditForm({...editForm, min_contract_months: e.target.value})} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Custo Operacional (R$)</label>
                    <input type="number" step="0.01" className="input-field" value={editForm.operational_cost} onChange={e => setEditForm({...editForm, operational_cost: e.target.value})} placeholder="0,00" />
                  </div>
                </div>
              </div>
            )}
            <div>
              <label className="block text-sm font-medium mb-1">Observações</label>
              <textarea className="input-field" rows={3} value={editForm.notes} onChange={e => setEditForm({...editForm, notes: e.target.value})} />
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button type="button" onClick={() => setShowEditModal(false)} className="btn-secondary">Cancelar</button>
              <button type="submit" className="btn-primary">Salvar</button>
            </div>
          </form>
        </Modal>

        {/* Demand Preview Modal */}
        <DemandPreviewModal demand={previewDemand} onClose={() => setPreviewDemand(null)} />

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
