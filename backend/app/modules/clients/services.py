from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from sqlalchemy.orm import selectinload
from fastapi import HTTPException
from app.modules.clients.models import Client
from app.modules.clients.schemas import ClientCreate, ClientUpdate
from app.modules.demands.models import Demand, DemandStatus


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


async def get_client_by_id(db: AsyncSession, client_id: int) -> Client:
    result = await db.execute(
        select(Client)
        .where(Client.id == client_id)
        .options(selectinload(Client.allocations), selectinload(Client.demands))
    )
    client = result.scalar_one_or_none()
    if not client:
        raise HTTPException(status_code=404, detail="Cliente não encontrado")
    return client


async def get_client_detail(db: AsyncSession, client_id: int) -> dict:
    client = await get_client_by_id(db, client_id)

    demands_count = await db.execute(
        select(func.count(Demand.id)).where(Demand.client_id == client_id)
    )
    active_demands = await db.execute(
        select(func.count(Demand.id)).where(
            Demand.client_id == client_id,
            Demand.status.not_in([DemandStatus.DONE]),
        )
    )

    return {
        **{c.key: getattr(client, c.key) for c in Client.__table__.columns},
        "allocations": client.allocations,
        "demands_count": demands_count.scalar() or 0,
        "active_demands_count": active_demands.scalar() or 0,
    }


async def update_client(
    db: AsyncSession, client_id: int, data: ClientUpdate
) -> Client:
    client = await get_client_by_id(db, client_id)
    update_data = data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(client, field, value)
    await db.commit()
    await db.refresh(client)
    return client


async def delete_client(db: AsyncSession, client_id: int) -> None:
    client = await get_client_by_id(db, client_id)
    await db.delete(client)
    await db.commit()
