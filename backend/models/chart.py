from sqlalchemy import Column, Integer, String, ForeignKey, DateTime, JSON
from sqlalchemy.orm import relationship
from models.base import Base
from datetime import datetime

class Chart(Base):
    __tablename__ = "charts"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, nullable=False)
    type = Column(String, nullable=False) # 'line', 'bar', 'pie'
    sql_query = Column(String, nullable=False)
    
    # JSON field to store x, y, w, h position for react-grid-layout
    layout = Column(JSON, nullable=False) # e.g. {"x": 0, "y": 0, "w": 6, "h": 4}
    
    # JSON field for extra Plotly or cosmetic config
    config = Column(JSON, nullable=True) 

    dashboard_id = Column(Integer, ForeignKey("dashboards.id"), nullable=False)
    source_id = Column(Integer, ForeignKey("data_sources.id"), nullable=False)
    
    created_at = Column(DateTime, default=datetime.utcnow)

    dashboard = relationship("Dashboard", back_populates="charts")
    source = relationship("DataSource")
