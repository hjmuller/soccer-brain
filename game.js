/* ═══════════════════════════════════════════════════════════
   SOCCER BRAIN — Game Engine (game.js)
   Updated: logs scores to Firebase via logGameScore() in shared.js
   instead of Google Forms.
   ═══════════════════════════════════════════════════════════ */

const STORAGE_KEY = 'soccerbrain_stats';
const SCENARIOS_PER_GAME = 18;
const CIRCUMFERENCE = 100.53; // 2 * π * 16

// ── State ──────────────────────────────────────────────────
let scenarios = [];
let coachData = {};
let levelData = [];
let gameState = {
  playerName: 'Player',
  playerColor: '#e63946',
  score: 0,
  round: 0,
  totalRounds: SCENARIOS_PER_GAME,
  currentScenario: null,
  gameScenarios: [],
  correctCount: 0,
  skipCount: 0,
  responseTimes: [],
  roundStartTime: 0,
  timer: null,
  timerValue: 0,
  timerMax: 30,
  answered: false,
  streak: 0,
  categoryStats: {}
};

// ── DOM refs ───────────────────────────────────────────────
const screens = {
  splash:  document.getElementById('screen-splash'),
  setup:   document.getElementById('screen-setup'),
  game:    document.getElementById('screen-game'),
  results: document.getElementById('screen-results'),
  stats:   document.getElementById('screen-stats')
};
const scenarioContainer = document.getElementById('scenario-container');
const coachBubble       = document.getElementById('coach-bubble');
const coachText         = document.getElementById('coach-text');

// ═══════════════════════════════════════════════════════════
// INIT
// ═══════════════════════════════════════════════════════════
async function init() {
  try {
    const res = await fetch('scenarios.json');
    const data = await res.json();
    scenarios = data.scenarios || [];
    coachData = data.coach     || {};
    levelData = data.levels    || [];
  } catch (e) {
    console.warn('Could not load scenarios.json, using fallback');
    scenarios = FALLBACK_SCENARIOS;
  }

  loadSavedState();
  setupEventListeners();
  // Don't show screen here — tab controller will trigger when quiz tab is opened
  // But initialise DOM to splash state
  _activateScreen('splash');
}

// ═══════════════════════════════════════════════════════════
// SCREEN MANAGEMENT
// ═══════════════════════════════════════════════════════════

// Internal helper — sets .active class without any tab bar logic
function _activateScreen(name) {
  Object.values(screens).forEach(s => s.classList.remove('active'));
  if (screens[name]) screens[name].classList.add('active');
  if (name === 'splash') updateSplashStats();
  if (name === 'stats')  renderStats();
}

// Public — also managed by the tab controller in index.html
function showScreen(name) {
  _activateScreen(name);
  // Tab bar management is handled by the wrapper in index.html
  // If the wrapper hasn't patched this yet, do it ourselves
  const tabBar = document.getElementById('app-tab-bar');
  if (tabBar) tabBar.style.display = (name === 'game') ? 'none' : 'flex';
  // Coach bubble position
  if (coachBubble) {
    coachBubble.style.bottom = (name === 'game')
      ? '16px'
      : 'calc(var(--tab-h) + 12px)';
  }
}

