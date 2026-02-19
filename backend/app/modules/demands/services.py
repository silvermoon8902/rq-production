from datetime import datetime, timezone
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, delete as sa_delete
from sqlalchemy.orm import selectinload
from fastapi import HTTPException
from app.modules.demands.models import (
    Demand, DemandStatus, KanbanColumn, DemandHistory, SLAStatus,
)
from app.modules.demands.schemas import (
    DemandCreate, DemandUpdate, DemandMove, KanbanColumnCreate, KanbanColumnUpdate,
)
from app.modules.clients.models import Client
from app.modules.team.models import TeamMember


# === Kanban Columns ===
async def create_column(db: AsyncSession, data: KanbanColumnCreate) -> KanbanColumn:
    column = KanbanColumn(**data.model_dump())
    db.add(column)
    await db.commit()
    await db.refresh(column)
    return {
        **{c.key: getattr(column, c.key) for c in KanbanColumn.__table__.columns},
        "demands_count": 0,
    }


async def get_all_columns(db: AsyncSession) -> list[dict]:
    result = await db.execute(
        select(KanbanColumn).order_by(KanbanColumn.order)
    )
    columns = result.scalars().all()
    enriched = []
    for col in columns:
        count = await db.execute(
            select(func.count(Demand.id)).where(Demand.column_id == col.id)
        )
        enriched.append({
            **{c.key: getattr(col, c.key) for c in KanbanColumn.__table__.columns},
            "demands_count": count.scalar() or 0,
        })
    return enriched


async def update_column(
    db: AsyncSession, column_id: int, data: KanbanColumnUpdate
) -> KanbanColumn:
    result = await db.execute(
        select(KanbanColumn).where(KanbanColumn.id == column_id)
    )
    column = result.scalar_one_or_none()
    if not column:
        raise HTTPException(status_code=404, detail="Coluna não encontrada")
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(column, field, value)
    await db.commit()
    await db.refresh(column)
    return column


async def delete_column(db: AsyncSession, column_id: int) -> None:
    result = await db.execute(
        select(KanbanColumn).where(KanbanColumn.id == column_id)
    )
    column = result.scalar_one_or_none()
    if not column:
        raise HTTPException(status_code=404, detail="Coluna não encontrada")
    if column.is_default:
        raise HTTPException(status_code=400, detail="Não é possível excluir coluna padrão")
    await db.delete(column)
    await db.commit()


async def seed_default_columns(db: AsyncSession) -> None:
    result = await db.execute(select(func.count(KanbanColumn.id)))
    if result.scalar() > 0:
        return
    defaults = [
        KanbanColumn(name="Backlog", order=0, color="#6B7280", is_default=True),
        KanbanColumn(name="A Fazer", order=1, color="#3B82F6", is_default=True),
        KanbanColumn(name="Em Progresso", order=2, color="#F59E0B", is_default=True),
        KanbanColumn(name="Em Revisão", order=3, color="#8B5CF6", is_default=True),
        KanbanColumn(name="Concluído", order=4, color="#10B981", is_default=True),
    ]
    db.add_all(defaults)
    await db.commit()


# === Demands ===
def _compute_sla_status(demand: Demand) -> str:
    if demand.completed_at or demand.status == DemandStatus.DONE:
        return SLAStatus.ON_TIME.value
    if not demand.due_date:
        return SLAStatus.ON_TIME.value
    now = datetime.now(timezone.utc)
    if demand.due_date.tzinfo is None:
        due = demand.due_date.replace(tzinfo=timezone.utc)
    else:
        due = demand.due_date
    remaining = (due - now).total_seconds() / 3600
    if remaining < 0:
        return SLAStatus.OVERDUE.value
    elif remaining < 24:
        return SLAStatus.WARNING.value
    return SLAStatus.ON_TIME.value


async def _compute_in_progress_hours(db: AsyncSession, demand_id: int) -> float | None:
    """Calculate hours from 'Em Progresso' to 'Concluído' using DemandHistory."""
    result = await db.execute(
        select(DemandHistory)
        .where(DemandHistory.demand_id == demand_id)
        .order_by(DemandHistory.created_at)
    )
    history = list(result.scalars().all())
    prog_time = None
    for h in history:
        if h.to_column and "progresso" in h.to_column.lower():
            prog_time = h.created_at
        if h.to_column and "conclu" in h.to_column.lower() and prog_time:
            done_time = h.created_at
            if done_time.tzinfo is None:
                done_time = done_time.replace(tzinfo=timezone.utc)
            if prog_time.tzinfo is None:
                prog_time = prog_time.replace(tzinfo=timezone.utc)
            return round((done_time - prog_time).total_seconds() / 3600, 2)
    return None


async def _enrich_demand(db: AsyncSession, demand: Demand) -> dict:
    client_name = None
    assigned_name = None
    if demand.client_id:
        r = await db.execute(select(Client.name).where(Client.id == demand.client_id))
        client_name = r.scalar_one_or_none()
    if demand.assigned_to_id:
        r = await db.execute(
            select(TeamMember.name).where(TeamMember.id == demand.assigned_to_id)
        )
        assigned_name = r.scalar_one_or_none()
    in_progress_hours = await _compute_in_progress_hours(db, demand.id)
    return {
        **{c.key: getattr(demand, c.key) for c in Demand.__table__.columns},
        "sla_status": _compute_sla_status(demand),
        "client_name": client_name,
        "assigned_to_name": assigned_name,
        "in_progress_hours": in_progress_hours,
    }


