from datetime import datetime
from decimal import Decimal
from pydantic import BaseModel


# --- Columns ---
class DesignColumnCreate(BaseModel):
    name: str
    order: int = 0
    color: str = "#6B7280"


class DesignColumnUpdate(BaseModel):
    name: str | None = None
    order: int | None = None
    color: str | None = None


class DesignColumnResponse(BaseModel):
    id: int
    name: str
    order: int
    color: str
    is_default: bool
    demands_count: int = 0
    model_config = {"from_attributes": True}


# --- Demands ---
class DesignDemandCreate(BaseModel):
    title: str
    description: str | None = None
    demand_type: str = "arte"
    column_id: int | None = None
    client_id: int | None = None
    assigned_to_id: int | None = None
    due_date: datetime | None = None


class DesignDemandUpdate(BaseModel):
    title: str | None = None
    description: str | None = None
    demand_type: str | None = None
    column_id: int | None = None
    client_id: int | None = None
    assigned_to_id: int | None = None
    due_date: datetime | None = None


class DesignDemandMove(BaseModel):
    column_id: int
    position: int


class DesignDemandResponse(BaseModel):
    id: int
    title: str
    description: str | None
    demand_type: str
    column_id: int | None
    column_name: str | None = None
    position: int
    client_id: int | None
    client_name: str | None = None
    assigned_to_id: int | None
    assigned_to_name: str | None = None
    created_by_id: int | None
    due_date: datetime | None
    completed_at: datetime | None
    approved_at: datetime | None
    payment_value: Decimal | None
    payment_registered: bool
    attachments_count: int = 0
    comments_count: int = 0
    created_at: datetime
    updated_at: datetime
    model_config = {"from_attributes": True}


# --- Board ---
class DesignBoardResponse(BaseModel):
    columns: list[DesignColumnResponse]
    demands: dict[str, list[DesignDemandResponse]]


# --- Comments ---
class DesignCommentCreate(BaseModel):
    text: str


class DesignCommentResponse(BaseModel):
    id: int
    demand_id: int
    user_id: int | None
    text: str
    created_at: datetime
    user_name: str | None = None
    model_config = {"from_attributes": True}


# --- Attachments ---
class DesignAttachmentResponse(BaseModel):
    id: int
    demand_id: int
    filename: str
    file_path: str
    file_type: str | None
    file_size: int
    uploaded_by_id: int | None
    created_at: datetime
    model_config = {"from_attributes": True}


# --- History ---
class DesignHistoryResponse(BaseModel):
    id: int
    demand_id: int
    from_column: str | None
    to_column: str | None
    changed_by_id: int | None
    note: str | None
    created_at: datetime
    model_config = {"from_attributes": True}


# --- Payments ---
class DesignPaymentResponse(BaseModel):
    id: int
    demand_id: int
    member_id: int
    client_id: int | None
    demand_type: str
    value: Decimal
    month: int
    year: int
    created_at: datetime
    member_name: str | None = None
    client_name: str | None = None
    demand_title: str | None = None
    model_config = {"from_attributes": True}


class DesignPaymentSummary(BaseModel):
    member_id: int
    member_name: str
    total_artes: int
    total_videos: int
    total_value: Decimal
    arte_rate: Decimal = Decimal("10.00")
    video_rate: Decimal = Decimal("20.00")
    payments: list[DesignPaymentResponse]


class DesignMemberRateResponse(BaseModel):
    member_id: int
    member_name: str
    arte_value: Decimal
    video_value: Decimal
    model_config = {"from_attributes": True}


class DesignMemberRateUpdate(BaseModel):
    member_id: int
    arte_value: Decimal
    video_value: Decimal