// ═══════════════════════════════════════════════════════════
// EVENT LISTENERS
// ═══════════════════════════════════════════════════════════
function setupEventListeners() {
  document.getElementById('btn-play').onclick       = () => showScreen('setup');
  document.getElementById('btn-back-splash').onclick = () => showScreen('splash');
  document.getElementById('btn-start-game').onclick  = startGame;
  document.getElementById('btn-play-again').onclick  = () => {
    showScreen('setup');
    document.getElementById('player-name').value = gameState.playerName;
  };
  document.getElementById('btn-results-stats').onclick = () => showScreen('stats');
  document.getElementById('btn-results-home').onclick  = () => showScreen('splash');
  document.getElementById('btn-stats-back').onclick    = () => showScreen('splash');
  document.getElementById('btn-clear-stats').onclick   = clearStats;

  // Color picker
  document.querySelectorAll('.color-btn').forEach(btn => {
    btn.onclick = () => {
      document.querySelectorAll('.color-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      gameState.playerColor = btn.dataset.color;
      document.documentElement.style.setProperty('--player-color', gameState.playerColor);
    };
  });

  // Enter key on name field
  document.getElementById('player-name').addEventListener('keydown', e => {
    if (e.key === 'Enter') startGame();
  });
}

// ═══════════════════════════════════════════════════════════
// GAME FLOW
// ═══════════════════════════════════════════════════════════
function startGame() {
  const name = document.getElementById('player-name').value.trim();
  gameState.playerName = name || 'Player';
  document.documentElement.style.setProperty('--player-color', gameState.playerColor);

  const shuffled = [...scenarios].sort(() => Math.random() - 0.5);
  gameState.gameScenarios = shuffled.slice(0, SCENARIOS_PER_GAME);
  gameState.score          = 0;
  gameState.round          = 0;
  gameState.correctCount   = 0;
  gameState.skipCount      = 0;
  gameState.responseTimes  = [];
  gameState.streak         = 0;
  gameState.categoryStats  = {};
  gameState.answered       = false;

  showScreen('game');
  nextRound();
}

function nextRound() {
  clearTimer();
  coachBubble.classList.add('hidden');
  gameState.answered = false;

  if (gameState.round >= gameState.gameScenarios.length) {
    endGame();
    return;
  }

  const scenario = gameState.gameScenarios[gameState.round];
  gameState.currentScenario = scenario;
  gameState.round++;

  updateHUD();

  const level = getCurrentLevel();
  gameState.timerMax       = scenario.timeLimit || level.timeLimit || 30;
  gameState.roundStartTime = Date.now();

  renderScenario(scenario);
  startTimer(gameState.timerMax);
}

function skipRound() {
  if (gameState.answered) return;
  gameState.answered = true;
  gameState.skipCount++;
  gameState.streak = 0;
  clearTimer();
  coachBubble.classList.add('hidden');
  nextRound();
}

function endGame() {
  clearTimer();
  const total    = gameState.gameScenarios.length;
  const correct  = gameState.correctCount;
  const accuracy = total > 0 ? Math.round((correct / total) * 100) : 0;
  const avgTime  = gameState.responseTimes.length > 0
    ? (gameState.responseTimes.reduce((a,b) => a+b, 0) / gameState.responseTimes.length / 1000).toFixed(1)
    : '0.0';

  const level = getCurrentLevel();
  const stats = saveGameResult({
    playerName: gameState.playerName,
    score:      gameState.score,
    accuracy,
    avgTime:    parseFloat(avgTime),
    correct,
    total,
    streak:     gameState.streak,
    categoryStats: gameState.categoryStats,
    level:      level.name,
    timestamp:  new Date().toISOString()
  });

  // Populate results screen
  document.getElementById('result-score').textContent   = gameState.score;
  document.getElementById('res-accuracy').textContent   = accuracy + '%';
  document.getElementById('res-avg-time').textContent   = avgTime + 's';
  document.getElementById('res-correct').textContent    = `${correct}/${total}`;
  document.getElementById('res-best').textContent       = stats.bestScore;
  document.getElementById('res-skips').textContent      = gameState.skipCount;

  const titles = [[90,'🌟 World Class!'],[70,'⚡ Brilliant!'],[50,'👍 Good Game!'],[0,'💪 Keep Practicing!']];
  document.getElementById('result-title').textContent = titles.find(([t]) => accuracy >= t)[1];

  const badges = [[80,'🏆'],[60,'🥈'],[40,'🥉'],[0,'⚽']];
  document.getElementById('result-badge').textContent = badges.find(([t]) => accuracy >= t)[1];
  document.getElementById('res-level').textContent   = `${level.emoji} ${level.name} Level`;

  if (accuracy >= 70) confetti();

  // ── Log to Firebase (replaces Google Forms) ──────────────
  if (typeof logGameScore === 'function') {
    logGameScore({
      playerName:      gameState.playerName,
      date:            new Date().toLocaleDateString(),
      time:            new Date().toLocaleTimeString(),
      score:           gameState.score,
      accuracy,
      avgResponseTime: parseFloat(avgTime),
      correctAnswers:  correct,
      totalQuestions:  total,
      level:           level.name,
      categoryBreakdown: JSON.stringify(gameState.categoryStats)
    });
  }

  showScreen('results');
}

// ═══════════════════════════════════════════════════════════
// SCENARIO RENDERING
// ═══════════════════════════════════════════════════════════
function renderScenario(scenario) {
  scenarioContainer.innerHTML = '';

  if      (scenario.type === 'choice')   renderChoiceScenario(scenario);
  else if (scenario.type === 'spot')     renderSpotScenario(scenario);
  else if (scenario.type === 'reaction') renderReactionScenario(scenario);

  const skipBtn = document.createElement('button');
  skipBtn.className = 'btn-skip';
  skipBtn.textContent = 'Skip ›';
  skipBtn.onclick = skipRound;
  scenarioContainer.appendChild(skipBtn);
}

// ── CHOICE scenario ────────────────────────────────────────
function renderChoiceScenario(scenario) {
  const card = document.createElement('div');
  card.className = 'scenario-card';

  const categoryEmoji = { passing:'🔄', shooting:'🥅', defending:'🛡️', positioning:'📍', awareness:'👀' };
  const emoji = categoryEmoji[scenario.category] || '⚽';

  card.innerHTML = `
    <div class="scenario-type-badge">${emoji} ${capitalize(scenario.category)}</div>
    <div class="scenario-question">${scenario.question}</div>
    <div class="field-wrap">${renderFieldSVG(scenario.fieldSetup)}</div>
    <div class="choices-grid" id="choices-${scenario.id}"></div>
  `;

  scenarioContainer.appendChild(card);

  const grid = card.querySelector(`#choices-${scenario.id}`);
  scenario.choices.forEach(choice => {
    const btn = document.createElement('button');
    btn.className = 'choice-btn';
    btn.innerHTML = `<span class="choice-letter">${choice.id}</span>${choice.text}`;
    btn.dataset.choiceId = choice.id;
    btn.onclick = () => handleChoiceAnswer(scenario, choice, card);
    grid.appendChild(btn);
  });
}

function handleChoiceAnswer(scenario, choice, card) {
  if (gameState.answered) return;
  gameState.answered = true;
  clearTimer();

  const elapsed = (Date.now() - gameState.roundStartTime) / 1000;
  gameState.responseTimes.push(Date.now() - gameState.roundStartTime);

  const buttons = card.querySelectorAll('.choice-btn');
  buttons.forEach(btn => {
    btn.disabled = true;
    const c = scenario.choices.find(ch => ch.id === btn.dataset.choiceId);
    if (c.correct) btn.classList.add('reveal-correct');
  });

  const clicked = card.querySelector(`[data-choice-id="${choice.id}"]`);

  if (choice.correct) {
    clicked.classList.add('correct');
    const points = calcPoints(elapsed, gameState.timerMax);
    gameState.score += points;
    gameState.correctCount++;
    gameState.streak++;
    trackCategory(scenario.category, true);
    showCoach(true, choice.explanation, points);
  } else {
    clicked.classList.add('wrong');
    gameState.streak = 0;
    trackCategory(scenario.category, false);
    showCoach(false, choice.explanation);
  }

  updateHUD();
  setTimeout(nextRound, 2800);
}

// ── SPOT scenario ──────────────────────────────────────────
function renderSpotScenario(scenario) {
  const card = document.createElement('div');
  card.className = 'scenario-card';

  card.innerHTML = `
    <div class="scenario-type-badge">👀 Spot the Player</div>
    <div class="scenario-question">${scenario.question}</div>
    <div class="field-wrap" id="spot-field-wrap">
      ${renderFieldSVG(scenario.fieldSetup, true, scenario.correctTeammateId)}
    </div>
    <div style="text-align:center;font-size:12px;color:#666;font-weight:700">Tap the right player!</div>
  `;

  scenarioContainer.appendChild(card);

  card.querySelectorAll('[data-player-id]').forEach(el => {
    el.style.cursor = 'pointer';
    el.addEventListener('click', () => {
      if (gameState.answered) return;
      gameState.answered = true;
      clearTimer();
      gameState.responseTimes.push(Date.now() - gameState.roundStartTime);
      const elapsed = (Date.now() - gameState.roundStartTime) / 1000;
      const correct = el.dataset.playerId === scenario.correctTeammateId;

      if (correct) {
        el.querySelector('circle').setAttribute('fill', '#40916c');
        const points = calcPoints(elapsed, scenario.timeLimit || 15);
        gameState.score += points;
        gameState.correctCount++;
        gameState.streak++;
        trackCategory(scenario.category, true);
        showCoach(true, scenario.explanation, points);
      } else {
        el.querySelector('circle').setAttribute('fill', '#e63946');
        card.querySelector(`[data-player-id="${scenario.correctTeammateId}"] circle`)?.setAttribute('fill', '#40916c');
        gameState.streak = 0;
        trackCategory(scenario.category, false);
        showCoach(false, scenario.explanation);
      }
      updateHUD();
      setTimeout(nextRound, 2800);
    });
  });
}

// ── REACTION scenario ──────────────────────────────────────
function renderReactionScenario(scenario) {
  const wrapper = document.createElement('div');
  wrapper.className = 'reaction-container';

  let seqIndex = 0, hits = 0, misses = 0, totalGreen = 0, isGreen = false, seqTimer = null;
  totalGreen = scenario.sequence.filter(s => s.color === 'green').length;

  wrapper.innerHTML = `
    <div style="color:white;font-weight:800;font-size:15px;text-align:center;max-width:280px">${scenario.question}</div>
    <div class="reaction-light red-light" id="reaction-light">🔴</div>
    <div class="reaction-feedback" id="reaction-fb"></div>
    <div class="reaction-score-display" id="reaction-pts">Tap when GREEN!</div>
    <div class="reaction-progress"><div class="reaction-progress-fill" id="rxn-prog" style="width:0%"></div></div>
  `;
  scenarioContainer.appendChild(wrapper);

  const light = wrapper.querySelector('#reaction-light');
  const fb    = wrapper.querySelector('#reaction-fb');
  const pts   = wrapper.querySelector('#reaction-pts');
  const prog  = wrapper.querySelector('#rxn-prog');

  light.addEventListener('click', () => {
    if (isGreen) {
      hits++;
      const rt = Date.now() - gameState.roundStartTime;
      gameState.responseTimes.push(rt);
      fb.textContent  = `✅ ${(rt/1000).toFixed(2)}s — Nice!`;
      fb.className    = 'reaction-feedback good';
    } else {
      misses++;
      fb.textContent  = '❌ Too early!';
      fb.className    = 'reaction-feedback bad';
    }
    pts.textContent = `${hits} / ${totalGreen} green hits`;
  });

  function runSequence() {
    if (seqIndex >= scenario.sequence.length) {
      clearTimeout(seqTimer);
      const accuracy = totalGreen > 0 ? hits / totalGreen : 0;
      const points   = Math.max(0, Math.round(accuracy * 60) - (misses * 5));

      gameState.score += points;
      gameState.correctCount += hits;
      gameState.answered = true;
      trackCategory('speed', accuracy >= 0.6);
      if (accuracy >= 0.6) gameState.streak++;
      else                  gameState.streak = 0;

      showCoach(accuracy >= 0.6,
        accuracy >= 0.8 ? 'Lightning fast reactions! You saw every opening! ⚡' :
        accuracy >= 0.5 ? 'Good reactions! Keep training your eyes! 👀' :
        'Reaction speed takes practice — keep going! 💪', points);

      prog.style.width = '100%';
      updateHUD();
      clearTimer();
      setTimeout(nextRound, 2800);
      return;
    }

    const step  = scenario.sequence[seqIndex];
    isGreen     = step.color === 'green';
    seqIndex++;
    prog.style.width = (seqIndex / scenario.sequence.length * 100) + '%';

    if (isGreen) { light.className = 'reaction-light green-light'; light.textContent = '🟢'; }
    else          { light.className = 'reaction-light red-light';   light.textContent = '🔴'; }

    seqTimer = setTimeout(runSequence, step.duration);
  }

  gameState.roundStartTime = Date.now();
  setTimeout(runSequence, 600);
}

// ═══════════════════════════════════════════════════════════
// FIELD SVG RENDERER
// ═══════════════════════════════════════════════════════════
function renderFieldSVG(setup, clickable = false, correctId = null) {
  const W = 420, H = 280;
  const toX = x => (x / 100) * W;
  const toY = y => (y / 100) * H;

  let svg = `<svg class="field-svg" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">
    <rect width="${W}" height="${H}" fill="#2d6a4f"/>
    <rect x="0" y="0"   width="${W}" height="33" fill="rgba(0,0,0,0.06)"/>
    <rect x="0" y="66"  width="${W}" height="33" fill="rgba(0,0,0,0.06)"/>
    <rect x="0" y="132" width="${W}" height="34" fill="rgba(0,0,0,0.06)"/>
    <line x1="${W/2}" y1="0" x2="${W/2}" y2="${H}" stroke="rgba(255,255,255,0.25)" stroke-width="1.5"/>
    <circle cx="${W/2}" cy="${H/2}" r="28" fill="none" stroke="rgba(255,255,255,0.25)" stroke-width="1.5"/>
    <rect x="${W/2-22}" y="0"      width="44" height="12" fill="none" stroke="rgba(255,255,255,0.5)" stroke-width="1.5"/>
    <rect x="${W/2-22}" y="${H-12}" width="44" height="12" fill="none" stroke="rgba(255,255,255,0.5)" stroke-width="1.5"/>
    <rect x="${W/2-40}" y="0"      width="80" height="32" fill="none" stroke="rgba(255,255,255,0.2)" stroke-width="1"/>
    <rect x="${W/2-40}" y="${H-32}" width="80" height="32" fill="none" stroke="rgba(255,255,255,0.2)" stroke-width="1"/>
  `;

  if (setup.ballPosition) {
    const bx = toX(setup.ballPosition.x), by = toY(setup.ballPosition.y);
    svg += `<circle cx="${bx}" cy="${by}" r="7" fill="white" stroke="#333" stroke-width="1.5"/>
    <text x="${bx}" y="${by+1}" text-anchor="middle" dominant-baseline="middle" font-size="8">⚽</text>`;
  }

  (setup.defenders || []).forEach(d => {
    const x = toX(d.x), y = toY(d.y);
    const col = d.label === 'GK' ? '#f0a500' : '#888';
    svg += `<circle cx="${x}" cy="${y}" r="14" fill="${col}" stroke="white" stroke-width="2"/>
    <text x="${x}" y="${y}" class="player-label">${d.label}</text>`;
  });

  (setup.teammates || []).forEach(t => {
    const x = toX(t.x), y = toY(t.y);
    const glow  = t.isOpen ? `<circle cx="${x}" cy="${y}" r="20" fill="rgba(100,220,150,0.25)"/>` : '';
    const extra = clickable ? `data-player-id="${t.id}"` : '';
    svg += `${glow}<g ${extra}>
      <circle cx="${x}" cy="${y}" r="14" fill="#4a90d9" stroke="white" stroke-width="2"/>
      <text x="${x}" y="${y}" class="player-label">${t.label}</text>
    </g>`;
  });

  (setup.defenders || []).forEach(d => {
    if (!d.id) return;
    const x   = toX(d.x), y = toY(d.y);
    const col = d.isDangerous ? '#e63946' : '#888';
    const extra = clickable ? `data-player-id="${d.id}"` : '';
    svg = svg.replace(
      `<circle cx="${x}" cy="${y}" r="14" fill="${col}" stroke="white" stroke-width="2"/>\n    <text x="${x}" y="${y}" class="player-label">${d.label}</text>`,
      `<g ${extra}><circle cx="${x}" cy="${y}" r="14" fill="${col}" stroke="white" stroke-width="2"/><text x="${x}" y="${y}" class="player-label">${d.label}</text></g>`
    );
  });

  if (setup.yourPlayer) {
    const x = toX(setup.yourPlayer.x), y = toY(setup.yourPlayer.y);
    svg += `<circle cx="${x}" cy="${y}" r="15" fill="var(--player-color)" stroke="white" stroke-width="2.5"/>
    <text x="${x}" y="${y}" class="player-label" style="font-size:9px">YOU</text>`;
  }

  svg += `</svg>`;
  return svg;
}

// ═══════════════════════════════════════════════════════════
// TIMER
// ═══════════════════════════════════════════════════════════
function startTimer(seconds) {
  gameState.timerMax   = seconds;
  gameState.timerValue = seconds;
  updateTimerUI(seconds, seconds);

  let elapsed = 0;
  gameState.timer = setInterval(() => {
    elapsed += 100;
    const remaining = Math.max(0, seconds - elapsed / 1000);
    gameState.timerValue = remaining;
    updateTimerUI(remaining, seconds);

    if (remaining <= 0) {
      clearTimer();
      if (!gameState.answered) {
        gameState.answered = true;
        gameState.streak   = 0;
        showCoach(false, "Time's up! Make your decision faster next time! ⏱️");
        const s = gameState.currentScenario;
        if (s) trackCategory(s.category, false);
        setTimeout(nextRound, 2000);
      }
    }
  }, 100);
}

function clearTimer() {
  if (gameState.timer) { clearInterval(gameState.timer); gameState.timer = null; }
}

function updateTimerUI(remaining, max) {
  const numEl  = document.getElementById('hud-timer');
  const circle = document.getElementById('timer-circle');
  if (!numEl || !circle) return;

  numEl.textContent = Math.ceil(remaining);
  const pct    = remaining / max;
  circle.style.strokeDashoffset = CIRCUMFERENCE * (1 - pct);
  circle.style.stroke = pct > 0.5 ? '#ffd60a' : pct > 0.25 ? '#ff9f1c' : '#e63946';
}

// ═══════════════════════════════════════════════════════════
// HUD
// ═══════════════════════════════════════════════════════════
function updateHUD() {
  document.getElementById('hud-score').textContent = gameState.score;
  document.getElementById('hud-round').textContent = `${gameState.round}/${gameState.gameScenarios.length}`;
}

// ═══════════════════════════════════════════════════════════
// COACH
// ═══════════════════════════════════════════════════════════
function showCoach(correct, explanation, points) {
  const msgs  = correct ? coachData.encouragements : coachData.corrections;
  const praise = msgs ? msgs[Math.floor(Math.random() * msgs.length)] : '';
  let txt = `<strong>${praise}</strong><br>${explanation}`;
  if (correct && points) txt += ` <span style="color:#2d6a4f;font-weight:800">+${points} pts</span>`;
  coachText.innerHTML = txt;
  coachBubble.classList.remove('hidden');
  coachBubble.style.animation = 'none';
  requestAnimationFrame(() => { coachBubble.style.animation = ''; });
}

// ═══════════════════════════════════════════════════════════
// SCORING
// ═══════════════════════════════════════════════════════════
function calcPoints(elapsed, maxTime) {
  const base        = 50;
  const timeBonus   = Math.max(0, Math.round((1 - elapsed / maxTime) * 50));
  const streakBonus = Math.min(gameState.streak * 5, 30);
  return base + timeBonus + streakBonus;
}

// ═══════════════════════════════════════════════════════════
// CATEGORY TRACKING
// ═══════════════════════════════════════════════════════════
function trackCategory(cat, correct) {
  if (!gameState.categoryStats[cat]) gameState.categoryStats[cat] = { correct: 0, total: 0 };
  gameState.categoryStats[cat].total++;
  if (correct) gameState.categoryStats[cat].correct++;
}

// ═══════════════════════════════════════════════════════════
// LEVELS
// ═══════════════════════════════════════════════════════════
function getCurrentLevel() {
  if (!levelData.length) return { name: 'Player', emoji: '⚽', timeLimit: 30 };
  const sorted = [...levelData].sort((a, b) => b.minScore - a.minScore);
  return sorted.find(l => gameState.score >= l.minScore) || levelData[0];
}

// ═══════════════════════════════════════════════════════════
// STATS PERSISTENCE  (localStorage for per-device history)
// ═══════════════════════════════════════════════════════════
function getStats() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || defaultStats(); }
  catch { return defaultStats(); }
}

