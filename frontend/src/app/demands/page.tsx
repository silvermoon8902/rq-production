'use client';

import { useEffect, useState, useMemo } from 'react';
import AuthGuard from '@/components/layout/AuthGuard';
import Modal from '@/components/ui/Modal';
import StatusBadge from '@/components/ui/StatusBadge';
import { demandsApi, clientsApi, teamApi } from '@/services/api';
import { useAuthStore } from '@/stores/authStore';
import { KanbanColumn, Demand, Client, TeamMember, Squad } from '@/types';
import { Plus, Clock, User, Building2, Filter, Trash2, Pencil, MessageSquare } from 'lucide-react';
import toast from 'react-hot-toast';
import DemandPreviewModal from '@/components/ui/DemandPreviewModal';

const priorityEmojis: Record<string, string> = {
  low: '🟢', medium: '🟡', high: '🟠', urgent: '🚨',
};

const formatTimeAgo = (dateStr: string) => {
  const diff = Date.now() - new Date(dateStr).getTime();
  const hours = Math.floor(diff / 3600000);
  if (hours < 1) return 'agora';
  if (hours < 24) return `${hours}h atrás`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d atrás`;
  return `${Math.floor(days / 7)}sem atrás`;
};

const formatInProgressTime = (hours: number) => {
  if (hours < 1) return `${Math.round(hours * 60)}min`;
  if (hours < 24) return `${hours.toFixed(1)}h`;
  const days = Math.floor(hours / 24);
  const rem = Math.round(hours % 24);
  return rem > 0 ? `${days}d ${rem}h` : `${days}d`;
};

const formatDeadline = (dueDateStr: string) => {
  const diff = new Date(dueDateStr).getTime() - Date.now();
  const hours = Math.floor(diff / 3600000);
  if (hours < 0) {
    const overHours = Math.abs(hours);
    if (overHours < 24) return { text: `${overHours}h atrasado`, overdue: true };
    return { text: `${Math.floor(overHours / 24)}d atrasado`, overdue: true };
  }
  if (hours < 24) return { text: `${hours}h restantes`, overdue: false };
  return { text: `${Math.floor(hours / 24)}d restantes`, overdue: false };
};

export default function DemandsPage() {
  const [columns, setColumns] = useState<KanbanColumn[]>([]);
  const [allDemands, setAllDemands] = useState<Record<string, Demand[]>>({});
  const [clients, setClients] = useState<Client[]>([]);
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [squads, setSquads] = useState<Squad[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [previewDemand, setPreviewDemand] = useState<Demand | null>(null);
  const [modalTitle, setModalTitle] = useState('Nova Demanda');
  const { user } = useAuthStore();

  // Filters
  const [filterClient, setFilterClient] = useState('');
  const [filterSquad, setFilterSquad] = useState('');
  const [filterMember, setFilterMember] = useState('');
  const [filterRole, setFilterRole] = useState('');
  const [filterType, setFilterType] = useState('');
  const [filterPeriod, setFilterPeriod] = useState('');

  const [form, setForm] = useState({
    title: '', description: '', priority: 'medium', demand_type: '',
    client_id: '', assigned_to_id: '', sla_hours: '', due_date: '', column_id: '',
  });
  const [editingDemand, setEditingDemand] = useState<Demand | null>(null);
  const [editForm, setEditForm] = useState({
    title: '', description: '', priority: 'medium', demand_type: '',
    client_id: '', assigned_to_id: '', sla_hours: '', due_date: '',
  });
  const [draggedDemand, setDraggedDemand] = useState<Demand | null>(null);

  useEffect(() => { loadBoard(); }, []);

  const loadBoard = async () => {
    try {
      const [boardRes, clientsRes, membersRes, squadsRes] = await Promise.all([
        demandsApi.getBoard(), clientsApi.getAll(), teamApi.getMembers(), teamApi.getSquads(),
      ]);
      setColumns(boardRes.data.columns);
      setAllDemands(boardRes.data.demands);
      setClients(clientsRes.data);
      setMembers(membersRes.data);
      setSquads(squadsRes.data);
    } catch { toast.error('Erro ao carregar board'); }
    finally { setLoading(false); }
  };

  // Extract unique demand types and role titles for filters
  const demandTypes = useMemo(() => {
    const types = new Set<string>();
    Object.values(allDemands).flat().forEach(d => {
      if (d.demand_type) types.add(d.demand_type);
    });
    return Array.from(types).sort();
  }, [allDemands]);

  const roleTitles = useMemo(() => {
    const roles = new Set<string>();
    members.forEach(m => { if (m.role_title) roles.add(m.role_title); });
    return Array.from(roles).sort();
  }, [members]);

  // Filter demands per column
  const filteredDemands = useMemo(() => {
    const squadMemberIds = filterSquad
      ? members.filter(m => m.squad_id === Number(filterSquad)).map(m => m.id)
      : null;
    const roleMemberIds = filterRole
      ? members.filter(m => m.role_title === filterRole).map(m => m.id)
      : null;
    const periodStart = filterPeriod
      ? new Date(Date.now() - Number(filterPeriod) * 24 * 3600000)
      : null;

    const filtered: Record<string, Demand[]> = {};
    for (const [colId, colDemands] of Object.entries(allDemands)) {
      filtered[colId] = colDemands.filter(d => {
        if (filterClient && d.client_id !== Number(filterClient)) return false;
        if (filterMember && d.assigned_to_id !== Number(filterMember)) return false;
        if (filterType && d.demand_type !== filterType) return false;
        if (squadMemberIds && (!d.assigned_to_id || !squadMemberIds.includes(d.assigned_to_id))) return false;
        if (roleMemberIds && (!d.assigned_to_id || !roleMemberIds.includes(d.assigned_to_id))) return false;
        if (periodStart && new Date(d.created_at) < periodStart) return false;
        return true;
      });
    }
    return filtered;
  }, [allDemands, filterClient, filterSquad, filterMember, filterRole, filterType, filterPeriod, members]);

  const activeFilterCount = [filterClient, filterSquad, filterMember, filterRole, filterType, filterPeriod].filter(Boolean).length;

  const clearFilters = () => {
    setFilterClient(''); setFilterSquad(''); setFilterMember(''); setFilterRole(''); setFilterType(''); setFilterPeriod('');
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await demandsApi.create({
        title: form.title,
        description: form.description || null,
        priority: form.priority,
        demand_type: form.demand_type || null,
        client_id: form.client_id ? Number(form.client_id) : null,
        assigned_to_id: form.assigned_to_id ? Number(form.assigned_to_id) : null,
        sla_hours: form.sla_hours ? Number(form.sla_hours) : null,
        due_date: form.due_date || null,
        column_id: form.column_id ? Number(form.column_id) : null,
      });
      toast.success('Demanda criada');
      setShowModal(false);
      setForm({ title: '', description: '', priority: 'medium', demand_type: '', client_id: '', assigned_to_id: '', sla_hours: '', due_date: '', column_id: '' });
      loadBoard();
    } catch { toast.error('Erro ao criar demanda'); }
  };

  const handleDragStart = (demand: Demand) => { setDraggedDemand(demand); };
  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); };

  const handleDrop = async (columnId: number) => {
    if (!draggedDemand || draggedDemand.column_id === columnId) {
      setDraggedDemand(null);
      return;
    }
    try {
      await demandsApi.move(draggedDemand.id, { column_id: columnId, position: 0 });
      loadBoard();
    } catch { toast.error('Erro ao mover demanda'); }
    finally { setDraggedDemand(null); }
  };

  const slaColors: Record<string, string> = {
    on_time: 'border-l-green-500', warning: 'border-l-yellow-500', overdue: 'border-l-red-500',
  };

  const canEdit = user?.role === 'admin' || user?.role === 'gerente';

  const handleDeleteDemand = async (id: number, title: string) => {
    if (!confirm(`Excluir demanda "${title}"?`)) return;
    try {
      await demandsApi.delete(id);
      toast.success('Demanda excluída');
      loadBoard();
    } catch { toast.error('Erro ao excluir demanda'); }
  };

  const openEditDemand = (demand: Demand) => {
    setEditingDemand(demand);
    setEditForm({
      title: demand.title,
      description: demand.description || '',
      priority: demand.priority,
      demand_type: demand.demand_type || '',
      client_id: demand.client_id?.toString() || '',
      assigned_to_id: demand.assigned_to_id?.toString() || '',
      sla_hours: demand.sla_hours?.toString() || '',
      due_date: demand.due_date ? demand.due_date.slice(0, 16) : '',
    });
  };

  const handleEditDemand = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingDemand) return;
    try {
      await demandsApi.update(editingDemand.id, {
        title: editForm.title,
        description: editForm.description || null,
        priority: editForm.priority,
        demand_type: editForm.demand_type || null,
        client_id: editForm.client_id ? Number(editForm.client_id) : null,
        assigned_to_id: editForm.assigned_to_id ? Number(editForm.assigned_to_id) : null,
        sla_hours: editForm.sla_hours ? Number(editForm.sla_hours) : null,
        due_date: editForm.due_date || null,
      });
      toast.success('Demanda atualizada');
      setEditingDemand(null);
      loadBoard();
    } catch { toast.error('Erro ao atualizar demanda'); }
  };

  return (
    <AuthGuard>
      <div>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-3">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold">Demandas</h1>
            <p className="text-gray-500 mt-1">
              Kanban com controle de SLA
              {filterType && <span className="ml-2 text-primary-600 font-medium">— {filterType}</span>}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`btn-secondary flex items-center gap-2 ${activeFilterCount > 0 ? 'ring-2 ring-primary-300' : ''}`}
            >
              <Filter className="h-4 w-4" /> Filtros
              {activeFilterCount > 0 && (
                <span className="bg-primary-300 text-dark-900 text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
                  {activeFilterCount}
                </span>
              )}
            </button>
            <button onClick={() => {
              setForm({ title: '', description: '', priority: 'medium', demand_type: '', client_id: '', assigned_to_id: '', sla_hours: '', due_date: '', column_id: '' });
              setModalTitle('Nova Demanda');
              setShowModal(true);
            }} className="btn-primary flex items-center gap-2">
              <Plus className="h-4 w-4" /> Nova Demanda
            </button>
          </div>
        </div>

        {/* Filters bar */}
        {showFilters && (
          <div className="card mb-6">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-gray-600">Filtros</h3>
              {activeFilterCount > 0 && (
                <button onClick={clearFilters} className="text-xs text-red-500 hover:text-red-700">Limpar filtros</button>
              )}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Cliente</label>
                <select className="input-field text-sm" value={filterClient} onChange={e => setFilterClient(e.target.value)}>
                  <option value="">Todos</option>
                  {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Squad</label>
                <select className="input-field text-sm" value={filterSquad} onChange={e => setFilterSquad(e.target.value)}>
                  <option value="">Todos</option>
                  {squads.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Colaborador</label>
                <select className="input-field text-sm" value={filterMember} onChange={e => setFilterMember(e.target.value)}>
                  <option value="">Todos</option>
                  {members.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Cargo</label>
                <select className="input-field text-sm" value={filterRole} onChange={e => setFilterRole(e.target.value)}>
                  <option value="">Todos</option>
                  {roleTitles.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Tipo / Área</label>
                <select className="input-field text-sm" value={filterType} onChange={e => setFilterType(e.target.value)}>
                  <option value="">Todos</option>
                  {demandTypes.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Período</label>
                <select className="input-field text-sm" value={filterPeriod} onChange={e => setFilterPeriod(e.target.value)}>
                  <option value="">Todos</option>
                  <option value="7">Últimos 7 dias</option>
                  <option value="30">Últimos 30 dias</option>
                  <option value="90">Últimos 90 dias</option>
                  <option value="365">Último ano</option>
                </select>
              </div>
            </div>
          </div>
        )}

        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
          </div>
        ) : (
          <div className="flex gap-4 overflow-x-auto pb-4">
            {columns.map((column) => {
              const colDemands = filteredDemands[String(column.id)] || [];
              return (
                <div
                  key={column.id}
                  className="flex-shrink-0 w-72 sm:w-80 bg-gray-100 dark:bg-dark-800 rounded-xl p-3 sm:p-4"
                  onDragOver={handleDragOver}
                  onDrop={() => handleDrop(column.id)}
                >
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: column.color }} />
                      <h3 className="font-semibold text-sm">{column.name}</h3>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-500 bg-white dark:bg-dark-700 dark:text-gray-400 px-2 py-1 rounded-full">
                        {colDemands.length}
                      </span>
                      <button
                        onClick={() => {
                          setForm({ title: '', description: '', priority: 'medium', demand_type: '', client_id: '', assigned_to_id: '', sla_hours: '', due_date: '', column_id: String(column.id) });
                          setModalTitle(`Nova Demanda — ${column.name}`);
                          setShowModal(true);
                        }}
                        className="w-6 h-6 flex items-center justify-center rounded-full bg-white dark:bg-dark-700 hover:bg-primary-300 hover:text-dark-900 text-gray-400 transition-colors text-sm font-bold"
                        title="Adicionar demanda"
                      >
                        +
                      </button>
                    </div>
                  </div>

                  <div className="space-y-3 min-h-[200px]">

                    {colDemands.map((demand) => {
                      const deadline = demand.due_date ? formatDeadline(demand.due_date) : null;
                      return (
                        <div
                          key={demand.id}
                          draggable
                          onDragStart={() => handleDragStart(demand)}
                          onClick={() => setPreviewDemand(demand)}
                          className={`bg-white dark:bg-dark-700 rounded-lg p-3 shadow-sm border-l-4 cursor-pointer hover:shadow-md transition-shadow ${slaColors[demand.sla_status] || 'border-l-gray-200'}`}
                        >
                          <div className="flex items-start justify-between mb-1.5 gap-1">
                            <div className="flex items-start gap-1.5 flex-1 min-w-0">
                              <span className="text-sm flex-shrink-0 mt-0.5">{priorityEmojis[demand.priority]}</span>
                              <h4 className="text-sm font-medium leading-snug">{demand.title}</h4>
                            </div>
                            <div className="flex items-center gap-1 flex-shrink-0 mt-0.5" onClick={e => e.stopPropagation()}>
                              <button
                                onClick={(e) => { e.stopPropagation(); openEditDemand(demand); }}
                                className="text-gray-300 hover:text-primary-500 transition-colors"
                                title="Editar demanda"
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </button>
                              {canEdit && (
                                <button
                                  onClick={(e) => { e.stopPropagation(); handleDeleteDemand(demand.id, demand.title); }}
                                  className="text-gray-300 hover:text-red-500 transition-colors"
                                  title="Excluir demanda"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              )}
                            </div>
                          </div>
                          {demand.description && (
                            <p className="text-xs text-gray-500 mb-2 line-clamp-2">{demand.description}</p>
                          )}
                          {demand.demand_type && (
                            <span className="inline-block text-xs bg-gray-100 dark:bg-dark-600 text-gray-600 dark:text-gray-400 px-2 py-0.5 rounded mb-2">
                              {demand.demand_type}
                            </span>
                          )}
                          <div className="flex items-center justify-between text-xs text-gray-400 mb-1.5">
                            <div className="flex items-center gap-2">
                              {demand.client_name && (
                                <span className="flex items-center gap-1">
                                  <Building2 className="h-3 w-3" />{demand.client_name}
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-2">
                              {demand.assigned_to_name && (
                                <span className="flex items-center gap-1">
                                  <User className="h-3 w-3" />{demand.assigned_to_name}
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-gray-400">{formatTimeAgo(demand.created_at)}</span>
                            {deadline && (
                              <span className={`flex items-center gap-1 font-medium ${deadline.overdue ? 'text-red-500' : 'text-gray-500'}`}>
                                <Clock className="h-3 w-3" />{deadline.text}
                              </span>
                            )}
                          </div>
                          <div className="mt-1.5 flex items-center justify-between">
                            <StatusBadge status={demand.sla_status} />
                            <div className="flex items-center gap-2">
                              {demand.comments_count > 0 && (
                                <span className="text-xs text-gray-400 flex items-center gap-1">
                                  <MessageSquare className="h-3 w-3" />{demand.comments_count}
                                </span>
                              )}
                              {demand.in_progress_hours != null && (
                                <span className="text-xs text-green-600 font-medium flex items-center gap-1" title="Tempo em progresso até conclusão">
                                  ✓ {formatInProgressTime(demand.in_progress_hours)}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <DemandPreviewModal demand={previewDemand} onClose={() => setPreviewDemand(null)} />

        <Modal isOpen={!!editingDemand} onClose={() => setEditingDemand(null)} title="Editar Demanda" size="lg">
          <form onSubmit={handleEditDemand} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">Título *</label>
              <input className="input-field" value={editForm.title} onChange={e => setEditForm({...editForm, title: e.target.value})} required />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Descrição</label>
              <textarea className="input-field" rows={3} value={editForm.description} onChange={e => setEditForm({...editForm, description: e.target.value})} />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Prioridade</label>
                <select className="input-field" value={editForm.priority} onChange={e => setEditForm({...editForm, priority: e.target.value})}>
                  <option value="low">🟢 Baixa</option>
                  <option value="medium">🟡 Média</option>
                  <option value="high">🟠 Alta</option>
                  <option value="urgent">🚨 Urgente</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Tipo / Área</label>
                <input className="input-field" placeholder="Ex: Design, Tráfego, Copy..." value={editForm.demand_type} onChange={e => setEditForm({...editForm, demand_type: e.target.value})} list="edit-demand-types" />
                <datalist id="edit-demand-types">
                  {demandTypes.map(t => <option key={t} value={t} />)}
                </datalist>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Cliente</label>
                <select className="input-field" value={editForm.client_id} onChange={e => setEditForm({...editForm, client_id: e.target.value})}>
                  <option value="">Sem cliente</option>
                  {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Responsável</label>
                <select className="input-field" value={editForm.assigned_to_id} onChange={e => setEditForm({...editForm, assigned_to_id: e.target.value})}>
                  <option value="">Sem responsável</option>
                  {members.map(m => <option key={m.id} value={m.id}>{m.name} — {m.role_title}</option>)}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">SLA (horas)</label>
                <input type="number" className="input-field" value={editForm.sla_hours} onChange={e => setEditForm({...editForm, sla_hours: e.target.value})} placeholder="Ex: 48" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Prazo</label>
                <input type="datetime-local" className="input-field" value={editForm.due_date} onChange={e => setEditForm({...editForm, due_date: e.target.value})} />
              </div>
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button type="button" onClick={() => setEditingDemand(null)} className="btn-secondary">Cancelar</button>
              <button type="submit" className="btn-primary">Salvar</button>
            </div>
          </form>
        </Modal>

        <Modal isOpen={showModal} onClose={() => setShowModal(false)} title={modalTitle} size="lg">
          <form onSubmit={handleCreate} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">Título *</label>
              <input className="input-field" value={form.title} onChange={e => setForm({...form, title: e.target.value})} required />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Descrição</label>
              <textarea className="input-field" rows={3} value={form.description} onChange={e => setForm({...form, description: e.target.value})} />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Prioridade</label>
                <select className="input-field" value={form.priority} onChange={e => setForm({...form, priority: e.target.value})}>
                  <option value="low">🟢 Baixa</option>
                  <option value="medium">🟡 Média</option>
                  <option value="high">🟠 Alta</option>
                  <option value="urgent">🚨 Urgente</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Tipo / Área</label>
                <input className="input-field" placeholder="Ex: Design, Tráfego, Copy..." value={form.demand_type} onChange={e => setForm({...form, demand_type: e.target.value})} list="demand-types" />
                <datalist id="demand-types">
                  {demandTypes.map(t => <option key={t} value={t} />)}
                </datalist>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Cliente</label>
                <select className="input-field" value={form.client_id} onChange={e => setForm({...form, client_id: e.target.value})}>
                  <option value="">Sem cliente</option>
                  {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Responsável</label>
                <select className="input-field" value={form.assigned_to_id} onChange={e => setForm({...form, assigned_to_id: e.target.value})}>
                  <option value="">Sem responsável</option>
                  {members.map(m => <option key={m.id} value={m.id}>{m.name} — {m.role_title}</option>)}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Coluna</label>
                <select className="input-field" value={form.column_id} onChange={e => setForm({...form, column_id: e.target.value})}>
                  <option value="">Padrão</option>
                  {columns.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">SLA (horas)</label>
                <input type="number" className="input-field" value={form.sla_hours} onChange={e => setForm({...form, sla_hours: e.target.value})} placeholder="Ex: 48" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Prazo</label>
                <input type="datetime-local" className="input-field" value={form.due_date} onChange={e => setForm({...form, due_date: e.target.value})} />
              </div>
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button type="button" onClick={() => setShowModal(false)} className="btn-secondary">Cancelar</button>
              <button type="submit" className="btn-primary">Criar Demanda</button>
            </div>
          </form>
        </Modal>
      </div>
    </AuthGuard>
  );
}
