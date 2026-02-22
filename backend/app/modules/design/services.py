import os
import uuid
from datetime import datetime, timezone
from decimal import Decimal
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, delete as sa_delete
from fastapi import HTTPException, UploadFile

from app.modules.design.models import (
    DesignColumn, DesignDemand, DesignAttachment, DesignComment,
    DesignHistory, DesignPayment, DesignDemandType, DesignMemberRate,
)
from app.modules.design.schemas import (
    DesignColumnCreate, DesignColumnUpdate,
    DesignDemandCreate, DesignDemandUpdate, DesignDemandMove,
    DesignCommentCreate,
)
from app.modules.clients.models import Client
from app.modules.team.models import TeamMember
from app.modules.auth.models import User

UPLOAD_DIR = os.environ.get("UPLOAD_DIR", "/app/uploads/design")
MAX_FILE_SIZE = 50 * 1024 * 1024  # 50MB
ALLOWED_TYPES = {
    "image/png", "image/jpeg", "image/gif", "image/webp", "image/svg+xml",
    "video/mp4", "video/quicktime", "video/webm",
    "application/pdf",
}

DEFAULT_ARTE_VALUE = Decimal("10.00")
DEFAULT_VIDEO_VALUE = Decimal("20.00")


# ========== Columns ==========

async def seed_default_design_columns(db: AsyncSession) -> None:
    result = await db.execute(select(func.count(DesignColumn.id)))
    if result.scalar() > 0:
        return
    defaults = [
        DesignColumn(name="Demandas Diárias", order=0, color="#6B7280", is_default=True),
        DesignColumn(name="Para Aprovação", order=1, color="#F59E0B", is_default=True),
        DesignColumn(name="Produzir Story", order=2, color="#3B82F6", is_default=True),
        DesignColumn(name="Alteração", order=3, color="#EF4444", is_default=True),
        DesignColumn(name="Concluídos", order=4, color="#10B981", is_default=True),
    ]
    db.add_all(defaults)
    await db.commit()


async def create_column(db: AsyncSession, data: DesignColumnCreate) -> dict:
    column = DesignColumn(**data.model_dump())
    db.add(column)
    await db.commit()
    await db.refresh(column)
    return {
        **{c.key: getattr(column, c.key) for c in DesignColumn.__table__.columns},
        "demands_count": 0,
    }


async def get_all_columns(db: AsyncSession) -> list[dict]:
    result = await db.execute(select(DesignColumn).order_by(DesignColumn.order))
    columns = result.scalars().all()
    enriched = []
    for col in columns:
        count = await db.execute(
            select(func.count(DesignDemand.id)).where(DesignDemand.column_id == col.id)
        )
        enriched.append({
            **{c.key: getattr(col, c.key) for c in DesignColumn.__table__.columns},
            "demands_count": count.scalar() or 0,
        })
    return enriched


async def update_column(db: AsyncSession, column_id: int, data: DesignColumnUpdate) -> dict:
    result = await db.execute(select(DesignColumn).where(DesignColumn.id == column_id))
    column = result.scalar_one_or_none()
    if not column:
        raise HTTPException(status_code=404, detail="Coluna não encontrada")
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(column, field, value)
    await db.commit()
    await db.refresh(column)
    count = await db.execute(
        select(func.count(DesignDemand.id)).where(DesignDemand.column_id == column.id)
    )
    return {
        **{c.key: getattr(column, c.key) for c in DesignColumn.__table__.columns},
        "demands_count": count.scalar() or 0,
    }


async def delete_column(db: AsyncSession, column_id: int) -> None:
    result = await db.execute(select(DesignColumn).where(DesignColumn.id == column_id))
    column = result.scalar_one_or_none()
    if not column:
        raise HTTPException(status_code=404, detail="Coluna não encontrada")
    if column.is_default:
        raise HTTPException(status_code=400, detail="Não é possível excluir coluna padrão")
    await db.delete(column)
    await db.commit()


