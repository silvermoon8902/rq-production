'use client';

import { useEffect, useState, useMemo, useRef } from 'react';
import AuthGuard from '@/components/layout/AuthGuard';
import Modal from '@/components/ui/Modal';
import { designApi, clientsApi, teamApi } from '@/services/api';
import { useAuthStore } from '@/stores/authStore';
import { DesignColumn, DesignDemand, DesignAttachment, DesignComment, Client, TeamMember } from '@/types';
import {
  Plus, Building2, User, Filter, Trash2, Pencil, MessageSquare,
  Paperclip, Image, Video, CheckCircle, Clock, X, Upload, DollarSign,
} from 'lucide-react';
import toast from 'react-hot-toast';

const typeLabel: Record<string, { label: string; color: string; icon: typeof Image }> = {
  arte: { label: 'Arte', color: 'bg-blue-500/20 text-blue-400', icon: Image },
  video: { label: 'Vídeo', color: 'bg-purple-500/20 text-purple-400', icon: Video },
};

const formatTimeAgo = (dateStr: string) => {
  const diff = Date.now() - new Date(dateStr).getTime();
  const hours = Math.floor(diff / 3600000);
  if (hours < 1) return 'agora';
  if (hours < 24) return `${hours}h atrás`;
  const days = Math.floor(hours / 24);
  return days < 7 ? `${days}d atrás` : `${Math.floor(days / 7)}sem atrás`;
};

