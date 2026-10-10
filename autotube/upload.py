"""Upload a video with the YouTube Data API, using your own OAuth refresh token.

Needs YT_CLIENT_ID, YT_CLIENT_SECRET and YT_REFRESH_TOKEN (see autotube/get_token.py).
"""
import datetime as dt
import json
import os
from pathlib import Path

import requests

TOKEN_URL = "https://oauth2.googleapis.com/token"
UPLOAD_URL = "https://www.googleapis.com/upload/youtube/v3/videos"
THUMBNAIL_URL = "https://www.googleapis.com/upload/youtube/v3/thumbnails/set"


def has_credentials():
    return all(os.environ.get(k, "").strip() for k in ("YT_CLIENT_ID", "YT_CLIENT_SECRET", "YT_REFRESH_TOKEN"))


def access_token():
    r = requests.post(TOKEN_URL, data={
        "client_id": os.environ["YT_CLIENT_ID"].strip(),
        "client_secret": os.environ["YT_CLIENT_SECRET"].strip(),
        "refresh_token": os.environ["YT_REFRESH_TOKEN"].strip(),
        "grant_type": "refresh_token",
    }, timeout=30)
    if r.status_code != 200:
        raise RuntimeError(f"could not refresh the YouTube token ({r.status_code}): {r.text[:300]}")
    return r.json()["access_token"]


def next_publish_time(hour_utc):
    """Next occurrence of hour_utc that is at least an hour away, in RFC 3339."""
    now = dt.datetime.now(dt.timezone.utc)
    when = now.replace(hour=hour_utc, minute=0, second=0, microsecond=0)
    if when < now + dt.timedelta(hours=1):
        when += dt.timedelta(days=1)
    return when.strftime("%Y-%m-%dT%H:%M:%SZ")


def upload(video_path, script, config, short=True):
    title = script["title"]
    if short and "#shorts" not in title.lower() and len(title) <= 92:
        title += " #shorts"
    status = {
        "privacyStatus": config["privacy"],
        "selfDeclaredMadeForKids": script.get("made_for_kids", config["made_for_kids"]),
        "containsSyntheticMedia": script.get("contains_synthetic_media", config["contains_synthetic_media"]),
    }
    if config["privacy"] == "scheduled":
        status["privacyStatus"] = "private"
        status["publishAt"] = next_publish_time(config["publish_hour_utc"])
    body = {
        "snippet": {
            "title": title[:100],
            "description": script.get("description", "")[:5000],
            "tags": script.get("tags", [])[:15],
            "categoryId": str(script.get("category_id", config["category_id"])),
        },
        "status": status,
    }

    headers = {"Authorization": f"Bearer {access_token()}"}
    size = Path(video_path).stat().st_size
    start = requests.post(UPLOAD_URL, params={"uploadType": "resumable", "part": "snippet,status"},
                          headers={**headers, "Content-Type": "application/json; charset=UTF-8",
                                   "X-Upload-Content-Type": "video/mp4",
                                   "X-Upload-Content-Length": str(size)},
                          data=json.dumps(body), timeout=60)
    if "youtubeSignupRequired" in start.text:
        raise RuntimeError("The Google account you logged in with has no YouTube channel. Run get_token.py again "
                           "and pick the channel itself in the account chooser, then update YT_REFRESH_TOKEN.")
    if start.status_code != 200:
        raise RuntimeError(f"upload rejected ({start.status_code}): {start.text[:500]}")
    with open(video_path, "rb") as f:
        done = requests.put(start.headers["Location"], data=f,
                            headers={**headers, "Content-Type": "video/mp4", "Content-Length": str(size)},
                            timeout=600)
    if done.status_code not in (200, 201):
        raise RuntimeError(f"upload failed ({done.status_code}): {done.text[:500]}")
    video = done.json()
    print(f"  channel: {video['snippet'].get('channelTitle')}")
    return video["id"], video["status"].get("privacyStatus"), status.get("publishAt")


def set_thumbnail(video_id, image_path):
    """Set a custom thumbnail. Needs a phone-verified channel; failure is reported, not fatal."""
    with open(image_path, "rb") as f:
        r = requests.post(THUMBNAIL_URL, params={"videoId": video_id}, data=f, timeout=120,
                          headers={"Authorization": f"Bearer {access_token()}", "Content-Type": "image/jpeg"})
    if r.status_code == 200:
        print("  thumbnail set")
        return True
    print(f"  thumbnail not set ({r.status_code}): {r.text[:300]}")
    if r.status_code == 403:
        print("  -> verify the channel with a phone number at https://www.youtube.com/verify to allow custom thumbnails")
    return False
