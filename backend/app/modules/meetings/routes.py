from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.core.security import get_current_user
from app.modules.auth.models import User
from app.modules.meetings import schemas, services

router = APIRouter(prefix="/meetings", tags=["Reuniões"])


@router.post("", response_model=schemas.MeetingResponse, status_code=201)
async def create_meeting(
    data: schemas.MeetingCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return await services.create_meeting(db, data, current_user.id)


@router.get("", response_model=list[schemas.MeetingResponse])
async def list_meetings(
    client_id: int | None = Query(None),
    meeting_type: str | None = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return await services.get_meetings(db, client_id, meeting_type)
