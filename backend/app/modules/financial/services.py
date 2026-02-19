import calendar
from datetime import date
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from fastapi import HTTPException
from app.modules.team.models import TeamAllocation, TeamMember, Squad
from app.modules.clients.models import Client, ClientStatus
from app.modules.financial.models import MonthlyFinancials, ExtraExpense
from app.modules.financial.schemas import ExtraExpenseCreate, ExtraExpenseUpdate, MonthlyFinancialsUpdate

CALC_DAYS = 30  # Always use 30 days for proportional calculations


def calculate_proportional_value(
    monthly_value: float,
    start_date: date,
    end_date: date | None,
    ref_month: int,
    ref_year: int,
) -> dict:
    """Calculate proportional value using fixed 30-day basis."""
    days_in_cal = calendar.monthrange(ref_year, ref_month)[1]
    month_start = date(ref_year, ref_month, 1)
    month_end = date(ref_year, ref_month, days_in_cal)

    effective_start = max(start_date, month_start)
    effective_end = min(end_date, month_end) if end_date else month_end

    if effective_start > month_end or effective_end < month_start:
        active_days = 0
    else:
        active_days = (effective_end - effective_start).days + 1

    active_days = min(active_days, CALC_DAYS)
    proportional = round((monthly_value / CALC_DAYS) * active_days, 2)

    return {
        "days_in_month": CALC_DAYS,
        "active_days": active_days,
        "proportional_value": proportional,
    }


async def get_or_create_monthly_financials(
    db: AsyncSession, month: int, year: int
) -> MonthlyFinancials:
    result = await db.execute(
        select(MonthlyFinancials).where(
            MonthlyFinancials.month == month,
            MonthlyFinancials.year == year,
        )
    )
    mf = result.scalar_one_or_none()
    if not mf:
        mf = MonthlyFinancials(month=month, year=year)
        db.add(mf)
        await db.commit()
        await db.refresh(mf)
    return mf


async def upsert_monthly_financials(
    db: AsyncSession, month: int, year: int, data: MonthlyFinancialsUpdate
) -> MonthlyFinancials:
    mf = await get_or_create_monthly_financials(db, month, year)
    update_dict = data.model_dump(exclude_unset=True)
    for k, v in update_dict.items():
        setattr(mf, k, v)
    await db.commit()
    await db.refresh(mf)
    return mf


async def get_extra_expenses(
    db: AsyncSession, month: int, year: int
) -> list[ExtraExpense]:
    result = await db.execute(
        select(ExtraExpense).where(
            ExtraExpense.month == month,
            ExtraExpense.year == year,
        ).order_by(ExtraExpense.payment_date)
    )
    return list(result.scalars().all())


async def create_extra_expense(
    db: AsyncSession, data: ExtraExpenseCreate, user_id: int
) -> ExtraExpense:
    expense = ExtraExpense(**data.model_dump(), created_by_id=user_id)
    db.add(expense)
    await db.commit()
    await db.refresh(expense)
    return expense


async def update_extra_expense(
    db: AsyncSession, expense_id: int, data: ExtraExpenseUpdate
) -> ExtraExpense:
    result = await db.execute(
        select(ExtraExpense).where(ExtraExpense.id == expense_id)
    )
    expense = result.scalar_one_or_none()
    if not expense:
        raise HTTPException(status_code=404, detail="Lançamento não encontrado")
    update_dict = data.model_dump(exclude_unset=True)
    for k, v in update_dict.items():
        setattr(expense, k, v)
    await db.commit()
    await db.refresh(expense)
    return expense


async def delete_extra_expense(db: AsyncSession, expense_id: int) -> None:
    result = await db.execute(
        select(ExtraExpense).where(ExtraExpense.id == expense_id)
    )
    expense = result.scalar_one_or_none()
    if not expense:
        raise HTTPException(status_code=404, detail="Lançamento não encontrado")
    await db.delete(expense)
    await db.commit()


