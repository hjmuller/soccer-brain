# ⚽ Soccer Brain

A combined training video library and soccer decision-making quiz for young players. Built for GitHub Pages with Firebase as the backend.

- **Players** open the app and see two tabs: a video library and a Brain Quiz game
- **Coaches** open the dashboard to add/manage videos and view player scores

---

## File Overview

| File | Purpose |
|------|---------|
| `index.html` | Main player-facing app — Video library + Brain Quiz in one tabbed interface |
| `style.css` | All styling for the player app |
| `shared.js` | Firebase data layer shared by both `index.html` and `dashboard.html` |
| `game.js` | Brain Quiz game engine |
| `dashboard.html` | Coach admin dashboard — add videos, view analytics, player leaderboard |
| `scenarios.json` | All quiz questions and game content (edit this to change the quiz) |
| `CONTENT_GUIDE.md` | Instructions for adding and editing quiz scenarios |

**Deleted from the original Soccer Brain repo** (no longer needed):
- `forms.js` — replaced by `shared.js` / Firebase
- `leaderboard.html` — replaced by the Scores section in `dashboard.html`

---

## Step 1 — Deploy to GitHub Pages

1. Push all files to the root of your GitHub repository (e.g. `soccer-brain`)
2. Go to **Settings → Pages**
3. Set Source to **Deploy from a branch → main → / (root)**
4. Click **Save** — your app will be live at `https://yourusername.github.io/soccer-brain`

---

## Step 2 — Set Up Firebase

The app uses Firebase for three things: storing videos (Firestore), uploading video files (Storage), and coach login (Authentication). All are on Firebase's free Spark plan.

### A. Create a Firebase Project

1. Go to [console.firebase.google.com](https://console.firebase.google.com)
2. Click **Add project** → name it (e.g. `soccer-brain`) → Continue through the steps
3. On the project overview, click **</>** (Web) to add a web app
4. Give it a nickname → click **Register app**
5. Copy the `firebaseConfig` object shown — you'll need it in the next step

### B. Paste Your Config into `shared.js`

Open `shared.js` and replace the placeholder block near the top:

```javascript
const FIREBASE_CONFIG = {
  apiKey:            "YOUR_API_KEY",
  authDomain:        "YOUR_PROJECT.firebaseapp.com",
  projectId:         "YOUR_PROJECT_ID",
  storageBucket:     "YOUR_PROJECT.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId:             "YOUR_APP_ID"
};
```

### C. Enable Firestore Database

1. In the Firebase Console sidebar, go to **Build → Firestore Database**
2. Click **Create database**
3. Choose **Start in production mode** (you'll set the rules below)
4. Pick any location → **Enable**

### D. Enable Firebase Storage

1. Go to **Build → Storage**
2. Click **Get started**
3. Choose **Start in production mode** → **Done**

### E. Set Firestore Security Rules

Go to **Firestore Database → Rules** and replace everything with:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // Videos: anyone can read; only signed-in coaches can add or delete;
    // anyone can update view count and lastWatched (incremented by the player app)
    match /videos/{videoId} {
      allow read: if true;
      allow create, delete: if request.auth != null;
      allow update: if request.resource.data.diff(resource.data).affectedKeys()
                       .hasOnly(['views', 'lastWatched']);
    }

    // Scores: anyone can read or create (players log their own scores);
    // no one can edit or delete a score once written
    match /scores/{scoreId} {
      allow read, create: if true;
      allow update, delete: if false;
    }
  }
}
```

Click **Publish**.

### F. Enable Email/Password Authentication

This secures the coach dashboard so only you can add or delete videos.

1. Go to **Build → Authentication → Sign-in method**
2. Click **Email/Password** → toggle **Enable** → **Save**
3. Go to the **Users** tab → **Add user**
4. Enter your email address and a strong password → **Add user**

That account is the only one that can log into the dashboard. Players never need to sign in.

### G. Upload `shared.js` to GitHub

After pasting your config, push the updated `shared.js` to your repo. GitHub Pages will serve the new version within a minute.

---

## How the Player App Works (`index.html`)

The app has two tabs at the bottom of the screen:

### 📺 Videos Tab
- Loads all videos from Firestore in real time
- Horizontal filter bar lets players browse by category (Dribbling, Shooting, Passing, Defense, Goalkeeper, Rules, Tactics, Warm-Up, Funny)
- Tapping a card opens a full-screen modal player
- YouTube links embed an iframe; uploaded files use an HTML5 video player
- View count increments automatically on each open
- NEW badge appears on videos added within the last 48 hours

### ⚽ Brain Quiz Tab
- Full Soccer Brain decision-making game
- 18 random scenarios per game drawn from `scenarios.json`
- Three scenario types: **Choice** (pick the best option), **Spot** (tap the open player), **Reaction** (tap on green light)
- Timer per question — faster answers earn more points
- Streak bonuses for consecutive correct answers
- Coach bubble explains the right answer after each question
- Three difficulty levels that change time limits: 🌱 Grasshopper, ⚡ Striker, 🏆 Champion
- Score is saved to Firebase after every completed game
- Local stats (best score, streak, category breakdown) stored on-device via `localStorage`

---

## How the Coach Dashboard Works (`dashboard.html`)

Access the dashboard at `https://yourusername.github.io/soccer-brain/dashboard.html`

