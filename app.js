/* Thanksgiving Family Feud — game logic. No build step, no backend. */
(function () {
  'use strict';

  var KEY = 'thanksgiving-feud-v1';
  var CATS = ['Job site and trade life', 'Office life', 'Thanksgiving', 'Just for fun'];

  // The game's questions, in play order. Ids stay stable so typed answers keep matching.
  var BANK = [
    ['t1', 0, 'Name something an electrician always has in their truck.'],
    ['t2', 0, 'Name the most annoying thing a GC or another trade does on a job site.'],
    ['t3', 0, 'Name something that gets said on every jobsite walk.'],
    ['t4', 2, 'Name something you can’t have Thanksgiving dinner without.'],
    ['t5', 1, 'Name something people complain about in the office.'],
    ['t6', 3, 'Name something you’d do with a surprise day off.'],
    ['t7', 3, 'Name a job you’d want if you weren’t in the electrical trade.'],
    ['t8', 2, 'Name something that goes wrong when cooking a Thanksgiving turkey.'],
    ['t9', 2, 'Name a Thanksgiving dish you can’t stand.'],
    ['t10', 3, 'Name your favorite musical artist/band of all time.'],
    ['t11', 2, 'Name something in the kitchen that could trip a breaker on Thanksgiving.'],
    ['t12', 2, 'Name something people do the day after Thanksgiving.']
  ];

  // Sample answers on question 1 so the board looks alive before the survey is tallied.
  var SAMPLE = [['Wire nuts', 32], ['Electrical tape', 24], ['Ladder', 15], ['Coffee', 10], ['Wire strippers', 8], ['Meter', 6]];

  // Tolerate mismatched file versions: a missing element becomes a harmless stand-in instead of crashing the game.
  var missing = [];
  function stub() {
    return new Proxy(function () {}, {
      get: function (t, k) {
        if (k === 'classList') return { add: function () {}, remove: function () {}, toggle: function () {}, contains: function () { return false; } };
        if (k === 'style') return { setProperty: function () {} };
        if (k === 'children') return [];
        if (k === 'value' || k === 'textContent') return '';
        if (k === 'checked' || k === 'disabled' || k === 'hidden') return false;
        return function () { return stub(); };
      },
      set: function () { return true; }
    });
  }
  var $ = function (id) {
    var e = document.getElementById(id);
    if (e) return e;
    if (missing.indexOf(id) < 0) missing.push(id);
    return stub();
  };
  function el(tag, cls, txt) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (txt != null) e.textContent = txt;
    return e;
  }
  function trunc(s, n) { s = String(s || ''); return s.length > n ? s.slice(0, n - 1) + '…' : s; }
  var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------------- State ---------------- */
  function blankFm() {
    return { q: [null, null, null, null, null], pick: [[-1, -1, -1, -1, -1], [-1, -1, -1, -1, -1]] };
  }
  function fresh() {
    return {
      v: 1,
      teams: [{ name: 'Team Pumpkin', score: 0 }, { name: 'Team Sage', score: 0 }],
      cur: 0,
      mute: false,
      music: true,
      musicVol: 50,
      questions: BANK.map(function (b, i) {
        return {
          id: b[0], cat: CATS[b[1]], q: b[2], use: true,
          a: i === 0 ? SAMPLE.map(function (r) { return { t: r[0], p: r[1] }; }) : []
        };
      }),
      fm: blankFm()
    };
  }
  function normalize(d) {
    if (!d || !Array.isArray(d.questions) || !d.questions.length) return null;
    var f = fresh();
    var out = {
      v: 1,
      teams: [0, 1].map(function (i) {
        var t = d.teams && d.teams[i];
        return {
          name: String((t && t.name) || f.teams[i].name),
          score: Math.max(0, Math.round(+(t && t.score) || 0))
        };
      }),
      cur: Math.max(0, +d.cur || 0),
      mute: !!d.mute,
      music: d.music !== false,
      musicVol: isFinite(+d.musicVol) && d.musicVol !== null && d.musicVol !== '' ? Math.min(100, Math.max(0, +d.musicVol)) : 50,
      questions: [],
      fm: blankFm()
    };
    var seen = {};
    d.questions.forEach(function (q, i) {
      if (!q || typeof q !== 'object') return;
      var id = String(q.id || ('q' + (i + 1)));
      while (seen[id]) id += 'x';
      seen[id] = true;
      out.questions.push({
        id: id,
        cat: String(q.cat || 'Custom'),
        q: String(q.q || ''),
        use: q.use !== false,
        a: (Array.isArray(q.a) ? q.a : []).slice(0, 8).map(function (r) {
          return { t: String((r && r.t) || ''), p: Math.max(0, Math.round(+(r && r.p) || 0)) };
        })
      });
    });
    if (!out.questions.length) return null;
    if (d.fm && Array.isArray(d.fm.q) && Array.isArray(d.fm.pick)) {
      out.fm.q = [0, 1, 2, 3, 4].map(function (i) { return d.fm.q[i] || null; });
      out.fm.pick = [0, 1].map(function (p) {
        return [0, 1, 2, 3, 4].map(function (i) {
          var v = (d.fm.pick[p] || [])[i];
          return Number.isInteger(v) ? v : -1;
        });
      });
    }
    return out;
  }
  var S = null;
  try { S = normalize(JSON.parse(localStorage.getItem(KEY))); } catch (e) { S = null; }
  if (!S) S = fresh();
  function save() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { /* storage unavailable */ } }

  function deck() { return S.questions.filter(function (q) { return q.use; }); }
  function curQ() { return deck()[S.cur] || null; }
  function sorted(q) {
    if (!q) return [];
    return q.a.filter(function (x) { return x.t && x.t.trim(); })
      .slice().sort(function (x, y) { return (+y.p || 0) - (+x.p || 0); }).slice(0, 8);
  }
  if (S.cur >= deck().length) S.cur = 0;

  /* ---------------- Round state (not saved) ---------------- */
  var R;
  function newRound() {
    R = { revealed: new Set(), shown: new Set(), strikes: 0, stealFailed: false, awarded: false, awardedPot: 0, control: null };
  }
  newRound();
  function mult() { return +$('mult').value || 1; }
  function base() {
    var a = sorted(curQ()), s = 0;
    R.revealed.forEach(function (i) { if (a[i]) s += (+a[i].p || 0); });
    return s;
  }
  function pot() { return R.awarded ? R.awardedPot : base() * mult(); }

  /* ---------------- Sound ---------------- */
  var ac;
  function ctx() {
    if (!ac) { try { ac = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { ac = null; } }
    if (ac && ac.state === 'suspended') ac.resume();
    return ac;
  }
  function tone(freq, start, dur, type, vol) {
    if (S.mute) return;
    var c = ctx(); if (!c) return;
    var o = c.createOscillator(), g = c.createGain();
    o.type = type; o.frequency.value = freq;
    g.gain.setValueAtTime(vol, c.currentTime + start);
    g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + start + dur);
    o.connect(g); g.connect(c.destination);
    o.start(c.currentTime + start); o.stop(c.currentTime + start + dur + 0.05);
  }
  var PENT = [784, 880, 988, 1175, 1319, 1568, 1760, 1976];
  // Optional: put correct.mp3 and strike.mp3 in the repo root to replace the built-in synth sounds.
  var sfx = { correct: null, strike: null };
  function playFile(name) {
    var a = sfx[name];
    if (!a) return false;
    if (!S.mute) { try { a.currentTime = 0; var p = a.play(); if (p && p.catch) p.catch(function () {}); } catch (e) { /* ignore */ } }
    return true;
  }
  // Bright bell "ding-ding" that climbs a step for each answer revealed
  function ding(n) {
    if (playFile('correct')) return;
    var f = PENT[Math.min(n, 7)];
    tone(f, 0, 0.7, 'sine', 0.22); tone(f * 2.005, 0, 0.4, 'sine', 0.1); tone(f * 3, 0, 0.2, 'sine', 0.05);
    tone(f * 1.5, 0.09, 0.6, 'sine', 0.15); tone(f * 3.01, 0.09, 0.3, 'sine', 0.05);
  }
  // Low, harsh game-show buzzer with a thump on the front
  function buzz() {
    duck(1000);
    if (playFile('strike')) return;
    tone(70, 0, 0.18, 'sine', 0.3);
    tone(110, 0, 0.9, 'sawtooth', 0.2); tone(114, 0, 0.9, 'square', 0.1); tone(220, 0, 0.5, 'sawtooth', 0.06);
  }
  function fanfare() { duck(1500); [523, 659, 784, 1047, 1319].forEach(function (f, i) { tone(f, i * 0.09, 0.35, 'triangle', 0.18); }); }
  function tick() { tone(1000, 0, 0.05, 'square', 0.06); }
  function jingle() {
    [[523, 0], [659, 0.16], [784, 0.32], [880, 0.48], [784, 0.7], [659, 0.86], [784, 1.02, 0.5], [1047, 1.3, 0.7]].forEach(function (n) {
      tone(n[0], n[1], n[2] || 0.18, 'triangle', 0.16);
    });
  }


  /* ---------------- Background music ---------------- */
  // Original, gentle "autumn music box" pieces generated from simple chord patterns (no recordings, nothing copyrighted).
  // Add a licensed music.mp3 to the repo root to use a real recording instead.
  var NOTE_BASE = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
  function hz(n) {
    var m = /^([A-G])(#|b)?(\d)$/.exec(n);
    if (!m) return 0;
    var midi = 12 * (+m[3] + 1) + NOTE_BASE[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0);
    return 440 * Math.pow(2, (midi - 69) / 12);
  }
  var CHORDS = {
    C: ['C3', 'E4', 'G4', 'C5', 'E5'], Am: ['A3', 'C4', 'E4', 'A4', 'C5'], F: ['F3', 'A3', 'C4', 'F4', 'A4'],
    G: ['G3', 'B3', 'D4', 'G4', 'B4'], Dm: ['D3', 'F3', 'A3', 'D4', 'F4']
  };
  var PATTERN = [0, 2, 3, 4, 3, 2, 3, 1];
  var SONGS = [
    { name: 'Harvest Breeze', bpm: 80, prog: ['C', 'Am', 'F', 'G', 'C', 'Am', 'F', 'G'] },
    { name: 'Cider by the Fire', bpm: 76, prog: ['Am', 'F', 'C', 'G', 'Am', 'F', 'C', 'G'] },
    { name: 'Maple Lane', bpm: 84, prog: ['F', 'C', 'G', 'Am', 'F', 'C', 'Dm', 'G'] }
  ];
  function buildSong(def) {
    var seq = [];
    def.prog.forEach(function (name) {
      var c = CHORDS[name];
      PATTERN.forEach(function (idx, i) {
        var j = idx;
        if (i > 0 && Math.random() < 0.2) j = 1 + Math.floor(Math.random() * 4);
        if (i > 0 && Math.random() < 0.08) seq.push([0, 0.5]);
        else seq.push([hz(c[j]), 0.5]);
      });
    });
    seq.push([0, 2]);
    return { name: def.name, bpm: def.bpm, seq: seq };
  }

  var music = { on: false, gain: null, timer: null, t: 0, song: null, ni: 0, order: [], oi: 0, audio: null, fileMode: false, last: -1 };
  var userStarted = false, introStart = false;

  function musicLevel() { return Math.pow(S.musicVol / 100, 2) * 0.5; }
  function fileLevel() { return Math.pow(S.musicVol / 100, 2) * 0.7; }
  function musicNode() {
    var c = ctx(); if (!c) return null;
    if (!music.gain) { music.gain = c.createGain(); music.gain.gain.value = musicLevel(); music.gain.connect(c.destination); }
    return music.gain;
  }
  function pluck(f, when) {
    [[f, 'sine', 0.5, 1.6], [f * 2, 'triangle', 0.14, 0.6], [f * 4, 'sine', 0.05, 0.3]].forEach(function (p) {
      var o = ac.createOscillator(), g = ac.createGain();
      o.type = p[1]; o.frequency.value = p[0];
      g.gain.setValueAtTime(0.0001, when);
      g.gain.linearRampToValueAtTime(p[2], when + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, when + p[3]);
      o.connect(g); g.connect(music.gain);
      o.start(when); o.stop(when + p[3] + 0.05);
    });
  }
  function nextSong() {
    if (music.oi >= music.order.length) {
      var o = SONGS.map(function (_, i) { return i; });
      for (var i = o.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)), t = o[i]; o[i] = o[j]; o[j] = t; }
      if (o[0] === music.last && o.length > 1) { var s = o[0]; o[0] = o[1]; o[1] = s; }
      music.order = o; music.oi = 0;
    }
    music.last = music.order[music.oi++];
    music.song = buildSong(SONGS[music.last]); music.ni = 0;
    renderMusic();
  }
  function schedule() {
    if (!music.on || !ac) return;
    while (music.t < ac.currentTime + 0.4) {
      if (!music.song || music.ni >= music.song.seq.length) nextSong();
      var n = music.song.seq[music.ni++], beat = 60 / music.song.bpm;
      if (music.t < ac.currentTime) music.t = ac.currentTime + 0.05;
      if (n[0]) pluck(n[0], music.t);
      music.t += n[1] * beat;
    }
  }
  function startSynth() {
    if (music.on) return;
    var c = ctx(); if (!c || !musicNode()) return;
    music.on = true; music.song = null; music.t = c.currentTime + 0.2;
    schedule(); music.timer = setInterval(schedule, 120);
  }
  function stopSynth() { if (music.timer) clearInterval(music.timer); music.timer = null; music.on = false; music.song = null; }
  function startFile() {
    if (!music.audio) { music.audio = new Audio('music.mp3'); music.audio.loop = true; }
    music.audio.volume = fileLevel();
    var p = music.audio.play(); if (p && p.catch) p.catch(function () {});
  }
  function stopFile() { if (music.audio) music.audio.pause(); }
  function syncMusic() {
    var want = userStarted && S.music && !S.mute && !document.hidden;
    if (!want) { stopSynth(); stopFile(); }
    else if (music.fileMode) { stopSynth(); startFile(); }
    else { stopFile(); startSynth(); }
    renderMusic();
  }
  function setVolume() {
    if (music.gain && ac) music.gain.gain.setTargetAtTime(musicLevel(), ac.currentTime, 0.05);
    if (music.audio) music.audio.volume = fileLevel();
  }
  function duck(ms) {
    if (music.gain && ac && music.on) {
      var g = music.gain.gain, t = ac.currentTime;
      g.cancelScheduledValues(t);
      g.setTargetAtTime(musicLevel() * 0.25, t, 0.05);
      g.setTargetAtTime(musicLevel(), t + ms / 1000, 0.25);
    }
    if (music.audio && !music.audio.paused) {
      music.audio.volume = fileLevel() * 0.25;
      setTimeout(function () { if (music.audio) music.audio.volume = fileLevel(); }, ms);
    }
  }
  function renderMusic() {
    var b = $('music'), playing = music.on || (music.audio && !music.audio.paused);
    var label = !S.music ? '🎵 Music off' : S.mute ? '🎵 Music muted' : (playing && music.song && !music.fileMode) ? '🎵 ' + music.song.name : '🎵 Music on';
    b.textContent = label;
    b.setAttribute('aria-pressed', S.music ? 'true' : 'false');
    $('vol').value = S.musicVol;
  }
  function toggleMusic() { S.music = !S.music; save(); userStarted = true; ctx(); syncMusic(); }

  /* ---------------- Little effects ---------------- */
  var toastT;
  function toast(msg) {
    var t = $('toast'); t.textContent = msg; t.classList.add('show');
    clearTimeout(toastT); toastT = setTimeout(function () { t.classList.remove('show'); }, 2600);
  }
  function confetti(cols, n, parent) {
    if (reduce) return;
    var box = el('div', 'confetti'); box.setAttribute('aria-hidden', 'true');
    for (var i = 0; i < n; i++) {
      var p = el('i');
      p.style.cssText = 'left:' + (Math.random() * 100) + '%;background:' + cols[i % cols.length] +
        ';animation-duration:' + (2.2 + Math.random() * 2.2) + 's;animation-delay:' + (Math.random() * 0.6) + 's';
      box.appendChild(p);
    }
    (parent || document.body).appendChild(box);
    setTimeout(function () { box.remove(); }, 5500);
  }
  var RED_CONF = ['#E8590C', '#FFFFFF', '#F5B82E', '#7BA33A'];
  var GRN_CONF = ['#7BA33A', '#FFFFFF', '#F5B82E', '#E8590C'];
  var partyT;
  function lightsParty() {
    var l = $('lights'); l.classList.add('party');
    clearTimeout(partyT); partyT = setTimeout(function () { l.classList.remove('party'); }, 3500);
  }
  function snow(box, n) {
    var chars = ['🍂', '🍁', '🍃'], cols = ['#E8590C', '#F5B82E', '#7BA33A', '#C2410C'];
    for (var i = 0; i < n; i++) {
      var f = el('span', 'flake');
      f.style.cssText = 'left:' + (Math.random() * 92) + '%;font-size:' + (10 + Math.random() * 18) + 'px;--c:' + cols[i % cols.length] +
        ';animation-duration:' + (8 + Math.random() * 10) + 's;animation-delay:' + (-Math.random() * 18) + 's;opacity:' + (0.6 + Math.random() * 0.4);
      var s = el('i', '', chars[i % 3]);
      s.style.animationDuration = (2 + Math.random() * 3) + 's';
      s.style.animationDelay = (-Math.random() * 4) + 's';
      f.appendChild(s); box.appendChild(f);
    }
  }
  function buildLights() {
    var cols = ['#F76707', '#F5B82E', '#C2410C', '#7BA33A'];
    document.querySelectorAll('.lights').forEach(function (box) {
      var n = Math.max(8, Math.round(window.innerWidth / 34));
      box.innerHTML = '';
      for (var i = 0; i < n; i++) {
        var b = el('i');
        b.style.setProperty('--c', cols[i % 4]);
        b.style.animationDelay = ((i % 4) * 0.5) + 's';
        box.appendChild(b);
      }
    });
  }
  function buildTreeBulbs() {
    var g = $('treeBulbs'), NS = 'http://www.w3.org/2000/svg';
    [[226, 148, '#FFE066'], [240, 162, '#FFFFFF'], [264, 166, '#FF6B6B'], [276, 148, '#FFE066'], [252, 150, '#FFFFFF'],
     [236, 128, '#FF6B6B'], [266, 126, '#FFE066'], [250, 108, '#FFFFFF'], [244, 94, '#FF6B6B'], [258, 96, '#FFE066']].forEach(function (b, i) {
      var h = document.createElementNS(NS, 'circle');
      h.setAttribute('class', 'halo'); h.setAttribute('cx', b[0]); h.setAttribute('cy', b[1]); h.setAttribute('r', 10);
      h.style.setProperty('--c', b[2]); h.style.animationDelay = (i * 0.05) + 's';
      var c = document.createElementNS(NS, 'circle');
      c.setAttribute('class', 'bulb'); c.setAttribute('cx', b[0]); c.setAttribute('cy', b[1]); c.setAttribute('r', 4.6);
      c.style.setProperty('--c', b[2]); c.style.animationDelay = (i * 0.05) + 's';
      g.appendChild(h); g.appendChild(c);
    });
  }

  /* ---------------- Rendering ---------------- */
  var shown = [null, null];
  function setScore(i, v) {
    var e = $('t' + i + 's');
    if (shown[i] === null || shown[i] === v || reduce) { e.textContent = v; shown[i] = v; return; }
    var from = shown[i], t0 = performance.now(), dur = 900;
    shown[i] = v;
    (function step(t) {
      var k = Math.min(1, (t - t0) / dur);
      e.textContent = Math.round(from + (v - from) * k);
      if (k < 1) requestAnimationFrame(step); else e.textContent = v;
    })(t0);
  }
  function renderScores() {
    var p = pot(), q = curQ(), has = q && sorted(q).length;
    for (var i = 0; i < 2; i++) {
      $('t' + i + 'n').textContent = S.teams[i].name;
      setScore(i, S.teams[i].score);
      $('aw' + i).textContent = 'Award to ' + S.teams[i].name;
      $('aw' + i).disabled = R.awarded || p === 0;
      $('c' + i).textContent = S.teams[i].name;
      $('c' + i).className = R.control === i ? 'on' : '';
      $('c' + i).setAttribute('aria-pressed', R.control === i ? 'true' : 'false');
      $('t' + i).classList.toggle('has-control', R.control === i);
    }
    $('pot').textContent = p;
    $('multBadge').textContent = mult() > 1 ? '×' + mult() : '';
    $('mult').disabled = R.awarded;
    $('strikeBtn').disabled = !has || R.awarded;
    $('undoStrike').disabled = !(R.strikes > 0 || R.stealFailed);
    $('revealAll').disabled = !has;
  }
  function renderStrikes() {
    var s = $('strikes'); s.innerHTML = '';
    for (var i = 0; i < 3; i++) s.appendChild(el('span', 'sslot' + (i < R.strikes ? ' on' : ''), '✕'));
    s.setAttribute('aria-label', R.strikes + ' strikes');
  }
  function renderStatus() {
    var q = curQ(), ans = sorted(q), msg = '', cls = '';
    function nm(i) { return S.teams[i].name; }
    if (!q) { msg = 'Open Set up questions and tick the questions you want in tonight’s game.'; cls = 'warn'; }
    else if (!ans.length) { msg = 'This question has no answers yet. Open Set up questions to enter your survey results.'; cls = 'warn'; }
    else if (R.awarded) { msg = 'Points awarded! Hit Next question when you’re ready.'; cls = 'good'; }
    else if (R.revealed.size === ans.length) { msg = 'Board cleared! Award the points to the winning team.'; cls = 'good'; }
    else if (R.strikes >= 3 && R.control !== null) {
      var o = 1 - R.control;
      msg = R.stealFailed
        ? 'Steal missed! ' + nm(R.control) + ' keeps the points. Award the round to ' + nm(R.control) + '.'
        : 'Three strikes! ' + nm(o) + ' gets one chance to steal. A right answer wins ' + nm(o) + ' the points; a miss lets ' + nm(R.control) + ' keep them.';
      cls = 'warn';
    }
    else if (R.strikes >= 3) { msg = 'Three strikes! Pick which team was in control so the other team can steal.'; cls = 'warn'; }
    else if (R.control === null) { msg = 'Face-off! Whoever rings in first goes first. Pick the team in control.'; }
    else { msg = nm(R.control) + ' is in control. Click an answer to reveal it, or press Strike for a miss.'; }
    $('status').textContent = msg;
    $('status').className = 'status ' + cls;
  }
  function renderBoard() {
    var q = curQ(), ans = sorted(q), grid = $('grid'), n = deck().length;
    $('question').textContent = q ? (q.q || 'Untitled question') : 'No questions in the game yet';
    $('qcat').textContent = q ? q.cat : '';
    $('qnum').textContent = n ? 'Question ' + (S.cur + 1) + ' of ' + n : '';
    grid.innerHTML = '';
    if (!ans.length) {
      grid.appendChild(el('div', 'empty-note', q
        ? 'No answers yet. Open Set up questions and enter your survey results.'
        : 'Open Set up questions and tick the questions you want in the game.'));
      renderStrikes();
      return;
    }
    grid.style.setProperty('--rows', Math.ceil(ans.length / 2));
    ans.forEach(function (a, i) {
      var tile = el('div', 'tile' + (R.shown.has(i) ? ' on' : '') + (R.shown.has(i) && !R.revealed.has(i) ? ' missed' : ''));
      tile.innerHTML = '<div class="face"><div class="side front"><span class="slot"></span></div>' +
        '<div class="side back"><span class="ans"></span><span class="pts"></span></div></div><button class="hit"></button>';
      tile.querySelector('.slot').textContent = i + 1;
      tile.querySelector('.ans').textContent = a.t;
      tile.querySelector('.pts').textContent = +a.p || 0;
      var hit = tile.querySelector('.hit');
      hit.setAttribute('aria-label', R.shown.has(i) ? 'Answer ' + (i + 1) + ': ' + a.t + ', ' + (+a.p || 0) + ' points' : 'Reveal answer ' + (i + 1));
      hit.addEventListener('click', function () { reveal(i); });
      grid.appendChild(tile);
    });
    renderStrikes();
  }
  function renderJump() {
    var d = deck(), j = $('jump');
    j.innerHTML = '';
    d.forEach(function (q, i) { j.appendChild(new Option((i + 1) + '. ' + trunc(q.q, 48), String(i))); });
    j.value = String(S.cur);
    j.disabled = !d.length;
    $('prev').disabled = S.cur <= 0;
    $('next').disabled = S.cur >= d.length - 1;
    $('deckCount').textContent = d.length + ' question' + (d.length === 1 ? '' : 's') + ' in tonight’s game.';
  }
  function renderAll() { renderBoard(); renderScores(); renderStatus(); renderJump(); }

  /* ---------------- Game actions ---------------- */
  function reveal(i) {
    var a = sorted(curQ())[i];
    if (!a || R.shown.has(i) || R.awarded) return;
    R.revealed.add(i); R.shown.add(i);
    ding(R.revealed.size - 1);
    var tile = $('grid').children[i];
    if (tile) {
      tile.classList.add('on');
      tile.querySelector('.hit').setAttribute('aria-label', 'Answer ' + (i + 1) + ': ' + a.t + ', ' + (+a.p || 0) + ' points');
    }
    renderScores(); renderStatus();
  }
  var xTimer;
  function showBigX(n) {
    var bx = $('bigx'); bx.innerHTML = '';
    for (var i = 0; i < n; i++) bx.appendChild(el('span', '', '✕'));
    bx.classList.add('show');
    clearTimeout(xTimer); xTimer = setTimeout(function () { bx.classList.remove('show'); }, 1100);
  }
  function strike() {
    var q = curQ();
    if (!q || !sorted(q).length || R.awarded) return;
    var wasFull = R.strikes >= 3;
    if (wasFull) R.stealFailed = true; else R.strikes++;
    buzz();
    showBigX(wasFull ? 1 : R.strikes);
    renderStrikes(); renderScores(); renderStatus();
  }
  function undoStrike() {
    if (R.stealFailed) R.stealFailed = false;
    else if (R.strikes > 0) R.strikes--;
    renderStrikes(); renderScores(); renderStatus();
  }
  function setControl(c) {
    R.control = R.control === c ? null : c;
    renderScores(); renderStatus();
  }
  function awardTo(t) {
    var p = pot();
    if (R.awarded || !p) return;
    R.awardedPot = p; R.awarded = true;
    S.teams[t].score += p; save();
    fanfare(); lightsParty();
    toast('🎁 +' + p + ' for ' + S.teams[t].name + '!');
    confetti(t === 0 ? RED_CONF : GRN_CONF, 70);
    var card = $('t' + t); card.classList.add('flash');
    setTimeout(function () { card.classList.remove('flash'); }, 1000);
    renderScores(); renderStatus();
  }
  function go(d) {
    var n = S.cur + d;
    if (n < 0 || n >= deck().length) return;
    S.cur = n; save(); newRound(); $('mult').value = '1'; renderAll();
  }
  function revealAll() {
    var ans = sorted(curQ());
    ans.forEach(function (a, i) {
      if (R.shown.has(i)) return;
      R.shown.add(i);
      var tile = $('grid').children[i];
      if (tile) {
        tile.classList.add('missed', 'on');
        tile.querySelector('.hit').setAttribute('aria-label', 'Answer ' + (i + 1) + ': ' + a.t + ', ' + (+a.p || 0) + ' points');
      }
    });
    ding(2);
  }
  function restartQuestion() { newRound(); $('mult').value = '1'; renderAll(); }

  function finish() {
    var a = S.teams[0], b = S.teams[1], w = $('win');
    var title, note, who;
    if (a.score === b.score) { title = 'It’s a tie!'; note = 'Both teams are tied. Time for a tie-breaker question!'; who = 'tie'; }
    else {
      var win = a.score > b.score ? a : b;
      who = a.score > b.score ? 0 : 1;
      title = win.name + ' wins!'; note = 'Happy Thanksgiving, everybody, and thanks for playing.';
    }
    $('winTitle').textContent = title;
    $('winScores').textContent = a.name + ' ' + a.score + '  ·  ' + b.name + ' ' + b.score;
    $('winNote').textContent = note;
    w.showModal(); fanfare(); lightsParty();
    confetti(who === 1 ? GRN_CONF : RED_CONF, 120, w);
  }
  function newGame() {
    if (!confirm('Start a new game? Both scores go back to 0 and you return to question 1.')) return;
    S.teams.forEach(function (t) { t.score = 0; });
    S.cur = 0; S.fm = blankFm(); save(); newRound(); $('mult').value = '1';
    $('win').close(); renderAll();
  }

  function toggleFs() {
    var e = document.documentElement;
    if (!document.fullscreenElement && !document.webkitFullscreenElement) { (e.requestFullscreen || e.webkitRequestFullscreen || function () {}).call(e); }
    else { (document.exitFullscreen || document.webkitExitFullscreen || function () {}).call(document); }
  }
  function renderMute() {
    $('mute').textContent = S.mute ? '🔇 Sound off' : '🔊 Sound on';
    $('mute').setAttribute('aria-pressed', S.mute ? 'true' : 'false');
  }
  function toggleMute() { S.mute = !S.mute; save(); renderMute(); syncMusic(); if (!S.mute) ding(1); }

  /* ---------------- Question editor ---------------- */
  var edI = 0;
  function renderList() {
    var ul = $('qlist'); ul.innerHTML = '';
    var cats = [];
    S.questions.forEach(function (q, i) {
      if (cats.indexOf(q.cat) < 0) cats.push(q.cat);
      var li = el('li', 'qrow');
      var cb = document.createElement('input');
      cb.type = 'checkbox'; cb.checked = q.use;
      cb.setAttribute('aria-label', 'Use question ' + (i + 1) + ' in the game');
      cb.onchange = function () { q.use = cb.checked; save(); updateCount(); if (i === edI) $('edUse').checked = q.use; };
      var b = el('button', i === edI ? 'cur' : '');
      b.type = 'button';
      b.textContent = (i + 1) + '. ' + (q.q || 'Untitled question');
      var n = q.a.filter(function (x) { return x.t && x.t.trim(); }).length;
      b.appendChild(el('span', 'cnt', n ? n + ' answers' : 'No answers yet'));
      b.onclick = function () { edI = i; renderEditor(); };
      li.appendChild(cb); li.appendChild(b); ul.appendChild(li);
    });
    var dl = $('cats'); dl.innerHTML = '';
    CATS.concat(cats.filter(function (c) { return CATS.indexOf(c) < 0; })).forEach(function (c) { dl.appendChild(new Option(c)); });
    updateCount();
  }
  function updateCount() {
    $('edCount').textContent = deck().length + ' of ' + S.questions.length + ' questions are in the game.';
  }
  function renderEditor() {
    var q = S.questions[edI];
    $('edQ').value = q.q; $('edCat').value = q.cat; $('edUse').checked = q.use;
    while (q.a.length < 8) q.a.push({ t: '', p: '' });
    var ar = $('arows');
    ar.innerHTML = '<span></span><span class="h">Answer</span><span class="h">Points</span>';
    q.a.slice(0, 8).forEach(function (row, i) {
      var n = el('span', 'n', i + 1);
      var t = document.createElement('input'); t.type = 'text'; t.value = row.t; t.setAttribute('aria-label', 'Answer ' + (i + 1));
      var p = document.createElement('input'); p.type = 'number'; p.min = '0'; p.value = row.p; p.setAttribute('aria-label', 'Points for answer ' + (i + 1));
      t.oninput = function () { row.t = t.value; save(); renderList(); };
      p.oninput = function () { row.p = p.value === '' ? '' : Math.max(0, +p.value); save(); };
      ar.append(n, t, p);
    });
    $('bulk').value = '';
    $('tn0').value = S.teams[0].name; $('tn1').value = S.teams[1].name;
    $('delQ').disabled = S.questions.length <= 1;
    renderList();
  }
  function parseBulk(text) {
    return text.split(/\r?\n/).map(function (l) { return l.trim(); }).filter(Boolean).map(function (l) {
      var m = l.match(/^(.*?\S)\s*(?:[,:;|\t]|\s[-–—]\s|\s)\s*(\d+)\s*(?:votes?|pts?|points?)?$/i);
      if (m) return { t: m[1].replace(/[\s,:;|\-–—]+$/, ''), p: +m[2] };
      return { t: l, p: 0 };
    }).filter(function (x) { return x.t; });
  }
  function exportBackup() {
    var blob = new Blob([JSON.stringify(S, null, 2)], { type: 'application/json' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = 'thanksgiving-feud-backup.json';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
  }
  function importBackup(file) {
    var r = new FileReader();
    r.onload = function () {
      var d = null;
      try { d = normalize(JSON.parse(r.result)); } catch (e) { d = null; }
      if (!d) { alert('That file isn’t a Thanksgiving Family Feud backup.'); return; }
      if (!confirm('Replace everything in this browser with the backup?')) return;
      S = d; if (S.cur >= deck().length) S.cur = 0;
      save(); edI = 0; renderEditor(); renderMute();
    };
    r.readAsText(file);
  }

  /* ---------------- Fast Money ---------------- */
  var FM_DUR = [20, 25], FM_GOAL = 200;
  var fmP = 0, timer = null, tLeft = 20, fmWon = false, chips = [];
  function withAnswers() { return S.questions.filter(function (q) { return sorted(q).length; }); }
  function qById(id) { return S.questions.filter(function (q) { return q.id === id; })[0] || null; }
  function fmSanitize() {
    var ok = {}; withAnswers().forEach(function (q) { ok[q.id] = true; });
    S.fm.q = S.fm.q.map(function (id) { return id && ok[id] ? id : null; });
    S.fm.pick = S.fm.pick.map(function (row) {
      return row.map(function (v, i) {
        var q = qById(S.fm.q[i]);
        return q && v >= 0 && v < sorted(q).length ? v : -1;
      });
    });
  }
  function fmAuto() {
    var pool = deck().filter(function (q) { return sorted(q).length; });
    var src = pool.length >= 5 ? pool : withAnswers();
    var pick = src.slice(-5);
    S.fm.q = [0, 1, 2, 3, 4].map(function (i) { return pick[i] ? pick[i].id : null; });
    S.fm.pick = [[-1, -1, -1, -1, -1], [-1, -1, -1, -1, -1]];
    save(); renderFm();
  }
  function fmPoints(p, i) {
    var q = qById(S.fm.q[i]); if (!q) return 0;
    var a = sorted(q)[S.fm.pick[p][i]];
    return a ? (+a.p || 0) : 0;
  }
  function renderFm() {
    var rows = $('fmRows'); rows.innerHTML = ''; chips = [];
    var opts = withAnswers();
    for (var i = 0; i < 5; i++) (function (i) {
      var row = el('div', 'fm-row');
      row.appendChild(el('span', 'fm-n', i + 1));
      var qs = document.createElement('select'); qs.setAttribute('aria-label', 'Question ' + (i + 1));
      qs.appendChild(new Option('Choose a question…', ''));
      opts.forEach(function (q) { qs.appendChild(new Option(trunc(q.q, 64), q.id)); });
      qs.value = S.fm.q[i] || '';
      qs.onchange = function () { S.fm.q[i] = qs.value || null; S.fm.pick[0][i] = -1; S.fm.pick[1][i] = -1; save(); renderFm(); };
      var q = qById(S.fm.q[i]);
      var as = document.createElement('select'); as.setAttribute('aria-label', 'Player ' + (fmP + 1) + ' answer ' + (i + 1));
      as.appendChild(new Option('No answer / not on the board', '-1'));
      if (q) sorted(q).forEach(function (a, k) { as.appendChild(new Option(a.t + ' (' + (+a.p || 0) + ')', String(k))); });
      as.disabled = !q; as.value = String(S.fm.pick[fmP][i]);
      as.onchange = function () { S.fm.pick[fmP][i] = +as.value; save(); renderFmTotals(false); };
      var chip = el('span', 'fm-pts'); chips.push(chip);
      row.appendChild(qs); row.appendChild(as); row.appendChild(chip);
      rows.appendChild(row);
    })(i);
    renderFmTotals(true);
  }
  function renderFmTotals(silent) {
    var t = [0, 1].map(function (p) { return [0, 1, 2, 3, 4].reduce(function (s, i) { return s + fmPoints(p, i); }, 0); });
    var total = t[0] + t[1];
    chips.forEach(function (c, i) { c.textContent = 'P1 ' + fmPoints(0, i) + ' · P2 ' + fmPoints(1, i); });
    $('fmP1').textContent = t[0]; $('fmP2').textContent = t[1]; $('fmTotal').textContent = total;
    $('fmBar').style.width = Math.min(100, total / FM_GOAL * 100) + '%';
    var msg = $('fmMsg');
    if (total >= FM_GOAL) {
      msg.textContent = '🎉 ' + total + ' points. That’s the jackpot!'; msg.className = 'fm-msg good';
      if (!fmWon && !silent) { fanfare(); confetti(RED_CONF, 90, $('fm')); }
      fmWon = true;
    } else {
      msg.textContent = (FM_GOAL - total) + ' more points to win'; msg.className = 'fm-msg'; fmWon = false;
    }
  }
  function timerShow() {
    var s = Math.max(0, Math.ceil(tLeft));
    $('timer').textContent = s;
    $('timer').classList.toggle('low', tLeft > 0 && tLeft <= 5);
  }
  function stopTimer() { clearInterval(timer); timer = null; }
  function timerReset() { stopTimer(); tLeft = FM_DUR[fmP]; timerShow(); $('tStart').textContent = 'Start timer'; }
  function timerStart() {
    stopTimer(); tLeft = FM_DUR[fmP];
    var end = Date.now() + tLeft * 1000, last = Math.ceil(tLeft);
    $('tStart').textContent = 'Restart timer';
    timer = setInterval(function () {
      tLeft = (end - Date.now()) / 1000;
      var s = Math.ceil(tLeft);
      if (s !== last) { last = s; if (s <= 5 && s > 0) tick(); }
      if (tLeft <= 0) { tLeft = 0; stopTimer(); buzz(); toast('⏰ Time’s up!'); }
      timerShow();
    }, 100);
    timerShow();
  }
  function openFm() {
    fmSanitize();
    if (!S.fm.q.some(Boolean)) fmAuto();
    fmP = 0; setPlayerButtons(); timerReset(); renderFm();
    $('fm').showModal();
  }
  function setPlayerButtons() {
    document.querySelectorAll('#fmPlayers button').forEach(function (b) { b.classList.toggle('on', +b.dataset.p === fmP); });
  }

  /* ---------------- Wiring ---------------- */
  $('strikeBtn').onclick = strike;
  $('undoStrike').onclick = undoStrike;
  $('aw0').onclick = function () { awardTo(0); };
  $('aw1').onclick = function () { awardTo(1); };
  $('c0').onclick = function () { setControl(0); };
  $('c1').onclick = function () { setControl(1); };
  $('mult').onchange = function () { renderScores(); };
  $('next').onclick = function () { go(1); };
  $('prev').onclick = function () { go(-1); };
  $('jump').onchange = function () { S.cur = +$('jump').value; save(); newRound(); $('mult').value = '1'; renderAll(); };
  $('revealAll').onclick = revealAll;
  $('resetRound').onclick = restartQuestion;
  $('finish').onclick = finish;
  $('fs').onclick = toggleFs;
  $('mute').onclick = toggleMute;
  $('music').onclick = toggleMusic;
  $('vol').oninput = function () { S.musicVol = +$('vol').value; save(); setVolume(); };
  document.addEventListener('visibilitychange', syncMusic);
  document.querySelectorAll('[data-adj]').forEach(function (b) {
    b.onclick = function () {
      var p = b.dataset.adj.split(',').map(Number);
      S.teams[p[0]].score = Math.max(0, S.teams[p[0]].score + p[1]); save(); renderScores();
    };
  });

  // Editor
  $('edQ').oninput = function () { S.questions[edI].q = $('edQ').value; save(); renderList(); };
  $('edCat').onchange = function () { S.questions[edI].cat = $('edCat').value.trim() || 'Custom'; save(); renderList(); };
  $('edUse').onchange = function () { S.questions[edI].use = $('edUse').checked; save(); renderList(); };
  $('tn0').oninput = function () { S.teams[0].name = $('tn0').value || 'Team 1'; save(); };
  $('tn1').oninput = function () { S.teams[1].name = $('tn1').value || 'Team 2'; save(); };
  $('addQ').onclick = function () {
    S.questions.push({ id: 'u' + Date.now().toString(36), cat: 'Custom', q: '', use: true, a: [] });
    edI = S.questions.length - 1; save(); renderEditor(); $('edQ').focus();
  };
  $('delQ').onclick = function () {
    if (S.questions.length <= 1) return;
    if (!confirm('Delete this question?')) return;
    S.questions.splice(edI, 1); edI = Math.max(0, edI - 1); save(); renderEditor();
  };
  $('bulkGo').onclick = function () {
    var rows = parseBulk($('bulk').value);
    if (!rows.length) { toast('Paste at least one answer first.'); return; }
    rows.sort(function (a, b) { return b.p - a.p; });
    S.questions[edI].a = rows.slice(0, 8);
    save(); renderEditor();
    toast(rows.length > 8 ? 'Filled the top 8 of ' + rows.length + ' answers.' : 'Answers filled in.');
  };
  $('zero').onclick = function () {
    if (confirm('Reset both team scores to 0?')) { S.teams.forEach(function (t) { t.score = 0; }); save(); }
  };
  $('restore').onclick = function () {
    if (!confirm('Replace all questions and answers with the starter set? Your survey answers will be erased.')) return;
    var f = fresh(); S.questions = f.questions; S.cur = 0; S.fm = blankFm(); edI = 0; save(); renderEditor();
  };
  $('exportBtn').onclick = exportBackup;
  $('importBtn').onclick = function () { $('importFile').click(); };
  $('importFile').onchange = function () { if (this.files[0]) importBackup(this.files[0]); this.value = ''; };
  function openEditor() { edI = Math.min(Math.max(0, S.questions.indexOf(curQ())), S.questions.length - 1); renderEditor(); $('ed').showModal(); }
  $('openEd').onclick = openEditor;
  $('closeEd').onclick = function () { $('ed').close(); };
  $('closeEd2').onclick = function () { $('ed').close(); };
  $('ed').addEventListener('close', function () {
    S.questions.forEach(function (q) {
      q.a = q.a.filter(function (x) { return x.t && x.t.trim(); }).map(function (x) { return { t: x.t.trim(), p: +x.p || 0 }; });
    });
    if (S.cur >= deck().length) S.cur = Math.max(0, deck().length - 1);
    save(); newRound(); $('mult').value = '1'; renderAll(); renderMute();
  });

  // Fast Money
  $('openFm').onclick = openFm;
  $('closeFm').onclick = function () { $('fm').close(); };
  $('fm').addEventListener('close', stopTimer);
  $('fmAuto').onclick = fmAuto;
  $('tStart').onclick = timerStart;
  $('tReset').onclick = timerReset;
  document.querySelectorAll('#fmPlayers button').forEach(function (b) {
    b.onclick = function () { fmP = +b.dataset.p; setPlayerButtons(); timerReset(); renderFm(); };
  });

  // Winner
  $('winClose').onclick = function () { $('win').close(); };
  $('winNew').onclick = newGame;

  // Keyboard
  document.addEventListener('keydown', function (e) {
    if (!$('intro').hidden) return;
    if (document.querySelector('dialog[open]')) return;
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.target.matches('input,select,textarea')) return;
    var k = e.key;
    if (k >= '1' && k <= '8') reveal(+k - 1);
    else if (k === 'x' || k === 'X') strike();
    else if (k === 'ArrowRight') go(1);
    else if (k === 'ArrowLeft') go(-1);
    else if (k === 'f' || k === 'F') toggleFs();
    else if (k === 'm' || k === 'M') toggleMute();
  });

  /* ---------------- Start up ---------------- */
  snow($('snowL'), 22);
  snow($('snowR'), 22);
  buildTreeBulbs();
  buildLights();
  var rt;
  window.addEventListener('resize', function () { clearTimeout(rt); rt = setTimeout(buildLights, 200); });

  if (reduce) {
    // Freeze the cartoon at the "plugged in" moment instead of animating.
    document.querySelectorAll('svg animate').forEach(function (a) { a.remove(); });
    document.querySelectorAll('.cord').forEach(function (c) { c.setAttribute('d', 'M254 206 C 232 228 176 220 140 185'); });
  }

  // Welcome screen with its own copies of the turkey and the Pilgrim
  var art = $('introArt');
  var d1 = el('div', 'deer'); d1.appendChild(document.querySelector('.mast .deer svg').cloneNode(true));
  var d2 = el('div', 'scene'); d2.appendChild(document.querySelector('.mast .scene svg').cloneNode(true));
  art.appendChild(d1); art.appendChild(d2);
  snow($('introSnow'), 60);
  buildLights();

  // If dinto-logo.png (or .svg) is in the repo root, show the real logo on the hard hat instead of the text.
  function tryLogo(urls) {
    if (!urls.length || !window.Image) return;
    var img = new Image();
    img.onload = function () {
      document.querySelectorAll('.hat-logo-img').forEach(function (e) { e.setAttribute('href', urls[0]); e.style.visibility = 'visible'; });
      document.querySelectorAll('.hat-logo-text').forEach(function (e) { e.style.display = 'none'; });
    };
    img.onerror = function () { tryLogo(urls.slice(1)); };
    img.src = urls[0];
  }
  tryLogo(['dinto-logo.png', 'dinto-logo.svg']);

  function closeIntro() {
    var i = $('intro');
    i.classList.add('out');
    setTimeout(function () { i.hidden = true; }, 520);
    try { sessionStorage.setItem('tfeud-intro-seen', '1'); } catch (e) { /* ignore */ }
  }
  $('introGo').onclick = function () {
    ctx(); jingle(); closeIntro(); lightsParty();
    introStart = true;
    setTimeout(function () { userStarted = true; syncMusic(); }, 3000); // let the jingle finish first
  };
  $('introSetup').onclick = function () { ctx(); closeIntro(); openEditor(); userStarted = true; introStart = true; syncMusic(); };
  try { if (sessionStorage.getItem('tfeud-intro-seen')) $('intro').hidden = true; } catch (e) { /* ignore */ }

  // If the welcome screen was skipped (page reload), start music on the first click or key press.
  ['pointerdown', 'keydown'].forEach(function (ev) {
    document.addEventListener(ev, function once() {
      if (!$('intro').hidden || introStart) return;
      document.removeEventListener(ev, once);
      if (!userStarted) { userStarted = true; ctx(); syncMusic(); }
    });
  });
  // Use your own sound effects if the repo has correct.mp3 / strike.mp3 next to index.html
  if (window.fetch) {
    ['correct', 'strike'].forEach(function (name) {
      fetch(name + '.mp3', { method: 'HEAD' }).then(function (r) {
        var ct = r.headers.get('content-type') || '';
        if (r.ok && /audio|mpeg|octet-stream/i.test(ct)) { sfx[name] = new Audio(name + '.mp3'); sfx[name].preload = 'auto'; }
      }).catch(function () {});
    });
  }
  // Use a real recording if the repo has a music.mp3 next to index.html
  if (window.fetch) {
    fetch('music.mp3', { method: 'HEAD' }).then(function (r) {
      var ct = r.headers.get('content-type') || '';
      if (r.ok && /audio|mpeg|octet-stream/i.test(ct)) { music.fileMode = true; syncMusic(); }
    }).catch(function () {});
  }

  renderMute();
  renderMusic();
  renderAll();
  if (missing.length) {
    var warn = el('div', 'status warn', 'Some game files are out of date (missing: ' + missing.join(', ') + '). Upload index.html, styles.css and app.js together, then refresh the page.');
    warn.style.cssText = 'position:relative;z-index:70;margin:8px;text-align:center';
    document.body.insertBefore(warn, document.body.firstChild);
  }
  if (!$('intro').hidden) $('introGo').focus();
})();
