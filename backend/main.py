"""FastAPI application entry point for DiabetesConnect backend."""
import os
from contextlib import asynccontextmanager
from dotenv import load_dotenv

load_dotenv()

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from api.routes import patient, doctor, chat
from database.db import init_db
from database.seed_data import seed_all


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Initialise database and seed on startup."""
    await init_db()
    await seed_all()
    yield


app = FastAPI(
    title="DiabetesConnect API",
    description="AI-powered diabetes management platform",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS middleware
origins = os.getenv("CORS_ORIGINS", "http://localhost:5173,http://localhost:3000").split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(chat.router, prefix="/api", tags=["chat"])
app.include_router(patient.router, prefix="/api", tags=["patient"])
app.include_router(doctor.router, prefix="/api", tags=["doctor"])


@app.get("/health")
def health_check():
    """Health check endpoint."""
    return {"status": "healthy", "app": "DiabetesConnect"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)

