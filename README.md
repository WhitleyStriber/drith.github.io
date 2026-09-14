# drith.github.io

Site + devlog for **Drith**. Jekyll, no theme gem, no build step you have to run
— GitHub Pages builds it on push.

## The skin

The front page **is** the game's main menu (`drith-godot/world/menu.tscn` and
`world/menu.gd`) — not styled after it, laid out as it, node for node. Every
colour, rule alpha, gap and animation timing in `assets/css/board.css` is a
`Vector2`, theme override or `Color()` literal the menu actually sets, and the
comment on each names where it came from.

**The unit.** The game runs `stretch/mode="canvas_items"` with
`aspect="keep_height"` over a 1920x1080 base, so its logical viewport is always
1080 tall and only its width moves. `--u` is one of those logical pixels
(`100svh / 1080`, clamped by `100vw / 728` so the board letterboxes rather than
overflows), and every length on the page is the menu's own figure times `--u`.
That is what makes the type land where the engine puts it at any window size —
and, because the camera then takes the frame's aspect at a constant vertical
fov, what makes the object land where the engine puts it too, with no offsets.

The rule the language turns on, from `src/hud/core/board_style.h`:

> Nothing is a panel.

A section is declared by a hairline rule with a tracked-out caps label sitting
on it, and the only thing that ever gets a frame is the thing you are currently
pointed at. No cards, no borders, no radii, no drop shadows.

Type is the game's own, self-hosted and subset in `assets/fonts/`: **PT Sans
Narrow Bold** for display (`WORDMARK_FONT` in `menu.gd`, the game's one display
face through `display_face::at()`) and **GNU FreeSans** for UI text (the board's
face, and the project's default theme font). Line heights are the fonts' own
ascent+descent, so a Label's box on the page is the box the engine lays out.
`JetBrains Mono` figures are for the document pages, which the menu has no
equivalent of.

The ground is generated, not an image. `assets/js/stage.js` is one WebGL canvas
carrying menu.tscn's whole stack in its order — the flat void,
`shaders/menu_field.gdshader`, the Bloom gradient, the **real Drith_01 mesh**
(exported out of the .blend to `assets/models/drith_01.json`) drawn as a dark
Fresnel-lit hull under an emissive wireframe, and the Vignette gradient. The two
spatial shaders are ported line for line and run against a real depth buffer, so
the wireframe's hidden-line culling is the hull's depth doing the job it does in
the engine. `assets/js/paint.js` is `shaders/paint_stroke.gdshader`, the marker
under COMING 202X.

Where it departs, and why:

- The **document pages** (devlog, posts) reflow and are set for reading. They
  keep the board's language and drop its fixed geometry — a column of paragraphs
  pinned to a 1080-tall frame is a scroll bar, not a screen — and they take a CRT
  scanline overlay the menu does not have.
- The 3D pass is supersampled rather than MSAA'd, and the Environment's glow is
  five mip levels rather than seven. At this size the rest are below a pixel.
- Below a 1.15 aspect the camera slides back to the middle and the object dims,
  because the game never renders a portrait window and a phone does.

## Publishing

1. Push to `main`.
2. Repo **Settings → Pages → Build and deployment → Source: Deploy from a
   branch**, branch `main`, folder `/ (root)`.
3. First build takes a couple of minutes. Live at
   `https://whitleystriber.github.io/drith.github.io/`.

### If you rename the repo

The repo is `WhitleyStriber/drith.github.io`, which Pages treats as a **project
site**, so every URL is prefixed with `/drith.github.io`. That prefix is handled
by `relative_url` — don't hardcode paths.

Rename the repo to `whitleystriber.github.io` (making it a **user site**), or
point a custom domain at it, and update `_config.yml`:

```yaml
url:     "https://whitleystriber.github.io"   # or https://yourdomain.com
baseurl: ""
```

## Server status

The PLAY panel can show whether the game server is actually up. A browser can't
probe a UDP port, so `tools/status/status_server.py` runs on the box next to
the game server, checks the port, and answers JSON over HTTP; point
`status_url` in `_config.yml` at it. Setup — including the HTTPS requirement,
which will bite you otherwise — is in [tools/status/README.md](tools/status/README.md).

Leave `status_url` empty and nothing changes: the panel reads `server_ip` at
build time, so an address means online and no address means offline.

## The resume page

`/resume/` is Andrew's resume, and nothing on the site links to it — it carries
`noindex, nofollow` and is not in any listing, so it is reached only by its
address. (The repo is public, so the path itself is not a secret from anyone
reading the source.)

It is the resume repo's **Human** sheet on the web, light and dark, with the
PDF to download. The words are never copied by hand: `tools/export_resume.py`
reads that repo's `resume-identity.tex` and `resume-content.tex` and answers
their vocabulary in HTML, the way each LaTeX driver does. After changing the
resume (and rebuilding its PDFs with xelatex):

```bash
python3 tools/export_resume.py            # reads ../resume by default
```

That rewrites `resume/index.html` and brings over the PDFs, the painted
strokes, the paper tiles, web-sized showcase plates and Inter as woff2.
`resume/resume.css` and `resume/resume.js` are the look and the motion, and are
hand-written — the export never touches them.

## Writing a devlog entry

Drop a file in `_posts/` named `YYYY-MM-DD-some-slug.md`:

```markdown
---
title: "What I built"
date: 2026-08-14
description: >-        # optional — used for og:description
  One or two sentences.
---

Body in Markdown. `code`, > blockquotes, ## headings, lists and images all have
styles already. A raw `<ul class="thanks">` flows into columns, for credits.
```

That's it — `/devlog/` lists everything newest first, and each post gets
prev/next links.

## Layout

```
_config.yml              site title, release string, baseurl, server address
_includes/server.html    the PLAY panel — access code or server status
_layouts/default.html    the stage canvas + head
_layouts/post.html       devlog entry + prev/next
index.html               the board — menu.tscn's Content, node for node
devlog.html              all entries                    → /devlog/
_posts/                  Markdown entries
assets/css/board.css     the whole skin (palette, --u and type at the top)
assets/js/stage.js       void, field, bloom, the object, vignette — in WebGL
assets/js/paint.js       the marker under COMING 202X
assets/js/site.js        UI sound, the turning rule, the PLAY panel, status
assets/models/           the Drith base, exported out of Drith_01.blend
assets/fonts/            the game's faces, subset — see the README in there
```

Re-exporting the mesh, if the model changes:

```bash
blender -b .../Drith_01.blend --python export_drith.py -- assets/models/drith_01.json
```

The exporter must read **split** normals (`mesh.corner_normals`), not vertex
normals — the base is a hard-surface model and smoothing its creases makes the
hull's Fresnel go soft over faces that should be flat.

Editing the palette: everything is a CSS custom property in the `:root` block at
the top of `board.css`, named to match the engine (`--void` is `menu.tscn`'s
Void, `--bone` its Hair rule, `--live` is `C_LIVE`, `--paint` is `PAINT_INK`).
Each one carries the `Color()` literal it came from in a comment, so a change
here can be checked against the game rather than eyeballed.

## Local preview (optional)

```bash
bundle install
bundle exec jekyll serve   # http://127.0.0.1:4000/drith.github.io/
```
