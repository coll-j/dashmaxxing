from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from api import auth, orgs, sources, ai
from core.db import engine
from models.base import Base

app = FastAPI(title="Dashmaxxing API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(orgs.router)
app.include_router(sources.router)
app.include_router(ai.router)

@app.on_event("startup")
async def startup():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

@app.get("/health")
async def health_check():
    return {"status": "ok"}
