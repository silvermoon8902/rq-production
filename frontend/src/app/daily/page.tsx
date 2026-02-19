'use client';

import { useEffect, useState, useMemo } from 'react';
import AuthGuard from '@/components/layout/AuthGuard';
import { clientsApi, teamApi, demandsApi, meetingsApi } from '@/services/api';
import { useAuthStore } from '@/stores/authStore';
import { Client, TeamMember, Allocation, Squad, ClientMeeting } from '@/types';
import { Users, Plus, CheckCircle, Clock, ChevronDown, ChevronUp, History } from 'lucide-react';
import toast from 'react-hot-toast';
import Link from 'next/link';

const healthColor = (score: number | null) => {
  if (score === null) return 'text-gray-400';
  if (score >= 8) return 'text-green-600';
  if (score >= 5) return 'text-yellow-600';
  return 'text-red-600';
};

const healthBg = (score: number | null) => {
  if (score === null) return 'bg-gray-100';
  if (score >= 8) return 'bg-green-50 border-green-200';
  if (score >= 5) return 'bg-yellow-50 border-yellow-200';
  return 'bg-red-50 border-red-200';
};

export default function DailyPage() {
  const { user } = useAuthStore();
  const [clients, setClients] = useState<Client[]>([]);
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [allocations, setAllocations] = useState<Allocation[]>([]);
  const [squads, setSquads] = useState<Squad[]>([]);
  const [loading, setLoading] = useState(true);
  const [meetingType, setMeetingType] = useState<'daily' | 'one_a_one'>('daily');
  const [filterSquad, setFilterSquad] = useState('');
  const [filterMember, setFilterMember] = useState('');

  // Per-client state
  const [healthScores, setHealthScores] = useState<Record<number, string>>({});
  const [savingHealth, setSavingHealth] = useState<Record<number, boolean>>({});
  const [expandedNotes, setExpandedNotes] = useState<Record<number, boolean>>({});
  const [notes, setNotes] = useState<Record<number, string>>({});
  const [registering, setRegistering] = useState<Record<number, boolean>>({});
  const [quickDemand, setQuickDemand] = useState<Record<number, boolean>>({});
  const [demandForm, setDemandForm] = useState<Record<number, { title: string; priority: string; demand_type: string }>>({});
  const [expandedHistory, setExpandedHistory] = useState<Record<number, boolean>>({});
  const [clientHistory, setClientHistory] = useState<Record<number, ClientMeeting[]>>({});

  useEffect(() => { loadAll(); }, []);

  const loadAll = async () => {
    try {
      const [clientsRes, membersRes, allocsRes, squadsRes] = await Promise.all([
        clientsApi.getAll(),
        teamApi.getMembers(),
        teamApi.getAllocations(),
        teamApi.getSquads(),
      ]);
      setClients(clientsRes.data);
      setMembers(membersRes.data);
      setAllocations(allocsRes.data);
      setSquads(squadsRes.data);
      // Pre-fill health scores from existing data
      const scores: Record<number, string> = {};
      for (const c of clientsRes.data) {
        if ((c as any).health_score != null) scores[c.id] = String((c as any).health_score);
      }
      setHealthScores(scores);
    } catch { toast.error('Erro ao carregar dados'); }
    finally { setLoading(false); }
  };

  // Filtered clients: those with active allocations matching filters
  const filteredClients = useMemo(() => {
    const now = new Date();
    return clients.filter(c => {
      const clientAllocs = allocations.filter(a => {
        if (a.client_id !== c.id) return false;
        if (a.end_date && new Date(a.end_date) < now) return false;
        return true;
      });
      if (clientAllocs.length === 0) return false;

      if (filterSquad) {
        const hasSquad = clientAllocs.some(a => {
          const m = members.find(m => m.id === a.member_id);
          return m?.squad_id === Number(filterSquad);
        });
        if (!hasSquad) return false;
      }
      if (filterMember) {
        const hasMember = clientAllocs.some(a => a.member_id === Number(filterMember));
        if (!hasMember) return false;
      }
      return true;
    });
  }, [clients, allocations, members, filterSquad, filterMember]);

  const getClientTeam = (clientId: number) => {
    const now = new Date();
    return allocations
      .filter(a => a.client_id === clientId && (!a.end_date || new Date(a.end_date) >= now))
      .map(a => members.find(m => m.id === a.member_id))
      .filter(Boolean) as TeamMember[];
  };

  const getClientSquads = (clientId: number) => {
    const team = getClientTeam(clientId);
    const squadIds = new Set(team.map(m => m.squad_id).filter(Boolean));
    return squads.filter(s => squadIds.has(s.id));
  };

  const handleSaveHealth = async (clientId: number) => {
    const val = healthScores[clientId];
    if (val === undefined || val === '') return;
    const num = Number(val);
    if (isNaN(num) || num < 0 || num > 10) { toast.error('Valor entre 0 e 10'); return; }
    setSavingHealth(s => ({ ...s, [clientId]: true }));
    try {
      await clientsApi.update(clientId, { health_score: num });
      toast.success('Health score atualizado');
    } catch { toast.error('Erro ao salvar'); }
    finally { setSavingHealth(s => ({ ...s, [clientId]: false })); }
  };

  const handleRegister = async (clientId: number) => {
    setRegistering(s => ({ ...s, [clientId]: true }));
    const team = getClientTeam(clientId);
    const hs = healthScores[clientId] ? Number(healthScores[clientId]) : null;
    try {
      await meetingsApi.create({
        meeting_type: meetingType,
        client_id: clientId,
        squad_id: filterSquad ? Number(filterSquad) : (team[0]?.squad_id || null),
        member_id: filterMember ? Number(filterMember) : (team[0]?.id || null),
        health_score: hs,
        notes: notes[clientId] || null,
      });
      toast.success('Reunião registrada');
      setNotes(n => ({ ...n, [clientId]: '' }));
    } catch { toast.error('Erro ao registrar reunião'); }
    finally { setRegistering(s => ({ ...s, [clientId]: false })); }
  };

  const handleQuickDemand = async (clientId: number) => {
    const form = demandForm[clientId];
    if (!form?.title?.trim()) { toast.error('Título obrigatório'); return; }
    const team = getClientTeam(clientId);
    try {
      await demandsApi.create({
        title: form.title.trim(),
        priority: form.priority || 'medium',
        demand_type: form.demand_type || null,
        client_id: clientId,
        assigned_to_id: filterMember ? Number(filterMember) : (team[0]?.id || null),
      });
      toast.success('Demanda criada');
      setDemandForm(f => ({ ...f, [clientId]: { title: '', priority: 'medium', demand_type: '' } }));
      setQuickDemand(q => ({ ...q, [clientId]: false }));
    } catch { toast.error('Erro ao criar demanda'); }
  };

  const loadHistory = async (clientId: number) => {
    if (clientHistory[clientId]) {
      setExpandedHistory(h => ({ ...h, [clientId]: !h[clientId] }));
      return;
    }
    try {
      const res = await meetingsApi.getAll({ client_id: clientId });
      setClientHistory(h => ({ ...h, [clientId]: res.data }));
      setExpandedHistory(h => ({ ...h, [clientId]: true }));
    } catch { toast.error('Erro ao carregar histórico'); }
  };

  const formatMeetingType = (t: string) => t === 'daily' ? 'Daily' : '1:1';

  return (
    <AuthGuard>
      <div>
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-3">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold">Daily / One a One</h1>
            <p className="text-gray-500 mt-1">{filteredClients.length} clientes · {meetingType === 'daily' ? 'Reunião Daily' : 'One a One'}</p>
          </div>
          {/* Meeting type toggle */}
          <div className="flex bg-gray-100 dark:bg-dark-800 rounded-lg p-1 gap-1">
            <button
              onClick={() => setMeetingType('daily')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${meetingType === 'daily' ? 'bg-primary-300 text-dark-900' : 'text-gray-600 dark:text-gray-400 hover:text-gray-900'}`}
            >
              Daily
            </button>
            <button
              onClick={() => setMeetingType('one_a_one')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${meetingType === 'one_a_one' ? 'bg-primary-300 text-dark-900' : 'text-gray-600 dark:text-gray-400 hover:text-gray-900'}`}
            >
              One a One
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="card mb-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Squad</label>
              <select className="input-field" value={filterSquad} onChange={e => setFilterSquad(e.target.value)}>
                <option value="">Todos os squads</option>
                {squads.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Colaborador</label>
              <select className="input-field" value={filterMember} onChange={e => setFilterMember(e.target.value)}>
                <option value="">Todos os colaboradores</option>
                {members.map(m => <option key={m.id} value={m.id}>{m.name} — {m.role_title}</option>)}
              </select>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
          </div>
        ) : filteredClients.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            Nenhum cliente com alocação ativa encontrado
          </div>
        ) : (
          <div className="space-y-4">
            {filteredClients.map(client => {
              const team = getClientTeam(client.id);
              const clientSquads = getClientSquads(client.id);
              const hs = (client as any).health_score as number | null;
              const currentHs = healthScores[client.id] !== undefined
                ? (healthScores[client.id] !== '' ? Number(healthScores[client.id]) : null)
                : hs;

              return (
                <div key={client.id} className="card">
                  {/* Client header */}
                  <div className="flex flex-col sm:flex-row sm:items-start gap-4">
                    {/* Left: name + meta */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <Link href={`/clients/${client.id}`} className="font-semibold text-base hover:text-primary-600 transition-colors">
                          {client.name}
                        </Link>
                        {client.segment && (
                          <span className="text-xs bg-gray-100 dark:bg-dark-700 px-2 py-0.5 rounded">{client.segment}</span>
                        )}
                      </div>

                      {/* Squads */}
                      {clientSquads.length > 0 && (
                        <div className="flex items-center gap-1 text-xs text-gray-500 mb-2">
                          <Users className="h-3 w-3" />
                          {clientSquads.map(s => s.name).join(' · ')}
                        </div>
                      )}

                      {/* Team */}
                      <div className="flex flex-wrap gap-1">
                        {team.map(m => (
                          <span key={m.id} className="text-xs bg-primary-100 text-primary-800 px-2 py-0.5 rounded-full">
                            {m.name}
                          </span>
                        ))}
                      </div>
                    </div>

                    {/* Right: Health Score */}
                    <div className={`flex items-center gap-2 p-3 rounded-lg border ${healthBg(currentHs)} min-w-[160px]`}>
                      <div className="flex-1">
                        <p className="text-xs text-gray-500 mb-1">Health Score</p>
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            min="0"
                            max="10"
                            step="0.5"
                            value={healthScores[client.id] ?? (hs ?? '')}
                            onChange={e => setHealthScores(s => ({ ...s, [client.id]: e.target.value }))}
                            className={`w-16 text-xl font-bold border-b-2 bg-transparent outline-none ${healthColor(currentHs)} border-current`}
                            placeholder="—"
                          />
                          <span className="text-xs text-gray-400">/ 10</span>
                        </div>
                      </div>
                      <button
                        onClick={() => handleSaveHealth(client.id)}
                        disabled={savingHealth[client.id]}
                        className="text-primary-600 hover:text-primary-700 disabled:opacity-50"
                        title="Salvar health score"
                      >
                        <CheckCircle className="h-5 w-5" />
                      </button>
                    </div>
                  </div>

                  {/* Notes + actions */}
                  <div className="mt-4 space-y-3">
                    <div>
                      <button
                        onClick={() => setExpandedNotes(n => ({ ...n, [client.id]: !n[client.id] }))}
                        className="text-xs text-gray-500 hover:text-gray-700 flex items-center gap-1"
                      >
                        {expandedNotes[client.id] ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                        Anotações da reunião
                      </button>
                      {expandedNotes[client.id] && (
                        <textarea
                          className="input-field mt-2 text-sm"
                          rows={3}
                          placeholder="Pontos discutidos, ações, observações..."
                          value={notes[client.id] || ''}
                          onChange={e => setNotes(n => ({ ...n, [client.id]: e.target.value }))}
                        />
                      )}
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {/* Register meeting */}
                      <button
                        onClick={() => handleRegister(client.id)}
                        disabled={registering[client.id]}
                        className="btn-primary text-sm flex items-center gap-2"
                      >
                        <Clock className="h-4 w-4" />
                        {registering[client.id] ? 'Registrando...' : `Registrar ${formatMeetingType(meetingType)}`}
                      </button>

                      {/* Quick demand */}
                      <button
                        onClick={() => {
                          setQuickDemand(q => ({ ...q, [client.id]: !q[client.id] }));
                          if (!demandForm[client.id]) setDemandForm(f => ({ ...f, [client.id]: { title: '', priority: 'medium', demand_type: '' } }));
                        }}
                        className="btn-secondary text-sm flex items-center gap-2"
                      >
                        <Plus className="h-4 w-4" /> Demanda rápida
                      </button>

                      {/* History */}
                      <button
                        onClick={() => loadHistory(client.id)}
                        className="btn-secondary text-sm flex items-center gap-2"
                      >
                        <History className="h-4 w-4" /> Histórico
                      </button>
                    </div>

                    {/* Quick demand form */}
                    {quickDemand[client.id] && (
                      <div className="border border-gray-200 dark:border-dark-600 rounded-lg p-3 bg-gray-50 dark:bg-dark-700 space-y-2">
                        <p className="text-xs font-semibold text-gray-600 dark:text-gray-300">Nova demanda</p>
                        <input
                          className="input-field text-sm"
                          placeholder="Título da demanda *"
                          value={demandForm[client.id]?.title || ''}
                          onChange={e => setDemandForm(f => ({ ...f, [client.id]: { ...f[client.id], title: e.target.value } }))}
                        />
                        <div className="grid grid-cols-2 gap-2">
                          <select
                            className="input-field text-sm"
                            value={demandForm[client.id]?.priority || 'medium'}
                            onChange={e => setDemandForm(f => ({ ...f, [client.id]: { ...f[client.id], priority: e.target.value } }))}
                          >
                            <option value="low">🟢 Baixa</option>
                            <option value="medium">🟡 Média</option>
                            <option value="high">🟠 Alta</option>
                            <option value="urgent">🚨 Urgente</option>
                          </select>
                          <input
                            className="input-field text-sm"
                            placeholder="Tipo (ex: Design, Tráfego)"
                            value={demandForm[client.id]?.demand_type || ''}
                            onChange={e => setDemandForm(f => ({ ...f, [client.id]: { ...f[client.id], demand_type: e.target.value } }))}
                          />
                        </div>
                        <div className="flex gap-2">
                          <button onClick={() => handleQuickDemand(client.id)} className="btn-primary text-sm">Criar demanda</button>
                          <button onClick={() => setQuickDemand(q => ({ ...q, [client.id]: false }))} className="btn-secondary text-sm">Cancelar</button>
                        </div>
                      </div>
                    )}

                    {/* History panel */}
                    {expandedHistory[client.id] && clientHistory[client.id] && (
                      <div className="border border-gray-200 dark:border-dark-600 rounded-lg overflow-hidden">
                        <div className="px-3 py-2 bg-gray-50 dark:bg-dark-700 text-xs font-semibold text-gray-600 dark:text-gray-300">
                          Histórico de reuniões
                        </div>
                        {clientHistory[client.id].length === 0 ? (
                          <p className="text-xs text-gray-400 px-3 py-2">Nenhuma reunião registrada</p>
                        ) : (
                          <div className="divide-y divide-gray-100 dark:divide-dark-600 max-h-48 overflow-y-auto">
                            {clientHistory[client.id].map(m => (
                              <div key={m.id} className="px-3 py-2 text-xs">
                                <div className="flex items-center justify-between mb-0.5">
                                  <span className="font-medium">{formatMeetingType(m.meeting_type)}</span>
                                  <span className="text-gray-400">{new Date(m.created_at).toLocaleDateString('pt-BR')}</span>
                                </div>
                                <div className="flex gap-3 text-gray-500">
                                  {m.member_name && <span>{m.member_name}</span>}
                                  {m.health_score != null && (
                                    <span className={`font-semibold ${healthColor(m.health_score)}`}>HS: {m.health_score}</span>
                                  )}
                                </div>
                                {m.notes && <p className="text-gray-500 mt-0.5 line-clamp-2">{m.notes}</p>}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </AuthGuard>
  );
}
