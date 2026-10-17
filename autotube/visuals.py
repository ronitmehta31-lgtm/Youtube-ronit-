"""Free visuals for each scene.

Scenes with an "image" prompt get an AI illustration from the first provider that is set up:
fal.ai (FAL_KEY, ~$0.006 per picture), Cloudflare Workers AI (CF_ACCOUNT_ID + CF_API_TOKEN, free daily
allowance), or Pollinations (no key, often overloaded).
Scenes with a "search" phrase get, best first:
1. Pixabay stock video (needs PIXABAY_API_KEY)
2. Pexels stock video (needs PEXELS_API_KEY)
3. Wikimedia Commons photo (no key needed; credited in the video description)
"""
import html
import os
import base64
import re
import time
from urllib.parse import quote

import requests

PIXABAY = "https://pixabay.com/api/videos/"
PEXELS = "https://api.pexels.com/videos/search"
COMMONS = "https://commons.wikimedia.org/w/api.php"
POLLINATIONS = "https://image.pollinations.ai/prompt/"
FAL_FLUX = "https://fal.run/fal-ai/flux/schnell"
CLOUDFLARE_FLUX = "https://api.cloudflare.com/client/v4/accounts/{}/ai/run/@cf/black-forest-labs/flux-1-schnell"
_ai_failures = 0  # consecutive failures; after a few we stop asking for the rest of the run
hosted_urls = {}  # local picture path -> its fal.ai URL, so animation can reuse it without uploading
USER_AGENT = "autotube/1.0 (personal YouTube Shorts tool; https://github.com/ronitmehta31-lgtm/Youtube-ronit-)"
SKIP_TITLES = re.compile(r"\b(map|diagram|chart|logo|flag|coat of arms|graph|plot|icon|seal|stamp|text|svg|fig|plate|"
                         r"drawing|illustration|engraving|painting|sketch|yacht|ship|boat|for sale|market|food|dish|"
                         r"restaurant|menu|poster|book|page|scan|museum|specimen|preserved|stuffed|statue|toy)\b", re.I)
# Commons search operators: leave out artwork and old scans.
SEARCH_EXCLUDE = "-drawing -illustration -engraving -painting -lithograph -plate"
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
    sources = [(pixabay_candidates, os.environ.get("PIXABAY_API_KEY", "").strip()),
               (pexels_candidates, os.environ.get("PEXELS_API_KEY", "").strip())]
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
            "gsrsearch": f"{query} filetype:bitmap filemime:image/jpeg {SEARCH_EXCLUDE}", "gsrlimit": 20, "prop": "imageinfo",
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
                    or SKIP_TITLES.search(page["title"]) or not OK_LICENSES.match(licence)
                    or not any(w.lower() in page["title"].lower() for w in query.split()[:1])):
                continue
            download(info.get("thumburl") or info["url"], out_path)
            used_ids.add(("commons", page["pageid"]))
            author = plain(meta.get("Artist", {}).get("value"))[:80] or "unknown author"
            return f"{page['title'].removeprefix('File:')} by {author} ({licence}), via Wikimedia Commons"
    except requests.RequestException as e:
        print(f"  wikimedia failed for {query!r}: {e}")
    return None


def fal_image(prompt, out_path, width, height, seed, key):
    r = requests.post(FAL_FLUX, headers={"Authorization": f"Key {key}"}, timeout=180, json={
        "prompt": prompt, "image_size": {"width": width, "height": height}, "num_inference_steps": 4,
        "seed": seed, "enable_safety_checker": True})
    if r.status_code != 200:  # fal explains itself in the body, e.g. "Exhausted balance"
        raise requests.HTTPError(f"HTTP {r.status_code}: {r.text[:200]}")
    url = r.json()["images"][0]["url"]
    download(url, out_path)
    hosted_urls[str(out_path)] = url


def cloudflare_image(prompt, out_path, seed, account, token):
    r = requests.post(CLOUDFLARE_FLUX.format(account), headers={"Authorization": f"Bearer {token}"}, timeout=180,
                      json={"prompt": prompt[:2000], "steps": 4, "seed": seed})
    r.raise_for_status()
    with open(out_path, "wb") as fh:
        fh.write(base64.b64decode(r.json()["result"]["image"]))


def pollinations_image(prompt, out_path, width, height, seed):
    r = requests.get(POLLINATIONS + quote(prompt[:1800], safe=""), timeout=90, headers={"User-Agent": USER_AGENT},
                     params={"width": width, "height": height, "seed": seed, "model": "flux", "nologo": "true",
                             "private": "true", "referrer": "autotube"})
    if r.status_code != 200 or not r.headers.get("content-type", "").startswith("image/"):
        raise requests.HTTPError(f"HTTP {r.status_code} {r.text[:80]!r}")
    with open(out_path, "wb") as fh:
        fh.write(r.content)


def ai_image(prompt, out_path, width, height, seed):
    """Generate an illustration with the first configured provider. Returns True on success."""
    global _ai_failures
    if _ai_failures >= 3:
        return False
    fal = os.environ.get("FAL_KEY", "").strip()
    cf_account = os.environ.get("CF_ACCOUNT_ID", "").strip()
    cf_token = os.environ.get("CF_API_TOKEN", "").strip()
    if fal:
        name, call = "fal.ai", lambda: fal_image(prompt, out_path, width, height, seed, fal)
    elif cf_account and cf_token:
        name, call = "cloudflare", lambda: cloudflare_image(prompt, out_path, seed, cf_account, cf_token)
    else:
        name, call = "pollinations", lambda: pollinations_image(prompt, out_path, width, height, seed)
    for attempt in range(2):
        try:
            call()
            _ai_failures = 0
            return True
        except (requests.RequestException, KeyError, ValueError) as e:
            print(f"    {name} picture attempt {attempt + 1} failed: {str(e)[:200]}")
            time.sleep(5)
    _ai_failures += 1
    if _ai_failures >= 3:
        print(f"    {name} keeps failing; using fallback visuals for the rest of this video")
    return False


def fetch_visual(query, work, index, min_seconds, used_ids, image_prompt=None, size=(1920, 1080), seed=42):
    """Returns (path, kind, credit). kind is "video", "image" or None (no visual found)."""
    if image_prompt:
        art = work / f"a{index}.jpg"
        if ai_image(image_prompt, art, size[0], size[1], seed):
            return art, "image", None
    if not query:
        return None, None, None
    clip = work / f"c{index}.mp4"
    if stock_video(query, clip, min_seconds, used_ids):
        return clip, "video", None
    photo = work / f"p{index}.img"
    words = query.split()
    # Specific searches often find nothing on Commons, so retry with fewer words.
    for attempt in dict.fromkeys([query, " ".join(words[:2]), words[0]]):
        credit = commons_photo(attempt, photo, used_ids)
        if credit:
            return photo, "image", credit
    return None, None, None
