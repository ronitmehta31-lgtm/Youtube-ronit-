"""Rank candidate niches by how well small channels' Shorts are doing in them right now.

Needs a free YouTube Data API key in the YT_API_KEY environment variable.
Each niche costs about 102 quota units (the free daily quota is 10,000).

    python -m autotube.niche                      # niches from config.json
    python -m autotube.niche "chess tips" "car facts"
    python -m autotube.niche --long "horror stories"   # 4-20 minute videos instead of Shorts
"""
import datetime as dt
import json
import math
import os
import statistics
import sys
from pathlib import Path

import requests

API = "https://www.googleapis.com/youtube/v3"
ROOT = Path(__file__).resolve().parent.parent
SMALL_CHANNEL = 100_000  # subscribers
BIG_HIT = 100_000  # views


def get(endpoint, **params):
    params["key"] = os.environ.get("YT_API_KEY", "").strip()
    if not params["key"]:
        sys.exit("YT_API_KEY is missing. Add it under GitHub Settings -> Secrets and variables -> Actions.")
    r = requests.get(f"{API}/{endpoint}", params=params, timeout=30)
    if r.status_code != 200:
        sys.exit(f"YouTube API error {r.status_code}: {r.text[:300]}")
    return r.json()


def chunks(items, n=50):
    for i in range(0, len(items), n):
        yield items[i:i + n]


def scan(niche, days=30, long=False):
    since = (dt.datetime.now(dt.timezone.utc) - dt.timedelta(days=days)).strftime("%Y-%m-%dT%H:%M:%SZ")
    found = get("search", part="id", q=niche if long else f"{niche} #shorts", type="video",
                videoDuration="medium" if long else "short",
                order="viewCount", publishedAfter=since, maxResults=50)
    ids = [it["id"]["videoId"] for it in found.get("items", [])]
    if not ids:
        return None

    videos = []
    for group in chunks(ids):
        videos += get("videos", part="snippet,statistics", id=",".join(group))["items"]
    channel_ids = list({v["snippet"]["channelId"] for v in videos})
    subs = {}
    for group in chunks(channel_ids):
        for c in get("channels", part="statistics", id=",".join(group))["items"]:
            subs[c["id"]] = int(c["statistics"].get("subscriberCount", 0) or 0)

    rows = []
    for v in videos:
        views = int(v["statistics"].get("viewCount", 0))
        s = subs.get(v["snippet"]["channelId"], 0)
        rows.append({
            "title": v["snippet"]["title"],
            "channel": v["snippet"]["channelTitle"],
            "url": f"https://youtube.com/{'watch?v=' if long else 'shorts/'}{v['id']}",
            "views": views,
            "subs": s,
            "multiple": round(views / max(s, 1000), 1),
        })
    rows.sort(key=lambda r: r["multiple"], reverse=True)

    views = [r["views"] for r in rows]
    small_hits = sum(1 for r in rows if r["subs"] < SMALL_CHANNEL and r["views"] >= BIG_HIT)
    median_views = statistics.median(views)
    median_multiple = round(statistics.median(r["multiple"] for r in rows), 1)
    # Demand (how many views the niche gets) + opportunity (small channels breaking through).
    score = round(10 * math.log10(max(median_views, 1)) + 3 * small_hits + 2 * min(median_multiple, 25), 1)
    return {
        "niche": niche,
        "score": score,
        "median_views": int(median_views),
        "small_channel_hits": small_hits,
        "median_multiple": median_multiple,
        "channels": len(channel_ids),
        "top_videos": rows[:15],
    }


def main(argv):
    config = json.loads((ROOT / "autotube" / "config.json").read_text())
    long = "--long" in argv
    argv = [a for a in argv if a != "--long"]
    niches = argv or config["candidate_niches"]
    results = []
    for n in niches:
        print(f"scanning: {n}", flush=True)
        r = scan(n, long=long)
        if r:
            results.append(r)
    results.sort(key=lambda r: r["score"], reverse=True)

    today = dt.date.today().isoformat()
    out = ROOT / "reports"
    out.mkdir(exist_ok=True)
    (out / "niches-latest.json").write_text(json.dumps(results, indent=2))

    lines = [f"# Niche report, {today}", "",
             f"Last 30 days of {'4-20 minute videos' if long else 'Shorts'}. **Small hits** = videos with 100k+ views from channels under 100k "
             "subscribers. **Multiple** = views divided by the channel's subscriber count.", "",
             "| rank | niche | score | median views | small hits | median multiple |",
             "|---|---|---|---|---|---|"]
    for i, r in enumerate(results, 1):
        lines.append(f"| {i} | {r['niche']} | {r['score']} | {r['median_views']:,} | "
                     f"{r['small_channel_hits']} | {r['median_multiple']}x |")
    for r in results[:3]:
        lines += ["", f"## {r['niche']}: top outliers", ""]
        for v in r["top_videos"][:8]:
            lines.append(f"- [{v['title']}]({v['url']}): {v['views']:,} views, "
                         f"{v['subs']:,} subs ({v['multiple']}x)")
    (out / "niches-latest.md").write_text("\n".join(lines) + "\n")
    print("\n".join(lines[:len(results) + 6]))


if __name__ == "__main__":
    main(sys.argv[1:])
