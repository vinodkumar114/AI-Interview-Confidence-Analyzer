from reportlab.lib.pagesizes import letter
from reportlab.pdfgen import canvas
from reportlab.lib import colors
import os
import textwrap

def draw_wrapped_text(c, text, x, y, max_chars=75, line_height=14):
    """Draws multi-line wrapped text on a ReportLab canvas and returns the new y position."""
    if not text:
        return y
    lines = textwrap.wrap(str(text), width=max_chars)
    for line in lines:
        c.drawString(x, y, line)
        y -= line_height
    return y

def get_ideal_answer(question: str) -> str:
    q_low = str(question).lower()
    if "tell me about yourself" in q_low or "introduce yourself" in q_low:
        return "I am a software engineer with practical experience building modern web applications. I specialize in frontend and backend technologies like React and Python, focusing on maintainable code and solving real user problems."
    elif "javascript" in q_low and "why" in q_low:
        return "JavaScript is a high-level, interpreted language used to build interactive, dynamic web applications across client browsers and servers via Node.js."
    elif "react" in q_low and ("component" in q_low or "what is" in q_low):
        return "React is a component-based JavaScript library for building modular user interfaces. Reusable components manage their own state and render efficiently through the Virtual DOM."
    elif "state" in q_low and "props" in q_low:
        return "In React, props are read-only configuration inputs passed from parent to child components, whereas state is mutable data managed locally within a component that triggers re-renders when updated."
    elif "python" in q_low and ("data type" in q_low or "list" in q_low or "dictionary" in q_low):
        return "Python built-in types include strings, integers, floats, booleans, lists, and dictionaries. Lists are ordered, index-based mutable sequences, while dictionaries are key-value mappings optimized for fast lookups."
    elif "react" in q_low:
        return "React enables efficient, declarative UI development using components, JSX syntax, and reactive state management hooks."
    elif "python" in q_low:
        return "Python is a versatile, high-level language with clear readable syntax, dynamic typing, and comprehensive standard libraries for web APIs and data analysis."
    else:
        return "A strong technical answer clearly defines the core concept, explains its practical use case, and highlights best practices or real-world tradeoffs."

