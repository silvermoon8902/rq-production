from datetime import date
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from sqlalchemy.orm import selectinload
from fastapi import HTTPException
from app.modules.clients.models import Client, ClientStatus
from app.modules.clients.schemas import ClientCreate, ClientUpdate
from app.modules.demands.models import Demand, DemandStatus
from app.modules.team.models import TeamAllocation, TeamMember


async def create_client(db: AsyncSession, data: ClientCreate, user_id: int) -> Client:
    client = Client(**data.model_dump(), created_by_id=user_id)
    db.add(client)
    await db.commit()
    await db.refresh(client)
    return client


async def get_all_clients(
    db: AsyncSession,
    status: str | None = None,
    segment: str | None = None,
    search: str | None = None,
) -> list[Client]:
    query = select(Client).order_by(Client.name)
    if status:
        query = query.where(Client.status == status)
    if segment:
        query = query.where(Client.segment == segment)
    if search:
        query = query.where(
            Client.name.ilike(f"%{search}%") | Client.company.ilike(f"%{search}%")
        )
    result = await db.execute(query)
    return list(result.scalars().all())


async def get_niches(db: AsyncSession) -> list[str]:
    result = await db.execute(
        select(Client.segment).where(Client.segment.isnot(None)).distinct()
    )
    return sorted([row[0] for row in result.all() if row[0]])


async def get_client_by_id(db: AsyncSession, client_id: int) -> Client:
    result = await db.execute(
        select(Client)
        .where(Client.id == client_id)
        .options(selectinload(Client.allocations), selectinload(Client.demands))
    )
    client = result.scalar_one_or_none()
    if not client:
        raise HTTPException(status_code=404, detail="Cliente nao encontrado")
    return client


async def get_client_detail(db: AsyncSession, client_id: int) -> dict:
    client = await get_client_by_id(db, client_id)

    # Enrich allocations with member info (fixes crash)
    enriched_allocations = []
    for alloc in client.allocations:
        member_result = await db.execute(
            select(TeamMember).where(TeamMember.id == alloc.member_id)
        )
        member = member_result.scalar_one_or_none()
        enriched_allocations.append({
            "id": alloc.id,
            "member_id": alloc.member_id,
            "member_name": member.name if member else "",
            "role_title": member.role_title if member else "",
            "monthly_value": float(alloc.monthly_value or 0),
            "start_date": alloc.start_date,
            "end_date": alloc.end_date,
        })

    demands_count = await db.execute(
        select(func.count(Demand.id)).where(Demand.client_id == client_id)
    )
    active_demands = await db.execute(
        select(func.count(Demand.id)).where(
            Demand.client_id == client_id,
            Demand.status.not_in([DemandStatus.DONE]),
        )
    )

    # Calculate active project days
    active_days = None
    if client.start_date:
        today = date.today()
        end = client.end_date if client.end_date and client.end_date < today else today
        active_days = (end - client.start_date).days

    client_dict = {c.key: getattr(client, c.key) for c in Client.__table__.columns}
    # Convert Decimal to float for financial fields
    for field in ("monthly_value", "operational_cost"):
        if client_dict.get(field) is not None:
            client_dict[field] = float(client_dict[field])

    return {
        **client_dict,
        "allocations": enriched_allocations,
        "demands_count": demands_count.scalar() or 0,
        "active_demands_count": active_demands.scalar() or 0,
        "active_days": active_days,
    }


async def update_client(
    db: AsyncSession, client_id: int, data: ClientUpdate
) -> Client:
    client = await get_client_by_id(db, client_id)
    update_data = data.model_dump(exclude_unset=True)

    # Auto-status logic: when end_date is set, status becomes CHURNED (notice period)
    if "end_date" in update_data and update_data["end_date"]:
        today = date.today()
        if "status" not in update_data:
            if update_data["end_date"] >= today:
                update_data["status"] = ClientStatus.CHURNED
            else:
                update_data["status"] = ClientStatus.INACTIVE

    for field, value in update_data.items():
        setattr(client, field, value)
    await db.commit()
    await db.refresh(client)
    return client


async def delete_client(db: AsyncSession, client_id: int) -> None:
    client = await get_client_by_id(db, client_id)
    await db.delete(client)
    await db.commit()
