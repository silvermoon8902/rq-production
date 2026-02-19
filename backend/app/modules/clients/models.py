import enum
from datetime import datetime, date, timezone
from sqlalchemy import String, Text, Enum, DateTime, Date, Integer, ForeignKey, Numeric
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.core.database import Base


class ClientStatus(str, enum.Enum):
    ACTIVE = "active"
    INACTIVE = "inactive"
    ONBOARDING = "onboarding"
    CHURNED = "churned"


class Client(Base):
    __tablename__ = "clients"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    # Core identity
    name: Mapped[str] = mapped_column(String(255), index=True)         # Nome Fantasia
    company: Mapped[str] = mapped_column(String(255), nullable=True)   # Razao Social
    cnpj: Mapped[str] = mapped_column(String(20), nullable=True)
    responsible_name: Mapped[str] = mapped_column(String(255), nullable=True)
    # Contact
    phone: Mapped[str] = mapped_column(String(50), nullable=True)      # Celular Responsavel
    email: Mapped[str] = mapped_column(String(255), nullable=True)
    # Classification
    segment: Mapped[str] = mapped_column(String(100), nullable=True)   # Nicho
    status: Mapped[ClientStatus] = mapped_column(
        Enum(ClientStatus), default=ClientStatus.ACTIVE
    )
    # Digital presence
    instagram: Mapped[str] = mapped_column(String(255), nullable=True)
    website: Mapped[str] = mapped_column(String(500), nullable=True)
    # Notes
    notes: Mapped[str] = mapped_column(Text, nullable=True)
    # Contract dates
    start_date: Mapped[date] = mapped_column(Date, nullable=True)
    end_date: Mapped[date] = mapped_column(Date, nullable=True)
    # Financial (admin only)
    monthly_value: Mapped[float] = mapped_column(Numeric(10, 2), nullable=True)
    min_contract_months: Mapped[int] = mapped_column(Integer, nullable=True)
    operational_cost: Mapped[float] = mapped_column(Numeric(10, 2), nullable=True)
    # Meta
    created_by_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id"), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    allocations = relationship("TeamAllocation", back_populates="client")
    demands = relationship("Demand", back_populates="client")
