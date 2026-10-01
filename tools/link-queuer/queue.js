/* Link Queuer: paste links, open them one at a time. Same storage as the original tool. */
(function () {
  "use strict";
  var ts = window.toolspace;
  // Same key and item shape as the original Link Queuer, so an existing queue carries over.
  var KEY = "link-queuer-v1";
  var MAX_ITEMS = 5000;
  var RENDER_LIMIT = 300;
  var UNDO_LIMIT = 30;

  var $ = function (id) { return document.getElementById(id); };
  var state = { items: [], openedCount: 0, undo: [] };

  /* ---------- Parsing ---------- */

  var FILE_EXT = /\.(txt|md|csv|json|js|ts|css|html?|xml|png|jpe?g|gif|webp|svg|pdf|docx?|xlsx?|pptx?|zip|exe|dmg|mp[34]|mov|py|sh)$/i;

  function isHttpUrl(value) {
    try {
      var u = new URL(value);
      return (u.protocol === "http:" || u.protocol === "https:") && u.hostname.indexOf(".") > 0;
    } catch (e) { return false; }
  }
  function trimTrailing(url) {
    // Drop punctuation that's sentence, not URL, but keep balanced brackets (Wikipedia-style links).
    for (;;) {
      var last = url.slice(-1);
      if (/[.,;:!?'"*]/.test(last)) { url = url.slice(0, -1); continue; }
      if (last === ")" && (url.split("(").length < url.split(")").length)) { url = url.slice(0, -1); continue; }
      if (last === "]" && (url.split("[").length < url.split("]").length)) { url = url.slice(0, -1); continue; }
      if (last === ">" || last === "}") { url = url.slice(0, -1); continue; }
      return url;
    }
  }
  function extractUrls(text) {
    text = String(text || "");
    var found = [];
    var full = /\bhttps?:\/\/[^\s<>"'`]+/gi;
    // Blank out full URLs with same-length padding so positions still line up for sorting.
    text = text.replace(full, function (m, at) {
      found.push({ at: at, url: trimTrailing(m) });
      return " ".repeat(m.length);
    });
    var bare = /(^|[\s(\[<"'])((?:www\.)?(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,24}(?::\d{2,5})?(?:\/[^\s<>"'`]*)?)/gi;
    var m;
    while ((m = bare.exec(text))) {
      var token = trimTrailing(m[2]);
      var host = token.split(/[/:]/)[0];
      if (FILE_EXT.test(host)) continue;
      found.push({ at: m.index + m[1].length, url: "https://" + token });
    }
    found.sort(function (a, b) { return a.at - b.at; });
    var seen = new Set();
    return found.map(function (f) { return f.url; }).filter(function (u) {
      if (!isHttpUrl(u)) return false;
      var key = normal(u);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }
  function normal(url) {
    try { return new URL(url).href; } catch (e) { return url; }
  }
  function titleFromUrl(url) {
    try {
      var u = new URL(url);
      var host = u.hostname.replace(/^www\./, "");
      var path = u.pathname;
      try { path = decodeURIComponent(path); } catch (e) {}
      var last = path.replace(/\/+$/, "").split("/").filter(Boolean).pop() || "";
      var pretty = last.replace(/[-_+]+/g, " ").replace(/\.[a-z0-9]{1,5}$/i, "").trim();
      return pretty ? host + " — " + pretty : host;
    } catch (e) { return url; }
  }
  function hostOf(url) {
    try { return new URL(url).hostname.replace(/^www\./, ""); } catch (e) { return "?"; }
  }
  function hueOf(text) {
    var h = 0;
    for (var i = 0; i < text.length; i++) h = (h * 31 + text.charCodeAt(i)) % 360;
    return h;
  }
  function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 8); }

  /* ---------- State ---------- */

  function load() {
    var saved = ts.store.get(KEY, null);
    if (!saved) return;
    if (Array.isArray(saved.items)) {
      state.items = saved.items.filter(function (it) { return it && typeof it.id === "string" && isHttpUrl(it.url); });
    }
    if (Number.isFinite(saved.openedCount) && saved.openedCount >= 0) state.openedCount = saved.openedCount;
    if (Array.isArray(saved.undoStack)) state.undo = saved.undoStack.slice(-UNDO_LIMIT);
  }
  function save() {
    var ok = ts.store.set(KEY, { items: state.items, openedCount: state.openedCount, undoStack: state.undo });
    if (!ok) ts.toast("Couldn't save. Browser storage is full or blocked.");
  }
  function remaining() { return state.items.filter(function (it) { return !it.done; }); }
  function pushUndo(entry) {
    state.undo.push(entry);
    if (state.undo.length > UNDO_LIMIT) state.undo.shift();
  }
  function commit() {
    // Finished links are only kept while undo might still need them.
    var needed = new Set(state.undo.map(function (e) { return e.id; }));
    state.items = state.items.filter(function (it) { return !it.done || needed.has(it.id); });
    save();
    render();
  }

  function addUrls(urls, replace) {
    var before = replace ? [] : state.items;
    var existing = new Set(before.filter(function (it) { return !it.done; }).map(function (it) { return normal(it.url); }));
    var incoming = urls.filter(function (u) { return !existing.has(normal(u)); }).map(function (u) {
      return { id: uid(), url: u, title: titleFromUrl(u), done: false };
    });
    if (replace) {
      pushUndo({ action: "replace", items: state.items });
      state.items = incoming.slice(0, MAX_ITEMS);
    } else {
      // Drop finished items first so the cap only counts what's still useful.
      var kept = state.items.filter(function (it) { return !it.done; });
      var room = Math.max(0, MAX_ITEMS - kept.length);
      if (incoming.length > room) ts.toast("Queue is capped at " + MAX_ITEMS + " links");
      if (incoming.length) pushUndo({ action: "add", ids: incoming.slice(0, room).map(function (it) { return it.id; }) });
      state.items = state.items.concat(incoming.slice(0, room));
    }
    commit();
    return incoming.length;
  }

  function finish(id, action) {
    var item = state.items.find(function (it) { return it.id === id; });
    if (!item || item.done) return;
    pushUndo({ action: action, id: id });
    item.done = true;
    item.openedAt = Date.now();
    if (action === "open") state.openedCount += 1;
    if (action === "skip") item.skipped = true;
    commit();
    if (action === "skip") ts.toast("Skipped " + hostOf(item.url), { label: "Undo", run: undo });
  }

  function undo() {
    var e = state.undo.pop();
    if (!e) return;
    if (e.action === "open" || e.action === "skip") {
      var item = state.items.find(function (it) { return it.id === e.id; });
      if (item) {
        item.done = false;
        delete item.openedAt;
        delete item.skipped;
        // Put it back at the front of the line.
        state.items = [item].concat(state.items.filter(function (it) { return it !== item; }));
      }
      if (e.action === "open" && state.openedCount > 0) state.openedCount -= 1;
    } else if (e.action === "add") {
      var ids = new Set(e.ids);
      state.items = state.items.filter(function (it) { return !ids.has(it.id); });
    } else if (e.action === "clear" || e.action === "replace") {
      state.items = e.items;
    }
    commit();
    ts.toast("Undone");
  }

  function openUrl(url) {
    var a = document.createElement("a");
    a.href = url;
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  /* ---------- Render ---------- */

  function avatar(url) {
    var host = hostOf(url);
    return '<span class="avatar" style="background: hsl(' + hueOf(host) + ' 55% 52%)" aria-hidden="true">' +
      ts.escapeHtml(host.charAt(0)) + "</span>";
  }
  function info(item) {
    return '<span class="item-info"><span class="item-title">' + ts.escapeHtml(item.title || item.url) + "</span>" +
      '<span class="item-url">' + ts.escapeHtml(item.url) + "</span></span>";
  }
  function linkAttrs(item, action) {
    return 'href="' + ts.escapeHtml(item.url) + '" target="_blank" rel="noopener noreferrer" data-id="' + item.id + '" data-act="' + action + '"';
  }

  function render() {
    var left = remaining();
    var query = $("filter").value.trim().toLowerCase();

    $("left-pill").textContent = left.length + " left";
    $("opened-pill").textContent = state.openedCount + " opened";
    document.title = (left.length ? "(" + left.length + ") " : "") + "Link Queuer · toolspace";
    $("empty").hidden = left.length > 0;
    $("queue").hidden = left.length === 0;
    $("undo").disabled = state.undo.length === 0;
    $("copy-all").disabled = $("export").disabled = $("clear").disabled = left.length === 0;
    if (!left.length) return;

    var next = left[0];
    $("up-next").innerHTML =
      '<span class="up-next-label">Up next</span>' + avatar(next.url) + info(next) +
      '<div class="up-next-actions">' +
        '<a class="button button-primary" ' + linkAttrs(next, "open") + ">" + ts.icon("external", "icon-sm") + " Open &amp; remove</a>" +
        '<a class="button button-secondary" ' + linkAttrs(next, "peek") + ' title="Open but keep it in the queue">' + ts.icon("keep", "icon-sm") + " Open, keep</a>" +
        '<button class="button button-ghost" type="button" data-id="' + next.id + '" data-act="skip">' + ts.icon("skip", "icon-sm") + " Skip</button>" +
      "</div>";

    var rest = left.slice(1);
    $("rest").hidden = rest.length === 0;
    var shown = query ? rest.filter(function (it) {
      return it.url.toLowerCase().indexOf(query) >= 0 || String(it.title).toLowerCase().indexOf(query) >= 0;
    }) : rest;
    $("rest-label").textContent = query ? shown.length + " match" + (shown.length === 1 ? "" : "es") : "Then · " + rest.length;

    var html = shown.slice(0, RENDER_LIMIT).map(function (it) {
      return '<li class="queue-item">' + avatar(it.url) + info(it) +
        '<span class="item-actions">' +
          '<a class="icon-button" ' + linkAttrs(it, "open") + ' aria-label="Open and remove" title="Open and remove">' + ts.icon("external") + "</a>" +
          '<button class="icon-button skip" type="button" data-id="' + it.id + '" data-act="skip" aria-label="Skip" title="Remove without opening">' + ts.icon("skip") + "</button>" +
        "</span></li>";
    }).join("");
    if (shown.length > RENDER_LIMIT) html += '<li class="more-note">+ ' + (shown.length - RENDER_LIMIT) + " more</li>";
    if (!shown.length && query) html = '<li class="more-note">Nothing matches “' + ts.escapeHtml(query) + "”</li>";
    $("list").innerHTML = html;
  }

  /* ---------- Events ---------- */

  // One delegated handler covers the up-next card and every row.
  $("queue").addEventListener("click", function (e) {
    var t = e.target.closest("[data-act]");
    if (!t) return;
    var act = t.getAttribute("data-act");
    // Links open themselves via href; we just update the queue a beat later.
    if (act === "open") setTimeout(function () { finish(t.getAttribute("data-id"), "open"); }, 0);
    else if (act === "skip") finish(t.getAttribute("data-id"), "skip");
  });

  function addFromPaste(replace) {
    var urls = extractUrls($("paste").value);
    if (!urls.length) { ts.toast("No links found in that text"); return; }
    if (replace && remaining().length && !confirm("Replace the " + remaining().length + " links in your queue?")) return;
    var added = addUrls(urls, replace);
    $("paste").value = "";
    ts.toast(added ? "Added " + added + (added === 1 ? " link" : " links") : "Those are all already in the queue");
  }
  $("add").addEventListener("click", function () { addFromPaste(false); });
  $("replace").addEventListener("click", function () { addFromPaste(true); });
  $("paste").addEventListener("keydown", function (e) {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); addFromPaste(false); }
  });

  function readFile(file) {
    file.text().then(function (text) {
      var urls = extractUrls(text);
      var added = urls.length ? addUrls(urls, false) : 0;
      ts.toast(added ? "Added " + added + " from " + file.name : "No new links in " + file.name);
    }).catch(function () { ts.toast("Couldn't read that file"); });
  }
  $("file").addEventListener("change", function (e) {
    var f = e.target.files && e.target.files[0];
    e.target.value = "";
    if (f) readFile(f);
  });
  var drop = $("drop");
  ["dragenter", "dragover"].forEach(function (n) {
    drop.addEventListener(n, function (e) { e.preventDefault(); drop.classList.add("over"); });
  });
  ["dragleave", "drop"].forEach(function (n) {
    drop.addEventListener(n, function () { drop.classList.remove("over"); });
  });
  drop.addEventListener("drop", function (e) {
    var f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
    if (f) { e.preventDefault(); readFile(f); }
    // Dropped text falls through to the textarea as normal.
  });

  $("filter").addEventListener("input", render);
  $("undo").addEventListener("click", undo);
  $("copy-all").addEventListener("click", function () {
    ts.copyText(remaining().map(function (it) { return it.url; }).join("\n"))
      .then(function () { ts.toast("Copied " + remaining().length + " links"); })
      .catch(function () { ts.toast("Couldn't copy"); });
  });
  $("export").addEventListener("click", function () {
    var text = remaining().map(function (it) { return it.url; }).join("\n") + "\n";
    ts.downloadBlob(new Blob([text], { type: "text/plain" }), "links.txt");
  });
  $("clear").addEventListener("click", function () {
    var n = remaining().length;
    if (!n) return;
    pushUndo({ action: "clear", items: state.items });
    state.items = [];
    commit();
    ts.toast("Cleared " + n + " links", { label: "Undo", run: undo });
  });

  document.addEventListener("keydown", function (e) {
    if (e.target.closest("input, textarea, select")) return;
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "z") { e.preventDefault(); undo(); return; }
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    var next = remaining()[0];
    if (!next) return;
    if (e.key === "Enter" && !e.target.closest("a, button")) { e.preventDefault(); openUrl(next.url); finish(next.id, "open"); }
    else if (e.key.toLowerCase() === "s") { finish(next.id, "skip"); }
  });

  // Another tab changed the queue (e.g. the same page open twice): pick it up.
  window.addEventListener("storage", function (e) {
    if (e.key === KEY) { state = { items: [], openedCount: 0, undo: [] }; load(); render(); }
  });

  load();
  render();
})();
