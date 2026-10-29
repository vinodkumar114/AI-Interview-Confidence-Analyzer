from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from database import engine, Base, get_db
import models, schemas
from routers import resume, interview, auth
import os
from dotenv import load_dotenv

load_dotenv()

# Create tables
Base.metadata.create_all(bind=engine)

app = FastAPI(title="AI-Powered Virtual HR Interview System")

origins = [
    "http://localhost:5173",
    "http://localhost:5174",
    "http://127.0.0.1:5173",
    "http://127.0.0.1:5174",
    "*"
]

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(resume.router)
app.include_router(interview.router)

@app.get("/")
def read_root():
    return {"message": "Welcome to AI-Powered Virtual HR Interview System API"}

# Health check for OpenCV / Mediapipe readiness
@app.get("/health")
def health_check():
    return {"status": "healthy", "opencv": "ready", "mediapipe": "ready"}