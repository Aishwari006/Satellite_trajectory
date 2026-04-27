from sqlalchemy import Column, Integer, Float, String, Boolean, ForeignKey, Index
from sqlalchemy.orm import relationship

from app.core.database import Base


class TrajectoryPoint(Base):
    __tablename__ = "trajectory_points"

    id = Column(Integer, primary_key=True, index=True)
    mission_id = Column(Integer, ForeignKey("missions.id", ondelete="CASCADE"), nullable=False, index=True)

    # Time
    time = Column(Float, nullable=False)

    # Body identifier (e.g. "Spacecraft", "Moon")
    body = Column(String(64), nullable=True)

    # Position
    x = Column(Float, nullable=False)
    y = Column(Float, nullable=False)
    z = Column(Float, nullable=False)

    # Velocity
    vx = Column(Float, nullable=True)
    vy = Column(Float, nullable=True)
    vz = Column(Float, nullable=True)

    # Acceleration
    ax = Column(Float, nullable=True)
    ay = Column(Float, nullable=True)
    az = Column(Float, nullable=True)

    # Derived / mission-specific metrics
    distance_from_earth = Column(Float, nullable=True)
    distance_from_moon = Column(Float, nullable=True)
    speed = Column(Float, nullable=True)

    # Phase / events
    mission_phase = Column(String(128), nullable=True)
    event_flag = Column(Boolean, nullable=True)

    # Relationship
    mission = relationship("Mission", back_populates="trajectories")

    __table_args__ = (
        Index("ix_traj_mission_time", "mission_id", "time"),
    )

    def __repr__(self) -> str:
        return f"<TrajectoryPoint mission={self.mission_id} t={self.time:.2f}>"