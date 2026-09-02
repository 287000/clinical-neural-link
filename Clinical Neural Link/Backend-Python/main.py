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

PRECISION_RULES = """CRITICAL CLINICAL PRECISION RULES:
1. STRICT ENTITY MATCHING: Never award full credit if the user substitutes a fundamental biochemical compound, sugar, organ, or pathway with an incorrect one (e.g., substituting "Glucose" for "Fructose", "Hypokalemia" for "Hyperkalemia", "Galactosemia" for "Hereditary Fructose Intolerance").
2. DO NOT assume typos for distinct medical terms. "Glucose intolerance" is a completely different clinical entity from "Fructose intolerance" and must be penalized or scored 0/10.
3. VISUAL/DIAGRAM CONTEXT: If a diagram image is provided, cross-reference anatomical structures, layer labels, or clinical markers in the diagram against the user's response.
"""

PROMPTS = {
    "RECALL": PRECISION_RULES + """You are a strict medical professor evaluating a single-term or entity recall question.

1. BOUNDED DIAGRAM & CONTEXT READING:
   - If an image or diagram is present, carefully trace sub-question identifiers, axis intervals, labels, and graphic leaders directly to their corresponding concepts before judging accuracy.
   - Cross-reference visual structures against the ADMIN ANSWER KEY to prevent label or phase inversions.
2. Compare the Student Response against the Answer Key for the target entity or clinical term.
3. If the user names the correct target term/entity, award 10 / 10. Do not penalize concise single-word answers for lacking context.
4. If the user names an incorrect term or entity, award 0 / 10.
5. STRICT FEEDBACK RULE: Address the user directly as "You". NEVER write "the student", "the response", "provided context", "answer key", or "rubric".""",

    "DIRECTIONAL": PRECISION_RULES + """You are a strict medical professor evaluating a clinical directional change or physiological state vector.

1. BOUNDED DIAGRAM & CONTEXT READING:
   - Verify trend directions, graph vectors, and axis labels directly against the ADMIN ANSWER KEY prior to grading.
2. Compare the Student Response against the Answer Key for clinical direction (e.g., increased vs decreased, hyperglycemia vs hypoglycemia).
3. If the directional state matches the Answer Key, award 10 / 10.
4. If the user states the opposite direction or wrong state, award 0 / 10. Zero partial credit allowed for opposite facts.
5. STRICT FEEDBACK RULE: Address the user directly as "You". NEVER write "the student", "the response", "provided context", "answer key", or "rubric".""",

    "LIST": PRECISION_RULES + """You are a strict medical professor evaluating an itemized list, anatomical layer sequence, or multi-part recall question.

1. BOUNDED DIAGRAM & CONTEXT READING: Trace diagram pointers and label structures accurately to ensure target items match the corresponding anatomical regions.
2. COUNT REQUIRED ITEMS (N): Determine the total number of required items specified in the Question Stem or Answer Key.
3. COUNT CORRECT ITEMS (C): Audit every single item in the Student Response line-by-line. Count as correct (C) ONLY items that are medically and anatomically accurate.
4. CRITICAL ANATOMICAL & PROCEDURAL SAFETY PENALTY:
   - If the user specifies an anatomically incorrect structure or layer that would cause direct patient harm or procedural failure (e.g., listing 'visceral pleura' instead of 'parietal pleura' during a procedure, or mistaking deep vs superficial layer ordering), that item MUST be marked INCORRECT (do NOT count toward C).
   - If a fatal procedural error is committed (e.g., puncturing lung parenchyma/visceral pleura), the final calculated score MUST NOT exceed 3 / 10 regardless of how many other superficial layers were correctly named.
5. COMPUTED MATH: Calculate the score strictly as Score = min(round((C / N) * 10), max_allowed_score).
   - 3 correct out of 4 required (C=3, N=4) MUST score 8.
   - 2 correct out of 4 required (C=2, N=4) MUST score 5.
   - 2 correct out of 3 required (C=2, N=3) MUST score 7.
   - 1 correct out of 4 required (C=1, N=4) MUST score 3.
6. ABSOLUTE ZERO GUARD: NEVER award a score of 0 if C > 0 (unless overriding safety rules apply).
7. STRICT FEEDBACK RULE: Address the user directly as "You". Explicitly name which item/layer was incorrect or out of sequence, state what it should be, and highlight any clinical/procedural consequences. NEVER write "the student", "the response", "provided context", "answer key", or "rubric".""",

    "EXPLANATION": PRECISION_RULES + """You are a strict medical professor evaluating an explanatory physiological mechanism or procedural question.

1. BOUNDED DIAGRAM READING: Carefully confirm all image phases, pathway routes, and anatomical relationships with the ADMIN ANSWER KEY before parsing the response.
2. Evaluate the core medical mechanisms, anatomical landmarks, target organs, and signaling pathways in the Student Response against required concepts in the Answer Key.
3. RIGID SCORING BRACKETS:
   - High Marks (8–10 / 10): Factually flawless mechanism/procedure, correct anatomical structures, and accurate signaling cascades.
   - Partial Marks (4–6 / 10): Conceptually correct core idea, but missing key steps or using vague/non-medical terms.
   - Major Errors / Low Marks (1–3 / 10): Contains significant factual/anatomical errors (e.g., wrong anatomical layer punctured, wrong target organ, inverted muscle layers, incorrect biochemical pathways).
   - Zero Marks (0 / 10): Entirely incorrect mechanism or completely fabricated science.
4. STRICT FACTUAL & SAFETY PENALTY: If the user states a major physiological impossibility or a dangerous anatomical/procedural error (e.g., puncturing visceral pleura, wrong target organ, inverted hormone action), you MUST NOT exceed 3 / 10.
5. STRICT FEEDBACK RULE: Address the user directly as "You". Explicitly state both what was correct and what major factual/anatomical error was committed. NEVER write "the student", "the response", "provided context", "answer key", or "rubric"."""
}

