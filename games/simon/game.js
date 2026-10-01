/* Simon Says: repeat a growing sequence of colours. */
(function () {
  "use strict";
  var FREQ = [329.6, 261.6, 392.0, 220.0];
  var BEST_KEY = "simon-best";

  var $ = function (id) { return document.getElementById(id); };
  var padEl = $("pad"), statusEl = $("status"), startBtn = $("start");
  var pads = Array.prototype.slice.call(document.querySelectorAll(".pad-btn"));
  var seq = [], step = 0, accepting = false, playing = false;

  $("best").textContent = Game.getBest(BEST_KEY);

  function wait(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

  function flash(i, ms) {
    pads[i].classList.add("lit");
    Game.tone(FREQ[i], ms / 1000, "square", 0.1);
    return wait(ms).then(function () { pads[i].classList.remove("lit"); });
  }

  function setAccepting(on) {
    accepting = on;
    padEl.classList.toggle("locked", !on);
  }

  // Playback gets quicker as the sequence grows.
  async function playback() {
    setAccepting(false);
    $("round").textContent = seq.length;
    statusEl.textContent = "Watch";
    var on = Math.max(180, 380 - seq.length * 15);
    var gap = Math.max(70, 150 - seq.length * 5);
    await wait(500);
    for (var i = 0; i < seq.length; i++) {
      if (!playing) return;
      await flash(seq[i], on);
      await wait(gap);
    }
    step = 0;
    statusEl.textContent = "Your turn";
    setAccepting(true);
  }

  function extend() { seq.push(Math.floor(Math.random() * 4)); }

  function start() {
    Game.unlock();
    playing = true;
    seq = [];
    extend();
    startBtn.textContent = "";
    startBtn.disabled = true;
    playback();
  }

  function gameOver(pressed) {
    playing = false;
    setAccepting(false);
    var reached = seq.length - 1;
    Game.tone(110, 0.4, "sawtooth", 0.1, 60);
    padEl.classList.add("wrong");
    setTimeout(function () { padEl.classList.remove("wrong"); }, 320);
    // Show which pad it should have been.
    flash(seq[step], 500);
    if (Game.setBest(BEST_KEY, reached)) $("best").textContent = reached;
    statusEl.textContent = reached ? "Wrong. You got " + reached + (reached === 1 ? " round." : " rounds.") : "Wrong. Try again.";
    startBtn.textContent = "Again";
    startBtn.disabled = false;
  }

  function press(i) {
    if (!accepting) return;
    if (seq[step] !== i) return gameOver(i);
    flash(i, 180);
    step++;
    if (step === seq.length) {
      setAccepting(false);
      if (Game.setBest(BEST_KEY, seq.length)) $("best").textContent = seq.length;
      statusEl.textContent = "Nice";
      extend();
      setTimeout(playback, 600);
    }
  }

  pads.forEach(function (p, i) {
    p.addEventListener("pointerdown", function (e) { e.preventDefault(); press(i); });
  });
  startBtn.addEventListener("click", start);
  window.addEventListener("keydown", function (e) {
    if (e.repeat || e.metaKey || e.ctrlKey) return;
    if (/^[1-4]$/.test(e.key)) { press(parseInt(e.key, 10) - 1); return; }
    if (e.code === "Space" && !playing) { e.preventDefault(); start(); }
  });
})();
