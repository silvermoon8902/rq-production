'use client';

import { useEffect, useState, useMemo, useRef } from 'react';
import AuthGuard from '@/components/layout/AuthGuard';
import Modal from '@/components/ui/Modal';
import { designApi, clientsApi, teamApi } from '@/services/api';
import { useAuthStore } from '@/stores/authStore';
import { DesignColumn, DesignDemand, DesignAttachment, DesignComment, DesignMemberRate, Client, TeamMember } from '@/types';
import {
  Plus, Building2, User, Filter, Trash2, Pencil, MessageSquare,
  Paperclip, Image, Video, CheckCircle, X, Upload, DollarSign, AlignLeft, Settings,
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

const getInitials = (name: string): string => {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return name.substring(0, 2).toUpperCase();
};

const AVATAR_COLORS = [
  'bg-red-500', 'bg-orange-500', 'bg-green-500', 'bg-blue-500',
  'bg-purple-500', 'bg-pink-500', 'bg-indigo-500', 'bg-teal-500',
];

const getAvatarColor = (name: string): string => {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
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
  const [memberRates, setMemberRates] = useState<DesignMemberRate[]>([]);
  const [showRatesConfig, setShowRatesConfig] = useState(false);
  const [editingRates, setEditingRates] = useState<Record<number, { arte: string; video: string }>>({});

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
      const res = await designApi.approve(id);
      toast.success('Demanda aprovada! Pagamento registrado.');
      setPreviewDemand(res.data);
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

  // Payment summary + rates
  const openPayments = async () => {
    const now = new Date();
    try {
      const [summaryRes, ratesRes] = await Promise.all([
        designApi.getPaymentSummary(now.getMonth() + 1, now.getFullYear()),
        designApi.getRates().catch(() => ({ data: [] })),
      ]);
      setPaymentSummary(summaryRes.data);
      setMemberRates(ratesRes.data);
      setShowPayments(true);
    } catch { toast.error('Erro ao carregar pagamentos'); }
  };

  const handleSaveRate = async (memberId: number) => {
    const vals = editingRates[memberId];
    if (!vals) return;
    try {
      await designApi.updateRate({
        member_id: memberId,
        arte_value: Number(vals.arte),
        video_value: Number(vals.video),
      });
      toast.success('Valores atualizados');
      const res = await designApi.getRates();
      setMemberRates(res.data);
      setEditingRates(prev => { const next = { ...prev }; delete next[memberId]; return next; });
    } catch { toast.error('Erro ao salvar valores'); }
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
            <p className="text-gray-500 mt-1">Kanban de criação — Valores por colaborador</p>
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
                          {/* Title + Edit/Delete */}
                          <div className="flex items-start justify-between mb-1 gap-1">
                            <h4 className="text-sm font-medium leading-snug flex-1 min-w-0 line-clamp-2">
                              {demand.client_name ? `${demand.client_name} - ${demand.title}` : demand.title}
                            </h4>
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

                          {/* Type Badge + Payment */}
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

                          {/* Bottom: icons left + avatar right */}
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2 text-xs text-gray-400">
                              {demand.description && <AlignLeft className="h-3 w-3" />}
                              {demand.attachments_count > 0 && (
                                <span className="flex items-center gap-0.5"><Paperclip className="h-3 w-3" />{demand.attachments_count}</span>
                              )}
                              {demand.comments_count > 0 && (
                                <span className="flex items-center gap-0.5"><MessageSquare className="h-3 w-3" />{demand.comments_count}</span>
                              )}
                            </div>
                            {demand.assigned_to_name && (
                              <div
                                className={`w-6 h-6 rounded-full flex items-center justify-center text-white text-[10px] font-bold ${getAvatarColor(demand.assigned_to_name)}`}
                                title={demand.assigned_to_name}
                              >
                                {getInitials(demand.assigned_to_name)}
                              </div>
                            )}
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

        {/* === Preview Modal (2-column) === */}
        <Modal isOpen={!!previewDemand} onClose={() => setPreviewDemand(null)} title="" size="xl">
          {previewDemand && (
            <div>
              {/* Header */}
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h2 className="text-lg font-bold">
                    {previewDemand.client_name ? `${previewDemand.client_name} - ${previewDemand.title}` : previewDemand.title}
                  </h2>
                  <div className="flex items-center gap-2 mt-1">
                    {(() => { const tp = typeLabel[previewDemand.demand_type] || typeLabel.arte; const TI = tp.icon; return (
                      <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded ${tp.color}`}><TI className="h-3 w-3" /> {tp.label}</span>
                    ); })()}
                    <span className="text-xs text-gray-500">em {previewDemand.column_name}</span>
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

              {/* Two-column body */}
              <div className="flex flex-col md:flex-row gap-6">
                {/* LEFT SIDE (60%) */}
                <div className="md:w-3/5 space-y-5">
                  {/* Members */}
                  {previewDemand.assigned_to_name && (
                    <div>
                      <h3 className="text-xs font-semibold text-gray-500 uppercase mb-2">Membros</h3>
                      <div className="flex items-center gap-2">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold ${getAvatarColor(previewDemand.assigned_to_name)}`}>
                          {getInitials(previewDemand.assigned_to_name)}
                        </div>
                        <span className="text-sm">{previewDemand.assigned_to_name}</span>
                      </div>
                    </div>
                  )}

                  {/* Briefing (was Descrição) */}
                  <div>
                    <h3 className="text-xs font-semibold text-gray-500 uppercase mb-2">Briefing</h3>
                    {previewDemand.description ? (
                      <p className="text-sm text-gray-600 dark:text-gray-400 whitespace-pre-wrap">{previewDemand.description}</p>
                    ) : (
                      <p className="text-sm text-gray-400 italic">Sem briefing</p>
                    )}
                  </div>

                  {/* Criativos (was Anexos) */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="text-xs font-semibold text-gray-500 uppercase">
                        Criativos ({previewAttachments.length})
                      </h3>
                      <div>
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
                    </div>
                    {previewAttachments.length > 0 ? (
                      <div className="space-y-2">
                        {previewAttachments.map(att => (
                          <div key={att.id} className="flex items-center gap-3 bg-gray-100 dark:bg-dark-800 rounded-lg p-2 group">
                            {att.file_type?.startsWith('image/') ? (
                              <a href={getFileUrl(att.id)} target="_blank" rel="noopener noreferrer">
                                <img src={getFileUrl(att.id)} alt={att.filename} className="w-16 h-12 object-cover rounded border border-gray-300 dark:border-dark-600" />
                              </a>
                            ) : (
                              <a href={getFileUrl(att.id)} target="_blank" rel="noopener noreferrer"
                                className="w-16 h-12 flex items-center justify-center bg-gray-200 dark:bg-dark-700 rounded border border-gray-300 dark:border-dark-600">
                                {att.file_type?.startsWith('video/') ? <Video className="h-5 w-5 text-gray-400" /> : <Paperclip className="h-5 w-5 text-gray-400" />}
                              </a>
                            )}
                            <div className="flex-1 min-w-0">
                              <p className="text-sm truncate">{att.filename}</p>
                              <p className="text-xs text-gray-500">
                                {new Date(att.created_at).toLocaleDateString('pt-BR')}
                                {' — '}
                                {att.file_size > 1024 * 1024
                                  ? `${(att.file_size / (1024 * 1024)).toFixed(1)} MB`
                                  : `${(att.file_size / 1024).toFixed(0)} KB`
                                }
                              </p>
                            </div>
                            {canEdit && (
                              <button
                                onClick={() => handleDeleteAttachment(att.id)}
                                className="text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                              >
                                <X className="h-4 w-4" />
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-gray-500 italic">Nenhum criativo</p>
                    )}
                  </div>
                </div>

                {/* RIGHT SIDE (40%) — Comments */}
                <div className="md:w-2/5 md:border-l dark:border-dark-700 md:pl-6">
                  <h3 className="text-xs font-semibold text-gray-500 uppercase mb-3">
                    Comentários e atividade
                  </h3>

                  {/* Comment input at top */}
                  <div className="flex gap-2 mb-4">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0 ${getAvatarColor(user?.name || 'U')}`}>
                      {getInitials(user?.name || 'User')}
                    </div>
                    <div className="flex-1">
                      <input
                        className="input-field text-sm w-full"
                        placeholder="Escreva um comentário..."
                        value={commentText}
                        onChange={e => setCommentText(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && handleAddComment()}
                      />
                    </div>
                  </div>

                  {/* Comments list */}
                  <div className="space-y-3 max-h-[400px] overflow-y-auto">
                    {previewComments.map(c => (
                      <div key={c.id} className="flex gap-2">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0 ${getAvatarColor(c.user_name || 'U')}`}>
                          {getInitials(c.user_name || 'User')}
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-semibold">{c.user_name || 'Usuário'}</span>
                            <span className="text-xs text-gray-500">{new Date(c.created_at).toLocaleString('pt-BR')}</span>
                          </div>
                          <p className="text-sm mt-0.5 text-gray-600 dark:text-gray-400">{c.text}</p>
                        </div>
                      </div>
                    ))}
                    {previewComments.length === 0 && (
                      <p className="text-xs text-gray-500 italic text-center py-4">Nenhum comentário</p>
                    )}
                  </div>
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
              <label className="block text-sm font-medium mb-1">Briefing</label>
              <textarea className="input-field" rows={3} value={editForm.description} onChange={e => setEditForm({...editForm, description: e.target.value})} />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Tipo *</label>
                <select className="input-field" value={editForm.demand_type} onChange={e => setEditForm({...editForm, demand_type: e.target.value})}>
                  <option value="arte">Arte</option>
                  <option value="video">Vídeo</option>
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
              <label className="block text-sm font-medium mb-1">Briefing</label>
              <textarea className="input-field" rows={3} value={form.description} onChange={e => setForm({...form, description: e.target.value})} />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Tipo *</label>
                <select className="input-field" value={form.demand_type} onChange={e => setForm({...form, demand_type: e.target.value})}>
                  <option value="arte">Arte</option>
                  <option value="video">Vídeo</option>
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
          {/* Rates Config Toggle */}
          {canEdit && (
            <div className="flex justify-end mb-4">
              <button
                onClick={() => setShowRatesConfig(!showRatesConfig)}
                className={`btn-secondary text-xs flex items-center gap-1 ${showRatesConfig ? 'ring-2 ring-primary-300' : ''}`}
              >
                <Settings className="h-3.5 w-3.5" /> Configurar Valores
              </button>
            </div>
          )}

          {/* Rates Config Panel */}
          {showRatesConfig && canEdit && (
            <div className="card mb-4">
              <h4 className="text-sm font-semibold mb-3">Valores por Colaborador</h4>
              <div className="space-y-2">
                {memberRates.map(r => {
                  const isEditing = editingRates[r.member_id] !== undefined;
                  return (
                    <div key={r.member_id} className="flex items-center gap-3 text-sm">
                      <div className={`w-7 h-7 rounded-full flex items-center justify-center text-white text-[10px] font-bold ${getAvatarColor(r.member_name)}`}>
                        {getInitials(r.member_name)}
                      </div>
                      <span className="flex-1 min-w-0 truncate">{r.member_name}</span>
                      <div className="flex items-center gap-2">
                        <div className="flex items-center gap-1">
                          <span className="text-xs text-blue-400">Arte</span>
                          <input
                            type="number"
                            step="0.01"
                            className="input-field text-xs w-20 text-center"
                            value={isEditing ? editingRates[r.member_id].arte : r.arte_value}
                            onChange={e => setEditingRates(prev => ({
                              ...prev,
                              [r.member_id]: { arte: e.target.value, video: prev[r.member_id]?.video || String(r.video_value) }
                            }))}
                          />
                        </div>
                        <div className="flex items-center gap-1">
                          <span className="text-xs text-purple-400">Vídeo</span>
                          <input
                            type="number"
                            step="0.01"
                            className="input-field text-xs w-20 text-center"
                            value={isEditing ? editingRates[r.member_id].video : r.video_value}
                            onChange={e => setEditingRates(prev => ({
                              ...prev,
                              [r.member_id]: { arte: prev[r.member_id]?.arte || String(r.arte_value), video: e.target.value }
                            }))}
                          />
                        </div>
                        {isEditing && (
                          <button onClick={() => handleSaveRate(r.member_id)} className="btn-primary text-xs px-2 py-1">
                            Salvar
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
                {memberRates.length === 0 && (
                  <p className="text-xs text-gray-500 italic">Nenhum membro ativo</p>
                )}
              </div>
            </div>
          )}

          {/* Payment Summary */}
          {paymentSummary.length === 0 ? (
            <p className="text-sm text-gray-500 text-center py-8">Nenhum pagamento registrado neste mês.</p>
          ) : (
            <div className="space-y-4">
              {paymentSummary.map((s: any) => (
                <div key={s.member_id} className="card">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold ${getAvatarColor(s.member_name)}`}>
                        {getInitials(s.member_name)}
                      </div>
                      <div>
                        <h3 className="font-semibold">{s.member_name}</h3>
                        <span className="text-xs text-gray-500">
                          Arte R${Number(s.arte_rate || 10).toFixed(2)} | Vídeo R${Number(s.video_rate || 20).toFixed(2)}
                        </span>
                      </div>
                    </div>
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