### Login
A full-screen login screen appears on first visit. Enter the email and password you created in Firebase Authentication. The session persists across page refreshes — you won't need to sign in every time.

### Videos — Analytics
- Summary cards: total videos, total plays, average plays per video, most-watched title
- Sortable table of all videos with play count, date added, and last watched date
- Delete button removes the Firestore document and the Storage file (for uploads)

### Videos — Add Video
Fill in:
- **Title** — shown on the card in the player app
- **Source** — YouTube URL or upload a file from your device
- **Category** — determines which filter chip the video appears under
- **Thumbnail Emoji** — shown as the card image in the player app
- **Coach's Note** — optional message shown below the video in the modal

For YouTube videos, paste the full watch URL (e.g. `https://www.youtube.com/watch?v=dQw4w9WgXcQ`). Shorts and embed URLs also work. For uploaded files, a progress bar tracks the upload to Firebase Storage.

### Videos — Manage Videos
Full list of all videos with a delete button on each row.

### Players — Leaderboard
- Summary cards: total games played, number of unique players, top score, average accuracy
- Gold/silver/bronze podium for the top three players
- Sortable table showing each player's best score, average accuracy, number of games, and current level

### Players — All Sessions
Every individual game session logged in Firestore, sortable by score, accuracy, or date. Shows player name, score, accuracy bar, average response time, correct answers, and level reached.

---

## Editing Quiz Content (`scenarios.json`)

Everything in `scenarios.json` controls the quiz: questions, answer choices, coach messages, difficulty levels, and timing. Edit it using Claude Desktop by dragging the file into the chat and asking for changes. See **CONTENT_GUIDE.md** for full instructions and examples.

### Three Scenario Types

**`choice`** — Player picks the best option from four choices
```json
{
  "id": "s011",
  "type": "choice",
  "category": "passing",
  "difficulty": 1,
  "question": "Your question here…",
  "fieldSetup": {
    "ballPosition": { "x": 50, "y": 55 },
    "yourPlayer":   { "x": 50, "y": 55, "label": "YOU" },
    "teammates": [
      { "x": 25, "y": 40, "label": "Emma", "isOpen": true },
      { "x": 70, "y": 65, "label": "Sofia", "isOpen": false }
    ],
    "defenders": [
      { "x": 50, "y": 42, "label": "D1" }
    ],
    "goal": { "x": 50, "y": 10 }
  },
  "choices": [
    { "id": "A", "text": "Option A", "correct": true,  "explanation": "Why this is right" },
    { "id": "B", "text": "Option B", "correct": false, "explanation": "Why this is wrong" },
    { "id": "C", "text": "Option C", "correct": false, "explanation": "Why this is wrong" },
    { "id": "D", "text": "Option D", "correct": false, "explanation": "Why this is wrong" }
  ]
}
```

Field coordinates are percentages (0–100) of the SVG width/height. `y: 0` is the top of the pitch (attacking goal), `y: 100` is the bottom.

