import os
from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker

# 1. Define Supabase connection string.
# NOTE: Switched port from 6543 (Transaction) to 5432 (Session Mode)
# Added ?sslmode=require to enforce secure Supabase transport
DEFAULT_DB_URL = (
    "postgresql://postgres.djaiakndrpptwgyfkyfk:bj8VedAxSRjmzuBG"
    "@aws-0-eu-central-1.pooler.supabase.com:5432/postgres?sslmode=require"
)

DATABASE_URL = os.getenv("DATABASE_URL", DEFAULT_DB_URL)

# Ensure sslmode=require is appended if relying purely on environment variable
if "sslmode" not in DATABASE_URL:
    DATABASE_URL += (
        "?sslmode=require" if "?" not in DATABASE_URL else "&sslmode=require"
    )

# 2. Create the engine configured specifically for Supabase Session Pooler
engine = create_engine(
    DATABASE_URL,
    pool_size=10,  # Max steady connections
    max_overflow=5,  # Spikes up to 15 total connections
    pool_timeout=30,  # Wait up to 30s before timing out
    pool_recycle=1800,  # Refresh connections every 30 mins
    pool_pre_ping=True,  # Verifies connection health prior to queries
    connect_args={
        "connect_timeout": 10  # Prevent indefinite hangs on network drops
    },
)

# 3. Session factory
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# 4. Declarative base
Base = declarative_base()


# Dependency helper
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
