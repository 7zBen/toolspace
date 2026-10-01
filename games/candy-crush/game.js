/* Candy Crush: match-3 with striped, wrapped and colour-bomb specials, levels and a save. */
(function () {
  "use strict";
  var N = 7, KINDS = 5;
  var SAVE_KEY = "candy-save", BEST_KEY = "candy-best";
  var COLORS = ["#fb7185", "#6ea8ff", "#3dd68c", "#fde047", "#c084fc"];
  var HINT_AFTER = 6000;
  var ts = window.toolspace;

  var $ = function (id) { return document.getElementById(id); };
  var wrapEl = $("wrap"), boardEl = $("board"), piecesEl = $("pieces"), fxEl = $("fx"), overlay = $("overlay");
  var slots = [], els = {}, nextId = 1;
  var grid, level, score, moves, goal, busy = false, selected = null, ended = null, hintTimer = null;

  for (var i = 0; i < N * N; i++) {
    var s = document.createElement("div");
    s.className = "slot";
    s.dataset.i = i;
    boardEl.appendChild(s);
    slots.push(s);
  }

  function wait(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
  function idx(r, c) { return r * N + c; }
  function inside(r, c) { return r >= 0 && c >= 0 && r < N && c < N; }
  function candy(t) { return { t: t == null ? Math.floor(Math.random() * KINDS) : t, s: 0, id: nextId++ }; }
  function goalFor(lv) { return Math.round(900 + lv * 550); }
  function movesFor(lv) { return Math.max(16, 26 - Math.floor(lv / 2)); }

  /* ---------- Drawing pieces ---------- */

  function look(x) { return x.s === 4 ? "bomb" : x.t + ":" + x.s; }
  function styleEl(el, x) {
    if (el.dataset.look === look(x)) return;
    el.dataset.look = look(x);
    if (x.s === 4) { el.className = "candy s4"; el.innerHTML = '<i class="bomb"></i>'; return; }
    el.className = "candy t" + x.t + (x.s ? " s" + x.s : "");
    el.innerHTML = '<i class="gem"></i>' +
      (x.t === 0 ? '<i class="twist l"></i><i class="twist r"></i>' : "") +
      (x.s === 1 || x.s === 2 ? '<i class="stripes"></i>' : "") +
      (x.s === 3 ? '<i class="wrapper"></i>' : "");
  }
  function setPos(el, r, c, instant) {
    el.classList.toggle("instant", !!instant);
    el.style.setProperty("--r", r);
    el.style.setProperty("--c", c);
    if (instant) { void el.offsetWidth; el.classList.remove("instant"); }
  }

  // Make the DOM match the grid. New candies drop in from above their column.
  function sync(animate) {
    var seen = {}, dropFrom = {};
    for (var r = N - 1; r >= 0; r--) for (var c = 0; c < N; c++) {
      var x = grid[r][c];
      if (!x) continue;
      seen[x.id] = true;
      var el = els[x.id];
      if (!el) {
        el = document.createElement("div");
        els[x.id] = el;
        piecesEl.appendChild(el);
        styleEl(el, x);
        dropFrom[c] = (dropFrom[c] || 0) + 1;
        setPos(el, animate ? -dropFrom[c] : r, c, true);
        if (animate) { void el.offsetWidth; }
      } else {
        styleEl(el, x);
      }
      setPos(el, r, c, !animate);
    }
    Object.keys(els).forEach(function (id) {
      if (!seen[id] && !els[id].classList.contains("burst")) { els[id].remove(); delete els[id]; }
    });
    paintHud();
  }

  function paintHud() {
    $("level").textContent = level;
    $("score").textContent = score;
    $("moves").textContent = moves;
    $("goal-fill").style.width = Math.min(100, score / goal * 100) + "%";
    $("goal-text").textContent = score >= goal ? "Goal reached!" : (goal - score) + " to go · goal " + goal;
  }

  /* ---------- Effects ---------- */

  function center(r, c) {
    var a = slots[idx(r, c)].getBoundingClientRect(), w = wrapEl.getBoundingClientRect();
    return { x: a.left - w.left + a.width / 2, y: a.top - w.top + a.height / 2, size: a.width };
  }
  function beam(dir, r, c) {
    var p = center(r, c), first = center(0, 0), last = center(N - 1, N - 1);
    var b = document.createElement("div");
    b.className = "beam" + (dir === 2 ? " down" : "");
    if (dir === 1) { b.style.left = first.x - p.size / 2 + "px"; b.style.width = last.x - first.x + p.size + "px"; b.style.top = p.y - 3 + "px"; b.style.height = "6px"; }
    else { b.style.top = first.y - p.size / 2 + "px"; b.style.height = last.y - first.y + p.size + "px"; b.style.left = p.x - 3 + "px"; b.style.width = "6px"; }
    fxEl.appendChild(b);
    setTimeout(b.remove.bind(b), 300);
  }
  function ring(r, c) {
    var p = center(r, c), d = document.createElement("div");
    d.className = "ring";
    d.style.left = p.x - p.size / 2 + "px";
    d.style.top = p.y - p.size / 2 + "px";
    d.style.width = d.style.height = p.size + "px";
    fxEl.appendChild(d);
    setTimeout(d.remove.bind(d), 360);
  }
  function burst(r, c, pts) {
    var x = grid[r][c];
    if (!x) return;
    var el = els[x.id];
    if (el) {
      el.classList.add("burst");
      delete els[x.id];
      setTimeout(el.remove.bind(el), 230);
    }
    var p = center(r, c);
    Game.sparks(fxEl, p.x, p.y, { colors: [COLORS[x.t] || "#ffb020"], count: 6, dist: 26 });
    if (x.s === 1 || x.s === 2) beam(x.s, r, c);
    if (x.s === 3) ring(r, c);
    if (pts) Game.floatText(fxEl, p.x - 10, p.y - 10, "+" + pts);
  }

  /* ---------- Matching ---------- */

  function runs(g) {
    var out = [];
    for (var r = 0; r < N; r++) {
      var n = 1;
      for (var c = 1; c <= N; c++) {
        var same = c < N && g[r][c] && g[r][c - 1] && g[r][c].t >= 0 && g[r][c].t === g[r][c - 1].t;
        if (same) n++;
        else { if (n >= 3) out.push({ dir: "h", r: r, c0: c - n, n: n }); n = 1; }
      }
    }
    for (var cc = 0; cc < N; cc++) {
      var m = 1;
      for (var rr = 1; rr <= N; rr++) {
        var same2 = rr < N && g[rr][cc] && g[rr - 1][cc] && g[rr][cc].t >= 0 && g[rr][cc].t === g[rr - 1][cc].t;
        if (same2) m++;
        else { if (m >= 3) out.push({ dir: "v", c: cc, r0: rr - m, n: m }); m = 1; }
      }
    }
    return out;
  }
  function runCells(run) {
    var list = [];
    for (var k = 0; k < run.n; k++) list.push(run.dir === "h" ? idx(run.r, run.c0 + k) : idx(run.r0 + k, run.c));
    return list;
  }
  function hasMatch() { return runs(grid).length > 0; }

  function swap(a, b) {
    var t = grid[a.r][a.c];
    grid[a.r][a.c] = grid[b.r][b.c];
    grid[b.r][b.c] = t;
  }
  function wouldMatch(a, b) {
    var x = grid[a.r][a.c], y = grid[b.r][b.c];
    if (!x || !y) return false;
    if (x.s === 4 || y.s === 4 || (x.s && y.s)) return true;
    swap(a, b);
    var ok = hasMatch();
    swap(a, b);
    return ok;
  }
  function findMove() {
    for (var r = 0; r < N; r++) for (var c = 0; c < N; c++) {
      if (c + 1 < N && wouldMatch({ r: r, c: c }, { r: r, c: c + 1 })) return [{ r: r, c: c }, { r: r, c: c + 1 }];
      if (r + 1 < N && wouldMatch({ r: r, c: c }, { r: r + 1, c: c })) return [{ r: r, c: c }, { r: r + 1, c: c }];
    }
    return null;
  }

  function shuffle() {
    var pool = [];
    grid.forEach(function (row) { row.forEach(function (x) { pool.push(x); }); });
    for (var tries = 0; tries < 50; tries++) {
      for (var i = pool.length - 1; i > 0; i--) {
        var j = Math.floor(Math.random() * (i + 1));
        var t = pool[i]; pool[i] = pool[j]; pool[j] = t;
      }
      for (var k = 0; k < pool.length; k++) grid[Math.floor(k / N)][k % N] = pool[k];
      if (!hasMatch() && findMove()) return;
    }
  }

  function freshGrid() {
    grid = [];
    for (var r = 0; r < N; r++) {
      grid.push([]);
      for (var c = 0; c < N; c++) {
        var x;
        do { x = candy(); } while (
          (c >= 2 && grid[r][c - 1].t === x.t && grid[r][c - 2].t === x.t) ||
          (r >= 2 && grid[r - 1][c].t === x.t && grid[r - 2][c].t === x.t));
        grid[r].push(x);
      }
    }
    if (!findMove()) shuffle();
  }

  /* ---------- Specials ---------- */

  function add(set, r, c) { if (inside(r, c) && grid[r][c]) set.add(idx(r, c)); }
  function clearColour(set, t) {
    for (var r = 0; r < N; r++) for (var c = 0; c < N; c++) if (grid[r][c] && grid[r][c].t === t) set.add(idx(r, c));
  }
  function explode(set, fired, r, c) {
    var key = idx(r, c), x = grid[r][c];
    if (fired.has(key) || !x) return;
    fired.add(key);
    set.add(key);
    if (x.s === 1) for (var i = 0; i < N; i++) add(set, r, i);
    if (x.s === 2) for (var j = 0; j < N; j++) add(set, j, c);
    if (x.s === 3) for (var dr = -1; dr <= 1; dr++) for (var dc = -1; dc <= 1; dc++) add(set, r + dr, c + dc);
    if (x.s === 4) {
      var present = [];
      grid.forEach(function (row) { row.forEach(function (y) { if (y && y.t >= 0 && present.indexOf(y.t) < 0) present.push(y.t); }); });
      if (present.length) clearColour(set, present[Math.floor(Math.random() * present.length)]);
    }
  }
  // Swapping two specials, or a bomb with anything, fires immediately.
  function specialSwap(a, b, set, fired) {
    var x = grid[a.r][a.c], y = grid[b.r][b.c];
    if (x.s === 4 && y.s === 4) { for (var r = 0; r < N; r++) for (var c = 0; c < N; c++) add(set, r, c); return; }
    if (x.s === 4 || y.s === 4) {
      var other = x.s === 4 ? b : a, bomb = x.s === 4 ? a : b;
      add(set, bomb.r, bomb.c);
      fired.add(idx(bomb.r, bomb.c));
      clearColour(set, grid[other.r][other.c].t);
      if (grid[other.r][other.c].s) explode(set, fired, other.r, other.c);
      return;
    }
    if (x.s && y.s) { explode(set, fired, a.r, a.c); explode(set, fired, b.r, b.c); }
  }

  /* ---------- Resolving a move ---------- */

  function gravity() {
    for (var c = 0; c < N; c++) {
      var w = N - 1;
      for (var r = N - 1; r >= 0; r--) {
        if (grid[r][c]) { var x = grid[r][c]; grid[r][c] = null; grid[w][c] = x; w--; }
      }
      for (; w >= 0; w--) grid[w][c] = candy();
    }
  }

  async function cascade(move) {
    var combo = 0;
    for (var step = 0; step < 25; step++) {
      var set = new Set(), fired = new Set();
      if (step === 0 && move) specialSwap(move.a, move.b, set, fired);
      var found = runs(grid);
      if (!found.length && !set.size) break;
      found.forEach(function (run) { runCells(run).forEach(function (k) { set.add(k); }); });

      // Specials caught in the blast go off too, which can chain.
      var grew = true;
      while (grew) {
        grew = false;
        set.forEach(function (k) {
          var r = Math.floor(k / N), c = k % N;
          if (grid[r][c] && grid[r][c].s && !fired.has(k)) { explode(set, fired, r, c); grew = true; }
        });
      }

      // Decide whether this step creates a special: 5 in a row > L/T shape > 4 in a row.
      var spawn = null, hits = {};
      found.forEach(function (run) {
        runCells(run).forEach(function (k) { hits[k] = (hits[k] || 0) | (run.dir === "h" ? 1 : 2); });
      });
      found.forEach(function (run) {
        var cellsIn = runCells(run);
        if (run.n >= 5) spawn = { i: cellsIn[2], s: 4 };
        else if (run.n === 4 && !spawn) spawn = { i: cellsIn[1], s: run.dir === "h" ? 1 : 2 };
      });
      if (!spawn || spawn.s !== 4) {
        Object.keys(hits).forEach(function (k) { if (hits[k] === 3) spawn = { i: +k, s: 3 }; });
      }
      // On the player's move, the special appears where they moved the candy.
      if (spawn && step === 0 && move) {
        var moved = idx(move.b.r, move.b.c);
        if (hits[moved]) spawn.i = moved;
      }

      combo++;
      var pts = 60 * combo;
      score += set.size * pts + (spawn ? 200 : 0);
      Game.tone(380 + combo * 70, 0.08, "triangle", 0.08, 520 + combo * 80);

      var keep = spawn && set.has(spawn.i) ? spawn.i : -1;
      var labelAt = set.values().next().value; // show the step's points once
      set.forEach(function (k) { if (k !== keep) burst(Math.floor(k / N), k % N, k === labelAt ? pts * set.size : 0); });
      await wait(220);
      set.forEach(function (k) { if (k !== keep) grid[Math.floor(k / N)][k % N] = null; });
      var madeId = null;
      if (keep >= 0) {
        var kr = Math.floor(keep / N), kc = keep % N, old = grid[kr][kc];
        // A special takes the colour of the run that made it (bombs have no colour).
        grid[kr][kc] = { t: spawn.s === 4 ? -1 : old.t, s: spawn.s, id: old.id };
        madeId = old.id;
      }
      gravity();
      sync(true);
      if (madeId && els[madeId]) els[madeId].classList.add("morph");
      await wait(230);
      if (score >= goal) return;
    }
    if (!findMove()) {
      shuffle();
      sync(false);
      ts.toast("No moves left, shuffled");
    }
  }

  /* ---------- Playing ---------- */

  function select(p) {
    selected = p;
    slots.forEach(function (s, i) { s.classList.toggle("selected", !!p && i === idx(p.r, p.c)); });
  }

  async function trySwap(a, b) {
    if (busy || ended) return;
    if (Math.abs(a.r - b.r) + Math.abs(a.c - b.c) !== 1) { select(b); return; }
    busy = true;
    select(null);
    clearHint();
    var ok = wouldMatch(a, b);
    swap(a, b);
    sync(true);
    await wait(200);
    if (!ok) {
      Game.play("deny");
      swap(a, b);
      sync(true);
      await wait(200);
      busy = false;
      scheduleHint();
      return;
    }
    moves--;
    paintHud();
    await cascade({ a: a, b: b });
    busy = false;
    save();
    if (score >= goal) return finishLevel(true);
    if (moves <= 0) return finishLevel(false);
    scheduleHint();
  }

  function finishLevel(win) {
    ended = win ? "win" : "lose";
    clearHint();
    if (win) {
      Game.play("win");
      Game.setBest(BEST_KEY, level + 1);
      $("overlay-title").textContent = "Level " + level + " cleared";
      $("overlay-text").textContent = "Tap for level " + (level + 1);
    } else {
      Game.play("lose");
      $("overlay-title").textContent = "Out of moves";
      $("overlay-text").textContent = "Tap to try level " + level + " again";
    }
    overlay.classList.add("show");
    save();
  }

  function startLevel(lv) {
    level = lv;
    score = 0;
    goal = goalFor(level);
    moves = movesFor(level);
    ended = null;
    busy = false;
    select(null);
    overlay.classList.remove("show");
    piecesEl.innerHTML = "";
    fxEl.innerHTML = "";
    els = {};
    freshGrid();
    sync(false);
    save();
    scheduleHint();
  }

  /* ---------- Hint ---------- */

  function clearHint() {
    clearTimeout(hintTimer);
    slots.forEach(function (s) { s.classList.remove("hint"); });
  }
  function scheduleHint() {
    clearHint();
    hintTimer = setTimeout(function () {
      var m = !busy && !ended && findMove();
      if (m) m.forEach(function (p) { slots[idx(p.r, p.c)].classList.add("hint"); });
    }, HINT_AFTER);
  }

  /* ---------- Save / restore ---------- */

  function save() {
    ts.store.set(SAVE_KEY, {
      level: level, score: score, moves: moves, ended: ended,
      grid: grid.map(function (row) { return row.map(function (x) { return { t: x.t, s: x.s }; }); })
    });
  }
  function restore() {
    var s = ts.store.get(SAVE_KEY, null);
    var valid = s && Array.isArray(s.grid) && s.grid.length === N && s.grid.every(function (row) {
      return Array.isArray(row) && row.length === N && row.every(function (x) { return x && typeof x.t === "number"; });
    });
    if (!valid) return false;
    level = s.level || 1;
    score = s.score || 0;
    goal = goalFor(level);
    moves = typeof s.moves === "number" ? s.moves : movesFor(level);
    grid = s.grid.map(function (row) { return row.map(function (x) { return { t: x.t, s: x.s || 0, id: nextId++ }; }); });
    sync(false);
    // Older saves stored the end screen as text.
    var endState = s.ended || (s.over ? (/clear/.test(s.over) ? "win" : "lose") : null);
    if (endState) finishLevelQuiet(endState);
    else scheduleHint();
    return true;
  }
  function finishLevelQuiet(state) {
    ended = state;
    $("overlay-title").textContent = state === "win" ? "Level " + level + " cleared" : "Out of moves";
    $("overlay-text").textContent = state === "win" ? "Tap for level " + (level + 1) : "Tap to try level " + level + " again";
    overlay.classList.add("show");
  }

  /* ---------- Input: swipe or tap-tap ---------- */

  var press = null;
  function cellAt(e) {
    var s = document.elementFromPoint(e.clientX, e.clientY);
    s = s && s.closest(".slot");
    if (!s) return null;
    var i = +s.dataset.i;
    return { r: Math.floor(i / N), c: i % N };
  }
  wrapEl.addEventListener("pointerdown", function (e) {
    if (ended || busy) return;
    var p = cellAt(e);
    if (!p) return;
    e.preventDefault();
    press = { p: p, x: e.clientX, y: e.clientY, swiped: false };
  });
  window.addEventListener("pointermove", function (e) {
    if (!press || press.swiped) return;
    var dx = e.clientX - press.x, dy = e.clientY - press.y;
    var size = slots[0].getBoundingClientRect().width;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < size * 0.4) return;
    press.swiped = true;
    var to = Math.abs(dx) > Math.abs(dy) ? { r: press.p.r, c: press.p.c + (dx > 0 ? 1 : -1) } : { r: press.p.r + (dy > 0 ? 1 : -1), c: press.p.c };
    if (inside(to.r, to.c)) trySwap(press.p, to);
  });
  window.addEventListener("pointerup", function () {
    if (!press) return;
    var p = press.p, swiped = press.swiped;
    press = null;
    if (swiped) return;
    if (selected && (selected.r !== p.r || selected.c !== p.c)) trySwap(selected, p);
    else select(selected ? null : p);
  });
  window.addEventListener("pointercancel", function () { press = null; });

  overlay.addEventListener("click", function () {
    if (!ended) return;
    startLevel(ended === "win" ? level + 1 : level);
  });
  window.addEventListener("keydown", function (e) {
    if (ended && (e.key === "Enter" || e.code === "Space")) { e.preventDefault(); overlay.click(); }
  });
  $("restart").addEventListener("click", function () {
    if (level > 1 && !confirm("Start over from level 1?")) return;
    startLevel(1);
  });
  window.addEventListener("resize", function () { if (grid) sync(false); });

  if (!restore()) startLevel(1);
})();
