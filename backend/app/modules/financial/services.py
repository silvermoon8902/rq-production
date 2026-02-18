import calendar
from datetime import date
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.modules.team.models import TeamAllocation, TeamMember
from app.modules.clients.models import Client


def calculate_proportional_value(
    monthly_value: float,
    start_date: date,
    end_date: date | None,
    ref_month: int,
    ref_year: int,
) -> dict:
    """Calculate proportional value for a given month."""
    days_in_month = calendar.monthrange(ref_year, ref_month)[1]
    month_start = date(ref_year, ref_month, 1)
    month_end = date(ref_year, ref_month, days_in_month)

    effective_start = max(start_date, month_start)
    effective_end = min(end_date, month_end) if end_date else month_end

    if effective_start > month_end or effective_end < month_start:
        active_days = 0
    else:
        active_days = (effective_end - effective_start).days + 1

    proportional = round((monthly_value / days_in_month) * active_days, 2)

    return {
        "days_in_month": days_in_month,
        "active_days": active_days,
        "proportional_value": proportional,
    }


async def get_financial_dashboard(
    db: AsyncSession, month: int, year: int
) -> dict:
    result = await db.execute(
        select(TeamAllocation, TeamMember, Client)
        .join(TeamMember, TeamAllocation.member_id == TeamMember.id)
        .join(Client, TeamAllocation.client_id == Client.id)
    )
    rows = result.all()

    by_client: dict[int, dict] = {}
    by_member: dict[int, dict] = {}
    total_cost = 0.0

    for allocation, member, client in rows:
        calc = calculate_proportional_value(
            float(allocation.monthly_value),
            allocation.start_date,
            allocation.end_date,
            month,
            year,
        )

        if calc["active_days"] == 0:
            continue

        alloc_data = {
            "allocation_id": allocation.id,
            "member_id": member.id,
            "member_name": member.name,
            "client_id": client.id,
            "client_name": client.name,
            "monthly_value": float(allocation.monthly_value),
            "start_date": allocation.start_date,
            "end_date": allocation.end_date,
            **calc,
        }

        total_cost += calc["proportional_value"]

        # By client
        if client.id not in by_client:
            by_client[client.id] = {
                "client_id": client.id,
                "client_name": client.name,
                "total_monthly": 0,
                "total_proportional": 0,
                "allocations": [],
            }
        by_client[client.id]["total_monthly"] += float(allocation.monthly_value)
        by_client[client.id]["total_proportional"] += calc["proportional_value"]
        by_client[client.id]["allocations"].append(alloc_data)

        # By member
        if member.id not in by_member:
            by_member[member.id] = {
                "member_id": member.id,
                "member_name": member.name,
                "total_monthly": 0,
                "total_proportional": 0,
                "allocations": [],
            }
        by_member[member.id]["total_monthly"] += float(allocation.monthly_value)
        by_member[member.id]["total_proportional"] += calc["proportional_value"]
        by_member[member.id]["allocations"].append(alloc_data)

    return {
        "month": month,
        "year": year,
        "total_cost": round(total_cost, 2),
        "by_client": list(by_client.values()),
        "by_member": list(by_member.values()),
    }


async def get_client_costs(
    db: AsyncSession, client_id: int, month: int, year: int
) -> dict:
    result = await db.execute(
        select(TeamAllocation, TeamMember, Client)
        .join(TeamMember, TeamAllocation.member_id == TeamMember.id)
        .join(Client, TeamAllocation.client_id == Client.id)
        .where(TeamAllocation.client_id == client_id)
    )
    rows = result.all()

    allocations = []
    total_monthly = 0.0
    total_proportional = 0.0
    client_name = ""

    for allocation, member, client in rows:
        client_name = client.name
        calc = calculate_proportional_value(
            float(allocation.monthly_value),
            allocation.start_date,
            allocation.end_date,
            month,
            year,
        )
        if calc["active_days"] == 0:
            continue
        total_monthly += float(allocation.monthly_value)
        total_proportional += calc["proportional_value"]
        allocations.append({
            "allocation_id": allocation.id,
            "member_id": member.id,
            "member_name": member.name,
            "client_id": client.id,
            "client_name": client.name,
            "monthly_value": float(allocation.monthly_value),
            "start_date": allocation.start_date,
            "end_date": allocation.end_date,
            **calc,
        })

    return {
        "client_id": client_id,
        "client_name": client_name,
        "total_monthly": round(total_monthly, 2),
        "total_proportional": round(total_proportional, 2),
        "allocations": allocations,
    }
