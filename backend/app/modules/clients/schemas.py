from datetime import datetime
from pydantic import BaseModel, EmailStr
from app.modules.clients.models import ClientStatus


class ClientCreate(BaseModel):
    name: str
    company: str | None = None
    email: EmailStr | None = None
    phone: str | None = None
    segment: str | None = None
    status: ClientStatus = ClientStatus.ACTIVE
    notes: str | None = None


class ClientUpdate(BaseModel):
    name: str | None = None
    company: str | None = None
    email: EmailStr | None = None
    phone: str | None = None
    segment: str | None = None
    status: ClientStatus | None = None
    notes: str | None = None


class ClientResponse(BaseModel):
    id: int
    name: str
    company: str | None
    email: str | None
    phone: str | None
    segment: str | None
    status: ClientStatus
    notes: str | None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class ClientDetail(ClientResponse):
    allocations: list = []
    demands_count: int = 0
    active_demands_count: int = 0
