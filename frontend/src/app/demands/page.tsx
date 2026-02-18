'use client';

import { useEffect, useState, useCallback } from 'react';
import AuthGuard from '@/components/layout/AuthGuard';
import Modal from '@/components/ui/Modal';
import StatusBadge from '@/components/ui/StatusBadge';
import { demandsApi, clientsApi, teamApi } from '@/services/api';
import { useAuthStore } from '@/stores/authStore';
import { KanbanColumn, Demand, Client, TeamMember } from '@/types';
import { Plus, GripVertical, Clock, User, Building2 } from 'lucide-react';
import toast from 'react-hot-toast';

export default function DemandsPage() {
  const [columns, setColumns] = useState<KanbanColumn[]>([]);
  const [demands, setDemands] = useState<Record<string, Demand[]>>({});
  const [clients, setClients] = useState<Client[]>([]);
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [filterClient, setFilterClient] = useState('');
  const [form, setForm] = useState({
    title: '', description: '', priority: 'medium', demand_type: '',
    client_id: '', assigned_to_id: '', sla_hours: '', due_date: '',
  });
  const [draggedDemand, setDraggedDemand] = useState<Demand | null>(null);

  useEffect(() => { loadBoard(); }, [filterClient]);

  const loadBoard = async () => {
    try {
      const params: any = {};
      if (filterClient) params.client_id = Number(filterClient);
      const [boardRes, clientsRes, membersRes] = await Promise.all([
        demandsApi.getBoard(params), clientsApi.getAll(), teamApi.getMembers(),
      ]);
      setColumns(boardRes.data.columns);
      setDemands(boardRes.data.demands);
      setClients(clientsRes.data);
      setMembers(membersRes.data);
    } catch { toast.error('Erro ao carregar board'); }
    finally { setLoading(false); }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await demandsApi.create({
        ...form,
        client_id: form.client_id ? Number(form.client_id) : null,
        assigned_to_id: form.assigned_to_id ? Number(form.assigned_to_id) : null,
        sla_hours: form.sla_hours ? Number(form.sla_hours) : null,
        due_date: form.due_date || null,
      });
      toast.success('Demanda criada');
      setShowModal(false);
      setForm({ title: '', description: '', priority: 'medium', demand_type: '', client_id: '', assigned_to_id: '', sla_hours: '', due_date: '' });
      loadBoard();
    } catch { toast.error('Erro ao criar demanda'); }
  };

  const handleDragStart = (demand: Demand) => {
    setDraggedDemand(demand);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

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
    on_time: 'border-l-green-500',
    warning: 'border-l-yellow-500',
    overdue: 'border-l-red-500',
  };

  const priorityDots: Record<string, string> = {
    low: 'bg-gray-400',
    medium: 'bg-blue-400',
    high: 'bg-orange-400',
    urgent: 'bg-red-500',
  };

  return (
    <AuthGuard>
      <div>
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold">Demandas</h1>
            <p className="text-gray-500 mt-1">Kanban com controle de SLA</p>
          </div>
          <div className="flex items-center gap-3">
            <select
              className="input-field w-48"
              value={filterClient}
              onChange={(e) => setFilterClient(e.target.value)}
            >
              <option value="">Todos os clientes</option>
              {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <button onClick={() => setShowModal(true)} className="btn-primary flex items-center gap-2">
              <Plus className="h-4 w-4" /> Nova Demanda
            </button>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
          </div>
        ) : (
          <div className="flex gap-4 overflow-x-auto pb-4">
            {columns.map((column) => (
              <div
                key={column.id}
                className="flex-shrink-0 w-80 bg-gray-100 rounded-xl p-4"
                onDragOver={handleDragOver}
                onDrop={() => handleDrop(column.id)}
              >
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: column.color }} />
                    <h3 className="font-semibold text-sm">{column.name}</h3>
                  </div>
                  <span className="text-xs text-gray-500 bg-white px-2 py-1 rounded-full">
                    {(demands[String(column.id)] || []).length}
                  </span>
                </div>

                <div className="space-y-3 min-h-[200px]">
                  {(demands[String(column.id)] || []).map((demand) => (
                    <div
                      key={demand.id}
                      draggable
                      onDragStart={() => handleDragStart(demand)}
                      className={`bg-white rounded-lg p-3 shadow-sm border-l-4 cursor-grab active:cursor-grabbing hover:shadow-md transition-shadow ${slaColors[demand.sla_status] || 'border-l-gray-200'}`}
                    >
                      <div className="flex items-start justify-between mb-2">
                        <h4 className="text-sm font-medium flex-1">{demand.title}</h4>
                        <div className={`w-2 h-2 rounded-full mt-1 ${priorityDots[demand.priority]}`} />
                      </div>
                      {demand.description && (
                        <p className="text-xs text-gray-500 mb-2 line-clamp-2">{demand.description}</p>
                      )}
                      <div className="flex items-center justify-between text-xs text-gray-400">
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
                          {demand.due_date && (
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {new Date(demand.due_date).toLocaleDateString('pt-BR')}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="mt-2">
                        <StatusBadge status={demand.sla_status} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        <Modal isOpen={showModal} onClose={() => setShowModal(false)} title="Nova Demanda" size="lg">
          <form onSubmit={handleCreate} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">Título *</label>
              <input className="input-field" value={form.title} onChange={e => setForm({...form, title: e.target.value})} required />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Descrição</label>
              <textarea className="input-field" rows={3} value={form.description} onChange={e => setForm({...form, description: e.target.value})} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Prioridade</label>
                <select className="input-field" value={form.priority} onChange={e => setForm({...form, priority: e.target.value})}>
                  <option value="low">Baixa</option>
                  <option value="medium">Média</option>
                  <option value="high">Alta</option>
                  <option value="urgent">Urgente</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Tipo</label>
                <input className="input-field" placeholder="Ex: Design, Tráfego, Copy..." value={form.demand_type} onChange={e => setForm({...form, demand_type: e.target.value})} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
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
                  {members.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
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
