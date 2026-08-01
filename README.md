# drith.github.io

Site + devlog for **Drith**. Jekyll, no theme gem, no build step you have to run
— GitHub Pages builds it on push.

The skin is lifted from the game's in-engine WARDECK panel
(`drith-godot/src/hud/base/wardeck_panel.cpp` and `hud/core/console_style.h`):
same grounds, same schematic green, same hairline borders, pips and mono labels.

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

## Writing a devlog entry

Drop a file in `_posts/` named `YYYY-MM-DD-some-slug.md`:

```markdown
---
title: "What I built"
date: 2026-08-14
build: 0.4.7           # optional — renders as a gold chip
tags: [systems, ui]    # optional — first tag shows on the card
description: >-        # optional — used for the card blurb and og:description
  One or two sentences. Falls back to the post's first paragraph.
---

Body in Markdown. `code`, > blockquotes (styled as CLARIS transmissions),
## headings, lists and images all have styles already.
```

That's it — the index page picks up the newest four, `/devlog/` groups
everything by year, and `/feed.xml` updates.

## Layout

```
_config.yml            site title, release string, baseurl
_layouts/default.html  frame, top bar, tabs, footer
_layouts/post.html     devlog entry + prev/next
index.html             hero, hologram, build status, latest posts, lore teasers
devlog.html            all entries, grouped by year   → /devlog/
lore.html              the five layers                → /lore/
_posts/                Markdown entries
assets/css/wardeck.css the whole skin (design tokens at the top)
assets/js/wardeck.js   status-line typing + year stamp
```

Editing the palette: everything is a CSS custom property in the `:root` block
at the top of `wardeck.css`, named to match the C++ constants (`--acc` is
`HUD_EMBER`, `--card` is `HUD_CARD`, and so on).

## Local preview (optional)

```bash
bundle install
bundle exec jekyll serve   # http://127.0.0.1:4000/drith.github.io/
```
