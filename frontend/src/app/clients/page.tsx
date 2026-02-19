'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import AuthGuard from '@/components/layout/AuthGuard';
import Modal from '@/components/ui/Modal';
import StatusBadge from '@/components/ui/StatusBadge';
import { clientsApi } from '@/services/api';
import { useAuthStore } from '@/stores/authStore';
import { Client } from '@/types';
import { Plus, Search, Building2 } from 'lucide-react';
import toast from 'react-hot-toast';

export default function ClientsPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [form, setForm] = useState({ name: '', company: '', email: '', phone: '', segment: '', status: 'active', notes: '' });
  const { user } = useAuthStore();

  useEffect(() => { loadClients(); }, []);

  const loadClients = async () => {
    try {
      const { data } = await clientsApi.getAll();
      setClients(data);
    } catch { toast.error('Erro ao carregar clientes'); }
    finally { setLoading(false); }
  };

  const filtered = clients.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.company?.toLowerCase().includes(search.toLowerCase())
  );

  const openCreate = () => {
    setEditingClient(null);
    setForm({ name: '', company: '', email: '', phone: '', segment: '', status: 'active', notes: '' });
    setShowModal(true);
  };

  const openEdit = (client: Client) => {
    setEditingClient(client);
    setForm({
      name: client.name, company: client.company || '', email: client.email || '',
      phone: client.phone || '', segment: client.segment || '',
      status: client.status, notes: client.notes || '',
    });
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingClient) {
        await clientsApi.update(editingClient.id, form);
        toast.success('Cliente atualizado');
      } else {
        await clientsApi.create(form);
        toast.success('Cliente criado');
      }
      setShowModal(false);
      loadClients();
    } catch { toast.error('Erro ao salvar cliente'); }
  };

  const canEdit = user?.role === 'admin' || user?.role === 'gerente';

  return (
    <AuthGuard>
      <div>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-3">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold">Clientes</h1>
            <p className="text-gray-500 mt-1">{clients.length} clientes cadastrados</p>
          </div>
          {canEdit && (
            <button onClick={openCreate} className="btn-primary flex items-center gap-2">
              <Plus className="h-4 w-4" /> Novo Cliente
            </button>
          )}
        </div>

        <div className="mb-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar clientes..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="input-field pl-10"
            />
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((client) => (
              <Link key={client.id} href={`/clients/${client.id}`}>
                <div className="card hover:shadow-md transition-shadow cursor-pointer">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="bg-primary-100 p-2 rounded-lg">
                        <Building2 className="h-5 w-5 text-primary-600" />
                      </div>
                      <div>
                        <h3 className="font-semibold">{client.name}</h3>
                        {client.company && <p className="text-sm text-gray-500">{client.company}</p>}
                      </div>
                    </div>
                    <StatusBadge status={client.status} />
                  </div>
                  {client.segment && (
                    <p className="text-xs text-gray-400">Segmento: {client.segment}</p>
                  )}
                  {canEdit && (
                    <button
                      onClick={(e) => { e.preventDefault(); openEdit(client); }}
                      className="mt-3 text-sm text-primary-600 hover:text-primary-700"
                    >
                      Editar
                    </button>
                  )}
                </div>
              </Link>
            ))}
          </div>
        )}

        <Modal isOpen={showModal} onClose={() => setShowModal(false)} title={editingClient ? 'Editar Cliente' : 'Novo Cliente'}>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">Nome *</label>
              <input className="input-field" value={form.name} onChange={e => setForm({...form, name: e.target.value})} required />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Empresa</label>
              <input className="input-field" value={form.company} onChange={e => setForm({...form, company: e.target.value})} />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Email</label>
                <input type="email" className="input-field" value={form.email} onChange={e => setForm({...form, email: e.target.value})} />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Telefone</label>
                <input className="input-field" value={form.phone} onChange={e => setForm({...form, phone: e.target.value})} />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Segmento</label>
                <input className="input-field" value={form.segment} onChange={e => setForm({...form, segment: e.target.value})} />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Status</label>
                <select className="input-field" value={form.status} onChange={e => setForm({...form, status: e.target.value})}>
                  <option value="active">Ativo</option>
                  <option value="inactive">Inativo</option>
                  <option value="onboarding">Onboarding</option>
                  <option value="churned">Churned</option>
                </select>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Observações</label>
              <textarea className="input-field" rows={3} value={form.notes} onChange={e => setForm({...form, notes: e.target.value})} />
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button type="button" onClick={() => setShowModal(false)} className="btn-secondary">Cancelar</button>
              <button type="submit" className="btn-primary">{editingClient ? 'Salvar' : 'Criar'}</button>
            </div>
          </form>
        </Modal>
      </div>
    </AuthGuard>
  );
}
