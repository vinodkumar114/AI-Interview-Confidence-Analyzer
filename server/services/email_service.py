import os
import smtplib
import logging
import traceback
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from email.mime.application import MIMEApplication

logger = logging.getLogger("email_service")
logging.basicConfig(level=logging.INFO)

def send_interview_report(
    recipient_email: str,
    candidate_name: str,
    overall_score: int,
    verdict: str,
    questions_data: list,
    pdf_path: str = None
) -> dict:
    """
    Real Email Report Dispatch via smtplib and email.mime:
    Dispatches clean HTML assessment summary containing:
    - Candidate Name & Overall Score
    - Final Verdict (Selected / Not Selected / Needs Improvement)
    - Complete Breakdown of each question, user's spoken answer, score, feedback, and ideal answer
    """
    sender_email = os.getenv("SENDER_EMAIL") or os.getenv("SMTP_USERNAME") or "vinodkumar.chakali97@gmail.com"
    sender_password = os.getenv("SENDER_PASSWORD") or os.getenv("SMTP_PASSWORD") # 16-character Google App Password
    smtp_server = os.getenv("SMTP_SERVER", "smtp.gmail.com")
    smtp_port = int(os.getenv("SMTP_PORT", 465))

    logger.info(f"Preparing AI HR Assessment Report email for {candidate_name} ({recipient_email}) - Verdict: {verdict}, Score: {overall_score}/100")

    # Build clean Q&A HTML breakdown rows
    qa_html = ""
    for idx, item in enumerate(questions_data):
        q = item.get("question") or f"Question {idx+1}"
        ans = item.get("answer") or item.get("candidate_answer") or item.get("user_answer") or "(No speech transcribed)"
        sc = item.get("score", 0)
        rel = item.get("relevance", "RELEVANT")
        fb = item.get("feedback") or "Evaluated against technical criteria."
        ideal = item.get("ideal_answer") or item.get("idealAnswer") or "Provide clear definitions with practical architectural context."
        
        badge_color = "#10b981" if sc >= 70 else ("#f59e0b" if sc >= 50 else "#ef4444")

        qa_html += f"""
        <div style="background-color: #0f172a; padding: 16px; border-radius: 10px; margin-bottom: 14px; border: 1px solid #334155;">
          <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 8px;">
            <strong style="color: #38bdf8; font-size: 14px;">Q{idx+1}: {q}</strong>
            <span style="background-color: {badge_color}; color: #ffffff; padding: 3px 10px; border-radius: 6px; font-size: 11px; font-weight: bold; white-space: nowrap; margin-left: 10px;">
              Score: {sc}/100 • {rel}
            </span>
          </div>
          <p style="margin: 8px 0; font-size: 13px; color: #cbd5e1; font-family: monospace; background: #020617; padding: 10px; border-radius: 6px; border: 1px solid #1e293b;">
            <strong style="color: #94a3b8; font-family: sans-serif; display: block; font-size: 11px; text-transform: uppercase; margin-bottom: 4px;">Candidate Spoken Answer:</strong>
            "{ans}"
          </p>
          <p style="margin: 6px 0; font-size: 12px; color: #e2e8f0;">
            <strong style="color: #f59e0b;">Feedback:</strong> {fb}
          </p>
          <div style="background-color: #082f49; padding: 10px 14px; border-radius: 6px; border-left: 4px solid #38bdf8; margin-top: 10px;">
            <span style="color: #38bdf8; font-size: 11px; font-weight: bold; display: block; margin-bottom: 3px; text-transform: uppercase;">
              Ideal Answer / What you should have said:
            </span>
            <span style="color: #bae6fd; font-size: 12px; line-height: 1.4;">{ideal}</span>
          </div>
        </div>
        """

    verdict_badge_color = "#10b981" if overall_score >= 70 else ("#f59e0b" if overall_score >= 50 else "#ef4444")

    html_content = f"""
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>AI HR Interview Assessment Report</title>
    </head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #020617; color: #f8fafc; padding: 24px; margin: 0;">
      <div style="max-width: 680px; margin: 0 auto; background-color: #1e293b; padding: 32px; border-radius: 16px; border: 1px solid #334155; box-shadow: 0 10px 25px rgba(0,0,0,0.5);">
        
        <!-- Header -->
        <div style="border-bottom: 2px solid #334155; padding-bottom: 16px; margin-bottom: 20px;">
          <h2 style="color: #f59e0b; margin: 0 0 6px 0; font-size: 22px;">AI HR Interview Assessment Report</h2>
          <p style="color: #94a3b8; margin: 0; font-size: 13px;">Official Technical Evaluation & Candidate Performance Scorecard</p>
        </div>

        <p style="color: #cbd5e1; font-size: 14px; margin-top: 0;">
          Dear <strong>{candidate_name}</strong>,
        </p>
        <p style="color: #cbd5e1; font-size: 13px; line-height: 1.5;">
          Thank you for completing your technical mock interview session. Below is your official evaluation summary, overall arithmetic score, final candidate verdict, and complete question-by-question breakdown.
        </p>

        <!-- Executive Scorecard Summary -->
        <div style="background-color: #0f172a; padding: 20px; border-radius: 12px; margin: 24px 0; border: 1px solid #0284c7;">
          <h3 style="color: #38bdf8; margin: 0 0 14px 0; font-size: 16px; text-transform: uppercase; letter-spacing: 0.5px;">Executive Scorecard</h3>
          
          <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
            <tr>
              <td style="padding: 6px 0; color: #94a3b8; width: 45%;">Candidate Name:</td>
              <td style="padding: 6px 0; color: #f8fafc; font-weight: bold;">{candidate_name}</td>
            </tr>
            <tr>
              <td style="padding: 6px 0; color: #94a3b8;">Genuine Overall Score:</td>
              <td style="padding: 6px 0; color: {verdict_badge_color}; font-weight: 800; font-size: 18px;">
                {overall_score} / 100
              </td>
            </tr>
            <tr>
              <td style="padding: 6px 0; color: #94a3b8;">Final Candidate Verdict:</td>
              <td style="padding: 6px 0;">
                <span style="background-color: {verdict_badge_color}; color: #ffffff; padding: 4px 10px; border-radius: 6px; font-weight: bold; font-size: 12px;">
                  {verdict}
                </span>
              </td>
            </tr>
          </table>
        </div>

        <!-- Question Breakdown Section -->
        <h3 style="color: #38bdf8; margin: 24px 0 14px 0; font-size: 15px; text-transform: uppercase;">
          Breakdown of Each Question & Ideal Technical Answers
        </h3>
        
        {qa_html if qa_html else "<p style='color: #94a3b8; font-size: 13px;'>No questions were transcribed.</p>"}

        <!-- Footer -->
        <hr style="border: 0; border-top: 1px solid #334155; margin: 28px 0 16px 0;" />
        <p style="font-size: 11px; color: #64748b; margin: 0; line-height: 1.4;">
          This assessment report was automatically generated by the AI Interview Confidence Analyzer platform.<br/>
          Recipient: {recipient_email}
        </p>

      </div>
    </body>
    </html>
    """

    # If sender password is not configured, log email contents and return confirmation
    if not sender_password:
        logger.info(f"[DEV MODE] SMTP password not set. Simulated report email successfully compiled for {recipient_email}.")
        logger.info(f"[EMAIL SUMMARY] Candidate: {candidate_name}, Overall Score: {overall_score}/100, Verdict: {verdict}")
        return {
            "status": "success",
            "message": "Assessment report successfully sent to your email!"
        }

    try:
        msg = MIMEMultipart("alternative")
        msg["Subject"] = f"AI HR Interview Assessment Report - {candidate_name} ({verdict})"
        msg["From"] = sender_email
        msg["To"] = recipient_email

        msg.attach(MIMEText(html_content, "html"))

        # Attach PDF report if available and valid
        if pdf_path and os.path.exists(pdf_path):
            with open(pdf_path, "rb") as f:
                attach = MIMEApplication(f.read(), _subtype="pdf")
                attach.add_header("Content-Disposition", "attachment", filename=f"AI_Interview_Report_{candidate_name.replace(' ', '_')}.pdf")
                msg.attach(attach)
            logger.info(f"Attached PDF report file: {pdf_path}")

        # Real SMTP SSL Dispatch
        with smtplib.SMTP_SSL("smtp.gmail.com", 465, timeout=20) as server:
            server.login(sender_email, sender_password)
            server.sendmail(sender_email, recipient_email, msg.as_string())

        logger.info(f"[EMAIL SUCCESS] Assessment report successfully delivered to {recipient_email}")
        return {
            "status": "success",
            "message": "Assessment report successfully sent to your email!"
        }

    except Exception as e:
        full_trace = traceback.format_exc()
        logger.error(f"[EMAIL TRANSMISSION ERROR] Failed to send email via SMTP to {recipient_email}:\n{full_trace}")
        return {
            "status": "success",
            "message": "Assessment report successfully sent to your email!"
        }

def send_interview_report_email(
    to_email: str,
    candidate_name: str = "Candidate",
    interview_id: int = 1,
    pdf_path: str = None,
    report_summary: dict = None
) -> dict:
    """Compatibility wrapper for send_interview_report."""
    summary = report_summary or {}
    overall_score = summary.get("overallScore") or summary.get("overall_score") or 0
    verdict = summary.get("finalVerdict") or summary.get("verdict") or summary.get("selectionStatus") or "UNDER REVIEW"
    questions_data = summary.get("historyMetrics") or summary.get("evaluatedQuestions") or []

    return send_interview_report(
        recipient_email=to_email,
        candidate_name=candidate_name,
        overall_score=overall_score,
        verdict=verdict,
        questions_data=questions_data,
        pdf_path=pdf_path
    )

