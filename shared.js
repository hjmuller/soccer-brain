/* ═══════════════════════════════════════════════════════════
   SOCCER BRAIN — Firebase Data Layer (shared.js)

   App Check is activated here before Firestore and Storage
   are accessed. Every request automatically carries a
   reCAPTCHA v3 attestation token — Firebase rejects any
   request that arrives without one once enforcement is on.
═══════════════════════════════════════════════════════════ */

// ── FIREBASE CONFIG ─────────────────────────────────────────
// These values are safe to commit once App Check is enforced.
// A stolen config cannot query your database without a valid
// App Check token, which only your real domain can generate.
const FIREBASE_CONFIG = {
  apiKey: "AIzaSyAro-W-3uZueg-KwuSt5rcQTfJ1xowy97Y",
  authDomain: "vids-for-kids-f5589.firebaseapp.com",
  projectId: "vids-for-kids-f5589",
  storageBucket: "vids-for-kids-f5589.firebasestorage.app",
  messagingSenderId: "939611477279",
  appId: "1:939611477279:web:e2a95d5bca9ebed3ee8c2a"
};

// ── RECAPTCHA V3 SITE KEY ───────────────────────────────────
// Get this from https://www.google.com/recaptcha/admin
// Create a v3 site → add hjmuller.github.io as an allowed domain
// → copy the site key here.
const RECAPTCHA_SITE_KEY = '6LczhhAtAAAAADy-l6bkYFAn4T-taLlwAp9Rr1-8';
// ────────────────────────────────────────────────────────────

if (!firebase.apps.length) {
  firebase.initializeApp(FIREBASE_CONFIG);
}

// ── APP CHECK ───────────────────────────────────────────────
// Must be activated BEFORE firebase.firestore() and
// firebase.storage() so tokens attach to every request.
//
// To test locally, uncomment the debug line below, load the
// page, copy the token printed to the browser console, then
// register it in Firebase Console → App Check → your app →
// ⋮ menu → Manage debug tokens.
//
// self.FIREBASE_APPCHECK_DEBUG_TOKEN = true; // ← local dev only
firebase.appCheck().activate(RECAPTCHA_SITE_KEY, true);

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
   SCORE FUNCTIONS
══════════════════════════════════════════════════════════════ */

/** Log a completed game session to Firestore */
function logGameScore(data) {
  const statusEl = document.getElementById('forms-status');
  if (statusEl) statusEl.textContent = '💾 Saving…';

  return db.collection('scores').add({
    playerName:        data.playerName      || 'Player',
    score:             data.score           || 0,
    accuracy:          data.accuracy        || 0,
    avgSpeed:          data.avgResponseTime || 0,
    correctAnswers:    data.correctAnswers  || 0,
    totalQuestions:    data.totalQuestions  || 0,
    level:             data.level           || '',
    categoryBreakdown: data.categoryBreakdown || '{}',
    date:              data.date            || new Date().toLocaleDateString(),
    time:              data.time            || new Date().toLocaleTimeString(),
    timestamp:         Date.now()
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

/** One-time fetch of top N scores */
function getLeaderboard(limitCount) {
  return db.collection('scores')
    .orderBy('score', 'desc')
    .limit(limitCount || 100)
    .get()
    .then(snap => snap.docs.map(d => ({ id: d.id, ...d.data() })));
}
