import os
import json
import base64
import re
import asyncio
import uuid
from datetime import datetime
from typing import List, Optional, Literal

from fastapi import FastAPI, Depends, HTTPException, Header, UploadFile, File
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session
from dotenv import load_dotenv
from groq import AsyncGroq, RateLimitError, APIError
from supabase import create_client, Client
import pusher

import models
from database import engine, get_db

# =========================================================================
# 🔄 AUTOMATIC ENVIRONMENT LOADING & CLIENT INITIALIZATION
# =========================================================================
load_dotenv()

# Initialize Supabase Python Client
SUPABASE_URL = os.environ.get("SUPABASE_URL", "https://djaiakndrpptwgyfkyfk.supabase.co")
SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY") or os.environ.get("SUPABASE_ANON_KEY")

supabase_client: Client = None
if SUPABASE_URL and SUPABASE_KEY:
    try:
        supabase_client = create_client(SUPABASE_URL, SUPABASE_KEY)
        print("🌌 Supabase Python client context successfully initialized.")
    except Exception as err:
        print(f"⚠️ Supabase Client Initialization Warning: {err}")

# Async Groq Client for non-blocking I/O
groq_client = AsyncGroq(api_key=os.environ.get("GROQ_API_KEY"))
# Global Semaphore to queue concurrent outbound AI requests
GROQ_CONCURRENCY_LIMITER = asyncio.Semaphore(12)

# Real-Time Pusher Client
pusher_client = pusher.Pusher(
    app_id=os.getenv("PUSHER_APP_ID"),
    key=os.getenv("PUSHER_KEY"),
    secret=os.getenv("PUSHER_SECRET"),
    cluster=os.getenv("PUSHER_CLUSTER"),
    ssl=True
)

# Automatically create database tables if they do not exist
models.Base.metadata.create_all(bind=engine)

app = FastAPI(redirect_slashes=False)

# Serve static files fallback
if os.path.exists("static"):
    app.mount("/static", StaticFiles(directory="static"), name="static")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allows all origins (local, phone, Vercel, etc.)
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ==========================================
# 1. PYDANTIC SCHEMAS (Data Validation/DTOs)
# ==========================================

class CourseNoteBase(BaseModel):
    title: str
    content: str
    patient_id: Optional[int] = None

class CourseNoteCreate(CourseNoteBase):
    pass

class CourseNoteResponse(CourseNoteBase):
    id: int

    class Config:
        from_attributes = True

class AssessmentBase(BaseModel):
    note_id: int
    questions: str

class AssessmentCreate(AssessmentBase):
    pass

class AssessmentResponse(AssessmentBase):
    id: int

    class Config:
        from_attributes = True

class GradeRequest(BaseModel):
    question_stem: str
    ai_answer_key: str
    student_response: str
    question_type: Literal["RECALL", "DIRECTIONAL", "LIST", "EXPLANATION"] = "RECALL"
    vignette_context: Optional[str] = None
    image_url: Optional[str] = None

class EvaluationResult(BaseModel):
    reasoning: str = Field(..., description="A brief evaluation analyzing the response.")
    score: int = Field(..., description="An integer score from 0 to 10.")

class AdminLoginRequest(BaseModel):
    username: str
    name: str

# ==========================================
# 2. HELPER FUNCTIONS & SYSTEM PROMPTS
# ==========================================

PRECISION_RULES = """CRITICAL CLINICAL PRECISION & STRICT ADMIN KEY ENFORCEMENT:
1. ABSOLUTE EXACT-STRING MATCHING (NO SEMANTIC FLEXIBILITY):
   - The ADMIN ANSWER KEY is the SINGLE AND ONLY SOURCE OF TRUTH.
   - You MUST perform an EXACT CHARACTER/STRING COMPARISON between the user's submission and the key.
   - Descriptive synonyms, informal terms, or layman phrasing (e.g., "Bleeding phase" instead of "Menstrual phase", "Production phase" instead of "Proliferative phase") ARE STRICTLY INCORRECT. Mark them as 0 credit immediately.
2. ZERO TOLERANCE FOR SYNONYM RATIONALIZATION:
   - You are STRICTLY FORBIDDEN from writing that informal or non-standard terms "match standard nomenclature" or are "clinically accurate."
   - If the submitted string does not match the standardized medical term in the key, it is an automatic failure for that sub-item.
3. MANDATORY ALGORITHMIC STEP-BY-STEP EVALUATION:
   - Step 1: Break the response into N discrete items.
   - Step 2: Mark each item as MATCH (1) or MISMATCH (0) based purely on string alignment with the key.
   - Step 3: Calculate score as Score = min(round((C / N) * 10), max_allowed_score).
   - CONSTRAINT: If C < N, giving 10 / 10 is a SYSTEM FAILURE. (For 2/3 correct, the score MUST BE 7 / 10).
4. HIDDEN RUBRIC / NO META-REFERENCES:
   - Evaluate using the key internally, but write feedback purely as a direct clinical assessment to "You".
   - State clearly: "[Submitted Term] is informal/non-standard. The standard clinical term is [Correct Term]."
   - NEVER mention "admin key", "rubric", or "provided context".
"""

