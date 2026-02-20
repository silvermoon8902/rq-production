'use client';

import { useEffect, useState, useMemo } from 'react';
import AuthGuard from '@/components/layout/AuthGuard';
import Modal from '@/components/ui/Modal';
import { teamApi, clientsApi, demandsApi, authApi } from '@/services/api';
import { User as UserType } from '@/types';
import { useAuthStore } from '@/stores/authStore';
import { useFinanceVisibilityStore } from '@/stores/financeVisibilityStore';
import { Squad, TeamMember, Allocation, Client, Demand } from '@/types';
import { Users, UserPlus, Link2, Pencil, Trash2, Plus, X, Layers } from 'lucide-react';
import toast from 'react-hot-toast';

const emptySquadForm = { name: '', description: '' };
const emptyMemberForm = { name: '', role_title: '', squad_ids: [] as number[], email: '', phone: '', status: 'active', user_id: '' };
const emptyAllocForm = { member_id: '', client_id: '', monthly_value: '', start_date: '', end_date: '' };

export default function TeamPage() {
  const [squads, setSquads] = useState<Squad[]>([]);
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [users, setUsers] = useState<UserType[]>([]);
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

  // Bulk allocation
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [bulkFilterSquad, setBulkFilterSquad] = useState('');
  const [bulkFilterRole, setBulkFilterRole] = useState('');
  const [bulkStartDate, setBulkStartDate] = useState(new Date().toISOString().slice(0, 10));
  // staged: { [clientId]: { member_id: number, monthly_value: string }[] }
  const [bulkStaged, setBulkStaged] = useState<Record<number, { member_id: number; monthly_value: string }[]>>({});
  const [bulkSaving, setBulkSaving] = useState(false);

  // Filters
  const [filterSquad, setFilterSquad] = useState('');
  const [filterRole, setFilterRole] = useState('');
  const [periodDays, setPeriodDays] = useState('30');

  const { user } = useAuthStore();
  const canEdit = user?.role === 'admin' || user?.role === 'gerente';
  const isAdmin = user?.role === 'admin';
  const { isHidden } = useFinanceVisibilityStore();

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
      if (isAdmin) {
        const usersRes = await authApi.getUsers();
        setUsers(usersRes.data);
      }
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
      demandsOverdue: number; avgSlaHours: number; avgHealthScore: number | null;
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

      const activeClientsWithScore = clients.filter(
        c => activeClientIds.includes(c.id) && c.status !== 'churned' && c.status !== 'inactive' && c.health_score !== null
      );
      const avgHealthScore = activeClientsWithScore.length > 0
        ? Math.round(activeClientsWithScore.reduce((sum, c) => sum + (c.health_score ?? 0), 0) / activeClientsWithScore.length * 10) / 10
        : null;

      map[member.id] = { activeClients, lostClients, retentionRate, churnRate, newClients, demandsCreated, demandsCompleted, demandsOverdue, avgSlaHours, avgHealthScore };
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
      name: member.name,
      role_title: member.role_title,
      squad_ids: member.squad_ids?.length ? member.squad_ids : (member.squad_id ? [member.squad_id] : []),
      email: member.email || '',
      phone: member.phone || '',
      status: member.status,
      user_id: member.user_id?.toString() || '',
    });
    setShowMemberModal(true);
  };

  const handleMemberSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      name: memberForm.name,
      role_title: memberForm.role_title,
      squad_ids: memberForm.squad_ids,
      squad_id: memberForm.squad_ids[0] ?? null,
      email: memberForm.email || null,
      phone: memberForm.phone || null,
      status: memberForm.status,
      user_id: memberForm.user_id ? Number(memberForm.user_id) : null,
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
    const today = new Date().toISOString().slice(0, 10);
    try {
      await teamApi.createAllocation({
        member_id: Number(allocForm.member_id),
        client_id: Number(allocForm.client_id),
        monthly_value: Number(allocForm.monthly_value),
        start_date: allocForm.start_date || today,
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

  // Bulk allocation helpers
  const bulkFilteredMembers = useMemo(() => members.filter(m => {
    if (m.status !== 'active') return false;
    if (bulkFilterSquad && m.squad_id !== Number(bulkFilterSquad)) return false;
    if (bulkFilterRole && m.role_title !== bulkFilterRole) return false;
    return true;
  }), [members, bulkFilterSquad, bulkFilterRole]);

  const addBulkRow = (clientId: number) => {
    setBulkStaged(prev => ({
      ...prev,
      [clientId]: [...(prev[clientId] || []), { member_id: 0, monthly_value: '' }],
    }));
  };

  const removeBulkRow = (clientId: number, idx: number) => {
    setBulkStaged(prev => {
      const rows = [...(prev[clientId] || [])];
      rows.splice(idx, 1);
      return { ...prev, [clientId]: rows };
    });
  };

  const updateBulkRow = (clientId: number, idx: number, field: 'member_id' | 'monthly_value', value: string) => {
    setBulkStaged(prev => {
      const rows = [...(prev[clientId] || [])];
      rows[idx] = { ...rows[idx], [field]: field === 'member_id' ? Number(value) : value };
      return { ...prev, [clientId]: rows };
    });
  };

  const handleSaveBulk = async () => {
    const items: any[] = [];
    for (const [clientIdStr, rows] of Object.entries(bulkStaged)) {
      const clientId = Number(clientIdStr);
      for (const row of rows) {
        if (!row.member_id) continue;
        items.push({
          member_id: row.member_id,
          client_id: clientId,
          monthly_value: Number(row.monthly_value) || 0,
          start_date: bulkStartDate,
        });
      }
    }
    if (items.length === 0) { toast.error('Nenhuma alocação para salvar'); return; }
    setBulkSaving(true);
    try {
      const { data } = await teamApi.createBulkAllocations(items);
      toast.success(`${data.created} alocaç${data.created !== 1 ? 'ões' : 'ão'} criada${data.created !== 1 ? 's' : ''}${data.skipped > 0 ? ` (${data.skipped} ignorada${data.skipped !== 1 ? 's' : ''})` : ''}`);
      setShowBulkModal(false);
      setBulkStaged({});
      loadData();
    } catch { toast.error('Erro ao salvar alocações'); }
    finally { setBulkSaving(false); }
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
              <button onClick={() => setShowBulkModal(true)} className="btn-secondary flex items-center gap-2 text-sm">
                <Layers className="h-4 w-4" /> Alocação em Massa
              </button>
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
            <div className="bg-white dark:bg-dark-800 rounded-xl border dark:border-dark-700 overflow-x-auto mb-8">
              <table className="w-full min-w-[1100px]">
                <thead className="bg-gray-50 dark:bg-dark-700">
                  <tr>
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Nome</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Cargo</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Squad</th>
                    <th className="text-center px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Ativos</th>
                    <th className="text-center px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase text-red-400">Perdidos</th>
                    <th className="text-center px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Retenção</th>
                    <th className="text-center px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Churn</th>
                    <th className="text-center px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Criadas</th>
                    <th className="text-center px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Concluídas</th>
                    <th className="text-center px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase text-red-400">Atrasadas</th>
                    <th className="text-center px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">SLA médio</th>
                    <th className="text-center px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Health Score</th>
                    {canEdit && <th className="text-center px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Ações</th>}
                  </tr>
                </thead>
                <tbody className="divide-y dark:divide-dark-700">
                  {filteredMembers.map((member) => {
                    const m = memberMetrics[member.id] || {
                      activeClients: 0, lostClients: 0, retentionRate: 100, churnRate: 0,
                      newClients: 0, demandsCreated: 0, demandsCompleted: 0, demandsOverdue: 0, avgSlaHours: 0, avgHealthScore: null,
                    };
                    const slaDisplay = m.avgSlaHours > 0
                      ? m.avgSlaHours >= 48 ? `${Math.round(m.avgSlaHours / 24)}d` : `${m.avgSlaHours}h`
                      : '—';
                    return (
                      <tr key={member.id} className="hover:bg-gray-50 dark:hover:bg-dark-700">
                        <td className="px-4 py-4 font-medium">{member.name}</td>
                        <td className="px-4 py-4 text-sm text-gray-600 dark:text-gray-400">{member.role_title}</td>
                        <td className="px-4 py-4 text-sm text-gray-600 dark:text-gray-400">
                          {(member.squad_ids?.length
                            ? member.squad_ids.map(sid => squads.find(s => s.id === sid)?.name).filter(Boolean)
                            : member.squad_id ? [squads.find(s => s.id === member.squad_id)?.name] : []
                          ).map((name, i) => (
                            <span key={i} className="inline-block bg-gray-100 dark:bg-dark-600 rounded px-1.5 py-0.5 text-xs mr-1">{name}</span>
                          )) || <span className="text-gray-300">—</span>}
                        </td>
                        <td className="px-4 py-4 text-center">
                          <span className="inline-flex items-center justify-center bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-400 text-sm font-semibold rounded-full w-8 h-8">
                            {m.activeClients}
                          </span>
                        </td>
                        <td className="px-4 py-4 text-center">
                          <span className={`inline-flex items-center justify-center text-sm font-semibold rounded-full w-8 h-8 ${m.lostClients > 0 ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400' : 'bg-gray-100 dark:bg-dark-600 text-gray-400'}`}>
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
                          <span className="inline-flex items-center justify-center bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-400 text-sm font-semibold rounded-full w-8 h-8">
                            {m.demandsCreated}
                          </span>
                        </td>
                        <td className="px-4 py-4 text-center">
                          <span className="inline-flex items-center justify-center bg-emerald-100 dark:bg-emerald-900/30 text-emerald-800 dark:text-emerald-400 text-sm font-semibold rounded-full w-8 h-8">
                            {m.demandsCompleted}
                          </span>
                        </td>
                        <td className="px-4 py-4 text-center">
                          <span className={`inline-flex items-center justify-center text-sm font-semibold rounded-full w-8 h-8 ${m.demandsOverdue > 0 ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400' : 'bg-gray-100 dark:bg-dark-600 text-gray-400'}`}>
                            {m.demandsOverdue}
                          </span>
                        </td>
                        <td className="px-4 py-4 text-center text-sm font-medium text-gray-600 dark:text-gray-400">
                          {slaDisplay}
                        </td>
                        <td className="px-4 py-4 text-center">
                          {m.avgHealthScore !== null ? (
                            <span className={`text-sm font-bold ${m.avgHealthScore >= 8 ? 'text-green-600' : m.avgHealthScore >= 5 ? 'text-yellow-600' : 'text-red-600'}`}>
                              {m.avgHealthScore.toFixed(1)}
                            </span>
                          ) : (
                            <span className="text-gray-400 text-sm">—</span>
                          )}
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
                <div className="bg-white dark:bg-dark-800 rounded-xl border dark:border-dark-700 overflow-x-auto">
                  <table className="w-full min-w-[600px]">
                    <thead className="bg-gray-50 dark:bg-dark-700">
                      <tr>
                        <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Membro</th>
                        <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Cliente</th>
                        <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Início</th>
                        {isAdmin && <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Valor/mês</th>}
                        {canEdit && <th className="px-4 py-3" />}
                      </tr>
                    </thead>
                    <tbody className="divide-y dark:divide-dark-700">
                      {allocations
                        .filter(a => !a.end_date || new Date(a.end_date) >= new Date())
                        .map(a => (
                          <tr key={a.id} className="hover:bg-gray-50 dark:hover:bg-dark-700">
                            <td className="px-4 py-3 font-medium text-sm">{a.member_name}</td>
                            <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">{a.client_name}</td>
                            <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">
                              {new Date(a.start_date + 'T12:00:00').toLocaleDateString('pt-BR')}
                            </td>
                            {isAdmin && (
                              <td className="px-4 py-3 text-sm font-medium text-emerald-700">
                                {isHidden ? 'R$ •••••' : `R$ ${a.monthly_value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
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

            {/* Multi-squad checkboxes */}
            <div>
              <label className="block text-sm font-medium mb-2">Squads</label>
              <div className="grid grid-cols-2 gap-2">
                {squads.map(s => (
                  <label key={s.id} className="flex items-center gap-2 cursor-pointer text-sm p-2 rounded border dark:border-dark-600 hover:bg-gray-50 dark:hover:bg-dark-700">
                    <input
                      type="checkbox"
                      checked={memberForm.squad_ids.includes(s.id)}
                      onChange={e => {
                        const ids = e.target.checked
                          ? [...memberForm.squad_ids, s.id]
                          : memberForm.squad_ids.filter(id => id !== s.id);
                        setMemberForm({ ...memberForm, squad_ids: ids });
                      }}
                      className="rounded"
                    />
                    {s.name}
                  </label>
                ))}
                {squads.length === 0 && <p className="text-gray-400 text-sm col-span-2">Nenhum squad criado</p>}
              </div>
            </div>

            {/* User link — admin only */}
            {isAdmin && (
              <div>
                <label className="block text-sm font-medium mb-1">Usuário do sistema</label>
                <select
                  className="input-field"
                  value={memberForm.user_id}
                  onChange={e => setMemberForm({ ...memberForm, user_id: e.target.value })}
                >
                  <option value="">Sem vínculo</option>
                  {users.map(u => (
                    <option key={u.id} value={u.id}>{u.name} ({u.email})</option>
                  ))}
                </select>
                <p className="text-xs text-gray-400 mt-1">Vincule a um usuário para que o membro veja seus dados no dashboard</p>
              </div>
            )}

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

        {/* Bulk Allocation Modal */}
        <Modal isOpen={showBulkModal} onClose={() => { setShowBulkModal(false); setBulkStaged({}); }} title="Alocação em Massa" size="lg">
          <div className="space-y-4">
            {/* Filters */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Squad</label>
                <select className="input-field text-sm" value={bulkFilterSquad} onChange={e => setBulkFilterSquad(e.target.value)}>
                  <option value="">Todos os squads</option>
                  {squads.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Cargo</label>
                <select className="input-field text-sm" value={bulkFilterRole} onChange={e => setBulkFilterRole(e.target.value)}>
                  <option value="">Todos os cargos</option>
                  {roleTitles.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Data Início</label>
                <input type="date" className="input-field text-sm" value={bulkStartDate} onChange={e => setBulkStartDate(e.target.value)} />
              </div>
            </div>

            {bulkFilteredMembers.length === 0 && (
              <p className="text-sm text-amber-600 bg-amber-50 dark:bg-amber-900/20 rounded-lg p-3">
                Nenhum membro ativo encontrado com os filtros selecionados.
              </p>
            )}

            {/* Client list */}
            <div className="max-h-[50vh] overflow-y-auto space-y-3 pr-1">
              {clients.map(client => {
                const rows = bulkStaged[client.id] || [];
                const existingAllocs = allocations.filter(a =>
                  a.client_id === client.id && (!a.end_date || new Date(a.end_date) >= new Date())
                );
                // Members already allocated to this client (by member_id)
                const alreadyAllocatedIds = new Set(existingAllocs.map(a => a.member_id));
                const availableForClient = bulkFilteredMembers.filter(m => !alreadyAllocatedIds.has(m.id));

                return (
                  <div key={client.id} className="border dark:border-dark-700 rounded-xl p-3">
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <span className="font-medium text-sm">{client.name}</span>
                        {/* Existing allocations as chips */}
                        {existingAllocs.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1">
                            {existingAllocs.map(a => (
                              <span key={a.id} className="text-xs bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 px-2 py-0.5 rounded-full">
                                {a.member_name}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                      <button
                        onClick={() => addBulkRow(client.id)}
                        disabled={availableForClient.length === 0}
                        className="btn-secondary text-xs flex items-center gap-1 py-1 px-2 disabled:opacity-40"
                        title={availableForClient.length === 0 ? 'Todos os membros filtrados já estão alocados' : 'Adicionar alocação'}
                      >
                        <Plus className="h-3 w-3" /> Adicionar
                      </button>
                    </div>

                    {rows.map((row, idx) => (
                      <div key={idx} className="flex items-center gap-2 mt-2">
                        <select
                          className="input-field text-sm flex-1"
                          value={row.member_id || ''}
                          onChange={e => updateBulkRow(client.id, idx, 'member_id', e.target.value)}
                        >
                          <option value="">Selecione o membro...</option>
                          {availableForClient.map(m => (
                            <option key={m.id} value={m.id}>{m.name} — {m.role_title}</option>
                          ))}
                        </select>
                        {isAdmin && (
                          <input
                            type="number"
                            step="0.01"
                            className="input-field text-sm w-28"
                            placeholder="R$ 0,00"
                            value={row.monthly_value}
                            onChange={e => updateBulkRow(client.id, idx, 'monthly_value', e.target.value)}
                          />
                        )}
                        <button onClick={() => removeBulkRow(client.id, idx)} className="text-red-400 hover:text-red-600">
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>

            <div className="flex justify-end gap-3 pt-2 border-t dark:border-dark-700">
              <button onClick={() => { setShowBulkModal(false); setBulkStaged({}); }} className="btn-secondary">Cancelar</button>
              <button
                onClick={handleSaveBulk}
                disabled={bulkSaving || Object.values(bulkStaged).every(rows => rows.length === 0)}
                className="btn-primary disabled:opacity-50"
              >
                {bulkSaving ? 'Salvando...' : 'Salvar Alocações'}
              </button>
            </div>
          </div>
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
            {/* Only admin can set/change allocation dates */}
            {isAdmin ? (
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
            ) : (
              <input type="hidden" value={allocForm.start_date || new Date().toISOString().slice(0, 10)}
                onChange={e => setAllocForm({...allocForm, start_date: e.target.value})} />
            )}
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
