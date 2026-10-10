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
        out = ROOT / "out" / f"{path.stem}.mp4"
        credits = render(path, out)
        if credits:
            script["description"] = (script.get("description", "") + "\n\nPhotos: " + "; ".join(credits))[:5000]
        if do_upload:
            video_id, privacy, publish_at = upload.upload(out, script, config)
            script["youtube"] = {"id": video_id, "url": f"https://youtube.com/shorts/{video_id}",
                                 "privacy": privacy, "publish_at": publish_at}
            print(f"  uploaded: https://youtube.com/shorts/{video_id} ({privacy}"
                  f"{', goes live ' + publish_at if publish_at else ''})")
            (ROOT / "done" / path.name).write_text(json.dumps(script, indent=2) + "\n")
            path.unlink()


if __name__ == "__main__":
    main(sys.argv[1:])
