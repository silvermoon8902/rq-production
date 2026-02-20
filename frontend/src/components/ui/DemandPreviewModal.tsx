'use client';

import { useEffect, useState, useRef } from 'react';
import Modal from './Modal';
import { demandsApi } from '@/services/api';
import { Demand, DemandComment } from '@/types';
import { MessageSquare, Send, Clock, Calendar, User, Tag, Layers } from 'lucide-react';
import toast from 'react-hot-toast';

const priorityLabel: Record<string, string> = {
  low: 'Baixa', medium: 'Média', high: 'Alta', urgent: 'Urgente',
};
const priorityEmoji: Record<string, string> = {
  low: '🟢', medium: '🟡', high: '🟠', urgent: '🚨',
};
const slaLabel: Record<string, string> = {
  on_time: 'No prazo', warning: 'Atenção', overdue: 'Atrasado',
};
const slaColor: Record<string, string> = {
  on_time: 'text-green-600 bg-green-50', warning: 'text-yellow-600 bg-yellow-50', overdue: 'text-red-600 bg-red-50',
};

interface Props {
  demand: Demand | null;
  onClose: () => void;
}

function formatTimeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'agora';
  if (mins < 60) return `${mins}min atrás`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h atrás`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d atrás`;
  return new Date(dateStr).toLocaleDateString('pt-BR');
}

export default function DemandPreviewModal({ demand, onClose }: Props) {
  const [comments, setComments] = useState<DemandComment[]>([]);
  const [loadingComments, setLoadingComments] = useState(false);
  const [newComment, setNewComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!demand) return;
    setComments([]);
    setNewComment('');
    setLoadingComments(true);
    demandsApi.getComments(demand.id)
      .then(r => setComments(r.data))
      .catch(() => {})
      .finally(() => setLoadingComments(false));
  }, [demand?.id]);

  const handleSubmitComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!demand || !newComment.trim()) return;
    setSubmitting(true);
    try {
      const { data } = await demandsApi.addComment(demand.id, { text: newComment.trim() });
      setComments(prev => [...prev, data]);
      setNewComment('');
    } catch {
      toast.error('Erro ao enviar comentário');
    } finally {
      setSubmitting(false);
    }
  };

  if (!demand) return null;

  return (
    <Modal isOpen={!!demand} onClose={onClose} title="" size="lg">
      <div className="flex flex-col gap-4">

        {/* Header */}
        <div>
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className="text-xl">{priorityEmoji[demand.priority]}</span>
            <h2 className="text-lg font-bold flex-1">{demand.title}</h2>
            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${slaColor[demand.sla_status]}`}>
              {slaLabel[demand.sla_status]}
            </span>
          </div>
          {demand.column_name && (
            <span className="inline-flex items-center gap-1 text-xs bg-gray-100 dark:bg-dark-700 px-2 py-0.5 rounded mt-1">
              <Layers className="h-3 w-3" /> {demand.column_name}
            </span>
          )}
        </div>

        {/* Description */}
        {demand.description && (
          <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap bg-gray-50 dark:bg-dark-700 rounded-lg p-3">
            {demand.description}
          </p>
        )}

        {/* Meta grid */}
        <div className="grid grid-cols-2 gap-3 text-sm">
          {demand.client_name && (
            <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
              <Tag className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">{demand.client_name}</span>
            </div>
          )}
          {demand.assigned_to_name && (
            <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
              <User className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">{demand.assigned_to_name}</span>
            </div>
          )}
          {demand.demand_type && (
            <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
              <Tag className="h-3.5 w-3.5 shrink-0" />
              <span>{demand.demand_type}</span>
            </div>
          )}
          <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
            <span className="text-xs font-medium">Prioridade:</span>
            <span>{priorityLabel[demand.priority]}</span>
          </div>
          {demand.due_date && (
            <div className={`flex items-center gap-2 ${new Date(demand.due_date) < new Date() ? 'text-red-600 font-medium' : 'text-gray-600 dark:text-gray-400'}`}>
              <Calendar className="h-3.5 w-3.5 shrink-0" />
              <span>Prazo: {new Date(demand.due_date).toLocaleDateString('pt-BR')}</span>
            </div>
          )}
          {demand.sla_hours && (
            <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
              <Clock className="h-3.5 w-3.5 shrink-0" />
              <span>SLA: {demand.sla_hours}h</span>
            </div>
          )}
          <div className="flex items-center gap-2 text-gray-500 text-xs col-span-2">
            <span>Criado: {new Date(demand.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
          </div>
        </div>

        {/* Comments */}
        <div className="border-t dark:border-dark-700 pt-4">
          <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
            <MessageSquare className="h-4 w-4" />
            Comentários {comments.length > 0 && <span className="text-gray-400">({comments.length})</span>}
          </h3>

          {loadingComments ? (
            <div className="flex justify-center py-4">
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary-600" />
            </div>
          ) : (
            <div className="space-y-3 mb-4 max-h-52 overflow-y-auto">
              {comments.length === 0 && (
                <p className="text-xs text-gray-400 text-center py-2">Nenhum comentário ainda</p>
              )}
              {comments.map(c => (
                <div key={c.id} className="bg-gray-50 dark:bg-dark-700 rounded-lg p-3">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-semibold text-primary-700 dark:text-primary-400">
                      {c.user_name || 'Usuário'}
                    </span>
                    <span className="text-xs text-gray-400">{formatTimeAgo(c.created_at)}</span>
                  </div>
                  <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">{c.text}</p>
                </div>
              ))}
            </div>
          )}

          {/* Add comment */}
          <form onSubmit={handleSubmitComment} className="flex gap-2">
            <textarea
              ref={textareaRef}
              className="input-field flex-1 text-sm resize-none"
              rows={2}
              placeholder="Escreva um comentário..."
              value={newComment}
              onChange={e => setNewComment(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) handleSubmitComment(e as any);
              }}
            />
            <button
              type="submit"
              disabled={!newComment.trim() || submitting}
              className="btn-primary px-3 py-2 self-end disabled:opacity-50"
              title="Enviar (Ctrl+Enter)"
            >
              <Send className="h-4 w-4" />
            </button>
          </form>
          <p className="text-xs text-gray-400 mt-1">Ctrl+Enter para enviar</p>
        </div>
      </div>
    </Modal>
  );
}