export default function DesignPage() {
  const [columns, setColumns] = useState<DesignColumn[]>([]);
  const [allDemands, setAllDemands] = useState<Record<string, DesignDemand[]>>({});
  const [clients, setClients] = useState<Client[]>([]);
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [previewDemand, setPreviewDemand] = useState<DesignDemand | null>(null);
  const [modalTitle, setModalTitle] = useState('Nova Demanda Design');
  const { user } = useAuthStore();

  // Filters
  const [filterClient, setFilterClient] = useState('');
  const [filterMember, setFilterMember] = useState('');
  const [filterType, setFilterType] = useState('');

  // Create form
  const [form, setForm] = useState({
    title: '', description: '', demand_type: 'arte',
    client_id: '', assigned_to_id: '', due_date: '', column_id: '',
  });

  // Edit
  const [editingDemand, setEditingDemand] = useState<DesignDemand | null>(null);
  const [editForm, setEditForm] = useState({
    title: '', description: '', demand_type: 'arte',
    client_id: '', assigned_to_id: '', due_date: '',
  });

  // Preview state
  const [previewComments, setPreviewComments] = useState<DesignComment[]>([]);
  const [previewAttachments, setPreviewAttachments] = useState<DesignAttachment[]>([]);
  const [commentText, setCommentText] = useState('');
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [draggedDemand, setDraggedDemand] = useState<DesignDemand | null>(null);

  // Payment summary modal
  const [showPayments, setShowPayments] = useState(false);
  const [paymentSummary, setPaymentSummary] = useState<any[]>([]);

  useEffect(() => { loadBoard(); }, []);

  const loadBoard = async () => {
    try {
      const [boardRes, clientsRes, membersRes] = await Promise.all([
        designApi.getBoard(), clientsApi.getAll(), teamApi.getMembers(),
      ]);
      setColumns(boardRes.data.columns);
      setAllDemands(boardRes.data.demands);
      setClients(clientsRes.data);
      setMembers(membersRes.data);
    } catch { toast.error('Erro ao carregar board de design'); }
    finally { setLoading(false); }
  };

  const filteredDemands = useMemo(() => {
    const filtered: Record<string, DesignDemand[]> = {};
    for (const [colId, colDemands] of Object.entries(allDemands)) {
      filtered[colId] = colDemands.filter(d => {
        if (filterClient && d.client_id !== Number(filterClient)) return false;
        if (filterMember && d.assigned_to_id !== Number(filterMember)) return false;
        if (filterType && d.demand_type !== filterType) return false;
        return true;
      });
    }
    return filtered;
  }, [allDemands, filterClient, filterMember, filterType]);

  const activeFilterCount = [filterClient, filterMember, filterType].filter(Boolean).length;
  const clearFilters = () => { setFilterClient(''); setFilterMember(''); setFilterType(''); };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await designApi.create({
        title: form.title,
        description: form.description || null,
        demand_type: form.demand_type,
        client_id: form.client_id ? Number(form.client_id) : null,
        assigned_to_id: form.assigned_to_id ? Number(form.assigned_to_id) : null,
        due_date: form.due_date || null,
        column_id: form.column_id ? Number(form.column_id) : null,
      });
      toast.success('Demanda de design criada');
      setShowModal(false);
      setForm({ title: '', description: '', demand_type: 'arte', client_id: '', assigned_to_id: '', due_date: '', column_id: '' });
      loadBoard();
    } catch { toast.error('Erro ao criar demanda'); }
  };

  const handleDragStart = (demand: DesignDemand) => { setDraggedDemand(demand); };
  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); };

  const handleDrop = async (columnId: number) => {
    if (!draggedDemand || draggedDemand.column_id === columnId) {
      setDraggedDemand(null);
      return;
    }
    try {
      await designApi.move(draggedDemand.id, { column_id: columnId, position: 0 });
      loadBoard();
    } catch { toast.error('Erro ao mover demanda'); }
    finally { setDraggedDemand(null); }
  };

  const canEdit = user?.role === 'admin' || user?.role === 'gerente';

  const handleDelete = async (id: number, title: string) => {
    if (!confirm(`Excluir demanda "${title}"?`)) return;
    try {
      await designApi.delete(id);
      toast.success('Demanda excluída');
      loadBoard();
    } catch { toast.error('Erro ao excluir'); }
  };

  const openEdit = (d: DesignDemand) => {
    setEditingDemand(d);
    setEditForm({
      title: d.title,
      description: d.description || '',
      demand_type: d.demand_type,
      client_id: d.client_id?.toString() || '',
      assigned_to_id: d.assigned_to_id?.toString() || '',
      due_date: d.due_date ? d.due_date.slice(0, 16) : '',
    });
  };

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingDemand) return;
    try {
      await designApi.update(editingDemand.id, {
        title: editForm.title,
        description: editForm.description || null,
        demand_type: editForm.demand_type,
        client_id: editForm.client_id ? Number(editForm.client_id) : null,
        assigned_to_id: editForm.assigned_to_id ? Number(editForm.assigned_to_id) : null,
        due_date: editForm.due_date || null,
      });
      toast.success('Demanda atualizada');
      setEditingDemand(null);
      loadBoard();
    } catch { toast.error('Erro ao atualizar'); }
  };

  // Preview
  const openPreview = async (d: DesignDemand) => {
    setPreviewDemand(d);
    try {
      const [comRes, attRes] = await Promise.all([
        designApi.getComments(d.id),
        designApi.getAttachments(d.id),
      ]);
      setPreviewComments(comRes.data);
      setPreviewAttachments(attRes.data);
    } catch { /* ignore */ }
  };

  const handleAddComment = async () => {
    if (!previewDemand || !commentText.trim()) return;
    try {
      await designApi.addComment(previewDemand.id, { text: commentText });
      setCommentText('');
      const res = await designApi.getComments(previewDemand.id);
      setPreviewComments(res.data);
    } catch { toast.error('Erro ao comentar'); }
  };

  const handleUpload = async (files: FileList | null) => {
    if (!files || !previewDemand) return;
    setUploading(true);
    try {
      for (let i = 0; i < files.length; i++) {
        await designApi.uploadAttachment(previewDemand.id, files[i]);
      }
      toast.success('Arquivo(s) enviado(s)');
      const res = await designApi.getAttachments(previewDemand.id);
      setPreviewAttachments(res.data);
      loadBoard();
    } catch { toast.error('Erro no upload'); }
    finally { setUploading(false); }
  };

  const handleApprove = async (id: number) => {
    if (!confirm('Aprovar esta demanda e registrar pagamento?')) return;
    try {
      await designApi.approve(id);
      toast.success('Demanda aprovada! Pagamento registrado.');
      setPreviewDemand(null);
      loadBoard();
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Erro ao aprovar');
    }
  };

  const handleDeleteAttachment = async (attId: number) => {
    if (!confirm('Excluir este arquivo?')) return;
    try {
      await designApi.deleteAttachment(attId);
      if (previewDemand) {
        const res = await designApi.getAttachments(previewDemand.id);
        setPreviewAttachments(res.data);
      }
      loadBoard();
    } catch { toast.error('Erro ao excluir arquivo'); }
  };

  // Payment summary
  const openPayments = async () => {
    const now = new Date();
    try {
      const res = await designApi.getPaymentSummary(now.getMonth() + 1, now.getFullYear());
      setPaymentSummary(res.data);
      setShowPayments(true);
    } catch { toast.error('Erro ao carregar pagamentos'); }
  };

  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1';
  const getFileUrl = (attId: number) => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('access_token') : '';
    return `${API_URL}/design/attachments/${attId}/file?token=${token}`;
  };

  return (
    <AuthGuard>
      <div>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-3">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold">Design</h1>
            <p className="text-gray-500 mt-1">Kanban de criação — Arte R$10 | Vídeo R$20</p>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={openPayments} className="btn-secondary flex items-center gap-2" title="Pagamentos do mês">
              <DollarSign className="h-4 w-4" /> Pagamentos
            </button>
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
              setForm({ title: '', description: '', demand_type: 'arte', client_id: '', assigned_to_id: '', due_date: '', column_id: '' });
              setModalTitle('Nova Demanda Design');
              setShowModal(true);
            }} className="btn-primary flex items-center gap-2">
              <Plus className="h-4 w-4" /> Nova Demanda
            </button>
          </div>
        </div>

        {/* Filters */}
        {showFilters && (
          <div className="card mb-6">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-gray-600">Filtros</h3>
              {activeFilterCount > 0 && (
                <button onClick={clearFilters} className="text-xs text-red-500 hover:text-red-700">Limpar</button>
              )}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Cliente</label>
                <select className="input-field text-sm" value={filterClient} onChange={e => setFilterClient(e.target.value)}>
                  <option value="">Todos</option>
                  {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Designer</label>
                <select className="input-field text-sm" value={filterMember} onChange={e => setFilterMember(e.target.value)}>
                  <option value="">Todos</option>
                  {members.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Tipo</label>
                <select className="input-field text-sm" value={filterType} onChange={e => setFilterType(e.target.value)}>
                  <option value="">Todos</option>
                  <option value="arte">Arte</option>
                  <option value="video">Vídeo</option>
                </select>
              </div>
            </div>
          </div>
        )}

        {/* Board */}
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
                          setForm({ title: '', description: '', demand_type: 'arte', client_id: '', assigned_to_id: '', due_date: '', column_id: String(column.id) });
                          setModalTitle(`Nova Demanda — ${column.name}`);
                          setShowModal(true);
                        }}
                        className="w-6 h-6 flex items-center justify-center rounded-full bg-white dark:bg-dark-700 hover:bg-primary-300 hover:text-dark-900 text-gray-400 transition-colors text-sm font-bold"
                      >+</button>
                    </div>
                  </div>

                  <div className="space-y-3 min-h-[200px]">
                    {colDemands.map((demand) => {
                      const tp = typeLabel[demand.demand_type] || typeLabel.arte;
                      const TypeIcon = tp.icon;
                      return (
                        <div
                          key={demand.id}
                          draggable
                          onDragStart={() => handleDragStart(demand)}
                          onClick={() => openPreview(demand)}
                          className={`bg-white dark:bg-dark-700 rounded-lg p-3 shadow-sm border-l-4 cursor-pointer hover:shadow-md transition-shadow ${
                            demand.payment_registered ? 'border-l-green-500' : 'border-l-gray-300 dark:border-l-dark-600'
                          }`}
                        >
                          <div className="flex items-start justify-between mb-1.5 gap-1">
                            <h4 className="text-sm font-medium leading-snug flex-1 min-w-0">{demand.title}</h4>
                            <div className="flex items-center gap-1 flex-shrink-0" onClick={e => e.stopPropagation()}>
                              <button onClick={() => openEdit(demand)} className="text-gray-300 hover:text-primary-500 transition-colors">
                                <Pencil className="h-3.5 w-3.5" />
                              </button>
                              {canEdit && (
                                <button onClick={() => handleDelete(demand.id, demand.title)} className="text-gray-300 hover:text-red-500 transition-colors">
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center gap-2 mb-2">
                            <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded ${tp.color}`}>
                              <TypeIcon className="h-3 w-3" /> {tp.label}
                            </span>
                            {demand.payment_registered && (
                              <span className="inline-flex items-center gap-1 text-xs text-green-500">
                                <CheckCircle className="h-3 w-3" /> R${demand.payment_value}
                              </span>
                            )}
                          </div>

                          <div className="flex items-center justify-between text-xs text-gray-400 mb-1">
                            {demand.client_name && (
                              <span className="flex items-center gap-1"><Building2 className="h-3 w-3" />{demand.client_name}</span>
                            )}
                            {demand.assigned_to_name && (
                              <span className="flex items-center gap-1"><User className="h-3 w-3" />{demand.assigned_to_name}</span>
                            )}
                          </div>

                          <div className="flex items-center justify-between text-xs text-gray-400">
                            <span>{formatTimeAgo(demand.created_at)}</span>
                            <div className="flex items-center gap-2">
                              {demand.attachments_count > 0 && (
                                <span className="flex items-center gap-1"><Paperclip className="h-3 w-3" />{demand.attachments_count}</span>
                              )}
                              {demand.comments_count > 0 && (
                                <span className="flex items-center gap-1"><MessageSquare className="h-3 w-3" />{demand.comments_count}</span>
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

        {/* === Preview Modal === */}
        <Modal isOpen={!!previewDemand} onClose={() => setPreviewDemand(null)} title="" size="lg">
          {previewDemand && (
            <div className="space-y-4">
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-lg font-bold">{previewDemand.title}</h2>
                  <div className="flex items-center gap-2 mt-1">
                    {(() => { const tp = typeLabel[previewDemand.demand_type] || typeLabel.arte; const TI = tp.icon; return (
                      <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded ${tp.color}`}><TI className="h-3 w-3" /> {tp.label}</span>
                    ); })()}
                    {previewDemand.client_name && <span className="text-xs text-gray-500">{previewDemand.client_name}</span>}
                    {previewDemand.assigned_to_name && <span className="text-xs text-gray-500">— {previewDemand.assigned_to_name}</span>}
                  </div>
                </div>
                {canEdit && !previewDemand.payment_registered && (
                  <button onClick={() => handleApprove(previewDemand.id)} className="btn-primary text-sm flex items-center gap-1">
                    <CheckCircle className="h-4 w-4" /> Aprovar
                  </button>
                )}
                {previewDemand.payment_registered && (
                  <span className="text-green-500 text-sm font-semibold flex items-center gap-1">
                    <CheckCircle className="h-4 w-4" /> Aprovado — R${previewDemand.payment_value}
                  </span>
                )}
              </div>

              {previewDemand.description && (
                <p className="text-sm text-gray-600 dark:text-gray-400">{previewDemand.description}</p>
              )}

              {/* Attachments */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-semibold">Anexos ({previewAttachments.length})</h3>
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading}
                    className="text-xs text-primary-400 hover:text-primary-300 flex items-center gap-1"
                  >
                    <Upload className="h-3 w-3" /> {uploading ? 'Enviando...' : 'Upload'}
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    accept="image/*,video/*,.pdf"
                    className="hidden"
                    onChange={e => handleUpload(e.target.files)}
                  />
                </div>
                {previewAttachments.length > 0 ? (
                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                    {previewAttachments.map(att => (
                      <div key={att.id} className="relative group">
                        {att.file_type?.startsWith('image/') ? (
                          <a href={getFileUrl(att.id)} target="_blank" rel="noopener noreferrer">
                            <img
                              src={getFileUrl(att.id)}
                              alt={att.filename}
                              className="w-full h-20 object-cover rounded-lg border border-dark-600"
                            />
                          </a>
                        ) : (
                          <a
                            href={getFileUrl(att.id)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="w-full h-20 flex items-center justify-center bg-dark-700 rounded-lg border border-dark-600 text-xs text-gray-400"
                          >
                            {att.file_type?.startsWith('video/') ? <Video className="h-6 w-6" /> : <Paperclip className="h-6 w-6" />}
                          </a>
                        )}
                        <p className="text-xs text-gray-500 mt-1 truncate">{att.filename}</p>
                        {canEdit && (
                          <button
                            onClick={() => handleDeleteAttachment(att.id)}
                            className="absolute top-1 right-1 bg-red-500/80 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-gray-500">Nenhum anexo</p>
                )}
              </div>

              {/* Comments */}
              <div>
                <h3 className="text-sm font-semibold mb-2">Comentários ({previewComments.length})</h3>
                <div className="space-y-2 max-h-48 overflow-y-auto mb-3">
                  {previewComments.map(c => (
                    <div key={c.id} className="bg-gray-100 dark:bg-dark-800 rounded-lg p-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-primary-400">{c.user_name || 'Usuário'}</span>
                        <span className="text-xs text-gray-500">{new Date(c.created_at).toLocaleString('pt-BR')}</span>
                      </div>
                      <p className="text-sm mt-1">{c.text}</p>
                    </div>
                  ))}
                </div>
                <div className="flex gap-2">
                  <input
                    className="input-field text-sm flex-1"
                    placeholder="Adicionar comentário..."
                    value={commentText}
                    onChange={e => setCommentText(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleAddComment()}
                  />
                  <button onClick={handleAddComment} className="btn-primary text-sm px-3">Enviar</button>
                </div>
              </div>
            </div>
          )}
        </Modal>

        {/* === Edit Modal === */}
        <Modal isOpen={!!editingDemand} onClose={() => setEditingDemand(null)} title="Editar Demanda Design" size="lg">
          <form onSubmit={handleEdit} className="space-y-4">
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
                <label className="block text-sm font-medium mb-1">Tipo *</label>
                <select className="input-field" value={editForm.demand_type} onChange={e => setEditForm({...editForm, demand_type: e.target.value})}>
                  <option value="arte">Arte (R$ 10)</option>
                  <option value="video">Vídeo (R$ 20)</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Cliente</label>
                <select className="input-field" value={editForm.client_id} onChange={e => setEditForm({...editForm, client_id: e.target.value})}>
                  <option value="">Sem cliente</option>
                  {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Designer</label>
                <select className="input-field" value={editForm.assigned_to_id} onChange={e => setEditForm({...editForm, assigned_to_id: e.target.value})}>
                  <option value="">Sem responsável</option>
                  {members.map(m => <option key={m.id} value={m.id}>{m.name} — {m.role_title}</option>)}
                </select>
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

        {/* === Create Modal === */}
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
                <label className="block text-sm font-medium mb-1">Tipo *</label>
                <select className="input-field" value={form.demand_type} onChange={e => setForm({...form, demand_type: e.target.value})}>
                  <option value="arte">Arte (R$ 10)</option>
                  <option value="video">Vídeo (R$ 20)</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Coluna</label>
                <select className="input-field" value={form.column_id} onChange={e => setForm({...form, column_id: e.target.value})}>
                  <option value="">Padrão</option>
                  {columns.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
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
                <label className="block text-sm font-medium mb-1">Designer</label>
                <select className="input-field" value={form.assigned_to_id} onChange={e => setForm({...form, assigned_to_id: e.target.value})}>
                  <option value="">Sem responsável</option>
                  {members.map(m => <option key={m.id} value={m.id}>{m.name} — {m.role_title}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Prazo</label>
              <input type="datetime-local" className="input-field" value={form.due_date} onChange={e => setForm({...form, due_date: e.target.value})} />
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button type="button" onClick={() => setShowModal(false)} className="btn-secondary">Cancelar</button>
              <button type="submit" className="btn-primary">Criar Demanda</button>
            </div>
          </form>
        </Modal>

        {/* === Payments Modal === */}
        <Modal isOpen={showPayments} onClose={() => setShowPayments(false)} title="Pagamentos Design — Mês Atual" size="lg">
          {paymentSummary.length === 0 ? (
            <p className="text-sm text-gray-500 text-center py-8">Nenhum pagamento registrado neste mês.</p>
          ) : (
            <div className="space-y-4">
              {paymentSummary.map((s: any) => (
                <div key={s.member_id} className="card">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-semibold">{s.member_name}</h3>
                    <span className="text-lg font-bold text-green-500">R$ {Number(s.total_value).toFixed(2)}</span>
                  </div>
                  <div className="flex gap-4 text-sm text-gray-500 mb-3">
                    <span className="flex items-center gap-1"><Image className="h-4 w-4 text-blue-400" /> {s.total_artes} artes</span>
                    <span className="flex items-center gap-1"><Video className="h-4 w-4 text-purple-400" /> {s.total_videos} vídeos</span>
                  </div>
                  <div className="space-y-1">
                    {s.payments.map((p: any) => (
                      <div key={p.id} className="flex items-center justify-between text-xs text-gray-400 bg-gray-100 dark:bg-dark-800 rounded px-2 py-1">
                        <span>{p.demand_title || `Demanda #${p.demand_id}`}</span>
                        <div className="flex items-center gap-3">
                          {p.client_name && <span>{p.client_name}</span>}
                          <span className={p.demand_type === 'arte' ? 'text-blue-400' : 'text-purple-400'}>
                            R$ {Number(p.value).toFixed(2)}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Modal>
      </div>
    </AuthGuard>
  );
}
