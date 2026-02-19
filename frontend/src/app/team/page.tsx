'use client';

import { useEffect, useState, useMemo } from 'react';
import AuthGuard from '@/components/layout/AuthGuard';
import Modal from '@/components/ui/Modal';
import { teamApi, clientsApi } from '@/services/api';
import { useAuthStore } from '@/stores/authStore';
import { Squad, TeamMember, Allocation, Client } from '@/types';
import { Plus, Users, UserPlus, Link2 } from 'lucide-react';
import toast from 'react-hot-toast';

interface MemberMetrics {
  activeClients: number;
  churnRate: number;
  newClients: number;
}

export default function TeamPage() {
  const [squads, setSquads] = useState<Squad[]>([]);
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [allocations, setAllocations] = useState<Allocation[]>([]);
  const [loading, setLoading] = useState(true);
  const [showSquadModal, setShowSquadModal] = useState(false);
  const [showMemberModal, setShowMemberModal] = useState(false);
  const [showAllocModal, setShowAllocModal] = useState(false);
  const [squadForm, setSquadForm] = useState({ name: '', description: '' });
  const [memberForm, setMemberForm] = useState({ name: '', role_title: '', squad_id: '', email: '', phone: '', status: 'active' });
  const [allocForm, setAllocForm] = useState({ member_id: '', client_id: '', monthly_value: '', start_date: '', end_date: '' });
  const { user } = useAuthStore();

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    try {
      const [squadsRes, membersRes, clientsRes, allocsRes] = await Promise.all([
        teamApi.getSquads(), teamApi.getMembers(), clientsApi.getAll(), teamApi.getAllocations(),
      ]);
      setSquads(squadsRes.data);
      setMembers(membersRes.data);
      setClients(clientsRes.data);
      setAllocations(allocsRes.data);
    } catch { toast.error('Erro ao carregar dados'); }
    finally { setLoading(false); }
  };

  const memberMetrics = useMemo(() => {
    const now = new Date();
    const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const map: Record<number, MemberMetrics> = {};

    for (const member of members) {
      const memberAllocs = allocations.filter(a => a.member_id === member.id);
      const memberClientIds = Array.from(new Set(memberAllocs.map(a => a.client_id)));
      const memberClients = clients.filter(c => memberClientIds.includes(c.id));

      const activeAllocs = memberAllocs.filter(a => !a.end_date || new Date(a.end_date) >= now);
      const activeClientIds = Array.from(new Set(activeAllocs.map(a => a.client_id)));
      const activeClients = clients.filter(c => activeClientIds.includes(c.id) && c.status === 'active').length;

      const churnedClients = memberClients.filter(c => c.status === 'churned').length;
      const churnRate = memberClients.length > 0 ? Math.round((churnedClients / memberClients.length) * 100) : 0;

      const newClients = memberAllocs.filter(a => new Date(a.created_at) >= firstOfMonth).length;

      map[member.id] = { activeClients, churnRate, newClients };
    }
    return map;
  }, [members, allocations, clients]);

  const handleCreateSquad = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await teamApi.createSquad(squadForm);
      toast.success('Squad criado');
      setShowSquadModal(false);
      setSquadForm({ name: '', description: '' });
      loadData();
    } catch { toast.error('Erro ao criar squad'); }
  };

  const handleCreateMember = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await teamApi.createMember({
        ...memberForm,
        squad_id: memberForm.squad_id ? Number(memberForm.squad_id) : null,
      });
      toast.success('Membro adicionado');
      setShowMemberModal(false);
      setMemberForm({ name: '', role_title: '', squad_id: '', email: '', phone: '', status: 'active' });
      loadData();
    } catch { toast.error('Erro ao adicionar membro'); }
  };

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
      setAllocForm({ member_id: '', client_id: '', monthly_value: '', start_date: '', end_date: '' });
      loadData();
    } catch { toast.error('Erro ao criar alocação'); }
  };

  const canEdit = user?.role === 'admin' || user?.role === 'gerente';

  return (
    <AuthGuard>
      <div>
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold">Equipe</h1>
            <p className="text-gray-500 mt-1">{members.length} membros em {squads.length} squads</p>
          </div>
          {canEdit && (
            <div className="flex gap-2">
              <button onClick={() => setShowAllocModal(true)} className="btn-secondary flex items-center gap-2">
                <Link2 className="h-4 w-4" /> Alocar
              </button>
              <button onClick={() => setShowSquadModal(true)} className="btn-secondary flex items-center gap-2">
                <Users className="h-4 w-4" /> Novo Squad
              </button>
              <button onClick={() => setShowMemberModal(true)} className="btn-primary flex items-center gap-2">
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
                      <span className="text-sm text-gray-500">{squad.members_count} membros</span>
                    </div>
                    {squad.description && <p className="text-sm text-gray-400">{squad.description}</p>}
                  </div>
                ))}
                {squads.length === 0 && <p className="text-gray-400 col-span-3">Nenhum squad criado</p>}
              </div>
            </div>

            {/* Members */}
            <h2 className="text-lg font-semibold mb-4">Membros</h2>
            <div className="bg-white rounded-xl border overflow-hidden">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Nome</th>
                    <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Cargo</th>
                    <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Squad</th>
                    <th className="text-center px-6 py-3 text-xs font-medium text-gray-500 uppercase">Clientes Ativos</th>
                    <th className="text-center px-6 py-3 text-xs font-medium text-gray-500 uppercase">Taxa de Churn</th>
                    <th className="text-center px-6 py-3 text-xs font-medium text-gray-500 uppercase">Novos Clientes</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {members.map((member) => {
                    const metrics = memberMetrics[member.id] || { activeClients: 0, churnRate: 0, newClients: 0 };
                    return (
                      <tr key={member.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 font-medium">{member.name}</td>
                        <td className="px-6 py-4 text-sm text-gray-600">{member.role_title}</td>
                        <td className="px-6 py-4 text-sm text-gray-600">
                          {squads.find(s => s.id === member.squad_id)?.name || '-'}
                        </td>
                        <td className="px-6 py-4 text-center">
                          <span className="inline-flex items-center justify-center bg-green-100 text-green-800 text-sm font-semibold rounded-full w-8 h-8">
                            {metrics.activeClients}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <span className={`text-sm font-semibold ${metrics.churnRate > 20 ? 'text-red-600' : metrics.churnRate > 0 ? 'text-amber-600' : 'text-green-600'}`}>
                            {metrics.churnRate}%
                          </span>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <span className="inline-flex items-center justify-center bg-blue-100 text-blue-800 text-sm font-semibold rounded-full w-8 h-8">
                            {metrics.newClients}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {members.length === 0 && <p className="text-gray-400 text-center py-8">Nenhum membro cadastrado</p>}
            </div>
          </>
        )}

        {/* Squad Modal */}
        <Modal isOpen={showSquadModal} onClose={() => setShowSquadModal(false)} title="Novo Squad">
          <form onSubmit={handleCreateSquad} className="space-y-4">
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
              <button type="submit" className="btn-primary">Criar</button>
            </div>
          </form>
        </Modal>

        {/* Member Modal */}
        <Modal isOpen={showMemberModal} onClose={() => setShowMemberModal(false)} title="Novo Membro">
          <form onSubmit={handleCreateMember} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">Nome *</label>
              <input className="input-field" value={memberForm.name} onChange={e => setMemberForm({...memberForm, name: e.target.value})} required />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Cargo *</label>
              <input className="input-field" value={memberForm.role_title} onChange={e => setMemberForm({...memberForm, role_title: e.target.value})} required />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Squad</label>
              <select className="input-field" value={memberForm.squad_id} onChange={e => setMemberForm({...memberForm, squad_id: e.target.value})}>
                <option value="">Sem squad</option>
                {squads.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Email</label>
                <input type="email" className="input-field" value={memberForm.email} onChange={e => setMemberForm({...memberForm, email: e.target.value})} />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Telefone</label>
                <input className="input-field" value={memberForm.phone} onChange={e => setMemberForm({...memberForm, phone: e.target.value})} />
              </div>
            </div>
            <div className="flex justify-end gap-3">
              <button type="button" onClick={() => setShowMemberModal(false)} className="btn-secondary">Cancelar</button>
              <button type="submit" className="btn-primary">Criar</button>
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
                {members.map(m => <option key={m.id} value={m.id}>{m.name} — {m.role_title}</option>)}
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
            <div className="grid grid-cols-2 gap-4">
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
