/* QR Maker: builds one SVG path per code and uses it for the canvas preview and both exports. */
(function () {
  "use strict";
  var ts = window.toolspace;
  var KEY = "toolspace-qr";
  var $ = function (id) { return document.getElementById(id); };

  if (typeof qrcode !== "function") {
    $("placeholder").textContent = "The QR library didn't load. Try refreshing.";
    return;
  }
  qrcode.stringToBytes = qrcode.stringToBytesFuncs["UTF-8"];

  // Settings and the link/text persist; the Wi-Fi password deliberately does not.
  var prefs = Object.assign({
    mode: "link", link: "", text: "", ssid: "", sec: "WPA", hidden: false,
    style: "square", fg: "#172334", bg: "#ffffff", transparent: false, margin: true, ecc: "M", size: "1024"
  }, ts.store.get(KEY, {}));
  function save() { ts.store.set(KEY, prefs); }

  /* ---------- Payload ---------- */

  function normalizeLink(raw) {
    var v = raw.trim();
    if (!v) return "";
    if (!/^[a-z][a-z0-9+.-]*:/i.test(v)) v = "https://" + v;
    return v;
  }
  function wifiEscape(s) { return s.replace(/([\\;,:"])/g, "\\$1"); }
  function payload() {
    if (prefs.mode === "link") return normalizeLink(prefs.link);
    if (prefs.mode === "text") return prefs.text;
    if (!prefs.ssid) return "";
    var pass = $("in-pass").value;
    return "WIFI:T:" + prefs.sec + ";S:" + wifiEscape(prefs.ssid) + ";" +
      (prefs.sec !== "nopass" ? "P:" + wifiEscape(pass) + ";" : "") +
      (prefs.hidden ? "H:true;" : "") + ";";
  }

  /* ---------- Geometry → one SVG path used by both canvas and SVG export ---------- */

  function rr(x, y, w, h, r) {
    return "M" + (x + r) + " " + y + "h" + (w - 2 * r) + "a" + r + " " + r + " 0 0 1 " + r + " " + r +
      "v" + (h - 2 * r) + "a" + r + " " + r + " 0 0 1 " + (-r) + " " + r +
      "h" + (2 * r - w) + "a" + r + " " + r + " 0 0 1 " + (-r) + " " + (-r) +
      "v" + (2 * r - h) + "a" + r + " " + r + " 0 0 1 " + r + " " + (-r) + "z";
  }
  function circle(cx, cy, r) {
    return "M" + (cx - r) + " " + cy + "a" + r + " " + r + " 0 1 0 " + (2 * r) + " 0a" + r + " " + r + " 0 1 0 " + (-2 * r) + " 0z";
  }

  function build(text) {
    var qr = qrcode(0, prefs.ecc);
    qr.addData(text);
    qr.make();
    var n = qr.getModuleCount();
    var pad = prefs.margin ? 4 : 0;
    var finders = [[0, 0], [n - 7, 0], [0, n - 7]];
    function inFinder(r, c) {
      return finders.some(function (f) { return c >= f[0] && c < f[0] + 7 && r >= f[1] && r < f[1] + 7; });
    }
    var d = "";
    for (var r = 0; r < n; r++) {
      for (var c = 0; c < n; c++) {
        if (!qr.isDark(r, c)) continue;
        if (prefs.style !== "square" && inFinder(r, c)) continue;
        var x = c + pad, y = r + pad;
        if (prefs.style === "square") d += "M" + x + " " + y + "h1v1h-1z";
        else if (prefs.style === "rounded") d += rr(x + .04, y + .04, .92, .92, .32);
        else d += circle(x + .5, y + .5, .43);
      }
    }
    if (prefs.style !== "square") {
      // Finder eyes drawn as soft rings so the code still reads as a QR code.
      var rad = prefs.style === "dots" ? [3.5, 2.5, 1.5] : [2.1, 1.4, 1];
      finders.forEach(function (f) {
        var x = f[0] + pad, y = f[1] + pad;
        d += rr(x, y, 7, 7, rad[0]) + rr(x + 1, y + 1, 5, 5, rad[1]) + rr(x + 2, y + 2, 3, 3, rad[2]);
      });
    }
    return { path: d, size: n + pad * 2, modules: n, version: (n - 17) / 4 };
  }

  function draw(canvas, code, px) {
    canvas.width = canvas.height = px;
    var ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, px, px);
    if (!prefs.transparent) {
      ctx.fillStyle = prefs.bg;
      ctx.fillRect(0, 0, px, px);
    }
    var scale = px / code.size;
    ctx.save();
    ctx.scale(scale, scale);
    ctx.fillStyle = prefs.fg;
    ctx.fill(new Path2D(code.path), "evenodd");
    ctx.restore();
  }
  function toSvg(code) {
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + code.size + " " + code.size +
      '" width="' + code.size * 10 + '" height="' + code.size * 10 + '" shape-rendering="' + (prefs.style === "square" ? "crispEdges" : "geometricPrecision") + '">' +
      (prefs.transparent ? "" : '<rect width="100%" height="100%" fill="' + prefs.bg + '"/>') +
      '<path fill="' + prefs.fg + '" fill-rule="evenodd" d="' + code.path + '"/></svg>';
  }

  /* ---------- Contrast check ---------- */

  function lum(hex) {
    var v = [1, 3, 5].map(function (i) {
      var c = parseInt(hex.substr(i, 2), 16) / 255;
      return c <= .03928 ? c / 12.92 : Math.pow((c + .055) / 1.055, 2.4);
    });
    return .2126 * v[0] + .7152 * v[1] + .0722 * v[2];
  }
  function contrastWarning() {
    if (prefs.transparent) return "";
    var a = lum(prefs.fg), b = lum(prefs.bg);
    var ratio = (Math.max(a, b) + .05) / (Math.min(a, b) + .05);
    if (ratio < 3) return "Low contrast between dots and background. Some phones won't be able to read it.";
    if (a > b) return "Light dots on a dark background can't be read by some scanner apps. Dark on light is safest.";
    return "";
  }

  /* ---------- Render ---------- */

  var current = null;
  var canvas = $("canvas");
  function render() {
    var text = payload();
    var warn = "";
    current = null;
    if (text) {
      try { current = build(text); }
      catch (e) { warn = "That's too much to fit in one QR code. Try shorter text or lower error correction."; }
    }
    $("placeholder").hidden = !!current;
    $("paper").classList.toggle("transparent", prefs.transparent);
    ["dl-png", "dl-svg", "copy-img"].forEach(function (id) { $(id).disabled = !current; });

    if (current) {
      draw(canvas, current, 1024);
      var what = prefs.mode === "wifi" ? "joins <strong>" + ts.escapeHtml(prefs.ssid) + "</strong>"
        : prefs.mode === "link" ? "opens <strong>" + ts.escapeHtml(text) + "</strong>"
        : "shows " + text.length + " characters of text";
      $("caption").innerHTML = "Scans to: " + what + "<br>Version " + current.version + " · " + current.modules + "×" + current.modules;
      warn = warn || contrastWarning();
      if (prefs.mode === "link" && !/^https?:\/\/[^\s/]+\.[^\s/]+/i.test(text) && /^https?:/i.test(text)) {
        warn = warn || "That doesn't look like a full web address. Double-check it before printing.";
      }
    } else {
      $("caption").textContent = "";
    }
    $("warn").hidden = !warn;
    $("warn").textContent = warn;
  }

  var timer;
  function scheduleRender() { clearTimeout(timer); timer = setTimeout(render, 90); }

  /* ---------- Wire inputs ---------- */

  function setMode(mode) {
    prefs.mode = mode;
    Array.prototype.forEach.call(document.querySelectorAll("[data-mode]"), function (b) {
      b.setAttribute("aria-pressed", String(b.getAttribute("data-mode") === mode));
      b.setAttribute("aria-selected", String(b.getAttribute("data-mode") === mode));
    });
    Array.prototype.forEach.call(document.querySelectorAll("[data-panel]"), function (p) {
      p.hidden = p.getAttribute("data-panel") !== mode;
    });
  }
  function setStyle(style) {
    prefs.style = style;
    Array.prototype.forEach.call(document.querySelectorAll("[data-style]"), function (b) {
      b.setAttribute("aria-pressed", String(b.getAttribute("data-style") === style));
    });
  }
  function paintColors() {
    $("fg-label").textContent = prefs.fg;
    $("bg-label").textContent = prefs.bg;
    $("in-bg").disabled = prefs.transparent;
  }

  document.querySelector(".mode-tabs").addEventListener("click", function (e) {
    var b = e.target.closest("[data-mode]");
    if (!b) return;
    setMode(b.getAttribute("data-mode"));
    save(); render();
    var first = document.querySelector('[data-panel="' + prefs.mode + '"] input, [data-panel="' + prefs.mode + '"] textarea');
    if (first) first.focus();
  });
  Array.prototype.forEach.call(document.querySelectorAll("[data-style]"), function (b) {
    b.addEventListener("click", function () { setStyle(b.getAttribute("data-style")); save(); render(); });
  });

  function bind(id, key, prop, evt) {
    var node = $(id);
    node[prop] = prefs[key];
    node.addEventListener(evt || "input", function () {
      prefs[key] = node[prop];
      if (key === "fg" || key === "bg" || key === "transparent") paintColors();
      if (key === "sec") $("pass-field").hidden = prefs.sec === "nopass";
      if (key === "text") $("text-count").textContent = node.value.length + " characters";
      save();
      scheduleRender();
    });
  }
  bind("in-link", "link", "value");
  bind("in-text", "text", "value");
  bind("in-ssid", "ssid", "value");
  bind("in-sec", "sec", "value", "change");
  bind("in-hidden", "hidden", "checked", "change");
  bind("in-fg", "fg", "value");
  bind("in-bg", "bg", "value");
  bind("in-transparent", "transparent", "checked", "change");
  bind("in-margin", "margin", "checked", "change");
  bind("in-ecc", "ecc", "value", "change");
  bind("in-size", "size", "value", "change");
  $("in-pass").addEventListener("input", scheduleRender);
  $("pass-toggle").addEventListener("click", function () {
    var p = $("in-pass");
    var show = p.type === "password";
    p.type = show ? "text" : "password";
    this.setAttribute("aria-label", show ? "Hide password" : "Show password");
    this.title = this.getAttribute("aria-label");
  });

  /* ---------- Export ---------- */

  function fileBase() {
    if (prefs.mode === "wifi") return "wifi-" + (prefs.ssid || "network");
    if (prefs.mode === "link") {
      try { return "qr-" + new URL(payload()).hostname.replace(/^www\./, ""); } catch (e) {}
    }
    return "qr-code";
  }
  function safeName(s) { return s.replace(/[^a-z0-9.-]+/gi, "-").replace(/^-+|-+$/g, "").slice(0, 60) || "qr-code"; }
  function pngBlob() {
    var c = document.createElement("canvas");
    draw(c, current, parseInt(prefs.size, 10));
    return new Promise(function (resolve, reject) {
      c.toBlob(function (b) { b ? resolve(b) : reject(new Error("toBlob failed")); }, "image/png");
    });
  }

  $("dl-png").addEventListener("click", function () {
    if (!current) return;
    pngBlob().then(function (b) { ts.downloadBlob(b, safeName(fileBase()) + ".png"); });
  });
  $("dl-svg").addEventListener("click", function () {
    if (!current) return;
    ts.downloadBlob(new Blob([toSvg(current)], { type: "image/svg+xml" }), safeName(fileBase()) + ".svg");
  });
  $("copy-img").addEventListener("click", function () {
    if (!current) return;
    if (!navigator.clipboard || !window.ClipboardItem) { ts.toast("This browser can't copy images. Use Download instead."); return; }
    // Safari needs the ClipboardItem created synchronously with a promise inside.
    navigator.clipboard.write([new ClipboardItem({ "image/png": pngBlob() })])
      .then(function () { ts.toast("QR code copied"); })
      .catch(function () { ts.toast("Couldn't copy. Try Download instead."); });
  });

  /* ---------- Start ---------- */

  setMode(prefs.mode);
  setStyle(prefs.style);
  paintColors();
  $("pass-field").hidden = prefs.sec === "nopass";
  $("text-count").textContent = prefs.text.length + " characters";
  render();
})();
