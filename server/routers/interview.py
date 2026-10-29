from fastapi import APIRouter, Depends, HTTPException, Body
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from database import get_db
import schemas, models
from services.report_service import generate_pdf_report, get_ideal_answer
from services.email_service import send_interview_report, send_interview_report_email
from datetime import datetime
import os
import json

router = APIRouter(prefix="/api/interview", tags=["interview"])

@router.post("/start", response_model=schemas.InterviewResponse)
def start_interview(interview: schemas.InterviewCreate, db: Session = Depends(get_db)):
    db_interview = models.Interview(
        company=interview.company,
        interview_type=interview.interview_type,
        language=interview.language,
        difficulty=interview.difficulty,
        status="InProgress"
    )
    db.add(db_interview)
    db.commit()
    db.refresh(db_interview)
    return db_interview

@router.post("/metric")
def save_live_metric(metric: schemas.MetricCreate, db: Session = Depends(get_db)):
    db_metric = models.LiveMetric(**metric.dict())
    db.add(db_metric)
    db.commit()
    return {"status": "success"}

@router.post("/question")
def get_next_question(interview_id: int, answer: str = ""):
    return {
        "question": "Can you provide an example of a difficult problem you solved in your previous project?"
    }

@router.post("/respond", response_model=schemas.InterviewRespondResponse)
def evaluate_interview_response(req: schemas.InterviewRespondRequest):
    """
    LLM Interview Evaluation & Dynamic Question Generator endpoint.
    Foundational focus:
    - Generates clear, direct, and foundational technical questions based on resume skills.
    - Strictly keeps each question to exactly ONE clear sentence.
    - Examples:
      * "What is JavaScript, and why do we use it?"
      * "Can you explain what React is and why we use components?"
      * "What is the difference between state and props in React?"
      * "What are Python data types and how do you use lists versus dictionaries?"
    """
    skills = req.resume_skills or ["JavaScript", "React.js", "Python"]
    skills_str = ", ".join(skills)
    primary_skill = skills[0] if skills else "JavaScript"
    secondary_skill = skills[1] if len(skills) > 1 else "React.js"
    
    q_idx = req.question_index
    is_final = q_idx >= 3

    # Extract delivery metrics
    eye_contact = req.metrics.eye_contact if req.metrics and req.metrics.eye_contact is not None else 85.0
    wpm = req.metrics.wpm if req.metrics and req.metrics.wpm is not None else 120
    fillers = req.metrics.fillers if req.metrics and req.metrics.fillers is not None else 0

    # 1. Try Gemini LLM integration if API key is present
    gemini_key = os.getenv("GEMINI_API_KEY")
    if gemini_key:
        try:
            import google.generativeai as genai
            genai.configure(api_key=gemini_key)
            model = genai.GenerativeModel('gemini-1.5-flash')
            
            prompt = f"""
You are an expert AI HR Technical Interviewer conducting a mock interview.
Candidate Resume Skills: {skills_str}
Current Question Index: {q_idx} of 4
Current Question: "{req.current_question}"
Candidate Answer: "{req.user_answer}"
Metrics: Eye Contact: {eye_contact}%, WPM: {wpm}, Fillers: {fillers}

QUESTION GENERATION RULES (CRITICAL):
1. Instead of long multi-clause questions, generate clear, direct, and foundational technical questions based on skills found in the resume ({skills_str}).
2. Keep each question to exactly ONE clear sentence.
3. Examples of desired question style:
   - "What is JavaScript, and why do we use it?"
   - "Can you explain what React is and why we use components?"
   - "What is the difference between state and props in React?"
   - "What are Python data types and how do you use lists versus dictionaries?"

For Question Index progression:
- Index 0: Next question MUST be a foundational question about {primary_skill} (e.g. "What is {primary_skill}, and why do we use it?").
- Index 1: Next question MUST be a foundational question about {secondary_skill} or key architectural construct.
- Index 2: Next question MUST compare two core concepts in {primary_skill} or {secondary_skill} in one single sentence.
- Index 3+: End with "Thank you for completing all technical interview questions."

Return ONLY valid JSON matching this schema:
{{
  "is_relevant": bool,
  "relevancy_status": "Relevant" | "Off-Topic",
  "relevancy_reason": "string",
  "is_correct": bool,
  "acknowledgment": "string (1 short sentence)",
  "next_question": "string (1 clear foundational sentence)",
  "instant_feedback": "string (1 sentence)",
  "is_final_question": bool
}}
"""
            res = model.generate_content(prompt)
            clean_text = res.text.strip().replace("```json", "").replace("```", "").strip()
            data = json.loads(clean_text)
            return schemas.InterviewRespondResponse(
                acknowledgment=data.get("acknowledgment", f"Thank you for explaining your thoughts on {primary_skill}."),
                next_question=data.get("next_question", f"What is {secondary_skill}, and why do we use it?"),
                instant_feedback=data.get("instant_feedback", "Clear delivery and steady speaking speed."),
                is_final_question=bool(data.get("is_final_question", is_final)),
                is_relevant=bool(data.get("is_relevant", True)),
                relevancy_status=data.get("relevancy_status", "Relevant"),
                relevancy_reason=data.get("relevancy_reason", "Answer addressed the technical topic."),
                is_correct=bool(data.get("is_correct", True))
            )
        except Exception as e:
            print("Gemini LLM evaluation note:", e)

    # 2. Try OpenAI integration if API key is present
    openai_key = os.getenv("OPENAI_API_KEY")
    if openai_key:
        try:
            import openai
            client = openai.OpenAI(api_key=openai_key)
            prompt = f"""
You are an AI HR Technical Interviewer.
Generate clear, direct, and foundational technical questions based on resume skills ({skills_str}).
Keep each question to exactly ONE clear sentence.
Examples:
- "What is JavaScript, and why do we use it?"
- "Can you explain what React is and why we use components?"
- "What is the difference between state and props in React?"
- "What are Python data types and how do you use lists versus dictionaries?"

Current Question: "{req.current_question}"
Candidate Answer: "{req.user_answer}"
Current Index: {q_idx}

Return JSON with:
- "is_relevant": bool
- "relevancy_status": "Relevant" or "Off-Topic"
- "relevancy_reason": 1 sentence reason
- "is_correct": bool
- "acknowledgment": 1 short sentence
- "next_question": exactly 1 clear, direct foundational sentence
- "instant_feedback": 1 sentence feedback
- "is_final_question": {"true" if is_final else "false"}
"""
            completion = client.chat.completions.create(
                model="gpt-3.5-turbo",
                messages=[{"role": "user", "content": prompt}],
                response_format={"type": "json_object"}
            )
            data = json.loads(completion.choices[0].message.content)
            return schemas.InterviewRespondResponse(
                acknowledgment=data.get("acknowledgment", "Thank you for your response."),
                next_question=data.get("next_question", f"What is {primary_skill}, and why do we use it?"),
                instant_feedback=data.get("instant_feedback", "Steady delivery pace."),
                is_final_question=bool(data.get("is_final_question", is_final)),
                is_relevant=bool(data.get("is_relevant", True)),
                relevancy_status=data.get("relevancy_status", "Relevant"),
                relevancy_reason=data.get("relevancy_reason", "Answer addressed the question."),
                is_correct=bool(data.get("is_correct", True))
            )
        except Exception as e:
            print("OpenAI LLM evaluation note:", e)

    # 3. Deterministic Foundational Fallback
    ans_lower = req.user_answer.lower().strip()
    words = ans_lower.split()
    
    # Strict Relevancy check: Gibberish, "don't know", or < 3 words
    gibberish_triggers = ["idk", "don't know", "dont know", "no idea", "pass", "skip", "whatever", "ho ho", "hari ho", "blah"]
    is_off_topic = False
    relevancy_reason = "Answer directly addressed the foundational question asked."
    
    if len(words) < 3 or any(trig in ans_lower for trig in gibberish_triggers):
        is_off_topic = True
        relevancy_reason = "Response was too brief, declined to answer, or contained non-technical filler."
    elif q_idx == 0 and not any(w in ans_lower for w in ["i", "my", "experience", "developer", "engineer", "software", "background", "work", "studied"]):
        is_off_topic = True
        relevancy_reason = "Introduction did not cover technical background or personal experience."
    elif q_idx >= 1:
        domain_keywords = [s.lower() for s in skills] + ["code", "web", "function", "data", "app", "component", "state", "variable", "class", "logic", "use", "library", "framework"]
        if not any(k in ans_lower for k in domain_keywords) and len(words) < 6:
            is_off_topic = True
            relevancy_reason = "Answer did not contain relevant technical terms or explanation."

    is_relevant = not is_off_topic
    relevancy_status = "Relevant" if is_relevant else "Off-Topic"
    is_correct = is_relevant and len(words) >= 6

    # Generate next question: clear, direct, ONE foundational sentence
    if q_idx == 0:
        next_q = f"What is {primary_skill}, and why do we use it?"
    elif q_idx == 1:
        if "react" in secondary_skill.lower() or "react" in primary_skill.lower():
            next_q = "Can you explain what React is and why we use components?"
        elif "python" in secondary_skill.lower() or "python" in primary_skill.lower():
            next_q = "What are Python data types and how do you use lists versus dictionaries?"
        else:
            next_q = f"Can you explain what {secondary_skill} is and why we use it in modern applications?"
    elif q_idx == 2:
        if "react" in primary_skill.lower() or "react" in secondary_skill.lower():
            next_q = "What is the difference between state and props in React?"
        elif "python" in primary_skill.lower() or "python" in secondary_skill.lower():
            next_q = "What are Python data types and how do you use lists versus dictionaries?"
        elif "javascript" in primary_skill.lower() or "javascript" in secondary_skill.lower():
            next_q = "What is the difference between let, const, and var in JavaScript?"
        else:
            next_q = f"What are the core foundational concepts of {primary_skill}?"
    else:
        next_q = "Thank you for completing all technical interview questions."

    if eye_contact >= 80 and fillers <= 2 and is_relevant:
        feedback = "Strong eye contact and clear explanation directly addressing the question."
    elif not is_relevant:
        feedback = "Response lacked technical substance; remember to answer directly with clear definitions."
    elif eye_contact < 70:
        feedback = "Good response; try maintaining direct eye contact with the camera lens."
    else:
        feedback = "Steady delivery pace with clear foundational articulation."

    acknowledgment = f"Thank you for sharing your thoughts on {primary_skill}." if is_relevant else "Thank you for your response."

    return schemas.InterviewRespondResponse(
        acknowledgment=acknowledgment,
        next_question=next_q,
        instant_feedback=feedback,
        is_final_question=is_final,
        is_relevant=is_relevant,
        relevancy_status=relevancy_status,
        relevancy_reason=relevancy_reason,
        is_correct=is_correct
    )

