from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from datetime import datetime

class AgentRunRequest(BaseModel):
    dataset_path: str
    target_column: str
    feature_columns: List[str]
    evaluation_threshold: float = 0.02
    max_iterations_per_feature: int = 3

class ExperimentOut(BaseModel):
    id: int
    dataset_name: str
    target_column: str
    total_features: int
    features_kept: int
    features_discarded: int
    auc_delta: float
    logloss_delta: float
    status: str
    created_at: datetime

    class Config:
        from_attributes = True

class FeatureOut(BaseModel):
    id: int
    name: str
    feature_type: Optional[str]
    original_column: str
    transformation: Optional[str]
    signal_score: float
    iv_score: float
    mutual_information: float
    auc_single_feature: float
    status: str
    rationale: Optional[str]
    evidence: Optional[Dict[str, Any]]
    created_at: datetime

    class Config:
        from_attributes = True
