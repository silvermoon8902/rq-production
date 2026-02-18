from datetime import datetime, date
from pydantic import BaseModel
from app.modules.team.models import MemberStatus


# Squad
class SquadCreate(BaseModel):
    name: str
    description: str | None = None


class SquadUpdate(BaseModel):
    name: str | None = None
    description: str | None = None


class SquadResponse(BaseModel):
    id: int
    name: str
    description: str | None
    created_at: datetime
    members_count: int = 0

    model_config = {"from_attributes": True}


# Team Member
class TeamMemberCreate(BaseModel):
    name: str
    role_title: str
    squad_id: int | None = None
    user_id: int | None = None
    email: str | None = None
    phone: str | None = None
    status: MemberStatus = MemberStatus.ACTIVE


class TeamMemberUpdate(BaseModel):
    name: str | None = None
    role_title: str | None = None
    squad_id: int | None = None
    email: str | None = None
    phone: str | None = None
    status: MemberStatus | None = None


class TeamMemberResponse(BaseModel):
    id: int
    name: str
    role_title: str
    squad_id: int | None
    user_id: int | None
    email: str | None
    phone: str | None
    status: MemberStatus
    created_at: datetime

    model_config = {"from_attributes": True}


class TeamMemberDetail(TeamMemberResponse):
    squad_name: str | None = None
    allocations: list = []


# Allocation
class AllocationCreate(BaseModel):
    member_id: int
    client_id: int
    monthly_value: float = 0
    start_date: date
    end_date: date | None = None


class AllocationUpdate(BaseModel):
    monthly_value: float | None = None
    start_date: date | None = None
    end_date: date | None = None


class AllocationResponse(BaseModel):
    id: int
    member_id: int
    client_id: int
    monthly_value: float
    start_date: date
    end_date: date | None
    created_at: datetime
    member_name: str = ""
    client_name: str = ""

    model_config = {"from_attributes": True}
