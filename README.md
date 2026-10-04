# Aura 🌟
> Understand your productivity without saying a word.

Aura is an AI-powered productivity tracker that passively monitors your computer activity and converts it into real-time insights — focus score, mood analysis, and personalized recommendations.

## 🖥️ Preview

![Aura Dashboard](your-screenshot-or-gif-link)

## 🌐 Live Demo

🔗 https://aura-gamma-eight.vercel.app  
📦 https://github.com/nidhi333-9/aura

## ✨ Features

- Real-time Focus Score based on app & browser usage  
- Smart detection of productive platforms (LeetCode, GitHub, etc.)  
- Focus Trend Graph for daily insights  
- Week and Month history: daily focus, best weekday, an hour-by-weekday heatmap and time breakdown  
- Mood Analysis (Deep Focus, Calm Flow, Low Energy)  
- Personalized YouTube recommendations  
- Spotify integration for mood-based playlists  
- Cross-platform desktop sensor (Mac + Windows)

## 🎨 UI/UX Highlights

- Minimal and distraction-free dashboard  
- Smooth real-time updates  
- Designed for actionable insights, not data overload

## 🛠️ Tech Stack

- Frontend: React + Vite + TailwindCSS  
- Backend: Node.js + Express  
- ML Service: Python + FastAPI  
- Database: MongoDB  
- Desktop Agent: Python + PyInstaller  
- Hosting: Vercel (dashboard) + Render (backend, ML service) + MongoDB Atlas

## ⚙️ How It Works

1. The desktop sensor looks at your front window every 10 seconds (on a Mac, also which website your browser is on)  
2. It sends that to the backend with its own device key; the backend labels each moment Productive, Neutral, Distraction or Idle and stores it  
3. The dashboard turns those labels into a live focus score, today's chart and week, month and 3-month history  
4. The ML service is read-only and is no longer on the dashboard's path  

The full picture, with diagrams, is in **[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)**.

## 🚀 Getting Started

1. Visit: https://aura-gamma-eight.vercel.app  
2. Login with Google  
3. Open **Connect a sensor** on the dashboard and copy the install command (it contains a one-time pairing code, not your login)  
4. Paste it into Terminal (macOS) or PowerShell (Windows). The sensor pairs itself and starts running  
5. **On a Mac, allow two things once** (the dashboard shows the steps under the install command): System Settings →
   Privacy & Security → *Accessibility* → turn on Terminal, and *Automation* → under Terminal turn on *System Events*
   and your browser. Without them macOS hides window titles, and the dashboard and the sensor both say so  
6. Start tracking your productivity in real time. Manage or remove paired devices under **Your devices**

## 💻 Local Development

### Prerequisites
- Node.js 18+
- Python 3.11+
- MongoDB (running locally)

### Local settings: do this first

> **Warning:** on a developer machine the `.env` files often hold the **production** database and the live
> backend URL. Running the steps below with only those files means local code reads and writes real data, and
> the dev server (including Google login) talks to the live site.

Keep your local values in `.env.local` files instead. They override `.env`, are git-ignored, and each has an
`.env.example` to copy:

```bash
cp backend/.env.example     backend/.env.local      # local MongoDB + local secrets
cp ml-service/.env.example  ml-service/.env.local   # local MongoDB
cp frontend/.env.example    frontend/.env.local     # VITE_API_URL=http://localhost:8080
```

