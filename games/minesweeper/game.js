/* Minesweeper. First dig is always safe (and opens an area). */
(function () {
  "use strict";
  var SIZES = { easy: { w: 9, h: 9, mines: 10 }, medium: { w: 16, h: 16, mines: 40 } };
  var HOLD_MS = 400;

  var $ = function (id) { return document.getElementById(id); };
  var boardEl = $("board"), statusEl = $("status");
  var sizeKey = "easy", W, H, MINES;
  var mine, open, flag, count, cells;
  var started, ended, t0, timer, tool = "dig";

  function idx(r, c) { return r * W + c; }
  function neighbours(i) {
    var r = Math.floor(i / W), c = i % W, out = [];
    for (var dr = -1; dr <= 1; dr++) for (var dc = -1; dc <= 1; dc++) {
      var rr = r + dr, cc = c + dc;
      if ((dr || dc) && rr >= 0 && cc >= 0 && rr < H && cc < W) out.push(idx(rr, cc));
    }
    return out;
  }
  function bestKey() { return "mines-best-" + sizeKey; }

  /* ---------- Setup ---------- */

  function layMines(safe) {
    var banned = new Set(neighbours(safe).concat(safe));
    var spots = [];
    for (var i = 0; i < W * H; i++) if (!banned.has(i)) spots.push(i);
    for (var j = spots.length - 1; j > 0; j--) {
      var k = Math.floor(Math.random() * (j + 1));
      var t = spots[j]; spots[j] = spots[k]; spots[k] = t;
    }
    spots.slice(0, MINES).forEach(function (s) { mine[s] = true; });
    for (var n = 0; n < W * H; n++) {
      count[n] = neighbours(n).filter(function (m) { return mine[m]; }).length;
    }
  }

  function reset() {
    var s = SIZES[sizeKey];
    W = s.w; H = s.h; MINES = s.mines;
    var total = W * H;
    mine = new Array(total).fill(false);
    open = new Array(total).fill(false);
    flag = new Array(total).fill(false);
    count = new Array(total).fill(0);
    started = false;
    ended = false;
    stopTimer();
    $("time").textContent = "0";
    var best = Game.getBest(bestKey());
    $("best").textContent = best ? best + "s" : "–";
    statusEl.textContent = "";
    boardEl.className = "board game-board " + sizeKey;
    boardEl.style.gridTemplateColumns = "repeat(" + W + ", 1fr)";
    boardEl.innerHTML = "";
    cells = [];
    for (var i = 0; i < total; i++) {
      var b = document.createElement("button");
      b.type = "button";
      b.className = "cell";
      b.dataset.i = i;
      boardEl.appendChild(b);
      cells.push(b);
    }
    paintCount();
  }

  /* ---------- Painting ---------- */

  function paint(i, delay) {
    var el = cells[i];
    el.className = "cell";
    el.textContent = "";
    el.style.animationDelay = "";
    if (!open[i]) {
      if (flag[i]) { el.classList.add("flag"); el.textContent = "⚑"; el.setAttribute("aria-label", "Flagged"); }
      else el.removeAttribute("aria-label");
      return;
    }
    el.classList.add("open");
    if (delay) el.style.animationDelay = delay + "ms";
    if (mine[i]) { el.classList.add("mine"); el.textContent = "●"; return; }
    if (count[i]) { el.textContent = count[i]; el.classList.add("n" + count[i]); }
    el.setAttribute("aria-label", count[i] ? count[i] + " nearby" : "Empty");
  }
  function paintCount() {
    $("left").textContent = MINES - flag.filter(Boolean).length;
  }

  /* ---------- Rules ---------- */

  // Open a cell; empty cells spread outward. Returns false if it was a mine.
  function reveal(start) {
    var queue = [[start, 0]], seen = new Set([start]), n = 0;
    while (queue.length) {
      var item = queue.shift(), i = item[0];
      if (open[i] || flag[i]) continue;
      open[i] = true;
      paint(i, Math.min(item[1] * 22, 400));
      n++;
      if (mine[i]) return false;
      if (count[i] === 0) {
        neighbours(i).forEach(function (m) {
          if (!seen.has(m)) { seen.add(m); queue.push([m, item[1] + 1]); }
        });
      }
    }
    if (n > 1) Game.tone(520, 0.12, "sine", 0.05, 820);
    else Game.tone(440, 0.04, "sine", 0.04);
    return true;
  }

  function dig(i) {
    if (flag[i]) return;
    if (!started) {
      layMines(i);
      started = true;
      t0 = Date.now();
      timer = setInterval(function () { $("time").textContent = Math.floor((Date.now() - t0) / 1000); }, 250);
    }
    if (open[i]) return chord(i);
    if (!reveal(i)) return lose(i);
    checkWin();
  }

  // Clicking an open number whose flags are all placed opens the rest of its neighbours.
  function chord(i) {
    if (!count[i]) return;
    var around = neighbours(i);
    var flags = around.filter(function (m) { return flag[m]; }).length;
    if (flags !== count[i]) { Game.play("deny"); return; }
    for (var k = 0; k < around.length; k++) {
      var m = around[k];
      if (!open[m] && !flag[m] && !reveal(m)) return lose(m);
    }
    checkWin();
  }

  function toggleFlag(i) {
    if (open[i] || ended) return;
    flag[i] = !flag[i];
    paint(i);
    paintCount();
    Game.tone(flag[i] ? 300 : 200, 0.06, "triangle", 0.07);
    if (navigator.vibrate) navigator.vibrate(12);
  }

  function checkWin() {
    var closed = open.filter(function (o) { return !o; }).length;
    if (closed !== MINES) return;
    ended = true;
    stopTimer();
    var secs = Math.max(1, Math.round((Date.now() - t0) / 1000));
    $("time").textContent = secs;
    for (var i = 0; i < mine.length; i++) if (mine[i] && !flag[i]) { flag[i] = true; paint(i); }
    paintCount();
    var best = Game.getBest(bestKey());
    var record = !best || secs < best;
    // Lower is better here, so save directly rather than via Game.setBest.
    if (record) { window.toolspace.store.set(bestKey(), secs); $("best").textContent = secs + "s"; }
    boardEl.classList.add("won", "over");
    statusEl.textContent = "Cleared in " + secs + "s" + (record ? ", a new best!" : ".") + " Tap the board to play again.";
    Game.play("win");
  }

  function lose(hit) {
    ended = true;
    stopTimer();
    cells[hit].classList.add("hit");
    var others = [];
    for (var i = 0; i < mine.length; i++) {
      if (mine[i] && i !== hit && !flag[i]) others.push(i);
      if (flag[i] && !mine[i]) cells[i].classList.add("wrong");
    }
    others.forEach(function (m, n) { open[m] = true; paint(m, 60 + n * 30); });
    Game.tone(90, 0.4, "sawtooth", 0.14, 40);
    Game.shake(boardEl);
    boardEl.classList.add("over");
    statusEl.textContent = "Boom. Tap the board to try again.";
  }

  function stopTimer() { clearInterval(timer); timer = null; }

  /* ---------- Input: tap/click to dig, right-click or hold to flag ---------- */

  var holdTimer = null, held = false;
  boardEl.addEventListener("pointerdown", function (e) {
    var cell = e.target.closest(".cell");
    if (!cell || (e.pointerType === "mouse" && e.button !== 0)) return;
    held = false;
    holdTimer = setTimeout(function () {
      held = true;
      toggleFlag(+cell.dataset.i);
    }, HOLD_MS);
  });
  function cancelHold() { clearTimeout(holdTimer); holdTimer = null; }
  boardEl.addEventListener("pointerleave", cancelHold);
  boardEl.addEventListener("pointercancel", cancelHold);
  boardEl.addEventListener("pointerup", cancelHold);
  boardEl.addEventListener("click", function (e) {
    if (held) { held = false; return; }
    if (ended) return reset();
    var cell = e.target.closest(".cell");
    if (!cell) return;
    var i = +cell.dataset.i;
    if (tool === "flag" && !open[i]) toggleFlag(i);
    else dig(i);
  });
  boardEl.addEventListener("contextmenu", function (e) {
    e.preventDefault();
    var cell = e.target.closest(".cell");
    if (cell && !ended) toggleFlag(+cell.dataset.i);
  });

  function pressed(attr, value) {
    Array.prototype.forEach.call(document.querySelectorAll("[" + attr + "]"), function (b) {
      b.setAttribute("aria-pressed", String(b.getAttribute(attr) === value));
    });
  }
  Array.prototype.forEach.call(document.querySelectorAll("[data-size]"), function (b) {
    b.addEventListener("click", function () { sizeKey = b.getAttribute("data-size"); pressed("data-size", sizeKey); reset(); });
  });
  Array.prototype.forEach.call(document.querySelectorAll("[data-tool]"), function (b) {
    b.addEventListener("click", function () { tool = b.getAttribute("data-tool"); pressed("data-tool", tool); });
  });
  $("restart").addEventListener("click", reset);

  reset();
})();
