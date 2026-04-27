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

class OrgJoin(BaseModel):
    user_id: int
    org_id: int

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

@router.post("/join")
async def join_org(join_data: OrgJoin, db: AsyncSession = Depends(get_db)):
    org = await db.get(Org, join_data.org_id)
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")
        
    user = await db.get(User, join_data.user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
        
    user.org_id = org.id
    user.role = "Member"
    await db.commit()
    
    return {"status": "success", "org": {"id": org.id, "name": org.name}}
