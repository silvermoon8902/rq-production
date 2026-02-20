from datetime import datetime
from pydantic import BaseModel
from app.modules.demands.models import DemandPriority, DemandStatus


class KanbanColumnCreate(BaseModel):
    name: str
    order: int = 0
    color: str = "#6B7280"


class KanbanColumnUpdate(BaseModel):
    name: str | None = None
    order: int | None = None
    color: str | None = None


class KanbanColumnResponse(BaseModel):
    id: int
    name: str
    order: int
    color: str
    is_default: bool
    demands_count: int = 0

    model_config = {"from_attributes": True}


class DemandCreate(BaseModel):
    title: str
    description: str | None = None
    priority: DemandPriority = DemandPriority.MEDIUM
    demand_type: str | None = None
    column_id: int | None = None
    client_id: int | None = None
    assigned_to_id: int | None = None
    sla_hours: int | None = None
    due_date: datetime | None = None


class DemandUpdate(BaseModel):
    title: str | None = None
    description: str | None = None
    priority: DemandPriority | None = None
    status: DemandStatus | None = None
    demand_type: str | None = None
    column_id: int | None = None
    position: int | None = None
    client_id: int | None = None
    assigned_to_id: int | None = None
    sla_hours: int | None = None
    due_date: datetime | None = None


class DemandMove(BaseModel):
    column_id: int
    position: int


class DemandResponse(BaseModel):
    id: int
    title: str
    description: str | None
    priority: DemandPriority
    status: DemandStatus
    demand_type: str | None
    column_id: int | None
    column_name: str | None = None
    position: int
    client_id: int | None
    assigned_to_id: int | None
    created_by_id: int | None
    sla_hours: int | None
    due_date: datetime | None
    completed_at: datetime | None
    sla_status: str = "on_time"
    created_at: datetime
    updated_at: datetime
    client_name: str | None = None
    assigned_to_name: str | None = None
    in_progress_hours: float | None = None
    comments_count: int = 0

    model_config = {"from_attributes": True}


class CommentCreate(BaseModel):
    text: str


class CommentResponse(BaseModel):
    id: int
    demand_id: int
    user_id: int | None
    text: str
    created_at: datetime
    user_name: str | None = None

    model_config = {"from_attributes": True}


class DemandHistoryResponse(BaseModel):
    id: int
    demand_id: int
    from_column: str | None
    to_column: str | None
    changed_by_id: int | None
    note: str | None
    created_at: datetime

    model_config = {"from_attributes": True}


class KanbanBoardResponse(BaseModel):
    columns: list[KanbanColumnResponse]
    demands: dict[str, list[DemandResponse]]
