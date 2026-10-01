/* toolspace — shared game helpers: sound, best scores, sparks, panic cover.
   Load after site.js. Exposes window.Game.                                   */
(function () {
  "use strict";
  var ts = window.toolspace;

  /* ---------- Sound (one mute switch for every game) ---------- */

  var MUTE_KEY = "toolspace-muted";
  var muted = !!ts.store.get(MUTE_KEY, false);
  var ctx = null, master = null;
  var VOLUME = 0.18;

  function unlock() {
    if (!ctx) {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = muted ? 0 : VOLUME;
      master.connect(ctx.destination);
    }
    if (ctx.state === "suspended") ctx.resume();
    return ctx;
  }
  // Browsers only allow audio after a user gesture; unlock on the first one.
  ["pointerdown", "keydown"].forEach(function (evt) {
    window.addEventListener(evt, unlock, { once: true, capture: true });
  });

  /* tone(440, .1, "sine", .1, 660) — frequency, seconds, wave, volume, optional slide target. */
  function tone(freq, dur, type, vol, slide, delay) {
    if (!ctx || muted) return;
    var t = ctx.currentTime + (delay || 0);
    var o = ctx.createOscillator();
    var g = ctx.createGain();
    o.type = type || "sine";
    o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(slide, t + dur);
    g.gain.setValueAtTime(vol || 0.1, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g);
    g.connect(master);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  var SOUNDS = {
    win: function () { tone(523, .12, "sine", .1); tone(659, .16, "triangle", .1, 0, .08); tone(784, .28, "sine", .12, 1046, .16); },
    lose: function () { tone(160, .3, "triangle", .1, 70); },
    tap: function () { tone(420, .05, "triangle", .06); },
    deny: function () { tone(110, .1, "square", .06); }
  };
  function play(name) { if (SOUNDS[name]) SOUNDS[name](); }

  function setMuted(next) {
    muted = next;
    ts.store.set(MUTE_KEY, muted);
    if (master) master.gain.setTargetAtTime(muted ? 0 : VOLUME, ctx.currentTime, 0.02);
    paintMute();
  }

  var muteBtn = null;
  function paintMute() {
    if (!muteBtn) return;
    muteBtn.innerHTML = ts.icon(muted ? "muted" : "sound");
    muteBtn.setAttribute("aria-label", muted ? "Unmute" : "Mute");
    muteBtn.title = muted ? "Unmute (M)" : "Mute (M)";
    muteBtn.setAttribute("aria-pressed", String(muted));
  }
  // game.js is deferred, so <body> exists; games with sound mark it with data-sound.
  if (document.body.hasAttribute("data-sound")) addMuteButton();
  function addMuteButton() {
    muteBtn = document.createElement("button");
    muteBtn.type = "button";
    muteBtn.className = "icon-button";
    muteBtn.addEventListener("click", function () { unlock(); setMuted(!muted); });
    paintMute();
    ts.addAction(muteBtn);
  }
  window.addEventListener("keydown", function (e) {
    if (!muteBtn || e.metaKey || e.ctrlKey || e.altKey || e.target.closest("input, textarea")) return;
    if (e.key === "m" || e.key === "M") setMuted(!muted);
  });

  /* ---------- Best scores ---------- */

  // Stored as plain numbers so the original site's saves carry over.
  function getBest(key) { return parseInt(ts.store.get(key, 0), 10) || 0; }
  function setBest(key, value) {
    if (value <= getBest(key)) return false;
    ts.store.set(key, value);
    return true;
  }

  /* ---------- Effects ---------- */

  // A ring of sparks at (x, y) inside `layer` (which should be position: relative/absolute).
  function sparks(layer, x, y, opts) {
    opts = opts || {};
    var colors = opts.colors || ["#6ea8ff", "#3dd68c", "#ffb020", "#fb7185"];
    var count = opts.count || 8;
    var dist = opts.dist || 30;
    for (var i = 0; i < count; i++) {
      var s = document.createElement("i");
      s.className = "spark";
      var ang = Math.random() * Math.PI * 2;
      var d = dist * (0.5 + Math.random() * 0.7);
      s.style.left = x + "px";
      s.style.top = y + "px";
      s.style.background = colors[i % colors.length];
      if (opts.size) { s.style.width = s.style.height = opts.size + "px"; }
      s.style.setProperty("--dx", Math.cos(ang) * d + "px");
      s.style.setProperty("--dy", Math.sin(ang) * d + "px");
      layer.appendChild(s);
      setTimeout(s.remove.bind(s), 600);
    }
  }

  // "+120" text that drifts up and fades.
  function floatText(layer, x, y, text) {
    var n = document.createElement("span");
    n.className = "float-text";
    n.textContent = text;
    n.style.left = x + "px";
    n.style.top = y + "px";
    layer.appendChild(n);
    setTimeout(n.remove.bind(n), 750);
  }

  function shake(node) {
    node.classList.remove("shake");
    void node.offsetWidth;
    node.classList.add("shake");
    setTimeout(function () { node.classList.remove("shake"); }, 300);
  }

  /* ---------- Panic cover: a calculator that hides the game (desktop only) ---------- */

  function setupCover() {
    var desktop = window.matchMedia("(hover: hover) and (pointer: fine)").matches && window.innerWidth > 800;
    if (!desktop) return;

    var realTitle = document.title;
    var favicon = document.querySelector('link[rel="icon"]');
    var realIcon = favicon && favicon.getAttribute("href");
    var CALC_ICON = "data:image/svg+xml," + encodeURIComponent(
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><rect x="3" y="2" width="18" height="20" rx="3" fill="#5f6368"/>' +
      '<rect x="6" y="5" width="12" height="4" rx="1" fill="#e8eaed"/><g fill="#e8eaed"><circle cx="8" cy="13" r="1.3"/>' +
      '<circle cx="12" cy="13" r="1.3"/><circle cx="16" cy="13" r="1.3"/><circle cx="8" cy="17.5" r="1.3"/>' +
      '<circle cx="12" cy="17.5" r="1.3"/></g><circle cx="16" cy="17.5" r="1.3" fill="#8ab4f8"/></svg>');

    var cover = document.createElement("div");
    cover.className = "cover";
    cover.setAttribute("aria-hidden", "true");
    cover.innerHTML =
      '<div class="calc">' +
        '<div class="calc-head"><span>Calculator</span><button type="button" class="calc-mode">Scientific</button></div>' +
        '<div class="calc-screen"><span class="calc-sub"></span><span class="calc-value">0</span></div>' +
        '<div class="calc-pad"></div>' +
      "</div>";
    document.body.appendChild(cover);

    var btn = document.createElement("button");
    btn.type = "button";
    btn.className = "panic-button";
    btn.title = "Cover screen (`)";
    btn.setAttribute("aria-label", "Cover screen");
    btn.textContent = "!";
    document.body.appendChild(btn);

    var valueEl = cover.querySelector(".calc-value");
    var subEl = cover.querySelector(".calc-sub");
    var pad = cover.querySelector(".calc-pad");
    var modeBtn = cover.querySelector(".calc-mode");

    /* Simple immediate-execution calculator. */
    var acc = null, cur = "0", op = null, fresh = true, sci = false;
    function fmt(x) { return isFinite(x) ? String(parseFloat(Number(x).toPrecision(12))) : "Error"; }
    function val() { return parseFloat(cur) || 0; }
    function setCur(x) { cur = fmt(x); fresh = true; }
    function compute() {
      var x = val();
      if (op === "+") acc += x;
      else if (op === "−") acc -= x;
      else if (op === "×") acc *= x;
      else if (op === "÷") acc = x === 0 ? NaN : acc / x;
      else if (op === "^") acc = Math.pow(acc, x);
      setCur(acc);
      op = null;
    }
    function binary(next) {
      if (op && !fresh) compute();
      acc = val();
      op = next;
      fresh = true;
    }
    function digit(d) {
      if (fresh || cur === "0" || cur === "Error") { cur = d === "." ? "0." : d; fresh = false; }
      else if (d !== "." || cur.indexOf(".") < 0) cur += d;
    }
    function rad() { return val() * Math.PI / 180; }
    function fact(n) {
      n = Math.floor(n);
      if (n < 0 || n > 170) return NaN;
      for (var r = 1, i = 2; i <= n; i++) r *= i;
      return r;
    }
    var FN = {
      "AC": function () { acc = null; op = null; setCur(0); },
      "CE": function () { setCur(0); },
      "⌫": function () { if (!fresh) { cur = cur.length > 1 ? cur.slice(0, -1) : "0"; } },
      "%": function () { setCur(val() / 100); },
      "±": function () { cur = fmt(-val()); },
      "=": function () { if (op) compute(); acc = null; },
      "÷": function () { binary("÷"); }, "×": function () { binary("×"); },
      "−": function () { binary("−"); }, "+": function () { binary("+"); },
      "xʸ": function () { binary("^"); },
      "sin": function () { setCur(Math.sin(rad())); }, "cos": function () { setCur(Math.cos(rad())); },
      "tan": function () { setCur(Math.tan(rad())); }, "ln": function () { setCur(Math.log(val())); },
      "log": function () { setCur(Math.log10(val())); }, "√": function () { setCur(Math.sqrt(val())); },
      "x²": function () { setCur(val() * val()); }, "π": function () { setCur(Math.PI); },
      "e": function () { setCur(Math.E); }, "n!": function () { setCur(fact(val())); },
      "1/x": function () { setCur(1 / val()); }, "eˣ": function () { setCur(Math.exp(val())); }
    };
    var BASIC = ["AC", "CE", "%", "÷", "7", "8", "9", "×", "4", "5", "6", "−", "1", "2", "3", "+", "±", "0", ".", "="];
    var SCI = ["sin", "cos", "tan", "AC", "CE", "%", "÷",
               "ln", "log", "√", "7", "8", "9", "×",
               "π", "e", "x²", "4", "5", "6", "−",
               "xʸ", "n!", "1/x", "1", "2", "3", "+",
               "eˣ", "⌫", "±", "0", ".", "=", ""];
    function kind(k) {
      if (k === "=") return "eq";
      if (/^[÷×−+]$/.test(k)) return "op";
      if (/^[0-9.]$/.test(k)) return "num";
      return "fn";
    }
    function show() {
      valueEl.textContent = cur;
      subEl.textContent = op && acc != null ? fmt(acc) + " " + (op === "^" ? "^" : op) : "";
    }
    function build() {
      pad.innerHTML = (sci ? SCI : BASIC).map(function (k) {
        return k ? '<button type="button" class="' + kind(k) + '" data-k="' + k + '">' + k + "</button>" : "<span></span>";
      }).join("");
      cover.classList.toggle("sci", sci);
      modeBtn.textContent = sci ? "Basic" : "Scientific";
    }
    function press(k) {
      if (FN[k]) FN[k]();
      else digit(k);
      show();
    }
    pad.addEventListener("click", function (e) {
      var b = e.target.closest("[data-k]");
      if (b) press(b.getAttribute("data-k"));
    });
    modeBtn.addEventListener("click", function () { sci = !sci; build(); });
    build();
    show();

    function setOn(on) {
      cover.classList.toggle("show", on);
      cover.setAttribute("aria-hidden", String(!on));
      document.documentElement.classList.toggle("covered", on);
      document.title = on ? "Calculator" : realTitle;
      if (favicon) favicon.setAttribute("href", on ? CALC_ICON : realIcon);
      if (on && master) master.gain.setTargetAtTime(0, ctx.currentTime, 0.01);
      if (!on && master) master.gain.setTargetAtTime(muted ? 0 : VOLUME, ctx.currentTime, 0.05);
      btn.blur();
    }
    function isOn() { return cover.classList.contains("show"); }
    btn.addEventListener("click", function () { setOn(!isOn()); });

    // While covered, the keyboard drives the calculator and never reaches the game.
    window.addEventListener("keydown", function (e) {
      if (e.key === "`" && !e.target.closest("input, textarea")) { e.preventDefault(); e.stopImmediatePropagation(); setOn(!isOn()); return; }
      if (!isOn()) return;
      e.stopImmediatePropagation();
      if (e.key === "Escape") { e.preventDefault(); setOn(false); return; }
      var map = { "/": "÷", "*": "×", "-": "−", "+": "+", "Enter": "=", "=": "=", "%": "%", ".": ".", "Backspace": "⌫", "Delete": "AC" };
      var k = map[e.key] || e.key;
      if (/^[0-9]$/.test(k) || FN[k]) { e.preventDefault(); press(k); }
    }, true);
    window.addEventListener("keyup", function (e) { if (isOn()) e.stopImmediatePropagation(); }, true);
  }

  window.Game = {
    unlock: unlock,
    tone: tone,
    play: play,
    audio: function () { unlock(); return ctx ? { ctx: ctx, out: master } : null; },
    isMuted: function () { return muted; },
    getBest: getBest,
    setBest: setBest,
    sparks: sparks,
    floatText: floatText,
    shake: shake
  };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", setupCover);
  else setupCover();
})();