# ========== Demand Enrichment ==========

async def _enrich_demand(db: AsyncSession, demand: DesignDemand) -> dict:
    client_name = None
    assigned_name = None
    column_name = None
    if demand.client_id:
        r = await db.execute(select(Client.name).where(Client.id == demand.client_id))
        client_name = r.scalar_one_or_none()
    if demand.assigned_to_id:
        r = await db.execute(select(TeamMember.name).where(TeamMember.id == demand.assigned_to_id))
        assigned_name = r.scalar_one_or_none()
    if demand.column_id:
        r = await db.execute(select(DesignColumn.name).where(DesignColumn.id == demand.column_id))
        column_name = r.scalar_one_or_none()
    att_count = await db.execute(
        select(func.count(DesignAttachment.id)).where(DesignAttachment.demand_id == demand.id)
    )
    com_count = await db.execute(
        select(func.count(DesignComment.id)).where(DesignComment.demand_id == demand.id)
    )
    return {
        **{c.key: getattr(demand, c.key) for c in DesignDemand.__table__.columns},
        "column_name": column_name,
        "client_name": client_name,
        "assigned_to_name": assigned_name,
        "attachments_count": att_count.scalar() or 0,
        "comments_count": com_count.scalar() or 0,
    }


# ========== Demands CRUD ==========

async def create_demand(db: AsyncSession, data: DesignDemandCreate, user_id: int) -> dict:
    demand = DesignDemand(**data.model_dump(), created_by_id=user_id)
    if not demand.column_id:
        result = await db.execute(
            select(DesignColumn).where(DesignColumn.name == "Demandas Diárias").limit(1)
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
) -> list[dict]:
    query = select(DesignDemand).order_by(DesignDemand.position)
    if client_id:
        query = query.where(DesignDemand.client_id == client_id)
    if assigned_to_id:
        query = query.where(DesignDemand.assigned_to_id == assigned_to_id)
    result = await db.execute(query)
    demands = result.scalars().all()
    return [await _enrich_demand(db, d) for d in demands]


async def get_demand_by_id(db: AsyncSession, demand_id: int) -> dict:
    result = await db.execute(select(DesignDemand).where(DesignDemand.id == demand_id))
    demand = result.scalar_one_or_none()
    if not demand:
        raise HTTPException(status_code=404, detail="Demanda de design não encontrada")
    return await _enrich_demand(db, demand)


async def update_demand(db: AsyncSession, demand_id: int, data: DesignDemandUpdate) -> dict:
    result = await db.execute(select(DesignDemand).where(DesignDemand.id == demand_id))
    demand = result.scalar_one_or_none()
    if not demand:
        raise HTTPException(status_code=404, detail="Demanda de design não encontrada")
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(demand, field, value)
    await db.commit()
    await db.refresh(demand)
    return await _enrich_demand(db, demand)


async def move_demand(db: AsyncSession, demand_id: int, data: DesignDemandMove, user_id: int) -> dict:
    result = await db.execute(select(DesignDemand).where(DesignDemand.id == demand_id))
    demand = result.scalar_one_or_none()
    if not demand:
        raise HTTPException(status_code=404, detail="Demanda de design não encontrada")

    old_col_name = None
    if demand.column_id:
        r = await db.execute(select(DesignColumn.name).where(DesignColumn.id == demand.column_id))
        old_col_name = r.scalar_one_or_none()

    new_col = await db.execute(select(DesignColumn).where(DesignColumn.id == data.column_id))
    new_column = new_col.scalar_one_or_none()
    if not new_column:
        raise HTTPException(status_code=404, detail="Coluna de destino não encontrada")

    demand.column_id = data.column_id
    demand.position = data.position

    # Auto-complete when moved to Concluídos
    if "conclu" in new_column.name.lower():
        demand.completed_at = datetime.now(timezone.utc)

    history = DesignHistory(
        demand_id=demand_id,
        from_column=old_col_name,
        to_column=new_column.name,
        changed_by_id=user_id,
    )
    db.add(history)
    await db.commit()
    await db.refresh(demand)
    return await _enrich_demand(db, demand)


