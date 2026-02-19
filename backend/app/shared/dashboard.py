from datetime import datetime, timezone, date
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_
from app.core.database import get_db
from app.core.security import get_current_user
from app.modules.auth.models import User
from app.modules.clients.models import Client, ClientStatus
from app.modules.team.models import TeamMember, MemberStatus, Squad
from app.modules.demands.models import Demand, DemandStatus
from app.modules.meetings.models import ClientMeeting

router = APIRouter(prefix="/dashboard", tags=["Dashboard"])


@router.get("/stats")
async def get_stats(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    now = datetime.now(timezone.utc)
    month_start = datetime(now.year, now.month, 1, tzinfo=timezone.utc)

    # ── Clients ──────────────────────────────────────────────
    clients_active = await db.execute(
        select(func.count(Client.id)).where(Client.status == ClientStatus.ACTIVE)
    )
    clients_onboarding = await db.execute(
        select(func.count(Client.id)).where(Client.status == ClientStatus.ONBOARDING)
    )
    clients_churned = await db.execute(
        select(func.count(Client.id)).where(Client.status == ClientStatus.CHURNED)
    )
    clients_inactive = await db.execute(
        select(func.count(Client.id)).where(Client.status == ClientStatus.INACTIVE)
    )
    clients_total = await db.execute(select(func.count(Client.id)))

    # Total receivable: sum of monthly_value for active + onboarding
    receivable_res = await db.execute(
        select(func.coalesce(func.sum(Client.monthly_value), 0)).where(
            Client.status.in_([ClientStatus.ACTIVE, ClientStatus.ONBOARDING]),
            Client.monthly_value.isnot(None),
        )
    )
    total_receivable = float(receivable_res.scalar() or 0)

    # ── Team ─────────────────────────────────────────────────
    members_active = await db.execute(
        select(func.count(TeamMember.id)).where(TeamMember.status == MemberStatus.ACTIVE)
    )
    members_total = await db.execute(select(func.count(TeamMember.id)))
    squads_total = await db.execute(select(func.count(Squad.id)))

    # ── Demands ──────────────────────────────────────────────
    demands_backlog = await db.execute(
        select(func.count(Demand.id)).where(Demand.status == DemandStatus.BACKLOG)
    )
    demands_todo = await db.execute(
        select(func.count(Demand.id)).where(Demand.status == DemandStatus.TODO)
    )
    demands_in_progress = await db.execute(
        select(func.count(Demand.id)).where(Demand.status == DemandStatus.IN_PROGRESS)
    )
    demands_in_review = await db.execute(
        select(func.count(Demand.id)).where(Demand.status == DemandStatus.IN_REVIEW)
    )
    demands_done = await db.execute(
        select(func.count(Demand.id)).where(Demand.status == DemandStatus.DONE)
    )
    demands_overdue = await db.execute(
        select(func.count(Demand.id)).where(
            Demand.status != DemandStatus.DONE,
            Demand.due_date.isnot(None),
            Demand.due_date < now,
        )
    )

    # ── Meetings ─────────────────────────────────────────────
    meetings_this_month = await db.execute(
        select(func.count(ClientMeeting.id)).where(
            ClientMeeting.created_at >= month_start
        )
    )

    return {
        # Clients
        "clients_total": clients_total.scalar() or 0,
        "clients_active": clients_active.scalar() or 0,
        "clients_onboarding": clients_onboarding.scalar() or 0,
        "clients_churned": clients_churned.scalar() or 0,
        "clients_inactive": clients_inactive.scalar() or 0,
        "total_receivable": total_receivable,
        # Team
        "members_active": members_active.scalar() or 0,
        "members_total": members_total.scalar() or 0,
        "squads_total": squads_total.scalar() or 0,
        # Demands
        "demands_backlog": demands_backlog.scalar() or 0,
        "demands_todo": demands_todo.scalar() or 0,
        "demands_in_progress": demands_in_progress.scalar() or 0,
        "demands_in_review": demands_in_review.scalar() or 0,
        "demands_done": demands_done.scalar() or 0,
        "demands_overdue": demands_overdue.scalar() or 0,
        # Meetings
        "meetings_this_month": meetings_this_month.scalar() or 0,
    }