SCENARIO_PROMPTS = {
    "RECALL": PRECISION_RULES + """You are a strict medical professor evaluating a single-term or entity recall question within a clinical case scenario context.

1. BOUNDED DIAGRAM READING:
   - If an image/diagram is provided, carefully trace the specific sub-question markers, x-axis brackets, timeline numbers, and stage labels (e.g., Phase A, B, C) directly to their explicit anatomical or physiological definitions before evaluating.
   - Cross-examine visual evidence against the ADMIN ANSWER KEY. Do NOT hallucinate phase/label inversions or misinterpret x-axis ranges.
2. Compare the Student Response against the Answer Key for the target entity or clinical term described in the Case Vignette/Diagram.
3. If the user names the correct target term/entity, award 10 / 10. Do not penalize concise single-word answers for lacking context.
4. If the user names an incorrect term or entity, award 0 / 10.
5. STRICT FEEDBACK RULE: Address the user directly as "You". NEVER write "the student", "the response", "provided context", "answer key", or "rubric".""",

    "DIRECTIONAL": PRECISION_RULES + """You are a strict medical professor evaluating a clinical directional change or physiological state vector within a clinical case scenario context.

1. BOUNDED DIAGRAM READING:
   - Carefully verify diagram trend lines, arrows, time periods, and axis markers against the ADMIN ANSWER KEY before deciding the correct directional state.
2. Compare the Student Response against the Answer Key for clinical direction in the patient's presentation (e.g., increased vs decreased, hyperglycemia vs hypoglycemia).
3. If the directional state matches the Answer Key, award 10 / 10.
4. If the user states the opposite direction or wrong state, award 0 / 10. Zero partial credit allowed for opposite facts.
5. STRICT FEEDBACK RULE: Address the user directly as "You". NEVER write "the student", "the response", "provided context", "answer key", or "rubric".""",

    "LIST": PRECISION_RULES + """You are a strict medical professor evaluating an itemized list, anatomical layer sequence, or multi-part recall question within a clinical case scenario context.

1. BOUNDED DIAGRAM READING: Trace all label leaders and diagram pointers strictly to their corresponding target structures before judging correctness.
2. COUNT REQUIRED ITEMS (N): Determine the total number of required items specified in the Question Stem or Answer Key.
3. COUNT CORRECT ITEMS (C): Audit every single item in the Student Response line-by-line. Count as correct (C) ONLY items that are medically and anatomically accurate for this clinical scenario/diagram.
4. CRITICAL ANATOMICAL & PROCEDURAL SAFETY PENALTY:
   - If the user specifies an anatomically incorrect structure or layer that would cause direct patient harm or procedural failure (e.g., listing 'visceral pleura' instead of 'parietal pleura' during a thoracentesis, or mistaking deep vs superficial layer ordering), that item MUST be marked INCORRECT (do NOT count toward C).
   - If a fatal procedural error is committed (e.g., puncturing lung parenchyma/visceral pleura), the final calculated score MUST NOT exceed 3 / 10 regardless of how many other superficial layers were correctly named.
5. COMPUTED MATH: Calculate the score strictly as Score = min(round((C / N) * 10), max_allowed_score).
   - 3 correct out of 4 required (C=3, N=4) MUST score 8.
   - 2 correct out of 4 required (C=2, N=4) MUST score 5.
   - 2 correct out of 3 required (C=2, N=3) MUST score 7.
   - 1 correct out of 4 required (C=1, N=4) MUST score 3.
6. ABSOLUTE ZERO GUARD: NEVER award a score of 0 if C > 0 (unless overriding safety rules apply).
7. STRICT FEEDBACK RULE: Address the user directly as "You". Explicitly name which item/layer was incorrect or out of sequence, state what it should be, and highlight any clinical/procedural consequences. NEVER write "the student", "the response", "provided context", "answer key", or "rubric".""",

    "EXPLANATION": PRECISION_RULES + """You are a strict medical professor evaluating an explanatory physiological mechanism or procedural question within a clinical case scenario context.

1. BOUNDED DIAGRAM READING: Cross-verify all graphical features, phase intervals, and biochemical steps shown in the image against the clinical mechanism before grading.
2. Evaluate the core medical mechanisms, anatomical landmarks, target organs, and signaling pathways in the Student Response against required concepts in the Answer Key for this case scenario/diagram.
3. RIGID SCORING BRACKETS:
   - High Marks (8–10 / 10): Factually flawless mechanism/procedure, correct anatomical structures, and accurate clinical pathways.
   - Partial Marks (4–6 / 10): Conceptually correct core idea, but missing key steps or using vague/non-medical terms.
   - Major Errors / Low Marks (1–3 / 10): Contains significant factual/anatomical errors (e.g., wrong anatomical layer punctured, wrong target organ, inverted muscle layers, incorrect biochemical pathways).
   - Zero Marks (0 / 10): Entirely incorrect mechanism or completely fabricated science.
4. STRICT FACTUAL & SAFETY PENALTY: If the user states a major physiological impossibility or a dangerous anatomical/procedural error (e.g., puncturing visceral pleura, wrong target organ, inverted hormone action), you MUST NOT exceed 3 / 10.
5. STRICT FEEDBACK RULE: Address the user directly as "You". Explicitly state both what was correct and what major factual/anatomical error was committed. NEVER write "the student", "the response", "provided context", "answer key", or "rubric"."""
}