@router.post("/generate-report")
def generate_interview_report(payload: dict = Body(...)):
    """
    Genuine LLM Evaluation & Accurate Verdict Generator.
    - Sends full list of questions and candidate answers to LLM (or strict evaluator).
    - System prompt strictly compares verbatim candidate answers against ideal answers:
      * Nonsense, gibberish (e.g. 'rahe ho hello', 'enjoy explain what we use it'), irrelevant phrases, or admits they don't know:
        Score: 0 to 10, Relevance: 'IRRELEVANT', Feedback: 'The answer provided was irrelevant or incoherent and failed to explain the core concept.'
      * Shallow or partially incomplete: Score: 35 to 60, Relevance: 'PARTIALLY RELEVANT', Feedback: Specific note on missing details.
      * Accurate: Score: 70 to 100, Relevance: 'RELEVANT', Feedback: Positive affirmation of key points.
    - Genuine Overall Score: exact arithmetic average of all individual question scores.
    - Final Candidate Verdict & Status:
      * >= 70: verdict = "SELECTED FOR THE JOB", status = "SHORTLISTED"
      * 50 to 69: verdict = "NEEDS IMPROVEMENT", status = "UNDER REVIEW"
      * < 50: verdict = "NOT SELECTED", status = "NOT SHORTLISTED"
    """
    candidate_name = payload.get("candidate_name") or payload.get("candidateName") or "Candidate"
    candidate_email = payload.get("candidate_email") or payload.get("email") or "vinodkumar.chakali97@gmail.com"
    company = payload.get("company") or "Target Company"
    interview_type = payload.get("interview_type") or "Technical HR Interview"
    raw_history = payload.get("interview_history") or payload.get("interviewHistory") or payload.get("historyMetrics") or []
    metrics = payload.get("metrics") or {}
    
    eye_contact = float(metrics.get("eyeContact") or metrics.get("eye_contact") or 85)
    fluency = float(metrics.get("fluency") or 85)
    wpm = int(metrics.get("wpm") or 120)
    filler_count = int(metrics.get("fillerCount") or metrics.get("filler_count") or 0)
    warning_count = int(metrics.get("warningCount") or metrics.get("warning_count") or 0)

    evaluated_questions = []
    gemini_key = os.getenv("GEMINI_API_KEY")
    openai_key = os.getenv("OPENAI_API_KEY")
    evaluated_successfully = False

    history_summary = []
    for idx, item in enumerate(raw_history):
        q = item.get("question") or f"Question {idx+1}"
        a = item.get("answer") or item.get("candidate_answer") or item.get("user_answer") or ""
        history_summary.append({"index": idx, "question": q, "answer": a})

    # 1. LLM Evaluation (Gemini or OpenAI) with Strict Interviewer System Prompt
    if (gemini_key or openai_key) and len(history_summary) > 0:
        llm_prompt = f"""
You are an expert technical interviewer. Compare the candidate's verbatim answer against the question and ideal answer:
- If the candidate speaks nonsense, gibberish (e.g., 'rahe ho hello', 'enjoy explain what we use it'), irrelevant phrases, or admits they don't know:
  Score: 0 to 10
  Relevance: 'IRRELEVANT'
  Feedback: 'The answer provided was irrelevant or incoherent and failed to explain the core concept.'
- If the candidate gives a shallow or partially incomplete answer:
  Score: 35 to 60
  Relevance: 'PARTIALLY RELEVANT'
  Feedback: Specific note on what details were missed.
- If the candidate answers accurately:
  Score: 70 to 100
  Relevance: 'RELEVANT'
  Feedback: Positive affirmation of key points covered.

For EACH question in the list, evaluate:
- "index": int (matching input index)
- "question": str
- "answer": str
- "score": int (0 to 100)
- "relevance": "RELEVANT" | "PARTIALLY RELEVANT" | "IRRELEVANT"
- "feedback": str
- "ideal_answer": str (the ideal technical answer)

Interview Transcript to evaluate:
{json.dumps(history_summary, indent=2)}

Return ONLY valid JSON matching this schema:
{{
  "evaluated_questions": [
    {{
      "index": 0,
      "question": "...",
      "answer": "...",
      "score": 10,
      "relevance": "IRRELEVANT",
      "feedback": "The answer provided was irrelevant or incoherent and failed to explain the core concept.",
      "ideal_answer": "..."
    }}
  ],
  "strengths": ["..."],
  "areas_for_improvement": ["..."]
}}
"""
        if gemini_key:
            try:
                import google.generativeai as genai
                genai.configure(api_key=gemini_key)
                model = genai.GenerativeModel('gemini-1.5-flash')
                res = model.generate_content(llm_prompt)
                clean_text = res.text.strip().replace("```json", "").replace("```", "").strip()
                data = json.loads(clean_text)
                evaluated_questions = data.get("evaluated_questions", [])
                if len(evaluated_questions) > 0:
                    evaluated_successfully = True
            except Exception as e:
                print("Gemini report evaluation error:", e)

        if not evaluated_successfully and openai_key:
            try:
                import openai
                client = openai.OpenAI(api_key=openai_key)
                completion = client.chat.completions.create(
                    model="gpt-3.5-turbo",
                    messages=[{"role": "user", "content": llm_prompt}],
                    response_format={"type": "json_object"}
                )
                data = json.loads(completion.choices[0].message.content)
                evaluated_questions = data.get("evaluated_questions", [])
                if len(evaluated_questions) > 0:
                    evaluated_successfully = True
            except Exception as e:
                print("OpenAI report evaluation error:", e)

    # 2. Strict Deterministic Fallback Evaluator (Applying Exact Prompt Rules)
    if not evaluated_successfully:
        evaluated_questions = []
        for idx, item in enumerate(raw_history):
            q = item.get("question") or f"Question {idx+1}"
            a = (item.get("answer") or item.get("candidate_answer") or item.get("user_answer") or "").strip()
            a_low = a.lower()
            words = a_low.split()
            word_count = len(words)
            ideal_ans = get_ideal_answer(q)

            # Check for nonsense, gibberish, transliterated Hindi phrases, admissions of not knowing, empty speech
            gibberish_triggers = [
                "rahe ho hello", "enjoy explain what we use it", "rahe ho", "enjoy explain",
                "ho ho", "hari ho", "re hari", "idk", "don't know", "dont know", "no idea",
                "pass", "skip", "whatever", "blah", "asdf", "lol", "hello", "hi", "bye",
                "test", "testing"
            ]
            is_gibberish = any(trig in a_low for trig in gibberish_triggers) or word_count < 3

            # Check technical keyword match with question
            q_clean = q.lower().replace("?", "").replace(",", "").replace(".", "")
            q_keywords = [w for w in q_clean.split() if len(w) > 3 and w not in ["what", "where", "which", "could", "would", "tell", "explain", "about", "your", "technical", "difference", "between", "versus", "code"]]
            matches = sum(1 for kw in q_keywords if kw in a_low)

            if is_gibberish:
                # Nonsense, gibberish, irrelevant phrases, admits don't know: 0 to 10
                score = 5
                relevance = "IRRELEVANT"
                feedback = "The answer provided was irrelevant or incoherent and failed to explain the core concept."
            elif matches == 0 and word_count < 7:
                score = 10
                relevance = "IRRELEVANT"
                feedback = "The answer provided was irrelevant or incoherent and failed to explain the core concept."
            elif matches == 0 or word_count < 10:
                # Shallow or partially incomplete: 35 to 60
                score = 45
                relevance = "PARTIALLY RELEVANT"
                feedback = "The answer was partially incomplete; it missed key technical definitions, practical use cases, and specific syntax."
            else:
                # Accurate: 70 to 100
                score = min(95, 75 + min(20, word_count))
                relevance = "RELEVANT"
                feedback = "Positive affirmation of key points covered with solid technical understanding."

            evaluated_questions.append({
                "index": idx,
                "question": q,
                "answer": a if a else "(No speech transcribed)",
                "score": score,
                "relevance": relevance,
                "feedback": feedback,
                "ideal_answer": ideal_ans
            })

    # 3. Calculate Genuine Overall Score as the exact arithmetic average of all individual question scores
    if evaluated_questions:
        overall_score = round(sum(q.get("score", 0) for q in evaluated_questions) / len(evaluated_questions))
    else:
        overall_score = 0
    overall_score = max(0, min(100, overall_score))

    # 4. Set Final Candidate Verdict:
    # - If overall score >= 70: verdict = "SELECTED FOR THE JOB", status = "SHORTLISTED"
    # - If overall score between 50 and 69: verdict = "NEEDS IMPROVEMENT", status = "UNDER REVIEW"
    # - If overall score < 50: verdict = "NOT SELECTED", status = "NOT SHORTLISTED"
    if overall_score >= 70:
        final_verdict = "SELECTED FOR THE JOB"
        status = "SHORTLISTED"
    elif overall_score >= 50:
        final_verdict = "NEEDS IMPROVEMENT"
        status = "UNDER REVIEW"
    else:
        final_verdict = "NOT SELECTED"
        status = "NOT SHORTLISTED"

    strengths = []
    if eye_contact >= 75:
        strengths.append(f"Maintained camera gaze stability ({round(eye_contact)}% eye contact).")
    if fluency >= 75:
        strengths.append(f"Clear vocal delivery pace ({round(fluency)}% fluency score).")
    high_scoring_q = [q for q in evaluated_questions if q.get("score", 0) >= 70]
    if high_scoring_q:
        strengths.append(f"Demonstrated solid grasp on technical questions ({len(high_scoring_q)}/{len(evaluated_questions)} questions scored >= 70%).")
    if not strengths:
        strengths.append("Successfully completed all scheduled interview rounds.")

    areas_for_improvement = []
    low_scoring_q = [q for q in evaluated_questions if q.get("score", 0) < 50]
    if low_scoring_q:
        areas_for_improvement.append(f"Review core technical fundamentals: {len(low_scoring_q)} answers scored under 50% due to irrelevant phrases, gibberish, or incomplete explanations.")
    if eye_contact < 70:
        areas_for_improvement.append("Maintain direct eye contact with the webcam lens to project professional confidence.")
    if filler_count > 3:
        areas_for_improvement.append(f"Reduce filler word frequency ({filler_count} detected); pause briefly before formulating your answer.")
    if not areas_for_improvement:
        areas_for_improvement.append("Continue practicing concise, scenario-based architecture discussions.")

    report_response = {
        "candidateName": candidate_name,
        "candidateEmail": candidate_email,
        "company": company,
        "interviewType": interview_type,
        "overallScore": overall_score,
        "finalVerdict": final_verdict,
        "verdict": final_verdict,
        "selectionStatus": final_verdict,
        "status": status,
        "shortlistStatus": status,
        "historyMetrics": evaluated_questions,
        "evaluatedQuestions": evaluated_questions,
        "strengths": strengths,
        "areasForImprovement": areas_for_improvement,
        "metrics": {
            "eyeContact": round(eye_contact),
            "fluency": round(fluency),
            "confidence": round(metrics.get("confidence") or 80),
            "wpm": wpm,
            "fillerCount": filler_count,
            "answerAccuracy": overall_score,
            "warningCount": warning_count,
            "relevancyStatus": f"{sum(1 for q in evaluated_questions if q.get('relevance') == 'RELEVANT')}/{len(evaluated_questions)} Questions Relevant"
        },
        "completedAt": datetime.now().isoformat()
    }

    return report_response