function defaultStats() {
  return { playerName:'', bestScore:0, totalGames:0, totalCorrect:0, totalQuestions:0, bestStreak:0, scores:[], responseTimes:[], categoryStats:{} };
}

function saveGameResult(result) {
  const stats = getStats();
  stats.playerName     = result.playerName;
  stats.bestScore      = Math.max(stats.bestScore, result.score);
  stats.totalGames++;
  stats.totalCorrect   += result.correct;
  stats.totalQuestions += result.total;
  stats.bestStreak     = Math.max(stats.bestStreak, result.streak);
  stats.scores.push(result.score);
  if (stats.scores.length > 20) stats.scores.shift();
  if (result.avgTime) stats.responseTimes.push(result.avgTime);
  if (stats.responseTimes.length > 20) stats.responseTimes.shift();

  Object.entries(result.categoryStats || {}).forEach(([cat, data]) => {
    if (!stats.categoryStats[cat]) stats.categoryStats[cat] = { correct: 0, total: 0 };
    stats.categoryStats[cat].correct += data.correct;
    stats.categoryStats[cat].total   += data.total;
  });

  localStorage.setItem(STORAGE_KEY, JSON.stringify(stats));
  return stats;
}

function loadSavedState() {
  const stats = getStats();
  if (stats.playerName) document.getElementById('player-name').value = stats.playerName;
}

