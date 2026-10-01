/* Clock: full-window face, settings drawer, real fullscreen on first click. */
(function () {
  "use strict";
  var ts = window.toolspace;
  var KEY = "toolspace-clock";

  var FACES = [
    { id: "midnight", name: "Midnight", bg: "#0f1a2c", fg: "#8d9aff" },
    { id: "paper", name: "Paper", bg: "#f4efe6", fg: "#c0583a" },
    { id: "sage", name: "Sage", bg: "#1f2e28", fg: "#9ed3b5" },
    { id: "ember", name: "Ember", bg: "#1d1412", fg: "#ff8a4c" },
    { id: "mono", name: "Mono", bg: "#000000", fg: "#ffffff" }
  ];
  var ZONES = [
    ["local", "My local time"], ["UTC", "UTC"],
    ["America/Los_Angeles", "Los Angeles"], ["America/Denver", "Denver"], ["America/Chicago", "Chicago"],
    ["America/New_York", "New York"], ["America/Sao_Paulo", "São Paulo"],
    ["Europe/London", "London"], ["Europe/Paris", "Paris"], ["Europe/Berlin", "Berlin"], ["Europe/Athens", "Athens"],
    ["Africa/Johannesburg", "Johannesburg"], ["Asia/Dubai", "Dubai"], ["Asia/Kolkata", "Mumbai"],
    ["Asia/Singapore", "Singapore"], ["Asia/Shanghai", "Shanghai"], ["Asia/Tokyo", "Tokyo"],
    ["Australia/Sydney", "Sydney"], ["Pacific/Auckland", "Auckland"]
  ];

  var $ = function (id) { return document.getElementById(id); };
  var stage = $("stage");
  var hmEl = $("hm"), secsEl = $("secs"), ampmEl = $("ampm"), dateEl = $("date");
  var handH = $("hand-h"), handM = $("hand-m"), handS = $("hand-s");
  var settings = $("settings"), cog = $("cog");

  /* ---------- Preferences ---------- */

  var localUses12h = /am|pm/i.test(new Date(2020, 0, 1, 13).toLocaleTimeString());
  var prefs = Object.assign(
    { hour12: localUses12h, seconds: true, date: true, analog: false, face: "midnight", zone: "local" },
    ts.store.get(KEY, {})
  );
  if (!faceById(prefs.face)) prefs.face = "midnight";
  if (!zoneById(prefs.zone)) prefs.zone = "local";

  function faceById(id) { return FACES.filter(function (f) { return f.id === id; })[0]; }
  function zoneById(id) { return ZONES.filter(function (z) { return z[0] === id; })[0]; }

  /* ---------- Analog dial ---------- */

  var svgNS = "http://www.w3.org/2000/svg";
  var ticks = $("ticks");
  for (var i = 0; i < 60; i++) {
    var a = i / 60 * Math.PI * 2;
    var major = i % 5 === 0;
    var inner = major ? 82 : 87;
    var line = document.createElementNS(svgNS, "line");
    line.setAttribute("class", "tick" + (major ? " major" : ""));
    line.setAttribute("x1", 100 + Math.sin(a) * inner);
    line.setAttribute("y1", 100 - Math.cos(a) * inner);
    line.setAttribute("x2", 100 + Math.sin(a) * 92);
    line.setAttribute("y2", 100 - Math.cos(a) * 92);
    ticks.appendChild(line);
  }
  [12, 3, 6, 9].forEach(function (n) {
    var ang = n / 12 * Math.PI * 2;
    var t = document.createElementNS(svgNS, "text");
    t.setAttribute("class", "num");
    t.setAttribute("x", 100 + Math.sin(ang) * 68);
    t.setAttribute("y", 100 - Math.cos(ang) * 68);
    t.textContent = n;
    ticks.appendChild(t);
  });

  /* ---------- Time ---------- */

  var partsFmt, dateFmt;
  function buildFormatters() {
    var tz = prefs.zone === "local" ? undefined : prefs.zone;
    partsFmt = new Intl.DateTimeFormat("en-US", { timeZone: tz, hourCycle: "h23", hour: "numeric", minute: "numeric", second: "numeric" });
    dateFmt = new Intl.DateTimeFormat(undefined, { timeZone: tz, weekday: "long", day: "numeric", month: "long", year: "numeric" });
  }
  function timeParts(d) {
    var out = {};
    partsFmt.formatToParts(d).forEach(function (p) { if (p.type !== "literal") out[p.type] = parseInt(p.value, 10); });
    if (out.hour === 24) out.hour = 0;
    return out;
  }
  function pad(n) { return String(n).padStart(2, "0"); }

  var lastSecond = -1;
  function frame() {
    var d = new Date();
    var p = timeParts(d);
    var ms = d.getMilliseconds();

    if (prefs.analog) {
      var s = p.second + ms / 1000;
      var m = p.minute + s / 60;
      var h = (p.hour % 12) + m / 60;
      handS.setAttribute("transform", "rotate(" + (s * 6) + " 100 100)");
      handM.setAttribute("transform", "rotate(" + (m * 6) + " 100 100)");
      handH.setAttribute("transform", "rotate(" + (h * 30) + " 100 100)");
    }
    if (p.second !== lastSecond) {
      lastSecond = p.second;
      if (prefs.hour12) {
        hmEl.textContent = (p.hour % 12 || 12) + ":" + pad(p.minute);
        ampmEl.textContent = p.hour >= 12 ? "PM" : "AM";
      } else {
        hmEl.textContent = pad(p.hour) + ":" + pad(p.minute);
        ampmEl.textContent = "";
      }
      secsEl.textContent = pad(p.second);
      var dateText = ts.escapeHtml(dateFmt.format(d));
      dateEl.innerHTML = prefs.zone === "local" ? dateText
        : '<span class="zone">' + zoneById(prefs.zone)[1] + "</span> · " + dateText;
      $("sr-time").textContent = hmEl.textContent + " " + ampmEl.textContent;
    }
    // Analog sweeps smoothly; digital only needs to wake when the second changes.
    if (prefs.analog) requestAnimationFrame(frame);
    else setTimeout(frame, Math.min(250, 1000 - ms + 5));
  }

  /* ---------- Settings ---------- */

  var zoneSelect = $("opt-zone");
  zoneSelect.innerHTML = ZONES.map(function (z) { return '<option value="' + z[0] + '">' + z[1] + "</option>"; }).join("");

  var faceWrap = $("faces");
  faceWrap.innerHTML = FACES.map(function (f) {
    return '<button class="swatch" type="button" data-face="' + f.id + '" aria-label="' + f.name + '" title="' + f.name +
      '" style="background: linear-gradient(135deg, ' + f.bg + " 55%, " + f.fg + ' 55%)"></button>';
  }).join("");

  function apply() {
    var face = faceById(prefs.face);
    stage.setAttribute("data-face", face.id);
    stage.classList.toggle("is-analog", prefs.analog);
    document.querySelector('meta[name="theme-color"]').setAttribute("content", face.bg);
    secsEl.hidden = !prefs.seconds;
    handS.style.display = prefs.seconds ? "" : "none";
    dateEl.hidden = !prefs.date;
    $("opt-12h").checked = prefs.hour12;
    $("opt-secs").checked = prefs.seconds;
    $("opt-date").checked = prefs.date;
    zoneSelect.value = prefs.zone;
    $("face-name").textContent = face.name;
    Array.prototype.forEach.call(document.querySelectorAll("[data-mode]"), function (b) {
      b.setAttribute("aria-pressed", String((b.getAttribute("data-mode") === "analog") === prefs.analog));
    });
    Array.prototype.forEach.call(faceWrap.children, function (b) {
      b.setAttribute("aria-pressed", String(b.getAttribute("data-face") === prefs.face));
    });
    lastSecond = -1;
  }
  function update(patch) {
    Object.assign(prefs, patch);
    if ("zone" in patch) buildFormatters();
    ts.store.set(KEY, prefs);
    apply();
  }
  function nextFace() {
    var idx = FACES.findIndex(function (f) { return f.id === prefs.face; });
    update({ face: FACES[(idx + 1) % FACES.length].id });
  }

  $("opt-12h").addEventListener("change", function (e) { update({ hour12: e.target.checked }); });
  $("opt-secs").addEventListener("change", function (e) { update({ seconds: e.target.checked }); });
  $("opt-date").addEventListener("change", function (e) { update({ date: e.target.checked }); });
  zoneSelect.addEventListener("change", function (e) { update({ zone: e.target.value }); });
  Array.prototype.forEach.call(document.querySelectorAll("[data-mode]"), function (b) {
    b.addEventListener("click", function () { update({ analog: b.getAttribute("data-mode") === "analog" }); });
  });
  faceWrap.addEventListener("click", function (e) {
    var b = e.target.closest("[data-face]");
    if (b) update({ face: b.getAttribute("data-face") });
  });

  function setSettings(open) {
    settings.hidden = !open;
    document.body.classList.toggle("settings-open", open);
    cog.setAttribute("aria-expanded", String(open));
    if (open) $("close-settings").focus();
    else wake();
  }
  cog.addEventListener("click", function () { setSettings(settings.hidden); });
  $("close-settings").addEventListener("click", function () { setSettings(false); cog.focus(); });
  $("scrim").addEventListener("click", function () { setSettings(false); });

  /* ---------- Fullscreen ---------- */

  var root = document.documentElement;
  var canFullscreen = !!(root.requestFullscreen || root.webkitRequestFullscreen);
  var fsButton = $("fs-button");
  var hint = $("fs-hint");
  if (!canFullscreen) { fsButton.hidden = true; hint.hidden = true; }
  if (window.matchMedia("(hover: none)").matches) hint.textContent = "Tap anywhere for fullscreen";

  function isFull() { return !!(document.fullscreenElement || document.webkitFullscreenElement); }
  function enterFull() {
    if (!canFullscreen || isFull()) return;
    var req = root.requestFullscreen || root.webkitRequestFullscreen;
    var p = req.call(root);
    if (p && p.catch) p.catch(function () {});
  }
  function exitFull() {
    if (!isFull()) return;
    (document.exitFullscreen || document.webkitExitFullscreen).call(document);
  }
  function toggleFull() { if (isFull()) exitFull(); else enterFull(); }
  function paintFs() {
    var full = isFull();
    fsButton.innerHTML = ts.icon(full ? "shrink" : "expand");
    fsButton.setAttribute("aria-label", full ? "Exit fullscreen" : "Fullscreen");
    if (full) hint.classList.add("gone");
  }
  fsButton.addEventListener("click", toggleFull);
  document.addEventListener("fullscreenchange", paintFs);
  document.addEventListener("webkitfullscreenchange", paintFs);

  // The page already fills the window; the first click on the face makes it true fullscreen.
  stage.addEventListener("click", function (e) {
    if (e.target.closest(".controls")) return;
    enterFull();
  });
  setTimeout(function () { hint.classList.add("gone"); }, 4000);

  /* ---------- Idle: hide controls and cursor ---------- */

  var idleTimer;
  function wake() {
    stage.classList.remove("idle");
    clearTimeout(idleTimer);
    idleTimer = setTimeout(function () {
      if (settings.hidden) stage.classList.add("idle");
    }, 3000);
  }
  ["pointermove", "pointerdown", "keydown"].forEach(function (evt) {
    document.addEventListener(evt, wake, { passive: true });
  });

  /* ---------- Keys ---------- */

  document.addEventListener("keydown", function (e) {
    if (e.metaKey || e.ctrlKey || e.altKey || e.target.closest("input, select, textarea")) return;
    var k = e.key.toLowerCase();
    if (k === "f") { e.preventDefault(); toggleFull(); }
    else if (k === "a") update({ analog: !prefs.analog });
    else if (k === "c") nextFace();
    else if (k === "s") setSettings(settings.hidden);
    else if (e.key === "Escape" && !settings.hidden) setSettings(false);
  });

  buildFormatters();
  apply();
  wake();
  frame();
})();
