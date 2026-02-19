from datetime import date
from pydantic import BaseModel


class AllocationCost(BaseModel):
    allocation_id: int
    member_id: int
    member_name: str
    client_id: int
    client_name: str
    monthly_value: float
    start_date: date
    end_date: date | None
    days_in_month: int
    active_days: int
    proportional_value: float


class ClientCostSummary(BaseModel):
    client_id: int
    client_name: str
    total_monthly: float
    total_proportional: float
    allocations: list[AllocationCost]


class MemberCostSummary(BaseModel):
    member_id: int
    member_name: str
    role_title: str | None
    total_monthly: float
    total_proportional: float
    allocations: list[AllocationCost]


class SquadCostSummary(BaseModel):
    squad_id: int | None
    squad_name: str
    total_monthly: float
    total_proportional: float


class RoleCostSummary(BaseModel):
    role_title: str
    total_monthly: float
    total_proportional: float


class ExtraExpenseCreate(BaseModel):
    month: int
    year: int
    description: str
    amount: float
    payment_date: date | None = None
    notes: str | None = None
    category: str | None = None


class ExtraExpenseUpdate(BaseModel):
    description: str | None = None
    amount: float | None = None
    payment_date: date | None = None
    notes: str | None = None
    category: str | None = None


class ExtraExpenseResponse(BaseModel):
    id: int
    month: int
    year: int
    description: str
    amount: float
    payment_date: date | None
    notes: str | None
    category: str | None

    model_config = {"from_attributes": True}


class MonthlyFinancialsUpdate(BaseModel):
    total_received: float | None = None
    tax_amount: float | None = None
    marketing_amount: float | None = None


class MonthlyFinancialsResponse(BaseModel):
    id: int
    month: int
    year: int
    total_received: float | None
    tax_amount: float | None
    marketing_amount: float | None

    model_config = {"from_attributes": True}


class FinancialDashboard(BaseModel):
    month: int
    year: int
    total_receivable: float
    total_received: float | None
    total_operational_cost: float
    tax_amount: float | None
    marketing_amount: float | None
    total_extras: float
    net_profit: float | None
    extra_expenses: list[ExtraExpenseResponse]
    by_client: list[ClientCostSummary]
    by_member: list[MemberCostSummary]
    by_squad: list[SquadCostSummary]
    by_role: list[RoleCostSummary]
