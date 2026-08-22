from sqlalchemy import Column, Integer, String, Text, ForeignKey, DateTime
from sqlalchemy.sql import func
from database import Base

class Patient(Base):
    __tablename__ = "patients"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    email = Column(String(100), unique=True, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class CourseNote(Base):
    __tablename__ = "course_notes"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(255), nullable=False)
    
    # We use Text here to handle long clinical notes
    content = Column(Text, nullable=False) 
    
    patient_id = Column(Integer, ForeignKey("patients.id", ondelete="CASCADE"), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class Assessment(Base):
    __tablename__ = "assessments"

    id = Column(Integer, primary_key=True, index=True)
    note_id = Column(Integer, ForeignKey("course_notes.id", ondelete="CASCADE"), nullable=False)
    
    # Stores the generated quiz questions as a JSON text block
    questions = Column(Text, nullable=False) 
    
    score = Column(Integer, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())