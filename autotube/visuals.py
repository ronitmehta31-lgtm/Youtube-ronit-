"""Free vertical stock footage from Pexels (needs a free PEXELS_API_KEY)."""
import os

import requests

SEARCH = "https://api.pexels.com/videos/search"


def pick_file(video):
    """Smallest portrait file that is still at least 1080 wide, else the largest one."""
    files = [f for f in video["video_files"]
             if f.get("width") and f.get("height") and f["height"] > f["width"] and f.get("file_type") == "video/mp4"]
    if not files:
        return None
    good = sorted((f for f in files if f["width"] >= 1080), key=lambda f: f["width"])
    return (good or sorted(files, key=lambda f: f["width"], reverse=True))[0]


def fetch_clip(query, out_path, min_seconds, used_ids):
    """Download a portrait clip for query to out_path. Returns True on success."""
    key = os.environ.get("PEXELS_API_KEY")
    if not key or not query:
        return False
    try:
        r = requests.get(SEARCH, headers={"Authorization": key},
                         params={"query": query, "orientation": "portrait", "per_page": 15}, timeout=30)
        r.raise_for_status()
        candidates = [v for v in r.json().get("videos", []) if v["id"] not in used_ids]
        # Prefer clips long enough to cover the scene without looping.
        candidates.sort(key=lambda v: v.get("duration", 0) < min_seconds)
        for video in candidates:
            f = pick_file(video)
            if not f:
                continue
            with requests.get(f["link"], stream=True, timeout=120) as dl:
                dl.raise_for_status()
                with open(out_path, "wb") as fh:
                    for part in dl.iter_content(1 << 20):
                        fh.write(part)
            used_ids.add(video["id"])
            return True
    except requests.RequestException as e:
        print(f"  pexels failed for {query!r}: {e}")
    return False
