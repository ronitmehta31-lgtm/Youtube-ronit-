"""Turn still pictures into short moving clips with a fal.ai image-to-video model.

All clips are submitted to fal's queue at once and collected afterwards, so a story with 30+ scenes
takes minutes, not hours. Any clip that fails simply stays a still picture with the zoom effect.
"""
import base64
import os
import time
from pathlib import Path

import requests

from . import visuals

QUEUE = "https://queue.fal.run/"
MOTION = ("gentle natural motion, characters move subtly and expressively, soft cinematic camera push-in, "
          "consistent 2D storybook animation style, no text")


def model_input(model, prompt, image_url, seconds):
    if "kling" in model:
        return {"prompt": prompt, "image_url": image_url, "duration": "10" if seconds > 6 else "5",
                "negative_prompt": "blur, distort, low quality, text, watermark"}
    # MiniMax / Hailuo style models
    return {"prompt": prompt, "image_url": image_url, "duration": round(min(max(seconds, 3), 10), 1),
            "resolution": "768P", "prompt_expansion_mode": "disabled"}


def picture_url(path):
    url = visuals.hosted_urls.get(str(path))
    if url:
        return url
    return "data:image/jpeg;base64," + base64.b64encode(Path(path).read_bytes()).decode()


def animate(jobs, model, work, timeout=1500):
    """jobs: [(index, picture_path, prompt, seconds)]. Returns {index: clip_path} for the clips that worked."""
    key = os.environ.get("FAL_KEY", "").strip()
    if not key or not jobs:
        return {}
    headers = {"Authorization": f"Key {key}"}
    pending = {}
    for index, picture, prompt, seconds in jobs:
        try:
            r = requests.post(QUEUE + model, headers=headers, timeout=60,
                              json=model_input(model, f"{prompt}. {MOTION}", picture_url(picture), seconds))
            r.raise_for_status()
            pending[index] = r.json()
        except requests.RequestException as e:
            print(f"    animation submit failed for scene {index + 1}: {str(e)[:200]}")
    print(f"  animating {len(pending)} scenes with {model}")

    clips, deadline = {}, time.time() + timeout
    while pending and time.time() < deadline:
        time.sleep(10)
        for index, req in list(pending.items()):
            try:
                status = requests.get(req["status_url"], headers=headers, timeout=30).json().get("status")
                if status not in ("COMPLETED", "ERROR", "FAILED"):
                    continue
                del pending[index]
                result = requests.get(req["response_url"], headers=headers, timeout=60).json()
                url = (result.get("video") or {}).get("url")
                if not url:
                    print(f"    scene {index + 1}: no clip ({str(result)[:200]})")
                    continue
                clip = work / f"anim{index}.mp4"
                visuals.download(url, clip)
                clips[index] = clip
                print(f"    scene {index + 1} animated ({len(clips)} done, {len(pending)} waiting)")
            except (requests.RequestException, ValueError) as e:
                print(f"    scene {index + 1}: checking failed: {str(e)[:200]}")
    if pending:
        print(f"  gave up waiting for {len(pending)} clips; those scenes stay as still pictures")
    return clips
