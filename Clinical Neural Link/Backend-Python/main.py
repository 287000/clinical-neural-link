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

from typing import Optional, Literal
from pydantic import BaseModel, Field

from typing import Literal, Optional, List, Dict, Any
from pydantic import BaseModel, Field

class ConceptRubricItem(BaseModel):
    concept_id: str
    weight: float = Field(..., description="Points assigned to this specific concept point.")
    description: str = Field(..., description="Summary of the expected concept or idea.")
    required_keywords: List[str] = Field(
        default_factory=list, 
        description="Synonyms or required key phrases for token/keyword matching."
    )

class AdminAnswerKey(BaseModel):
    raw_key: str = Field(..., description="The main ground truth string or sample answer provided by the admin.")
    accepted_synonyms: List[str] = Field(
        default_factory=list, 
        description="Accepted alternative terms (e.g. parsed from '/')."
    )
    concept_matrix: Optional[List[ConceptRubricItem]] = Field(
        default=None, 
        description="Structured rubric items used for EXPLANATION / Essay questions."
    )

class GradeRequest(BaseModel):
    sub_question_id: Optional[str] = Field(default=None, description="Unique ID/label for the sub-question (e.g. '1.1' or 'A').")
    question_stem: str
    admin_answer_key: AdminAnswerKey = Field(..., description="The non-negotiable source of truth data structure.")
    student_response: str
    question_type: Literal["RECALL", "DIRECTIONAL", "LIST", "EXPLANATION"] = "RECALL"
    max_marks: float = Field(default=10.0, description="The mark allocation for this specific sub-question.")
    vignette_context: Optional[str] = None
    image_url: Optional[str] = Field(
        default=None, 
        description="Hard-locked to None to enforce pure-text adherence to the Admin Answer Key."
    )
    def __init__(self, **data):
        # Force image_url to None regardless of payload input
        data["image_url"] = None
        super().__init__(**data)

from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field

class PythonAuditResult(BaseModel):
    score: int = Field(..., description="The pre-calculated integer score (0-10) computed by Python.")
    correct_count: int = Field(..., description="Number of admin rubric items successfully matched.")
    total_items: int = Field(..., description="Total number of admin rubric items required.")
    matches: List[Dict[str, Any]] = Field(default_factory=list, description="List of matched terms or concepts.")
    mismatches: List[Dict[str, Any]] = Field(default_factory=list, description="List of failed or missing terms/concepts.")
    is_perfect: bool = Field(default=False, description="Flag indicating a 10/10 exact match.")

class EvaluationResult(BaseModel):
    score: int = Field(..., description="The locked integer score (0 to 10) generated by the Python audit engine.")
    reasoning: str = Field(..., description="Grounded, natural-language feedback generated by the LLM explaining the audit.")
    audit_details: Optional[PythonAuditResult] = Field(
        default=None, 
        description="Optional detailed audit breakdown for internal logging or UI analytics."
    )

class AdminLoginRequest(BaseModel):
    username: str
    name: str

# ==========================================
# 2. GROUNDED SYSTEM PROMPT (AUDIT TRANSLATOR)
# ==========================================

AUDIT_TRANSLATION_PROMPT = """YOU ARE A CLINICAL ASSISTANT GENERATING FEEDBACK FOR A MEDICAL STUDENT.
YOUR SOLE ROLE IS TO EXPLAIN THE PRE-COMPUTED EVALUATION AUDIT REPORT IN A HELPFUL, DIRECT MANNER.

CRITICAL CONSTRAINTS:
1. THE SCORE IS LOCKED AT {score} / 10. DO NOT ALTER, RECALCULATE, OR ADJUST THIS SCORE UNDER ANY CIRCUMSTANCE.
2. THE ADMIN ANSWER KEY IS THE SINGLE GROUND TRUTH.
3. FOR MATCHED ITEMS: Validate the response cleanly without altering the score.
4. FOR MISMATCHED ITEMS: State clearly that the submitted term/concept did not match the ground truth. State the expected standard medical term directly from the audit report.
5. DO NOT invent clinical technicalities, alternate subtypes, or extraneous justifications for why an answer failed if it is simply marked as a MISMATCH.
6. MANDATORY PERSPECTIVE: Address the student directly as "You". 
7. NEVER use meta-language: Do NOT write "the admin key", "the student", "the Python audit", "the backend", "the prompt", or "the rubric". Frame everything as direct clinical feedback.

QUESTION STEM:
"{question_stem}"

VIGNETTE CONTEXT:
"{vignette_context}"

PRE-COMPUTED AUDIT DATA:
- Locked Score: {score} / 10
- Matched Items: {matches}
- Mismatched / Missing Items: {mismatches}
"""
import re
import json

