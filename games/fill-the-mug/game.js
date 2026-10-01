/* Fill the Mug: hold to pour, let go when the beer reaches the line. It speeds up. */
(function () {
  "use strict";
  var BEST_KEY = "mug-best";
  var SCENE_W = 420;
  var SPOUT_BOTTOM = 134, MUG_TOP = 200, MUG_INNER = 239, MUG_CENTER_X = 210; // scene pixels
  var HIT = 1.5, PERFECT = 0.5;                            // % away from the line

  var $ = function (id) { return document.getElementById(id); };
  var wrap = $("wrap"), mug = $("mug"), liquid = $("liquid"), stream = $("stream"), statusEl = $("status");
  var level = 0, target = 50, speed = 0, pouring = false, done = false, streak = 0, last = 0;
  var noise = null; // { gain, filter } once audio is unlocked

  $("best").textContent = Game.getBest(BEST_KEY);
  for (var i = 0; i < 10; i++) {
    var b = document.createElement("i");
    b.style.left = 8 + Math.random() * 80 + "%";
    b.style.animationDelay = Math.random() * 1.6 + "s";
    $("bubbles").appendChild(b);
  }

  /* ---------- Fit the fixed-size scene to the screen ---------- */

  function fit() { wrap.style.setProperty("--s", Math.min(1, wrap.clientWidth / SCENE_W)); }
  window.addEventListener("resize", fit);
  fit();

  /* ---------- Pouring sound: looped filtered noise ---------- */

  function ensureNoise() {
    if (noise) return;
    var a = Game.audio();
    if (!a) return;
    var ctx = a.ctx, len = ctx.sampleRate * 2;
    var buf = ctx.createBuffer(1, len, ctx.sampleRate), data = buf.getChannelData(0);
    for (var i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    var src = ctx.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    var filter = ctx.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.value = 1000;
    filter.Q.value = 0.6;
    var gain = ctx.createGain();
    gain.gain.value = 0;
    src.connect(filter);
    filter.connect(gain);
    gain.connect(a.out);
    src.start();
    noise = { ctx: ctx, gain: gain, filter: filter };
  }
  function pourSound(on) {
    if (!noise) return;
    noise.gain.gain.setTargetAtTime(on ? 0.3 : 0, noise.ctx.currentTime, 0.05);
  }

  /* ---------- Game ---------- */

  function newMug() {
    level = 0;
    speed = 0;
    done = false;
    target = 18 + Math.floor(Math.random() * 67);
    liquid.style.height = "0%";
    mug.classList.remove("hit", "miss");
    $("goal").style.bottom = target + "%";
    $("goal-label").textContent = target + "%";
    $("target").textContent = target + "%";
    statusEl.textContent = "Hold to pour. Let go on the line.";
    drawStream();
  }

  function drawStream() {
    var surface = MUG_TOP + MUG_INNER * (1 - level / 100);
    stream.style.height = pouring ? Math.max(0, surface - SPOUT_BOTTOM) + "px" : "0";
  }

  function startPour() {
    if (pouring) return;
    ensureNoise();
    if (done) newMug();
    pouring = true;
    speed = 26;
    wrap.classList.add("pouring");
    pourSound(true);
  }

  function stopPour() {
    if (!pouring) return;
    pouring = false;
    wrap.classList.remove("pouring");
    pourSound(false);
    drawStream();
    if (level < 0.5) return; // a tap, not a pour
    judge();
  }

  function judge() {
    done = true;
    var off = Math.abs(level - target);
    var shown = Math.round(level * 10) / 10;
    if (off <= HIT) {
      streak++;
      mug.classList.add("hit");
      Game.play("win");
      // The fx layer lives inside the scaled scene, so scene coordinates work directly.
      Game.sparks($("fx"), MUG_CENTER_X, MUG_TOP + MUG_INNER * (1 - level / 100),
        { count: 24, dist: 90, colors: ["#ffb020", "#f7f1d6", "#6ea8ff", "#3dd68c"] });
      statusEl.textContent = (off <= PERFECT ? "Perfect! " : "Nice! ") + shown + "%. Pour again for the next mug.";
    } else {
      streak = 0;
      mug.classList.add("miss");
      Game.play("lose");
      statusEl.textContent = shown + "%, needed " + target + "%. Pour again for a new mug.";
    }
    $("streak").textContent = streak;
    if (Game.setBest(BEST_KEY, streak)) $("best").textContent = streak;
  }

  function loop(t) {
    var dt = Math.min(0.04, (t - last) / 1000 || 0.016);
    last = t;
    if (pouring && !done) {
      speed += 36 * dt; // it accelerates
      level = Math.min(100, level + speed * dt);
      liquid.style.height = level + "%";
      drawStream();
      if (noise) noise.filter.frequency.setTargetAtTime(800 + level * 7, noise.ctx.currentTime, 0.05);
      if (level >= 100) stopPour();
    }
    requestAnimationFrame(loop);
  }

  /* ---------- Input: hold anywhere on the scene, or Space ---------- */

  wrap.addEventListener("pointerdown", function (e) {
    e.preventDefault();
    wrap.setPointerCapture(e.pointerId);
    startPour();
  });
  wrap.addEventListener("pointerup", stopPour);
  wrap.addEventListener("pointercancel", stopPour);
  wrap.addEventListener("contextmenu", function (e) { e.preventDefault(); });
  window.addEventListener("keydown", function (e) {
    if (e.code !== "Space" || e.repeat) return;
    e.preventDefault();
    startPour();
  });
  window.addEventListener("keyup", function (e) { if (e.code === "Space") stopPour(); });
  window.addEventListener("blur", stopPour);

  newMug();
  requestAnimationFrame(loop);
})();
