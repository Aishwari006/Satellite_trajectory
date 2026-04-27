from sqlalchemy import Column, Integer, String, DateTime, Enum, Text
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import enum

from app.core.database import Base


class MissionTypeEnum(str, enum.Enum):
    moon = "moon"
    satellite = "satellite"


class MissionStatusEnum(str, enum.Enum):
    pending = "pending"
    processing = "processing"
    completed = "completed"
    failed = "failed"


class Mission(Base):
    __tablename__ = "missions"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    mission_type = Column(Enum(MissionTypeEnum), nullable=False)
    status = Column(Enum(MissionStatusEnum), default=MissionStatusEnum.pending, nullable=False)
    original_filename = Column(String(512), nullable=True)
    error_message = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Relationships
    trajectories = relationship("TrajectoryPoint", back_populates="mission", cascade="all, delete-orphan")

    def __repr__(self) -> str:
        return f"<Mission id={self.id} type={self.mission_type} status={self.status}>"