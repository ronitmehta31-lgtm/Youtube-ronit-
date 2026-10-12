"""Free voiceover with word timings, using Microsoft Edge's online voices (edge-tts)."""
import asyncio
import time

import edge_tts

TICKS = 10_000_000  # edge-tts reports time in 100-nanosecond ticks
TIMEOUT = 120  # seconds per attempt; the service occasionally stalls without raising


async def _collect(text, voice, rate):
    audio, words = bytearray(), []
    comm = edge_tts.Communicate(text, voice, rate=rate, boundary="WordBoundary")
    async for chunk in comm.stream():
        if chunk["type"] == "audio":
            audio += chunk["data"]
        elif chunk["type"] == "WordBoundary":
            start = chunk["offset"] / TICKS
            words.append((chunk["text"], start, start + chunk["duration"] / TICKS))
    if not audio:
        raise RuntimeError("no audio received")
    return bytes(audio), words


def synthesize(text, voice, rate, mp3_path, attempts=4):
    """Write text as speech to mp3_path. Returns [(word, start_sec, end_sec), ...]."""
    for attempt in range(1, attempts + 1):
        try:
            audio, words = asyncio.run(asyncio.wait_for(_collect(text, voice, rate), TIMEOUT))
            with open(mp3_path, "wb") as f:
                f.write(audio)
            return words
        except Exception as e:  # network stalls, service errors, timeouts
            if attempt == attempts:
                raise RuntimeError(f"voice failed after {attempts} attempts: {e!r}") from e
            print(f"    voice attempt {attempt} failed ({e!r}); retrying")
            time.sleep(10 * attempt)
