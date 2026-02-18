'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import AuthGuard from '@/components/layout/AuthGuard';
import StatusBadge from '@/components/ui/StatusBadge';
import { clientsApi, teamApi, financialApi } from '@/services/api';
import { useAuthStore } from '@/stores/authStore';
import { ClientDetail, Allocation } from '@/types';
import { ArrowLeft, Building2, Users, Kanban, DollarSign } from 'lucide-react';
import toast from 'react-hot-toast';

export default function ClientDetailPage() {
  const params = useParams();
  const router = useRouter();
  const clientId = Number(params.id);
  const [client, setClient] = useState<ClientDetail | null>(null);
  const [allocations, setAllocations] = useState<Allocation[]>([]);
  const [costs, setCosts] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const { user } = useAuthStore();

  useEffect(() => {
    loadClient();
  }, [clientId]);

  const loadClient = async () => {
    try {
      const [clientRes, allocRes] = await Promise.all([
        clientsApi.getById(clientId),
        teamApi.getAllocations({ client_id: clientId }),
      ]);
      setClient(clientRes.data);
      setAllocations(allocRes.data);

      if (user?.role === 'admin' || user?.role === 'gerente') {
        try {
          const costRes = await financialApi.getClientCosts(clientId);
          setCosts(costRes.data);
        } catch {}
      }
    } catch {
      toast.error('Erro ao carregar cliente');
      router.push('/clients');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <AuthGuard>
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
        </div>
      </AuthGuard>
    );
  }

  if (!client) return null;

  return (
    <AuthGuard>
      <div>
        <button onClick={() => router.push('/clients')} className="flex items-center gap-2 text-gray-500 hover:text-gray-700 mb-6">
          <ArrowLeft className="h-4 w-4" /> Voltar para Clientes
        </button>

        <div className="flex items-start justify-between mb-8">
          <div className="flex items-center gap-4">
            <div className="bg-primary-100 p-3 rounded-xl">
              <Building2 className="h-8 w-8 text-primary-600" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">{client.name}</h1>
              {client.company && <p className="text-gray-500">{client.company}</p>}
            </div>
          </div>
          <StatusBadge status={client.status} />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <div className="card flex items-center gap-3">
            <div className="bg-blue-100 p-2 rounded-lg"><Kanban className="h-5 w-5 text-blue-600" /></div>
            <div>
              <p className="text-sm text-gray-500">Demandas Ativas</p>
              <p className="text-xl font-bold">{client.active_demands_count}</p>
            </div>
          </div>
          <div className="card flex items-center gap-3">
            <div className="bg-purple-100 p-2 rounded-lg"><Users className="h-5 w-5 text-purple-600" /></div>
            <div>
              <p className="text-sm text-gray-500">Equipe Alocada</p>
              <p className="text-xl font-bold">{allocations.length}</p>
            </div>
          </div>
          {costs && (
            <div className="card flex items-center gap-3">
              <div className="bg-emerald-100 p-2 rounded-lg"><DollarSign className="h-5 w-5 text-emerald-600" /></div>
              <div>
                <p className="text-sm text-gray-500">Custo Proporcional</p>
                <p className="text-xl font-bold">R$ {costs.total_proportional?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
              </div>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="card">
            <h2 className="text-lg font-semibold mb-4">Informações</h2>
            <dl className="space-y-3">
              {client.email && <div><dt className="text-sm text-gray-500">Email</dt><dd>{client.email}</dd></div>}
              {client.phone && <div><dt className="text-sm text-gray-500">Telefone</dt><dd>{client.phone}</dd></div>}
              {client.segment && <div><dt className="text-sm text-gray-500">Segmento</dt><dd>{client.segment}</dd></div>}
              {client.notes && <div><dt className="text-sm text-gray-500">Observações</dt><dd className="whitespace-pre-wrap">{client.notes}</dd></div>}
            </dl>
          </div>

          <div className="card">
            <h2 className="text-lg font-semibold mb-4">Equipe Alocada</h2>
            {allocations.length === 0 ? (
              <p className="text-gray-400 text-sm">Nenhum membro alocado</p>
            ) : (
              <div className="space-y-3">
                {allocations.map((a) => (
                  <div key={a.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div>
                      <p className="font-medium">{a.member_name}</p>
                      <p className="text-xs text-gray-500">Desde {new Date(a.start_date).toLocaleDateString('pt-BR')}</p>
                    </div>
                    <p className="text-sm font-medium">R$ {a.monthly_value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}/mês</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </AuthGuard>
  );
}
