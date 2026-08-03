# drith.github.io

Site + devlog for **Drith**. Jekyll, no theme gem, no build step you have to run
— GitHub Pages builds it on push.

## The skin

The site is **the board** — the game's main menu (`drith-godot/world/menu.tscn`
and `world/menu.gd`), carried onto the web by way of the approved mockups next
to it in `drith-godot/ui/mockups/`. Every colour, rule alpha and animation
timing in `assets/css/board.css` is the sRGB of a `Color()` literal the menu
actually uses or a shader uniform lifted verbatim, and the comment on each names
where it came from.

The rule the language turns on, from `src/hud/core/board_style.h`:

> Nothing is a panel.

A section is declared by a hairline rule with a tracked-out caps label sitting
on it, and the only thing that ever gets a frame is the thing you are currently
pointed at. No cards, no borders, no radii, no drop shadows.

Type is the game's: **PT Sans Narrow Bold** for display (`WORDMARK_FONT` in
`menu.gd`, the game's one display face through `display_face::at()`) and
**JetBrains Mono** for every figure and readout (`console_style::mono_font`).
Body copy asks for Helvetica metrics from the reader's own system, standing in
for GNU FreeSans — the board's UI face — which is not worth an 850 KB download
for the same letters.

The ground is generated, not an image: `assets/js/field.js` is a port of
`shaders/menu_field.gdshader` (the dot lattice and its travelling light band),
and `assets/js/crystal.js` is the menu's stage object — a dark Fresnel-lit hull
under an emissive wireframe, cross-fading on the same hold/fade loop.

Two places it departs from the mockups, because a website is not a game screen:
the mockups pin a 1600x900 stage and scale it, this reflows; and the CRT
scanline overlay is pulled back on the devlog and post pages, where it lies over
running paragraphs rather than over four words.

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
_config.yml            site title, release string, baseurl, server address
_includes/server.html  the PLAY panel — access code or server status
_layouts/default.html  the ground (field, bloom, vignette, CRT) + head
_layouts/post.html     devlog entry + prev/next
index.html             the board — wordmark, tagline, ledger
devlog.html            all entries                    → /devlog/
_posts/                Markdown entries
assets/css/board.css   the whole skin (palette and type at the top)
assets/js/field.js     the generated background field + CRT power-on
assets/js/crystal.js   the object on the stage
assets/js/site.js      UI sound, the PLAY panel, live server status
```

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
