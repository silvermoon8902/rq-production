import os
from fastapi import APIRouter, Depends, Query, UploadFile, File
from fastapi.responses import FileResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.core.database import get_db
from app.core.security import get_current_user, require_role
from app.modules.auth.models import User
from app.modules.design import schemas, services
from app.modules.team.models import TeamMember

router = APIRouter(prefix="/design", tags=["Design"])


async def _get_member_id_for_colaborador(db: AsyncSession, user: User) -> int | None:
    if user.role.value not in ("admin", "gerente"):
        result = await db.execute(select(TeamMember).where(TeamMember.user_id == user.id))
        member = result.scalar_one_or_none()
        if not member:
            result2 = await db.execute(select(TeamMember).where(TeamMember.email == user.email))
            member = result2.scalar_one_or_none()
        return member.id if member else None
    return None


# === Columns ===
@router.post("/columns", response_model=schemas.DesignColumnResponse, status_code=201)
async def create_column(
    data: schemas.DesignColumnCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("admin")),
):
    return await services.create_column(db, data)


@router.get("/columns", response_model=list[schemas.DesignColumnResponse])
async def list_columns(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return await services.get_all_columns(db)


@router.patch("/columns/{column_id}", response_model=schemas.DesignColumnResponse)
async def update_column(
    column_id: int,
    data: schemas.DesignColumnUpdate,
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
@router.get("/board", response_model=schemas.DesignBoardResponse)
async def get_board(
    client_id: int | None = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    member_id = await _get_member_id_for_colaborador(db, current_user)
    return await services.get_kanban_board(db, client_id, assigned_to_id=member_id)


# === Demands CRUD ===
@router.post("/demands", response_model=schemas.DesignDemandResponse, status_code=201)
async def create_demand(
    data: schemas.DesignDemandCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return await services.create_demand(db, data, current_user.id)


@router.get("/demands", response_model=list[schemas.DesignDemandResponse])
async def list_demands(
    client_id: int | None = Query(None),
    assigned_to_id: int | None = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return await services.get_all_demands(db, client_id, assigned_to_id)


@router.get("/demands/{demand_id}", response_model=schemas.DesignDemandResponse)
async def get_demand(
    demand_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return await services.get_demand_by_id(db, demand_id)


@router.patch("/demands/{demand_id}", response_model=schemas.DesignDemandResponse)
async def update_demand(
    demand_id: int,
    data: schemas.DesignDemandUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return await services.update_demand(db, demand_id, data)


@router.post("/demands/{demand_id}/move", response_model=schemas.DesignDemandResponse)
async def move_demand(
    demand_id: int,
    data: schemas.DesignDemandMove,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return await services.move_demand(db, demand_id, data, current_user.id)


@router.post("/demands/{demand_id}/approve", response_model=schemas.DesignDemandResponse)
async def approve_demand(
    demand_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("admin", "gerente")),
):
    return await services.approve_demand(db, demand_id, current_user.id)


@router.delete("/demands/{demand_id}", status_code=204)
async def delete_demand(
    demand_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("admin", "gerente")),
):
    await services.delete_demand(db, demand_id)


# === Comments ===
@router.get("/demands/{demand_id}/comments", response_model=list[schemas.DesignCommentResponse])
async def list_comments(
    demand_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return await services.get_comments(db, demand_id)


@router.post("/demands/{demand_id}/comments", response_model=schemas.DesignCommentResponse, status_code=201)
async def add_comment(
    demand_id: int,
    data: schemas.DesignCommentCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return await services.create_comment(db, demand_id, data, current_user.id)


# === Attachments ===
@router.post("/demands/{demand_id}/attachments", response_model=schemas.DesignAttachmentResponse, status_code=201)
async def upload_attachment(
    demand_id: int,
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return await services.upload_attachment(db, demand_id, file, current_user.id)


@router.get("/demands/{demand_id}/attachments", response_model=list[schemas.DesignAttachmentResponse])
async def list_attachments(
    demand_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return await services.get_attachments(db, demand_id)


@router.delete("/attachments/{attachment_id}", status_code=204)
async def delete_attachment(
    attachment_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("admin", "gerente")),
):
    await services.delete_attachment(db, attachment_id)


@router.get("/attachments/{attachment_id}/file")
async def download_attachment(
    attachment_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    from app.modules.design.models import DesignAttachment
    result = await db.execute(
        select(DesignAttachment).where(DesignAttachment.id == attachment_id)
    )
    att = result.scalar_one_or_none()
    if not att or not os.path.exists(att.file_path):
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Arquivo não encontrado")
    return FileResponse(
        att.file_path,
        filename=att.filename,
        media_type=att.file_type or "application/octet-stream",
    )


# === History ===
@router.get("/demands/{demand_id}/history", response_model=list[schemas.DesignHistoryResponse])
async def get_demand_history(
    demand_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return await services.get_demand_history(db, demand_id)


# === Payments ===
@router.get("/payments", response_model=list[schemas.DesignPaymentResponse])
async def list_payments(
    month: int = Query(...),
    year: int = Query(...),
    member_id: int | None = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return await services.get_payments(db, month, year, member_id)


@router.get("/payments/summary", response_model=list[schemas.DesignPaymentSummary])
async def payment_summary(
    month: int = Query(...),
    year: int = Query(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return await services.get_payment_summary(db, month, year)


# === Client Gallery ===
@router.get("/gallery/{client_id}")
async def client_gallery(
    client_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return await services.get_client_gallery(db, client_id)
