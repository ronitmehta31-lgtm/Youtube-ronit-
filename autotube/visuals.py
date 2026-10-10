"""Free visuals for each scene, best first:

1. Pixabay stock video (needs PIXABAY_API_KEY)
2. Pexels stock video (needs PEXELS_API_KEY)
3. Wikimedia Commons photo (no key needed; credited in the video description)
"""
import html
import os
import re

import requests

PIXABAY = "https://pixabay.com/api/videos/"
PEXELS = "https://api.pexels.com/videos/search"
COMMONS = "https://commons.wikimedia.org/w/api.php"
USER_AGENT = "autotube/1.0 (personal YouTube Shorts tool; https://github.com/ronitmehta31-lgtm/Youtube-ronit-)"
SKIP_TITLES = re.compile(r"\b(map|diagram|chart|logo|flag|coat of arms|graph|plot|icon|seal|stamp|text|svg)\b", re.I)
OK_LICENSES = re.compile(r"^(cc0|public domain|pd|cc by(-sa)?( \d\.\d)?)", re.I)


def download(url, out_path):
    with requests.get(url, stream=True, timeout=120, headers={"User-Agent": USER_AGENT}) as dl:
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


def stock_video(query, out_path, min_seconds, used_ids):
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


def plain(value):
    return html.unescape(re.sub(r"<[^>]+>", "", value or "")).strip()


def commons_photo(query, out_path, used_ids):
    """Download a freely licensed photo from Wikimedia Commons. Returns a credit line, or None."""
    try:
        r = requests.get(COMMONS, headers={"User-Agent": USER_AGENT}, timeout=30, params={
            "action": "query", "format": "json", "generator": "search", "gsrnamespace": 6,
            "gsrsearch": f"{query} filetype:bitmap", "gsrlimit": 20, "prop": "imageinfo",
            "iiprop": "url|size|mime|extmetadata", "iiurlwidth": 1600,
            "iiextmetadatafilter": "Artist|LicenseShortName",
        })
        r.raise_for_status()
        pages = sorted(r.json().get("query", {}).get("pages", {}).values(), key=lambda p: p.get("index", 99))
        for page in pages:
            info = (page.get("imageinfo") or [{}])[0]
            meta = info.get("extmetadata", {})
            licence = plain(meta.get("LicenseShortName", {}).get("value"))
            if (("commons", page["pageid"]) in used_ids or info.get("mime") not in ("image/jpeg", "image/png")
                    or info.get("width", 0) < 900 or info.get("height", 0) < 700
                    or SKIP_TITLES.search(page["title"]) or not OK_LICENSES.match(licence)):
                continue
            download(info.get("thumburl") or info["url"], out_path)
            used_ids.add(("commons", page["pageid"]))
            author = plain(meta.get("Artist", {}).get("value"))[:80] or "unknown author"
            return f"{page['title'].removeprefix('File:')} by {author} ({licence}), via Wikimedia Commons"
    except requests.RequestException as e:
        print(f"  wikimedia failed for {query!r}: {e}")
    return None


def fetch_visual(query, work, index, min_seconds, used_ids):
    """Returns (path, kind, credit). kind is "video", "image" or None (no visual found)."""
    if not query:
        return None, None, None
    clip = work / f"c{index}.mp4"
    if stock_video(query, clip, min_seconds, used_ids):
        return clip, "video", None
    photo = work / f"p{index}.img"
    credit = commons_photo(query, photo, used_ids)
    if credit:
        return photo, "image", credit
    return None, None, None
