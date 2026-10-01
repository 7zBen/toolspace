# toolspace

Everyday tools that run entirely in the browser. Hosted on GitHub Pages.

- **Clock**: digital or analog, five faces, time zones, fullscreen
- **Link Queuer**: paste links, open them one by one
- **QR Maker**: links, text or Wi-Fi to PNG/SVG

## Layout

```
index.html            home
tools/<slug>/         one folder per tool
assets/site.css       shared styles + light/dark tokens
assets/site.js        sidebar, topbar, theme, icons, toast; the NAV list of pages
assets/qrcode.min.js  qrcode-generator (MIT)
```

To add a tool: create `tools/<slug>/index.html` (copy an existing one for the head and
`<main>` shell), then add an entry to `NAV` in `assets/site.js`. The sidebar and home cards
read from that list.

No build step. Preview locally with `python3 -m http.server` and open http://localhost:8000.
