import enum
from datetime import datetime, timezone
from sqlalchemy import (
    String, Text, Enum, DateTime, Integer, ForeignKey, JSON
)
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.core.database import Base


class DemandPriority(str, enum.Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    URGENT = "urgent"


class DemandStatus(str, enum.Enum):
    BACKLOG = "backlog"
    TODO = "todo"
    IN_PROGRESS = "in_progress"
    IN_REVIEW = "in_review"
    DONE = "done"


class SLAStatus(str, enum.Enum):
    ON_TIME = "on_time"
    WARNING = "warning"
    OVERDUE = "overdue"


class KanbanColumn(Base):
    __tablename__ = "kanban_columns"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(255))
    order: Mapped[int] = mapped_column(Integer, default=0)
    color: Mapped[str] = mapped_column(String(7), default="#6B7280")
    is_default: Mapped[bool] = mapped_column(default=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )

    demands = relationship("Demand", back_populates="column")


class Demand(Base):
    __tablename__ = "demands"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    title: Mapped[str] = mapped_column(String(500))
    description: Mapped[str] = mapped_column(Text, nullable=True)
    priority: Mapped[DemandPriority] = mapped_column(
        Enum(DemandPriority), default=DemandPriority.MEDIUM
    )
    status: Mapped[DemandStatus] = mapped_column(
        Enum(DemandStatus), default=DemandStatus.TODO
    )
    demand_type: Mapped[str] = mapped_column(String(100), nullable=True)

    # Kanban
    column_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("kanban_columns.id"), nullable=True
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

    # SLA
    sla_hours: Mapped[int] = mapped_column(Integer, nullable=True)
    due_date: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    completed_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    column = relationship("KanbanColumn", back_populates="demands")
    client = relationship("Client", back_populates="demands")
    assigned_to = relationship("TeamMember")
    history = relationship(
        "DemandHistory", back_populates="demand", order_by="DemandHistory.created_at"
    )
    comments = relationship(
        "DemandComment", order_by="DemandComment.created_at", cascade="all, delete-orphan",
    )


class DemandHistory(Base):
    __tablename__ = "demand_history"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    demand_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("demands.id")
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

    demand = relationship("Demand", back_populates="history")


class DemandComment(Base):
    __tablename__ = "demand_comments"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    demand_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("demands.id", ondelete="CASCADE")
    )
    user_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    text: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
