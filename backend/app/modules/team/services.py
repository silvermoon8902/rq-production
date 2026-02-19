from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, delete as sa_delete
from sqlalchemy.orm import selectinload
from fastapi import HTTPException
from app.modules.team.models import Squad, TeamMember, TeamAllocation, MemberSquad
from app.modules.team.schemas import (
    SquadCreate, SquadUpdate,
    TeamMemberCreate, TeamMemberUpdate,
    AllocationCreate, AllocationUpdate,
)
from app.modules.clients.models import Client


# === Squad ===
async def create_squad(db: AsyncSession, data: SquadCreate) -> Squad:
    squad = Squad(**data.model_dump())
    db.add(squad)
    await db.commit()
    await db.refresh(squad)
    return squad


async def get_all_squads(db: AsyncSession) -> list[dict]:
    result = await db.execute(
        select(Squad).options(selectinload(Squad.members)).order_by(Squad.name)
    )
    squads = result.scalars().all()
    return [
        {
            **{c.key: getattr(s, c.key) for c in Squad.__table__.columns},
            "members_count": len(s.members),
        }
        for s in squads
    ]


async def get_squad_by_id(db: AsyncSession, squad_id: int) -> Squad:
    result = await db.execute(select(Squad).where(Squad.id == squad_id))
    squad = result.scalar_one_or_none()
    if not squad:
        raise HTTPException(status_code=404, detail="Squad não encontrado")
    return squad


async def update_squad(db: AsyncSession, squad_id: int, data: SquadUpdate) -> Squad:
    squad = await get_squad_by_id(db, squad_id)
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(squad, field, value)
    await db.commit()
    await db.refresh(squad)
    return squad


async def delete_squad(db: AsyncSession, squad_id: int) -> None:
    squad = await get_squad_by_id(db, squad_id)
    await db.delete(squad)
    await db.commit()


# === Team Member helpers ===
async def _get_squad_ids_for_member(db: AsyncSession, member_id: int) -> list[int]:
    result = await db.execute(
        select(MemberSquad.squad_id).where(MemberSquad.member_id == member_id)
    )
    return [row[0] for row in result.all()]


async def _save_squad_assignments(
    db: AsyncSession, member_id: int, squad_ids: list[int]
) -> None:
    """Replace all squad assignments for a member."""
    await db.execute(sa_delete(MemberSquad).where(MemberSquad.member_id == member_id))
    for squad_id in squad_ids:
        db.add(MemberSquad(member_id=member_id, squad_id=squad_id))
    await db.flush()


def _member_to_dict(member: TeamMember, squad_ids: list[int]) -> dict:
    d = {c.key: getattr(member, c.key) for c in TeamMember.__table__.columns}
    d["squad_ids"] = squad_ids
    return d


# === Team Member ===
async def create_member(db: AsyncSession, data: TeamMemberCreate) -> dict:
    squad_ids = data.squad_ids or []
    # Set primary squad_id to first selected squad
    primary_squad = squad_ids[0] if squad_ids else data.squad_id
    payload = data.model_dump(exclude={"squad_ids"})
    payload["squad_id"] = primary_squad
    member = TeamMember(**payload)
    db.add(member)
    await db.flush()
    # Use squad_ids if provided, else fall back to squad_id
    effective_ids = squad_ids if squad_ids else ([primary_squad] if primary_squad else [])
    await _save_squad_assignments(db, member.id, effective_ids)
    await db.commit()
    await db.refresh(member)
    return _member_to_dict(member, effective_ids)


async def get_all_members(
    db: AsyncSession,
    squad_id: int | None = None,
    status: str | None = None,
    current_user=None,
) -> list[dict]:
    from app.modules.auth.models import UserRole

    query = select(TeamMember).order_by(TeamMember.name)

    # Gerente: filter to own squad only
    if current_user and current_user.role == UserRole.GERENTE:
        my_member_res = await db.execute(
            select(TeamMember).where(TeamMember.user_id == current_user.id)
        )
        my_member = my_member_res.scalar_one_or_none()
        if my_member and my_member.squad_id:
            # Show all members who share any squad assignment with gerente's squad
            squad_member_ids = await db.execute(
                select(MemberSquad.member_id).where(
                    MemberSquad.squad_id == my_member.squad_id
                )
            )
            ids = [r[0] for r in squad_member_ids.all()]
            # Also include members with squad_id == gerente's squad (legacy)
            query = query.where(
                (TeamMember.squad_id == my_member.squad_id) |
                (TeamMember.id.in_(ids))
            )
        elif my_member:
            # No squad, only see themselves
            query = query.where(TeamMember.id == my_member.id)
        else:
            # User not linked to any member: return empty
            return []
    elif squad_id:
        query = query.where(TeamMember.squad_id == squad_id)

    if status:
        query = query.where(TeamMember.status == status)

    result = await db.execute(query)
    members = result.scalars().all()

    out = []
    for m in members:
        sids = await _get_squad_ids_for_member(db, m.id)
        out.append(_member_to_dict(m, sids))
    return out


