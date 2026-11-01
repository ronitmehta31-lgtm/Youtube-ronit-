"""Generate one Seedance 2.5 clip through the Higgsfield API and print its URL.

    python main.py

Credentials: HF_KEY in key-id:key-secret format, read from the environment or from .env.local
(which Git ignores). The key is only passed to the SDK; it is never printed or logged.
This makes one billable request.
"""
import sys

import higgsfield_client
from dotenv import load_dotenv

MODEL = "bytedance/seedance-2.5/text-to-video"
ARGUMENTS = {
    "prompt": "A cinematic scene at sunset",
    "duration": 5,
    "resolution": "720p",
    "aspect_ratio": "16:9",
}


def main():
    # A variable already set in the environment wins over .env.local.
    load_dotenv(".env.local", override=False)

    def on_enqueue(request_id):
        print(f"Submitted request {request_id}; waiting for it to finish...", flush=True)

    try:
        result = higgsfield_client.subscribe(MODEL, arguments=ARGUMENTS, on_enqueue=on_enqueue)
    except higgsfield_client.CredentialsMissedError:
        sys.exit("HF_KEY is not set. Add it to .env.local (key-id:key-secret) or the environment.")
    except higgsfield_client.HiggsfieldClientError as e:
        # HTTP errors such as an invalid key or an empty balance.
        sys.exit(f"Higgsfield API error: {e}")

    # subscribe() returns the final JSON for every terminal state, so check it explicitly.
    status = result.get("status")
    video_url = (result.get("video") or {}).get("url")
    if status == "completed" and video_url:
        print(f"Completed. Video URL: {video_url}")
        return
    if status == "nsfw":
        sys.exit("Request was rejected by content moderation (nsfw). No video was produced.")
    if status == "canceled":
        sys.exit("Request was canceled before processing. No video was produced.")
    if status == "failed":
        sys.exit(f"Generation failed: {result.get('error') or 'no error message returned'}")
    sys.exit(f"Request finished without a video (status: {status!r}).")


if __name__ == "__main__":
    main()
