from .base import BaseConnector
import asyncpg
from typing import Dict, Any, List

class PostgresConnector(BaseConnector):
    async def _get_conn(self) -> asyncpg.Connection:
        # Expects: {"host": "...", "port": 5432, "user": "...", "password": "...", "database": "..."}
        return await asyncpg.connect(
            host=self.config.get("host"),
            port=int(self.config.get("port", 5432)),
            user=self.config.get("user"),
            password=self.config.get("password"),
            database=self.config.get("database"),
            timeout=5.0
        )

    async def test_connection(self) -> bool:
        conn = await self._get_conn()
        try:
            await conn.execute("SELECT 1")
            return True
        finally:
            await conn.close()

    async def get_schema(self) -> List[Dict[str, Any]]:
        conn = await self._get_conn()
        try:
            query = """
                SELECT table_name, column_name, data_type 
                FROM information_schema.columns 
                WHERE table_schema = 'public'
                ORDER BY table_name, ordinal_position;
            """
            rows = await conn.fetch(query)
            
            schema_map = {}
            for row in rows:
                t_name = row['table_name']
                if t_name not in schema_map:
                    schema_map[t_name] = {"table_name": t_name, "columns": []}
                schema_map[t_name]["columns"].append({
                    "name": row['column_name'],
                    "type": row['data_type']
                })
                
            return list(schema_map.values())
        finally:
            await conn.close()