# Updated System Prompts with Strict Partial Credit Rules & Multi-System Context Alignment

PROMPTS = {
    "RECALL": PRECISION_RULES + """You are an unforgiving, strict administrative medical professor evaluating a single-term or entity recall question for a clinical board exam.

1. BOUNDED DIAGRAM & CONTEXT READING:
   - Trace sub-question identifiers directly against the ground truth in the ADMIN ANSWER KEY before judging accuracy.
   - Do NOT override key ground truth using visual diagram OCR.
2. Compare the Student Response strictly against the ADMIN ANSWER KEY for the target entity or clinical term.
3. If the user names the exact target term/entity specified in the ADMIN ANSWER KEY, award 10 / 10.
4. If the user names an incorrect term, precursor, informal synonym, or related entity not explicitly matching the key, award 0 / 10 immediately.
5. STRICT FEEDBACK RULE: Address the user directly as "You". Point out the exact clinical error directly. NEVER write "the student", "the response", "provided context", "answer key", "admin key", "key", or "rubric".""",

    "DIRECTIONAL": PRECISION_RULES + """You are an unforgiving, strict administrative medical professor evaluating a clinical directional change or physiological state vector.

1. Compare the Student Response strictly against the ADMIN ANSWER KEY for clinical direction (e.g., increased vs decreased, hyperglycemia vs hypoglycemia).
2. If the directional state matches the ADMIN ANSWER KEY, award 10 / 10.
3. If the user states the opposite direction, wrong state, or an unlisted vector, award 0 / 10. Zero partial credit allowed for non-matching facts.
4. STRICT FEEDBACK RULE: Address the user directly as "You". Point out the exact clinical error directly. NEVER write "the student", "the response", "provided context", "answer key", "admin key", "key", or "rubric".""",

    "LIST": PRECISION_RULES + """You are an unforgiving, strict administrative medical professor evaluating an itemized list, anatomical layer sequence, or multi-part recall question.

1. INDEPENDENT SUB-ITEM EVALUATION (FAIR PARTIAL CREDIT):
   - Treat every sub-label or item (e.g., A, B, C) as an INDEPENDENT evaluation node.
   - DO NOT penalize correct sub-items due to errors in adjacent sub-items.
   - MULTI-SYSTEM CLARIFICATION: Accept standard clinical terminology matching the target system represented in the question stem or diagram (e.g., endometrial histology vs. ovarian cycle phases). If a sub-item matches the required term, award full credit for that sub-item.
2. COUNT REQUIRED ITEMS (N) & AUDIT USER ITEMS (C):
   - Determine total items required (N) based on the ADMIN ANSWER KEY.
   - Count correct items (C) strictly line-by-line.
3. RIGID MATHEMATICAL SCORING (COMPUTED MATH):
   - Calculate score: Score = min(round((C / N) * 10), max_allowed_score).
   - If C = 3 of 3 correct: Score MUST be 10 / 10.
   - If C = 2 of 3 correct: Score MUST be 7 / 10.
   - If C = 1 of 3 correct: Score MUST be 3 / 10 (or 3.3 scaled).
   - ABSOLUTE ZERO GUARD: If C > 0, you are STRICTLY FORBIDDEN from returning a score of 0 / 10.
4. ISOLATED FEEDBACK DIRECTIVE:
   - Validate and praise all sub-items that are correct.
   - Restrict negative feedback and clinical corrections ONLY to mismatched or incorrect sub-items.
   - NEVER fabricate errors on a correct sub-item to justify a score reduction.
5. STRICT FEEDBACK RULE: Address the user directly as "You". Call out every incorrect or fabricated term identified, state the correct standard medical terminology, and explain the clinical impact of the error. NEVER write "the student", "the response", "provided context", "answer key", "admin key", "key", or "rubric".""",

    "EXPLANATION": PRECISION_RULES + """You are an unforgiving, strict administrative medical professor evaluating an explanatory physiological mechanism or procedural question.

1. Evaluate core medical mechanisms, anatomical landmarks, target organs, and signaling pathways directly against required concepts in the ADMIN ANSWER KEY.
2. RIGID SCORING BRACKETS:
   - High Marks (8–10 / 10): Factually flawless mechanism/procedure aligning strictly with all required elements in the ADMIN ANSWER KEY.
   - Partial Marks (4–6 / 10): Conceptually correct core idea matching the key, but missing minor supporting steps.
   - Major Errors / Low Marks (1–3 / 10): Contains significant factual/anatomical errors, relies on unlisted precursor pathways, uses incorrect terminology, or misses mandatory target entities.
   - Zero Marks (0 / 10): Entirely incorrect mechanism, wrong core target entity, or completely fabricated science.
3. STRICT FACTUAL & SAFETY PENALTY: If the user states a major physiological impossibility, dangerous procedural error, or substitutes a key target entity with a precursor/informal term, you MUST NOT exceed 3 / 10.
4. STRICT FEEDBACK RULE: Address the user directly as "You". Explicitly highlight the exact points where your submission contained factual errors or improper terminology. NEVER write "the student", "the response", "provided context", "answer key", "admin key", "key", or "rubric"."""
}