def parse_ai_feedback(raw_text: str, pre_computed_score: int) -> dict:
    """
    Extracts purely the natural language feedback from LLM output,
    ignoring any score attempt by the LLM and attaching Python's pre-computed score.
    """
    if not raw_text or not raw_text.strip():
        return {
            "score": pre_computed_score, 
            "reasoning": "AI feedback engine returned an empty response."
        }

    # 1. Clean scratchpads, thinking blocks (<think> tags), and markdown blocks
    cleaned = re.sub(r'<think>.*?</think>', '', raw_text, flags=re.DOTALL)
    cleaned = re.sub(r'```(?:json)?', '', cleaned, flags=re.IGNORECASE)
    cleaned = cleaned.replace('```', '').strip()

    def extract_reasoning_str(data_dict: dict) -> str:
        """Extracts and sanitizes the reasoning/feedback text field."""
        reasoning_val = str(
            data_dict.get("reasoning") or 
            data_dict.get("assessment") or 
            data_dict.get("feedback") or 
            ""
        ).strip()

        if '\\' in reasoning_val:
            try:
                reasoning_val = reasoning_val.encode().decode('unicode_escape', errors='ignore')
            except Exception:
                pass

        return reasoning_val

    # 2. Direct JSON parsing
    try:
        data = json.loads(cleaned)
        if isinstance(data, dict):
            reasoning = extract_reasoning_str(data)
            if reasoning:
                return {"score": pre_computed_score, "reasoning": reasoning}
    except Exception:
        pass

    # 3. Fallback: Search for outer JSON object via Regex
    json_match = re.search(r'\{[\s\S]*\}', cleaned)
    if json_match:
        try:
            data = json.loads(json_match.group(0))
            if isinstance(data, dict):
                reasoning = extract_reasoning_str(data)
                if reasoning:
                    return {"score": pre_computed_score, "reasoning": reasoning}
        except Exception:
            pass

    # 4. Fallback: Plain-text fallback if the LLM output raw prose instead of JSON
    reasoning_match = re.search(
        r'"(?:reasoning|assessment|feedback)"\s*:\s*"([^"\\]*(?:\\.[^"\\]*)*)"', 
        cleaned, 
        re.DOTALL
    )
    
    if reasoning_match:
        raw_reasoning = reasoning_match.group(1)
        try:
            reasoning = raw_reasoning.encode('utf-8').decode('unicode_escape')
        except Exception:
            reasoning = raw_reasoning
    else:
        # If no JSON key structure was returned, treat the entire cleaned text as feedback
        reasoning = cleaned if cleaned else "Evaluation completed successfully."

    return {
        "score": pre_computed_score,
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
                    "response_format": {"type": "json_object"},  # Enforces valid JSON structure output
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
import json
import re
from typing import Tuple, List, Dict, Union, Any, Optional

def parse_student_response_to_dict(response_str: Any) -> dict:
    """
    Safely parses JSON strings, structured key-value lines, inline comma-separated items,
    or unstructured lists into a clean dictionary.
    """
    if not response_str:
        return {}

    if isinstance(response_str, dict):
        return response_str

    text = str(response_str).strip()

    # Attempt direct JSON parsing first
    try:
        parsed = json.loads(text)
        if isinstance(parsed, dict):
            return parsed
    except Exception:
        pass

    result = {}

    # 1. Inline comma/semicolon parsing (e.g., "A: Menstrual phase, B: Proliferative phase")
    inline_matches = re.findall(r'(?:Box\s+)?([A-Za-z0-9]+)[\.\:\-\)]\s*([^,;\n]+)', text, re.IGNORECASE)
    if len(inline_matches) > 1:
        for k, v in inline_matches:
            result[k.strip().upper()] = v.strip()
        return result

    # 2. Line-by-line parsing for multiline formatted submissions
    lines = text.splitlines()
    for line in lines:
        line = line.strip()
        if not line:
            continue

        match = re.match(r'^(?:Box\s+)?([A-Za-z0-9]+)[\.\:\-\)\s]+(.+)$', line, re.IGNORECASE)
        if match:
            k, v = match.groups()
            result[k.strip().upper()] = v.strip()

    # 3. Fallback: Chunk unkeyed line-by-line text into numeric keys
    if not result and len(lines) > 0:
        for idx, line in enumerate(lines):
            line_str = line.strip()
            if line_str:
                result[str(idx + 1)] = line_str

    return result


def compute_strict_score(
    user_submission: Union[str, dict], 
    admin_key_obj: Any,  # AdminAnswerKey Pydantic model or dict
    question_type: str = "RECALL"
) -> PythonAuditResult:
    """
    Programmatically calculates exact or synonym matches (C) out of total items (N).
    Enforces absolute adherence to Admin Answer Key ground truth and returns a PythonAuditResult object.
    """
    # 1. Normalize Admin Key Target & Accepted Synonyms
    if hasattr(admin_key_obj, "raw_key"):
        raw_key_str = admin_key_obj.raw_key
        accepted_synonyms = getattr(admin_key_obj, "accepted_synonyms", [])
    elif isinstance(admin_key_obj, dict):
        raw_key_str = admin_key_obj.get("raw_key", "")
        accepted_synonyms = admin_key_obj.get("accepted_synonyms", [])
    else:
        raw_key_str = str(admin_key_obj)
        accepted_synonyms = []

    # Automatically extract slash-separated synonyms from raw_key if present (e.g. "Term A / Term B")
    if "/" in raw_key_str:
        split_keys = [k.strip() for k in raw_key_str.split("/") if k.strip()]
        target_options = list(set(split_keys + accepted_synonyms))
    else:
        target_options = list(set([raw_key_str] + accepted_synonyms))

    # 2. Parse User Input
    if question_type == "LIST":
        user_dict = parse_student_response_to_dict(user_submission)
        # Handle dict-based admin key for multi-part LIST questions
        if isinstance(admin_key_obj, dict) and "items" in admin_key_obj:
            admin_dict = admin_key_obj["items"]
        else:
            admin_dict = {"1": raw_key_str}
    else:
        user_dict = {"1": str(user_submission).strip()}
        admin_dict = {"1": target_options}

    total_items = len(admin_dict)
    if total_items == 0:
        return PythonAuditResult(
            score=0, correct_count=0, total_items=0, matches=[], mismatches=[], is_perfect=False
        )

    normalized_user_dict = {str(k).strip().upper(): str(v).strip() for k, v in user_dict.items()}

    correct_count = 0
    matches = []
    mismatches = []

    # 3. Deterministic Matching Engine
    for raw_key, target_val in admin_dict.items():
        key_lookup = str(raw_key).strip().upper()
        
        if isinstance(target_val, list):
            valid_targets = [str(t).strip() for t in target_val]
        else:
            valid_targets = [str(target_val).strip()]

        user_val = normalized_user_dict.get(key_lookup, "")
        user_clean = user_val.lower().strip()

        is_match = False
        matched_target = valid_targets[0]

        for target in valid_targets:
            target_clean = target.lower().strip()
            
            # Normalization clean checks
            user_core = re.sub(r'\b(phase|layer|level|syndrome|disease)\b', '', user_clean).strip()
            target_core = re.sub(r'\b(phase|layer|level|syndrome|disease)\b', '', target_clean).strip()

            if user_clean and target_clean:
                if user_clean == target_clean:
                    is_match = True
                    matched_target = target
                    break
                elif user_core and target_core and user_core == target_core:
                    is_match = True
                    matched_target = target
                    break

        if is_match:
            correct_count += 1
            matches.append({
                "item": str(raw_key).strip(),
                "submitted": user_val,
                "matched_key": matched_target
            })
        else:
            mismatches.append({
                "item": str(raw_key).strip(),
                "submitted": user_val if user_val else "Not provided",
                "expected": " / ".join(valid_targets)
            })

    # 4. Math Scaling to 10-Point System
    calculated_score = round((correct_count / total_items) * 10) if total_items > 0 else 0
    calculated_score = max(0, min(10, calculated_score))

    return PythonAuditResult(
        score=calculated_score,
        correct_count=correct_count,
        total_items=total_items,
        matches=matches,
        mismatches=mismatches,
        is_perfect=(correct_count == total_items)
    )


def validate_output_score(parsed_result: dict, expected_score: int) -> dict:
    """
    Hard-overrides the returned JSON score and sanitizes reasoning text
    to eliminate LLM hallucinations or negative wording contradictions.
    """
    parsed_result["score"] = expected_score
    reasoning_text = parsed_result.get("reasoning", "")

    # Overwrite score ratio hallucinations inside reasoning text (e.g. replacing "0/10" with "7/10")
    score_match = re.search(r'(\d+)\s*/\s*10', reasoning_text)
    if score_match:
        found_score = int(score_match.group(1))
        if found_score != expected_score:
            reasoning_text = reasoning_text.replace(f"{found_score}/10", f"{expected_score}/10")
            reasoning_text = reasoning_text.replace(f"{found_score} / 10", f"{expected_score} / 10")

    # Clean up harsh phrases if partial credit was awarded
    if expected_score > 0:
        harsh_phrases = [
            "Your submission is entirely incorrect.",
            "entirely incorrect",
            "zero credit",
            "failed to identify"
        ]
        for phrase in harsh_phrases:
            if phrase in reasoning_text:
                reasoning_text = reasoning_text.replace(phrase, f"You earned partial credit ({expected_score}/10).")

    parsed_result["reasoning"] = reasoning_text
    return parsed_result

async def prepare_image_for_groq(image_url: Optional[str] = None) -> Optional[str]:
    """
    Image payload preparation disabled.
    Hard-locked to return None to enforce pure-text adherence to the Admin Answer Key.
    """
    return None

# ----------------------------
# 🟢 Groq AI Evaluation Endpoint
# ----------------------------

@app.post("/assessments/evaluate", response_model=EvaluationResult)
async def evaluate_student_long_answer(payload: GradeRequest):
    try:
        # 1. Safe extraction logic to pull key content regardless of incoming attribute format
        extracted_key = ""
        
        # Check ai_answer_key attribute
        if hasattr(payload, "ai_answer_key") and payload.ai_answer_key:
            extracted_key = payload.ai_answer_key
            
        # Fallback to admin_answer_key attribute (string or dict/object)
        elif hasattr(payload, "admin_answer_key") and payload.admin_answer_key:
            admin_val = payload.admin_answer_key
            if isinstance(admin_val, dict):
                extracted_key = admin_val.get("raw_key", "") or admin_val.get("answer_key", "")
            elif hasattr(admin_val, "raw_key"):
                extracted_key = admin_val.raw_key
            else:
                extracted_key = str(admin_val)

        # Final fallback to question stem if key resolution remains empty
        if not str(extracted_key).strip():
            extracted_key = payload.question_stem or ""

        # 2. Sanitized inputs to prevent unexpected None type errors
        vignette_str = str(payload.vignette_context or "").strip()
        stem_str = str(payload.question_stem or "").strip()
        key_raw_str = str(extracted_key).strip()
        student_raw_str = str(payload.student_response or "").strip()

        is_scenario = bool(vignette_str)
        q_type = (payload.question_type or "RECALL").upper()

        # Parse structural data for list evaluation check
        student_dict = parse_student_response_to_dict(student_raw_str)
        admin_dict = parse_student_response_to_dict(key_raw_str)

        if len(admin_dict) > 1:
            q_type = "LIST"

        # 3. Deterministic Audit via Python Engine
        system_eval_prompt = ""
        locked_score: Optional[int] = None

        if len(admin_dict) > 1 and len(student_dict) > 0:
            # Construct AdminAnswerKey container or dictionary for audit
            admin_key_payload = {
                "raw_key": key_raw_str,
                "accepted_synonyms": getattr(payload, "accepted_synonyms", []) or [],
                "items": admin_dict
            }
            
            audit_result: PythonAuditResult = compute_strict_score(
                user_submission=student_dict,
                admin_key_obj=admin_key_payload,
                question_type=q_type
            )

            locked_score = audit_result.score

            # Build mismatch item breakdown for LLM context injection
            mismatch_details = ""
            if audit_result.mismatches:
                for m in audit_result.mismatches:
                    mismatch_details += f"  - Item '{m['item']}': Student submitted '{m['submitted']}', expected key is '{m['expected']}'.\n"
            else:
                mismatch_details = "  None. All submitted items matched correctly.\n"

            system_eval_prompt = f"""\n\nSYSTEM OVERRIDE - SCORE IS STRICTLY LOCKED AT {audit_result.score} / 10:
The deterministic grading engine has audited the student response against the database key.
- MANDATORY LOCKED SCORE: {audit_result.score} / 10
- TOTAL ITEMS (N): {audit_result.total_items}
- CORRECT MATCHES (C): {audit_result.correct_count}

ITEM-BY-ITEM AUDIT BREAKDOWN:
{mismatch_details}
CRITICAL DIRECTIVES FOR FEEDBACK GENERATION:
1. Output "score": {audit_result.score} in your JSON response.
2. Explicitly acknowledge correct items ({audit_result.correct_count}/{audit_result.total_items}).
3. Address each mismatched item directly based on the audit above. If terms are misplaced across labels, explain the positional swap.
4. DO NOT mark valid standard terms as invalid medical nomenclature if they simply belong to a different key position.
5. DO NOT contradict the locked score of {audit_result.score}/10 in your written reasoning.
"""

        # 4. Base Instruction and Prompt Composition with Prompt Dictionary Safeguards
        default_eval_prompt = (
            "You are an expert medical educator and evaluator. "
            "Compare the student response directly against the answer key and provide objective, "
            "constructive clinical evaluation."
        )

        if is_scenario:
            scenario_dict = globals().get("SCENARIO_PROMPTS", {})
            base_instruction = scenario_dict.get(q_type, scenario_dict.get("RECALL", default_eval_prompt))
            text_prompt = (
                f"CASE VIGNETTE CONTEXT:\n{vignette_str}\n\n"
                f"SUB-QUESTION STEM: {stem_str}\n\n"
                f"ADMIN ANSWER KEY: {key_raw_str}\n\n"
                f"STUDENT RESPONSE: {student_raw_str}"
            )
        else:
            prompts_dict = globals().get("PROMPTS", globals().get("SCENARIO_PROMPTS", {}))
            base_instruction = prompts_dict.get(q_type, prompts_dict.get("RECALL", default_eval_prompt))
            text_prompt = (
                f"QUESTION STEM: {stem_str}\n\n"
                f"ADMIN ANSWER KEY: {key_raw_str}\n\n"
                f"STUDENT RESPONSE: {student_raw_str}"
            )

        target_model = "qwen/Qwen3.8-27B"
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
            {"role": "user", "content": text_prompt}
        ]

        # 5. LLM Execution
        response = await call_groq_with_retry(
            messages=messages, 
            target_model=target_model
        )
        raw_text = response.choices[0].message.content or ""
        parsed_result = parse_ai_json(raw_text)

        # 6. Score Hard-Lock Post-Processing
        if locked_score is not None:
            parsed_result = validate_output_score(parsed_result, locked_score)

        print(f"✨ Groq Evaluation ({target_model}) [{q_type}]: {parsed_result['score']}/10")

        return EvaluationResult(**parsed_result)

    except Exception as e:
        print(f"❌ Groq AI Grading Error: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to communicate with AI grading engine: {str(e)}"
        )
