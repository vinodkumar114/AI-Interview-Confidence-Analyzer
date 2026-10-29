from fastapi import APIRouter, UploadFile, File, HTTPException
import os
import uuid
import PyPDF2
from typing import Dict, Any

router = APIRouter(prefix="/api/resume", tags=["resume"])

# In a real scenario, this would use google-generativeai
def extract_resume_info(text: str) -> Dict[str, Any]:
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key or api_key == "placeholder":
        # Mock Response
        return {
            "skills": ["Python", "React", "Machine Learning"],
            "education": "B.Tech in Computer Science",
            "experience": "2 years as Software Engineer",
            "projects": ["AI Chatbot", "E-commerce Website"]
        }
    
    # Real Gemini integration goes here
    # model = genai.GenerativeModel("gemini-1.5-pro")
    # response = model.generate_content(f"Extract skills, education, and projects as JSON: {text}")
    return {"status": "success"}

@router.post("/upload")
async def upload_resume(file: UploadFile = File(...)):
    if not file.filename.endswith(('.pdf', '.docx')):
        raise HTTPException(status_code=400, detail="Invalid file type")
    
    file_id = str(uuid.uuid4())
    file_path = f"./uploads/{file_id}_{file.filename}"
    
    os.makedirs("./uploads", exist_ok=True)
    
    with open(file_path, "wb") as f:
        f.write(await file.read())
        
    text = ""
    if file.filename.endswith(".pdf"):
        with open(file_path, "rb") as f:
            reader = PyPDF2.PdfReader(f)
            for page in reader.pages:
                text += page.extract_text()
                
    summary = extract_resume_info(text)
    
    return {
        "message": "Resume uploaded successfully",
        "file_path": file_path,
        "summary": summary
    }