SCENARIO_PROMPTS = {
    "RECALL": PRECISION_RULES + """You are an unforgiving, strict administrative medical professor evaluating a single-term or entity recall question within a clinical case scenario context.

1. BOUNDED DIAGRAM READING:
   - Cross-examine response strictly against the ADMIN ANSWER KEY ground truth.
2. Compare the Student Response strictly against the ADMIN ANSWER KEY for the target entity or clinical term described in the Case Vignette/Diagram.
3. If the user names the exact target term/entity specified in the key, award 10 / 10.
4. If the user names an incorrect term, precursor, informal synonym, or related entity not matching the key, award 0 / 10 immediately.
5. STRICT FEEDBACK RULE: Address the user directly as "You". Point out the exact clinical error directly. NEVER write "the student", "the response", "provided context", "answer key", "admin key", "key", or "rubric".""",

    "DIRECTIONAL": PRECISION_RULES + """You are an unforgiving, strict administrative medical professor evaluating a clinical directional change or physiological state vector within a clinical case scenario context.

1. Compare the Student Response strictly against the ADMIN ANSWER KEY for clinical direction in the patient's presentation.
2. If the directional state matches the ADMIN ANSWER KEY, award 10 / 10.
3. If the user states the opposite direction, wrong state, or unlisted vector, award 0 / 10. Zero partial credit allowed for non-matching facts.
4. STRICT FEEDBACK RULE: Address the user directly as "You". Point out the exact clinical error directly. NEVER write "the student", "the response", "provided context", "answer key", "admin key", "key", or "rubric".""",

    "LIST": PRECISION_RULES + """You are an unforgiving, strict administrative medical professor evaluating an itemized list, anatomical layer sequence, or multi-part recall question within a clinical case scenario context.

1. INDEPENDENT SUB-ITEM EVALUATION (FAIR PARTIAL CREDIT):
   - Treat every sub-label or item (e.g., A, B, C) as an INDEPENDENT evaluation node.
   - DO NOT penalize correct sub-items due to errors in adjacent sub-items.
   - MULTI-SYSTEM CLARIFICATION: Accept standard clinical terminology matching the target system represented in the question stem or diagram (e.g., endometrial histology vs. ovarian cycle phases). If a sub-item matches the required term, award full credit for that sub-item.
2. COUNT REQUIRED ITEMS (N) & AUDIT USER ITEMS (C):
   - Determine total items required (N) based on the ADMIN ANSWER KEY.
   - Count correct items (C) strictly line-by-line.
3. RIGID MATHEMATICAL SCORING (COMPUTED MATH):
   - Calculate score: Score = min(round((C / N) * 10), max_allowed_score).
   - If C = 3 of 3 correct: Score MUST be 10 / 10.
   - If C = 2 of 3 correct: Score MUST be 7 / 10.
   - If C = 1 of 3 correct: Score MUST be 3 / 10 (or 3.3 scaled).
   - ABSOLUTE ZERO GUARD: If C > 0, you are STRICTLY FORBIDDEN from returning a score of 0 / 10.
4. ISOLATED FEEDBACK DIRECTIVE:
   - Validate and praise all sub-items that are correct.
   - Restrict negative feedback and clinical corrections ONLY to mismatched or incorrect sub-items.
   - NEVER fabricate errors on a correct sub-item to justify a score reduction.
5. STRICT FEEDBACK RULE: Address the user directly as "You". Call out every incorrect or fabricated term identified, state the correct standard medical terminology, and explain the clinical impact of the error. NEVER write "the student", "the response", "provided context", "answer key", "admin key", "key", or "rubric".""",

    "EXPLANATION": PRECISION_RULES + """You are an unforgiving, strict administrative medical professor evaluating an explanatory physiological mechanism or procedural question within a clinical case scenario context.

1. Evaluate core medical mechanisms, anatomical landmarks, target organs, and signaling pathways directly against required concepts in the ADMIN ANSWER KEY.
2. RIGID SCORING BRACKETS:
   - High Marks (8–10 / 10): Factually flawless mechanism/procedure aligning strictly with all required elements in the ADMIN ANSWER KEY.
   - Partial Marks (4–6 / 10): Conceptually correct core idea matching the key, but missing minor supporting steps.
   - Major Errors / Low Marks (1–3 / 10): Contains significant factual/anatomical errors, relies on unlisted precursor pathways, uses incorrect terminology, or misses mandatory target entities.
   - Zero Marks (0 / 10): Entirely incorrect mechanism, wrong core target entity, or completely fabricated science.
3. STRICT FACTUAL & SAFETY PENALTY: If the user states a major physiological impossibility, dangerous procedural error, or substitutes a key target entity with a precursor/informal term, you MUST NOT exceed 3 / 10.
4. STRICT FEEDBACK RULE: Address the user directly as "You". Explicitly highlight the exact points where your submission contained factual errors or improper terminology. NEVER write "the student", "the response", "provided context", "answer key", "admin key", "key", or "rubric"."""
}
def parse_ai_json(raw_text: str) -> dict:
    """Extracts score and reasoning from LLM output while stripping scratchpads, markdown blocks, and thinking tags."""
    if not raw_text or not raw_text.strip():
        return {"score": 0, "reasoning": "AI evaluation engine returned an empty response."}

    # 1. Clean scratchpads, thinking blocks, and markdown code fencing
    cleaned = re.sub(r'<think>.*?</think>', '', raw_text, flags=re.DOTALL)
    cleaned = re.sub(r'```(?:json)?', '', cleaned, flags=re.IGNORECASE)
    cleaned = cleaned.replace('```', '').strip()

    def extract_fields(data_dict: dict) -> dict:
        """Safely parses score (supports int/float/numeric string) and cleans reasoning."""
        raw_score = data_dict.get("score", 0)
        
        try:
            # Safely cast numeric strings or floats (e.g., "3", 3.33) without throwing ValueError
            numeric_score = round(float(raw_score))
        except (ValueError, TypeError):
            numeric_score = 0

        score_val = max(0, min(10, numeric_score))
        
        reasoning_val = str(
            data_dict.get("reasoning") or 
            data_dict.get("assessment") or 
            data_dict.get("feedback") or 
            ""
        ).strip()

        # Unescape escaped JSON quotes or newlines if raw regex was used
        reasoning_val = reasoning_val.encode().decode('unicode_escape', errors='ignore') if '\\' in reasoning_val else reasoning_val

        if not reasoning_val:
            reasoning_val = "You provided a complete and correct response."

        return {"score": score_val, "reasoning": reasoning_val}

    # 2. Try direct JSON parsing
    try:
        data = json.loads(cleaned)
        if isinstance(data, dict):
            return extract_fields(data)
    except Exception:
        pass

    # 3. Fallback: Extract outermost JSON object via Greedy Match
    json_match = re.search(r'\{[\s\S]*\}', cleaned)
    if json_match:
        try:
            data = json.loads(json_match.group(0))
            if isinstance(data, dict):
                return extract_fields(data)
        except Exception:
            pass

    # 4. Fallback: Direct Regex Field Extraction (handles truncated or malformed JSON output)
    score_match = re.search(r'"score"\s*:\s*([0-9]+(?:\.[0-9]+)?)', cleaned)
    score_raw = score_match.group(1) if score_match else "0"
    
    try:
        score_num = round(float(score_raw))
    except ValueError:
        score_num = 0

    reasoning_match = re.search(r'"(?:reasoning|assessment|feedback)"\s*:\s*"([^"\\]*(?:\\.[^"\\]*)*)"', cleaned, re.DOTALL)
    
    if reasoning_match:
        raw_reasoning = reasoning_match.group(1)
        # Process backslash escapes from regex capture
        try:
            reasoning = raw_reasoning.encode('utf-8').decode('unicode_escape')
        except Exception:
            reasoning = raw_reasoning
    else:
        # Ultimate fallback if reasoning key quotes were cut off mid-stream
        reasoning = "Evaluation completed successfully."

    return {
        "score": max(0, min(10, score_num)),
        "reasoning": reasoning.strip()
    }

