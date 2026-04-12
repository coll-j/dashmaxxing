from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, func
from sqlalchemy.orm import relationship
from .base import Base

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True, nullable=False)
    name = Column(String, nullable=False)
    google_id = Column(String, unique=True, nullable=False)
    org_id = Column(Integer, ForeignKey("orgs.id"), nullable=True)
    role = Column(String, default="Member") # "Admin" or "Member"
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    org = relationship("Org")
