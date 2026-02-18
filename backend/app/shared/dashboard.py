from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from app.core.database import get_db
from app.core.security import get_current_user
from app.modules.auth.models import User
from app.modules.clients.models import Client, ClientStatus
from app.modules.team.models import TeamMember, MemberStatus
from app.modules.demands.models import Demand, DemandStatus

router = APIRouter(prefix="/dashboard", tags=["Dashboard"])


@router.get("/stats")
async def get_stats(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    clients_total = await db.execute(select(func.count(Client.id)))
    clients_active = await db.execute(
        select(func.count(Client.id)).where(Client.status == ClientStatus.ACTIVE)
    )
    members_total = await db.execute(
        select(func.count(TeamMember.id)).where(TeamMember.status == MemberStatus.ACTIVE)
    )
    demands_total = await db.execute(select(func.count(Demand.id)))
    demands_active = await db.execute(
        select(func.count(Demand.id)).where(Demand.status != DemandStatus.DONE)
    )
    demands_done = await db.execute(
        select(func.count(Demand.id)).where(Demand.status == DemandStatus.DONE)
    )

    return {
        "total_clients": clients_total.scalar() or 0,
        "active_clients": clients_active.scalar() or 0,
        "total_members": members_total.scalar() or 0,
        "total_demands": demands_total.scalar() or 0,
        "active_demands": demands_active.scalar() or 0,
        "completed_demands": demands_done.scalar() or 0,
    }