async def call_groq_with_retry(messages: list, target_model: str, max_retries: int = 4):
    """Executes non-blocking Groq API requests with an async concurrency queue and exponential backoff retry logic."""
    async with GROQ_CONCURRENCY_LIMITER:
        delay = 1.5
        for attempt in range(1, max_retries + 1):
            try:
                kwargs = {
                    "model": target_model,
                    "messages": messages,
                    "temperature": 0.0,
                }
                
                if "qwen" in target_model.lower():
                    kwargs["extra_body"] = {"reasoning_effort": "none"}

                return await groq_client.chat.completions.create(**kwargs)

            except RateLimitError as rle:
                if attempt == max_retries:
                    print(f"❌ Rate Limit Exhausted on attempt {attempt}/{max_retries}.")
                    raise rle
                print(f"⚠️ Groq Rate Limit (429) hit on attempt {attempt}/{max_retries}. Retrying in {delay}s...")
                await asyncio.sleep(delay)
                delay *= 2

            except APIError as api_err:
                if attempt == max_retries:
                    print(f"❌ Groq API Error on attempt {attempt}/{max_retries}: {api_err}")
                    raise api_err
                print(f"⚠️ Groq API Error on attempt {attempt}/{max_retries}: {api_err}. Retrying in {delay}s...")
                await asyncio.sleep(delay)

