from __future__ import annotations
import os
import joblib
from dataclasses import dataclass, field
from typing import Dict, List, Any

# Simple artifact store using local filesystem
class ArtifactStore:
    def __init__(self, base_path: str = "artifacts"):
        self.base_path = base_path
        os.makedirs(self.base_path, exist_ok=True)

    def save(self, key: str, artifact: Any) -> None:
        path = self._get_path(key)
        os.makedirs(os.path.dirname(path), exist_ok=True)
        joblib.dump(artifact, path)

    def load(self, key: str) -> Any | None:
        path = self._get_path(key)
        if os.path.exists(path):
            return joblib.load(path)
        return None

    def _get_path(self, key: str) -> str:
        return os.path.join(self.base_path, f"{key}.joblib")

@dataclass
class BaselineState:
    count: int
    mean: List[float]

@dataclass
class TempBaselineRepo:
    _baselines: Dict[str, BaselineState] = field(default_factory=dict)

    def update(self, user_id: str, features: list[float]) -> None:
        if user_id not in self._baselines:
            self._baselines[user_id] = BaselineState(count=1, mean=list(features))
            return

        state = self._baselines[user_id]
        state.count += 1
        n = float(state.count)
        state.mean = [
            (prev * (n - 1) + new) / n for prev, new in zip(state.mean, features)
        ]

    def get(self, user_id: str) -> list[float] | None:
        state = self._baselines.get(user_id)
        return list(state.mean) if state else None

    def stats(self) -> dict:
        return {"users": len(self._baselines)}
