"""Higgsfield API (pay-as-you-go, separate from higgsfield.ai plans): pictures and animated clips.

Needs HF_API_KEY_ID and HF_API_KEY_SECRET from console.higgsfield.ai. Every call is asynchronous:
submit, poll the status URL, then download the output.
"""
import os
import time

import requests

API = "https://api.higgsfield.ai"
IMAGE_MODEL = "higgsfield-ai/soul/standard"
TERMINAL = {"completed", "failed", "nsfw", "canceled"}


def configured():
    return bool(os.environ.get("HF_API_KEY_ID", "").strip() and os.environ.get("HF_API_KEY_SECRET", "").strip())


def _headers():
    key = f"{os.environ['HF_API_KEY_ID'].strip()}:{os.environ['HF_API_KEY_SECRET'].strip()}"
    return {"Authorization": f"Key {key}", "Content-Type": "application/json"}


def submit(model, body):
    """Start a generation. Returns the request dict (request_id, status_url, ...)."""
    r = requests.post(f"{API}/{model}", headers=_headers(), json=body, timeout=60)
    if r.status_code >= 400:
        raise requests.HTTPError(f"HTTP {r.status_code}: {r.text[:300]}")
    return r.json()


def status(req):
    url = req.get("status_url") or f"{API}/requests/{req['request_id']}/status"
    r = requests.get(url, headers=_headers(), timeout=30)
    r.raise_for_status()
    return r.json()


def wait(req, timeout=600, every=5):
    """Poll until the request finishes. Returns the final status dict."""
    deadline = time.time() + timeout
    while time.time() < deadline:
        s = status(req)
        if s.get("status") in TERMINAL:
            return s
        time.sleep(every)
    raise TimeoutError(f"request {req.get('request_id')} did not finish in {timeout}s")


def image(prompt, aspect_ratio):
    """Generate one picture and return its URL."""
    s = wait(submit(IMAGE_MODEL, {"prompt": prompt[:2000], "aspect_ratio": aspect_ratio, "num_images": 1}), timeout=300)
    if s.get("status") != "completed" or not s.get("images"):
        raise requests.HTTPError(f"picture {s.get('status')}: {s.get('error') or ''}")
    return s["images"][0]["url"]