# ==========================================
# 3. ENDPOINTS
# ==========================================

@app.post("/admin/login")
def admin_login(credentials: AdminLoginRequest):
    if credentials.name == "Daniel Phiri" and credentials.username == "cbucnl-287-ah":
        return {
            "name": "Daniel Phiri",
            "studentNumber": "cbucnl-287-ah",
            "program": "ALL",
            "year": "ALL",
            "role": "SUPER_ADMIN",
            "accessMode": "ADMIN_HUB"
        }
        
    elif credentials.name == "D@niel Phiri" and credentials.username in ["cbucnl-287-a"]:
        return {
            "name": "D@niel Phiri",
            "studentNumber": "cbucnl-287-a",
            "program": "ALL",
            "year": "ALL",
            "role": "SUPER_ADMIN",
            "accessMode": "GODMODE_DASHBOARD"
        }
        
    raise HTTPException(
        status_code=401, 
        detail="Invalid portal access credentials."
    )

# ----------------------------
# 🟢 Upload Diagram Endpoint (Supabase Storage Cloud Integration)
# ----------------------------

@app.post("/upload-diagram")
async def upload_diagram(file: UploadFile = File(...)):
    """Uploads question diagrams directly to Supabase Cloud Storage and returns a permanent public URL."""
    try:
        contents = await file.read()
        extension = os.path.splitext(file.filename)[1] or ".png"
        unique_filename = f"diagram_{uuid.uuid4().hex}{extension}"
        storage_path = f"diagrams/{unique_filename}"

        if supabase_client:
            # Upload directly to the 'question-diagrams' Supabase bucket
            res = supabase_client.storage.from_("question-diagrams").upload(
                path=storage_path,
                file=contents,
                file_options={"content-type": file.content_type or "image/png"}
            )
            
            # Retrieve the permanent public URL
            public_url = supabase_client.storage.from_("question-diagrams").get_public_url(storage_path)
            print(f"☁️ Successfully uploaded diagram to Supabase Storage: {public_url}")
            return {"image_url": public_url}

        else:
            # Fallback to local storage if Supabase credentials are missing locally
            os.makedirs(os.path.join("static", "diagrams"), exist_ok=True)
            local_path = os.path.join("static", "diagrams", unique_filename)
            with open(local_path, "wb") as buffer:
                buffer.write(contents)
            return {"image_url": f"/static/diagrams/{unique_filename}"}

    except Exception as e:
        print(f"❌ Diagram Upload Error: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to upload diagram image to Supabase Cloud: {str(e)}"
        )

# ----------------------------
# 🟢 Course Notes Endpoints
# ----------------------------

@app.post("/notes", response_model=CourseNoteResponse)
def create_note(note: CourseNoteCreate, db: Session = Depends(get_db)):
    db_note = models.CourseNote(
        title=note.title,
        content=note.content,
        patient_id=note.patient_id
    )
    db.add(db_note)
    db.commit()
    db.refresh(db_note)

    try:
        pusher_client.trigger("notes-channel", "note_published", {
            "id": db_note.id,
            "title": db_note.title,
            "patient_id": getattr(db_note, "patient_id", None)
        })
    except Exception as e:
        print(f"⚠️ Real-time broadcast failed (Pusher error ignored): {e}")

    return db_note

@app.get("/notes", response_model=List[CourseNoteResponse])
def get_notes(student_number: Optional[str] = Header(None), db: Session = Depends(get_db)):
    if student_number:
        student = db.query(models.StudentRegistry).filter(
            models.StudentRegistry.student_number == student_number
        ).first()
        
        if student and student.payment_status == "PAID" and student.payment_expiry:
            if datetime.utcnow() > student.payment_expiry.replace(tzinfo=None):
                student.payment_status = "UNPAID"
                db.commit()
                pusher_client.trigger(f"student-{student_number}", "payment_status_updated", {
                    "payment_status": "UNPAID", 
                    "payment_expiry": None
                })
                raise HTTPException(status_code=402, detail="Subscription Expired")
                
        if not student or student.payment_status != "PAID":
            raise HTTPException(status_code=402, detail="Payment Required")
            
    return db.query(models.CourseNote).all()