function clearStats() {
  if (confirm('Reset all local stats? This cannot be undone.')) {
    localStorage.removeItem(STORAGE_KEY);
    renderStats();
  }
}

// ═══════════════════════════════════════════════════════════
// STATS SCREEN
// ═══════════════════════════════════════════════════════════
function updateSplashStats() {
  const stats = getStats();
  const bar   = document.getElementById('splash-stats');
  if (stats.totalGames > 0) {
    bar.style.display = 'flex';
    document.getElementById('splash-best').textContent   = stats.bestScore;
    document.getElementById('splash-streak').textContent = stats.bestStreak;
    document.getElementById('splash-games').textContent  = stats.totalGames;
  }
}

function renderStats() {
  const stats = getStats();
  document.getElementById('stats-player-name').textContent = stats.playerName ? `⚽ ${stats.playerName}` : '';
  document.getElementById('st-best-score').textContent     = stats.bestScore;
  document.getElementById('st-avg-accuracy').textContent   = stats.totalQuestions > 0
    ? Math.round((stats.totalCorrect / stats.totalQuestions) * 100) + '%' : '—';
  document.getElementById('st-avg-speed').textContent      = stats.responseTimes.length > 0
    ? (stats.responseTimes.reduce((a,b) => a+b, 0) / stats.responseTimes.length).toFixed(1) + 's' : '—';
  document.getElementById('st-total-games').textContent    = stats.totalGames;
  document.getElementById('st-best-streak').textContent    = stats.bestStreak;
  document.getElementById('st-total-correct').textContent  = stats.totalCorrect;

  drawChart(stats.scores);
  drawCategoryBars(stats.categoryStats);
}

