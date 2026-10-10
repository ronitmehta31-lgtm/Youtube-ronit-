"""Free stock footage: Pixabay (PIXABAY_API_KEY) first, then Pexels (PEXELS_API_KEY) if set."""
import os

import requests

PIXABAY = "https://pixabay.com/api/videos/"
PEXELS = "https://api.pexels.com/videos/search"


def download(url, out_path):
    with requests.get(url, stream=True, timeout=120) as dl:
        dl.raise_for_status()
        with open(out_path, "wb") as fh:
            for part in dl.iter_content(1 << 20):
                fh.write(part)


def pixabay_candidates(query, key):
    r = requests.get(PIXABAY, params={"key": key, "q": query[:100], "safesearch": "true", "per_page": 20},
                     timeout=30)
    r.raise_for_status()
    for hit in r.json().get("hits", []):
        sizes = [s for s in (hit["videos"].get(k) for k in ("large", "medium", "small")) if s and s.get("url")]
        if sizes:
            best = sizes[0]
            yield ("pixabay", hit["id"]), best["url"], hit.get("duration", 0), best["height"] > best["width"]


def pexels_candidates(query, key):
    r = requests.get(PEXELS, headers={"Authorization": key},
                     params={"query": query, "orientation": "portrait", "per_page": 15}, timeout=30)
    r.raise_for_status()
    for video in r.json().get("videos", []):
        files = [f for f in video["video_files"]
                 if f.get("width") and f.get("height") and f.get("file_type") == "video/mp4"]
        good = sorted((f for f in files if f["width"] >= 1080), key=lambda f: f["width"])
        pick = (good or sorted(files, key=lambda f: f["width"], reverse=True) or [None])[0]
        if pick:
            yield ("pexels", video["id"]), pick["link"], video.get("duration", 0), pick["height"] > pick["width"]


def fetch_clip(query, out_path, min_seconds, used_ids):
    """Download a clip for query to out_path. Returns True on success."""
    if not query:
        return False
    sources = [(pixabay_candidates, os.environ.get("PIXABAY_API_KEY")),
               (pexels_candidates, os.environ.get("PEXELS_API_KEY"))]
    for search, key in sources:
        if not key:
            continue
        try:
            candidates = [c for c in search(query, key) if c[0] not in used_ids]
            # Prefer vertical clips, then ones long enough to cover the scene without looping.
            candidates.sort(key=lambda c: (not c[3], c[2] < min_seconds))
            if candidates:
                clip_id, url, _, _ = candidates[0]
                download(url, out_path)
                used_ids.add(clip_id)
                return True
        except requests.RequestException as e:
            print(f"  {search.__name__.split('_')[0]} failed for {query!r}: {e}")
    return False
