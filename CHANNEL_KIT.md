# Channel launch kit: Kahani Ghar (कहानी घर)

Everything to set the channel up properly and get it monetised. Do the steps in order.

## 1. Channel name and handle

Name: **कहानी घर | Kahani Ghar**
Handle: **@KahaniGharHindi** (if taken, try @KahaniGharTV or @KahaniGhar.Official)

YouTube Studio → Customisation → Basic info → Name, Handle → Publish.

## 2. Profile picture and banner

Made by the **Make channel art** workflow (GitHub → Actions → Make channel art → Run workflow).
The files appear in `assets/channel/`:
- `profile.jpg` (800×800) → Customisation → Branding → Picture
- `banner.jpg` (2560×1440) → Customisation → Branding → Banner image

## 3. Channel description (copy and paste)

> कहानी घर में आपका स्वागत है! 🙏
>
> यहाँ हर दिन आपको मिलेगी एक नई हिंदी कहानी: परिवार की कहानियाँ, माँ-बाप और बच्चों के रिश्ते, सास-बहू की कहानियाँ, गाँव की यादें, प्रेरक कहानियाँ, रहस्य और लोककथाएँ। हर कहानी के साथ एक सीख, जो दिल को छू जाए।
>
> 📅 हर दिन शाम 7 बजे नई कहानी
> 🔔 सब्सक्राइब करें और घंटी दबाएँ, ताकि कोई कहानी छूट न जाए।
>
> Welcome to Kahani Ghar: heart-touching Hindi stories every day. Family stories, moral stories, emotional stories, village tales, motivational stories and folk tales, each with a lesson.
>
> #hindikahani #moralstories #hindistory #kahaniyan

## 4. Channel keywords

Customisation → Basic info (or Settings → Channel → Keywords):

`hindi kahani, hindi kahaniya, moral stories in hindi, hindi story, emotional story, family story, saas bahu kahani, motivational story hindi, gaon ki kahani, lok katha, kahaniyan, hindi moral kahani`

Settings → Channel → Country: **India**. Audience: **No, it's not made for kids** (these stories are for families and adults).

## 5. Playlists (create these; add each video to the right one)

| Playlist | Videos |
|---|---|
| 👨‍👩‍👧 परिवार की कहानियाँ (Family stories) | माँ का अचार, सास-बहू |
| 💪 प्रेरक कहानियाँ (Motivational) | मज़दूर का बेटा |
| 👻 रहस्य और डरावनी कहानियाँ (Mystery) | कुएँ की आवाज़ |
| 🌾 गाँव की यादें (Village memories) | दादाजी का आम |
| 🧠 चतुराई की कहानियाँ (Clever stories) | चालाक बहू |
| 👑 लोककथाएँ (Folk tales) | घमंडी राजा |

Playlists keep people watching one story after another, which is the fastest way to build watch hours.

## 6. Every video, after upload (2 minutes)

1. Watch it. If it's good, set **Visibility → Public**.
2. **End screen** (Editor → End screen): add "Best for viewer" video + Subscribe button. Our stories end with a ~20 second goodbye that fits it.
3. Add it to the right **playlist**.
4. **Pin a comment**, for example: `आपको इस कहानी से क्या सीख मिली? कमेंट में ज़रूर बताइए 🙏`
5. Make the **Short teaser** public too. Its description already links to the full story.

## 7. Monetisation: what YouTube requires

**YouTube Partner Program (ad money)**, you need all of:
- **1,000 subscribers**
- **4,000 public watch hours** on long videos in the last 12 months, **or** 10 million Shorts views in 90 days
- 2-step verification on the Google account (myaccount.google.com → Security)
- An **AdSense** account (you link it during the application)
- No active Community Guidelines strikes

A lower tier opens at **500 subscribers + 3,000 watch hours** (or 3 million Shorts views) with 3 public uploads in 90 days. It gives memberships, Super Thanks and Super Chat, but not ad money.

Apply at YouTube Studio → **Earn**. Review usually takes about a month.

**Rough path:** one 8-minute story a day. If each video averages 3,000 views at 40% watched, that's ~160 watch hours a video, so 4,000 hours in about 25 videos. The Short teasers bring the subscribers.

## 8. Rules that get AI story channels approved (or rejected)

YouTube reviews the channel by hand before approving ads. What they check:

- ✅ **Original stories.** Every story here is written fresh. Never re-upload other channels' stories or videos.
- ✅ **Variety.** Different story types, characters and lessons each day, not one template with names swapped. Repetitive, mass-produced videos are refused as "inauthentic content".
- ✅ **Real value.** Each story has a clear lesson and emotion. Keep titles honest: the story must deliver what the title promises.
- ✅ **AI disclosure.** Our pictures are clearly illustrations, so the "altered or synthetic content" box is not required. Tick it if you ever use realistic AI images of real-looking people or events.
- ✅ **Music.** Only music from the YouTube Audio Library (Studio → Audio Library), placed in `assets/music/`.
- ❌ No real people's names or photos, no copied Bollywood clips, no misleading thumbnails.

## 9. Let videos go public automatically (optional, later)

Right now Google forces API uploads to **private**. After a week or two of good videos, apply for the free audit:
<https://support.google.com/youtube/contact/yt_api_form>
Say: "Personal tool that uploads my own original Hindi story videos to my own channel." After approval, set `"privacy": "scheduled"` in `autotube/config.json` and videos go live in the evening by themselves.

## 10. Weekly routine

| When | What |
|---|---|
| Every day | Watch the new story + Short, make them public, end screen, playlist, pinned comment |
| Every Friday | Ask Claude: "write 7 more stories" |
| Every Sunday | YouTube Studio → Analytics: note which story type got the most views. Tell Claude, and the next week leans towards it |