function drawChart(scores) {
  const canvas = document.getElementById('progress-chart');
  if (!canvas || scores.length < 2) return;
  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;
  ctx.clearRect(0, 0, W, H);

  const max = Math.max(...scores, 100);
  const pad = { top:20, bottom:24, left:40, right:16 };
  const cW  = W - pad.left - pad.right;
  const cH  = H - pad.top  - pad.bottom;

  ctx.strokeStyle = 'rgba(255,255,255,0.1)'; ctx.lineWidth = 1;
  [0, 0.25, 0.5, 0.75, 1].forEach(pct => {
    const y = pad.top + cH - pct * cH;
    ctx.beginPath(); ctx.moveTo(pad.left, y); ctx.lineTo(W - pad.right, y); ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.4)'; ctx.font = '10px Nunito';
    ctx.fillText(Math.round(pct * max), 4, y + 4);
  });

  ctx.beginPath(); ctx.strokeStyle = '#ffd60a'; ctx.lineWidth = 2.5; ctx.lineJoin = 'round';
  scores.forEach((s, i) => {
    const x = pad.left + (i / (scores.length - 1)) * cW;
    const y = pad.top  + cH - (s / max) * cH;
    i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
  });
  ctx.stroke();

  scores.forEach((s, i) => {
    const x = pad.left + (i / (scores.length - 1)) * cW;
    const y = pad.top  + cH - (s / max) * cH;
    ctx.beginPath(); ctx.arc(x, y, 4, 0, Math.PI * 2);
    ctx.fillStyle = '#ffd60a'; ctx.fill();
  });

  ctx.fillStyle = 'rgba(255,255,255,0.5)'; ctx.font = '11px Nunito';
  ctx.fillText('Score History', pad.left, pad.top - 5);
}

