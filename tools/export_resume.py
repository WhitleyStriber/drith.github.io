#!/usr/bin/env python3
"""The resume, on the web --- a fourth driver for the resume repo's words.

The resume repo holds its words exactly once, in resume-identity.tex and
resume-content.tex, and every sheet it builds answers the same small vocabulary
(CVSection, CVEntry, CVRole, CVBullets, CVSkill, CVProject, CVPlate...) in its own
terms. This is that vocabulary answered in HTML. It reads the two .tex files,
never copies a word by hand, and writes resume/index.html --- so a bullet edited
there lands here on the next run, and there is no web copy to forget.

It also brings over everything the page shows that the resume repo already owns:
the three PDFs, the painted label strokes, the paper tiles, web-sized showcase
plates cut from the masters, and Inter subset to woff2.

resume/resume.css and resume/resume.js are hand-written and not touched here.

    python3 tools/export_resume.py [path/to/resume]     # default: ../resume

Needs Pillow, and pyftsubset + woff2_compress for the faces.
"""

import html
import re
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

from PIL import Image

SITE = Path(__file__).resolve().parent.parent
SRC = Path(sys.argv[1]).resolve() if len(sys.argv) > 1 else SITE.parent / "resume"
OUT = SITE / "resume"

# Published names. "Human" is the resume repo's word for the designed sheet; a
# recruiter saving the file does not need to read it.
PDFS = {
    "AndrewTramutolo_Resume_Human.pdf": "AndrewTramutolo_Resume.pdf",
    "AndrewTramutolo_Resume_Human_Dark.pdf": "AndrewTramutolo_Resume_Dark.pdf",
    "AndrewTramutolo_Resume_ATS.pdf": "AndrewTramutolo_Resume_ATS.pdf",
}

# Plate widths in pixels. The hero spans the sheet, the rest sit two to a row;
# both are roughly twice the CSS width they are shown at, for dense screens.
HERO_W, PLATE_W = 1800, 1100

UNICODES = "U+0020-007E,U+00A0-00FF,U+2009,U+2013,U+2014,U+2018,U+2019,U+201C,U+201D,U+2022,U+2026"


def warn(msg):
    print(f"warning: {msg}", file=sys.stderr)


# ---------------------------------------------------------------------------
# READING TEX
#
# Only as much TeX as the two content files use. Anything outside that is an
# error rather than a guess, so a new command in the content file stops the
# export instead of quietly vanishing from the page.
# ---------------------------------------------------------------------------

def strip_comments(s):
    # A comment eats its newline and the next line's indent, the way TeX does ---
    # which is what lets `{}%' at a line end join an argument on the next line.
    s = re.sub(r"(?<!\\)%[^\n]*\n[ \t]*", "", s)
    return re.sub(r"(?<!\\)%[^\n]*$", "", s)


def skip_ws(s, i):
    while i < len(s) and s[i] in " \t\n":
        i += 1
    return i


def group(s, i):
    """Read one {braced} argument starting at or after i. Returns (body, end)."""
    i = skip_ws(s, i)
    if i >= len(s) or s[i] != "{":
        raise SystemExit(f"expected '{{' near: {s[i:i + 60]!r}")
    depth, j = 0, i
    while j < len(s):
        c = s[j]
        if c == "\\":
            j += 2
            continue
        if c == "{":
            depth += 1
        elif c == "}":
            depth -= 1
            if depth == 0:
                return s[i + 1:j], j + 1
        j += 1
    raise SystemExit(f"unbalanced braces near: {s[i:i + 60]!r}")


def optional(s, i):
    """Read an optional [argument]. Returns ('', i) when there is none."""
    k = skip_ws(s, i)
    if k < len(s) and s[k] == "[":
        end = s.index("]", k)
        return s[k + 1:end], end + 1
    return "", i


def empty_group(s, i):
    """Swallow the `{}' a separator is written with, if it is there."""
    if s.startswith("{}", i):
        return i + 2
    return i


def esc(s):
    return html.escape(s, quote=True)