async def approve_demand(db: AsyncSession, demand_id: int, user_id: int) -> dict:
    """Approve a design demand and register payment."""
    result = await db.execute(select(DesignDemand).where(DesignDemand.id == demand_id))
    demand = result.scalar_one_or_none()
    if not demand:
        raise HTTPException(status_code=404, detail="Demanda de design não encontrada")
    if demand.payment_registered:
        raise HTTPException(status_code=400, detail="Pagamento já registrado para esta demanda")
    if not demand.assigned_to_id:
        raise HTTPException(status_code=400, detail="Demanda sem responsável atribuído")

    now = datetime.now(timezone.utc)
    demand_type_str = demand.demand_type.value if hasattr(demand.demand_type, 'value') else str(demand.demand_type)
    value = await _get_member_rate(db, demand.assigned_to_id, demand_type_str)

    demand.approved_at = now
    demand.completed_at = demand.completed_at or now
    demand.payment_value = value
    demand.payment_registered = True

    payment = DesignPayment(
        demand_id=demand.id,
        member_id=demand.assigned_to_id,
        client_id=demand.client_id,
        demand_type=demand_type_str,
        value=value,
        month=now.month,
        year=now.year,
    )
    db.add(payment)
    await db.commit()
    await db.refresh(demand)
    return await _enrich_demand(db, demand)


async def delete_demand(db: AsyncSession, demand_id: int) -> None:
    result = await db.execute(select(DesignDemand).where(DesignDemand.id == demand_id))
    demand = result.scalar_one_or_none()
    if not demand:
        raise HTTPException(status_code=404, detail="Demanda de design não encontrada")
    await db.execute(sa_delete(DesignHistory).where(DesignHistory.demand_id == demand_id))
    await db.execute(sa_delete(DesignPayment).where(DesignPayment.demand_id == demand_id))
    await db.flush()
    await db.delete(demand)
    await db.commit()


async def get_kanban_board(
    db: AsyncSession,
    client_id: int | None = None,
    assigned_to_id: int | None = None,
) -> dict:
    columns = await get_all_columns(db)
    query = select(DesignDemand).order_by(DesignDemand.position)
    if client_id:
        query = query.where(DesignDemand.client_id == client_id)
    if assigned_to_id:
        query = query.where(DesignDemand.assigned_to_id == assigned_to_id)
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


# ========== Comments ==========

async def get_comments(db: AsyncSession, demand_id: int) -> list[dict]:
    result = await db.execute(
        select(DesignComment)
        .where(DesignComment.demand_id == demand_id)
        .order_by(DesignComment.created_at)
    )
    comments = result.scalars().all()
    enriched = []
    for c in comments:
        user_name = None
        if c.user_id:
            r = await db.execute(select(User.name).where(User.id == c.user_id))
            user_name = r.scalar_one_or_none()
        enriched.append({
            **{col.key: getattr(c, col.key) for col in DesignComment.__table__.columns},
            "user_name": user_name,
        })
    return enriched


async def create_comment(
    db: AsyncSession, demand_id: int, data: DesignCommentCreate, user_id: int
) -> dict:
    comment = DesignComment(demand_id=demand_id, user_id=user_id, text=data.text)
    db.add(comment)
    await db.commit()
    await db.refresh(comment)
    r = await db.execute(select(User.name).where(User.id == user_id))
    user_name = r.scalar_one_or_none()
    return {
        **{col.key: getattr(comment, col.key) for col in DesignComment.__table__.columns},
        "user_name": user_name,
    }


# ========== History ==========

async def get_demand_history(db: AsyncSession, demand_id: int) -> list:
    result = await db.execute(
        select(DesignHistory)
        .where(DesignHistory.demand_id == demand_id)
        .order_by(DesignHistory.created_at)
    )
    return list(result.scalars().all())