**`spot`** — Player taps the correct teammate on the field diagram
```json
{
  "id": "s012",
  "type": "spot",
  "category": "awareness",
  "difficulty": 1,
  "question": "Tap the most open teammate!",
  "timeLimit": 5,
  "fieldSetup": {
    "teammates": [
      { "x": 20, "y": 45, "label": "Anna", "isOpen": true,  "id": "t1" },
      { "x": 70, "y": 50, "label": "Beth", "isOpen": false, "id": "t2" }
    ]
  },
  "correctTeammateId": "t1",
  "explanation": "Anna had no defenders near her — she was open!"
}
```

**`reaction`** — Player taps a light when it turns green, ignores red
```json
{
  "id": "s013",
  "type": "reaction",
  "category": "speed",
  "difficulty": 1,
  "question": "TAP when you see GREEN!",
  "sequence": [
    { "color": "red",   "duration": 800 },
    { "color": "green", "duration": 1200 },
    { "color": "red",   "duration": 600 },
    { "color": "green", "duration": 1000 }
  ]
}
```

`duration` is in milliseconds. The sequence runs automatically; the player taps as fast as they can on each green light.

### Valid Categories
`passing` · `shooting` · `defending` · `positioning` · `awareness` · `speed`

### Difficulty Levels (defined in `scenarios.json` → `"levels"`)
| Level | Emoji | Min Score | Time Limit |
|-------|-------|-----------|------------|
| Grasshopper | 🌱 | 0 | 10s |
| Striker | ⚡ | 150 | 6s |
| Champion | 🏆 | 350 | 4s |

---

## Firebase Data Structure

```
Firestore
├── videos/               (one document per video)
│   ├── title             string
│   ├── videoUrl          string    — YouTube URL or Storage download URL
│   ├── sourceType        string    — "youtube" or "upload"
│   ├── storagePath       string?   — Storage path for uploaded files, null for YouTube
│   ├── tag               string    — category name
│   ├── emoji             string    — thumbnail emoji
│   ├── note              string    — coach's message (optional)
│   ├── addedAt           number    — Unix timestamp (ms)
│   ├── views             number    — incremented on each modal open
│   └── lastWatched       number?   — Unix timestamp of most recent view
│
└── scores/               (one document per completed game)
    ├── playerName        string
    ├── score             number
    ├── accuracy          number    — percentage 0–100
    ├── avgSpeed          number    — average response time in seconds
    ├── correctAnswers    number
    ├── totalQuestions    number
    ├── level             string    — "Grasshopper", "Striker", or "Champion"
    ├── categoryBreakdown string    — JSON of per-category correct/total counts
    ├── date              string    — locale date string
    ├── time              string    — locale time string
    └── timestamp         number    — Unix timestamp (ms) for sorting
```

---

## Local Stats vs. Cloud Scores

The app uses both `localStorage` and Firebase:

| | localStorage | Firebase Firestore |
|---|---|---|
| **What** | Per-device quiz history | Every completed game from all devices |
| **Who can see it** | That device only | Coach dashboard (all players) |
| **Persists if cleared** | No | Yes |
| **Used for** | Stats screen in the quiz tab | Leaderboard and sessions in dashboard |

Clearing the browser's site data will reset local stats but scores already saved to Firestore are unaffected.

---

## Troubleshooting

**"Missing or insufficient permissions" after quiz**
Go to Firestore → Rules and ensure the `scores` collection has `allow read, create: if true`.

**"Missing or insufficient permissions" when adding a video**
Make sure you are signed in to the dashboard (the login screen should not be showing). If you are signed in and still see this error, check that the Firestore rules have `allow create, delete: if request.auth != null` on the `videos` collection and that you clicked **Publish** after saving.

**Videos not loading in the player app**
Check that Firestore is enabled and that `shared.js` has your real Firebase config (not the placeholder `YOUR_API_KEY` values).

**Login says "Wrong email or password"**
Go to Firebase Console → Authentication → Users and confirm the email address. Use **Reset password** if needed.

**Score saved successfully but doesn't appear in the dashboard**
The dashboard only loads data after you sign in. Sign in and the leaderboard will populate from Firestore in real time.

**Video upload stalls at 0%**
Firebase Storage must be enabled in your project. Go to Build → Storage → Get started. Also confirm your `storageBucket` value in `shared.js` matches the one shown in the Firebase Console.
