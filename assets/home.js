/* Home: tool and game cards from the shared registry. */
(function () {
  "use strict";
  var ts = window.toolspace;

  // Show a little live state on the Link Queuer card.
  var queue = ts.store.get("link-queuer-v1", null);
  var waiting = queue && Array.isArray(queue.items) ? queue.items.filter(function (i) { return !i.done; }).length : 0;

  document.getElementById("tool-grid").innerHTML = ts.tools.map(function (t) {
    var meta = t.slug === "link-queuer" && waiting ? waiting + (waiting === 1 ? " link" : " links") + " waiting" : "";
    return ts.cardHtml(t, meta);
  }).join("");

  document.getElementById("game-grid").innerHTML = ts.games.slice(0, 6).map(function (g) {
    return ts.cardHtml(g);
  }).join("");
})();
