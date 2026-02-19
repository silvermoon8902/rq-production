from datetime import datetime, timezone, date
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, or_, false
from app.core.database import get_db
from app.core.security import get_current_user
from app.modules.auth.models import User, UserRole
from app.modules.clients.models import Client, ClientStatus
from app.modules.team.models import TeamMember, MemberStatus, Squad, TeamAllocation
from app.modules.demands.models import Demand, DemandStatus
from app.modules.meetings.models import ClientMeeting

router = APIRouter(prefix="/dashboard", tags=["Dashboard"])


@router.get("/stats")
async def get_stats(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    now = datetime.now(timezone.utc)
    today = date.today()
    month_start = datetime(now.year, now.month, 1, tzinfo=timezone.utc)
    is_admin = current_user.role == UserRole.ADMIN

    # ── Resolve scope for non-admin users ────────────────────
    my_client_ids: list[int] | None = None  # None = no filter (admin)
    my_member_id: int | None = None

    if not is_admin:
        member_res = await db.execute(
            select(TeamMember).where(TeamMember.user_id == current_user.id)
        )
        my_member = member_res.scalar_one_or_none()
        if my_member:
            my_member_id = my_member.id
            alloc_res = await db.execute(
                select(TeamAllocation.client_id).where(
                    TeamAllocation.member_id == my_member.id,
                    or_(TeamAllocation.end_date.is_(None), TeamAllocation.end_date >= today),
                ).distinct()
            )
            my_client_ids = [row[0] for row in alloc_res.all()]
        else:
            my_client_ids = []

    # ── Helper: add client scope ──────────────────────────────
    def with_client_scope(q):
        if my_client_ids is None:
            return q
        if not my_client_ids:
            return q.where(false())
        return q.where(Client.id.in_(my_client_ids))

    def with_demand_scope(q):
        if my_client_ids is None:
            return q
        conditions = []
        if my_member_id:
            conditions.append(Demand.assigned_to_id == my_member_id)
        if my_client_ids:
            conditions.append(Demand.client_id.in_(my_client_ids))
        if not conditions:
            return q.where(false())
        return q.where(or_(*conditions))

    def with_meeting_scope(q):
        if my_client_ids is None:
            return q
        if not my_client_ids:
            return q.where(false())
        return q.where(ClientMeeting.client_id.in_(my_client_ids))

    # ── Clients ──────────────────────────────────────────────
    clients_total = await db.execute(
        with_client_scope(select(func.count(Client.id)))
    )
    clients_active = await db.execute(
        with_client_scope(select(func.count(Client.id)).where(Client.status == ClientStatus.ACTIVE))
    )
    clients_onboarding = await db.execute(
        with_client_scope(select(func.count(Client.id)).where(Client.status == ClientStatus.ONBOARDING))
    )
    clients_churned = await db.execute(
        with_client_scope(select(func.count(Client.id)).where(Client.status == ClientStatus.CHURNED))
    )
    clients_inactive = await db.execute(
        with_client_scope(select(func.count(Client.id)).where(Client.status == ClientStatus.INACTIVE))
    )

    recv_q = select(func.coalesce(func.sum(Client.monthly_value), 0)).where(
        Client.status.in_([ClientStatus.ACTIVE, ClientStatus.ONBOARDING]),
        Client.monthly_value.isnot(None),
    )
    recv_q = with_client_scope(recv_q)
    receivable_res = await db.execute(recv_q)
    total_receivable = float(receivable_res.scalar() or 0)

    # ── Team (always global) ──────────────────────────────────
    members_active = await db.execute(
        select(func.count(TeamMember.id)).where(TeamMember.status == MemberStatus.ACTIVE)
    )
    members_total = await db.execute(select(func.count(TeamMember.id)))
    squads_total = await db.execute(select(func.count(Squad.id)))

    # ── Demands ──────────────────────────────────────────────
    demands_backlog = await db.execute(
        with_demand_scope(select(func.count(Demand.id)).where(Demand.status == DemandStatus.BACKLOG))
    )
    demands_todo = await db.execute(
        with_demand_scope(select(func.count(Demand.id)).where(Demand.status == DemandStatus.TODO))
    )
    demands_in_progress = await db.execute(
        with_demand_scope(select(func.count(Demand.id)).where(Demand.status == DemandStatus.IN_PROGRESS))
    )
    demands_in_review = await db.execute(
        with_demand_scope(select(func.count(Demand.id)).where(Demand.status == DemandStatus.IN_REVIEW))
    )
    demands_done = await db.execute(
        with_demand_scope(select(func.count(Demand.id)).where(Demand.status == DemandStatus.DONE))
    )
    demands_overdue = await db.execute(
        with_demand_scope(
            select(func.count(Demand.id)).where(
                Demand.status != DemandStatus.DONE,
                Demand.due_date.isnot(None),
                Demand.due_date < today,
            )
        )
    )

    # ── Meetings ─────────────────────────────────────────────
    meetings_this_month = await db.execute(
        with_meeting_scope(
            select(func.count(ClientMeeting.id)).where(ClientMeeting.created_at >= month_start)
        )
    )

    return {
        "clients_total": clients_total.scalar() or 0,
        "clients_active": clients_active.scalar() or 0,
        "clients_onboarding": clients_onboarding.scalar() or 0,
        "clients_churned": clients_churned.scalar() or 0,
        "clients_inactive": clients_inactive.scalar() or 0,
        "total_receivable": total_receivable,
        "members_active": members_active.scalar() or 0,
        "members_total": members_total.scalar() or 0,
        "squads_total": squads_total.scalar() or 0,
        "demands_backlog": demands_backlog.scalar() or 0,
        "demands_todo": demands_todo.scalar() or 0,
        "demands_in_progress": demands_in_progress.scalar() or 0,
        "demands_in_review": demands_in_review.scalar() or 0,
        "demands_done": demands_done.scalar() or 0,
        "demands_overdue": demands_overdue.scalar() or 0,
        "meetings_this_month": meetings_this_month.scalar() or 0,
    }