# ----------------------------
# 🟢 Assessments Endpoints
# ----------------------------

@app.post("/assessments", response_model=AssessmentResponse)
def create_assessment(
    assessment: AssessmentCreate, 
    student_number: Optional[str] = Header(None),
    db: Session = Depends(get_db)
):
    if student_number:
        student = db.query(models.StudentRegistry).filter(
            models.StudentRegistry.student_number == student_number
        ).first()

        if student and student.payment_status == "PAID" and student.payment_expiry:
            if datetime.utcnow() > student.payment_expiry.replace(tzinfo=None):
                student.payment_status = "UNPAID"
                db.commit()
                
                pusher_client.trigger(f"student-{student_number}", "payment_status_updated", {
                    "payment_status": "UNPAID",
                    "payment_expiry": None
                })
                raise HTTPException(status_code=402, detail="Subscription Timeline Exhausted.")

        if not student or student.payment_status != "PAID":
            raise HTTPException(status_code=402, detail="Access Restricted: Active payment required.")

    note = db.query(models.CourseNote).filter(models.CourseNote.id == assessment.note_id).first()
    if not note:
        placeholder_note = models.CourseNote(
            id=assessment.note_id,
            title="Auto-Generated Workspace Note",
            content="This note was automatically created to host assessments.",
            patient_id=None
        )
        db.add(placeholder_note)
        db.commit()
        db.refresh(placeholder_note)
        
    db_assessment = models.Assessment(
        note_id=assessment.note_id,
        questions=assessment.questions
    )
    db.add(db_assessment)
    db.commit()
    db.refresh(db_assessment)

    try:
        pusher_client.trigger("assessments-channel", "assessment_published", {
            "id": db_assessment.id,
            "note_id": db_assessment.note_id,
            "status": "published"
        })
    except Exception as e:
        print(f"[Pusher Warning] Could not broadcast assessment update: {e}")

    return db_assessment

@app.get("/notes/{note_id}/assessments", response_model=List[AssessmentResponse])
def get_assessments_by_note(
    note_id: int, 
    student_number: Optional[str] = Header(None),
    db: Session = Depends(get_db)
):
    if student_number:
        student = db.query(models.StudentRegistry).filter(
            models.StudentRegistry.student_number == student_number
        ).first()

        if student and student.payment_status == "PAID" and student.payment_expiry:
            if datetime.utcnow() > student.payment_expiry.replace(tzinfo=None):
                student.payment_status = "UNPAID"
                db.commit()
                
                pusher_client.trigger(f"student-{student_number}", "payment_status_updated", {
                    "payment_status": "UNPAID",
                    "payment_expiry": None
                })
                raise HTTPException(status_code=402, detail="Subscription Timeline Exhausted.")

        if not student or student.payment_status != "PAID":
            raise HTTPException(status_code=402, detail="Access Restricted: Active payment required.")

    assessments = db.query(models.Assessment).filter(models.Assessment.note_id == note_id).all()
    return assessments

@app.delete("/notes/{note_id}/assessments/{assessment_id}")
def delete_assessment_by_note(note_id: int, assessment_id: int, db: Session = Depends(get_db)):
    db_assessment = db.query(models.Assessment).filter(
        models.Assessment.id == assessment_id,
        models.Assessment.note_id == note_id
    ).first()
    
    if not db_assessment:
        raise HTTPException(
            status_code=404, 
            detail=f"Assessment with ID {assessment_id} under Note ID {note_id} not found."
        )
        
    db.delete(db_assessment)
    db.commit()
    return {"message": f"Assessment {assessment_id} under Note {note_id} successfully deleted from database."}

@app.delete("/assessments/{assessment_id}")
def delete_assessment_directly(assessment_id: int, db: Session = Depends(get_db)):
    db_assessment = db.query(models.Assessment).filter(models.Assessment.id == assessment_id).first()
    
    if not db_assessment:
        raise HTTPException(
            status_code=404, 
            detail=f"Assessment with ID {assessment_id} not found."
        )
        
    db.delete(db_assessment)
    db.commit()
    return {"message": f"Assessment {assessment_id} successfully deleted directly from database."}

@app.delete("/notes/{note_id}")
def delete_note(note_id: int, db: Session = Depends(get_db)):
    db_note = db.query(models.CourseNote).filter(models.CourseNote.id == note_id).first()
    
    if not db_note:
        raise HTTPException(
            status_code=404, 
            detail=f"Course note with ID {note_id} not found."
        )
    
    try:
        db.query(models.Assessment).filter(models.Assessment.note_id == note_id).delete()
        db.delete(db_note)
        db.commit()
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=500,
            detail=f"Database transaction failed while purging note: {str(e)}"
        )
        
    return {"message": f"Course note {note_id} and all related assessments successfully scrubbed."}

