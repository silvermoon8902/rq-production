export interface User {
  id: number;
  email: string;
  name: string;
  role: 'admin' | 'gerente' | 'colaborador';
  is_active: boolean;
  created_at: string;
}

export interface Client {
  id: number;
  name: string;              // Nome Fantasia
  company: string | null;    // Razao Social
  cnpj: string | null;
  responsible_name: string | null;
  phone: string | null;      // Celular Responsavel
  email: string | null;
  segment: string | null;    // Nicho
  status: 'active' | 'inactive' | 'onboarding' | 'churned';
  instagram: string | null;
  website: string | null;
  notes: string | null;
  start_date: string | null;
  end_date: string | null;
  monthly_value: number | null;
  min_contract_months: number | null;
  operational_cost: number | null;
  health_score: number | null;
  created_at: string;
  updated_at: string;
}

export interface AllocationInClient {
  id: number;
  member_id: number;
  member_name: string;
  role_title: string;
  monthly_value: number;
  start_date: string;
  end_date: string | null;
}

export interface ClientDetail extends Client {
  allocations: AllocationInClient[];
  demands_count: number;
  active_demands_count: number;
  active_days: number | null;
}

export interface Squad {
  id: number;
  name: string;
  description: string | null;
  created_at: string;
  members_count: number;
}

export interface TeamMember {
  id: number;
  name: string;
  role_title: string;
  squad_id: number | null;
  squad_ids: number[];
  user_id: number | null;
  email: string | null;
  phone: string | null;
  status: 'active' | 'inactive' | 'vacation';
  created_at: string;
}

export interface Allocation {
  id: number;
  member_id: number;
  client_id: number;
  monthly_value: number;
  start_date: string;
  end_date: string | null;
  created_at: string;
  member_name: string;
  client_name: string;
}

export interface KanbanColumn {
  id: number;
  name: string;
  order: number;
  color: string;
  is_default: boolean;
  demands_count: number;
}

export interface Demand {
  id: number;
  title: string;
  description: string | null;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  status: string;
  demand_type: string | null;
  column_id: number | null;
  position: number;
  client_id: number | null;
  assigned_to_id: number | null;
  created_by_id: number | null;
  sla_hours: number | null;
  due_date: string | null;
  completed_at: string | null;
  sla_status: 'on_time' | 'warning' | 'overdue';
  created_at: string;
  updated_at: string;
  client_name: string | null;
  assigned_to_name: string | null;
  in_progress_hours: number | null;
}

export interface ClientMeeting {
  id: number;
  meeting_type: 'daily' | 'one_a_one';
  client_id: number;
  squad_id: number | null;
  member_id: number | null;
  health_score: number | null;
  notes: string | null;
  created_by_id: number | null;
  created_at: string;
  client_name: string | null;
  member_name: string | null;
}

export interface ExtraExpense {
  id: number;
  month: number;
  year: number;
  description: string;
  amount: number;
  payment_date: string | null;
  notes: string | null;
  category: string | null;
}

export interface FinancialDashboard {
  month: number;
  year: number;
  is_personal: boolean;
  total_receivable: number;
  total_received: number | null;
  total_operational_cost: number;
  tax_amount: number | null;
  marketing_amount: number | null;
  total_extras: number;
  net_profit: number | null;
  extra_expenses: ExtraExpense[];
  by_client: ClientCostSummary[];
  by_member: MemberCostSummary[];
  by_squad: SquadCostSummary[];
  by_role: RoleCostSummary[];
}

export interface ClientCostSummary {
  client_id: number;
  client_name: string;
  total_monthly: number;
  total_proportional: number;
  allocations: AllocationCost[];
}

export interface MemberCostSummary {
  member_id: number;
  member_name: string;
  role_title: string | null;
  total_monthly: number;
  total_proportional: number;
  allocations: AllocationCost[];
}

export interface SquadCostSummary {
  squad_id: number | null;
  squad_name: string;
  total_monthly: number;
  total_proportional: number;
}

export interface RoleCostSummary {
  role_title: string;
  total_monthly: number;
  total_proportional: number;
}

export interface AllocationCost {
  allocation_id: number;
  member_id: number;
  member_name: string;
  client_id: number;
  client_name: string;
  monthly_value: number;
  start_date: string;
  end_date: string | null;
  days_in_month: number;
  active_days: number;
  proportional_value: number;
}
