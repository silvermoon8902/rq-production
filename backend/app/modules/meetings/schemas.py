from datetime import datetime
from pydantic import BaseModel
from app.modules.meetings.models import MeetingType


class MeetingCreate(BaseModel):
    meeting_type: MeetingType
    client_id: int
    squad_id: int | None = None
    member_id: int | None = None
    health_score: float | None = None
    notes: str | None = None


class MeetingResponse(BaseModel):
    id: int
    meeting_type: MeetingType
    client_id: int
    squad_id: int | None
    member_id: int | None
    health_score: float | None
    notes: str | None
    created_by_id: int | None
    created_at: datetime
    client_name: str | None = None
    member_name: str | None = None

    model_config = {"from_attributes": True}
