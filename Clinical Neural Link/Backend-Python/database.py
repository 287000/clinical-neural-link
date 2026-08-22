import os
from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker

# 1. Define PostgreSQL connection details (fallback to environment variable if set)
DATABASE_URL = os.getenv(
    "DATABASE_URL", 
    "postgresql://postgres:CBUMEDCNL-287@localhost:5432/clinical_neural_link"
)

# 2. Create the database engine with high-concurrency connection pooling
engine = create_engine(
    DATABASE_URL,
    pool_size=20,          # Keeps 20 active connections open in the pool
    max_overflow=30,       # Spawns up to 30 additional temporary connections during traffic spikes (50 total)
    pool_timeout=30,       # Waits up to 30 seconds for a connection slot before timing out
    pool_recycle=1800,     # Recycles connections every 30 minutes to clear stale connections
    pool_pre_ping=True     # Verifies connection health before executing queries to prevent drops
)

# 3. Create a SessionLocal class (each instance is a database session)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# 4. Base class for database models to inherit from
Base = declarative_base()

# Helper function to get a database session (dependency injection)
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()