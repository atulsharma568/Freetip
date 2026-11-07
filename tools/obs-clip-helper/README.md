# Freetip OBS clip helper

Cuts a video clip out of **your own OBS recording** for every moment Freetip saves
(`!ts` in your YouTube chat, a big tip, a completed goal) and uploads it to **your own
Discord channel**.

YouTube gives nobody a way to cut a clip out of a live stream, so the clip has to come
from the recording OBS makes on your PC. That is why this is a program you run next to
OBS and not a feature of the website.

What goes where:

- Freetip tells the helper **which moments were saved** (the time, what was typed, and
  which stream). It sends no viewer names.
- The video **never leaves your PC** except to your Discord.
- Your Discord webhook address is typed into `config.json` on your PC. Freetip never sees
  it for this feature.

## One-time setup

1. **Node.js 22 or newer** (https://nodejs.org). Check with `node -v`.
2. **OBS 28 or newer.** In OBS:
   - *Settings, Output*: turn on the **Replay Buffer**, and set its length to what the
     Timestamps page in Freetip tells you (your chat delay plus 45 seconds, for example
     67 seconds at the low delay setting). Too short and the clip starts late or is skipped.
   - *Tools, WebSocket Server Settings*: tick **Enable WebSocket server**. Note the port
     (4455) and, if you set one, the password.
   - Press **Start Replay Buffer** (it must be running while you stream; OBS has a setting
     to start it with streaming).
3. In Freetip, open **Dashboard, Timestamps, Video clips** and make a **helper token**.
   It is shown once.
4. In Discord: *Channel settings, Integrations, Webhooks, New Webhook*, copy the webhook URL.
5. In this folder copy `config.example.json` to `config.json` and fill in `helperToken`,
   `discordWebhook` and, if you set one in OBS, `obs.password`.
6. Run `npm install` once in this folder.

## Every stream

Start OBS, start the replay buffer, then start the helper: double-click
`start-windows.bat` (Windows) or `start-mac.command` (Mac), or run `npm start`. Leave the
window open. It prints a line for each moment and each clip.

## What it does for each moment

1. Waits until the moment is 12 seconds old, so the footage after it is on disk.
2. Tells OBS to save the replay buffer.
3. Cuts the 20 seconds before the moment and the 10 seconds after it with ffmpeg.
   The moment is the time the command arrived minus your chat delay setting, which is
   when it happened on your screen.
4. Squeezes the clip to fit `maxUploadMb` and uploads it with a caption like
   `Clip for 12:34: Nice shot` and a link that opens the stream at that second.

One clip is made at a time; the rest wait in line (at most 20). Your own OBS recording is
never touched: OBS owns the replay file, the helper only reads it and deletes its own copy.

## Settings (`config.json`)

| Setting | Default | Meaning |
|---|---|---|
| `freetipUrl` | `https://freetip.in` | Where Freetip lives. |
| `helperToken` | | From the Timestamps page. Make a new one there and the old one stops. |
| `discordWebhook` | | Your own channel's webhook address. |
| `obs.url`, `obs.password` | `ws://127.0.0.1:4455`, none | OBS WebSocket server. |
| `sources` | all three | Which moments get a clip: `"chat"`, `"tip"`, `"goal"`. |
| `maxUploadMb` | 10 | Clips are encoded to stay under this. Discord's limit has changed over time (10 MB or 20 MB for a free server; 50 or 100 MB with server boosts). 10 is the safe choice; raise it if your server allows more. |
| `saveFolder` | `clips` | Every clip is also saved here at full quality (no size limit), so you can edit it or post it anywhere. Discord still gets the small copy. Use `""` to turn it off. These files are not deleted; clear the folder yourself now and then. |
| `secondsBefore`, `secondsAfter` | 20, 10 | Length of the clip around the moment. Keep the replay buffer at least `delay + secondsBefore + secondsAfter + 15` seconds long. |

## Problems

- **"Could not reach OBS"**: OBS is closed, the WebSocket server is off, or the port or
  password differs from `config.json`. The helper keeps trying every 10 seconds.
- **"The replay buffer is not running"**: press Start Replay Buffer in OBS.
- **"older than the replay buffer"**: lengthen the buffer in OBS.
- **"does not recognise this helper token"**: you made a new token or removed it on the
  Timestamps page. Paste the new one.
- **Windows SmartScreen or a Mac warning**: this is a plain Node program and `ffmpeg`
  from the `ffmpeg-static` package. There is no signed installer yet, so the first run
  of `ffmpeg` can ask for permission.
- **ffmpeg missing**: `npm install` downloads it. If your npm blocks install scripts, run
  `npm rebuild ffmpeg-static` or `node node_modules/ffmpeg-static/install.js`.

## Tests

`npm test` in this folder. They cover the trimming arithmetic, the queue, the settings
check, the feed reader, the OBS login, the Discord upload, and a full run through a
*pretend* OBS WebSocket server with a real ffmpeg cut. A real OBS and a real Discord
channel are not covered by them.
