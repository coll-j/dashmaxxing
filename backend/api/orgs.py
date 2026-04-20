from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from core.db import get_db
from models.org import Org
from models.user import User
from pydantic import BaseModel
import re

router = APIRouter(prefix="/api/orgs", tags=["orgs"])

class OrgCreate(BaseModel):
    name: str
    user_id: int 

@router.post("/")
async def create_org(org_data: OrgCreate, db: AsyncSession = Depends(get_db)):
    # Generate URL-safe slug
    slug = re.sub(r'[^a-z0-9]+', '-', org_data.name.lower()).strip('-')
    
    org = Org(name=org_data.name, slug=slug)
    db.add(org)
    await db.commit()
    await db.refresh(org)

    # Assign user to org as Admin
    user = await db.get(User, org_data.user_id)
    if user:
        user.org_id = org.id
        user.role = "Admin"
        await db.commit()

    return org
