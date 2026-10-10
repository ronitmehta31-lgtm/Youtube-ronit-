"""Free voiceover with word timings, using Microsoft Edge's online voices (edge-tts)."""
import edge_tts

TICKS = 10_000_000  # edge-tts reports time in 100-nanosecond ticks


def synthesize(text, voice, rate, mp3_path):
    """Write text as speech to mp3_path. Returns [(word, start_sec, end_sec), ...]."""
    words = []
    comm = edge_tts.Communicate(text, voice, rate=rate, boundary="WordBoundary")
    with open(mp3_path, "wb") as f:
        for chunk in comm.stream_sync():
            if chunk["type"] == "audio":
                f.write(chunk["data"])
            elif chunk["type"] == "WordBoundary":
                start = chunk["offset"] / TICKS
                words.append((chunk["text"], start, start + chunk["duration"] / TICKS))
    return words
