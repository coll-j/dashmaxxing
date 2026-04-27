from typing import List, Dict, Any
from sqlalchemy.ext.asyncio import AsyncSession
from models.data_source import DataSource, SourceType
from core.data.connectors.postgres import PostgresConnector
import json

class ExecutionEngine:
    @staticmethod
    async def run_query(source: DataSource, query: str) -> List[Dict[str, Any]]:
        # Map source type to connector
        if source.source_type == SourceType.POSTGRES.value:
            connector = PostgresConnector(source.config)
            # Assuming the connector has a fetch_data method or similar
            # Let's add that to the PostgresConnector if it doesn't exist
            return await connector.fetch_data(query)
        elif source.source_type == SourceType.GOOGLE_SHEETS.value:
            # Sheets implementation would go here
            raise NotImplementedError("Google Sheets execution not yet implemented")
        else:
            raise ValueError(f"Unsupported source type: {source.source_type}")

async def get_chart_data(session: AsyncSession, source_id: int, query: str):
    source = await session.get(DataSource, source_id)
    if not source:
        raise ValueError("Data source not found")
    
    return await ExecutionEngine.run_query(source, query)