async def create_demand(db: AsyncSession, data: DemandCreate, user_id: int) -> dict:
    demand = Demand(**data.model_dump(), created_by_id=user_id, status=DemandStatus.TODO)
    if not demand.column_id:
        result = await db.execute(
            select(KanbanColumn).where(KanbanColumn.name == "A Fazer").limit(1)
        )
        col = result.scalar_one_or_none()
        if col:
            demand.column_id = col.id
    db.add(demand)
    await db.commit()
    await db.refresh(demand)
    return await _enrich_demand(db, demand)


async def get_all_demands(
    db: AsyncSession,
    client_id: int | None = None,
    assigned_to_id: int | None = None,
    status: str | None = None,
    priority: str | None = None,
) -> list[dict]:
    query = select(Demand).order_by(Demand.position)
    if client_id:
        query = query.where(Demand.client_id == client_id)
    if assigned_to_id:
        query = query.where(Demand.assigned_to_id == assigned_to_id)
    if status:
        query = query.where(Demand.status == status)
    if priority:
        query = query.where(Demand.priority == priority)
    result = await db.execute(query)
    demands = result.scalars().all()
    return [await _enrich_demand(db, d) for d in demands]


async def get_demand_by_id(db: AsyncSession, demand_id: int) -> dict:
    result = await db.execute(
        select(Demand).where(Demand.id == demand_id)
    )
    demand = result.scalar_one_or_none()
    if not demand:
        raise HTTPException(status_code=404, detail="Demanda não encontrada")
    return await _enrich_demand(db, demand)


async def update_demand(
    db: AsyncSession, demand_id: int, data: DemandUpdate
) -> dict:
    result = await db.execute(select(Demand).where(Demand.id == demand_id))
    demand = result.scalar_one_or_none()
    if not demand:
        raise HTTPException(status_code=404, detail="Demanda não encontrada")
    update_data = data.model_dump(exclude_unset=True)
    if "status" in update_data and update_data["status"] == DemandStatus.DONE:
        demand.completed_at = datetime.now(timezone.utc)
    for field, value in update_data.items():
        setattr(demand, field, value)
    await db.commit()
    await db.refresh(demand)
    return await _enrich_demand(db, demand)


async def move_demand(
    db: AsyncSession, demand_id: int, data: DemandMove, user_id: int
) -> dict:
    result = await db.execute(select(Demand).where(Demand.id == demand_id))
    demand = result.scalar_one_or_none()
    if not demand:
        raise HTTPException(status_code=404, detail="Demanda não encontrada")

    old_col_name = None
    if demand.column_id:
        r = await db.execute(
            select(KanbanColumn.name).where(KanbanColumn.id == demand.column_id)
        )
        old_col_name = r.scalar_one_or_none()

    new_col = await db.execute(
        select(KanbanColumn).where(KanbanColumn.id == data.column_id)
    )
    new_column = new_col.scalar_one_or_none()
    if not new_column:
        raise HTTPException(status_code=404, detail="Coluna de destino não encontrada")

    demand.column_id = data.column_id
    demand.position = data.position

    if new_column.name == "Concluído":
        demand.status = DemandStatus.DONE
        demand.completed_at = datetime.now(timezone.utc)

    history = DemandHistory(
        demand_id=demand_id,
        from_column=old_col_name,
        to_column=new_column.name,
        changed_by_id=user_id,
    )
    db.add(history)
    await db.commit()
    await db.refresh(demand)
    return await _enrich_demand(db, demand)


async def get_demand_history(db: AsyncSession, demand_id: int) -> list[DemandHistory]:
    result = await db.execute(
        select(DemandHistory)
        .where(DemandHistory.demand_id == demand_id)
        .order_by(DemandHistory.created_at)
    )
    return list(result.scalars().all())


async def delete_demand(db: AsyncSession, demand_id: int) -> None:
    result = await db.execute(select(Demand).where(Demand.id == demand_id))
    demand = result.scalar_one_or_none()
    if not demand:
        raise HTTPException(status_code=404, detail="Demanda não encontrada")
    # Delete history first to avoid FK NOT NULL violation
    await db.execute(sa_delete(DemandHistory).where(DemandHistory.demand_id == demand_id))
    await db.flush()
    await db.delete(demand)
    await db.commit()


async def get_kanban_board(
    db: AsyncSession,
    client_id: int | None = None,
    assigned_to_id: int | None = None,
) -> dict:
    columns = await get_all_columns(db)

    query = select(Demand).order_by(Demand.position)
    if client_id:
        query = query.where(Demand.client_id == client_id)
    if assigned_to_id:
        query = query.where(Demand.assigned_to_id == assigned_to_id)
    result = await db.execute(query)
    demands = result.scalars().all()

    board: dict[str, list] = {}
    for col in columns:
        board[str(col["id"])] = []

    for demand in demands:
        enriched = await _enrich_demand(db, demand)
        col_key = str(demand.column_id) if demand.column_id else "unassigned"
        if col_key not in board:
            board[col_key] = []
        board[col_key].append(enriched)

    return {"columns": columns, "demands": board}
