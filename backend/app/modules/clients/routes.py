from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.core.security import get_current_user, require_role
from app.modules.auth.models import User
from app.modules.clients import schemas, services

router = APIRouter(prefix="/clients", tags=["Clientes"])


@router.post("/", response_model=schemas.ClientResponse, status_code=201)
async def create_client(
    data: schemas.ClientCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("admin", "gerente")),
):
    return await services.create_client(db, data, current_user.id)


@router.get("/", response_model=list[schemas.ClientResponse])
async def list_clients(
    status: str | None = Query(None),
    segment: str | None = Query(None),
    search: str | None = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return await services.get_all_clients(db, status, segment, search)


@router.get("/{client_id}", response_model=schemas.ClientDetail)
async def get_client(
    client_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return await services.get_client_detail(db, client_id)


@router.patch("/{client_id}", response_model=schemas.ClientResponse)
async def update_client(
    client_id: int,
    data: schemas.ClientUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("admin", "gerente")),
):
    return await services.update_client(db, client_id, data)


@router.delete("/{client_id}", status_code=204)
async def delete_client(
    client_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("admin")),
):
    await services.delete_client(db, client_id)
