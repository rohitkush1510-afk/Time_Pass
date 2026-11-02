"""DeepFace emotion sidecar for MoodSync AnimeVision.

A small FastAPI service that wraps DeepFace (Python/TensorFlow) emotion
analysis and returns a normalized 7-emotion distribution in the SAME space
that face-api.js uses, so the browser fuser can merge them.

    GET  /health   -> { status, model_ready, version }
    POST /emotion  -> { success, scores, top_emotion, model }

Request body (JSON):
    { "image": "<base64 data-URI or raw base64>",
      "weights": { "sad": 1.2, ... } }        <- optional fine-tune multipliers
       per app emotion key: neutral/happy/sad/angry/fearful/disgusted/surprised

Run it:
    pip install -r requirements.txt
    python deepface_service.py            # listens on 127.0.0.1:5001

Privacy: only runs on localhost by default. The browser sends a single frame;
it never leaves your machine.
"""

import os
import time

import numpy as np
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Dict, Optional

try:
    from deepface import DeepFace
    HAS_DEEPFACE = True
except Exception:  # pragma: no cover - import guard for syntax-only checkers
    DeepFace = None
    HAS_DEEPFACE = False

APP_ID = "MoodSync-DeepFace-Sidecar"
VERSION = "1.0.0"

# face-api.js emotion order — the fused 7-emotion space the app expects.
APP_EMOTIONS = ["neutral", "happy", "sad", "angry", "fearful", "disgusted", "surprised"]

# DeepFace's own emotion label -> app emotion key
DEEPFACE_TO_APP = {
    "neutral": "neutral",
    "happy": "happy",
    "sad": "sad",
    "angry": "angry",
    "fear": "fearful",
    "disgust": "disgusted",
    "surprise": "surprised",
}

app = FastAPI(title=APP_ID, version=VERSION)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

_model_loaded = HAS_DEEPFACE


class EmotionRequest(BaseModel):
    image: str                                # base64 data URI or raw base64
    weights: Optional[Dict[str, float]] = None  # optional fine-tune multipliers


def _softmax(x: np.ndarray) -> np.ndarray:
    e = np.exp(x - np.max(x))
    return e / e.sum()


def _decode_image(data: str) -> np.ndarray:
    """Accepts a base64 string (optionally a data URI) and returns an RGB
    numpy array via DeepFace's own reader (handles remote/local paths too)."""
    if data.startswith("data:image"):
        data = data.split(",", 1)[1]
    return DeepFace.functions.load_image(data)


def _deepface_scores(data: np.ndarray) -> Dict[str, float]:
    """Run DeepFace emotion analysis, return softmax probabilities keyed by
    the app's 7 emotion names. Falls back to zeros if analysis fails."""
    result = DeepFace.analyze(
        img_path=data,
        actions=["emotion"],
        enforce_detection=False,
        silent=True,
    )
    # analyze returns a dict (single) or list (batch). Normalise into a score
    # dict on the DeepFace emotion labels first.
    if isinstance(result, list):
        result = result[0] if result else {}
    raw = result.get("emotion") or {}
    probs = np.zeros(len(APP_EMOTIONS))
    for label, val in raw.items():
        key = DEEPFACE_TO_APP.get(label)
        if key is not None:
            probs[APP_EMOTIONS.index(key)] += float(val)
    return dict(zip(APP_EMOTIONS, _softmax(probs).tolist()))


@app.get("/health")
def health():
    return {
        "status": "ok",
        "has_deepface": HAS_DEEPFACE,
        "model_ready": _model_loaded and HAS_DEEPFACE,
        "version": VERSION,
    }


@app.post("/emotion")
def emotion(req: EmotionRequest):
    if not HAS_DEEPFACE or DeepFace is None:
        return {"success": False, "error": "deepface not installed", "scores": None, "top_emotion": None}

    try:
        img = _decode_image(req.image)
    except Exception as exc:  # pragma: no cover
        return {"success": False, "error": f"image decode failed: {exc}", "scores": None, "top_emotion": None}

    t0 = time.time()
    try:
        scores = _deepface_scores(img)
    except Exception as exc:  # pragma: no cover
        return {"success": False, "error": f"analysis failed: {exc}", "scores": None, "top_emotion": None}

    # Optional fine-tune: multiply per-emotion scores, then re-normalise.
    if req.weights:
        weights = {k: float(v) for k, v in req.weights.items() if v}
        for k in APP_EMOTIONS:
            scores[k] *= weights.get(k, 1.0)
        s = sum(scores.values())
        if s > 0:
            scores = {k: v / s for k, v in scores.items()}

    top = max(scores, key=scores.get)
    return {
        "success": True,
        "scores": scores,
        "top_emotion": top,
        "confidence": scores[top],
        "elapsed": round(time.time() - t0, 3),
        "model": "DeepFace.Emotion",
    }


if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("DEEPFACE_PORT", "5001"))
    uvicorn.run(app, host="127.0.0.1", port=port)