# ========== Attachments ==========

async def upload_attachment(
    db: AsyncSession, demand_id: int, file: UploadFile, user_id: int
) -> dict:
    # Validate demand exists
    result = await db.execute(select(DesignDemand).where(DesignDemand.id == demand_id))
    demand = result.scalar_one_or_none()
    if not demand:
        raise HTTPException(status_code=404, detail="Demanda não encontrada")

    if file.content_type and file.content_type not in ALLOWED_TYPES:
        raise HTTPException(status_code=400, detail=f"Tipo de arquivo não permitido: {file.content_type}")

    content = await file.read()
    if len(content) > MAX_FILE_SIZE:
        raise HTTPException(status_code=400, detail="Arquivo excede 50MB")

    # Save to disk
    demand_dir = os.path.join(UPLOAD_DIR, str(demand_id))
    os.makedirs(demand_dir, exist_ok=True)

    ext = os.path.splitext(file.filename or "file")[1]
    safe_name = f"{uuid.uuid4().hex}{ext}"
    file_path = os.path.join(demand_dir, safe_name)

    with open(file_path, "wb") as f:
        f.write(content)

    attachment = DesignAttachment(
        demand_id=demand_id,
        filename=file.filename or safe_name,
        file_path=file_path,
        file_type=file.content_type,
        file_size=len(content),
        uploaded_by_id=user_id,
    )
    db.add(attachment)
    await db.commit()
    await db.refresh(attachment)
    return {c.key: getattr(attachment, c.key) for c in DesignAttachment.__table__.columns}


async def get_attachments(db: AsyncSession, demand_id: int) -> list[dict]:
    result = await db.execute(
        select(DesignAttachment)
        .where(DesignAttachment.demand_id == demand_id)
        .order_by(DesignAttachment.created_at)
    )
    return [
        {c.key: getattr(a, c.key) for c in DesignAttachment.__table__.columns}
        for a in result.scalars().all()
    ]


async def delete_attachment(db: AsyncSession, attachment_id: int) -> None:
    result = await db.execute(
        select(DesignAttachment).where(DesignAttachment.id == attachment_id)
    )
    attachment = result.scalar_one_or_none()
    if not attachment:
        raise HTTPException(status_code=404, detail="Anexo não encontrado")
    # Remove file from disk
    if os.path.exists(attachment.file_path):
        os.remove(attachment.file_path)
    await db.delete(attachment)
    await db.commit()


# ========== Payments ==========

async def get_payments(
    db: AsyncSession, month: int, year: int, member_id: int | None = None
) -> list[dict]:
    query = (
        select(DesignPayment)
        .where(DesignPayment.month == month, DesignPayment.year == year)
        .order_by(DesignPayment.created_at.desc())
    )
    if member_id:
        query = query.where(DesignPayment.member_id == member_id)
    result = await db.execute(query)
    payments = result.scalars().all()
    enriched = []
    for p in payments:
        member_name = None
        client_name = None
        demand_title = None
        r = await db.execute(select(TeamMember.name).where(TeamMember.id == p.member_id))
        member_name = r.scalar_one_or_none()
        if p.client_id:
            r = await db.execute(select(Client.name).where(Client.id == p.client_id))
            client_name = r.scalar_one_or_none()
        r = await db.execute(select(DesignDemand.title).where(DesignDemand.id == p.demand_id))
        demand_title = r.scalar_one_or_none()
        enriched.append({
            **{c.key: getattr(p, c.key) for c in DesignPayment.__table__.columns},
            "member_name": member_name,
            "client_name": client_name,
            "demand_title": demand_title,
        })
    return enriched


