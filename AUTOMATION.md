# Automated YouTube Shorts (free version)

```
Find a niche  ->  Claude writes scripts  ->  GitHub makes the video  ->  GitHub uploads it
(YouTube API)     (/yt-autoshort -> queue/)   (free voice + Pexels + ffmpeg)   (every day, on a schedule)
```

Everything here is free: GitHub Actions runs it, Microsoft Edge's online voices read the script,
Pexels supplies the footage, and the YouTube Data API does the research and the upload. The only
part that uses Claude is writing the scripts, which runs on your existing Claude plan.

## One-time setup (about 30 minutes)

### 1. Pexels key (stock footage) — 2 minutes
1. Sign up at <https://www.pexels.com/api/> and click **Your API Key**.
2. Copy the key. Without it, videos still render, on coloured gradient backgrounds instead of footage.

### 2. Google Cloud project (research + upload) — 15 minutes
1. Go to <https://console.cloud.google.com/>, sign in with the Google account that owns your channel,
   and create a project (any name, for example `autotube`).
2. **APIs & Services → Library** → search **YouTube Data API v3** → **Enable**.
3. **APIs & Services → Credentials → Create credentials → API key**. Copy it. This is `YT_API_KEY`
   (used by the niche finder).
4. **APIs & Services → OAuth consent screen** (also called "Google Auth Platform"):
   - User type **External**, app name `autotube`, your email as support and developer contact.
   - Add yourself under **Test users**.
   - Then click **Publish app** so its status is **In production**. If you skip this, your login
     expires every 7 days and uploads stop. Google will show an "unverified app" warning when you
     log in; that's expected for a personal tool. Click **Advanced → Go to autotube**.
5. **Credentials → Create credentials → OAuth client ID → Desktop app**. Download the JSON file and
   rename it `client_secret.json`.

### 3. Log in once, on your own computer — 3 minutes
You need Python 3 installed (<https://www.python.org/downloads/>). Download
[`autotube/get_token.py`](autotube/get_token.py) into the same folder as `client_secret.json`, then run:

```bash
python get_token.py client_secret.json
```

Your browser opens. Pick your channel and allow access. The terminal prints three values:
`YT_CLIENT_ID`, `YT_CLIENT_SECRET`, `YT_REFRESH_TOKEN`. Never commit `client_secret.json` or these
values to the repo.

### 4. Add the secrets to GitHub — 3 minutes
Repo → **Settings → Secrets and variables → Actions → New repository secret**. Add all five:

| name | from |
|---|---|
| `PEXELS_API_KEY` | step 1 |
| `YT_API_KEY` | step 2.3 |
| `YT_CLIENT_ID` | step 3 |
| `YT_CLIENT_SECRET` | step 3 |
| `YT_REFRESH_TOKEN` | step 3 |

## Running it

### Step A — find your niche
Repo → **Actions → Find a niche → Run workflow**. Leave the box blank to compare the 10 niches in
`autotube/config.json`, or type your own, separated by commas (`chess tips, car facts, cricket facts`).
The ranking appears on the run page and is saved to `reports/niches-latest.md`.

A good niche has a high score **and** several "small hits": small channels getting big views, which
means newcomers can break through.

### Step B — fill the queue
Open Claude Code on this repo and say:

> /yt-autoshort 7

Claude reads the niche report, asks you to confirm the niche, and writes 7 scripts into `queue/`.
Read them. Fix anything that sounds wrong. Then have Claude commit and push.

### Step C — make videos
The **Make and upload a Short** workflow runs every day at 13:17 UTC (6:47 pm India time) and turns the
oldest script in `queue/` into a video. To run it right away: **Actions → Make and upload a Short →
Run workflow**. Each run's video can be downloaded from the run page under **Artifacts** for 7 days.

After a successful upload the script moves from `queue/` to `done/`, with the video link added.
When the queue runs dry, repeat step B. A weekly `/yt-autoshort 7` keeps one video a day going.

## Important: why uploads start as private

Google locks every new API project so that **all uploads are private** until the project passes a
free audit. So for now:

1. Each video uploads as **private**. Watch it in YouTube Studio (it takes 30 seconds) and switch it
   to Public. That doubles as your quality check.
2. When you're happy with the output, apply for the audit:
   <https://support.google.com/youtube/contact/yt_api_form>. Say it's a personal tool that uploads
   to your own channel only.
3. After approval, set `"privacy": "public"` in `autotube/config.json`, or `"scheduled"` to have
   each video go live at `publish_hour_utc`.

## Settings (`autotube/config.json`)

| setting | what it does |
|---|---|
| `niche` | your channel's niche; `/yt-autoshort` writes about this |
| `candidate_niches` | the list the niche finder compares by default |
| `voice` / `voice_rate` | the free voice. Other good ones: `en-US-ChristopherNeural`, `en-US-AriaNeural`, `en-GB-RyanNeural`, `en-IN-PrabhatNeural`, `en-IN-NeerjaNeural`, Hindi: `hi-IN-MadhurNeural`, `hi-IN-SwaraNeural` |
| `privacy` | `private`, `unlisted`, `public` or `scheduled` |
| `publish_hour_utc` | the hour `scheduled` videos go live |
| `videos_per_run` | videos made per daily run (the free API quota allows about 6 uploads a day) |
| `contains_synthetic_media` | set to `true` if videos show realistic AI-made people or events |
| `music_volume` | background music level (0.12 = quiet) |

**Background music:** download a few tracks from the YouTube Audio Library (Studio → Audio Library)
and put the `.mp3` files in `assets/music/`. A random one is mixed under each video. Only use music
you have the rights to.

## Rules that keep the channel safe

- **Monetization:** YouTube won't monetize mass-produced, repetitive videos. Vary formats, keep facts
  true, and keep checking each video before it goes public. `/yt-autoshort` is written to do this,
  but you're the final check.
- **Facts:** a wrong fact gets called out in the comments. Read the scripts before pushing them.
- **This repo is public:** your scripts and rendered videos (the Artifacts) are visible to others on
  GitHub. Your secrets are not. Make the repo private if you'd rather keep everything hidden; private
  repos get 2,000 free Actions minutes a month, and each video takes about 3–5.

## Upgrading later (paid)

| part | free now | paid upgrade |
|---|---|---|
| voice | Edge voices | ElevenLabs (more natural, about $5–22/month) |
| footage | Pexels stock | AI-generated clips or images |
| scripts | Claude writes them when you ask | a weekly scheduled Claude routine that fills the queue on its own (runs on your Claude plan) |
