import enum
from datetime import datetime, date, timezone
from sqlalchemy import (
    String, Enum, DateTime, Date, Integer, ForeignKey, Numeric, Text
)
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.core.database import Base


class MemberStatus(str, enum.Enum):
    ACTIVE = "active"
    INACTIVE = "inactive"
    VACATION = "vacation"


class Squad(Base):
    __tablename__ = "squads"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(255), unique=True)
    description: Mapped[str] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )

    members = relationship("TeamMember", back_populates="squad")


class MemberSquad(Base):
    """Junction table: member ↔ squad many-to-many."""
    __tablename__ = "member_squads"

    member_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("team_members.id", ondelete="CASCADE"), primary_key=True
    )
    squad_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("squads.id", ondelete="CASCADE"), primary_key=True
    )


class TeamMember(Base):
    __tablename__ = "team_members"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id"), nullable=True
    )
    name: Mapped[str] = mapped_column(String(255))
    role_title: Mapped[str] = mapped_column(String(255))
    squad_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("squads.id"), nullable=True
    )
    status: Mapped[MemberStatus] = mapped_column(
        Enum(MemberStatus), default=MemberStatus.ACTIVE
    )
    email: Mapped[str] = mapped_column(String(255), nullable=True)
    phone: Mapped[str] = mapped_column(String(50), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    squad = relationship("Squad", back_populates="members")
    allocations = relationship("TeamAllocation", back_populates="member")
    squad_assignments = relationship(
        "MemberSquad", cascade="all, delete-orphan",
        primaryjoin="TeamMember.id == foreign(MemberSquad.member_id)",
    )


class TeamAllocation(Base):
    __tablename__ = "team_allocations"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    member_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("team_members.id")
    )
    client_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("clients.id")
    )
    monthly_value: Mapped[float] = mapped_column(
        Numeric(10, 2), default=0
    )
    start_date: Mapped[date] = mapped_column(Date)
    end_date: Mapped[date] = mapped_column(Date, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )

    member = relationship("TeamMember", back_populates="allocations")
    client = relationship("Client", back_populates="allocations")
