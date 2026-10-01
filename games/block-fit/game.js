/* Block Fit: place pieces on an 8×8 board; full rows and columns clear. */
(function () {
  "use strict";
  var SIZE = 8;
  var BEST_KEY = "block-fit-best";
  var COLORS = ["#4f8ff7", "#2fc07f", "#f5b52a", "#a46bf0", "#f0566f", "#22b8cf"];
  var SHAPES = [
    [[0, 0]], [[0, 0], [0, 1]], [[0, 0], [1, 0]],
    [[0, 0], [0, 1], [0, 2]], [[0, 0], [1, 0], [2, 0]],
    [[0, 0], [0, 1], [0, 2], [0, 3]], [[0, 0], [1, 0], [2, 0], [3, 0]],
    [[0, 0], [0, 1], [1, 0], [1, 1]],
    [[0, 0], [0, 1], [0, 2], [1, 0], [1, 1], [1, 2], [2, 0], [2, 1], [2, 2]],
    [[0, 0], [0, 1], [0, 2], [1, 2]], [[0, 0], [1, 0], [2, 0], [2, 1]],
    [[0, 0], [0, 1], [1, 0]], [[0, 0], [1, 0], [1, 1]], [[0, 1], [1, 0], [1, 1]], [[0, 0], [0, 1], [1, 1]],
    [[0, 0], [0, 1], [1, 1], [1, 2]], [[0, 1], [0, 2], [1, 0], [1, 1]],
    [[0, 0], [0, 1], [0, 2], [1, 1]], [[0, 1], [1, 0], [1, 1], [2, 1]],
    [[0, 0], [1, 0], [2, 0], [2, 1], [2, 2]], [[0, 0], [0, 1], [0, 2], [1, 0], [2, 0]]
  ];
  var TOUCH_LIFT = 80; // px the dragged piece floats above a finger

  var $ = function (id) { return document.getElementById(id); };
  var boardEl = $("board"), wrapEl = $("wrap"), trayEl = $("tray"), fxEl = $("fx"), overlay = $("overlay");
  var cells = [], grid, tray, score, combo, selected = -1, drag = null, over = false;

  for (var i = 0; i < SIZE * SIZE; i++) {
    var d = document.createElement("div");
    d.className = "cell";
    boardEl.appendChild(d);
    cells.push(d);
  }
  $("best").textContent = Game.getBest(BEST_KEY);

  /* ---------- Pieces ---------- */

  function randomPiece() {
    return { cells: SHAPES[Math.floor(Math.random() * SHAPES.length)], color: COLORS[Math.floor(Math.random() * COLORS.length)] };
  }
  function extent(p) {
    var h = 0, w = 0;
    p.cells.forEach(function (c) { h = Math.max(h, c[0] + 1); w = Math.max(w, c[1] + 1); });
    return { h: h, w: w };
  }
  function fits(p, r0, c0) {
    return p.cells.every(function (c) {
      var r = r0 + c[0], cc = c0 + c[1];
      return r >= 0 && cc >= 0 && r < SIZE && cc < SIZE && !grid[r][cc];
    });
  }
  function fitsAnywhere(p) {
    for (var r = 0; r < SIZE; r++) for (var c = 0; c < SIZE; c++) if (fits(p, r, c)) return true;
    return false;
  }
  // Deal three; retry a few times so at least one can be placed when that's possible at all.
  function deal() {
    var next;
    for (var tries = 0; tries < 60; tries++) {
      next = [randomPiece(), randomPiece(), randomPiece()];
      if (next.some(fitsAnywhere)) break;
    }
    tray = next;
  }

  function pieceHtml(p, px) {
    var e = extent(p), on = {};
    p.cells.forEach(function (c) { on[c[0] + "," + c[1]] = true; });
    var html = '<div class="piece" style="--block:' + p.color + ";--px:" + px + "px;grid-template-columns:repeat(" + e.w + ',auto)">';
    for (var r = 0; r < e.h; r++) for (var c = 0; c < e.w; c++) html += "<i" + (on[r + "," + c] ? ' class="on"' : "") + "></i>";
    return html + "</div>";
  }

  /* ---------- Painting ---------- */

  function paintBoard(preview) {
    for (var r = 0; r < SIZE; r++) for (var c = 0; c < SIZE; c++) {
      var el = cells[r * SIZE + c];
      if (el.classList.contains("clearing")) continue;
      el.className = "cell" + (grid[r][c] ? " on" : "");
      el.style.setProperty("--block", grid[r][c] || "");
    }
    if (!preview) return;
    var ok = fits(preview.piece, preview.r, preview.c);
    preview.piece.cells.forEach(function (pc) {
      var r = preview.r + pc[0], c = preview.c + pc[1];
      if (r < 0 || c < 0 || r >= SIZE || c >= SIZE) return;
      var el = cells[r * SIZE + c];
      if (ok) { el.classList.add("ghost"); el.style.setProperty("--block", preview.piece.color); }
      else if (!grid[r][c]) el.classList.add("bad");
    });
  }

  function paintTray() {
    trayEl.innerHTML = "";
    tray.forEach(function (p, idx) {
      var slot = document.createElement("div");
      slot.className = "slot" + (p ? "" : " empty") + (idx === selected ? " selected" : "") + (p && !fitsAnywhere(p) ? " stuck" : "");
      slot.dataset.idx = idx;
      if (p) slot.innerHTML = pieceHtml(p, 15);
      trayEl.appendChild(slot);
    });
  }

  function paintScore() {
    $("score").textContent = score;
    if (Game.setBest(BEST_KEY, score)) $("best").textContent = score;
  }

  /* ---------- Placing ---------- */

  function cellCenter(r, c) {
    var cr = cells[r * SIZE + c].getBoundingClientRect(), wr = wrapEl.getBoundingClientRect();
    return { x: cr.left - wr.left + cr.width / 2, y: cr.top - wr.top + cr.height / 2 };
  }

  function place(idx, r0, c0) {
    var p = tray[idx];
    if (!p || !fits(p, r0, c0)) { Game.play("deny"); return false; }
    p.cells.forEach(function (c) {
      grid[r0 + c[0]][c0 + c[1]] = p.color;
    });
    paintBoard();
    p.cells.forEach(function (c) { cells[(r0 + c[0]) * SIZE + c0 + c[1]].classList.add("placed"); });
    Game.tone(180, 0.08, "square", 0.08);
    score += p.cells.length;

    // Clear full rows and columns.
    var rows = [], cols = [];
    for (var r = 0; r < SIZE; r++) if (grid[r].every(Boolean)) rows.push(r);
    for (var c = 0; c < SIZE; c++) if (grid.every(function (row) { return row[c]; })) cols.push(c);
    var lines = rows.length + cols.length;
    if (lines) {
      combo++;
      var gained = lines * lines * 10 * combo;
      score += gained;
      var doomed = new Set();
      rows.forEach(function (r) { for (var c = 0; c < SIZE; c++) doomed.add(r * SIZE + c); });
      cols.forEach(function (c) { for (var r = 0; r < SIZE; r++) doomed.add(r * SIZE + c); });
      doomed.forEach(function (i) {
        var r = Math.floor(i / SIZE), c = i % SIZE, pt = cellCenter(r, c);
        Game.sparks(fxEl, pt.x, pt.y, { colors: [grid[r][c]], count: 5, dist: 26 });
        cells[i].classList.add("clearing");
        grid[r][c] = 0;
      });
      var mid = cellCenter(r0, c0);
      Game.floatText(fxEl, mid.x, mid.y - 10, "+" + gained + (combo > 1 ? " ×" + combo : ""));
      Game.tone(320 + lines * 50, 0.18, "square", 0.1, 700 + lines * 90);
      Game.shake(wrapEl);
      setTimeout(function () {
        cells.forEach(function (el) { el.classList.remove("clearing"); });
        paintBoard();
      }, 180);
    } else {
      combo = 0;
    }

    tray[idx] = null;
    selected = -1;
    if (tray.every(function (x) { return !x; })) deal();
    paintScore();
    paintTray();
    checkOver();
    return true;
  }

  function checkOver() {
    var live = tray.filter(Boolean);
    if (live.some(fitsAnywhere)) return;
    over = true;
    Game.play("lose");
    $("overlay-text").textContent = "Score " + score + ". Tap to play again.";
    overlay.classList.add("show");
  }

  /* ---------- Dragging ---------- */

  function boardMetrics() {
    var a = cells[0].getBoundingClientRect(), b = cells[1].getBoundingClientRect();
    return { left: a.left, top: a.top, size: a.width, step: b.left - a.left };
  }

  function startDrag(e, idx) {
    var p = tray[idx];
    if (!p || over) return;
    var m = boardMetrics();
    var slot = trayEl.children[idx];
    var pieceEl = slot.querySelector(".piece");
    var pr = pieceEl.getBoundingClientRect();
    var ext = extent(p);
    // Where in the piece was it grabbed, as a fraction, so the big copy is held at the same spot.
    var fx = (e.clientX - pr.left) / pr.width, fy = (e.clientY - pr.top) / pr.height;
    var el = document.createElement("div");
    el.className = "drag";
    el.innerHTML = pieceHtml(p, Math.round(m.size));
    document.body.appendChild(el);
    drag = {
      idx: idx, el: el, slot: slot, pointer: e.pointerId, moved: false,
      startX: e.clientX, startY: e.clientY,
      w: ext.w * m.step - (m.step - m.size), h: ext.h * m.step - (m.step - m.size),
      fx: Math.min(1, Math.max(0, fx)), fy: Math.min(1, Math.max(0, fy)),
      lift: e.pointerType === "touch" ? TOUCH_LIFT : 0
    };
    el.hidden = true;
    Game.tone(420, 0.05, "triangle", 0.06);
  }

  // Position the floating piece under the pointer and work out which board square its top-left is over.
  function dragTarget(d, e) {
    var m = boardMetrics();
    var left = e.clientX - d.fx * d.w, top = e.clientY - d.fy * d.h - d.lift;
    d.el.style.left = left + "px";
    d.el.style.top = top + "px";
    return { r: Math.round((top - m.top) / m.step), c: Math.round((left - m.left) / m.step) };
  }

  function moveDrag(e) {
    if (!drag || e.pointerId !== drag.pointer) return;
    if (!drag.moved && Math.hypot(e.clientX - drag.startX, e.clientY - drag.startY) < 6) return;
    if (!drag.moved) { drag.moved = true; drag.el.hidden = false; drag.slot.classList.add("dragging"); }
    var t = dragTarget(drag, e);
    paintBoard({ piece: tray[drag.idx], r: t.r, c: t.c });
  }

  function endDrag(e) {
    if (!drag || e.pointerId !== drag.pointer) return;
    var d = drag;
    drag = null;
    d.el.remove();
    d.slot.classList.remove("dragging");
    if (!d.moved) {
      // A tap selects the piece instead.
      selected = selected === d.idx ? -1 : d.idx;
      paintTray();
      return;
    }
    var t = dragTarget(d, e);
    if (!place(d.idx, t.r, t.c)) paintBoard();
  }

  function cancelDrag() {
    if (!drag) return;
    drag.el.remove();
    drag.slot.classList.remove("dragging");
    drag = null;
    paintBoard();
  }

  trayEl.addEventListener("pointerdown", function (e) {
    var slot = e.target.closest(".slot");
    if (!slot) return;
    e.preventDefault();
    startDrag(e, +slot.dataset.idx);
  });
  window.addEventListener("pointermove", moveDrag);
  window.addEventListener("pointerup", endDrag);
  window.addEventListener("pointercancel", cancelDrag);

  // Tap-to-place: with a piece selected, tapping a square puts the piece's top-left there.
  boardEl.addEventListener("click", function (e) {
    if (selected < 0) return;
    var i = cells.indexOf(e.target);
    if (i >= 0) place(selected, Math.floor(i / SIZE), i % SIZE);
  });
  boardEl.addEventListener("pointermove", function (e) {
    if (selected < 0 || drag || e.pointerType !== "mouse") return;
    var i = cells.indexOf(e.target);
    if (i >= 0) paintBoard({ piece: tray[selected], r: Math.floor(i / SIZE), c: i % SIZE });
  });
  boardEl.addEventListener("pointerleave", function () { if (!drag) paintBoard(); });

  /* ---------- Start ---------- */

  function reset() {
    grid = [];
    for (var r = 0; r < SIZE; r++) grid.push(new Array(SIZE).fill(0));
    score = 0;
    combo = 0;
    selected = -1;
    over = false;
    overlay.classList.remove("show");
    deal();
    paintScore();
    paintBoard();
    paintTray();
  }
  overlay.addEventListener("click", reset);
  $("restart").addEventListener("click", reset);
  reset();
})();
