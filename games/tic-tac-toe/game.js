/* Tic Tac Toe: two players on one device, or against a strong (but not perfect) computer. */
(function () {
  "use strict";
  var LINES = [[0, 1, 2], [3, 4, 5], [6, 7, 8], [0, 3, 6], [1, 4, 7], [2, 5, 8], [0, 4, 8], [2, 4, 6]];
  var MISTAKE_RATE = 0.2; // how often the computer plays its second-best move

  var $ = function (id) { return document.getElementById(id); };
  var boardEl = $("board"), statusEl = $("status");
  var cells = [];
  var board, turn, over, busy, vsCpu = false, cpuFirst = false;
  var tally = { X: 0, O: 0, draw: 0 };

  for (var i = 0; i < 9; i++) {
    var b = document.createElement("button");
    b.type = "button";
    b.className = "cell";
    b.setAttribute("aria-label", "Square " + (i + 1));
    b.addEventListener("click", play.bind(null, i));
    boardEl.appendChild(b);
    cells.push(b);
  }

  function winner(b) {
    for (var i = 0; i < LINES.length; i++) {
      var L = LINES[i];
      if (b[L[0]] && b[L[0]] === b[L[1]] && b[L[0]] === b[L[2]]) return { who: b[L[0]], line: L };
    }
    return b.every(Boolean) ? { who: "draw", line: [] } : null;
  }

  // Minimax from O's point of view; quicker wins score higher.
  function minimax(b, oToMove, depth) {
    var w = winner(b);
    if (w) return w.who === "O" ? 10 - depth : w.who === "X" ? depth - 10 : 0;
    var best = oToMove ? -99 : 99;
    for (var i = 0; i < 9; i++) {
      if (b[i]) continue;
      b[i] = oToMove ? "O" : "X";
      var v = minimax(b, !oToMove, depth + 1);
      b[i] = "";
      best = oToMove ? Math.max(best, v) : Math.min(best, v);
    }
    return best;
  }
  function cpuMove() {
    var scored = [];
    for (var i = 0; i < 9; i++) {
      if (board[i]) continue;
      board[i] = "O";
      scored.push({ i: i, v: minimax(board, false, 1) + Math.random() * 0.1 });
      board[i] = "";
    }
    scored.sort(function (a, b) { return b.v - a.v; });
    var pick = scored.length > 1 && Math.random() < MISTAKE_RATE ? scored[1] : scored[0];
    return pick.i;
  }

  function stamp(i, who) {
    board[i] = who;
    cells[i].innerHTML = "<span>" + who + "</span>";
    cells[i].classList.add(who.toLowerCase());
    cells[i].disabled = true;
    Game.tone(who === "X" ? 440 : 330, 0.08, "triangle", 0.1);
  }

  function finish(w) {
    over = true;
    tally[w.who] += 1;
    paintTally();
    w.line.forEach(function (i) { cells[i].classList.add("win"); });
    boardEl.classList.add("over");
    cells.forEach(function (c) { c.disabled = false; });
    if (w.who === "draw") { statusEl.textContent = "Draw. Tap the board to play again."; Game.play("lose"); }
    else {
      var name = vsCpu ? (w.who === "X" ? "You win" : "Computer wins") : w.who + " wins";
      statusEl.textContent = name + ". Tap the board to play again.";
      Game.play(vsCpu && w.who === "O" ? "lose" : "win");
    }
  }

  function prompt() {
    statusEl.textContent = vsCpu ? (turn === "X" ? "Your move" : "Computer is thinking…") : turn + " to play";
  }

  function afterMove() {
    var w = winner(board);
    if (w) return finish(w);
    turn = turn === "X" ? "O" : "X";
    prompt();
    if (vsCpu && turn === "O") {
      busy = true;
      setTimeout(function () {
        stamp(cpuMove(), "O");
        busy = false;
        afterMove();
      }, 320);
    }
  }

  function play(i) {
    if (over) return reset();
    if (busy || board[i]) return;
    stamp(i, turn);
    afterMove();
  }

  function reset() {
    board = ["", "", "", "", "", "", "", "", ""];
    over = false;
    busy = false;
    boardEl.classList.remove("over");
    cells.forEach(function (c) { c.textContent = ""; c.className = "cell"; c.disabled = false; });
    // Against the computer, alternate who goes first. X is always the player.
    turn = vsCpu && cpuFirst ? "O" : "X";
    cpuFirst = !cpuFirst;
    prompt();
    if (vsCpu && turn === "O") {
      busy = true;
      setTimeout(function () { stamp(cpuMove(), "O"); busy = false; afterMove(); }, 360);
    }
  }

  function paintTally() {
    $("score-x").textContent = tally.X;
    $("score-o").textContent = tally.O;
    $("score-d").textContent = tally.draw;
  }

  function setMode(cpu) {
    vsCpu = cpu;
    cpuFirst = false;
    tally = { X: 0, O: 0, draw: 0 };
    paintTally();
    $("label-x").textContent = cpu ? "You" : "X";
    $("label-o").textContent = cpu ? "Computer" : "O";
    Array.prototype.forEach.call(document.querySelectorAll("[data-mode]"), function (b) {
      b.setAttribute("aria-pressed", String((b.getAttribute("data-mode") === "cpu") === cpu));
    });
    reset();
  }

  Array.prototype.forEach.call(document.querySelectorAll("[data-mode]"), function (b) {
    b.addEventListener("click", function () { setMode(b.getAttribute("data-mode") === "cpu"); });
  });
  $("restart").addEventListener("click", reset);
  setMode(false);
})();
