# MoodSync AnimeVision

**Scan your face. Get anime picked for how you feel.**

MoodSync AnimeVision is an anime streaming web app that reads your mood from
your webcam in real time and recommends anime matched to it. No accounts, no
uploading, no API keys, no build step. It just runs.

---

## Table of Contents

- [What does it do?]
- [Features]
- [How the mood detection works]
- [Tech stack]
- [What you need before you start]
- [Install and run (step by step)]
- [Your first visit — a quick tour]
- [Configuration (.env)]
- [API endpoints]
- [Provider failover]
- [Project structure]
- [Troubleshooting]
- [Privacy]

---

## What does it do?

1. You click **Scan** and look at your webcam for a second.
2. The app detects your expression using the TinyFaceDetector
   (no cloud server ever sees your camera feed).
3. Your mood is mapped to a set of anime genres, e.g. *happy* → Comedy, Slice
   of Life; *angry* → Action, Shounen.
4. You get a personalized recommendations page, and you can stream episodes
   right in the player.
5. Everything you save (favorites, watch-later, history) lives in your
   browser's localStorage — close the tab and it still remembers you.

You can also skip the camera entirely and just **pick a mood manually**.

## Features

- Real-time facial mood detection — on-device by default, with an optional
  DeepFace (Python) sidecar for a second, independent model
- 6 moods, each linked to matching anime genres
- Custom fuser that combines face-api + DeepFace into one final mood
- Browse trending and seasonal anime, search by title or genre
- Favorites, watch-later and watch history stored in your browser only
- Dark / light theme toggle (remembers your choice)
- No accounts, no tracking, no API keys required

## How the mood detection works

There is **no server side by default** — everything happens in your browser
with [face-api.js](https://github.com/justadudewhohacks/face-api.js) (the
library is shipped locally in `public/vendor/`, the model weights in
`public/models/` — no CDN needed):

1. Webcam frames are sampled ~12 times at ~130 ms intervals (about 1.5 seconds).
2. Each frame is analyzed on-device for 7 basic expressions
   (happy, sad, angry, fearful, disgusted, surprised, neutral) using face-api's
   pre-trained FaceExpressionNet (trained on FER2013, AffectNet, RAF-DB and CK+).
3. The best frames are median-averaged for stability. Results that are too weak
   (< 50% confidence) or have too few face hits are ignored — you can rescan or
   just pick a mood by hand.
4. Raw expressions are refined to correct face-api's neutral bias, then fused
   (if the DeepFace sidecar is enabled) and mapped to app moods in
   `public/js/mood-mapping.js` (`fearful → surprised`, `disgusted → naughty`).

### Optional DeepFace sidecar + fuser

