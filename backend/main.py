from fastapi import FastAPI, HTTPException, Depends, UploadFile, File, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from dotenv import load_dotenv
import os
import asyncio
import json
from datetime import datetime
from typing import AsyncGenerator

from sse_starlette.sse import EventSourceResponse
from database import init_db, get_db, Experiment, Feature
from models import AgentRunRequest
from agent import FeatureEngineeringAgent
from tools import generate_demo_dataset, load_data, profile_feature, DATASETS_DIR

load_dotenv()
init_db()

app = FastAPI(title="FeatureLab API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# In-memory event queues keyed by session_id
_event_queues: dict = {}

@app.get("/health")
async def health_check():
    return {"status": "healthy", "timestamp": datetime.utcnow().isoformat(), "service": "FeatureLab Backend"}

@app.post("/api/dataset/demo")
async def create_demo_dataset():
    """Generate and save a demo Criteo-like dataset."""
    df = generate_demo_dataset(10000)
    path = os.path.join(DATASETS_DIR, "criteo_demo_10k.csv")
    df.to_csv(path, index=False)
    numeric_cols = [c for c in df.columns if c.startswith('I')]
    cat_cols = [c for c in df.columns if c.startswith('C')]
    return {
        "filename": "criteo_demo_10k.csv",
        "rows": len(df),
        "features": len(df.columns) - 1,
        "target": "click",
        "numeric_columns": numeric_cols,
        "categorical_columns": cat_cols,
        "all_feature_columns": numeric_cols + cat_cols
    }

@app.post("/api/dataset/upload")
async def upload_dataset(file: UploadFile = File(...)):
    """Upload a CSV dataset."""
    if not file.filename.endswith('.csv'):
        raise HTTPException(status_code=400, detail="Only CSV files supported")
    path = os.path.join(DATASETS_DIR, file.filename)
    content = await file.read()
    with open(path, 'wb') as f:
        f.write(content)

    import pandas as pd
    df = pd.read_csv(path, nrows=5)
    full_df = pd.read_csv(path)
    return {
        "filename": file.filename,
        "rows": len(full_df),
        "features": len(full_df.columns),
        "columns": list(full_df.columns)
    }

@app.get("/api/dataset/{filename}/profile")
async def get_dataset_profile(filename: str):
    """Get feature profiles for a dataset."""
    try:
        df = load_data(filename)
    except Exception as e:
        raise HTTPException(status_code=404, detail=f"Dataset not found: {str(e)}")

    feature_cols = [c for c in df.columns if c != 'click']
    profiles = []
    for col in feature_cols[:20]:  # limit to 20 for performance
        try:
            p = profile_feature(df, col, 'click')
            profiles.append(p)
        except Exception:
            pass
    return {"profiles": profiles, "rows": len(df), "features": len(feature_cols)}

@app.post("/api/agent/run/stream")
async def run_agent_stream(request: AgentRunRequest):
    """Run agent with SSE streaming."""
    queue: asyncio.Queue = asyncio.Queue()

    async def event_callback(event: dict):
        await queue.put(event)

    async def run_agent():
        try:
            agent = FeatureEngineeringAgent(
                evaluation_threshold=request.evaluation_threshold,
                max_iterations=request.max_iterations_per_feature,
                event_callback=event_callback
            )
            await agent.run(
                dataset_path=request.dataset_path,
                target_column=request.target_column,
                feature_columns=request.feature_columns
            )
        except Exception as e:
            await queue.put({"type": "error", "message": str(e)})
        finally:
            await queue.put(None)  # sentinel

    asyncio.create_task(run_agent())

    async def generate() -> AsyncGenerator:
        while True:
            event = await queue.get()
            if event is None:
                break
            yield {"data": json.dumps(event)}

    return EventSourceResponse(generate())

@app.get("/api/experiments")
async def get_experiments(db: Session = Depends(get_db)):
    return db.query(Experiment).order_by(Experiment.created_at.desc()).all()

@app.get("/api/experiments/{exp_id}")
async def get_experiment(exp_id: int, db: Session = Depends(get_db)):
    experiment = db.query(Experiment).filter(Experiment.id == exp_id).first()
    if not experiment:
        raise HTTPException(status_code=404, detail="Not found")
    return experiment

@app.get("/api/experiments/{exp_id}/features")
async def get_experiment_features(exp_id: int, db: Session = Depends(get_db)):
    return db.query(Feature).filter(Feature.experiment_id == exp_id).all()

@app.get("/api/features")
async def get_all_features(db: Session = Depends(get_db)):
    return db.query(Feature).order_by(Feature.created_at.desc()).all()

@app.post("/api/clear")
async def clear_data(db: Session = Depends(get_db)):
    db.query(Feature).delete()
    db.query(Experiment).delete()
    db.commit()
    return {"status": "cleared"}