function drawCategoryBars(catStats) {
  const wrap = document.getElementById('category-breakdown');
  wrap.innerHTML = '';
  if (!catStats || Object.keys(catStats).length === 0) return;

  const labels = { passing:'🔄 Passing', shooting:'🥅 Shooting', defending:'🛡️ Defending', positioning:'📍 Position', awareness:'👀 Awareness', speed:'⚡ Reactions' };
  Object.entries(catStats).forEach(([cat, data]) => {
    if (data.total === 0) return;
    const pct = Math.round((data.correct / data.total) * 100);
    const row = document.createElement('div');
    row.className = 'cat-row';
    row.innerHTML = `
      <span class="cat-name">${labels[cat] || cat}</span>
      <div class="cat-bar-wrap"><div class="cat-bar" style="width:${pct}%"></div></div>
      <span class="cat-pct">${pct}%</span>`;
    wrap.appendChild(row);
  });
}

// ═══════════════════════════════════════════════════════════
// CONFETTI
// ═══════════════════════════════════════════════════════════
function confetti() {
  const colors = ['#ffd60a','#ff6b35','#06d6a0','#118ab2','#ffffff'];
  for (let i = 0; i < 40; i++) {
    const p = document.createElement('div');
    p.className = 'confetti-piece';
    p.style.cssText = `
      left: ${Math.random() * 100}vw;
      background: ${colors[Math.floor(Math.random() * colors.length)]};
      width: ${6 + Math.random() * 8}px; height: ${6 + Math.random() * 8}px;
      border-radius: ${Math.random() > 0.5 ? '50%' : '2px'};
      animation-duration: ${1.5 + Math.random() * 2}s;
      animation-delay: ${Math.random() * 0.5}s;
    `;
    document.body.appendChild(p);
    p.addEventListener('animationend', () => p.remove());
  }
}

