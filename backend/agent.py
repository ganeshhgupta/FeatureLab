import pandas as pd
import numpy as np
import asyncio
import json
from datetime import datetime
from typing import AsyncGenerator, Callable
from tools import (
    load_data, profile_feature, apply_transformation,
    evaluate_feature, get_new_columns, compare_baseline, save_feature_set
)
from llm import propose_transformations, explain_decision
from database import SessionLocal, Feature, Experiment

class FeatureEngineeringAgent:
    def __init__(self, evaluation_threshold=0.02, max_iterations=3, event_callback: Callable = None):
        self.threshold = evaluation_threshold
        self.max_iterations = max_iterations
        self.event_callback = event_callback  # async callable(event_dict)
        self.db = SessionLocal()
        self._stop_requested = False

    async def emit(self, event_type: str, feature: str, message: str, data: dict = None):
        event = {
            "type": event_type,
            "feature": feature,
            "message": message,
            "timestamp": datetime.utcnow().strftime("%I:%M:%S %p"),
            "data": data or {}
        }
        if self.event_callback:
            await self.event_callback(event)

    async def run(self, dataset_path: str, target_column: str, feature_columns: list) -> dict:
        df = load_data(dataset_path)
        df_engineered = df.copy()

        experiment = Experiment(
            dataset_name=dataset_path,
            target_column=target_column,
            total_features=len(feature_columns),
            status="running"
        )
        self.db.add(experiment)
        self.db.commit()
        exp_id = experiment.id

        kept_count = 0
        discarded_count = 0
        kept_features = []

        for i, col in enumerate(feature_columns):
            if self._stop_requested:
                break

            await self.emit("feature_start", col, f"Processing feature {i+1}/{len(feature_columns)}: {col}", {"index": i, "total": len(feature_columns)})

            # OBSERVE
            profile = profile_feature(df, col, target_column)
            profile_summary = (
                f"Profiled feature {col}: dtype={profile['dtype']}, "
                f"null_rate={profile['null_rate']:.2%}, "
                f"cardinality={profile['cardinality']}"
            )
            if profile.get("skewness") is not None:
                profile_summary += f", skewness={profile['skewness']:.4f}"
            if profile.get("correlation_with_target") is not None:
                profile_summary += f", correlation={profile['correlation_with_target']:.4f}"

            await self.emit("observation", col, profile_summary, profile)

            # HYPOTHESIZE
            transformations = propose_transformations(profile, "CTR prediction for display ads")
            for t in transformations[:self.max_iterations]:
                await self.emit("hypothesis", col,
                    f"Proposed transformation: {t.get('name')} - {t.get('rationale', '')}",
                    {"transformation": t}
                )

            # Evaluate baseline
            baseline_eval = evaluate_feature(df, col, target_column)

            best_feature = None
            best_eval = None
            best_improvement = -999

            for attempt_idx, spec in enumerate(transformations[:self.max_iterations]):
                if self._stop_requested:
                    break

                # EXECUTE
                try:
                    df_temp = apply_transformation(df, spec, col)
                    new_cols = get_new_columns(df, df_temp)
                    if not new_cols:
                        continue
                    transformed_col = new_cols[0]
                except Exception as e:
                    await self.emit("action", col, f"Transformation {spec.get('name')} failed: {str(e)}")
                    continue

                await self.emit("action", col,
                    f"Applied {spec.get('type')} transformation, created feature: {transformed_col}",
                    {"transformation_type": spec.get("type"), "new_feature": transformed_col}
                )

                # EVALUATE
                try:
                    eval_result = evaluate_feature(df_temp, transformed_col, target_column)
                except Exception as e:
                    await self.emit("result", col, f"Evaluation failed: {str(e)}")
                    continue

                mi_change = eval_result["mutual_information"] - baseline_eval["mutual_information"]
                iv_change = eval_result["iv_score"] - baseline_eval["iv_score"]
                auc_change = eval_result["auc_single_feature"] - baseline_eval["auc_single_feature"]
                mi_pct = mi_change / max(baseline_eval["mutual_information"], 0.0001) * 100

                await self.emit("result", col,
                    f"Evaluation results - MI: {eval_result['mutual_information']:.4f} ({mi_change:+.4f}), "
                    f"IV: {eval_result['iv_score']:.4f} ({iv_change:+.4f}), "
                    f"AUC: {eval_result['auc_single_feature']:.4f} ({auc_change:+.4f})",
                    {
                        "mi": eval_result["mutual_information"],
                        "mi_change": mi_change,
                        "iv": eval_result["iv_score"],
                        "iv_change": iv_change,
                        "auc": eval_result["auc_single_feature"],
                        "auc_change": auc_change,
                    }
                )

                improvement = mi_pct / 100  # fractional improvement

                if improvement > best_improvement:
                    best_improvement = improvement
                    best_feature = transformed_col
                    best_eval = eval_result
                    best_spec = spec
                    best_df_temp = df_temp
                    best_evidence = {
                        "decision": "keep" if improvement > self.threshold else "discard",
                        "original_column": col,
                        "feature": transformed_col,
                        "transformation_type": spec.get("type"),
                        "mi_change": mi_change,
                        "mi_pct_change": mi_pct,
                        "iv_change": iv_change,
                        "iv_pct_change": iv_change / max(baseline_eval["iv_score"], 0.0001) * 100,
                        "auc_change": auc_change,
                        "auc_pct_change": auc_change / max(baseline_eval["auc_single_feature"], 0.0001) * 100,
                        "threshold": self.threshold,
                    }

                # If this one passes threshold, use it immediately
                if improvement > self.threshold:
                    break

            # DECIDE
            if best_feature is not None and best_improvement > self.threshold:
                decision = "keep"
                rationale = explain_decision("keep", best_evidence)
                await self.emit("decision", col,
                    f"Decision: KEEP - {rationale}",
                    {"decision": "keep", "feature": best_feature, "evidence": best_evidence}
                )

                df_engineered[best_feature] = best_df_temp[best_feature]
                kept_count += 1
                kept_features.append(best_feature)

                feature_record = Feature(
                    experiment_id=exp_id,
                    name=best_feature,
                    feature_type=best_spec.get("type"),
                    original_column=col,
                    transformation=best_spec.get("name"),
                    signal_score=best_eval["mutual_information"],
                    iv_score=best_eval["iv_score"],
                    mutual_information=best_eval["mutual_information"],
                    auc_single_feature=best_eval["auc_single_feature"],
                    status="kept",
                    rationale=rationale,
                    evidence=best_evidence
                )
                self.db.add(feature_record)
            else:
                decision = "discard"
                evidence = best_evidence if best_feature else {
                    "decision": "discard",
                    "original_column": col,
                    "threshold": self.threshold,
                    "reason": "No transformation produced sufficient signal"
                }
                rationale = explain_decision("discard", evidence)
                await self.emit("decision", col,
                    f"Decision: DISCARD - {rationale}",
                    {"decision": "discard", "feature": col, "evidence": evidence}
                )
                discarded_count += 1

                feature_record = Feature(
                    experiment_id=exp_id,
                    name=best_feature or col,
                    feature_type="numeric" if col.startswith("I") else "categorical",
                    original_column=col,
                    status="discarded",
                    rationale=rationale,
                    evidence=evidence
                )
                self.db.add(feature_record)

            self.db.commit()

            await self.emit("progress", col, f"Progress: {i+1}/{len(feature_columns)}", {
                "current": i + 1,
                "total": len(feature_columns),
                "kept": kept_count,
                "discarded": discarded_count,
                "kept_features": kept_features
            })

        # Final comparison
        try:
            comparison = compare_baseline(df, df_engineered, target_column)
            experiment.features_kept = kept_count
            experiment.features_discarded = discarded_count
            experiment.auc_delta = comparison["auc_delta"]
            experiment.logloss_delta = comparison["logloss_delta"]
            experiment.status = "completed"
            experiment.completed_at = datetime.utcnow()
            self.db.commit()

            if comparison["auc_delta"] > 1.5:
                save_feature_set(df_engineered, f"features_engineered_{exp_id}.csv")

            await self.emit("complete", "", "Agent completed all features!", {
                "experiment_id": exp_id,
                "features_kept": kept_count,
                "features_discarded": discarded_count,
                "auc_delta": comparison["auc_delta"],
                "logloss_delta": comparison["logloss_delta"],
                "kept_features": kept_features
            })

            return {
                "experiment_id": exp_id,
                "status": "success",
                "features_kept": kept_count,
                "features_discarded": discarded_count,
                "auc_delta": comparison["auc_delta"],
                "logloss_delta": comparison["logloss_delta"]
            }
        except Exception as e:
            experiment.status = "failed"
            self.db.commit()
            await self.emit("error", "", f"Final comparison failed: {str(e)}")
            return {"status": "error", "message": str(e)}
