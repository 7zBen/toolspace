/* Wordle: guess the five-letter word in six tries. Word lists live in words.js. */
(function () {
  "use strict";
  var ANSWERS = window.WORDLE_ANSWERS, GUESSES = window.WORDLE_GUESSES;
  var ROWS = 6, LEN = 5;
  var STATS_KEY = "wordle-stats";
  var LAYOUT = ["qwertyuiop", "asdfghjkl", "+zxcvbnm-"]; // + Enter, - Backspace
  var RANK = { bad: 1, mid: 2, good: 3 };

  var $ = function (id) { return document.getElementById(id); };
  var gridEl = $("grid"), msgEl = $("message");
  var tiles = [], rowEls = [], keys = {};
  var answer, row, guess, busy, done;
  var stats = Object.assign({ played: 0, won: 0, streak: 0 }, window.toolspace.store.get(STATS_KEY, {}));

  /* ---------- Build ---------- */

  for (var r = 0; r < ROWS; r++) {
    var rowEl = document.createElement("div");
    rowEl.className = "row";
    tiles.push([]);
    for (var c = 0; c < LEN; c++) {
      var t = document.createElement("div");
      t.className = "tile";
      rowEl.appendChild(t);
      tiles[r].push(t);
    }
    gridEl.appendChild(rowEl);
    rowEls.push(rowEl);
  }
  LAYOUT.forEach(function (line) {
    var rowEl = document.createElement("div");
    rowEl.className = "row-keys";
    line.split("").forEach(function (ch) {
      var b = document.createElement("button");
      b.type = "button";
      b.className = "key";
      if (ch === "+") { b.textContent = "Enter"; b.dataset.key = "Enter"; b.classList.add("wide"); }
      else if (ch === "-") { b.textContent = "⌫"; b.dataset.key = "Backspace"; b.classList.add("wide"); b.setAttribute("aria-label", "Backspace"); }
      else { b.textContent = ch; b.dataset.key = ch; keys[ch] = b; }
      rowEl.appendChild(b);
    });
    $("keyboard").appendChild(rowEl);
  });

  /* ---------- Rules ---------- */

  // Greens first, then yellows only while unmatched copies of the letter remain.
  function score(g, ans) {
    var res = new Array(LEN).fill("bad"), left = {};
    for (var i = 0; i < LEN; i++) {
      if (g[i] === ans[i]) res[i] = "good";
      else left[ans[i]] = (left[ans[i]] || 0) + 1;
    }
    for (var j = 0; j < LEN; j++) {
      if (res[j] !== "good" && left[g[j]]) { res[j] = "mid"; left[g[j]]--; }
    }
    return res;
  }

  function say(text) { msgEl.textContent = text; }
  function shakeRow() {
    rowEls[row].classList.remove("shake");
    void rowEls[row].offsetWidth;
    rowEls[row].classList.add("shake");
    Game.play("deny");
  }

  function submit() {
    if (guess.length < LEN) { say("Not enough letters"); return shakeRow(); }
    if (!GUESSES.has(guess)) { say("Not in the word list"); return shakeRow(); }
    busy = true;
    say("");
    var res = score(guess, answer), r = row, g = guess;
    res.forEach(function (cls, i) {
      var tile = tiles[r][i];
      tile.style.animationDelay = i * 110 + "ms";
      tile.classList.add("flip");
      setTimeout(function () {
        tile.classList.add(cls);
        var k = keys[g[i]];
        var cur = ["good", "mid", "bad"].filter(function (x) { return k.classList.contains(x); })[0];
        if (!cur || RANK[cls] > RANK[cur]) { k.classList.remove("good", "mid", "bad"); k.classList.add(cls); }
        Game.tone(cls === "good" ? 660 : cls === "mid" ? 520 : 300, 0.06, "sine", 0.05);
      }, i * 110 + 220);
    });
    setTimeout(function () {
      busy = false;
      if (g === answer) return finish(true, r);
      row++;
      guess = "";
      if (row === ROWS) finish(false);
    }, LEN * 110 + 300);
  }

  function finish(win, r) {
    done = true;
    stats.played++;
    if (win) { stats.won++; stats.streak++; } else stats.streak = 0;
    window.toolspace.store.set(STATS_KEY, stats);
    paintStats();
    gridEl.classList.add("done");
    if (win) {
      say(["Genius!", "Magnificent!", "Impressive!", "Splendid!", "Great!", "Phew!"][r] + " Press Enter for another.");
      Game.play("win");
      confetti();
    } else {
      say("It was " + answer.toUpperCase() + ". Press Enter for another.");
      Game.play("lose");
    }
  }

  function input(key) {
    if (done) { if (key === "Enter") reset(); return; }
    if (busy) return;
    if (key === "Enter") return submit();
    if (key === "Backspace") {
      if (!guess.length) return;
      guess = guess.slice(0, -1);
      var t = tiles[row][guess.length];
      t.textContent = "";
      t.classList.remove("filled");
      return;
    }
    var ch = key.toLowerCase();
    if (!/^[a-z]$/.test(ch) || guess.length === LEN) return;
    var tile = tiles[row][guess.length];
    tile.textContent = ch;
    tile.classList.add("filled");
    guess += ch;
    if (msgEl.textContent) say("");
  }

  function confetti() {
    var box = $("confetti");
    var colors = ["#4f8ff7", "#2fc07f", "#f5b52a", "#f0566f", "#a46bf0"];
    box.innerHTML = "";
    for (var i = 0; i < 70; i++) {
      var b = document.createElement("i");
      b.style.left = Math.random() * 100 + "vw";
      b.style.background = colors[i % colors.length];
      b.style.animationDelay = Math.random() * 0.4 + "s";
      b.style.animationDuration = 1 + Math.random() * 0.8 + "s";
      box.appendChild(b);
    }
    setTimeout(function () { box.innerHTML = ""; }, 2600);
  }

  function paintStats() {
    $("played").textContent = stats.played;
    $("won").textContent = stats.won;
    $("streak").textContent = stats.streak;
  }

  function reset() {
    answer = ANSWERS[Math.floor(Math.random() * ANSWERS.length)];
    row = 0;
    guess = "";
    busy = false;
    done = false;
    say("");
    gridEl.classList.remove("done");
    tiles.forEach(function (r) { r.forEach(function (t) { t.textContent = ""; t.className = "tile"; t.style.animationDelay = ""; }); });
    Object.keys(keys).forEach(function (k) { keys[k].className = "key"; });
  }

  /* ---------- Input ---------- */

  $("keyboard").addEventListener("click", function (e) {
    var b = e.target.closest("[data-key]");
    if (b) { input(b.dataset.key); b.blur(); }
  });
  window.addEventListener("keydown", function (e) {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    // Let Enter activate a focused button (mute, theme) instead of submitting.
    if (e.key === "Enter" && e.target.closest("a, button:not(.key)")) return;
    if (e.key === "Enter" || e.key === "Backspace" || /^[a-zA-Z]$/.test(e.key)) {
      e.preventDefault();
      input(e.key);
    }
  });
  gridEl.addEventListener("click", function () { if (done) reset(); });
  $("restart").addEventListener("click", function (e) { reset(); e.currentTarget.blur(); });

  paintStats();
  reset();
})();
