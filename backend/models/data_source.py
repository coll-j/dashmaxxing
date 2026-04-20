from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, func
from .base import Base
from core.security.kms import encrypt_symmetric, decrypt_symmetric
import enum

class SourceType(str, enum.Enum):
    POSTGRES = "POSTGRES"
    GOOGLE_SHEETS = "GOOGLE_SHEETS"

class DataSource(Base):
    __tablename__ = "data_sources"

    id = Column(Integer, primary_key=True, index=True)
    org_id = Column(Integer, ForeignKey("orgs.id"), nullable=False)
    name = Column(String, nullable=False)
    source_type = Column(String, nullable=False) # "POSTGRES" or "GOOGLE_SHEETS"
    
    # Secure storage for connection details (DB credentials or OAuth tokens/Sheet IDs)
    _encrypted_config = Column("encrypted_config", String, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    @property
    def config(self) -> str:
        return decrypt_symmetric(self._encrypted_config)

    @config.setter
    def config(self, raw_config: str):
        self._encrypted_config = encrypt_symmetric(raw_config)