# ----------------------------
# 🟢 Deterministic Scoring & Verification Helpers
# ----------------------------

from typing import Tuple, List, Dict, Union, Any

def compute_strict_score(user_submission_dict: dict, admin_key_dict: dict) -> Tuple[int, int, int, List[dict]]:
    """
    Programmatically calculates exact or substring matches (C) out of total items (N).
    Enforces fair partial credit calculation, normalizes formatting variations, 
    and returns granular feedback details for LLM prompt context injection.
    """
    total_items = len(admin_key_dict)
    if total_items == 0:
        return 0, 0, 0, []

    # Normalize user keys to uppercase to handle casing mismatches (e.g., 'a' vs 'A')
    normalized_user_dict = {str(k).strip().upper(): str(v).strip() for k, v in user_submission_dict.items()}

    correct_count = 0
    mismatches = []

    for raw_key, target_val in admin_key_dict.items():
        key_lookup = str(raw_key).strip().upper()
        target_val_str = str(target_val).strip()
        
        # Extract user input safely
        user_val = normalized_user_dict.get(key_lookup, "")

        # Clean string values for flexible clinical match comparison
        user_clean = user_val.lower()
        target_clean = target_val_str.lower()

        # Check for direct match or valid substring inclusion (e.g., "Menstrual" in "Menstrual phase")
        is_match = False
        if user_clean and target_clean:
            if user_clean == target_clean or user_clean in target_clean or target_clean in user_clean:
                is_match = True

        if is_match:
            correct_count += 1
        else:
            mismatches.append({
                "item": str(raw_key).strip(),
                "submitted": user_val if user_val else "Not provided",
                "expected": target_val_str
            })

    # Linear mathematical scaling rounded to nearest integer (e.g., 1/3 -> 3.33 -> 3, 2/3 -> 6.67 -> 7)
    calculated_score = round((correct_count / total_items) * 10)

    return calculated_score, correct_count, total_items, mismatches


def validate_output_score(parsed_result: dict, expected_score: int) -> dict:
    """
    Hard-overrides the returned JSON score to match the programmatically calculated score.
    Also cleans any score mismatch inside the reasoning text.
    """
    parsed_result["score"] = expected_score

    # Fix score text inside reasoning if the LLM outputted a conflicting score string
    reasoning_text = parsed_result.get("reasoning", "")
    score_match = re.search(r'(\d+)\s*/\s*10', reasoning_text)

    if score_match:
        found_score = int(score_match.group(1))
        if found_score != expected_score:
            reasoning_text = reasoning_text.replace(f"{found_score}/10", f"{expected_score}/10")
            reasoning_text = reasoning_text.replace(f"{found_score} / 10", f"{expected_score} / 10")
            parsed_result["reasoning"] = reasoning_text

    return parsed_result


async def prepare_image_for_groq(image_url: str) -> Optional[str]:
    """Passes direct public Supabase URLs or converts legacy local disk images into Base64 format."""
    if not image_url:
        return None

    if image_url.startswith(("http://", "https://", "data:image")):
        return image_url

    def _sync_read():
        filename = os.path.basename(image_url.split("?")[0])
        possible_paths = [
            os.path.join("static", "diagrams", filename),
            os.path.join("static", filename),
            image_url.lstrip("/")
        ]

        for local_path in possible_paths:
            if os.path.exists(local_path) and os.path.isfile(local_path):
                try:
                    with open(local_path, "rb") as file:
                        encoded_string = base64.b64encode(file.read()).decode("utf-8")
                        ext = os.path.splitext(local_path)[1].lower().lstrip(".")
                        mime = "png" if ext in ["png", ""] else ("jpeg" if ext in ["jpg", "jpeg"] else ext)
                        return f"data:image/{mime};base64,{encoded_string}"
                except Exception as e:
                    print(f"⚠️ Failed to read local image file {local_path}: {e}")
        return image_url

    return await asyncio.to_thread(_sync_read)

# ----------------------------
# 🟢 Groq AI Evaluation Endpoint
# ----------------------------

