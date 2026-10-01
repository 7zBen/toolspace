/* toolspace — shared chrome and helpers.
   Loaded in <head> (not deferred) so the theme is set before first paint.

   Page layouts, chosen with <body data-layout="…">:
     hub  — sidebar + top bar (home, games list)
     app  — slim top bar with a back button (tools, games)
     bare — no chrome at all (clock)                                         */
(function () {
  "use strict";

  var doc = document.documentElement;
  var ROOT = doc.getAttribute("data-root") || "";

  /* ---------- Storage that never throws ---------- */

  var store = {
    get: function (key, fallback) {
      try {
        var raw = localStorage.getItem(key);
        return raw == null ? fallback : JSON.parse(raw);
      } catch (e) { return fallback; }
    },
    set: function (key, value) {
      try { localStorage.setItem(key, JSON.stringify(value)); return true; } catch (e) { return false; }
    }
  };

  /* ---------- Theme ---------- */

  var THEME_KEY = "site-theme";
  var darkQuery = window.matchMedia ? window.matchMedia("(prefers-color-scheme: dark)") : null;

  function savedTheme() {
    try {
      var t = localStorage.getItem(THEME_KEY);
      return t === "light" || t === "dark" ? t : null;
    } catch (e) { return null; }
  }
  function applyTheme(t) {
    doc.setAttribute("data-theme", t);
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", t === "dark" ? "#111925" : "#f6f7f8");
    document.dispatchEvent(new CustomEvent("themechange", { detail: t }));
  }
  function toggleTheme() {
    var next = doc.getAttribute("data-theme") === "dark" ? "light" : "dark";
    try { localStorage.setItem(THEME_KEY, next); } catch (e) {}
    applyTheme(next);
  }
  applyTheme(savedTheme() || (darkQuery && darkQuery.matches ? "dark" : "light"));
  if (darkQuery && darkQuery.addEventListener) {
    darkQuery.addEventListener("change", function (e) {
      if (!savedTheme()) applyTheme(e.matches ? "dark" : "light");
    });
  }

  /* ---------- Icons (24×24, stroked) ---------- */

  var ICONS = {
    home: '<path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V21h14V9.5"/><path d="M10 21v-6h4v6"/>',
    back: '<path d="M19 12H5"/><path d="m11 6-6 6 6 6"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    link: '<path d="M10 13a5 5 0 0 0 7.07 0l3-3a5 5 0 0 0-7.07-7.07l-1.5 1.5"/><path d="M14 11a5 5 0 0 0-7.07 0l-3 3a5 5 0 0 0 7.07 7.07l1.5-1.5"/>',
    qr: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><path d="M14 14h3v3h-3z"/><path d="M21 14v.01"/><path d="M14 21h.01"/><path d="M17.5 21H21v-3.5"/>',
    games: '<rect x="2.5" y="7" width="19" height="11" rx="5.5"/><path d="M7 11v3M5.5 12.5h3"/><path d="M15.5 11.5h.01M18 13.5h.01"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2.5v2M12 19.5v2M4.6 4.6l1.4 1.4M18 18l1.4 1.4M2.5 12h2M19.5 12h2M4.6 19.4 6 18M18 6l1.4-1.4"/>',
    moon: '<path d="M20 14.5A8.5 8.5 0 1 1 9.5 4a7 7 0 0 0 10.5 10.5z"/>',
    menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
    close: '<path d="M6 6l12 12M18 6 6 18"/>',
    arrow: '<path d="M5 12h14"/><path d="m13 6 6 6-6 6"/>',
    external: '<path d="M14 4h6v6"/><path d="M20 4 10 14"/><path d="M19 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h5"/>',
    download: '<path d="M12 4v11"/><path d="m7 10 5 5 5-5"/><path d="M5 20h14"/>',
    copy: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/>',
    undo: '<path d="M9 14 4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/>',
    trash: '<path d="M4 7h16"/><path d="M10 11v6M14 11v6"/><path d="M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12"/><path d="M9 7V4h6v3"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
    expand: '<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>',
    shrink: '<path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5"/>',
    cog: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
    check: '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
    skip: '<path d="m6 6 12 12M18 6 6 18"/>',
    keep: '<path d="M7 4h10v16l-5-4-5 4z"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    file: '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/>',
    wifi: '<path d="M2 9a15 15 0 0 1 20 0"/><path d="M5.5 12.5a10 10 0 0 1 13 0"/><path d="M9 16a5 5 0 0 1 6 0"/><path d="M12 19.5h.01"/>',
    text: '<path d="M5 6h14M5 12h14M5 18h9"/>',
    eye: '<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="3"/>',
    sound: '<path d="M4 9v6h3l5 4V5L7 9H4z"/><path d="M16 9.5a3.5 3.5 0 0 1 0 5"/><path d="M18.5 7a7 7 0 0 1 0 10"/>',
    muted: '<path d="M4 9v6h3l5 4V5L7 9H4z"/><path d="m16 9.5 5 5M21 9.5l-5 5"/>',
    refresh: '<path d="M20 11a8 8 0 0 0-14.5-4.5L4 8"/><path d="M4 4v4h4"/><path d="M4 13a8 8 0 0 0 14.5 4.5L20 16"/><path d="M20 20v-4h-4"/>',
    /* game icons */
    slope: '<path d="m3 19 6-9 4 5 3-4 5 8z"/><circle cx="17" cy="6" r="1.5"/>',
    blocks: '<rect x="3" y="3" width="8" height="8" rx="1.5"/><rect x="13" y="3" width="8" height="8" rx="1.5"/><rect x="3" y="13" width="18" height="8" rx="1.5"/>',
    slide: '<rect x="3" y="3" width="18" height="18" rx="3"/><path d="M12 3v18M3 12h18"/>',
    wordle: '<rect x="2.5" y="8" width="5.5" height="8" rx="1.2"/><rect x="9.25" y="8" width="5.5" height="8" rx="1.2"/><rect x="16" y="8" width="5.5" height="8" rx="1.2"/>',
    tictactoe: '<path d="M9 3v18M15 3v18M3 9h18M3 15h18"/>',
    simon: '<circle cx="12" cy="12" r="9"/><path d="M12 3v18M3 12h18"/>',
    mug: '<path d="M5 6h11v11a3 3 0 0 1-3 3H8a3 3 0 0 1-3-3z"/><path d="M16 9h2a2.5 2.5 0 0 1 0 5h-2"/><path d="M8 3v1M11 2v2M14 3v1"/>',
    mine: '<path d="M6 21V4"/><path d="M6 4h11l-2.5 4L17 12H6"/>',
    candy: '<circle cx="12" cy="12" r="4.5"/><path d="M7.5 12 3 9v6zM16.5 12 21 9v6z"/>'
  };
  function icon(name, cls) {
    return '<svg class="icon' + (cls ? " " + cls : "") + '" viewBox="0 0 24 24" aria-hidden="true">' + (ICONS[name] || "") + "</svg>";
  }

  /* ---------- Registry: every page in the site ---------- */

  var TOOLS = [
    { slug: "clock", name: "Clock", icon: "clock", href: "tools/clock/", tint: "blue",
      blurb: "Full-screen clock. Digital or analog, five faces." },
    { slug: "link-queuer", name: "Link Queuer", icon: "link", href: "tools/link-queuer/", tint: "mint",
      blurb: "Paste a list of links and open them one by one." },
    { slug: "qr", name: "QR Maker", icon: "qr", href: "tools/qr/", tint: "purple",
      blurb: "QR codes for links, text or Wi-Fi. PNG or SVG." }
  ];
  var GAMES = [
    { slug: "block-fit", name: "Block Fit", icon: "blocks", tint: "blue", best: "block-fit-best",
      blurb: "Drop pieces on the grid. Full rows and columns clear." },
    { slug: "slide", name: "Slide", icon: "slide", tint: "orange", best: "slide-best",
      blurb: "Join matching tiles. Arrow keys or swipe." },
    { slug: "wordle", name: "Wordle", icon: "wordle", tint: "mint",
      blurb: "Guess the five-letter word in six tries." },
    { slug: "candy-crush", name: "Candy Crush", icon: "candy", tint: "pink", best: "candy-best", bestLabel: "Level",
      blurb: "Swap candies to match three or more." },
    { slug: "minesweeper", name: "Minesweeper", icon: "mine", tint: "red",
      blurb: "Clear the board without hitting a mine." },
    { slug: "fill-the-mug", name: "Fill the Mug", icon: "mug", tint: "orange",
      blurb: "Hold to pour. Let go on the line." },
    { slug: "simon", name: "Simon Says", icon: "simon", tint: "purple", best: "simon-best", bestLabel: "Round",
      blurb: "Watch the pattern, then repeat it." },
    { slug: "tic-tac-toe", name: "Tic Tac Toe", icon: "tictactoe", tint: "blue",
      blurb: "Two players, or play the computer." },
    { slug: "slope", name: "Slope", icon: "slope", tint: "mint", newTab: true,
      blurb: "Roll downhill as long as you can. Opens in a new tab." }
  ];
  GAMES.forEach(function (g) { g.href = "games/" + g.slug + "/"; });

  var NAV = [
    { group: "Overview", items: [{ slug: "home", name: "Home", icon: "home", href: "" }] },
    { group: "Tools", items: TOOLS },
    { group: "Play", items: [{ slug: "games", name: "Games", icon: "games", href: "games/" }] }
  ];

  function url(href) { return ROOT + href || "./"; }

  /* ---------- Small DOM helpers ---------- */

  function el(html) {
    var t = document.createElement("template");
    t.innerHTML = html.trim();
    return t.content.firstChild;
  }
  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  /* ---------- Chrome: hub layout ---------- */

  function brandHtml() {
    return '<a class="brand" href="' + url("") + '" aria-label="toolspace home">' +
      '<span class="brand-mark" aria-hidden="true"><i></i><i></i><i></i><i></i></span>' +
      '<span class="brand-name">toolspace<span>.</span></span></a>';
  }

  function buildSidebar(page) {
    var groups = NAV.map(function (g) {
      var links = g.items.map(function (item) {
        var current = item.slug === page ? ' aria-current="page"' : "";
        return '<a class="nav-link" href="' + url(item.href) + '"' + current + ">" +
          icon(item.icon) + escapeHtml(item.name) + "</a>";
      }).join("");
      return '<div class="nav-group"><p class="nav-label">' + g.group + "</p>" + links + "</div>";
    }).join("");
    return el('<aside class="sidebar" id="sidebar">' + brandHtml() +
      '<nav class="sidebar-nav" aria-label="Site">' + groups + "</nav></aside>");
  }

  function buildTopbar(title) {
    return el(
      '<header class="topbar">' +
        '<div class="topbar-start">' +
          '<button class="icon-button menu-button" type="button" aria-label="Open menu" aria-controls="sidebar" aria-expanded="false">' + icon("menu") + "</button>" +
          '<span class="topbar-title">' + escapeHtml(title) + "</span>" +
        "</div>" +
        '<div class="top-actions">' +
          '<span class="top-time" aria-hidden="true"></span>' +
          '<button class="icon-button theme-toggle" type="button"></button>' +
        "</div>" +
      "</header>"
    );
  }

  function wireMenu(btn, sidebar) {
    var scrim = el('<div class="scrim" aria-hidden="true"></div>');
    document.body.appendChild(scrim);
    function set(open) {
      document.body.classList.toggle("nav-open", open);
      btn.setAttribute("aria-expanded", open ? "true" : "false");
      if (open) { var first = sidebar.querySelector("a"); if (first) first.focus(); }
    }
    btn.addEventListener("click", function () { set(!document.body.classList.contains("nav-open")); });
    scrim.addEventListener("click", function () { set(false); });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && document.body.classList.contains("nav-open")) { set(false); btn.focus(); }
    });
  }

  function wireTopTime(node) {
    function tick() {
      node.textContent = new Date().toLocaleString(undefined, {
        weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit"
      });
    }
    tick();
    setInterval(tick, 1000);
  }

  /* ---------- Chrome: app layout ---------- */

  function buildAppbar(title, backHref, backLabel) {
    return el(
      '<header class="appbar">' +
        '<a class="appbar-back" href="' + url(backHref) + '" aria-label="Back to ' + escapeHtml(backLabel) + '">' +
          icon("back") + '<span class="brand-mark small" aria-hidden="true"><i></i><i></i><i></i><i></i></span></a>' +
        '<h1 class="appbar-title">' + escapeHtml(title) + "</h1>" +
        '<div class="appbar-actions"><button class="icon-button theme-toggle" type="button"></button></div>' +
      "</header>"
    );
  }

  /* Pages can add buttons to the app bar before or after it exists. */
  var pendingActions = [];
  var actionsBox = null;
  function addAction(node) {
    if (actionsBox) actionsBox.insertBefore(node, actionsBox.lastChild);
    else pendingActions.push(node);
  }

  function wireTheme(btn) {
    function paint() {
      var dark = doc.getAttribute("data-theme") === "dark";
      btn.innerHTML = icon(dark ? "sun" : "moon");
      btn.setAttribute("aria-label", dark ? "Switch to light mode" : "Switch to dark mode");
      btn.title = btn.getAttribute("aria-label");
    }
    btn.addEventListener("click", toggleTheme);
    document.addEventListener("themechange", paint);
    paint();
  }

  /* ---------- Toast ---------- */

  var toastEl, toastTimer;
  function toast(message, action) {
    if (!toastEl) {
      toastEl = el('<div class="toast" role="status" aria-live="polite"></div>');
      document.body.appendChild(toastEl);
    }
    toastEl.textContent = message;
    if (action) {
      var b = document.createElement("button");
      b.type = "button";
      b.textContent = action.label;
      b.addEventListener("click", function () { action.run(); hide(); });
      toastEl.appendChild(b);
    }
    toastEl.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(hide, action ? 4500 : 2200);
    function hide() { toastEl.classList.remove("show"); }
  }

  /* ---------- Helpers shared by pages ---------- */

  function copyText(text) {
    if (navigator.clipboard && window.isSecureContext) return navigator.clipboard.writeText(text);
    return new Promise(function (resolve, reject) {
      var ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand("copy") ? resolve() : reject(); } catch (e) { reject(e); }
      ta.remove();
    });
  }

  function downloadBlob(blob, filename) {
    var a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
  }

  function fillIcons(scope) {
    Array.prototype.forEach.call((scope || document).querySelectorAll("[data-icon]"), function (node) {
      node.outerHTML = icon(node.getAttribute("data-icon"), node.getAttribute("data-icon-class") || "");
    });
  }

  /* A link card for a tool or game; `meta` is optional small print under the text. */
  function cardHtml(item, meta) {
    var target = item.newTab ? ' target="_blank" rel="noopener"' : "";
    return '<a class="card" href="' + url(item.href) + '"' + target + ">" +
      '<span class="tint ' + item.tint + '">' + icon(item.icon, "icon-lg") + "</span>" +
      '<span class="card-body"><strong>' + escapeHtml(item.name) + "</strong>" +
      '<span class="card-text">' + escapeHtml(item.blurb) + "</span>" +
      (meta ? '<span class="card-meta">' + escapeHtml(meta) + "</span>" : "") +
      "</span></a>";
  }

  window.toolspace = {
    cardHtml: cardHtml,
    root: ROOT,
    url: url,
    tools: TOOLS,
    games: GAMES,
    icon: icon,
    store: store,
    toast: toast,
    copyText: copyText,
    downloadBlob: downloadBlob,
    escapeHtml: escapeHtml,
    addAction: addAction,
    toggleTheme: toggleTheme
  };

  /* ---------- Boot ---------- */

  function boot() {
    var body = document.body;
    var layout = body.getAttribute("data-layout") || "hub";
    var page = body.getAttribute("data-page") || "";
    var title = body.getAttribute("data-title") || document.title;

    if (layout === "hub") {
      var sidebar = buildSidebar(page);
      body.insertBefore(sidebar, body.firstChild);
      var inner = document.querySelector(".main-inner");
      var topbar = buildTopbar(title);
      inner.insertBefore(topbar, inner.firstChild);
      wireTheme(topbar.querySelector(".theme-toggle"));
      wireMenu(topbar.querySelector(".menu-button"), sidebar);
      wireTopTime(topbar.querySelector(".top-time"));
    } else if (layout === "app") {
      var isGame = /^games\//.test(body.getAttribute("data-back") || "");
      var appbar = buildAppbar(title, body.getAttribute("data-back") || "", isGame ? "games" : "home");
      body.insertBefore(appbar, body.firstChild);
      actionsBox = appbar.querySelector(".appbar-actions");
      pendingActions.forEach(addAction);
      pendingActions = [];
      wireTheme(appbar.querySelector(".theme-toggle"));
    }
    fillIcons();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
