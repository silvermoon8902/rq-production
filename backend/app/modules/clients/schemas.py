from datetime import datetime, date
from pydantic import BaseModel
from app.modules.clients.models import ClientStatus


class ClientCreate(BaseModel):
    name: str                           # Nome Fantasia (required)
    company: str | None = None          # Razao Social
    cnpj: str | None = None
    responsible_name: str | None = None
    phone: str | None = None            # Celular Responsavel
    email: str | None = None
    segment: str | None = None          # Nicho
    status: ClientStatus = ClientStatus.ACTIVE
    instagram: str | None = None
    website: str | None = None
    notes: str | None = None
    start_date: date | None = None
    end_date: date | None = None
    monthly_value: float | None = None
    min_contract_months: int | None = None
    operational_cost: float | None = None
    health_score: float | None = None


class ClientUpdate(BaseModel):
    name: str | None = None
    company: str | None = None
    cnpj: str | None = None
    responsible_name: str | None = None
    phone: str | None = None
    email: str | None = None
    segment: str | None = None
    status: ClientStatus | None = None
    instagram: str | None = None
    website: str | None = None
    notes: str | None = None
    start_date: date | None = None
    end_date: date | None = None
    monthly_value: float | None = None
    min_contract_months: int | None = None
    operational_cost: float | None = None
    health_score: float | None = None


class ClientResponse(BaseModel):
    id: int
    name: str
    company: str | None
    cnpj: str | None
    responsible_name: str | None
    phone: str | None
    email: str | None
    segment: str | None
    status: ClientStatus
    instagram: str | None
    website: str | None
    notes: str | None
    start_date: date | None
    end_date: date | None
    monthly_value: float | None
    min_contract_months: int | None
    operational_cost: float | None
    health_score: float | None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class AllocationInClient(BaseModel):
    id: int
    member_id: int
    member_name: str
    role_title: str
    monthly_value: float
    start_date: date
    end_date: date | None

    model_config = {"from_attributes": True}


class ClientDetail(ClientResponse):
    allocations: list[AllocationInClient] = []
    demands_count: int = 0
    active_demands_count: int = 0
    active_days: int | None = None