// ═══════════════════════════════════════════════════════════
// UTILITIES
// ═══════════════════════════════════════════════════════════
function capitalize(str) { return str ? str.charAt(0).toUpperCase() + str.slice(1) : ''; }

// ═══════════════════════════════════════════════════════════
// FALLBACK SCENARIOS
// ═══════════════════════════════════════════════════════════
const FALLBACK_SCENARIOS = [
  {
    id:"f001", type:"choice", category:"passing", difficulty:1,
    question:"You have the ball and a defender is coming. Your teammate is open on the left. What do you do?",
    fieldSetup:{
      ballPosition:{x:50,y:55}, yourPlayer:{x:50,y:55,label:"YOU"},
      teammates:[{x:20,y:45,label:"Ally",isOpen:true}],
      defenders:[{x:50,y:42,label:"D1"}], goal:{x:50,y:10}
    },
    choices:[
      {id:"A",text:"Pass to Ally on the left",correct:true,explanation:"Ally is open — great decision!"},
      {id:"B",text:"Try to dribble past the defender",correct:false,explanation:"Too risky! Ally was open."},
      {id:"C",text:"Kick it out",correct:false,explanation:"Never give up the ball when you have options!"},
      {id:"D",text:"Stop and wait",correct:false,explanation:"Make a quick decision — time is precious!"}
    ]
  }
];

// ── START ──────────────────────────────────────────────────
init();
