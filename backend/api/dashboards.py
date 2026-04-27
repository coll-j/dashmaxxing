from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from core.db import get_db
from models.dashboard import Dashboard
from models.chart import Chart
from core.data.engine import ExecutionEngine
from typing import List, Dict, Any
from pydantic import BaseModel

router = APIRouter(prefix="/api/dashboards", tags=["dashboards"])

@router.get("/")
async def list_dashboards(db: AsyncSession = Depends(get_db)):
    """Return all dashboards as a JSON array."""
    stmt = select(Dashboard).order_by(Dashboard.created_at.desc())
    result = await db.execute(stmt)
    dashboards = result.scalars().all()
    return [
        {
            "id": d.id,
            "name": d.name,
            "slug": d.slug,
            "org_id": d.org_id,
            "created_at": d.created_at.isoformat() if d.created_at else None,
        }
        for d in dashboards
    ]

# NOTE: chart-specific sub-route must be declared BEFORE the
# generic /{dashboard_id} path so FastAPI doesn't try to parse
# "charts" as an integer dashboard_id.
@router.get("/charts/{chart_id}/data")
async def get_chart_data(chart_id: int, db: AsyncSession = Depends(get_db)):
    chart = await db.get(Chart, chart_id)
    if not chart:
        raise HTTPException(status_code=404, detail="Chart not found")

    from models.data_source import DataSource
    source = await db.get(DataSource, chart.source_id)
    if not source:
         raise HTTPException(status_code=404, detail="Data source not found")

    try:
        from core.data.engine import ExecutionEngine
        data = await ExecutionEngine.run_query(source, chart.sql_query)
        return {"data": data}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/{dashboard_id}")
async def get_dashboard(dashboard_id: int, db: AsyncSession = Depends(get_db)):
    # In a real app, we'd check org_id too
    dashboard = await db.get(Dashboard, dashboard_id)
    if not dashboard:
        raise HTTPException(status_code=404, detail="Dashboard not found")
    
    # Fetch charts
    stmt = select(Chart).where(Chart.dashboard_id == dashboard_id)
    result = await db.execute(stmt)
    charts = result.scalars().all()
    
    return {
        "id": dashboard.id,
        "name": dashboard.name,
        "slug": dashboard.slug,
        "charts": [
            {
                "id": c.id,
                "title": c.title,
                "type": c.type,
                "layout": c.layout,
                "sql_query": c.sql_query
            } for c in charts
        ]
    }



class LayoutUpdate(BaseModel):
    # Map of { "chart_id": { "x": 0, "y": 0, ... } }
    layouts: Dict[str, Any]

@router.patch("/{dashboard_id}/layout")
async def update_dashboard_layout(dashboard_id: int, update: LayoutUpdate, db: AsyncSession = Depends(get_db)):
    # 1. Verify dashboard exists
    dashboard = await db.get(Dashboard, dashboard_id)
    if not dashboard:
        raise HTTPException(status_code=404, detail="Dashboard not found")
        
    # 2. Update each chart
    for chart_id_str, new_layout in update.layouts.items():
        chart_id = int(chart_id_str)
        chart = await db.get(Chart, chart_id)
        if chart and chart.dashboard_id == dashboard_id:
            chart.layout = new_layout
            
    await db.commit()
    return {"status": "success"}