@app.post("/assessments/evaluate", response_model=EvaluationResult)
async def evaluate_student_long_answer(payload: GradeRequest):
    try:
        is_scenario = bool(payload.vignette_context and payload.vignette_context.strip())
        raw_img = (payload.image_url or "").strip()
        has_image = bool(raw_img and raw_img.lower() not in ["none", "null", "undefined"])

        # -------------------------------------------------------------
        # 1. ALWAYS AUDIT MULTI-ITEM RESPONSES (HANDLES STRINGS + JSON)
        # -------------------------------------------------------------
        # Parse inputs into dictionary maps using generic parser (supports JSON or 'A: val\nB: val')
        student_dict = parse_student_response_to_dict(payload.student_response)
        admin_dict = parse_student_response_to_dict(payload.ai_answer_key)

        system_eval_prompt = ""
        locked_score = None

        # Execute programmatic audit whenever the key contains multiple items (e.g., A, B, C)
        if len(admin_dict) > 1 and len(student_dict) > 0:
            calculated_score, correct_count, total_items, mismatches = compute_strict_score(student_dict, admin_dict)
            locked_score = calculated_score

            system_eval_prompt = f"""\n\nSYSTEM OVERRIDE - SCORE IS LOCKED AT {calculated_score} / 10:
The deterministic grading engine has audited the student response against the database.
- MANDATORY SCORE: {calculated_score} / 10
- TOTAL ITEMS (N): {total_items}
- CORRECT MATCHES (C): {correct_count}
- MISMATCHED ITEMS: {mismatches}

YOUR TASK:
Write the clinical feedback for the student.
1. State the score as EXACTLY {calculated_score} / 10.
2. Explicitly acknowledge and praise the correct items. DO NOT mark them as incorrect or invent false errors.
3. Restrict all negative feedback ONLY to the mismatched items listed above ({mismatches}). Explain why the submitted term fails exact medical standardization compared to the target term.
4. DO NOT change the score. DO NOT give a 0/10 score when C > 0.
"""

        # -------------------------------------------------------------
        # 2. CONSTRUCT PROMPTS & FORCE LIST ROUTE IF APPLICABLE
        # -------------------------------------------------------------
        q_type = payload.question_type.upper() if payload.question_type else "RECALL"
        if len(admin_dict) > 1:
            q_type = "LIST"

        if is_scenario:
            base_instruction = SCENARIO_PROMPTS.get(q_type, SCENARIO_PROMPTS["RECALL"])
            text_prompt = (
                f"CASE VIGNETTE CONTEXT:\n{payload.vignette_context.strip()}\n\n"
                f"SUB-QUESTION STEM: {payload.question_stem.strip()}\n\n"
                f"ADMIN ANSWER KEY: {payload.ai_answer_key.strip()}\n\n"
                f"STUDENT RESPONSE: {payload.student_response.strip()}"
            )
        else:
            base_instruction = PROMPTS.get(q_type, PROMPTS["RECALL"])
            text_prompt = (
                f"QUESTION STEM: {payload.question_stem.strip()}\n\n"
                f"ADMIN ANSWER KEY: {payload.ai_answer_key.strip()}\n\n"
                f"STUDENT RESPONSE: {payload.student_response.strip()}"
            )

        if has_image:
            spatial_instruction = (
                "VISUAL DIAGRAM GROUNDING DIRECTIVE:\n"
                "1. Explicitly trace x-axis intervals and label markers (e.g., Box A = Days 0-4, Box B = Days 4-14, Box C = Days 14-28).\n"
                "2. ALWAYS anchor your visual reading to the ADMIN ANSWER KEY to avoid spatial or letter-shift inversions.\n\n"
            )
            text_prompt = spatial_instruction + text_prompt

        target_model = "qwen/Qwen3.8-27B"

        if has_image:
            image_url_str = await prepare_image_for_groq(raw_img)
            user_content = [
                {"type": "text", "text": text_prompt},
                {"type": "image_url", "image_url": {"url": image_url_str}}
            ]
        else:
            user_content = text_prompt

        # Output format specification
        expected_score_repr = locked_score if locked_score is not None else 10
        format_directive = (
            "\n\nSYSTEM INSTRUCTION: You are a JSON-only API generator.\n"
            "Output MUST be valid JSON formatted exactly like this:\n"
            f'{{"score": {expected_score_repr}, "reasoning": "Detailed feedback addressing the user as You."}}\n'
            "CRITICAL RULES:\n"
            "1. Start response immediately with '{{' and end with '}}'.\n"
            "2. DO NOT write scratchpads or markdown formatting outside the JSON."
        )

        messages = [
            {"role": "system", "content": base_instruction + system_eval_prompt + format_directive},
            {"role": "user", "content": user_content}
        ]

        response = await call_groq_with_retry(
            messages=messages, 
            target_model=target_model
        )
        raw_text = response.choices[0].message.content or ""

        parsed_result = parse_ai_json(raw_text)

        # Enforce hard-override ONLY if a deterministic audit was calculated
        if locked_score is not None:
            parsed_result = validate_output_score(parsed_result, locked_score)

        print(f"✨ Groq Evaluation ({target_model}) [{q_type}] [Image Attached: {has_image}]: {parsed_result['score']}/10")

        return parsed_result

    except Exception as e:
        print(f"❌ Groq AI Grading Error: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to communicate with AI grading engine: {str(e)}"
        )
