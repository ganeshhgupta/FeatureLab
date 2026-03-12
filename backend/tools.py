import pandas as pd
import numpy as np
from sklearn.feature_selection import mutual_info_classif
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import roc_auc_score, log_loss
import lightgbm as lgb
import os

DATASETS_DIR = os.path.join(os.path.dirname(__file__), "datasets")
os.makedirs(DATASETS_DIR, exist_ok=True)

def load_data(path: str) -> pd.DataFrame:
    if not os.path.isabs(path):
        full_path = os.path.join(DATASETS_DIR, path)
    else:
        full_path = path
    if full_path.endswith('.parquet'):
        return pd.read_parquet(full_path)
    return pd.read_csv(full_path)

def profile_feature(df: pd.DataFrame, column: str, target: str = None) -> dict:
    series = df[column]
    target_series = df[target] if target and target in df.columns else None

    profile = {
        "column": column,
        "dtype": str(series.dtype),
        "null_rate": float(series.isnull().sum() / len(series)),
        "cardinality": int(series.nunique()),
        "top_values": {str(k): int(v) for k, v in series.value_counts().head(5).to_dict().items()} if series.dtype == 'object' else None,
    }

    if pd.api.types.is_numeric_dtype(series):
        profile.update({
            "mean": float(series.mean()),
            "std": float(series.std()),
            "min": float(series.min()),
            "max": float(series.max()),
            "skewness": float(series.skew()),
            "kurtosis": float(series.kurt()),
        })

    if target_series is not None:
        try:
            if pd.api.types.is_numeric_dtype(series):
                profile["correlation_with_target"] = float(series.corr(target_series))
        except Exception:
            profile["correlation_with_target"] = None

    return profile

def apply_transformation(df: pd.DataFrame, spec: dict, column: str) -> pd.DataFrame:
    df = df.copy()
    ttype = spec.get("type", "")

    if ttype == "log1p":
        df[f"{column}_log1p"] = np.log1p(df[column].clip(lower=0))
    elif ttype == "bucketize":
        n_bins = spec.get("n_bins", 10)
        try:
            df[f"{column}_bucketize"] = pd.qcut(df[column], q=n_bins, labels=False, duplicates='drop')
        except Exception:
            df[f"{column}_bucketize"] = pd.cut(df[column], bins=n_bins, labels=False)
    elif ttype == "frequency_encode":
        freq_map = df[column].value_counts()
        df[f"{column}_frequency_encode"] = df[column].map(freq_map)
    elif ttype == "clip_outliers":
        p_low, p_high = spec.get("percentiles", [1, 99])
        lower = df[column].quantile(p_low / 100)
        upper = df[column].quantile(p_high / 100)
        df[f"{column}_clipped"] = df[column].clip(lower, upper)
    elif ttype == "null_indicator":
        df[f"{column}_isnull"] = df[column].isnull().astype(int)
    elif ttype == "zscore":
        mean = df[column].mean()
        std = df[column].std()
        if std > 0:
            df[f"{column}_zscore"] = (df[column] - mean) / std
        else:
            df[f"{column}_zscore"] = 0.0
    else:
        # fallback: frequency encode for any unknown type
        freq_map = df[column].value_counts()
        df[f"{column}_freq"] = df[column].map(freq_map)

    return df

def get_new_columns(df_before: pd.DataFrame, df_after: pd.DataFrame) -> list:
    return [c for c in df_after.columns if c not in df_before.columns]

def evaluate_feature(df: pd.DataFrame, feature: str, target: str) -> dict:
    X = df[[feature]].copy()
    # Fill nulls with median for numeric, mode for categorical
    if pd.api.types.is_numeric_dtype(X[feature]):
        X[feature] = X[feature].fillna(X[feature].median())
    else:
        X[feature] = X[feature].fillna(X[feature].mode()[0] if len(X[feature].mode()) > 0 else 0)
        X[feature] = pd.factorize(X[feature])[0]

    y = df[target]

    try:
        mi = float(mutual_info_classif(X, y, random_state=42)[0])
    except Exception:
        mi = 0.0

    try:
        lr = LogisticRegression(max_iter=500, solver='lbfgs')
        lr.fit(X, y)
        y_pred = lr.predict_proba(X)[:, 1]
        auc = float(roc_auc_score(y, y_pred))
    except Exception:
        auc = 0.5

    try:
        train_data = lgb.Dataset(X, label=y, free_raw_data=False)
        params = {"objective": "binary", "verbose": -1, "num_leaves": 15, "n_estimators": 50}
        model = lgb.train({"objective": "binary", "verbose": -1, "num_leaves": 15}, train_data, num_boost_round=50)
        importance = float(model.feature_importance(importance_type='gain')[0])
    except Exception:
        importance = 0.0

    return {
        "feature": feature,
        "mutual_information": mi,
        "iv_score": mi * 100,
        "auc_single_feature": auc,
        "feature_importance": importance,
    }

def compare_baseline(df_original: pd.DataFrame, df_engineered: pd.DataFrame, target: str) -> dict:
    y = df_original[target]

    def train_eval(df):
        X = df.drop(columns=[target]).copy()
        for col in X.columns:
            if not pd.api.types.is_numeric_dtype(X[col]):
                X[col] = pd.factorize(X[col])[0]
            X[col] = X[col].fillna(X[col].median() if pd.api.types.is_numeric_dtype(X[col]) else 0)
        dataset = lgb.Dataset(X, label=y)
        params = {"objective": "binary", "verbose": -1, "num_leaves": 31, "learning_rate": 0.1}
        model = lgb.train(params, dataset, num_boost_round=100)
        pred = model.predict(X)
        return float(roc_auc_score(y, pred)), float(log_loss(y, pred))

    auc_orig, loss_orig = train_eval(df_original)
    auc_eng, loss_eng = train_eval(df_engineered)

    return {
        "auc_original": auc_orig,
        "auc_engineered": auc_eng,
        "auc_delta": (auc_eng - auc_orig) / auc_orig * 100,
        "logloss_original": loss_orig,
        "logloss_engineered": loss_eng,
        "logloss_delta": (loss_orig - loss_eng) / loss_orig * 100,
        "original_feature_count": len(df_original.columns) - 1,
        "engineered_feature_count": len(df_engineered.columns) - 1,
    }

def generate_demo_dataset(n_rows: int = 10000) -> pd.DataFrame:
    """Generate a Criteo-like demo dataset for CTR prediction."""
    rng = np.random.default_rng(42)

    df = pd.DataFrame()
    # Target: click (binary)
    df['click'] = rng.integers(0, 2, size=n_rows)

    # Numeric features I1-I13
    for i in range(1, 14):
        vals = rng.exponential(scale=50, size=n_rows).astype(float)
        # Add ~5% nulls
        null_mask = rng.random(n_rows) < 0.05
        vals[null_mask] = np.nan
        df[f'I{i}'] = vals

    # Categorical features C1-C9 (using integer codes like Criteo)
    for i in range(1, 10):
        cardinality = rng.integers(10, 1000)
        vals = rng.integers(0, cardinality, size=n_rows)
        null_mask = rng.random(n_rows) < 0.03
        vals_float = vals.astype(float)
        vals_float[null_mask] = np.nan
        df[f'C{i}'] = vals_float

    return df

def save_feature_set(df: pd.DataFrame, path: str):
    df.to_csv(path, index=False)