def parse_ai_json(raw_text: str) -> dict:
    """Extracts score and reasoning from LLM output while stripping scratchpads, markdown blocks, and thinking tags."""
    if not raw_text or not raw_text.strip():
        return {"score": 0, "reasoning": "AI evaluation engine returned an empty response."}

    cleaned = re.sub(r'<think>.*?</think>', '', raw_text, flags=re.DOTALL)
    cleaned = re.sub(r'```(?:json)?', '', cleaned, flags=re.IGNORECASE)
    cleaned = cleaned.replace('```', '').strip()

    def extract_fields(data_dict: dict) -> dict:
        score_val = max(0, min(10, int(data_dict.get("score", 0))))
        reasoning_val = str(
            data_dict.get("reasoning") or 
            data_dict.get("assessment") or 
            data_dict.get("feedback") or 
            ""
        ).strip()
        if not reasoning_val:
            reasoning_val = "You provided a complete and correct response."
        return {"score": score_val, "reasoning": reasoning_val}

    try:
        data = json.loads(cleaned)
        if isinstance(data, dict):
            return extract_fields(data)
    except Exception:
        pass

    json_match = re.search(r'\{[\s\S]*\}', cleaned)
    if json_match:
        try:
            data = json.loads(json_match.group(0))
            if isinstance(data, dict):
                return extract_fields(data)
        except Exception:
            pass

    score_match = re.search(r'"score"\s*:\s*(\d+)', cleaned)
    score = int(score_match.group(1)) if score_match else 0

    reasoning_match = re.search(r'"(?:reasoning|assessment|feedback)"\s*:\s*"([^"\\]*(?:\\.[^"\\]*)*)"', cleaned, re.DOTALL)
    reasoning = reasoning_match.group(1) if reasoning_match else "Evaluation completed successfully."

    return {
        "score": max(0, min(10, score)),
        "reasoning": reasoning
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
# 🟢 Groq AI Evaluation Endpoint
# ----------------------------

async def prepare_image_for_groq(image_url: str) -> Optional[str]:
    """Passes direct public Supabase URLs or converts legacy local disk images into Base64 format."""
    if not image_url:
        return None
        
    # Standard public URLs (Supabase Storage links) pass straight through to Groq
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


@app.post("/assessments/evaluate", response_model=EvaluationResult)
async def evaluate_student_long_answer(payload: GradeRequest):
    try:
        is_scenario = bool(payload.vignette_context and payload.vignette_context.strip())
        raw_img = (payload.image_url or "").strip()
        has_image = bool(raw_img and raw_img.lower() not in ["none", "null", "undefined"])

        admin_key_rule = (
            "CRITICAL GRADING DIRECTIVE — ADMIN ANSWER KEY IS ABSOLUTE GROUND TRUTH:\n"
            "1. The provided ADMIN ANSWER KEY is supreme and non-negotiable.\n"
            "2. If the STUDENT RESPONSE matches or is semantically equivalent to the ADMIN ANSWER KEY, "
            "you MUST award FULL MARKS (10/10), even if your own visual OCR or internal reasoning disagrees.\n"
            "3. Use the attached image ONLY to understand the context, NOT to override or contradict the ADMIN ANSWER KEY.\n\n"
        )

        if is_scenario:
            base_instruction = SCENARIO_PROMPTS.get(payload.question_type, SCENARIO_PROMPTS["RECALL"])
            text_prompt = (
                f"{admin_key_rule}"
                f"CASE VIGNETTE CONTEXT:\n{payload.vignette_context.strip()}\n\n"
                f"SUB-QUESTION STEM: {payload.question_stem.strip()}\n\n"
                f"ADMIN ANSWER KEY: {payload.ai_answer_key.strip()}\n\n"
                f"STUDENT RESPONSE: {payload.student_response.strip()}"
            )
        else:
            base_instruction = PROMPTS.get(payload.question_type, PROMPTS["RECALL"])
            text_prompt = (
                f"{admin_key_rule}"
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

        format_directive = (
            "\n\nSYSTEM INSTRUCTION: You are a JSON-only API generator.\n"
            "Output MUST be valid JSON formatted exactly like this:\n"
            '{"score": 10, "reasoning": "Detailed feedback addressing the user as You."}\n'
            "CRITICAL RULES:\n"
            "1. Start response immediately with '{' and end with '}'.\n"
            "2. DO NOT write scratchpads or markdown formatting outside the JSON."
        )

        messages = [
            {"role": "system", "content": base_instruction + format_directive},
            {"role": "user", "content": user_content}
        ]

        response = await call_groq_with_retry(
            messages=messages, 
            target_model=target_model
        )
        raw_text = response.choices[0].message.content or ""

        parsed_result = parse_ai_json(raw_text)
        
        print(f"✨ Groq Evaluation ({target_model}) [{payload.question_type}] [Image Attached: {has_image}]: {parsed_result['score']}/10")

        return parsed_result

    except Exception as e:
        print(f"❌ Groq AI Grading Error: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to communicate with AI grading engine: {str(e)}"
        )