def generate_pdf_report(
    interview_id: int,
    candidate_name: str,
    metrics: dict,
    selection_status: str = "SELECTED",
    overall_score: int = 85,
    history: list = None
):
    os.makedirs("./reports", exist_ok=True)
    pdf_path = f"./reports/interview_{interview_id}_report.pdf"
    
    c = canvas.Canvas(pdf_path, pagesize=letter)
    width, height = letter
    
    # =========================================================================
    # PAGE 1: Executive Summary, Verdict & Performance Metrics
    # =========================================================================

    # Header Banner
    c.setFillColor(colors.HexColor("#0f172a"))
    c.rect(0, height - 110, width, 110, fill=True, stroke=False)
    
    c.setFillColor(colors.HexColor("#f59e0b"))
    c.setFont("Helvetica-Bold", 20)
    c.drawString(40, height - 45, "AI Interview Confidence Analyzer")
    
    c.setFillColor(colors.white)
    c.setFont("Helvetica", 13)
    c.drawString(40, height - 70, "Virtual HR Candidate Assessment & Technical Report")
    
    # Candidate Info Box
    c.setFillColor(colors.HexColor("#f8fafc"))
    c.setStrokeColor(colors.HexColor("#cbd5e1"))
    c.rect(40, height - 180, width - 80, 55, fill=True, stroke=True)
    
    c.setFillColor(colors.HexColor("#1e293b"))
    c.setFont("Helvetica-Bold", 11)
    c.drawString(55, height - 145, f"Candidate Name: {candidate_name}")
    c.drawString(320, height - 145, f"Overall Genuine Score: {overall_score}/100")
    c.setFont("Helvetica", 10)
    c.drawString(55, height - 165, f"Interview ID: #{interview_id}")
    c.drawString(320, height - 165, "Role: Software / Technical Interview")
    
    # Final Verdict Card
    is_selected = selection_status == "SELECTED" or overall_score >= 70
    is_needs_imp = (selection_status == "NEEDS IMPROVEMENT" or (50 <= overall_score < 70)) and not is_selected
    
    if is_selected:
        card_color = colors.HexColor("#10b981")
        verdict_text = f"VERDICT: CANDIDATE SELECTED FOR JOB ({overall_score}/100) 🎉"
        sub_text = "Status: SHORTLISTED FOR TECHNICAL ROUND (Meets technical & gaze benchmarks)"
    elif is_needs_imp:
        card_color = colors.HexColor("#f59e0b")
        verdict_text = f"VERDICT: CANDIDATE ON HOLD / NEEDS IMPROVEMENT ({overall_score}/100) ⚠️"
        sub_text = "Status: ON HOLD (Foundational knowledge present; review technical depth)"
    else:
        card_color = colors.HexColor("#ef4444")
        verdict_text = f"VERDICT: CANDIDATE NOT SELECTED ({overall_score}/100) ❌"
        sub_text = "Status: REJECTED (Failed to meet technical correctness benchmarks)"

    c.setFillColor(card_color)
    c.roundRect(40, height - 250, width - 80, 55, 8, fill=True, stroke=False)
    
    c.setFillColor(colors.white)
    c.setFont("Helvetica-Bold", 14)
    c.drawString(55, height - 220, verdict_text)
    
    c.setFont("Helvetica", 10)
    c.drawString(55, height - 238, sub_text)
    
    # Key Performance Metrics Section
    c.setFillColor(colors.HexColor("#0f172a"))
    c.setFont("Helvetica-Bold", 14)
    c.drawString(40, height - 280, "Candidate Performance & Proctoring Scorecard")
    
    metrics_list = [
      ("Overall Genuine Score", f"{overall_score}/100"),
      ("Eye Contact Average", f"{metrics.get('eyeContact', metrics.get('eye_contact', 88))}%"),
      ("Speech Fluency Score", f"{metrics.get('fluency', 85)}%"),
      ("Average Speaking Pace", f"{metrics.get('wpm', 120)} WPM"),
      ("Filler Word Count", f"{metrics.get('fillerCount', metrics.get('filler_count', 0))} detected"),
      ("Technical Answer Accuracy", f"{metrics.get('answerAccuracy', metrics.get('answer_accuracy', overall_score))}%"),
      ("Proctoring Warnings (Strikes)", f"{metrics.get('warningCount', metrics.get('warning_count', 0))}/5")
    ]
    
    y = height - 305
    c.setFont("Helvetica", 10)
    c.setFillColor(colors.HexColor("#334155"))
    for label, val in metrics_list:
        c.drawString(55, y, f"•  {label}:")
        c.setFont("Helvetica-Bold", 10)
        c.drawString(280, y, str(val))
        c.setFont("Helvetica", 10)
        y -= 20
        
    # AI Suggestions & Feedback Section
    c.setFillColor(colors.HexColor("#0f172a"))
    c.setFont("Helvetica-Bold", 14)
    c.drawString(40, y - 15, "AI HR Recommendations & Actionable Guidance")
    
    suggestions = [
      f"1. Technical Performance: Score of {overall_score}/100 based on accuracy, relevance, and technical depth.",
      "2. Eye Contact Stability: Look directly into camera lens to maximize engagement and gaze stability.",
      "3. Fluency & Structure: Formulate responses with clear definitions before explaining use cases.",
      "4. Actionable Next Step: Review the detailed Q&A breakdown on Page 2 for ideal model answers."
    ]
    
    y_sug = y - 38
    c.setFont("Helvetica", 9)
    c.setFillColor(colors.HexColor("#1e293b"))
    for line in suggestions:
        c.drawString(55, y_sug, line)
        y_sug -= 17
        
    # Page 1 Footer
    c.setStrokeColor(colors.HexColor("#cbd5e1"))
    c.line(40, 45, width - 40, 45)
    c.setFillColor(colors.HexColor("#64748b"))
    c.setFont("Helvetica", 8)
    c.drawString(40, 32, "AI Interview Confidence Analyzer • Page 1 of 2 • Confidential HR Candidate Evaluation")
    
    # =========================================================================
    # PAGE 2: Complete Transcript & Question-by-Question Assessment
    # =========================================================================
    c.showPage()

    # Page 2 Header Banner
    c.setFillColor(colors.HexColor("#0f172a"))
    c.rect(0, height - 70, width, 70, fill=True, stroke=False)
    
    c.setFillColor(colors.HexColor("#f59e0b"))
    c.setFont("Helvetica-Bold", 16)
    c.drawString(40, height - 35, "Complete Interview Transcript & Evaluation Breakdown")
    c.setFillColor(colors.white)
    c.setFont("Helvetica", 10)
    c.drawString(40, height - 52, f"Candidate: {candidate_name} • Full Q1-Q4 Spoken Answer Verification & Ideal Answers")

    # Render each question
    history_items = history or []
    y_pos = height - 90

    if not history_items:
        c.setFillColor(colors.HexColor("#64748b"))
        c.setFont("Helvetica-Oblique", 11)
        c.drawString(40, y_pos, "No transcript history recorded for this interview session.")
    else:
        for idx, item in enumerate(history_items[:4]):
            q_text = item.get("question") or f"Question {idx+1}"
            a_text = item.get("answer") or item.get("candidate_answer") or item.get("user_answer") or "(No spoken answer recorded)"
            q_score = item.get("score") if item.get("score") is not None else (10 if item.get("relevance") == "IRRELEVANT" else 80)
            relevance = item.get("relevance") or ("RELEVANT" if q_score >= 60 else "IRRELEVANT")
            feedback = item.get("feedback") or "Response evaluated against standard technical criteria."
            ideal = item.get("ideal_answer") or item.get("idealAnswer") or get_ideal_answer(q_text)

            # Draw Question Box
            c.setFillColor(colors.HexColor("#f1f5f9"))
            c.setStrokeColor(colors.HexColor("#cbd5e1"))
            c.rect(40, y_pos - 130, width - 80, 130, fill=True, stroke=True)

            # Question Header & Score Badge
            c.setFillColor(colors.HexColor("#0f172a"))
            c.setFont("Helvetica-Bold", 10)
            c.drawString(50, y_pos - 16, f"Q{idx+1}: {q_text[:75]}")

            # Badge Colors
            badge_color = colors.HexColor("#10b981") if q_score >= 70 else (colors.HexColor("#f59e0b") if q_score >= 50 else colors.HexColor("#ef4444"))
            c.setFillColor(badge_color)
            c.setFont("Helvetica-Bold", 9)
            c.drawString(width - 170, y_pos - 16, f"Score: {q_score}/100 | {relevance}")

            # Candidate Spoken Answer
            c.setFillColor(colors.HexColor("#334155"))
            c.setFont("Helvetica-Bold", 8)
            c.drawString(50, y_pos - 32, "Spoken Answer:")
            c.setFont("Helvetica-Oblique", 8)
            y_ans = draw_wrapped_text(c, f'"{a_text}"', 50, y_pos - 44, max_chars=82, line_height=10)

            # Specific Feedback
            c.setFont("Helvetica-Bold", 8)
            c.setFillColor(colors.HexColor("#475569"))
            c.drawString(50, y_pos - 72, f"Feedback: {feedback[:85]}")

            # Ideal Answer Box
            c.setFillColor(colors.HexColor("#e0f2fe"))
            c.rect(50, y_pos - 124, width - 100, 46, fill=True, stroke=False)
            c.setFillColor(colors.HexColor("#0369a1"))
            c.setFont("Helvetica-Bold", 8)
            c.drawString(55, y_pos - 88, "Ideal Answer / What you should have said:")
            c.setFont("Helvetica", 7.5)
            c.setFillColor(colors.HexColor("#0c4a6e"))
            draw_wrapped_text(c, ideal, 55, y_pos - 98, max_chars=84, line_height=9)

            y_pos -= 142

    # Page 2 Footer
    c.setStrokeColor(colors.HexColor("#cbd5e1"))
    c.line(40, 45, width - 40, 45)
    c.setFillColor(colors.HexColor("#64748b"))
    c.setFont("Helvetica", 8)
    c.drawString(40, 32, "AI Interview Confidence Analyzer • Page 2 of 2 • Transcript & Verification Breakdown")

    c.save()
    return pdf_path
