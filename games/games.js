/* Games list, with each game's best score where it keeps one. */
(function () {
  "use strict";
  var ts = window.toolspace;

  function bestText(g) {
    if (!g.best) return "";
    var best = parseInt(ts.store.get(g.best, 0), 10) || 0;
    var floor = g.bestLabel === "Level" ? 1 : 0; // everyone starts on level 1
    if (best <= floor) return "";
    return g.bestLabel ? "Best " + g.bestLabel.toLowerCase() + ": " + best : "Best " + best;
  }

  document.getElementById("game-grid").innerHTML = ts.games.map(function (g) {
    return ts.cardHtml(g, bestText(g));
  }).join("");
})();
