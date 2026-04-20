from abc import ABC, abstractmethod
from typing import Dict, Any, List

class BaseConnector(ABC):
    def __init__(self, config: str):
        """Initialize the connector with a decrypted config JSON string."""
        import json
        self.config = json.loads(config)

    @abstractmethod
    async def test_connection(self) -> bool:
        """Returns True if connection is successful, raises Exception otherwise."""
        pass

    @abstractmethod
    async def get_schema(self) -> List[Dict[str, Any]]:
        """Returns a stable schema structure."""
        pass
