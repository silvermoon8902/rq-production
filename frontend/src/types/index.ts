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
}

export interface FinancialDashboard {
  month: number;
  year: number;
  total_cost: number;
  by_client: ClientCostSummary[];
  by_member: MemberCostSummary[];
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
  total_monthly: number;
  total_proportional: number;
  allocations: AllocationCost[];
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
