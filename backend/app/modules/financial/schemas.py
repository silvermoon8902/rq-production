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
    total_monthly: float
    total_proportional: float
    allocations: list[AllocationCost]


class FinancialDashboard(BaseModel):
    month: int
    year: int
    total_cost: float
    by_client: list[ClientCostSummary]
    by_member: list[MemberCostSummary]
