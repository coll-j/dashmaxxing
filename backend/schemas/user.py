from pydantic import BaseModel
from typing import Optional

class UserCreate(BaseModel):
    email: str
    name: str
    google_id: str

class UserResponse(BaseModel):
    id: int
    email: str
    name: str
    org_id: Optional[int]
    role: str

    model_config = {"from_attributes": True}