SYMBOLS = {"&": "&amp;", "_": "_", "#": "#", "%": "%", "$": "$", ",": "\u2009", " ": " ", "\\": "<br>"}


def tex(s):
    """Inline TeX to HTML."""
    out, i = [], 0
    while i < len(s):
        c = s[i]
        if c == "\\":
            m = re.compile(r"\\([A-Za-z]+)").match(s, i)
            if not m:
                sym = s[i + 1:i + 2]
                if sym not in SYMBOLS:
                    raise SystemExit(f"unknown control symbol \\{sym} near: {s[i:i + 40]!r}")
                out.append(SYMBOLS[sym])
                i += 2
                continue
            name, i = m.group(1), m.end()
            if name == "textbf":
                arg, i = group(s, i)
                out.append(f"<strong>{tex(arg)}</strong>")
            elif name in ("textit", "emph"):
                arg, i = group(s, i)
                out.append(f"<em>{tex(arg)}</em>")
            elif name == "href":
                url, i = group(s, i)
                text, i = group(s, i)
                out.append(f'<a href="{esc(url)}" target="_blank" rel="noopener nofollow">{tex(text)}</a>')
            elif name == "CVDASH":
                i = empty_group(s, i)
                out.append('<span class="sep">\u2013</span>')
            elif name == "CVPIPE":
                i = empty_group(s, i)
                out.append('<span class="sep">|</span>')
            elif name == "CVDOT":
                i = empty_group(s, i)
                out.append("\u00b7")
            elif name == "CVAI":
                i = empty_group(s, i)
                out.append('<span class="chip ai">AI-assisted</span>')
            elif name == "CVHUMAN":
                i = empty_group(s, i)
                out.append('<span class="chip human">Human-made</span>')
            elif name == "CVLIVE":
                arg, i = group(s, i)
                out.append(f'<span class="paint s-live">{tex(arg)}</span>')
            else:
                raise SystemExit(f"unknown command \\{name} near: {s[i - len(name) - 1:i + 40]!r}")
        elif c in "{}":
            i += 1
        elif s.startswith("---", i):
            out.append("\u2014")
            i += 3
        elif s.startswith("--", i):
            out.append("\u2013")
            i += 2
        elif s.startswith("``", i):
            out.append("\u201c")
            i += 2
        elif s.startswith("''", i):
            out.append("\u201d")
            i += 2
        elif c == "~":
            out.append("&nbsp;")
            i += 1
        else:
            out.append(html.escape(c, quote=False))
            i += 1
    return re.sub(r"\s+", " ", "".join(out)).strip()


def plain(fragment):
    """An HTML fragment as attribute-safe text, for alt and aria-label."""
    return re.sub(r"<[^>]+>", "", fragment).replace('"', "&quot;")


def read_identity(path):
    s = strip_comments(path.read_text())
    found = {}
    for m in re.finditer(r"\\def\\(CV[A-Z]+)\s*(?=\{)", s):
        body, _ = group(s, m.end())
        found[m.group(1)] = body
    for key in ("CVNAME", "CVTITLE", "CVEMAIL", "CVLOCATION", "CVPHONE", "CVSITEURL", "CVSITETEXT", "CVSUMMARY"):
        if key not in found:
            raise SystemExit(f"{path.name}: no \\{key}")
    return found


