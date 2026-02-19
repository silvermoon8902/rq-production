'use client';

import { useEffect, useState, useMemo } from 'react';
import AuthGuard from '@/components/layout/AuthGuard';
import Modal from '@/components/ui/Modal';
import { teamApi, clientsApi, demandsApi } from '@/services/api';
import { useAuthStore } from '@/stores/authStore';
import { Squad, TeamMember, Allocation, Client, Demand } from '@/types';
import { Users, UserPlus, Link2, Pencil, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';

const emptySquadForm = { name: '', description: '' };
const emptyMemberForm = { name: '', role_title: '', squad_id: '', email: '', phone: '', status: 'active' };
const emptyAllocForm = { member_id: '', client_id: '', monthly_value: '', start_date: '', end_date: '' };

export default function TeamPage() {
  const [squads, setSquads] = useState<Squad[]>([]);
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [allocations, setAllocations] = useState<Allocation[]>([]);
  const [demands, setDemands] = useState<Demand[]>([]);
  const [loading, setLoading] = useState(true);

  // Squad modal
  const [showSquadModal, setShowSquadModal] = useState(false);
  const [editingSquad, setEditingSquad] = useState<Squad | null>(null);
  const [squadForm, setSquadForm] = useState(emptySquadForm);

  // Member modal
  const [showMemberModal, setShowMemberModal] = useState(false);
  const [editingMember, setEditingMember] = useState<TeamMember | null>(null);
  const [memberForm, setMemberForm] = useState(emptyMemberForm);

  // Allocation modal
  const [showAllocModal, setShowAllocModal] = useState(false);
  const [allocForm, setAllocForm] = useState(emptyAllocForm);

  // Filters
  const [filterSquad, setFilterSquad] = useState('');
  const [filterRole, setFilterRole] = useState('');
  const [periodDays, setPeriodDays] = useState('30');

  const { user } = useAuthStore();
  const canEdit = user?.role === 'admin' || user?.role === 'gerente';
  const isAdmin = user?.role === 'admin';

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    try {
      const [squadsRes, membersRes, clientsRes, allocsRes, demandsRes] = await Promise.all([
        teamApi.getSquads(), teamApi.getMembers(), clientsApi.getAll(),
        teamApi.getAllocations(), demandsApi.getAll(),
      ]);
      setSquads(squadsRes.data);
      setMembers(membersRes.data);
      setClients(clientsRes.data);
      setAllocations(allocsRes.data);
      setDemands(demandsRes.data);
    } catch { toast.error('Erro ao carregar dados'); }
    finally { setLoading(false); }
  };

  // Unique role titles for filter
  const roleTitles = useMemo(() => {
    const roles = new Set<string>();
    members.forEach(m => { if (m.role_title) roles.add(m.role_title); });
    return Array.from(roles).sort();
  }, [members]);

  const filteredMembers = useMemo(() => members.filter(m => {
    if (filterSquad && m.squad_id !== Number(filterSquad)) return false;
    if (filterRole && m.role_title !== filterRole) return false;
    return true;
  }), [members, filterSquad, filterRole]);

  const memberMetrics = useMemo(() => {
    const now = new Date();
    const periodMs = Number(periodDays) * 24 * 3600000;
    const periodStart = new Date(now.getTime() - periodMs);

    const map: Record<number, {
      activeClients: number; lostClients: number; retentionRate: number; churnRate: number;
      newClients: number; demandsCreated: number; demandsCompleted: number;
      demandsOverdue: number; avgSlaHours: number;
    }> = {};

    for (const member of members) {
      const memberAllocs = allocations.filter(a => a.member_id === member.id);
      const allClientIds = Array.from(new Set(memberAllocs.map(a => a.client_id)));
      const allMemberClients = clients.filter(c => allClientIds.includes(c.id));

      const activeAllocs = memberAllocs.filter(a => !a.end_date || new Date(a.end_date) >= now);
      const activeClientIds = Array.from(new Set(activeAllocs.map(a => a.client_id)));
      const activeClients = clients.filter(c => activeClientIds.includes(c.id) && c.status !== 'churned' && c.status !== 'inactive').length;

      const lostClients = allMemberClients.filter(c => c.status === 'churned' || c.status === 'inactive').length;
      const total = allMemberClients.length;
      const retentionRate = total > 0 ? Math.round(((total - lostClients) / total) * 100) : 100;
      const churnRate = 100 - retentionRate;

      const newClients = memberAllocs.filter(a => new Date(a.start_date) >= periodStart).length;

      const memberDemands = demands.filter(d => d.assigned_to_id === member.id);
      const demandsCreated = memberDemands.filter(d => new Date(d.created_at) >= periodStart).length;

      const completedInPeriod = memberDemands.filter(d =>
        d.status === 'done' && d.completed_at && new Date(d.completed_at) >= periodStart
      );
      const demandsCompleted = completedInPeriod.length;
      const demandsOverdue = memberDemands.filter(d => d.sla_status === 'overdue').length;

      const avgSlaHours = completedInPeriod.length > 0
        ? Math.round(completedInPeriod.reduce((sum, d) => {
            const ms = new Date(d.completed_at!).getTime() - new Date(d.created_at).getTime();
            return sum + ms / 3600000;
          }, 0) / completedInPeriod.length)
        : 0;

      map[member.id] = { activeClients, lostClients, retentionRate, churnRate, newClients, demandsCreated, demandsCompleted, demandsOverdue, avgSlaHours };
    }
    return map;
  }, [members, allocations, clients, demands, periodDays]);

  // Squad handlers
  const openCreateSquad = () => {
    setEditingSquad(null);
    setSquadForm(emptySquadForm);
    setShowSquadModal(true);
  };

  const openEditSquad = (squad: Squad) => {
    setEditingSquad(squad);
    setSquadForm({ name: squad.name, description: squad.description || '' });
    setShowSquadModal(true);
  };

  const handleSquadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingSquad) {
        await teamApi.updateSquad(editingSquad.id, squadForm);
        toast.success('Squad atualizado');
      } else {
        await teamApi.createSquad(squadForm);
        toast.success('Squad criado');
      }
      setShowSquadModal(false);
      loadData();
    } catch { toast.error('Erro ao salvar squad'); }
  };

  const handleDeleteSquad = async (id: number) => {
    if (!confirm('Excluir squad?')) return;
    try {
      await teamApi.deleteSquad(id);
      toast.success('Squad excluído');
      loadData();
    } catch { toast.error('Erro ao excluir squad'); }
  };

  // Member handlers
  const openCreateMember = () => {
    setEditingMember(null);
    setMemberForm(emptyMemberForm);
    setShowMemberModal(true);
  };

  const openEditMember = (member: TeamMember) => {
    setEditingMember(member);
    setMemberForm({
      name: member.name, role_title: member.role_title,
      squad_id: member.squad_id?.toString() || '',
      email: member.email || '', phone: member.phone || '',
      status: member.status,
    });
    setShowMemberModal(true);
  };

  const handleMemberSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      ...memberForm,
      squad_id: memberForm.squad_id ? Number(memberForm.squad_id) : null,
    };
    try {
      if (editingMember) {
        await teamApi.updateMember(editingMember.id, payload);
        toast.success('Membro atualizado');
      } else {
        await teamApi.createMember(payload);
        toast.success('Membro adicionado');
      }
      setShowMemberModal(false);
      loadData();
    } catch { toast.error('Erro ao salvar membro'); }
  };

  const handleDeleteMember = async (id: number) => {
    if (!confirm('Excluir membro?')) return;
    try {
      await teamApi.deleteMember(id);
      toast.success('Membro excluído');
      loadData();
    } catch { toast.error('Erro ao excluir membro'); }
  };

  // Allocation handlers
  const handleCreateAlloc = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await teamApi.createAllocation({
        member_id: Number(allocForm.member_id),
        client_id: Number(allocForm.client_id),
        monthly_value: Number(allocForm.monthly_value),
        start_date: allocForm.start_date,
        end_date: allocForm.end_date || null,
      });
      toast.success('Alocação criada');
      setShowAllocModal(false);
      setAllocForm(emptyAllocForm);
      loadData();
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || 'Erro ao criar alocação');
    }
  };

  const handleDeleteAlloc = async (id: number) => {
    if (!confirm('Remover alocação?')) return;
    try {
      await teamApi.deleteAllocation(id);
      toast.success('Alocação removida');
      loadData();
    } catch { toast.error('Erro ao remover alocação'); }
  };

  return (
    <AuthGuard>
      <div>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-3">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold">Equipe</h1>
            <p className="text-gray-500 mt-1">{members.length} membros em {squads.length} squads</p>
          </div>
          {canEdit && (
            <div className="flex flex-wrap gap-2">
              <button onClick={() => setShowAllocModal(true)} className="btn-secondary flex items-center gap-2 text-sm">
                <Link2 className="h-4 w-4" /> Alocar
              </button>
              <button onClick={openCreateSquad} className="btn-secondary flex items-center gap-2 text-sm">
                <Users className="h-4 w-4" /> Novo Squad
              </button>
              <button onClick={openCreateMember} className="btn-primary flex items-center gap-2 text-sm">
                <UserPlus className="h-4 w-4" /> Novo Membro
              </button>
            </div>
          )}
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
          </div>
        ) : (
          <>
            {/* Squads */}
            <div className="mb-8">
              <h2 className="text-lg font-semibold mb-4">Squads</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {squads.map((squad) => (
                  <div key={squad.id} className="card">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="font-semibold">{squad.name}</h3>
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-gray-500">{squad.members_count} membros</span>
                        {canEdit && (
                          <>
                            <button onClick={() => openEditSquad(squad)} className="text-gray-400 hover:text-primary-600 transition-colors">
                              <Pencil className="h-3.5 w-3.5" />
                            </button>
                            <button onClick={() => handleDeleteSquad(squad.id)} className="text-gray-400 hover:text-red-600 transition-colors">
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                    {squad.description && <p className="text-sm text-gray-400">{squad.description}</p>}
                  </div>
                ))}
                {squads.length === 0 && <p className="text-gray-400 col-span-3">Nenhum squad criado</p>}
              </div>
            </div>

            {/* Members filters */}
            <div className="flex flex-wrap items-center gap-3 mb-4">
              <h2 className="text-lg font-semibold">Membros</h2>
              <div className="flex flex-wrap gap-2 ml-auto">
                <select className="input-field text-sm py-1.5 w-auto" value={periodDays} onChange={e => setPeriodDays(e.target.value)}>
                  <option value="30">Últimos 30 dias</option>
                  <option value="90">Últimos 90 dias</option>
                  <option value="180">Últimos 6 meses</option>
                  <option value="365">Último ano</option>
                  <option value="3650">Todo período</option>
                </select>
                <select className="input-field text-sm py-1.5 w-auto" value={filterSquad} onChange={e => setFilterSquad(e.target.value)}>
                  <option value="">Todos os squads</option>
                  {squads.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
                <select className="input-field text-sm py-1.5 w-auto" value={filterRole} onChange={e => setFilterRole(e.target.value)}>
                  <option value="">Todos os cargos</option>
                  {roleTitles.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
                {(filterSquad || filterRole) && (
                  <button onClick={() => { setFilterSquad(''); setFilterRole(''); }} className="text-xs text-red-500 hover:text-red-700">
                    Limpar
                  </button>
                )}
              </div>
            </div>

            {/* Members Table */}
            <div className="bg-white rounded-xl border overflow-x-auto mb-8">
              <table className="w-full min-w-[1100px]">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Nome</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Cargo</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Squad</th>
                    <th className="text-center px-4 py-3 text-xs font-medium text-gray-500 uppercase">Ativos</th>
                    <th className="text-center px-4 py-3 text-xs font-medium text-gray-500 uppercase text-red-400">Perdidos</th>
                    <th className="text-center px-4 py-3 text-xs font-medium text-gray-500 uppercase">Retenção</th>
                    <th className="text-center px-4 py-3 text-xs font-medium text-gray-500 uppercase">Churn</th>
                    <th className="text-center px-4 py-3 text-xs font-medium text-gray-500 uppercase">Criadas</th>
                    <th className="text-center px-4 py-3 text-xs font-medium text-gray-500 uppercase">Concluídas</th>
                    <th className="text-center px-4 py-3 text-xs font-medium text-gray-500 uppercase text-red-400">Atrasadas</th>
                    <th className="text-center px-4 py-3 text-xs font-medium text-gray-500 uppercase">SLA médio</th>
                    {canEdit && <th className="text-center px-4 py-3 text-xs font-medium text-gray-500 uppercase">Ações</th>}
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {filteredMembers.map((member) => {
                    const m = memberMetrics[member.id] || {
                      activeClients: 0, lostClients: 0, retentionRate: 100, churnRate: 0,
                      newClients: 0, demandsCreated: 0, demandsCompleted: 0, demandsOverdue: 0, avgSlaHours: 0,
                    };
                    const slaDisplay = m.avgSlaHours > 0
                      ? m.avgSlaHours >= 48 ? `${Math.round(m.avgSlaHours / 24)}d` : `${m.avgSlaHours}h`
                      : '—';
                    return (
                      <tr key={member.id} className="hover:bg-gray-50">
                        <td className="px-4 py-4 font-medium">{member.name}</td>
                        <td className="px-4 py-4 text-sm text-gray-600">{member.role_title}</td>
                        <td className="px-4 py-4 text-sm text-gray-600">
                          {squads.find(s => s.id === member.squad_id)?.name || <span className="text-gray-300">—</span>}
                        </td>
                        <td className="px-4 py-4 text-center">
                          <span className="inline-flex items-center justify-center bg-green-100 text-green-800 text-sm font-semibold rounded-full w-8 h-8">
                            {m.activeClients}
                          </span>
                        </td>
                        <td className="px-4 py-4 text-center">
                          <span className={`inline-flex items-center justify-center text-sm font-semibold rounded-full w-8 h-8 ${m.lostClients > 0 ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-400'}`}>
                            {m.lostClients}
                          </span>
                        </td>
                        <td className="px-4 py-4 text-center">
                          <span className={`text-sm font-semibold ${m.retentionRate >= 80 ? 'text-green-600' : m.retentionRate >= 60 ? 'text-amber-600' : 'text-red-600'}`}>
                            {m.retentionRate}%
                          </span>
                        </td>
                        <td className="px-4 py-4 text-center">
                          <span className={`text-sm font-semibold ${m.churnRate > 20 ? 'text-red-600' : m.churnRate > 0 ? 'text-amber-600' : 'text-gray-400'}`}>
                            {m.churnRate}%
                          </span>
                        </td>
                        <td className="px-4 py-4 text-center">
                          <span className="inline-flex items-center justify-center bg-blue-100 text-blue-800 text-sm font-semibold rounded-full w-8 h-8">
                            {m.demandsCreated}
                          </span>
                        </td>
                        <td className="px-4 py-4 text-center">
                          <span className="inline-flex items-center justify-center bg-emerald-100 text-emerald-800 text-sm font-semibold rounded-full w-8 h-8">
                            {m.demandsCompleted}
                          </span>
                        </td>
                        <td className="px-4 py-4 text-center">
                          <span className={`inline-flex items-center justify-center text-sm font-semibold rounded-full w-8 h-8 ${m.demandsOverdue > 0 ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-400'}`}>
                            {m.demandsOverdue}
                          </span>
                        </td>
                        <td className="px-4 py-4 text-center text-sm font-medium text-gray-600">
                          {slaDisplay}
                        </td>
                        {canEdit && (
                          <td className="px-4 py-4 text-center">
                            <div className="flex items-center justify-center gap-2">
                              <button onClick={() => openEditMember(member)} className="text-gray-400 hover:text-primary-600 transition-colors" title="Editar">
                                <Pencil className="h-4 w-4" />
                              </button>
                              {isAdmin && (
                                <button onClick={() => handleDeleteMember(member.id)} className="text-gray-400 hover:text-red-600 transition-colors" title="Excluir">
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              )}
                            </div>
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {filteredMembers.length === 0 && (
                <p className="text-gray-400 text-center py-8">
                  {members.length === 0 ? 'Nenhum membro cadastrado' : 'Nenhum membro encontrado'}
                </p>
              )}
            </div>

            {/* Allocations */}
            <div>
              <h2 className="text-lg font-semibold mb-4">Alocações Ativas</h2>
              {allocations.filter(a => !a.end_date || new Date(a.end_date) >= new Date()).length === 0 ? (
                <p className="text-gray-400">Nenhuma alocação ativa</p>
              ) : (
                <div className="bg-white rounded-xl border overflow-x-auto">
                  <table className="w-full min-w-[600px]">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Membro</th>
                        <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Cliente</th>
                        <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Início</th>
                        {isAdmin && <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Valor/mês</th>}
                        {canEdit && <th className="px-4 py-3" />}
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {allocations
                        .filter(a => !a.end_date || new Date(a.end_date) >= new Date())
                        .map(a => (
                          <tr key={a.id} className="hover:bg-gray-50">
                            <td className="px-4 py-3 font-medium text-sm">{a.member_name}</td>
                            <td className="px-4 py-3 text-sm text-gray-600">{a.client_name}</td>
                            <td className="px-4 py-3 text-sm text-gray-500">
                              {new Date(a.start_date + 'T12:00:00').toLocaleDateString('pt-BR')}
                            </td>
                            {isAdmin && (
                              <td className="px-4 py-3 text-sm font-medium text-emerald-700">
                                R$ {a.monthly_value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                              </td>
                            )}
                            {canEdit && (
                              <td className="px-4 py-3 text-center">
                                <button onClick={() => handleDeleteAlloc(a.id)} className="text-gray-400 hover:text-red-600 transition-colors">
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              </td>
                            )}
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )}

        {/* Squad Modal */}
        <Modal isOpen={showSquadModal} onClose={() => setShowSquadModal(false)} title={editingSquad ? 'Editar Squad' : 'Novo Squad'}>
          <form onSubmit={handleSquadSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">Nome *</label>
              <input className="input-field" value={squadForm.name} onChange={e => setSquadForm({...squadForm, name: e.target.value})} required />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Descrição</label>
              <textarea className="input-field" rows={3} value={squadForm.description} onChange={e => setSquadForm({...squadForm, description: e.target.value})} />
            </div>
            <div className="flex justify-end gap-3">
              <button type="button" onClick={() => setShowSquadModal(false)} className="btn-secondary">Cancelar</button>
              <button type="submit" className="btn-primary">{editingSquad ? 'Salvar' : 'Criar'}</button>
            </div>
          </form>
        </Modal>

        {/* Member Modal */}
        <Modal isOpen={showMemberModal} onClose={() => setShowMemberModal(false)} title={editingMember ? 'Editar Membro' : 'Novo Membro'}>
          <form onSubmit={handleMemberSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">Nome *</label>
              <input className="input-field" value={memberForm.name} onChange={e => setMemberForm({...memberForm, name: e.target.value})} required />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Cargo *</label>
              <input
                className="input-field"
                value={memberForm.role_title}
                onChange={e => setMemberForm({...memberForm, role_title: e.target.value})}
                required
                placeholder="Selecione ou digite novo cargo..."
                list="role-titles-list"
              />
              <datalist id="role-titles-list">
                {roleTitles.map(r => <option key={r} value={r} />)}
              </datalist>
              <p className="text-xs text-gray-400 mt-1">Escolha um cargo existente ou digite para criar novo</p>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Squad</label>
              <select className="input-field" value={memberForm.squad_id} onChange={e => setMemberForm({...memberForm, squad_id: e.target.value})}>
                <option value="">Sem squad</option>
                {squads.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Email</label>
                <input type="email" className="input-field" value={memberForm.email} onChange={e => setMemberForm({...memberForm, email: e.target.value})} />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Telefone</label>
                <input className="input-field" value={memberForm.phone} onChange={e => setMemberForm({...memberForm, phone: e.target.value})} />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Status</label>
              <select className="input-field" value={memberForm.status} onChange={e => setMemberForm({...memberForm, status: e.target.value})}>
                <option value="active">Ativo</option>
                <option value="vacation">Férias</option>
                <option value="inactive">Inativo</option>
              </select>
            </div>
            <div className="flex justify-end gap-3">
              <button type="button" onClick={() => setShowMemberModal(false)} className="btn-secondary">Cancelar</button>
              <button type="submit" className="btn-primary">{editingMember ? 'Salvar' : 'Criar'}</button>
            </div>
          </form>
        </Modal>

        {/* Allocation Modal */}
        <Modal isOpen={showAllocModal} onClose={() => setShowAllocModal(false)} title="Nova Alocação">
          <form onSubmit={handleCreateAlloc} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">Membro *</label>
              <select className="input-field" value={allocForm.member_id} onChange={e => setAllocForm({...allocForm, member_id: e.target.value})} required>
                <option value="">Selecione...</option>
                {members.filter(m => m.status === 'active').map(m => (
                  <option key={m.id} value={m.id}>{m.name} — {m.role_title}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Cliente *</label>
              <select className="input-field" value={allocForm.client_id} onChange={e => setAllocForm({...allocForm, client_id: e.target.value})} required>
                <option value="">Selecione...</option>
                {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Valor Mensal (R$) *</label>
              <input type="number" step="0.01" className="input-field" value={allocForm.monthly_value} onChange={e => setAllocForm({...allocForm, monthly_value: e.target.value})} required />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Data Início *</label>
                <input type="date" className="input-field" value={allocForm.start_date} onChange={e => setAllocForm({...allocForm, start_date: e.target.value})} required />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Data Fim</label>
                <input type="date" className="input-field" value={allocForm.end_date} onChange={e => setAllocForm({...allocForm, end_date: e.target.value})} />
              </div>
            </div>
            <div className="flex justify-end gap-3">
              <button type="button" onClick={() => setShowAllocModal(false)} className="btn-secondary">Cancelar</button>
              <button type="submit" className="btn-primary">Criar Alocação</button>
            </div>
          </form>
        </Modal>
      </div>
    </AuthGuard>
  );
}
