/* ═══════════════════════════════════════════════════════════
   SOCCER ACADEMY — Firebase Data Layer (shared.js)
═══════════════════════════════════════════════════════════ */

const FIREBASE_CONFIG = {
  apiKey: "AIzaSyAro-W-3uZueg-KwuSt5rcQTfJ1xowy97Y",
  authDomain: "vids-for-kids-f5589.firebaseapp.com",
  projectId: "vids-for-kids-f5589",
  storageBucket: "vids-for-kids-f5589.firebasestorage.app",
  messagingSenderId: "939611477279",
  appId: "1:939611477279:web:e2a95d5bca9ebed3ee8c2a"
};

const RECAPTCHA_SITE_KEY = '6LczhhAtAAAAADy-l6bkYFAn4T-taLlwAp9Rr1-8';

if (!firebase.apps.length) {
  firebase.initializeApp(FIREBASE_CONFIG);
}

// self.FIREBASE_APPCHECK_DEBUG_TOKEN = true; // ← local dev only
firebase.appCheck().activate(RECAPTCHA_SITE_KEY, true);

const db      = firebase.firestore();
const storage = firebase.storage();

/* ══════════════════════════════════════════════════════════════
   VIDEO FUNCTIONS
══════════════════════════════════════════════════════════════ */

function subscribeVideos(callback) {
  return db.collection('videos')
    .orderBy('addedAt', 'desc')
    .onSnapshot(
      snap => callback(snap.docs.map(d => ({ id: d.id, ...d.data() }))),
      err  => console.warn('subscribeVideos error:', err)
    );
}

function recordView(videoId) {
  return db.collection('videos').doc(videoId).update({
    views:       firebase.firestore.FieldValue.increment(1),
    lastWatched: Date.now()
  }).catch(e => console.warn('recordView:', e));
}

/** Add a new video document — now includes optional thumbnailUrl */
async function addVideo({ title, videoUrl, note, tag, emoji, sourceType, storagePath, thumbnailUrl }) {
  return db.collection('videos').add({
    title,
    videoUrl,
    note:         note || '',
    tag:          tag  || 'General',
    emoji:        emoji || '⚽',
    sourceType:   sourceType || 'youtube',
    storagePath:  storagePath  || null,
    thumbnailUrl: thumbnailUrl || null,   // YouTube thumbnail URL or null
    addedAt:      Date.now(),
    views:        0,
    lastWatched:  null
  });
}

async function deleteVideo(videoId, storagePath) {
  if (storagePath) {
    try { await storage.ref(storagePath).delete(); } catch (e) { /* file already gone */ }
  }
  return db.collection('videos').doc(videoId).delete();
}

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

function subscribeScores(callback) {
  return db.collection('scores')
    .orderBy('timestamp', 'desc')
    .onSnapshot(
      snap => callback(snap.docs.map(d => ({ id: d.id, ...d.data() }))),
      err  => console.warn('subscribeScores error:', err)
    );
}

function getLeaderboard(limitCount) {
  return db.collection('scores')
    .orderBy('score', 'desc')
    .limit(limitCount || 100)
    .get()
    .then(snap => snap.docs.map(d => ({ id: d.id, ...d.data() })));
}