You can add a second, independent emotion model from
[DeepFace](https://github.com/serengil/deepface) (a Python/TensorFlow library).
When `DEEPFACE_ENABLED=true`:

1. During a scan the browser sends one captured frame (base64) to the Node
   backend's `POST /api/mood/deepface`, which proxies it to the Python sidecar
   (`server/deepface/`).
2. The sidecar runs DeepFace's emotion model and returns its own 7-emotion
   distribution.
3. The browser **fuser** (`public/js/mood-fuser.js`) merges the face-api and
   DeepFace scores using learned/weighted ensemble weights into one final mood
   and confidence.

> **Privacy trade-off:** enabling the sidecar means the webcam frame leaves the
> browser to reach your local Python service. It never leaves your machine via
> the internet, but it is no longer *only* on-device. Without DeepFace the scan
> stays 100% in the browser.

Available moods: `happy, sad, angry, surprised, neutral, naughty`


## Tech stack

| Layer    | What it uses                                                           |
|----------|------------------------------------------------------------------------|
| Frontend | Plain HTML/CSS/JS — no frameworks, no build step                       |
| Mood AI  | face-api.js (TinyFaceDetector + faceExpressionNet) in the browser, + optional DeepFace (Python) sidecar, + custom fuser |
| Backend  | Node.js + Express — a small API proxy with caching + provider failover |
| Storage  | Browser localStorage only                                              |

## What you need before you start

- **Node.js** (version 18 or newer — the "LTS" version is fine). If you don't
  have it, download it from https://nodejs.org and install the version with
  "LTS" in the name.
- **A webcam** if you want to use the mood scanner (optional — you can pick a
  mood manually).
- **The project files** from this folder (you already have them).

Check Node is installed by opening a terminal (PowerShell / CMD / your IDE's
terminal) and running:

```bash
node -v
npm -v
```

You should see version numbers like `v20.x.x` and `10.x.x`. If you get
`command not found` or something similar, re-install Node and open a new
terminal window.

## Install and run (step by step)

Inside the project folder, open a terminal and run these two commands:

```bash
npm install
```

This downloads all dependencies (Express, etc.) into a `node_modules` folder.
It takes a minute the first time. You only need to do this once.

Then start the app:

```bash
npm start
```

You should see a message like:

```
MoodSync AnimeVision server running at http://localhost:3069
```

Now open your browser and go to:

```
http://localhost:3069
```

**Tip:** if you want the server to auto-restart whenever you edit a file, use
`npm run dev` instead of `npm start`.

**To stop the server:** press `Ctrl + C` in the terminal.

## Your first visit — a quick tour

Once the page loads, you get a splash intro and the animated home screen. The
top-nav icons take you between these pages:

| Page              | URL / Nav     | What it does                                                |
|-------------------|---------------|-------------------------------------------------------------|
| Home              | `#/`          | Hero banner, trending anime, "picked for today" mood cards   |
| Scan              | `#/scan`      | Start the webcam, run a face scan, or pick a mood manually   |
| Recommendations   | `#/recommendations` | Personalized anime grid based on your mood             |
| Anime Detail      | `#/anime/:id` | Poster, synopsis, score, genres, "play episode" button       |
| Player            | `#/player/:id`| Stream episodes, switch quality, rate how the show felt      |
| Search            | `#/search`    | Search by title and filter by genre                          |
| Profile           | `#/profile`   | Your favorites, watch-later list and watch history           |

**A suggested first run:**

1. Click **Scan** and allow the browser to use your camera.
2. Smile (or scowl, whichever represents your mood) and wait ~1 second.
3. Review the result on the next page — then **Get Recommendations**.
4. Open an anime, hit **Play**, and try the quality selector.
5. Add something to favorites — then check your **Profile** page.

If your camera does not start, or the scan says the confidence was too low,
see [Troubleshooting](#troubleshooting) below.

## Configuration (.env)

Everything has a working default. You do **not** need a `.env` file to run the
app. To tweak settings:

```bash
# in the project folder, once — creates a .env you can edit
cp .env.example .env
```

(On Windows PowerShell, `cp .env.example .env` works the same way.)

### Server

| Variable | Default | Purpose                |
|----------|---------|------------------------|
| `PORT`   | `3069`  | HTTP port the app runs on |

### Anime providers

| Variable                 | Default                             | Purpose                                                            |
|--------------------------|-------------------------------------|--------------------------------------------------------------------|
| `ANILIST_GRAPHQL_URL`    | `https://graphql.anilist.co`        | Secondary backup metadata provider — free, no key                  |
| `ANILIST_TIMEOUT_MS`     | `15000`                             | Per-request timeout for AniList                                    |
| `MIRURO_API_BASE_URL`    | `https://mirurotvapi.vercel.app/api` | Primary provider (AniList-mirror metadata); point at a self-hosted Miruro wrapper if needed |
| `MIRURO_TIMEOUT_MS`      | `15000`                             | Per-request timeout for Miruro API                                 |
| `DEEPFACE_ENABLED`       | `false`                             | Set to `true` to fuse DeepFace (Python sidecar) into the mood scan |
| `DEEPFACE_API_URL`       | `http://127.0.0.1:5001`             | Base URL of the DeepFace sidecar service                           |
| `DEEPFACE_TIMEOUT_MS`    | `10000`                             | Per-request timeout for the DeepFace sidecar                       |

## API endpoints

All responses also carry an `X-Anime-Source` header that tells you which
provider served the request (`anilist` or `miruro`).

### Anime — `/api/anime`

| Endpoint                          | Purpose                                              |
|-----------------------------------|------------------------------------------------------|
| `GET /search?q=&genres=&page=`    | Search by title and comma-separated genres, e.g. `genres=Action,Fantasy` |
| `GET /trending`                   | Currently-airing highlights                          |
| `GET /seasonal`                   | Top airing this season                               |
| `GET /:id`                        | Anime details (numeric AniList id, e.g. `154587`)    |

### Health — `/api/health`

Returns `{ "status": "ok", "uptime": ... }`.

### Mood detection — browser + optional DeepFace sidecar

There is no plain HTTP endpoint for mood detection. See [How the mood
detection works]. By default everything runs in the browser. Optionally, a
Python DeepFace sidecar can be enabled (`DEEPFACE_ENABLED=true`) to fuse a
second, independent model into the result.

## Provider failover

1. **Miruro** — primary. An AniList-mirror wrapper exposing search, trending,
   seasonal and details (`server/services/miruro-api.js`).
2. **AniList** — backup. Handles the same metadata (search, trending, seasonal,
   details) via GraphQL (`server/services/anilist-api.js`). Free, no key. Also
   handles genre-only (mood) searches, which Miruro cannot do.

If the primary provider fails, the app quietly tries the next one, so one
provider being down never takes the site with it. A failed provider is
also skipped for 60 seconds (a tiny circuit breaker), so a down source
doesn't slow every request down with retries.

> **Note:** HiAnime (Consumet) was removed. That provider was the only source
> of episode lists and streaming sources, so the in-app player (`/episodes` and
> `/sources`) currently has no working source until a streaming adapter is
> added back.

## Project structure

```
MoodSync AnimeVerse/
├── .env.example          Sample configuration (copy to .env to override)
├── package.json          Dependencies and npm scripts
├── server/               Backend (Node.js + Express)
│   ├── server.js         Entry point: static files, SPA fallback, gzip
│   ├── routes/
│   │   ├── anime.js      Route handlers + provider failover chain
│   │   └── mood.js       DeepFace sidecar proxy endpoint (/api/mood/deepface)
│   ├── services/
│   │   ├── anilist-api.js    AniList GraphQL provider (backup)
│   │   ├── miruro-api.js     Miruro API provider (primary)
│   │   └── deepface-client.js  Proxy to the DeepFace Python sidecar
│   └── deepface/            Python DeepFace sidecar service (optional)
│       ├── deepface_service.py   FastAPI app (POST /emotion, GET /health)
│       └── requirements.txt      Python dependencies for the sidecar
└── public/               Frontend (served as-is, no build step)
    ├── index.html        SPA shell (all pages rendered by JS)
    ├── js/               Page modules + shared helpers
    │   ├── app.js            Router, home page, theme toggle
    │   ├── mood-scanner.js   Scan page UI
    │   ├── mood-meter-core.js  Face detection pipeline (reusable function)
    │   ├── mood-mapping.js   Mood → genre / color / emoji mapping + curated picks
    │   ├── anime-api.js      Client-side API layer with session cache
    │   ├── player.js         HLS episode player with quality selector
    │   ├── search.js         Search + filter page
    │   ├── recommendations.js  Mood-based recommendations page
    │   ├── anime-detail.js   Anime detail page
    │   ├── user-store.js     localStorage wrapper (favorites, history)
    │   └── ui.js             Shared UI helpers (toasts, cards, pagination)
    ├── css/              One stylesheet per page + shared styles
    ├── vendor/           face-api.js library (offline, no CDN)
    ├── models/           face-api.js model weights (loaded at runtime)
    └── assets/           Logo, fonts (yoruka.otf), etc.
```

## Troubleshooting

| Problem                                          | Fix |
|--------------------------------------------------|-----|
| `node: command not found` / `npm: command not found` | Install Node.js LTS from https://nodejs.org, then open a **new** terminal window. |
| `npm install` fails with a network error         | Check your internet connection. You can also try `npm install --registry=https://registry.npmjs.org`. |
| `Error: listen EADDRINUSE` / port already in use | Another app is on port 3069. Either stop it, or set `PORT=3070` in `.env` and use `http://localhost:3070`. |
| The camera prompt never appears / scan does nothing | Make sure you clicked **Scan**, the site is `localhost` (browser treats it as secure), and no other tab/app is using the camera. Refresh and try again. |
| Scan says confidence was too low                  | Move into better lighting, face the camera directly, and hold still for the ~1 second scan. You can also click a **mood button** to pick manually instead. |
| Pages load but anime lists / recommendations are empty | The anime metadata comes from the internet (AniList / Miruro). Check your connection, or wait a moment and refresh. |
| DeepFace fusion is not active        | Ensure the Python sidecar is running and set `DEEPFACE_ENABLED=true` in `.env`, then restart the server. |
| Everything works but the mood scan loads slowly   | The model weights in `public/models/` are ~6 MB and download once; after that they are cached in the browser. |
| I changed `.env` but nothing changed              | The `.env` file is read when the server starts — restart the server (`Ctrl + C`, then `npm start`). |

Still stuck? The scan pipeline is the module most likely to depend on your
camera setup — the rest of the app works exactly like any normal anime site.

## Privacy

Your face is never sent anywhere. Webcam frames are analyzed **inside your
browser only** by face-api.js, and the raw pixel data never leaves your
machine. Favorites, watch-later lists, watch history and theme preference live
only in your browser's localStorage. There are no accounts and no tracking.