def read_content(path):
    """The content file as a list of sections, each a list of (kind, args...)."""
    s = strip_comments(path.read_text())
    sections, cur, i = [], None, 0
    word = re.compile(r"\\([A-Za-z]+)")

    def need_section(name):
        if cur is None:
            raise SystemExit(f"\\{name} outside a section")
        return cur["items"]

    while True:
        i = skip_ws(s, i)
        if i >= len(s):
            break
        m = word.match(s, i)
        if not m:
            raise SystemExit(f"unexpected text in {path.name}: {s[i:i + 60]!r}")
        name, i = m.group(1), m.end()

        if name == "begin":
            env, i = group(s, i)
            if env == "CVSection":
                key, i = group(s, i)
                title, i = group(s, i)
                cur = {"kind": "section", "key": key, "title": title, "items": []}
                sections.append(cur)
            elif env == "CVShowcase":
                title, i = group(s, i)
                cur = {"kind": "showcase", "key": "proj", "title": title, "items": []}
                sections.append(cur)
            elif env == "CVBullets":
                end = s.index(r"\end{CVBullets}", i)
                bullets = [tex(b) for b in re.split(r"\\item\b", s[i:end]) if b.strip()]
                need_section("item").append(("bullets", bullets))
                i = end + len(r"\end{CVBullets}")
            else:
                raise SystemExit(f"unknown environment {env}")
        elif name == "end":
            _, i = group(s, i)
            cur = None
        elif name == "CVEntry":
            url, i = optional(s, i)
            a, i = group(s, i)
            b, i = group(s, i)
            need_section(name).append(("entry", url, a, b))
        elif name == "CVRole":
            a, i = group(s, i)
            b, i = group(s, i)
            need_section(name).append(("role", a, b))
        elif name == "CVSkill":
            a, i = group(s, i)
            b, i = group(s, i)
            need_section(name).append(("skill", a, b))
        elif name == "CVProject":
            a, i = group(s, i)
            b, i = group(s, i)
            c, i = group(s, i)
            need_section(name).append(("project", a, b, c))
        elif name in ("CVPlate", "CVPlateWide", "CVPlateThird"):
            url, i = optional(s, i)
            key, i = group(s, i)
            title, i = group(s, i)
            cap, i = group(s, i)
            need_section(name).append(("plate", name == "CVPlateWide", url, key, title, cap))
        elif name in ("CVPlateRow", "CVPlateGap"):
            pass    # the web lays out its own grid
        else:
            raise SystemExit(f"unknown command \\{name} in {path.name}")
    return sections


# ---------------------------------------------------------------------------
# WRITING HTML
#
# `data-r' marks a thing that arrives on its own beat when its card is revealed;
# resume.js staggers them. Everything is fully rendered without script.
# ---------------------------------------------------------------------------

def link_or_span(url, inner, cls):
    if url:
        return f'<a class="{cls} quiet" href="{esc(url)}" target="_blank" rel="noopener nofollow">{inner}</a>'
    return f'<span class="{cls}">{inner}</span>'


def entry(url, name, meta):
    parts = link_or_span(url, tex(name), "name")
    meta = tex(meta)
    if meta:
        parts += link_or_span(url, meta, "meta")
    return f'<h3 class="entry">{parts}</h3>'


def head(stroke, title):
    return (f'<div class="head"><h2 class="paint s-{stroke}">{tex(title)}</h2>'
            f'<span class="hair" aria-hidden="true"></span></div>')


def plate_html(wide, url, key, title, cap, sizes):
    w, h = sizes[key]
    t = tex(title)
    img = f'<img src="img/{key}.jpg" width="{w}" height="{h}" alt="{plain(t)}" loading="lazy" decoding="async">'
    shot = (f'<a class="shot" href="{esc(url)}" target="_blank" rel="noopener nofollow">{img}</a>'
            if url else f'<div class="shot">{img}</div>')
    heading = link_or_span(url, t, "t")
    caption = tex(cap)
    caption = f"<p>{caption}</p>" if caption else ""
    return (f'<figure class="plate{" wide" if wide else ""}" data-r>{shot}'
            f"<figcaption><h3>{heading}</h3>{caption}</figcaption></figure>")