async def get_member_by_id(db: AsyncSession, member_id: int) -> TeamMember:
    result = await db.execute(
        select(TeamMember)
        .where(TeamMember.id == member_id)
        .options(selectinload(TeamMember.allocations), selectinload(TeamMember.squad))
    )
    member = result.scalar_one_or_none()
    if not member:
        raise HTTPException(status_code=404, detail="Membro não encontrado")
    return member


async def get_member_detail(db: AsyncSession, member_id: int) -> dict:
    member = await get_member_by_id(db, member_id)
    sids = await _get_squad_ids_for_member(db, member_id)
    return {
        **_member_to_dict(member, sids),
        "squad_name": member.squad.name if member.squad else None,
        "allocations": member.allocations,
    }


async def update_member(
    db: AsyncSession, member_id: int, data: TeamMemberUpdate
) -> dict:
    member = await get_member_by_id(db, member_id)
    update_data = data.model_dump(exclude_unset=True)
    squad_ids = update_data.pop("squad_ids", None)

    # If squad_ids provided, update primary squad_id too
    if squad_ids is not None:
        primary = squad_ids[0] if squad_ids else None
        update_data["squad_id"] = primary
        await _save_squad_assignments(db, member_id, squad_ids)

    for field, value in update_data.items():
        setattr(member, field, value)
    await db.commit()
    await db.refresh(member)
    effective_sids = squad_ids if squad_ids is not None else await _get_squad_ids_for_member(db, member_id)
    return _member_to_dict(member, effective_sids)


async def delete_member(db: AsyncSession, member_id: int) -> None:
    member = await get_member_by_id(db, member_id)
    await db.delete(member)
    await db.commit()


# === Allocation ===
async def create_allocation(db: AsyncSession, data: AllocationCreate) -> dict:
    existing_member = await db.execute(
        select(TeamAllocation).where(
            TeamAllocation.member_id == data.member_id,
            TeamAllocation.client_id == data.client_id,
        )
    )
    if existing_member.scalar_one_or_none():
        raise HTTPException(
            status_code=400,
            detail="Este colaborador ja esta alocado neste cliente"
        )

    member_result = await db.execute(
        select(TeamMember).where(TeamMember.id == data.member_id)
    )
    member = member_result.scalar_one_or_none()
    if member and member.role_title:
        same_role_ids_result = await db.execute(
            select(TeamMember.id).where(TeamMember.role_title == member.role_title)
        )
        same_role_ids = [row[0] for row in same_role_ids_result.all()]
        existing_role = await db.execute(
            select(TeamAllocation).where(
                TeamAllocation.client_id == data.client_id,
                TeamAllocation.member_id.in_(same_role_ids),
            )
        )
        if existing_role.scalar_one_or_none():
            raise HTTPException(
                status_code=400,
                detail=f"Ja existe um '{member.role_title}' alocado neste cliente"
            )

    allocation = TeamAllocation(**data.model_dump())
    db.add(allocation)
    await db.commit()
    await db.refresh(allocation)
    return await _enrich_allocation(db, allocation)


async def get_allocations(
    db: AsyncSession,
    client_id: int | None = None,
    member_id: int | None = None,
) -> list[dict]:
    query = select(TeamAllocation)
    if client_id:
        query = query.where(TeamAllocation.client_id == client_id)
    if member_id:
        query = query.where(TeamAllocation.member_id == member_id)
    result = await db.execute(query)
    allocations = result.scalars().all()
    return [await _enrich_allocation(db, a) for a in allocations]


async def update_allocation(
    db: AsyncSession, allocation_id: int, data: AllocationUpdate
) -> dict:
    result = await db.execute(
        select(TeamAllocation).where(TeamAllocation.id == allocation_id)
    )
    allocation = result.scalar_one_or_none()
    if not allocation:
        raise HTTPException(status_code=404, detail="Alocação não encontrada")
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(allocation, field, value)
    await db.commit()
    await db.refresh(allocation)
    return await _enrich_allocation(db, allocation)


async def delete_allocation(db: AsyncSession, allocation_id: int) -> None:
    result = await db.execute(
        select(TeamAllocation).where(TeamAllocation.id == allocation_id)
    )
    allocation = result.scalar_one_or_none()
    if not allocation:
        raise HTTPException(status_code=404, detail="Alocação não encontrada")
    await db.delete(allocation)
    await db.commit()


async def _enrich_allocation(db: AsyncSession, allocation: TeamAllocation) -> dict:
    member = await db.execute(
        select(TeamMember).where(TeamMember.id == allocation.member_id)
    )
    client = await db.execute(
        select(Client).where(Client.id == allocation.client_id)
    )
    m = member.scalar_one_or_none()
    c = client.scalar_one_or_none()
    return {
        **{col.key: getattr(allocation, col.key) for col in TeamAllocation.__table__.columns},
        "member_name": m.name if m else "",
        "client_name": c.name if c else "",
    }
