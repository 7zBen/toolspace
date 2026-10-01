/* Slide: the 2048 puzzle. Tiles are DOM nodes positioned by --r/--c so moves animate. */
(function () {
  "use strict";
  var N = 4;
  var BEST_KEY = "slide-best";
  var DIRS = { left: [0, -1], right: [0, 1], up: [-1, 0], down: [1, 0] };
  var KEYS = { ArrowLeft: "left", ArrowRight: "right", ArrowUp: "up", ArrowDown: "down", a: "left", d: "right", w: "up", s: "down" };

  var $ = function (id) { return document.getElementById(id); };
  var layer = $("tiles"), overlay = $("overlay");
  var tiles = [], score = 0, busy = false, over = false, reached2048 = false;

  for (var i = 0; i < N * N; i++) $("slots").appendChild(document.createElement("i"));
  $("best").textContent = Game.getBest(BEST_KEY);

  /* ---------- Tiles ---------- */

  function paint(t) {
    t.el.textContent = t.v;
    t.el.className = "tile " + (t.v > 2048 ? "vmax" : "v" + t.v) + (t.v >= 1024 ? " huge" : t.v >= 128 ? " big" : "");
  }
  function moveEl(t) {
    t.el.style.setProperty("--r", t.r);
    t.el.style.setProperty("--c", t.c);
  }
  function at(r, c) {
    for (var i = 0; i < tiles.length; i++) if (tiles[i].r === r && tiles[i].c === c) return tiles[i];
    return null;
  }
  function empties() {
    var out = [];
    for (var r = 0; r < N; r++) for (var c = 0; c < N; c++) if (!at(r, c)) out.push([r, c]);
    return out;
  }
  function spawn(animate) {
    var spots = empties();
    if (!spots.length) return;
    var p = spots[Math.floor(Math.random() * spots.length)];
    var t = { v: Math.random() < 0.9 ? 2 : 4, r: p[0], c: p[1], el: document.createElement("div") };
    paint(t);
    if (animate) t.el.classList.add("new");
    moveEl(t);
    layer.appendChild(t.el);
    tiles.push(t);
  }
  function canMove() {
    if (empties().length) return true;
    for (var r = 0; r < N; r++) for (var c = 0; c < N; c++) {
      var t = at(r, c), right = at(r, c + 1), down = at(r + 1, c);
      if ((right && right.v === t.v) || (down && down.v === t.v)) return true;
    }
    return false;
  }

  /* ---------- Moves ---------- */

  function move(dir) {
    if (busy || over) return;
    var d = DIRS[dir];
    // Process tiles nearest the wall we're moving toward first.
    var order = tiles.slice().sort(function (a, b) { return (b.r - a.r) * d[0] + (b.c - a.c) * d[1]; });
    var grid = {}, mergedInto = new Set(), moved = false, gained = 0;

    order.forEach(function (t) {
      var r = t.r, c = t.c;
      for (;;) {
        var nr = r + d[0], nc = c + d[1];
        if (nr < 0 || nc < 0 || nr >= N || nc >= N) break;
        var hit = grid[nr + "," + nc];
        if (!hit) { r = nr; c = nc; continue; }
        if (hit.v === t.v && !mergedInto.has(hit)) {
          hit.v *= 2;
          gained += hit.v;
          mergedInto.add(hit);
          t.gone = true;
          r = nr; c = nc;
        }
        break;
      }
      if (r !== t.r || c !== t.c) moved = true;
      t.r = r; t.c = c;
      if (!t.gone) grid[r + "," + c] = t;
    });
    if (!moved) return;

    busy = true;
    score += gained;
    $("score").textContent = score;
    if (Game.setBest(BEST_KEY, score)) $("best").textContent = score;
    if (gained) Game.tone(280 + Math.log2(gained) * 22, 0.12, "square", 0.08, 520);
    else Game.tone(190, 0.05, "triangle", 0.05);

    tiles.forEach(moveEl);
    setTimeout(function () {
      tiles = tiles.filter(function (t) {
        if (t.gone) { t.el.remove(); return false; }
        return true;
      });
      mergedInto.forEach(function (t) {
        paint(t);
        t.el.classList.add("merged");
      });
      spawn(true);
      busy = false;
      if (!reached2048 && tiles.some(function (t) { return t.v >= 2048; })) {
        reached2048 = true;
        Game.play("win");
        window.toolspace.toast("2048! Keep going if you like.");
      }
      if (!canMove()) endGame();
    }, 115);
  }

  function endGame() {
    over = true;
    Game.play("lose");
    $("overlay-title").textContent = "Game over";
    $("overlay-text").textContent = "Score " + score + ". Tap to play again.";
    overlay.classList.add("show");
  }

  function reset() {
    tiles.forEach(function (t) { t.el.remove(); });
    tiles = [];
    score = 0;
    over = false;
    busy = false;
    reached2048 = false;
    $("score").textContent = 0;
    overlay.classList.remove("show");
    spawn(false);
    spawn(false);
  }

  /* ---------- Input ---------- */

  window.addEventListener("keydown", function (e) {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if (over && (e.key === "Enter" || e.code === "Space")) { e.preventDefault(); reset(); return; }
    var dir = KEYS[e.key] || KEYS[e.key.toLowerCase()];
    if (!dir) return;
    e.preventDefault();
    move(dir);
  });

  // Swipe with touch or mouse drag.
  var start = null;
  var board = $("board");
  board.addEventListener("pointerdown", function (e) { start = { x: e.clientX, y: e.clientY }; });
  window.addEventListener("pointerup", function (e) {
    if (!start) return;
    var dx = e.clientX - start.x, dy = e.clientY - start.y;
    start = null;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < 24) return;
    if (Math.abs(dx) > Math.abs(dy)) move(dx > 0 ? "right" : "left");
    else move(dy > 0 ? "down" : "up");
  });
  overlay.addEventListener("click", reset);
  $("restart").addEventListener("click", reset);

  reset();
})();
