import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import confetti from 'canvas-confetti';
import './style.css';
import raw from './locations.json';

const BRANDS = {
  '7brew':       { name: '7 Brew',        color: '#d63031', emoji: '☕', vibe: 'Drive-thru coffee, 20+ flavors' },
  swig:          { name: 'Swig',          color: '#14a3a8', emoji: '🥤', vibe: 'Dirty sodas & cookies' },
  dutch:         { name: 'Dutch Bros',    color: '#2d63c8', emoji: '🧋', vibe: 'Rebels, cold brew & good vibes' },
  justsalad:     { name: 'Just Salad',    color: '#4fa83d', emoji: '🥗', vibe: 'Still salad — just a new name' },
  brewculture:   { name: 'Brew Culture',  color: '#9a68d6', emoji: '🍵', vibe: 'Local coffee & energy drinks' },
  saladgo:       { name: 'Salad and Go',  color: '#f27a1f', emoji: '🥬', vibe: 'Staying put! 🎉' },
};
// Tucson's six 7 Brew sites were announced without addresses.
const UNLISTED = { '7brew': 6 };

const locs = raw.map((l, i) => ({ ...l, id: i }));
const $ = (s) => document.querySelector(s);
const active = new Set(Object.keys(BRANDS));
let userPos = null;

/* ---------- Map ---------- */
const map = L.map('map', {
  zoomControl: false,
  attributionControl: true,
  // Fluid zoom: no snapping to integer levels, small wheel steps
  zoomSnap: 0,
  zoomDelta: 0.5,
  wheelPxPerZoomLevel: 120,
  wheelDebounceTime: 10,
}).setView([33.45, -112.0], 10);
L.control.zoom({ position: 'bottomright' }).addTo(map);
L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
  maxZoom: 19,
  className: 'tiles',
  attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
}).addTo(map);

const metro = locs.filter((l) => l.lat > 33);
const metroBounds = L.latLngBounds(metro.map((l) => [l.lat, l.lng])).pad(0.05);
const allBounds = L.latLngBounds(locs.map((l) => [l.lat, l.lng])).pad(0.05);
map.fitBounds(metroBounds);

function pinIcon(l, extra = '') {
  const b = BRANDS[l.brand];
  return L.divIcon({
    className: '',
    html: `<div class="pin ${l.pending ? 'pending' : ''} ${extra}" style="--c:${b.color}"><span>${b.emoji}</span></div>`,
    iconSize: [36, 36],
    iconAnchor: [18, 36],
    popupAnchor: [0, -34],
  });
}

const directions = (l) =>
  `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(`${l.address}, ${l.city}, AZ`)}`;

function popupHtml(l) {
  const b = BRANDS[l.brand];
  const staying = l.brand === 'saladgo';
  return `
    <div class="pop">
      <div class="pop-city">${l.city}</div>
      <div class="pop-addr">${l.address}</div>
      <div class="swap">
        <span class="from">🥗 Salad and Go</span>
        <span class="arrow">${staying ? '↺' : '➜'}</span>
        <span class="to" style="--c:${b.color}">${b.emoji} ${b.name}</span>
      </div>
      <div class="pop-vibe">${l.pending ? '⏳ Pending — not final yet' : b.vibe}</div>
      <div class="pop-actions">
        <a href="${directions(l)}" target="_blank" rel="noopener">🚗 Directions</a>
        <button data-share="${l.id}">🔗 Share</button>
      </div>
    </div>`;
}

const markers = new Map();
for (const l of locs) {
  const m = L.marker([l.lat, l.lng], { icon: pinIcon(l), riseOnHover: true }).bindPopup(popupHtml(l));
  m.on('popupopen', () => history.replaceState(null, '', `#loc-${l.id}`));
  markers.set(l.id, m);
}
const layer = L.layerGroup().addTo(map);

function refreshMarkers() {
  layer.clearLayers();
  if (game.on) return;
  for (const l of locs) if (active.has(l.brand)) layer.addLayer(markers.get(l.id));
}

