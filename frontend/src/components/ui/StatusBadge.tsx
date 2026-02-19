import { clsx } from 'clsx';

const statusColors: Record<string, string> = {
  active: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  inactive: 'bg-gray-100 text-gray-800 dark:bg-dark-700 dark:text-gray-400',
  onboarding: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
  churned: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
  vacation: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
  on_time: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  warning: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
  overdue: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
  low: 'bg-gray-100 text-gray-800 dark:bg-dark-700 dark:text-gray-400',
  medium: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
  high: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400',
  urgent: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
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
    <span className={clsx('badge', statusColors[status] || 'bg-gray-100 text-gray-800 dark:bg-dark-700 dark:text-gray-400', className)}>
      {statusLabels[status] || status}
    </span>
  );
}