@router.post("/report/{interview_id}/pdf")
@router.post("/report/pdf")
def download_pdf_report(
    interview_id: int = 1, 
    payload: dict = Body(default={})
):
    candidate_name = payload.get("candidateName") or payload.get("candidate_name") or "Candidate"
    metrics = payload.get("metrics") or {"eyeContact": 92, "fluency": 88, "confidence": 85, "fillerCount": 3, "wpm": 135}
    selection_status = payload.get("selectionStatus") or payload.get("selection_status") or "SELECTED"
    overall_score = payload.get("overallScore") or payload.get("overall_score") or 85
    history = payload.get("interview_history") or payload.get("interviewHistory") or payload.get("historyMetrics") or []
    
    pdf_path = generate_pdf_report(
        interview_id=interview_id,
        candidate_name=candidate_name,
        metrics=metrics,
        selection_status=selection_status,
        overall_score=overall_score,
        history=history
    )
    
    if not os.path.exists(pdf_path):
        raise HTTPException(status_code=500, detail="PDF generation failed")
        
    return FileResponse(
        path=pdf_path,
        filename=f"AI_Interview_Report_{candidate_name.replace(' ', '_')}.pdf",
        media_type="application/pdf"
    )

@router.post("/send-email")
@router.post("/report/{interview_id}/send-email")
def send_email_report_endpoint(
    interview_id: int = 1,
    payload: dict = Body(default={})
):
    """
    FastAPI endpoint for candidate email assessment report dispatch.
    Accepts: { candidate_email, candidate_name, overall_score, verdict, questions_data, report_data }
    Dispatches clean HTML assessment summary using SMTP SSL.
    """
    candidate_email = (
        payload.get("candidate_email") or 
        payload.get("recipient_email") or
        payload.get("email") or 
        payload.get("candidateEmail") or 
        "vinodkumar.chakali97@gmail.com"
    )
    candidate_name = (
        payload.get("candidate_name") or 
        payload.get("candidateName") or 
        "Candidate"
    )
    report_data = (
        payload.get("report_data") or 
        payload.get("report") or 
        payload
    )

    overall_score = payload.get("overall_score")
    if overall_score is None:
        overall_score = report_data.get("overallScore") or report_data.get("overall_score") or 0

    verdict = (
        payload.get("verdict") or 
        payload.get("final_verdict") or
        report_data.get("finalVerdict") or 
        report_data.get("verdict") or 
        report_data.get("selectionStatus") or 
        "NEEDS IMPROVEMENT"
    )
    questions_data = (
        payload.get("questions_data") or 
        report_data.get("historyMetrics") or 
        report_data.get("evaluatedQuestions") or 
        []
    )

    # Optional PDF report attachment
    try:
        metrics = report_data.get("metrics") or {}
        pdf_path = generate_pdf_report(
            interview_id=interview_id,
            candidate_name=candidate_name,
            metrics=metrics,
            selection_status=verdict,
            overall_score=overall_score,
            history=questions_data
        )
    except Exception as e:
        print("PDF report generation note for email:", e)
        pdf_path = None

    return send_interview_report(
        recipient_email=candidate_email,
        candidate_name=candidate_name,
        overall_score=overall_score,
        verdict=verdict,
        questions_data=questions_data,
        pdf_path=pdf_path
    )

@router.post("/terminate")
@router.post("/terminate/{interview_id}")
def terminate_interview(interview_id: int = 1, payload: dict = Body(default={}), db: Session = Depends(get_db)):
    reason = payload.get("reason", "Proctoring failure: Gaze warnings exceeded")
    interview = db.query(models.Interview).filter(models.Interview.id == interview_id).first()
    if interview:
        interview.status = "Terminated"
        interview.end_time = datetime.now()
        db.commit()
    return {
        "status": "terminated",
        "message": f"Interview {interview_id} terminated due to malpractice/proctoring failure.",
        "reason": reason
    }

@router.post("/end/{interview_id}")
def end_interview(interview_id: int, db: Session = Depends(get_db)):
    interview = db.query(models.Interview).filter(models.Interview.id == interview_id).first()
    if interview:
        interview.status = "Completed"
        interview.end_time = datetime.now()
        db.commit()
    
    return {"status": "success", "message": "Interview completed and report generated."}