function focusLoc(l, zoom = 14) {
  if (!active.has(l.brand)) { active.add(l.brand); renderChips(); refreshMarkers(); }
  map.flyTo([l.lat, l.lng], zoom, { duration: 0.8 });
  map.once('moveend', () => markers.get(l.id).openPopup());
  if (window.innerWidth < 900) $('.map-wrap').scrollIntoView({ behavior: 'smooth' });
}

document.addEventListener('click', async (e) => {
  const id = e.target.closest('[data-share]')?.dataset.share;
  if (id == null) return;
  const l = locs[+id];
  const url = `${location.origin}${location.pathname}#loc-${id}`;
  const text = `The Salad and Go at ${l.address} (${l.city}) is becoming ${BRANDS[l.brand].name} ${BRANDS[l.brand].emoji}`;
  if (navigator.share) {
    try { await navigator.share({ title: "Who's taking over your Salad and Go?", text, url }); } catch {}
  } else {
    await navigator.clipboard?.writeText(`${text} ${url}`);
    toast('Link copied! 📋');
  }
});

let toastTimer;
function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 2600);
}

/* ---------- Brand chips ---------- */
function brandCount(key) {
  return locs.filter((l) => l.brand === key && !l.pending).length + (UNLISTED[key] || 0);
}

function renderChips() {
  const total = Object.keys(BRANDS).reduce((s, k) => s + brandCount(k), 0);
  $('#chips').innerHTML = Object.entries(BRANDS)
    .sort((a, b) => brandCount(b[0]) - brandCount(a[0]))
    .map(([k, b]) => {
      const n = brandCount(k);
      return `<button class="chip ${active.has(k) ? '' : 'off'}" data-brand="${k}" style="--c:${b.color}" aria-pressed="${active.has(k)}">
        <span class="chip-emoji">${b.emoji}</span>${b.name}<b>${n}</b>
        <i class="bar" style="width:${(n / total) * 100}%"></i>
      </button>`;
    })
    .join('');
}

$('#chips').addEventListener('click', (e) => {
  const k = e.target.closest('[data-brand]')?.dataset.brand;
  if (!k) return;
  // First tap isolates a brand; tapping it again (or another) toggles normally.
  if (active.size === Object.keys(BRANDS).length) { active.clear(); active.add(k); }
  else if (active.has(k)) active.delete(k);
  else active.add(k);
  if (active.size === 0) Object.keys(BRANDS).forEach((b) => active.add(b));
  renderChips(); refreshMarkers(); renderList();
});