Order of precedence everywhere: real environment variables, then `.env.local`, then `.env`. In production neither
file normally exists, so nothing changes there. On start the backend logs which files it loaded and whether the
database is local or **REMOTE** (with a warning if it's remote outside production), so a mix-up is hard to miss.

### Backend
cd backend  
npm install  
node server.js  

### Frontend
cd frontend  
npm install  
npm run dev  

### ML Service
cd ml-service  
pip install -r requirements.txt  
uvicorn api:app --reload  

### Sensor
cd tracker  
pip install pywinctl requests  
AURA_PAIR_CODE=ABCDE-FGHJK python sensor.py  

Get the code from **Connect a sensor** on the dashboard (valid for 10 minutes, single use). It is only needed the
first time: the sensor trades it for its own device key, saved to `~/.aura/device.json`, and reuses that on later runs.
Without `AURA_PAIR_CODE` it asks for a code when it starts. To point it at a local backend, also set
`AURA_API_URL=http://localhost:8080` (a saved key is only ever sent to the server that issued it).

If you remove the device in the dashboard, the sensor says so and exits; run a fresh install command to connect it again.

**Which website you are on (macOS).** A window title doesn't always name the site, so for Chrome, Brave, Edge,
Safari, Arc, Vivaldi, Opera and Chromium the sensor also asks the browser which address its front tab is on.
Only the **host name** is sent (`linkedin.com`), never the path, query or page content, and private/incognito
windows are skipped. The first time, macOS asks whether your terminal may control the browser; if you say no, or
use Firefox or Windows, nothing breaks: Aura falls back to guessing the site from the window title. If you said no
and change your mind: System Settings → Privacy & Security → Automation → turn the browser on under your terminal app.
The host is stored with each sample so a rule change can relabel old data (`backfill-classification.js --apply --force`).

## 🔐 Environment Variables

### Backend
MONGO_URI=  
JWT_SECRET= (required — the server refuses to start without it)  
ML_SHARED_SECRET= (must match the ML service's value; without it analytics falls back to the DB)  
YOUTUBE_API_KEY=  
PAIR_CODE_TTL_SECONDS= (optional, default 600: how long a sensor pairing code stays valid)  

### ML Service
MONGO_URI= (use a read-only database user — the ML service never writes)  
ML_SHARED_SECRET= (required — every request without this secret is rejected)  

### Frontend
VITE_API_URL=  

## 📦 Deployment

- Frontend → Vercel  
- Backend → Render  
- ML Service → Render  
- Database → MongoDB Atlas  

How the pieces connect, who may call what, and the everyday jobs (releasing a sensor, rebuilding summaries) are in
[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

### After deploying the classify-at-ingest change

New activity is labelled (`site`, `category`) when it arrives. To label rows recorded before that, run once
(from `backend/`, with `MONGO_URI` pointing at the real database):

```bash
node scripts/backfill-classification.js           # dry run: shows what would change
node scripts/backfill-classification.js --apply   # writes the labels
```

It is safe to re-run. Use `--apply --force` to relabel every row after editing a rule in `services/classify.js`.
The dashboard works before the backfill too (unlabelled rows are classified on the fly).

### Long-term history: rollups and raw-data expiry

Every sensor sample is stored as a raw row (with its window title) **and** counted in a tiny permanent
daily summary (`daily_stats`, one document per user per day, in 15-minute slots so it works for any
time zone). History charts can read the summaries, which is what makes the **3 months** tab possible and
lets old raw rows expire. Nothing below happens by itself, and nothing is deleted until the last step.
Run these from `backend/` with `MONGO_URI` pointing at the real database:

1. **Deploy the backend.** It starts counting new samples into the summaries. History keeps reading raw
   data, so nothing changes yet, and the 3-month tab says it isn't available yet.
2. **Wait for one sensor sample** (this records that the backend is writing summaries).
3. **Build and verify the summaries** (safe, repeatable):
   ```bash
   node scripts/rebuild-rollups.js           # dry run: shows what it found
   node scripts/rebuild-rollups.js --apply   # rebuilds, re-reads raw to verify, then marks them ready
   ```
   History switches to the summaries immediately (no restart) and the 3-month tab works. If it says
   "NOT marking ready", it tells you why (usually: step 1 or 2 hasn't happened yet). To go back to raw
   data: `node scripts/rebuild-rollups.js --apply --disable`.
4. **Optional, and the only step that deletes anything: expire old raw samples.**
   ```bash
   node scripts/enable-raw-ttl.js                      # dry run: re-verifies everything, says how many rows would go
   node scripts/enable-raw-ttl.js --days 30 --apply    # take a database snapshot first
   ```
   It refuses unless the summaries match the raw rows exactly. The summaries (all the charts need) are kept
   forever; individual samples and their window titles older than 30 days are deleted, which is also good
   for privacy. If you want old titles for ML labelling, run `ml-service/training/build_dataset.py` first.
   To stop expiring: `node scripts/enable-raw-ttl.js --disable --apply` (deleted rows are not restored).

After `backfill-classification.js --force` (relabelling existing rows), run `rebuild-rollups.js --apply` again.
If a rollup write ever fails at ingest the sample is still saved; `rebuild-rollups.js --apply --days 3`
repairs recent drift.

### Tests

```bash
cd backend && npm test
cd tracker && python -m unittest test_sensor -v   # needs: pip install pywinctl requests
```

## 👩‍💻 Author

**Nidhi Sharma**

- GitHub: https://github.com/nidhi333-9  
- LinkedIn: https://www.linkedin.com/in/techynidhi3/
