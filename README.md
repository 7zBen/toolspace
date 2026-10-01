# toolspace

Tools and games that run entirely in the browser. Hosted on GitHub Pages, no build step.

## Layout

```
index.html               home (tools + games)
tools/<slug>/            index.html + its own .css and .js
games/index.html         games list
games/<slug>/            index.html + style.css + game.js
assets/site.css|js       shared styles, theme, page chrome, icons, and the list of every tool and game
assets/game.css|js       shared game bits: sound + mute, best scores, effects, the "!" calculator cover
assets/home.js           home page cards
assets/qrcode.min.js     qrcode-generator (MIT)
```

Pages pick their chrome with `<body data-layout>`: `hub` (sidebar), `app` (slim bar with a back
button) or `bare` (none, used by the clock).

## Adding something

- Tool: create `tools/<slug>/` (copy an existing one), then add it to `TOOLS` in `assets/site.js`.
- Game: create `games/<slug>/` with `index.html`, `style.css`, `game.js`, then add it to `GAMES`
  in `assets/site.js`. Add `data-sound` to `<body>` for a mute button.

The sidebar, home page and games list all read from those two lists.

## Preview locally

`python3 -m http.server` in this folder, then open http://localhost:8000.