/* ---------- List ---------- */
const haversineMi = (a, b) => {
  const r = (d) => (d * Math.PI) / 180, R = 3958.8;
  const dLat = r(b.lat - a.lat), dLng = r(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(r(a.lat)) * Math.cos(r(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
};

const row = (l, dist) => {
  const b = BRANDS[l.brand];
  return `<button class="row" data-id="${l.id}">
    <span class="addr">${l.address}${dist != null ? `<small>${l.city} · ${dist.toFixed(1)} mi</small>` : ''}</span>
    <span class="tag ${l.pending ? 'pending' : ''}" style="--c:${b.color}">${l.pending ? 'Pending · ' : ''}${b.emoji} ${b.name}</span>
  </button>`;
};

function renderList() {
  const q = $('#search').value.trim().toLowerCase();
  const shown = locs.filter((l) => active.has(l.brand) && (!q || `${l.address} ${l.city}`.toLowerCase().includes(q)));
  const byCity = {};
  for (const l of shown) (byCity[l.city] ||= []).push(l);
  const cities = Object.keys(byCity).sort();
  let html = cities
    .map((c) => {
      let extra = '';
      if (c === 'Tucson' && active.has('7brew')) extra = `<div class="row note">+ 6 more Tucson spots <span class="tag" style="--c:${BRANDS['7brew'].color}">☕ 7 Brew</span></div>`;
      return `<h3>${c} <span>${byCity[c].length}</span></h3>${byCity[c].map((l) => row(l)).join('')}${extra}`;
    })
    .join('');
  if (!html) html = `<p class="empty">No matches 🤷 — try another street or city.</p>`;
  $('#list').innerHTML = html;
}

$('#search').addEventListener('input', renderList);
document.querySelector('.panel').addEventListener('click', (e) => {
  const id = e.target.closest('.row[data-id]')?.dataset.id;
  if (id != null) focusLoc(locs[+id]);
});

/* ---------- Near me ---------- */
let youMarker;
$('#btn-near').addEventListener('click', () => {
  if (!navigator.geolocation) return toast('Location not available on this device');
  toast('Finding you… 🛰️');
  navigator.geolocation.getCurrentPosition(
    (p) => {
      userPos = { lat: p.coords.latitude, lng: p.coords.longitude };
      youMarker?.remove();
      youMarker = L.marker([userPos.lat, userPos.lng], {
        icon: L.divIcon({ className: '', html: '<div class="you"></div>', iconSize: [20, 20] }),
      }).addTo(map).bindTooltip('You', { direction: 'top' });
      const near = locs.map((l) => ({ l, d: haversineMi(userPos, l) })).sort((a, b) => a.d - b.d).slice(0, 3);
      $('#nearest').innerHTML = `<div class="nearest"><h3>📍 Closest to you</h3>${near.map(({ l, d }) => row(l, d)).join('')}</div>`;
      switchTab('list');
      const top = near[0];
      map.flyToBounds(L.latLngBounds([[userPos.lat, userPos.lng], [top.l.lat, top.l.lng]]).pad(0.6), { duration: 0.9 });
      map.once('moveend', () => markers.get(top.l.id).openPopup());
      toast(`Your closest Salad and Go is becoming ${BRANDS[top.l.brand].name} ${BRANDS[top.l.brand].emoji}`);
    },
    () => toast("Couldn't get your location — try searching instead"),
    { enableHighAccuracy: false, timeout: 10000 },
  );
});

$('#btn-all').addEventListener('click', () => {
  map.closePopup();
  map.flyToBounds(map.getBounds().contains(metroBounds) ? allBounds : metroBounds, { duration: 0.8 });
});

$('#btn-reset').addEventListener('click', () => {
  if (game.on) endGame();
  Object.keys(BRANDS).forEach((b) => active.add(b));
  $('#search').value = '';
  $('#nearest').innerHTML = '';
  youMarker?.remove();
  map.closePopup();
  history.replaceState(null, '', location.pathname);
  renderChips(); refreshMarkers(); renderList();
  switchTab('list');
  map.flyToBounds(metroBounds, { duration: 0.8 });
});

/* ---------- Tabs ---------- */
function switchTab(name) {
  document.querySelectorAll('.tab').forEach((t) => t.classList.toggle('active', t.dataset.tab === name));
  $('#tab-list').classList.toggle('hidden', name !== 'list');
  $('#tab-game').classList.toggle('hidden', name !== 'game');
  if (name !== 'game' && game.on) endGame(true);
  if (name === 'game' && !game.on) renderGameIntro();
}
document.querySelector('.tabs').addEventListener('click', (e) => {
  const t = e.target.closest('.tab');
  if (t) switchTab(t.dataset.tab);
});

/* ---------- Guess the takeover ---------- */
const ROUNDS = 10;
const game = { on: false, deck: [], i: 0, score: 0, streak: 0, best: 0, mystery: null, answered: false };

const shuffle = (a) => { for (let i = a.length - 1; i > 0; i--) { const j = (Math.random() * (i + 1)) | 0; [a[i], a[j]] = [a[j], a[i]]; } return a; };

function buildDeck() {
  // 7 Brew dominates the list, so cap it — otherwise "always guess 7 Brew" wins.
  const pool = locs.filter((l) => !l.pending);
  const brew = shuffle(pool.filter((l) => l.brand === '7brew')).slice(0, 4);
  const rest = shuffle(pool.filter((l) => l.brand !== '7brew')).slice(0, ROUNDS - brew.length);
  return shuffle([...brew, ...rest]);
}

function renderGameIntro() {
  let best = 0;
  try { best = +localStorage.getItem('sng-best') || 0; } catch {}
  $('#game').innerHTML = `
    <div class="game-card intro">
      <div class="big-emoji">🕵️</div>
      <h2>Guess the Takeover</h2>
      <p>We'll drop you at a mystery Salad and Go. You call what's moving in.
      ${ROUNDS} rounds. Streaks earn bonus confetti. 🎉</p>
      <p class="hint">Hint: 7 Brew is grabbing a <i>lot</i> of them… but not all.</p>
      ${best ? `<p class="best">Your best: <b>${best}/${ROUNDS}</b></p>` : ''}
      <button class="primary" id="game-start">Let's play ▶</button>
    </div>`;
  $('#game-start').onclick = startGame;
}

function startGame() {
  Object.assign(game, { on: true, deck: buildDeck(), i: 0, score: 0, streak: 0, best: 0 });
  map.closePopup();
  refreshMarkers();
  nextRound();
}

function nextRound() {
  game.mystery?.remove();
  if (game.i >= ROUNDS) return showResults();
  const l = game.deck[game.i];
  game.answered = false;
  game.mystery = L.marker([l.lat, l.lng], {
    icon: L.divIcon({ className: '', html: '<div class="pin mystery"><span>❓</span></div>', iconSize: [44, 44], iconAnchor: [22, 44] }),
  }).addTo(map);
  map.flyTo([l.lat, l.lng], 13, { duration: 1.1 });
  if (window.innerWidth < 900) $('.map-wrap').scrollIntoView({ behavior: 'smooth' });

  $('#game').innerHTML = `
    <div class="game-card">
      <div class="game-hud">
        <span>Round <b>${game.i + 1}</b>/${ROUNDS}</span>
        <span>Score <b>${game.score}</b></span>
        <span>${game.streak >= 2 ? `🔥 ${game.streak}` : '&nbsp;'}</span>
      </div>
      <div class="progress"><i style="width:${(game.i / ROUNDS) * 100}%"></i></div>
      <p class="q-city">${l.city}</p>
      <p class="q-addr">${l.address}</p>
      <p class="q">What's taking over this Salad and Go?</p>
      <div class="answers">
        ${Object.entries(BRANDS).map(([k, b]) => `<button class="answer" data-ans="${k}" style="--c:${b.color}"><span>${b.emoji}</span>${k === 'saladgo' ? 'Nothing — it stays!' : b.name}</button>`).join('')}
      </div>
      <div id="feedback"></div>
    </div>`;
  $('#game .answers').onclick = (e) => {
    const k = e.target.closest('[data-ans]')?.dataset.ans;
    if (k && !game.answered) answer(k);
  };
}

const CHEERS = ['Nailed it!', 'Big local energy!', 'You know your drive-thrus!', 'Sip sip hooray!', 'Certified Phoenician!'];
const JEERS = ['So close!', 'Plot twist!', "Didn't see that coming, huh?", 'Not quite!'];

function answer(k) {
  game.answered = true;
  const l = game.deck[game.i];
  const b = BRANDS[l.brand];
  const right = k === l.brand;
  document.querySelectorAll('.answer').forEach((btn) => {
    btn.disabled = true;
    if (btn.dataset.ans === l.brand) btn.classList.add('correct');
    else if (btn.dataset.ans === k) btn.classList.add('wrong');
  });
  game.mystery.setIcon(pinIcon(l, 'reveal'));
  if (right) {
    game.score++; game.streak++; game.best = Math.max(game.best, game.streak);
    confetti({ particleCount: 60 + game.streak * 25, spread: 70, origin: { y: 0.7 }, colors: [b.color, '#f2c14e', '#ffffff'] });
  } else {
    game.streak = 0;
    $('.game-card').classList.add('shake');
  }
  const pick = (a) => a[(Math.random() * a.length) | 0];
  $('#feedback').innerHTML = `
    <div class="feedback ${right ? 'ok' : 'nope'}">
      <b>${right ? pick(CHEERS) : pick(JEERS)}</b>
      It's ${l.brand === 'saladgo' ? 'staying <b>Salad and Go</b> 🥬' : `becoming <b style="color:${b.color}">${b.name}</b> ${b.emoji}`}
    </div>
    <button class="primary" id="next">${game.i + 1 >= ROUNDS ? 'See results 🏆' : 'Next ➜'}</button>`;
  $('#next').onclick = () => { game.i++; nextRound(); };
}

function rankFor(s) {
  if (s >= 10) return ['👑', 'Drive-Thru Royalty', 'Perfect score. Do you just… drive around all day?'];
  if (s >= 8) return ['🏆', 'Certified Sip Scout', 'You know these streets like your coffee order.'];
  if (s >= 6) return ['😎', 'Valley Local', 'Solid! You clearly get around.'];
  if (s >= 4) return ['🌵', 'Snowbird in Training', "Not bad — the map tab's got your back."];
  return ['🥤', 'Fresh to the Valley', 'Welcome to Phoenix! Time to go explore.'];
}

function showResults() {
  const [emoji, title, blurb] = rankFor(game.score);
  let best = 0;
  try {
    best = Math.max(+localStorage.getItem('sng-best') || 0, game.score);
    localStorage.setItem('sng-best', best);
  } catch {}
  game.on = false;
  game.mystery?.remove();
  refreshMarkers();
  map.flyToBounds(metroBounds, { duration: 1 });
  if (game.score >= 6) {
    const end = Date.now() + 900;
    (function burst() {
      confetti({ particleCount: 6, angle: 60, spread: 60, origin: { x: 0 } });
      confetti({ particleCount: 6, angle: 120, spread: 60, origin: { x: 1 } });
      if (Date.now() < end) requestAnimationFrame(burst);
    })();
  }
  $('#game').innerHTML = `
    <div class="game-card result">
      <div class="big-emoji">${emoji}</div>
      <p class="score">${game.score}<span>/${ROUNDS}</span></p>
      <h2>${title}</h2>
      <p>${blurb}</p>
      <p class="best">Longest streak: <b>${game.best}</b> · Best ever: <b>${best}/${ROUNDS}</b></p>
      <div class="result-actions">
        <button class="primary" id="again">Play again 🔁</button>
        <button class="secondary" id="share-score">Challenge a friend 📣</button>
      </div>
    </div>`;
  $('#again').onclick = startGame;
  $('#share-score').onclick = async () => {
    const text = `I scored ${game.score}/${ROUNDS} on "Guess the Takeover" — I'm a ${title} ${emoji}. Can you beat me? Which Salad and Go spots are turning into 7 Brew, Swig & Dutch Bros:`;
    const url = location.origin + location.pathname;
    if (navigator.share) { try { await navigator.share({ text, url }); } catch {} }
    else { await navigator.clipboard?.writeText(`${text} ${url}`); toast('Copied — go brag! 📋'); }
  };
}

function endGame() {
  game.on = false;
  game.mystery?.remove();
  refreshMarkers();
}

/* ---------- Boot ---------- */
renderChips();
refreshMarkers();
renderList();
const deep = location.hash.match(/^#loc-(\d+)$/);
if (deep && locs[+deep[1]]) setTimeout(() => focusLoc(locs[+deep[1]]), 400);

const syncHeader = () => {
  document.documentElement.style.setProperty('--header-h', `${$('.top').offsetHeight}px`);
  map.invalidateSize();
};
addEventListener('resize', syncHeader);
syncHeader();
