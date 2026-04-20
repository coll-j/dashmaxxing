from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from core.db import get_db
from models.user import User
from schemas.user import UserCreate, UserResponse

router = APIRouter(prefix="/api/auth", tags=["auth"])

@router.post("/login", response_model=UserResponse)
async def login(user_data: UserCreate, db: AsyncSession = Depends(get_db)):
    # 1. Check if user exists by Google ID
    query = select(User).where(User.google_id == user_data.google_id)
    result = await db.execute(query)
    user = result.scalars().first()

    if not user:
        # Create new user
        user = User(
            email=user_data.email,
            name=user_data.name,
            google_id=user_data.google_id
        )
        db.add(user)
        await db.commit()
        await db.refresh(user)

    return user
