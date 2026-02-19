'use client';

import { useEffect, useState } from 'react';
import AuthGuard from '@/components/layout/AuthGuard';
import Modal from '@/components/ui/Modal';
import { authApi, permissionsApi } from '@/services/api';
import { usePermissionsStore } from '@/stores/permissionsStore';
import { User } from '@/types';
import { Plus, CheckCircle, XCircle } from 'lucide-react';
import toast from 'react-hot-toast';

const emptyUserForm = { name: '', email: '', password: '', role: 'colaborador', is_active: true };

const MODULES = [
  { key: 'dashboard', label: 'Dashboard' },
  { key: 'clients',   label: 'Clientes' },
  { key: 'team',      label: 'Equipe' },
  { key: 'demands',   label: 'Demandas' },
  { key: 'daily',     label: 'Daily / 1:1' },
  { key: 'financial', label: 'Financeiro' },
  { key: 'users',     label: 'Usuários' },
];

const ROLES = [
  { key: 'gerente',     label: 'Gerente' },
  { key: 'colaborador', label: 'Colaborador' },
];

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [form, setForm] = useState(emptyUserForm);
  const { matrix, setPermission } = usePermissionsStore();

  useEffect(() => { loadUsers(); }, []);

  const loadUsers = async () => {
    try {
      const { data } = await authApi.getUsers();
      setUsers(data);
    } catch { toast.error('Erro ao carregar usuários'); }
    finally { setLoading(false); }
  };

  const openCreate = () => {
    setEditingUser(null);
    setForm(emptyUserForm);
    setShowModal(true);
  };

  const openEdit = (u: User) => {
    setEditingUser(u);
    setForm({ name: u.name, email: u.email, password: '', role: u.role, is_active: u.is_active });
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingUser) {
        await authApi.updateUser(editingUser.id, {
          name: form.name,
          email: form.email,
          role: form.role,
          is_active: form.is_active,
        });
        toast.success('Usuário atualizado');
      } else {
        await authApi.createUser({
          name: form.name,
          email: form.email,
          password: form.password,
          role: form.role,
        });
        toast.success('Usuário criado');
      }
      setShowModal(false);
      loadUsers();
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || 'Erro ao salvar usuário');
    }
  };

  const handleTogglePerm = async (role: string, module: string, field: 'can_read' | 'can_write') => {
    if (!matrix) return;
    const current = matrix[role]?.[module] ?? { can_read: true, can_write: false };
    const updated = { ...current, [field]: !current[field] };
    // Disabling read also disables write; enabling write also enables read
    if (field === 'can_read' && !updated.can_read) updated.can_write = false;
    if (field === 'can_write' && updated.can_write) updated.can_read = true;
    try {
      await permissionsApi.update(role, module, updated);
      setPermission(role, module, updated);
    } catch {
      toast.error('Erro ao atualizar permissão');
    }
  };

  const roleLabel: Record<string, string> = {
    admin: 'Admin',
    gerente: 'Gerente',
    colaborador: 'Colaborador',
  };

  const roleBadge: Record<string, string> = {
    admin: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
    gerente: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
    colaborador: 'bg-gray-100 text-gray-800 dark:bg-dark-700 dark:text-gray-400',
  };

  return (
    <AuthGuard>
      <div className="space-y-8">

        {/* ── Users table ── */}
        <div>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-3">
            <div>
              <h1 className="text-xl sm:text-2xl font-bold">Usuários</h1>
              <p className="text-gray-500 mt-1">{users.length} usuário{users.length !== 1 ? 's' : ''} cadastrado{users.length !== 1 ? 's' : ''}</p>
            </div>
            <button onClick={openCreate} className="btn-primary flex items-center gap-2 text-sm">
              <Plus className="h-4 w-4" /> Novo Usuário
            </button>
          </div>

          {loading ? (
            <div className="flex justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
            </div>
          ) : (
            <div className="card overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 dark:bg-dark-700">
                  <tr>
                    <th className="text-left px-4 py-3 font-semibold text-gray-600 dark:text-gray-300">Nome</th>
                    <th className="text-left px-4 py-3 font-semibold text-gray-600 dark:text-gray-300 hidden sm:table-cell">Email</th>
                    <th className="text-left px-4 py-3 font-semibold text-gray-600 dark:text-gray-300">Perfil</th>
                    <th className="text-left px-4 py-3 font-semibold text-gray-600 dark:text-gray-300 hidden md:table-cell">Status</th>
                    <th className="text-left px-4 py-3 font-semibold text-gray-600 dark:text-gray-300 hidden lg:table-cell">Criado em</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y dark:divide-dark-700">
                  {users.map(u => (
                    <tr key={u.id} className="hover:bg-gray-50 dark:hover:bg-dark-700">
                      <td className="px-4 py-3 font-medium">{u.name}</td>
                      <td className="px-4 py-3 text-gray-500 hidden sm:table-cell">{u.email}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold ${roleBadge[u.role] || roleBadge.colaborador}`}>
                          {roleLabel[u.role] || u.role}
                        </span>
                      </td>
                      <td className="px-4 py-3 hidden md:table-cell">
                        {u.is_active
                          ? <span className="flex items-center gap-1 text-green-600 text-xs"><CheckCircle className="h-3.5 w-3.5" /> Ativo</span>
                          : <span className="flex items-center gap-1 text-red-500 text-xs"><XCircle className="h-3.5 w-3.5" /> Inativo</span>
                        }
                      </td>
                      <td className="px-4 py-3 text-gray-400 hidden lg:table-cell">
                        {new Date(u.created_at).toLocaleDateString('pt-BR')}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => openEdit(u)}
                          className="text-primary-600 hover:text-primary-700 text-sm font-medium"
                        >
                          Editar
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* ── Module Permissions Matrix ── */}
        <div>
          <div className="mb-4">
            <h2 className="text-lg font-bold">Permissões por Módulo</h2>
            <p className="text-sm text-gray-500 mt-1">
              Configure o acesso de leitura e escrita por perfil. Admin sempre tem acesso total.
            </p>
          </div>

          {!matrix ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary-600" />
            </div>
          ) : (
            <div className="card overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 dark:bg-dark-700">
                  <tr>
                    <th className="text-left px-4 py-3 font-semibold text-gray-600 dark:text-gray-300 w-36">Módulo</th>
                    {ROLES.map(r => (
                      <th key={r.key} colSpan={2} className="text-center px-4 py-3 font-semibold text-gray-600 dark:text-gray-300 border-l dark:border-dark-600">
                        {r.label}
                      </th>
                    ))}
                  </tr>
                  <tr className="border-b dark:border-dark-600">
                    <th className="px-4 py-2" />
                    {ROLES.map(r => (
                      <>
                        <th key={`${r.key}-r`} className="px-3 py-2 text-center text-xs text-gray-400 font-normal border-l dark:border-dark-600 w-24">Leitura</th>
                        <th key={`${r.key}-w`} className="px-3 py-2 text-center text-xs text-gray-400 font-normal w-24">Escrita</th>
                      </>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y dark:divide-dark-700">
                  {MODULES.map(mod => (
                    <tr key={mod.key} className="hover:bg-gray-50 dark:hover:bg-dark-700">
                      <td className="px-4 py-3 font-medium">{mod.label}</td>
                      {ROLES.map(role => {
                        const perm = matrix[role.key]?.[mod.key] ?? { can_read: true, can_write: false };
                        return (
                          <>
                            <td key={`${role.key}-${mod.key}-r`} className="px-3 py-3 text-center border-l dark:border-dark-600">
                              <button
                                onClick={() => handleTogglePerm(role.key, mod.key, 'can_read')}
                                className={`w-10 h-6 rounded-full transition-colors relative inline-flex items-center ${perm.can_read ? 'bg-green-500' : 'bg-gray-300 dark:bg-dark-500'}`}
                                title={perm.can_read ? 'Desativar leitura' : 'Ativar leitura'}
                              >
                                <span className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${perm.can_read ? 'translate-x-5' : 'translate-x-1'}`} />
                              </button>
                            </td>
                            <td key={`${role.key}-${mod.key}-w`} className="px-3 py-3 text-center">
                              <button
                                onClick={() => handleTogglePerm(role.key, mod.key, 'can_write')}
                                className={`w-10 h-6 rounded-full transition-colors relative inline-flex items-center ${perm.can_write ? 'bg-blue-500' : 'bg-gray-300 dark:bg-dark-500'}`}
                                title={perm.can_write ? 'Desativar escrita' : 'Ativar escrita'}
                              >
                                <span className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${perm.can_write ? 'translate-x-5' : 'translate-x-1'}`} />
                              </button>
                            </td>
                          </>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="text-xs text-gray-400 px-4 py-3 border-t dark:border-dark-700">
                Verde = leitura ativa · Azul = escrita ativa · Desativar leitura também remove escrita
              </p>
            </div>
          )}
        </div>

        {/* ── Modal ── */}
        <Modal
          isOpen={showModal}
          onClose={() => setShowModal(false)}
          title={editingUser ? 'Editar Usuário' : 'Novo Usuário'}
        >
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">Nome *</label>
              <input
                className="input-field"
                value={form.name}
                onChange={e => setForm({ ...form, name: e.target.value })}
                required
                placeholder="Nome completo"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Email *</label>
              <input
                type="email"
                className="input-field"
                value={form.email}
                onChange={e => setForm({ ...form, email: e.target.value })}
                required
                placeholder="email@exemplo.com"
              />
            </div>
            {!editingUser && (
              <div>
                <label className="block text-sm font-medium mb-1">Senha *</label>
                <input
                  type="password"
                  className="input-field"
                  value={form.password}
                  onChange={e => setForm({ ...form, password: e.target.value })}
                  required
                  minLength={6}
                  placeholder="Mínimo 6 caracteres"
                />
              </div>
            )}
            <div>
              <label className="block text-sm font-medium mb-1">Perfil de Acesso</label>
              <select
                className="input-field"
                value={form.role}
                onChange={e => setForm({ ...form, role: e.target.value })}
              >
                <option value="colaborador">Colaborador — acesso básico</option>
                <option value="gerente">Gerente — pode editar clientes e demandas</option>
                <option value="admin">Admin — acesso total</option>
              </select>
            </div>
            {editingUser && (
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="is_active_check"
                  checked={form.is_active}
                  onChange={e => setForm({ ...form, is_active: e.target.checked })}
                  className="h-4 w-4"
                />
                <label htmlFor="is_active_check" className="text-sm">Usuário ativo</label>
              </div>
            )}
            <div className="flex justify-end gap-3 pt-2">
              <button type="button" onClick={() => setShowModal(false)} className="btn-secondary">Cancelar</button>
              <button type="submit" className="btn-primary">{editingUser ? 'Salvar' : 'Criar Usuário'}</button>
            </div>
          </form>
        </Modal>
      </div>
    </AuthGuard>
  );
}