def section_html(sec, sizes):
    key = sec["key"]
    tag = "section"
    out = [f'<{tag} class="card k-{key}{" showcase" if sec["kind"] == "showcase" else ""}">', head(key, sec["title"])]
    plates = []
    for item in sec["items"]:
        kind = item[0]
        if kind == "entry":
            out.append(f'<div class="row" data-r>{entry(item[1], item[2], item[3])}</div>')
        elif kind == "role":
            out.append(f'<p class="role" data-r><span class="paint s-role{item[1]}">{tex(item[2])}</span></p>')
        elif kind == "bullets":
            out.append('<ul class="bullets">' + "".join(f"<li data-r>{b}</li>" for b in item[1]) + "</ul>")
        elif kind == "skill":
            out.append(f'<p class="skill" data-r><b>{tex(item[1])}</b> <span>{tex(item[2])}</span></p>')
        elif kind == "project":
            out.append(f'<div class="row project" data-r>{entry("", item[1], item[2])}'
                       f'<p class="desc">{tex(item[3])}</p></div>')
        elif kind == "plate":
            plates.append(plate_html(*item[1:], sizes))
    if plates:
        out.append('<div class="plates">' + "".join(plates) + "</div>")
    out.append(f"</{tag}>")
    return "\n".join(out)


def page(ident, sections, sizes):
    name = tex(ident["CVNAME"])
    # A letter per span for the strike-in, and a word per span around them: a
    # line may break between two inline-blocks, and without the word held
    # together a narrow screen wraps the last letter of the name on its own.
    n, words = 0, []
    for word in html.unescape(name).split():
        spans = []
        for ch in word:
            spans.append(f'<span class="l" style="--i:{n}">{esc(ch)}</span>')
            n += 1
        words.append(f'<span class="w">{"".join(spans)}</span>')
    letters = " ".join(words)
    email = tex(ident["CVEMAIL"])
    phone = tex(ident["CVPHONE"])
    dot = '<span class="dot" aria-hidden="true">\u00b7</span>'
    contact = dot.join([
        f'<a class="quiet ink" href="mailto:{email}">{email}</a>',
        f"<span>{tex(ident['CVLOCATION'])}</span>",
        f'<a class="quiet" href="tel:{re.sub(r"[^0-9+]", "", phone)}">{phone}</a>',
        f'<a href="{esc(ident["CVSITEURL"])}" target="_blank" rel="noopener nofollow">{tex(ident["CVSITETEXT"])}</a>',
    ])
    body = "\n\n".join(section_html(sec, sizes) for sec in sections)
    person = plain(name).title()

    return f"""<!DOCTYPE html>
<!--
  GENERATED by tools/export_resume.py from the resume repo's resume-identity.tex
  and resume-content.tex. Edit the words there and re-run the export; anything
  changed by hand in this file is lost on the next run. The look is resume.css
  and resume.js, which the export does not touch.
-->
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow, noarchive">
<title>{person} &mdash; Resume</title>
<meta name="description" content="{person} &mdash; {plain(tex(ident['CVTITLE']))}">
<meta name="theme-color" content="#FAF7F1">
<link rel="icon" href="../assets/favicon.svg" type="image/svg+xml">
<link rel="preload" href="fonts/inter-medium.woff2" as="font" type="font/woff2" crossorigin>
<link rel="preload" href="fonts/inter-bold.woff2" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="resume.css">
<script>
  (function (d) {{
    d.classList.add('js');
    try {{ if (localStorage.getItem('resume-sheet') === 'dark') d.setAttribute('data-sheet', 'dark'); }} catch (e) {{}}
  }})(document.documentElement);
</script>
</head>
<body>

<div class="ground" aria-hidden="true"></div>
<canvas id="field" aria-hidden="true"></canvas>

<div class="page">

<nav class="bar" aria-label="Resume">
  <div class="sheets" role="group" aria-label="Sheet">
    <button type="button" data-sheet="light" aria-pressed="true">Light</button>
    <button type="button" data-sheet="dark" aria-pressed="false">Dark</button>
  </div>
  <a class="ats" href="AndrewTramutolo_Resume_ATS.pdf" download rel="nofollow">Plain PDF</a>
  <a class="dl" id="dl" href="AndrewTramutolo_Resume.pdf" download rel="nofollow"
     data-light="AndrewTramutolo_Resume.pdf" data-dark="AndrewTramutolo_Resume_Dark.pdf"><span class="paint s-live">Download PDF</span></a>
</nav>

<main class="sheet">

<header class="card k-head masthead">
<h1 class="wordmark" aria-label="{plain(name)}"><span aria-hidden="true">{letters}</span></h1>
<p class="title"><span class="paint s-head">{tex(ident["CVTITLE"])}</span></p>
<div class="hrule" aria-hidden="true"></div>
<p class="contact" data-r>{contact}</p>
</header>

<section class="card k-head">
{head("summ", "Summary")}
<p class="summary" data-r>{tex(ident["CVSUMMARY"])}</p>
</section>

{body}

<div class="foot" aria-hidden="true"><canvas id="wave"></canvas></div>

</main>
</div>

<script src="resume.js" defer></script>
</body>
</html>
"""


