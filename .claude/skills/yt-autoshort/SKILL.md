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

## Kids channel mode (when `made_for_kids` is true in config.json)

The channel teaches toddlers vehicles and animals, in English and Hindi in the same video. These rules
replace the hook/comment rules above.

- Every item is one scene with **two lines** over the same clip, English first, then Hindi:

  ```json
  {"search": "cow", "lines": [
    {"text": "This is a cow! The cow says moo!", "lang": "en"},
    {"text": "यह गाय है! गाय हमें दूध देती है।", "lang": "hi"}
  ]}
  ```

  The renderer picks the voice for each line from `voices` in config.json.
- First scene: a cheerful intro in both languages ("Let's learn farm animals! चलो खेत के जानवर सीखें!").
  Last scene: a goodbye in both languages. **Never ask for comments**: they are switched off on
  made-for-kids videos.
- 5–6 items per video, one idea each. Short, simple words a 2–5 year old knows. Animal sounds and
  vehicle sounds ("choo choo", "beep beep") are good. Hindi in natural, everyday Devanagari, not a
  word-for-word translation.
- Only say what the clip will reliably show. Do not name colours unless nearly every clip of that
  thing has that colour (a fire truck is red; a car is not any one colour).
- `search`: the plain thing name Pixabay will have footage of (`cow`, `fire truck`, `school bus`,
  `excavator`). Avoid ambiguous words (`crane` → `construction crane`).
- Title: `English title | हिंदी शीर्षक`, under 70 characters. Description: one friendly line in each
  language, then hashtags like `#kidslearning #toddlers #hindirhymes`.
- Mix the week: alternate vehicle and animal videos, and vary the theme (farm, jungle, pets, birds,
  road, rescue, sky, water, big machines) so no two videos repeat the same items.

## Story channel mode (when scripts use `"format": "long"`)

The channel now posts Hindi family/moral stories (हिंदी कहानी): one 7–9 minute video a day plus a Short
teaser cut from it. Copy the structure of `queue/0012-maa-ka-achaar.json` exactly.

- 25–36 scenes, 750–1,000 Hindi words. Each scene: `text` (2–3 spoken sentences, natural everyday Hindi in
  Devanagari, numbers written as words) and `image` (an English picture prompt).
- Scene 1 is the hook: the most dramatic moment and a promise ("और आख़िर में जो हुआ…"). The last scene gives
  the lesson, then asks for a like and subscribe.
- Characters: describe each one once (age, hair, clothes) and paste the same description into every
  `image` prompt they appear in, so the pictures stay consistent. The shared `style` is appended automatically.
- `thumbnail`: `{"scene": 0, "text": "<4–6 word Hindi hook>"}`. No emoji in thumbnail text.
- `short`: a teaser title, 4–5 scene indices that tell the setup and the cliffhanger (they must total under a
  minute), and the outro line asking viewers to watch the full story on the channel.
- Rotate story types across the week: family/moral, mystery (never gory), motivational, saas-bahu/relationships,
  clever-wit, 90s village memories, folk tales/kings. Original plots only; never retell a famous film or another
  channel's story. No real people.