async def get_payment_summary(
    db: AsyncSession, month: int, year: int
) -> list[dict]:
    """Aggregate payments by member for a given month."""
    payments = await get_payments(db, month, year)

    # Load configured rates
    rates_result = await db.execute(select(DesignMemberRate))
    rates_map = {r.member_id: r for r in rates_result.scalars().all()}

    members: dict[int, dict] = {}
    for p in payments:
        mid = p["member_id"]
        if mid not in members:
            rate = rates_map.get(mid)
            members[mid] = {
                "member_id": mid,
                "member_name": p["member_name"],
                "total_artes": 0,
                "total_videos": 0,
                "total_value": Decimal("0"),
                "arte_rate": rate.arte_value if rate else DEFAULT_ARTE_VALUE,
                "video_rate": rate.video_value if rate else DEFAULT_VIDEO_VALUE,
                "payments": [],
            }
        if p["demand_type"] == "arte":
            members[mid]["total_artes"] += 1
        else:
            members[mid]["total_videos"] += 1
        members[mid]["total_value"] += p["value"]
        members[mid]["payments"].append(p)
    return list(members.values())


# ========== Member Rates ==========

async def _get_member_rate(db: AsyncSession, member_id: int, demand_type: str) -> Decimal:
    """Look up per-member rate, fall back to global defaults."""
    result = await db.execute(
        select(DesignMemberRate).where(DesignMemberRate.member_id == member_id)
    )
    rate = result.scalar_one_or_none()
    if rate:
        return rate.arte_value if demand_type == "arte" else rate.video_value
    return DEFAULT_ARTE_VALUE if demand_type == "arte" else DEFAULT_VIDEO_VALUE


async def get_all_rates(db: AsyncSession) -> list[dict]:
    """Return rates for all active team members."""
    result = await db.execute(
        select(TeamMember).where(TeamMember.status == "active").order_by(TeamMember.name)
    )
    members = result.scalars().all()
    rates_result = await db.execute(select(DesignMemberRate))
    rates_map = {r.member_id: r for r in rates_result.scalars().all()}
    output = []
    for m in members:
        rate = rates_map.get(m.id)
        output.append({
            "member_id": m.id,
            "member_name": m.name,
            "arte_value": rate.arte_value if rate else DEFAULT_ARTE_VALUE,
            "video_value": rate.video_value if rate else DEFAULT_VIDEO_VALUE,
        })
    return output


async def upsert_rate(
    db: AsyncSession, member_id: int, arte_value: Decimal, video_value: Decimal
) -> dict:
    """Create or update a member's design rate."""
    result = await db.execute(
        select(DesignMemberRate).where(DesignMemberRate.member_id == member_id)
    )
    rate = result.scalar_one_or_none()
    if rate:
        rate.arte_value = arte_value
        rate.video_value = video_value
    else:
        rate = DesignMemberRate(
            member_id=member_id,
            arte_value=arte_value,
            video_value=video_value,
        )
        db.add(rate)
    await db.commit()
    await db.refresh(rate)
    r = await db.execute(select(TeamMember.name).where(TeamMember.id == member_id))
    member_name = r.scalar_one_or_none() or "Desconhecido"
    return {
        "member_id": member_id,
        "member_name": member_name,
        "arte_value": rate.arte_value,
        "video_value": rate.video_value,
    }


# ========== Client Gallery ==========

async def get_client_gallery(
    db: AsyncSession, client_id: int
) -> list[dict]:
    """Get all approved design demands with attachments for a client."""
    result = await db.execute(
        select(DesignDemand)
        .where(
            DesignDemand.client_id == client_id,
            DesignDemand.payment_registered == True,
        )
        .order_by(DesignDemand.approved_at.desc())
    )
    demands = result.scalars().all()
    gallery = []
    for d in demands:
        atts = await get_attachments(db, d.id)
        if atts:
            gallery.append({
                "demand_id": d.id,
                "title": d.title,
                "demand_type": d.demand_type.value if hasattr(d.demand_type, 'value') else str(d.demand_type),
                "approved_at": d.approved_at,
                "attachments": atts,
            })
    return gallery
