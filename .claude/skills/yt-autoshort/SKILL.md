---
name: yt-autoshort
description: >-
  Fill the automated Shorts pipeline's queue/ with ready-to-render video
  scripts for the channel's niche. Use for "write more shorts", "fill the
  queue", "make next week's videos", "/yt-autoshort 7", or whenever the
  queue/ folder is empty or low.
---

# yt-autoshort

Writes scripts that `autotube/` turns into videos and uploads. You are the script writer in a
pipeline with no human in the loop until the upload, so every fact has to be right the first time.

## Inputs

1. `autotube/config.json`: `niche` is the channel's niche. If it is empty, read
   `reports/niches-latest.md`, propose the top niche, and ask the user to confirm it before writing
   anything. Save the confirmed niche back into `config.json`.
2. `reports/niches-latest.json` (if present): the top outlier videos per niche. Use their topics and
   angles as inspiration. Never copy a title.
3. Every title in `queue/*.json` and `done/*.json`. Do not repeat a topic.
4. `~/.claude/youtube/voice.md` if it exists.

Default count is 7 scripts (one week). The user can pass a number.

## Each script

Save it as `queue/NNNN-short-slug.json`, continuing the highest number across `queue/` and `done/`.
Follow the format in `queue/_example.json` exactly:

- `title`: under 60 characters, specific, true. No "#shorts" (the uploader adds it).
- `description`: 1–2 sentences, then 3–4 hashtags.
- `tags`: 4–8 search phrases.
- `scenes`: 5–8 scenes, **70–120 spoken words in total** (25–45 seconds).
  - Scene 1 is the hook. Write 5 hook options first using `.claude/skills/yt-script/hooks.json`, score them (one per line in a scratch `hooks.txt`) with
    `python3 .claude/skills/yt-script/hookscore.py hooks.txt`, and use the winner.
  - Each scene is 1–2 short spoken sentences. Write for the ear: numbers as people say them.
  - The last scene gives the payoff or asks a question people will answer in the comments.
  - `search`: 2–4 concrete, filmable words for stock-footage search ("ocean waves aerial", not
    "the concept of time"). Pixabay has generic footage: people, nature, cities, space, animals, food,
    technology. Pick shots that exist.

## Rules

- **Only true facts.** If you are not sure a number is right, cut it or check it. A wrong fact in a
  faceless channel gets corrected in the comments and kills trust.
- No medical, financial or legal advice framed as instructions. No real people in a negative light.
- Each video needs its own angle. Ten near-identical "5 facts about X" videos is exactly the
  "repetitive content" YouTube refuses to monetize. Vary the format: myth vs truth, one deep fact,
  a countdown, a "what would happen if", a comparison.
- After writing, list the new titles for the user and say how many are now in the queue.