async def get_financial_dashboard(
    db: AsyncSession, month: int, year: int
) -> dict:
    result = await db.execute(
        select(TeamAllocation, TeamMember, Client, Squad)
        .join(TeamMember, TeamAllocation.member_id == TeamMember.id)
        .join(Client, TeamAllocation.client_id == Client.id)
        .outerjoin(Squad, TeamMember.squad_id == Squad.id)
    )
    rows = result.all()

    by_client: dict[int, dict] = {}
    by_member: dict[int, dict] = {}
    by_squad: dict = {}
    by_role: dict[str, dict] = {}
    total_cost = 0.0

    for allocation, member, client, squad in rows:
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

        if client.id not in by_client:
            by_client[client.id] = {
                "client_id": client.id,
                "client_name": client.name,
                "total_monthly": 0.0,
                "total_proportional": 0.0,
                "allocations": [],
            }
        by_client[client.id]["total_monthly"] += float(allocation.monthly_value)
        by_client[client.id]["total_proportional"] += calc["proportional_value"]
        by_client[client.id]["allocations"].append(alloc_data)

        if member.id not in by_member:
            by_member[member.id] = {
                "member_id": member.id,
                "member_name": member.name,
                "role_title": member.role_title,
                "total_monthly": 0.0,
                "total_proportional": 0.0,
                "allocations": [],
            }
        by_member[member.id]["total_monthly"] += float(allocation.monthly_value)
        by_member[member.id]["total_proportional"] += calc["proportional_value"]
        by_member[member.id]["allocations"].append(alloc_data)

        squad_key = squad.id if squad else 0
        squad_name = squad.name if squad else "Sem Squad"
        if squad_key not in by_squad:
            by_squad[squad_key] = {
                "squad_id": squad.id if squad else None,
                "squad_name": squad_name,
                "total_monthly": 0.0,
                "total_proportional": 0.0,
            }
        by_squad[squad_key]["total_monthly"] += float(allocation.monthly_value)
        by_squad[squad_key]["total_proportional"] += calc["proportional_value"]

        role = member.role_title or "Sem Cargo"
        if role not in by_role:
            by_role[role] = {
                "role_title": role,
                "total_monthly": 0.0,
                "total_proportional": 0.0,
            }
        by_role[role]["total_monthly"] += float(allocation.monthly_value)
        by_role[role]["total_proportional"] += calc["proportional_value"]

    # A receber: active/onboarding clients' monthly_value
    active_result = await db.execute(
        select(Client).where(
            Client.monthly_value.isnot(None),
            Client.status.in_([ClientStatus.ACTIVE, ClientStatus.ONBOARDING]),
        )
    )
    active_clients = list(active_result.scalars().all())
    total_receivable = round(
        sum(float(c.monthly_value) for c in active_clients if c.monthly_value), 2
    )

    mf = await get_or_create_monthly_financials(db, month, year)
    extras = await get_extra_expenses(db, month, year)
    total_extras = round(sum(float(e.amount) for e in extras), 2)

    net_profit = None
    if mf.total_received is not None:
        expenses = round(
            total_cost + (mf.tax_amount or 0) + (mf.marketing_amount or 0) + total_extras, 2
        )
        net_profit = round(mf.total_received - expenses, 2)

    def sort_desc(d: dict):
        return sorted(d.values(), key=lambda x: x["total_proportional"], reverse=True)

    return {
        "month": month,
        "year": year,
        "total_receivable": total_receivable,
        "total_received": mf.total_received,
        "total_operational_cost": round(total_cost, 2),
        "tax_amount": mf.tax_amount,
        "marketing_amount": mf.marketing_amount,
        "total_extras": total_extras,
        "net_profit": net_profit,
        "extra_expenses": extras,
        "by_client": sort_desc(by_client),
        "by_member": sort_desc(by_member),
        "by_squad": sort_desc(by_squad),
        "by_role": sort_desc(by_role),
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
