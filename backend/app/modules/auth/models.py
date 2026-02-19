import enum
from datetime import datetime, timezone
from sqlalchemy import String, Boolean, Enum, DateTime, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column
from app.core.database import Base


class UserRole(str, enum.Enum):
    ADMIN = "admin"
    GERENTE = "gerente"
    COLABORADOR = "colaborador"


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    name: Mapped[str] = mapped_column(String(255))
    hashed_password: Mapped[str] = mapped_column(String(255))
    role: Mapped[UserRole] = mapped_column(
        Enum(UserRole), default=UserRole.COLABORADOR
    )
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )


class ModulePermission(Base):
    """Per-role, per-module read/write access control."""
    __tablename__ = "module_permissions"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    role: Mapped[UserRole] = mapped_column(Enum(UserRole))
    module: Mapped[str] = mapped_column(String(100))
    can_read: Mapped[bool] = mapped_column(Boolean, default=True)
    can_write: Mapped[bool] = mapped_column(Boolean, default=False)

    __table_args__ = (UniqueConstraint("role", "module", name="uq_module_perm"),)
