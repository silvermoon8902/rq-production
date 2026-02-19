from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.modules.meetings.models import ClientMeeting
from app.modules.meetings.schemas import MeetingCreate
from app.modules.clients.models import Client
from app.modules.team.models import TeamMember


async def create_meeting(db: AsyncSession, data: MeetingCreate, user_id: int) -> dict:
    # Update client health_score if provided
    if data.health_score is not None:
        r = await db.execute(select(Client).where(Client.id == data.client_id))
        client = r.scalar_one_or_none()
        if client:
            client.health_score = data.health_score
            await db.flush()

    meeting = ClientMeeting(**data.model_dump(), created_by_id=user_id)
    db.add(meeting)
    await db.commit()
    await db.refresh(meeting)
    return await _enrich_meeting(db, meeting)


async def get_meetings(
    db: AsyncSession,
    client_id: int | None = None,
    meeting_type: str | None = None,
) -> list[dict]:
    query = select(ClientMeeting).order_by(ClientMeeting.created_at.desc())
    if client_id:
        query = query.where(ClientMeeting.client_id == client_id)
    if meeting_type:
        query = query.where(ClientMeeting.meeting_type == meeting_type)
    result = await db.execute(query)
    meetings = result.scalars().all()
    return [await _enrich_meeting(db, m) for m in meetings]


async def _enrich_meeting(db: AsyncSession, meeting: ClientMeeting) -> dict:
    client_name = None
    member_name = None
    r = await db.execute(select(Client.name).where(Client.id == meeting.client_id))
    client_name = r.scalar_one_or_none()
    if meeting.member_id:
        r = await db.execute(select(TeamMember.name).where(TeamMember.id == meeting.member_id))
        member_name = r.scalar_one_or_none()
    return {
        "id": meeting.id,
        "meeting_type": meeting.meeting_type,
        "client_id": meeting.client_id,
        "squad_id": meeting.squad_id,
        "member_id": meeting.member_id,
        "health_score": meeting.health_score,
        "notes": meeting.notes,
        "created_by_id": meeting.created_by_id,
        "created_at": meeting.created_at,
        "client_name": client_name,
        "member_name": member_name,
    }
