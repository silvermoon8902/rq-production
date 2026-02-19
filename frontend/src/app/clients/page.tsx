'use client';

import { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import AuthGuard from '@/components/layout/AuthGuard';
import Modal from '@/components/ui/Modal';
import StatusBadge from '@/components/ui/StatusBadge';
import { clientsApi, teamApi } from '@/services/api';
import { useAuthStore } from '@/stores/authStore';
import { Client, TeamMember, Allocation } from '@/types';
import { Plus, Search, Building2, Filter } from 'lucide-react';
import toast from 'react-hot-toast';

const emptyForm = {
  name: '', company: '', cnpj: '', responsible_name: '', phone: '', email: '',
  segment: '', status: 'active', instagram: '', website: '', notes: '',
  start_date: '', end_date: '',
  monthly_value: '', min_contract_months: '', operational_cost: '',
};

export default function ClientsPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [niches, setNiches] = useState<string[]>([]);
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [allocations, setAllocations] = useState<Allocation[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterNiche, setFilterNiche] = useState('');
  const [filterMember, setFilterMember] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [form, setForm] = useState(emptyForm);
  const { user } = useAuthStore();

  const isAdmin = user?.role === 'admin';
  const canEdit = user?.role === 'admin' || user?.role === 'gerente';

  useEffect(() => { loadAll(); }, []);

  const loadAll = async () => {
    try {
      const [clientsRes, nichesRes, membersRes, allocsRes] = await Promise.all([
        clientsApi.getAll(),
        clientsApi.getNiches(),
        teamApi.getMembers(),
        teamApi.getAllocations(),
      ]);
      setClients(clientsRes.data);
      setNiches(nichesRes.data);
      setMembers(membersRes.data);
      setAllocations(allocsRes.data);
    } catch { toast.error('Erro ao carregar clientes'); }
    finally { setLoading(false); }
  };

  const filtered = useMemo(() => {
    const now = new Date();
    return clients.filter(c => {
      const q = search.toLowerCase();
      const matchSearch = !search ||
        c.name.toLowerCase().includes(q) ||
        (c.company?.toLowerCase().includes(q)) ||
        (c.cnpj?.includes(search)) ||
        (c.responsible_name?.toLowerCase().includes(q));
      const matchStatus = !filterStatus || c.status === filterStatus;
      const matchNiche = !filterNiche || c.segment === filterNiche;
      const matchMember = !filterMember || allocations.some(
        a => a.client_id === c.id && a.member_id === Number(filterMember) &&
          (!a.end_date || new Date(a.end_date) >= now)
      );
      return matchSearch && matchStatus && matchNiche && matchMember;
    });
  }, [clients, search, filterStatus, filterNiche, filterMember, allocations]);

  const activeFilters = [filterStatus, filterNiche, filterMember].filter(Boolean).length;

  const openCreate = () => {
    setEditingClient(null);
    setForm(emptyForm);
    setShowModal(true);
  };

  const openEdit = (client: Client) => {
    setEditingClient(client);
    setForm({
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
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload: any = {
        name: form.name,
        company: form.company || null, cnpj: form.cnpj || null,
        responsible_name: form.responsible_name || null, phone: form.phone || null,
        email: form.email || null, segment: form.segment || null,
        status: form.status, instagram: form.instagram || null,
        website: form.website || null, notes: form.notes || null,
        start_date: form.start_date || null, end_date: form.end_date || null,
      };
      if (isAdmin) {
        payload.monthly_value = form.monthly_value ? Number(form.monthly_value) : null;
        payload.min_contract_months = form.min_contract_months ? Number(form.min_contract_months) : null;
        payload.operational_cost = form.operational_cost ? Number(form.operational_cost) : null;
      }
      if (editingClient) {
        await clientsApi.update(editingClient.id, payload);
        toast.success('Cliente atualizado');
      } else {
        await clientsApi.create(payload);
        toast.success('Cliente criado');
      }
      setShowModal(false);
      loadAll();
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || 'Erro ao salvar cliente');
    }
  };

  return (
    <AuthGuard>
      <div>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-3">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold">Clientes</h1>
            <p className="text-gray-500 mt-1">{filtered.length} de {clients.length} clientes</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`btn-secondary flex items-center gap-2 text-sm ${activeFilters > 0 ? 'ring-2 ring-primary-300' : ''}`}
            >
              <Filter className="h-4 w-4" />
              Filtros {activeFilters > 0 && <span className="bg-primary-300 text-dark-900 text-xs rounded-full px-1.5">{activeFilters}</span>}
            </button>
            {canEdit && (
              <button onClick={openCreate} className="btn-primary flex items-center gap-2 text-sm">
                <Plus className="h-4 w-4" /> Novo Cliente
              </button>
            )}
          </div>
        </div>

        <div className="mb-6 space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar por nome, empresa, CNPJ ou responsavel..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="input-field pl-10"
            />
          </div>
          {showFilters && (
            <div className="card p-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Status</label>
                  <select className="input-field text-sm" value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
                    <option value="">Todos</option>
                    <option value="active">Ativo</option>
                    <option value="onboarding">Onboarding</option>
                    <option value="churned">Churned</option>
                    <option value="inactive">Inativo</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Nicho</label>
                  <select className="input-field text-sm" value={filterNiche} onChange={e => setFilterNiche(e.target.value)}>
                    <option value="">Todos</option>
                    {niches.map(n => <option key={n} value={n}>{n}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Colaborador</label>
                  <select className="input-field text-sm" value={filterMember} onChange={e => setFilterMember(e.target.value)}>
                    <option value="">Todos</option>
                    {members.map(m => <option key={m.id} value={m.id}>{m.name} — {m.role_title}</option>)}
                  </select>
                </div>
              </div>
              {activeFilters > 0 && (
                <button
                  onClick={() => { setFilterStatus(''); setFilterNiche(''); setFilterMember(''); }}
                  className="mt-2 text-xs text-red-500 hover:text-red-700"
                >
                  Limpar filtros
                </button>
              )}
            </div>
          )}
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            {clients.length === 0 ? 'Nenhum cliente cadastrado' : 'Nenhum cliente encontrado'}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((client) => (
              <Link key={client.id} href={`/clients/${client.id}`}>
                <div className="card hover:shadow-md transition-shadow cursor-pointer h-full">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div className="bg-primary-100 p-2 rounded-lg flex-shrink-0">
                        <Building2 className="h-5 w-5 text-primary-600" />
                      </div>
                      <div className="min-w-0">
                        <h3 className="font-semibold truncate">{client.name}</h3>
                        {client.company && <p className="text-sm text-gray-500 truncate">{client.company}</p>}
                      </div>
                    </div>
                    <StatusBadge status={client.status} />
                  </div>
                  <div className="space-y-1 text-xs text-gray-500">
                    {client.segment && <p>Nicho: <span className="font-medium">{client.segment}</span></p>}
                    {client.cnpj && <p>CNPJ: {client.cnpj}</p>}
                    {client.responsible_name && <p>Resp.: {client.responsible_name}</p>}
                    {client.start_date && (
                      <p>Inicio: {new Date(client.start_date + 'T12:00:00').toLocaleDateString('pt-BR')}</p>
                    )}
                  </div>
                  {canEdit && (
                    <button
                      onClick={e => { e.preventDefault(); openEdit(client); }}
                      className="mt-3 text-sm text-primary-600 hover:text-primary-700 font-medium"
                    >
                      Editar
                    </button>
                  )}
                </div>
              </Link>
            ))}
          </div>
        )}

        <Modal isOpen={showModal} onClose={() => setShowModal(false)} title={editingClient ? 'Editar Cliente' : 'Novo Cliente'} size="lg">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Nome Fantasia *</label>
                <input className="input-field" value={form.name} onChange={e => setForm({...form, name: e.target.value})} required placeholder="Nome do cliente" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Razao Social</label>
                <input className="input-field" value={form.company} onChange={e => setForm({...form, company: e.target.value})} />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">CNPJ *</label>
                <input className="input-field" value={form.cnpj} onChange={e => setForm({...form, cnpj: e.target.value})} placeholder="00.000.000/0001-00" required />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Status</label>
                <select className="input-field" value={form.status} onChange={e => setForm({...form, status: e.target.value})}>
                  <option value="active">Ativo</option>
                  <option value="onboarding">Onboarding</option>
                  <option value="churned">Churned</option>
                  <option value="inactive">Inativo</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Responsavel *</label>
                <input className="input-field" value={form.responsible_name} onChange={e => setForm({...form, responsible_name: e.target.value})} required />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Celular do Responsavel *</label>
                <input className="input-field" value={form.phone} onChange={e => setForm({...form, phone: e.target.value})} placeholder="(11) 99999-9999" required />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Email</label>
              <input type="email" className="input-field" value={form.email} onChange={e => setForm({...form, email: e.target.value})} />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Nicho / Segmento</label>
              <input className="input-field" value={form.segment} onChange={e => setForm({...form, segment: e.target.value})}
                placeholder="Ex: Odontologia, E-commerce, Clinica..." list="niches-list" />
              <datalist id="niches-list">
                {niches.map(n => <option key={n} value={n} />)}
              </datalist>
              <p className="text-xs text-gray-400 mt-1">Digite para buscar ou criar novo nicho</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Instagram</label>
                <input className="input-field" value={form.instagram} onChange={e => setForm({...form, instagram: e.target.value})} placeholder="@perfil" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Site</label>
                <input className="input-field" value={form.website} onChange={e => setForm({...form, website: e.target.value})} placeholder="https://..." />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Data de Inicio *</label>
                <input type="date" className="input-field" value={form.start_date} onChange={e => setForm({...form, start_date: e.target.value})} required />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Data Final</label>
                <input type="date" className="input-field" value={form.end_date} onChange={e => setForm({...form, end_date: e.target.value})} />
                {form.end_date && <p className="text-xs text-amber-600 mt-1">Status sera alterado para Churned e sera criada demanda de encerramento</p>}
              </div>
            </div>

            {isAdmin && (
              <div className="bg-gray-50 rounded-lg p-4 border">
                <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-3">Financeiro (Admin)</p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">Valor Mensal (R$)</label>
                    <input type="number" step="0.01" className="input-field" value={form.monthly_value} onChange={e => setForm({...form, monthly_value: e.target.value})} placeholder="0,00" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Periodo Minimo (meses)</label>
                    <input type="number" className="input-field" value={form.min_contract_months} onChange={e => setForm({...form, min_contract_months: e.target.value})} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Custo Operacional (R$)</label>
                    <input type="number" step="0.01" className="input-field" value={form.operational_cost} onChange={e => setForm({...form, operational_cost: e.target.value})} placeholder="0,00" />
                  </div>
                </div>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium mb-1">Observacoes</label>
              <textarea className="input-field" rows={3} value={form.notes} onChange={e => setForm({...form, notes: e.target.value})} />
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button type="button" onClick={() => setShowModal(false)} className="btn-secondary">Cancelar</button>
              <button type="submit" className="btn-primary">{editingClient ? 'Salvar' : 'Criar Cliente'}</button>
            </div>
          </form>
        </Modal>
      </div>
    </AuthGuard>
  );
}
