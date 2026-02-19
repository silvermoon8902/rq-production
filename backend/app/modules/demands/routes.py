from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.core.database import get_db
from app.core.security import get_current_user, require_role
from app.modules.auth.models import User
from app.modules.demands import schemas, services
from app.modules.team.models import TeamMember

router = APIRouter(prefix="/demands", tags=["Demandas"])


async def _get_member_id_for_colaborador(db: AsyncSession, user: User) -> int | None:
    """For colaborador role, find their team member ID by user_id or email."""
    if user.role != "colaborador":
        return None
    result = await db.execute(
        select(TeamMember).where(TeamMember.user_id == user.id)
    )
    member = result.scalar_one_or_none()
    if not member:
        # Try matching by email as fallback
        result2 = await db.execute(
            select(TeamMember).where(TeamMember.email == user.email)
        )
        member = result2.scalar_one_or_none()
    return member.id if member else None


# === Kanban Columns ===
@router.post("/columns", response_model=schemas.KanbanColumnResponse, status_code=201)
async def create_column(
    data: schemas.KanbanColumnCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("admin")),
):
    return await services.create_column(db, data)


@router.get("/columns", response_model=list[schemas.KanbanColumnResponse])
async def list_columns(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return await services.get_all_columns(db)


@router.patch("/columns/{column_id}", response_model=schemas.KanbanColumnResponse)
async def update_column(
    column_id: int,
    data: schemas.KanbanColumnUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("admin")),
):
    return await services.update_column(db, column_id, data)


@router.delete("/columns/{column_id}", status_code=204)
async def delete_column(
    column_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("admin")),
):
    await services.delete_column(db, column_id)


# === Board ===
@router.get("/board", response_model=schemas.KanbanBoardResponse)
async def get_board(
    client_id: int | None = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # Colaborador only sees their own demands on the board
    member_id = await _get_member_id_for_colaborador(db, current_user)
    return await services.get_kanban_board(db, client_id, assigned_to_id=member_id)


# === Demands ===
@router.post("", response_model=schemas.DemandResponse, status_code=201)
async def create_demand(
    data: schemas.DemandCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return await services.create_demand(db, data, current_user.id)


@router.get("", response_model=list[schemas.DemandResponse])
async def list_demands(
    client_id: int | None = Query(None),
    assigned_to_id: int | None = Query(None),
    status: str | None = Query(None),
    priority: str | None = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # Colaborador only sees their own demands
    if current_user.role == "colaborador" and assigned_to_id is None:
        member_id = await _get_member_id_for_colaborador(db, current_user)
        if member_id:
            assigned_to_id = member_id
    return await services.get_all_demands(db, client_id, assigned_to_id, status, priority)


@router.get("/{demand_id}", response_model=schemas.DemandResponse)
async def get_demand(
    demand_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return await services.get_demand_by_id(db, demand_id)


@router.patch("/{demand_id}", response_model=schemas.DemandResponse)
async def update_demand(
    demand_id: int,
    data: schemas.DemandUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return await services.update_demand(db, demand_id, data)


@router.post("/{demand_id}/move", response_model=schemas.DemandResponse)
async def move_demand(
    demand_id: int,
    data: schemas.DemandMove,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return await services.move_demand(db, demand_id, data, current_user.id)


@router.get("/{demand_id}/history", response_model=list[schemas.DemandHistoryResponse])
async def get_demand_history(
    demand_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return await services.get_demand_history(db, demand_id)


@router.delete("/{demand_id}", status_code=204)
async def delete_demand(
    demand_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("admin", "gerente")),
):
    await services.delete_demand(db, demand_id)
