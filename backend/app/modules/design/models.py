import enum
from datetime import datetime, timezone
from decimal import Decimal
from sqlalchemy import (
    String, Text, DateTime, Integer, Float, Boolean, Numeric,
    ForeignKey, Enum,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.core.database import Base


class DesignDemandType(str, enum.Enum):
    ARTE = "arte"
    VIDEO = "video"


class DesignColumn(Base):
    __tablename__ = "design_columns"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(255))
    order: Mapped[int] = mapped_column(Integer, default=0)
    color: Mapped[str] = mapped_column(String(7), default="#6B7280")
    is_default: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )

    demands = relationship("DesignDemand", back_populates="column")


class DesignDemand(Base):
    __tablename__ = "design_demands"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    title: Mapped[str] = mapped_column(String(500))
    description: Mapped[str] = mapped_column(Text, nullable=True)
    demand_type: Mapped[DesignDemandType] = mapped_column(
        Enum(DesignDemandType), default=DesignDemandType.ARTE
    )

    # Kanban
    column_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("design_columns.id"), nullable=True
    )
    position: Mapped[int] = mapped_column(Integer, default=0)

    # Relations
    client_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("clients.id"), nullable=True
    )
    assigned_to_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("team_members.id"), nullable=True
    )
    created_by_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id"), nullable=True
    )

    # SLA / Dates
    due_date: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    completed_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    approved_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    # Financial
    payment_value: Mapped[Decimal] = mapped_column(
        Numeric(10, 2), nullable=True
    )
    payment_registered: Mapped[bool] = mapped_column(Boolean, default=False)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    column = relationship("DesignColumn", back_populates="demands")
    client = relationship("Client")
    assigned_to = relationship("TeamMember")
    attachments = relationship(
        "DesignAttachment", back_populates="demand",
        cascade="all, delete-orphan", order_by="DesignAttachment.created_at",
    )
    comments = relationship(
        "DesignComment", cascade="all, delete-orphan",
        order_by="DesignComment.created_at",
    )
    history = relationship(
        "DesignHistory", back_populates="demand",
        order_by="DesignHistory.created_at",
    )


class DesignAttachment(Base):
    __tablename__ = "design_attachments"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    demand_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("design_demands.id", ondelete="CASCADE")
    )
    filename: Mapped[str] = mapped_column(String(500))
    file_path: Mapped[str] = mapped_column(String(1000))
    file_type: Mapped[str] = mapped_column(String(100), nullable=True)
    file_size: Mapped[int] = mapped_column(Integer, default=0)
    uploaded_by_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )

    demand = relationship("DesignDemand", back_populates="attachments")


class DesignComment(Base):
    __tablename__ = "design_comments"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    demand_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("design_demands.id", ondelete="CASCADE")
    )
    user_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    text: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )


class DesignHistory(Base):
    __tablename__ = "design_history"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    demand_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("design_demands.id")
    )
    from_column: Mapped[str] = mapped_column(String(255), nullable=True)
    to_column: Mapped[str] = mapped_column(String(255), nullable=True)
    changed_by_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id"), nullable=True
    )
    note: Mapped[str] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )

    demand = relationship("DesignDemand", back_populates="history")


class DesignPayment(Base):
    __tablename__ = "design_payments"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    demand_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("design_demands.id")
    )
    member_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("team_members.id")
    )
    client_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("clients.id"), nullable=True
    )
    demand_type: Mapped[str] = mapped_column(String(20))
    value: Mapped[Decimal] = mapped_column(Numeric(10, 2))
    month: Mapped[int] = mapped_column(Integer)
    year: Mapped[int] = mapped_column(Integer)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )


class DesignMemberRate(Base):
    __tablename__ = "design_member_rates"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    member_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("team_members.id", ondelete="CASCADE"), unique=True
    )
    arte_value: Mapped[Decimal] = mapped_column(
        Numeric(10, 2), default=Decimal("10.00")
    )
    video_value: Mapped[Decimal] = mapped_column(
        Numeric(10, 2), default=Decimal("20.00")
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )
