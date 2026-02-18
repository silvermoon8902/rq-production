import { clsx } from 'clsx';

const statusColors: Record<string, string> = {
  active: 'bg-green-100 text-green-800',
  inactive: 'bg-gray-100 text-gray-800',
  onboarding: 'bg-blue-100 text-blue-800',
  churned: 'bg-red-100 text-red-800',
  vacation: 'bg-yellow-100 text-yellow-800',
  on_time: 'bg-green-100 text-green-800',
  warning: 'bg-yellow-100 text-yellow-800',
  overdue: 'bg-red-100 text-red-800',
  low: 'bg-gray-100 text-gray-800',
  medium: 'bg-blue-100 text-blue-800',
  high: 'bg-orange-100 text-orange-800',
  urgent: 'bg-red-100 text-red-800',
};

const statusLabels: Record<string, string> = {
  active: 'Ativo',
  inactive: 'Inativo',
  onboarding: 'Onboarding',
  churned: 'Churned',
  vacation: 'Férias',
  on_time: 'No prazo',
  warning: 'Atenção',
  overdue: 'Atrasado',
  low: 'Baixa',
  medium: 'Média',
  high: 'Alta',
  urgent: 'Urgente',
};

interface StatusBadgeProps {
  status: string;
  className?: string;
}

export default function StatusBadge({ status, className }: StatusBadgeProps) {
  return (
    <span className={clsx('badge', statusColors[status] || 'bg-gray-100 text-gray-800', className)}>
      {statusLabels[status] || status}
    </span>
  );
}
