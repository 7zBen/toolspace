(function () {
  var KEY = "site-theme";
  function preferred() {
    try {
      var s = localStorage.getItem(KEY);
      if (s === "light" || s === "dark") return s;
    } catch (e) {}
    return window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }
  function apply(t) { document.documentElement.setAttribute("data-theme", t); }
  apply(preferred());

  var SUN = '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="4"/><path d="M12 3v2M12 19v2M5.2 5.2l1.4 1.4M17.4 17.4l1.4 1.4M3 12h2M19 12h2M5.2 18.8l1.4-1.4M17.4 6.6l1.4-1.4"/></svg>';
  var MOON = '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M16 3.3A8.5 8.5 0 1 0 20.7 14 7 7 0 0 1 16 3.3z"/></svg>';
  var VOL = '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9v6h3l5 4V5L7 9H4z"/><path d="M16 9.5a3.5 3.5 0 0 1 0 5"/><path d="M18.2 7.2a6.5 6.5 0 0 1 0 9.6"/></svg>';
  var MUTE = '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9v6h3l5 4V5L7 9H4z"/><path d="M21 9l-6 6M15 9l6 6"/></svg>';

  window.setMuteIcon = function (btn, muted) {
    if (!btn) return;
    btn.classList.add("icon-btn");
    btn.setAttribute("aria-label", muted ? "Unmute" : "Mute");
    btn.setAttribute("title", muted ? "Unmute" : "Mute");
    btn.innerHTML = muted ? MUTE : VOL;
  };

  function themeToggle() {
    var b = document.getElementById("themeToggle");
    if (!b) {
      b = document.createElement("button");
      b.id = "themeToggle";
      b.type = "button";
      b.className = "icon-btn";
      var bar = document.querySelector(".bar");
      var header = document.querySelector("header");
      if (bar) {
        var end = bar.querySelector(".bar-end");
        if (!end) {
          end = document.createElement("div");
          end.className = "bar-end";
          Array.from(bar.children).forEach(function (ch) {
            if (ch.tagName === "A") return;
            end.appendChild(ch);
          });
          bar.appendChild(end);
        }
        end.appendChild(b);
      } else if (header) header.appendChild(b);
      else document.body.appendChild(b);
      b.addEventListener("click", function () {
        var next = document.documentElement.getAttribute("data-theme") === "dark" ? "light" : "dark";
        try { localStorage.setItem(KEY, next); } catch (e) {}
        apply(next);
        paint();
      });
    }
    function paint() {
      var t = document.documentElement.getAttribute("data-theme");
      b.innerHTML = t === "dark" ? SUN : MOON;
      b.setAttribute("aria-label", t === "dark" ? "Light mode" : "Dark mode");
      b.setAttribute("title", t === "dark" ? "Light mode" : "Dark mode");
    }
    paint();
  }

  function panic() {
    if (!/\/games\//.test(location.pathname) || /\/games\/slope(\/|$)/.test(location.pathname)) return;
    var pc = window.matchMedia("(hover: hover) and (pointer: fine)").matches && window.innerWidth >= 801;
    if (!pc) return;
    document.body.classList.add("game-page");
    var realTitle = document.title;
    var cover = document.createElement("div");
    cover.className = "cover";
    cover.innerHTML = '<div class="calc"><div class="calc-bar"><span>Calculator</span><button type="button" id="sciToggle">Scientific</button></div><div class="calc-top"><span class="calc-sub" id="calcSub"></span><span id="calcDisp">0</span></div><div class="calc-pad" id="calcPad"></div></div>';
    document.body.appendChild(cover);
    var btn = document.createElement("button");
    btn.type = "button";
    btn.className = "panic-btn";
    btn.setAttribute("aria-label", "Cover");
    btn.textContent = "!";
    document.body.appendChild(btn);

    var acc = null, cur = "0", op = null, fresh = true, sci = false;
    var disp = cover.querySelector("#calcDisp");
    var sub = cover.querySelector("#calcSub");
    var pad = cover.querySelector("#calcPad");
    var sciBtn = cover.querySelector("#sciToggle");
    function fmt(x) {
      if (!isFinite(x)) return "Error";
      return String(parseFloat(Number(x).toPrecision(12)));
    }
    function show() {
      disp.textContent = cur;
      sub.textContent = acc != null && op ? fmt(acc) + " " + op : "";
    }
    function val() { return parseFloat(cur) || 0; }
    function bin(next) {
      if (acc != null && op && !fresh) applyOp();
      acc = val();
      op = next;
      fresh = true;
    }
    function applyOp() {
      var x = val();
      if (op === "+") acc += x;
      else if (op === "−") acc -= x;
      else if (op === "×") acc *= x;
      else if (op === "÷") acc = x === 0 ? NaN : acc / x;
      else if (op === "^") acc = Math.pow(acc, x);
      else acc = x;
      cur = fmt(acc);
      op = null;
      fresh = true;
    }
    function deg() { return val() * Math.PI / 180; }
    function digit(d) {
      if (fresh || cur === "0" || cur === "Error") { cur = d === "." ? "0." : d; fresh = false; }
      else if (d === ".") { if (cur.indexOf(".") < 0) cur += "."; }
      else cur += d;
    }
    function build() {
      pad.textContent = "";
      var keys = sci ? [
        { k: "sin", cls: "fn", fn: function () { cur = fmt(Math.sin(deg())); fresh = true; } },
        { k: "cos", cls: "fn", fn: function () { cur = fmt(Math.cos(deg())); fresh = true; } },
        { k: "tan", cls: "fn", fn: function () { cur = fmt(Math.tan(deg())); fresh = true; } },
        { k: "ln", cls: "fn", fn: function () { cur = fmt(Math.log(val())); fresh = true; } },
        { k: "log", cls: "fn", fn: function () { cur = fmt(Math.log10(val())); fresh = true; } },
        { k: "π", cls: "fn", fn: function () { cur = fmt(Math.PI); fresh = true; } },
        { k: "e", cls: "fn", fn: function () { cur = fmt(Math.E); fresh = true; } },
        { k: "√", cls: "fn", fn: function () { cur = fmt(Math.sqrt(val())); fresh = true; } },
        { k: "x²", cls: "fn", fn: function () { cur = fmt(val() * val()); fresh = true; } },
        { k: "xʸ", cls: "fn", fn: function () { bin("^"); } },
        { k: "AC", cls: "fn", fn: function () { acc = null; cur = "0"; op = null; fresh = true; } },
        { k: "CE", cls: "fn", fn: function () { cur = "0"; fresh = true; } },
        { k: "%", cls: "fn", fn: function () { cur = fmt(val() / 100); fresh = true; } },
        { k: "1/x", cls: "fn", fn: function () { cur = fmt(val() === 0 ? NaN : 1 / val()); fresh = true; } },
        { k: "÷", cls: "op", fn: function () { bin("÷"); } },
        { k: "7" }, { k: "8" }, { k: "9" },
        { k: "n!", cls: "fn", fn: function () {
          var n = Math.floor(val()), r = 1;
          if (n < 0 || n > 170) cur = "Error";
          else { for (var i = 2; i <= n; i++) r *= i; cur = fmt(r); }
          fresh = true;
        } },
        { k: "×", cls: "op", fn: function () { bin("×"); } },
        { k: "4" }, { k: "5" }, { k: "6" },
        { k: "eˣ", cls: "fn", fn: function () { cur = fmt(Math.exp(val())); fresh = true; } },
        { k: "−", cls: "op", fn: function () { bin("−"); } },
        { k: "1" }, { k: "2" }, { k: "3" },
        { k: "±", cls: "fn", fn: function () { cur = fmt(-val()); } },
        { k: "+", cls: "op", fn: function () { bin("+"); } },
        { k: "0" }, { k: "." },
        { k: "10ˣ", cls: "fn", fn: function () { cur = fmt(Math.pow(10, val())); fresh = true; } },
        { k: "=", cls: "eq", fn: function () { if (op) applyOp(); acc = null; } }
      ] : [
        { k: "AC", cls: "fn", fn: function () { acc = null; cur = "0"; op = null; fresh = true; } },
        { k: "CE", cls: "fn", fn: function () { cur = "0"; fresh = true; } },
        { k: "%", cls: "fn", fn: function () { cur = fmt(val() / 100); fresh = true; } },
        { k: "÷", cls: "op", fn: function () { bin("÷"); } },
        { k: "7" }, { k: "8" }, { k: "9" },
        { k: "×", cls: "op", fn: function () { bin("×"); } },
        { k: "4" }, { k: "5" }, { k: "6" },
        { k: "−", cls: "op", fn: function () { bin("−"); } },
        { k: "1" }, { k: "2" }, { k: "3" },
        { k: "+", cls: "op", fn: function () { bin("+"); } },
        { k: "±", cls: "fn", fn: function () { cur = fmt(-val()); } },
        { k: "0" }, { k: "." },
        { k: "=", cls: "eq", fn: function () { if (op) applyOp(); acc = null; } }
      ];
      keys.forEach(function (item) {
        var b = document.createElement("button");
        b.type = "button";
        b.textContent = item.k;
        if (item.cls) b.className = item.cls;
        b.addEventListener("click", function () {
          if (item.fn) item.fn();
          else digit(item.k);
          show();
        });
        pad.appendChild(b);
      });
    }
    sciBtn.addEventListener("click", function () {
      sci = !sci;
      cover.classList.toggle("sci", sci);
      sciBtn.textContent = sci ? "Basic" : "Scientific";
      build();
    });
    build();
    show();

    function setOn(on) {
      cover.classList.toggle("show", on);
      document.documentElement.classList.toggle("panic", on);
      document.title = on ? "Calculator" : realTitle;
    }
    btn.addEventListener("click", function () { setOn(!cover.classList.contains("show")); });
    window.addEventListener("keydown", function (e) {
      if (!cover.classList.contains("show")) return;
      e.stopPropagation();
      if (e.key === "Escape") { setOn(false); e.preventDefault(); return; }
      var map = { "/": "÷", "*": "×", "-": "−", "+": "+", Enter: "=", "=": "=", "%": "%", ".": ".", Backspace: "CE" };
      var label = map[e.key] || e.key;
      var hit = Array.prototype.find.call(pad.children, function (c) { return c.textContent === label; });
      if (hit) { e.preventDefault(); hit.click(); }
    }, true);
  }

  function boot() {
    themeToggle();
    panic();
    var m = document.getElementById("mute");
    if (m && !m.querySelector("svg")) {
      window.setMuteIcon(m, /muted/i.test(m.textContent || ""));
    }
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
