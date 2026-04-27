from sqlalchemy import Column, Integer, String, ForeignKey, DateTime
from sqlalchemy.orm import relationship
from models.base import Base
from datetime import datetime

class Dashboard(Base):
    __tablename__ = "dashboards"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    slug = Column(String, nullable=False, unique=True) # e.g. "sales-overview-x1y2"
    org_id = Column(Integer, ForeignKey("orgs.id"), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    org = relationship("Org", back_populates="dashboards")
    charts = relationship("Chart", back_populates="dashboard", cascade="all, delete-orphan")
