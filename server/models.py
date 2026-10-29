from sqlalchemy import Column, Integer, String, Float, Text, Boolean, ForeignKey, DateTime
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from database import Base

class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100))
    email = Column(String(100), unique=True, index=True)
    password_hash = Column(String(200))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    resumes = relationship("Resume", back_populates="owner")
    interviews = relationship("Interview", back_populates="candidate")

class Resume(Base):
    __tablename__ = "resumes"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    file_name = Column(String(255))
    file_path = Column(String(255))
    extracted_text = Column(Text)
    parsed_summary = Column(Text) # JSON string of skills, education, etc.
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    owner = relationship("User", back_populates="resumes")
    interviews = relationship("Interview", back_populates="resume")

class Interview(Base):
    __tablename__ = "interviews"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    resume_id = Column(Integer, ForeignKey("resumes.id"), nullable=True)
    company = Column(String(100))
    interview_type = Column(String(100))
    language = Column(String(50))
    difficulty = Column(String(50))
    status = Column(String(50), default="Pending") # Pending, InProgress, Completed
    start_time = Column(DateTime(timezone=True), server_default=func.now())
    end_time = Column(DateTime(timezone=True), nullable=True)
    
    candidate = relationship("User", back_populates="interviews")
    resume = relationship("Resume", back_populates="interviews")
    qnas = relationship("QuestionAnswer", back_populates="interview")
    metrics = relationship("LiveMetric", back_populates="interview")
    report = relationship("Report", back_populates="interview", uselist=False)

class QuestionAnswer(Base):
    __tablename__ = "question_answers"
    id = Column(Integer, primary_key=True, index=True)
    interview_id = Column(Integer, ForeignKey("interviews.id"))
    question_number = Column(Integer)
    question_text = Column(Text)
    answer_text = Column(Text, nullable=True)
    timestamp = Column(DateTime(timezone=True), server_default=func.now())
    
    interview = relationship("Interview", back_populates="qnas")

class LiveMetric(Base):
    __tablename__ = "live_metrics"
    id = Column(Integer, primary_key=True, index=True)
    interview_id = Column(Integer, ForeignKey("interviews.id"))
    timestamp = Column(DateTime(timezone=True), server_default=func.now())
    eye_contact_pct = Column(Float, default=0)
    fluency_score = Column(Float, default=0)
    confidence_score = Column(Float, default=0)
    emotion = Column(String(50), default="Neutral")
    speaking_speed = Column(Float, default=0) # wpm
    filler_words = Column(Integer, default=0)
    pauses = Column(Integer, default=0)
    
    interview = relationship("Interview", back_populates="metrics")

class Report(Base):
    __tablename__ = "reports"
    id = Column(Integer, primary_key=True, index=True)
    interview_id = Column(Integer, ForeignKey("interviews.id"))
    overall_score = Column(Float, default=0)
    strengths = Column(Text)
    weaknesses = Column(Text)
    suggestions = Column(Text)
    shortlist_status = Column(String(100))
    pdf_path = Column(String(255))
    
    interview = relationship("Interview", back_populates="report")
