from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from core.db import get_db
from models.data_source import DataSource, SourceType
from core.data.connectors.postgres import PostgresConnector
import json

router = APIRouter(prefix="/api/orgs/{org_id}/sources", tags=["sources"])

@router.post("/")
async def add_data_source(org_id: int, name: str, source_type: SourceType, raw_config: dict, db: AsyncSession = Depends(get_db)):
    config_str = json.dumps(raw_config)
    
    # Test connection before saving
    try:
        if source_type == SourceType.POSTGRES:
            connector = PostgresConnector(config_str)
            await connector.test_connection()
        elif source_type == SourceType.GOOGLE_SHEETS:
            # Standalone API flow will handle sheets via OAuth
            pass
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Connection failed: {str(e)}")

    source = DataSource(org_id=org_id, name=name, source_type=source_type.value)
    source.config = config_str
    
    db.add(source)
    await db.commit()
    await db.refresh(source)
    
    return {"id": source.id, "name": source.name, "status": "Connected"}

@router.get("/{source_id}/schema")
async def get_source_schema(org_id: int, source_id: int, db: AsyncSession = Depends(get_db)):
    source = await db.get(DataSource, source_id)
    if not source or source.org_id != org_id:
        raise HTTPException(status_code=404, detail="Source not found")
        
    try:
        if source.source_type == SourceType.POSTGRES.value:
            connector = PostgresConnector(source.config)
            schema = await connector.get_schema()
            return {"schema": schema}
        else:
            return {"schema": [], "message": "Google Sheets schema extraction coming soon"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch schema: {str(e)}")
