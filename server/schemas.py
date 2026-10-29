from pydantic import BaseModel, EmailStr
from typing import Optional, List, Union, Dict, Any
from datetime import datetime

class UserCreate(BaseModel):
    name: str
    email: EmailStr
    password: str

class UserResponse(BaseModel):
    id: int
    name: str
    email: EmailStr
    
    class Config:
        orm_mode = True

class Token(BaseModel):
    access_token: str
    token_type: str
    user: UserResponse

class InterviewCreate(BaseModel):
    resume_id: Optional[int] = None
    company: str
    interview_type: str
    language: str
    difficulty: str

class InterviewResponse(BaseModel):
    id: int
    company: str
    interview_type: str
    status: str
    start_time: datetime
    
    class Config:
        orm_mode = True

class MetricCreate(BaseModel):
    interview_id: int
    eye_contact_pct: float
    fluency_score: float
    confidence_score: float
    emotion: str
    speaking_speed: float
    filler_words: int
    pauses: int

class InterviewRespondMetrics(BaseModel):
    eye_contact: Optional[float] = 88.0
    wpm: Optional[int] = 120
    fillers: Optional[int] = 0

class InterviewRespondRequest(BaseModel):
    candidate_id: Union[str, int]
    question_index: int
    current_question: str
    user_answer: str
    resume_skills: List[str] = []
    metrics: Optional[InterviewRespondMetrics] = None

class InterviewRespondResponse(BaseModel):
    acknowledgment: str
    next_question: str
    instant_feedback: str
    is_final_question: bool
    is_relevant: bool = True
    relevancy_status: str = "Relevant"  # "Relevant" or "Off-Topic"
    relevancy_reason: Optional[str] = None
    is_correct: bool = True