# ---------------------------------------------------------------------------
# ASSETS
# ---------------------------------------------------------------------------

def copy_pdfs():
    words = [SRC / "resume-identity.tex", SRC / "resume-content.tex", SRC / "resume-body.tex"]
    newest = max(p.stat().st_mtime for p in words)
    for src, dst in PDFS.items():
        path = SRC / src
        if not path.exists():
            raise SystemExit(f"missing {path} --- build it with xelatex first")
        if path.stat().st_mtime < newest:
            warn(f"{src} is older than the .tex it is built from --- rebuild it with xelatex")
        shutil.copy2(path, OUT / dst)


def copy_textures():
    tex_dir = OUT / "tex"
    tex_dir.mkdir(exist_ok=True)
    for p in sorted((SRC / "textures").glob("stroke_*.png")):
        shutil.copy2(p, tex_dir / p.name)
    for name in ("paper_light.png", "paper_dark.png"):
        shutil.copy2(SRC / "textures" / name, tex_dir / name)


def build_plates(sections):
    img_dir = OUT / "img"
    img_dir.mkdir(exist_ok=True)
    sizes = {}
    for sec in sections:
        for item in sec["items"]:
            if item[0] != "plate":
                continue
            wide, key = item[1], item[3]
            master = SRC / "textures" / "showcase" / "src" / f"{key}.png"
            if not master.exists():
                master = SRC / "textures" / "showcase" / f"{key}.jpg"
            if not master.exists():
                raise SystemExit(f"no image for plate {key!r}")
            im = Image.open(master).convert("RGB")
            w = min(im.width, HERO_W if wide else PLATE_W)
            h = round(im.height * w / im.width)
            if w != im.width:
                im = im.resize((w, h), Image.LANCZOS)
            im.save(img_dir / f"{key}.jpg", quality=84, optimize=True, progressive=True)
            sizes[key] = (w, h)
    return sizes


def build_fonts():
    font_dir = OUT / "fonts"
    font_dir.mkdir(exist_ok=True)
    for face, out in (("Inter-Medium.ttf", "inter-medium"), ("Inter-Bold.ttf", "inter-bold")):
        with tempfile.TemporaryDirectory() as tmp:
            ttf = Path(tmp) / f"{out}.ttf"
            subprocess.run(["pyftsubset", str(SRC / "fonts" / face), f"--unicodes={UNICODES}",
                            f"--output-file={ttf}"], check=True)
            subprocess.run(["woff2_compress", str(ttf)], check=True, stdout=subprocess.DEVNULL)
            shutil.move(ttf.with_suffix(".woff2"), font_dir / f"{out}.woff2")


def main():
    if not (SRC / "resume-content.tex").exists():
        raise SystemExit(f"no resume repo at {SRC}")
    OUT.mkdir(exist_ok=True)

    ident = read_identity(SRC / "resume-identity.tex")
    sections = read_content(SRC / "resume-content.tex")
    if "20XX" in (SRC / "resume-content.tex").read_text():
        warn("resume-content.tex still has a 20XX placeholder year, and it is on the page")

    sizes = build_plates(sections)
    copy_textures()
    copy_pdfs()
    build_fonts()
    (OUT / "index.html").write_text(page(ident, sections, sizes))
    print(f"wrote {OUT.relative_to(SITE)}/index.html from {SRC}")


if __name__ == "__main__":
    main()
