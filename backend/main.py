from fastapi import FastAPI
from .api import auth, orgs
from .core.db import engine
from .models.base import Base

app = FastAPI(title="Dashmaxxing API")

app.include_router(auth.router)
app.include_router(orgs.router)

@app.on_event("startup")
async def startup():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

@app.get("/health")
async def health_check():
    return {"status": "ok"}
