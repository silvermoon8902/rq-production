import enum
from datetime import datetime, timezone
from sqlalchemy import String, Text, Enum, DateTime, Integer, ForeignKey, Float
from sqlalchemy.orm import Mapped, mapped_column
from app.core.database import Base


class MeetingType(str, enum.Enum):
    DAILY = "daily"
    ONE_A_ONE = "one_a_one"


class ClientMeeting(Base):
    __tablename__ = "client_meetings"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    meeting_type: Mapped[MeetingType] = mapped_column(Enum(MeetingType))
    client_id: Mapped[int] = mapped_column(Integer, ForeignKey("clients.id", ondelete="CASCADE"))
    squad_id: Mapped[int] = mapped_column(Integer, ForeignKey("squads.id", ondelete="SET NULL"), nullable=True)
    member_id: Mapped[int] = mapped_column(Integer, ForeignKey("team_members.id", ondelete="SET NULL"), nullable=True)
    health_score: Mapped[float] = mapped_column(Float, nullable=True)
    notes: Mapped[str] = mapped_column(Text, nullable=True)
    created_by_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
