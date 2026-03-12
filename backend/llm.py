from google import genai
from dotenv import load_dotenv
import os
import json
import re

load_dotenv()

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
_client = genai.Client(api_key=GEMINI_API_KEY)
MODEL = "gemini-flash-latest"

def _generate(prompt: str) -> str:
    response = _client.models.generate_content(model=MODEL, contents=prompt)
    return response.text.strip()

def propose_transformations(feature_profile: dict, task: str) -> list:
    prompt = f"""You are a feature engineering expert for ML/CTR prediction. Given this feature profile, propose the top 3 transformations that will most improve predictive signal.

Feature Profile:
{json.dumps(feature_profile, indent=2)}

Task: {task}

For each transformation respond with exactly these fields:
- name: short identifier (e.g. "log1p", "bucketize", "frequency_encode", "zscore", "null_indicator", "clip_outliers")
- type: must be one of: log1p, bucketize, frequency_encode, zscore, null_indicator, clip_outliers
- rationale: 2-3 sentences explaining why this transformation will help, citing specific statistics from the profile
- expected_signal_direction: "positive" or "negative"

Respond ONLY with a valid JSON array, no markdown, no code blocks. Example:
[{{"name": "log1p", "type": "log1p", "rationale": "...", "expected_signal_direction": "positive"}}]"""

    try:
        text = _generate(prompt)
        text = re.sub(r'^```json\s*', '', text, flags=re.MULTILINE)
        text = re.sub(r'^```\s*', '', text, flags=re.MULTILINE)
        text = re.sub(r'\s*```$', '', text, flags=re.MULTILINE)
        transformations = json.loads(text)
        if isinstance(transformations, list):
            return transformations[:3]
        return []
    except Exception:
        dtype = feature_profile.get("dtype", "")
        if "float" in dtype or "int" in dtype:
            return [
                {"name": "bucketize", "type": "bucketize", "rationale": "Quantile bucketing captures non-linear relationships and reduces noise.", "expected_signal_direction": "positive"},
                {"name": "log1p", "type": "log1p", "rationale": "Log transform reduces skewness for better linear model performance.", "expected_signal_direction": "positive"},
                {"name": "null_indicator", "type": "null_indicator", "rationale": "Missingness may be informative for CTR prediction.", "expected_signal_direction": "positive"},
            ]
        else:
            return [
                {"name": "frequency_encode", "type": "frequency_encode", "rationale": "Frequency encoding captures popularity signal for categorical features.", "expected_signal_direction": "positive"},
                {"name": "null_indicator", "type": "null_indicator", "rationale": "Missing values in categorical features may indicate specific user segments.", "expected_signal_direction": "positive"},
            ]

def explain_decision(decision: str, evidence: dict) -> str:
    prompt = f"""You are explaining a feature engineering decision to a data scientist.

Decision: {decision.upper()}
Evidence metrics:
{json.dumps(evidence, indent=2)}

Write 2-4 sentences explaining why this feature was {decision}. Be specific about the metrics. Mention the threshold (2% improvement required). Use **bold** for key terms and numbers."""

    try:
        return _generate(prompt)
    except Exception:
        if decision == "keep":
            mi_pct = evidence.get("mi_pct_change", 0)
            return f"Decision: KEEP - The transformation exceeded the **2% retention threshold** with a **{mi_pct:.1f}% relative improvement** in Mutual Information. The feature demonstrates sufficient predictive power to justify inclusion in the engineered feature set."
        else:
            return f"Decision: DISCARD - The transformation **failed to meet the 2% improvement threshold**. Zero-value or negative changes across MI, IV, and AUC indicate this transformation provides no incremental predictive power over the original feature."
