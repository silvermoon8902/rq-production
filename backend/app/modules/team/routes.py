from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.core.security import get_current_user, require_role
from app.modules.auth.models import User
from app.modules.team import schemas, services

router = APIRouter(prefix="/team", tags=["Equipe"])


# === Squads ===
@router.post("/squads", response_model=schemas.SquadResponse, status_code=201)
async def create_squad(
    data: schemas.SquadCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("admin", "gerente")),
):
    return await services.create_squad(db, data)


@router.get("/squads", response_model=list[schemas.SquadResponse])
async def list_squads(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return await services.get_all_squads(db)


@router.patch("/squads/{squad_id}", response_model=schemas.SquadResponse)
async def update_squad(
    squad_id: int,
    data: schemas.SquadUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("admin", "gerente")),
):
    return await services.update_squad(db, squad_id, data)


@router.delete("/squads/{squad_id}", status_code=204)
async def delete_squad(
    squad_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("admin")),
):
    await services.delete_squad(db, squad_id)


# === Members ===
@router.post("/members", response_model=schemas.TeamMemberResponse, status_code=201)
async def create_member(
    data: schemas.TeamMemberCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("admin", "gerente")),
):
    return await services.create_member(db, data)


@router.get("/members", response_model=list[schemas.TeamMemberResponse])
async def list_members(
    squad_id: int | None = Query(None),
    status: str | None = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return await services.get_all_members(db, squad_id, status, current_user)


@router.get("/members/{member_id}", response_model=schemas.TeamMemberDetail)
async def get_member(
    member_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return await services.get_member_detail(db, member_id)


@router.patch("/members/{member_id}", response_model=schemas.TeamMemberResponse)
async def update_member(
    member_id: int,
    data: schemas.TeamMemberUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("admin", "gerente")),
):
    return await services.update_member(db, member_id, data)


@router.delete("/members/{member_id}", status_code=204)
async def delete_member(
    member_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("admin")),
):
    await services.delete_member(db, member_id)


# === Allocations ===
@router.post("/allocations", response_model=schemas.AllocationResponse, status_code=201)
async def create_allocation(
    data: schemas.AllocationCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("admin", "gerente")),
):
    return await services.create_allocation(db, data)


@router.get("/allocations", response_model=list[schemas.AllocationResponse])
async def list_allocations(
    client_id: int | None = Query(None),
    member_id: int | None = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return await services.get_allocations(db, client_id, member_id)


@router.patch("/allocations/{allocation_id}", response_model=schemas.AllocationResponse)
async def update_allocation(
    allocation_id: int,
    data: schemas.AllocationUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("admin", "gerente")),
):
    return await services.update_allocation(db, allocation_id, data)


@router.delete("/allocations/{allocation_id}", status_code=204)
async def delete_allocation(
    allocation_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("admin")),
):
    await services.delete_allocation(db, allocation_id)
