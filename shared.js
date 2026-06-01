/* ═══════════════════════════════════════════════════════════
   SOCCER ACADEMY — Firebase Data Layer (shared.js)
   Loaded after Firebase compat SDK scripts.
   ═══════════════════════════════════════════════════════════

   ▸ SETUP:
     1. Go to console.firebase.google.com
     2. Create project → Add web app
     3. Paste the config object below
     4. Enable Firestore Database (test mode to start)
     5. Enable Storage (test mode to start)

   ▸ FIRESTORE RULES (paste in Firestore → Rules):
     rules_version = '2';
     service cloud.firestore {
       match /databases/{db}/documents {
         match /videos/{id} {
           allow read: if true;
           allow write: if false;
           allow update: if request.resource.data.keys().hasOnly(['views','lastWatched']);
         }
         match /scores/{id} {
           allow read, create: if true;
           allow update, delete: if false;
         }
       }
     }
═══════════════════════════════════════════════════════════ */

// ── PASTE YOUR FIREBASE CONFIG HERE ────────────────────────
const FIREBASE_CONFIG = {
  apiKey: "AIzaSyAro-W-3uZueg-KwuSt5rcQTfJ1xowy97Y",
  authDomain: "vids-for-kids-f5589.firebaseapp.com",
  projectId: "vids-for-kids-f5589",
  storageBucket: "vids-for-kids-f5589.firebasestorage.app",
  messagingSenderId: "939611477279",
  appId: "1:939611477279:web:e2a95d5bca9ebed3ee8c2a"
};
// ───────────────────────────────────────────────────────────

// Avoid double-init (dashboard.html loads this file too)
if (!firebase.apps.length) {
  firebase.initializeApp(FIREBASE_CONFIG);
}

const db      = firebase.firestore();
const storage = firebase.storage();

/* ══════════════════════════════════════════════════════════════
   VIDEO FUNCTIONS
══════════════════════════════════════════════════════════════ */

/** Real-time subscription to all videos, newest first */
function subscribeVideos(callback) {
  return db.collection('videos')
    .orderBy('addedAt', 'desc')
    .onSnapshot(
      snap => callback(snap.docs.map(d => ({ id: d.id, ...d.data() }))),
      err  => console.warn('subscribeVideos error:', err)
    );
}

/** Increment view count + set lastWatched timestamp */
function recordView(videoId) {
  return db.collection('videos').doc(videoId).update({
    views:       firebase.firestore.FieldValue.increment(1),
    lastWatched: Date.now()
  }).catch(e => console.warn('recordView:', e));
}

/** Add a new video document */
async function addVideo({ title, videoUrl, note, tag, emoji, sourceType, storagePath }) {
  return db.collection('videos').add({
    title,
    videoUrl,
    note:        note || '',
    tag:         tag  || 'General',
    emoji:       emoji || '⚽',
    sourceType:  sourceType || 'youtube',
    storagePath: storagePath || null,
    addedAt:     Date.now(),
    views:       0,
    lastWatched: null
  });
}

/** Delete a video document (and its Storage file if present) */
async function deleteVideo(videoId, storagePath) {
  if (storagePath) {
    try { await storage.ref(storagePath).delete(); } catch (e) { /* file already gone */ }
  }
  return db.collection('videos').doc(videoId).delete();
}

/** Upload a video file to Firebase Storage, returns { url, path } */
function uploadVideoFile(file, onProgress) {
  const path = `videos/${Date.now()}_${file.name}`;
  const task = storage.ref(path).put(file);

  return new Promise((resolve, reject) => {
    task.on(
      'state_changed',
      snap => {
        if (onProgress) onProgress(Math.round(snap.bytesTransferred / snap.totalBytes * 100), path);
      },
      reject,
      async () => {
        const url = await task.snapshot.ref.getDownloadURL();
        resolve({ url, path });
      }
    );
  });
}

/* ══════════════════════════════════════════════════════════════
   SCORE FUNCTIONS  (replaces Google Forms / forms.js)
══════════════════════════════════════════════════════════════ */

/** Log a completed game session to Firestore */
function logGameScore(data) {
  const statusEl = document.getElementById('forms-status');
  if (statusEl) statusEl.textContent = '💾 Saving…';

  return db.collection('scores').add({
    playerName:       data.playerName      || 'Player',
    score:            data.score           || 0,
    accuracy:         data.accuracy        || 0,
    avgSpeed:         data.avgResponseTime || 0,
    correctAnswers:   data.correctAnswers  || 0,
    totalQuestions:   data.totalQuestions  || 0,
    level:            data.level           || '',
    categoryBreakdown: data.categoryBreakdown || '{}',
    date:             data.date            || new Date().toLocaleDateString(),
    time:             data.time            || new Date().toLocaleTimeString(),
    timestamp:        Date.now()
  }).then(() => {
    if (statusEl) {
      statusEl.textContent = '✅ Score saved!';
      setTimeout(() => { if (statusEl) statusEl.textContent = ''; }, 4000);
    }
  }).catch(err => {
    console.warn('logGameScore failed:', err);
    if (statusEl) statusEl.textContent = '⚠️ Could not save score';
  });
}

/** Real-time subscription to all scores, newest first */
function subscribeScores(callback) {
  return db.collection('scores')
    .orderBy('timestamp', 'desc')
    .onSnapshot(
      snap => callback(snap.docs.map(d => ({ id: d.id, ...d.data() }))),
      err  => console.warn('subscribeScores error:', err)
    );
}

/** One-time fetch of top N scores (for leaderboard) */
function getLeaderboard(limitCount) {
  return db.collection('scores')
    .orderBy('score', 'desc')
    .limit(limitCount || 100)
    .get()
    .then(snap => snap.docs.map(d => ({ id: d.id, ...d.data() })));
}
