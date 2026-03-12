from sqlalchemy import create_engine, Column, Integer, String, Float, DateTime, Text, JSON
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from datetime import datetime
from dotenv import load_dotenv
import os

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")

engine = create_engine(
    DATABASE_URL,
    pool_size=5,
    max_overflow=10,
    pool_pre_ping=True,
    echo=False
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

class Feature(Base):
    __tablename__ = "features"
    id = Column(Integer, primary_key=True, index=True)
    experiment_id = Column(Integer, index=True)
    name = Column(String(255), index=True)
    feature_type = Column(String(50))
    original_column = Column(String(255))
    transformation = Column(String(255), nullable=True)
    signal_score = Column(Float, default=0.0)
    iv_score = Column(Float, default=0.0)
    mutual_information = Column(Float, default=0.0)
    auc_single_feature = Column(Float, default=0.0)
    status = Column(String(20), default="pending")
    rationale = Column(Text, nullable=True)
    evidence = Column(JSON, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

class Experiment(Base):
    __tablename__ = "experiments"
    id = Column(Integer, primary_key=True, index=True)
    dataset_name = Column(String(255))
    target_column = Column(String(255))
    total_features = Column(Integer)
    features_kept = Column(Integer, default=0)
    features_discarded = Column(Integer, default=0)
    auc_delta = Column(Float, default=0.0)
    logloss_delta = Column(Float, default=0.0)
    training_time = Column(Float, default=0.0)
    status = Column(String(20), default="running")
    created_at = Column(DateTime, default=datetime.utcnow)
    completed_at = Column(DateTime, nullable=True)

def init_db():
    Base.metadata.create_all(bind=engine)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
