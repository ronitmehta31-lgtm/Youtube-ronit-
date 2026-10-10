"""Make (and upload) the next video(s) waiting in queue/.

    python -m autotube.run            # render + upload if YouTube credentials are set
    python -m autotube.run --no-upload
"""
import json
import sys
from pathlib import Path

from . import upload
from .render import render

ROOT = Path(__file__).resolve().parent.parent


def main(argv):
    config = json.loads((ROOT / "autotube" / "config.json").read_text())
    do_upload = "--no-upload" not in argv and upload.has_credentials()
    if "--no-upload" not in argv and not do_upload:
        print("No YouTube credentials set, so videos are rendered but not uploaded.")

    pending = sorted(p for p in (ROOT / "queue").glob("*.json") if not p.name.startswith("_"))
    if not pending:
        print("Queue is empty. Ask Claude to run /yt-autoshort to write more scripts.")
        return
    for path in pending[:config["videos_per_run"]]:
        print(f"Making {path.name}")
        script = json.loads(path.read_text())
        made = render(path, ROOT / "out")
        if made["credits"]:
            script["description"] = (script.get("description", "") + "\n\nPhotos: " + "; ".join(made["credits"]))[:5000]
        if not do_upload:
            continue
        if made["missing_visuals"] > 0.25:
            print(f"  NOT uploading: {made['missing_visuals']:.0%} of scenes have no picture. "
                  "Check the picture provider keys; the script stays in the queue.")
            continue

        long = script.get("format") == "long"
        video_id, privacy, publish_at = upload.upload(made["main"], script, config, short=not long)
        url = f"https://youtu.be/{video_id}" if long else f"https://youtube.com/shorts/{video_id}"
        script["youtube"] = {"id": video_id, "url": url, "privacy": privacy, "publish_at": publish_at}
        print(f"  uploaded: {url} ({privacy}{', goes live ' + publish_at if publish_at else ''})")
        if made["thumbnail"]:
            upload.set_thumbnail(video_id, made["thumbnail"])

        if made["short"]:
            teaser = script["short"]
            meta = {**script, "title": teaser.get("title", script["title"]),
                    "description": f"पूरी कहानी यहाँ देखें 👉 {url}\n\n{script.get('description', '')}"[:5000]}
            short_id, short_privacy, _ = upload.upload(made["short"], meta, config, short=True)
            script["youtube_short"] = {"id": short_id, "url": f"https://youtube.com/shorts/{short_id}",
                                       "privacy": short_privacy}
            print(f"  uploaded teaser: https://youtube.com/shorts/{short_id} ({short_privacy})")

        (ROOT / "done" / path.name).write_text(json.dumps(script, indent=2, ensure_ascii=False) + "\n")
        path.unlink()


if __name__ == "__main__":
    main(sys.argv[1:])
