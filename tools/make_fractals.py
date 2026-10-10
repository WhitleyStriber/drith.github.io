#!/usr/bin/env python3
"""
The fractals behind the pages — assets/img/fractals/*.png.

Each one is a MASK, not a picture: 853 x 480 cells, one cell per dot, white with
the dot's brightness in the alpha channel. That is the desktop wallpapers' own
grid (2560 x 1440 with a one-pixel dot every third pixel) with the empty pixels
taken out, so the page can put the dots back at whatever whole number of screen
pixels fits the window and they stay single, sharp dots at any size. stage.js
does that for the board and the document pages, resume.css for the sheet.

    python3 tools/make_fractals.py
    python3 tools/make_fractals.py --wallpaper ~/Pictures/Wallpapers/Fractal2.png dragon

The first form draws every generated fractal. The second lifts a mask back out
of a finished wallpaper, which is where the front page's dragon comes from.

Needs numpy and Pillow.
"""

import math
import os
import sys

import numpy as np
from PIL import Image, ImageDraw

W, H = 853, 480                 # cells
BOX_W, BOX_H = 500, 330         # what a fractal is fitted into, centred
LINE = 200                      # a line is one dot wide, so it is drawn brighter
                                # than the wallpapers' 150 to hold up behind text
LO, HI = 95, 165                # and the range their halftones run over

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)),
                   '..', 'assets', 'img', 'fractals')

# 8 x 8 ordered dither, 0..1.
_B2 = np.array([[0, 2], [3, 1]])
_B4 = np.block([[4 * _B2, 4 * _B2 + 2], [4 * _B2 + 3, 4 * _B2 + 1]])
_B8 = np.block([[4 * _B4, 4 * _B4 + 2], [4 * _B4 + 3, 4 * _B4 + 1]])
BAYER = np.tile((_B8 + 0.5) / 64.0, (H // 8 + 1, W // 8 + 1))[:H, :W]


def save(name, cells):
    os.makedirs(OUT, exist_ok=True)
    a = np.clip(cells, 0, 255).astype(np.uint8)
    la = np.dstack([np.full_like(a, 255), a])
    path = os.path.normpath(os.path.join(OUT, name + '.png'))
    Image.fromarray(la, 'LA').save(path, optimize=True)
    print('%-12s %5.1f%% lit  %6d bytes' % (name, 100.0 * (a > 0).mean(),
                                            os.path.getsize(path)))


def halftone(d):
    """A 0..1 density as dots: dithered on or off, brighter where it is denser."""
    d = np.clip(d, 0.0, 1.0)
    return np.where(d > BAYER, LO + (HI - LO) * d, 0.0)


def fit(polys, box_w=BOX_W, box_h=BOX_H):
    """Scale a list of (n, 2) arrays into the box, y down, centred on the mask."""
    allp = np.vstack(polys)
    lo, hi = allp.min(0), allp.max(0)
    span = np.maximum(hi - lo, 1e-9)
    s = min(box_w / span[0], box_h / span[1])
    mid = (lo + hi) / 2
    return [(p - mid) * s + (W / 2, H / 2) for p in polys]


def stroke(polys, closed=False, value=LINE):
    im = Image.new('L', (W, H), 0)
    dr = ImageDraw.Draw(im)
    for p in polys:
        pts = [(float(x), float(y)) for x, y in np.round(p)]
        if closed:
            pts.append(pts[0])
        dr.line(pts, fill=value, width=1)
    return np.array(im, dtype=float)


def lsystem(axiom, rules, n):
    s = axiom
    for _ in range(n):
        s = ''.join(rules.get(c, c) for c in s)
    return s


def turtle(s, angle, heading=0.0, draw='FAB'):
    a = math.radians(angle)
    h = math.radians(heading)
    x = y = 0.0
    pts = [(x, y)]
    for c in s:
        if c in draw:
            x += math.cos(h)
            y -= math.sin(h)
            pts.append((x, y))
        elif c == '+':
            h += a
        elif c == '-':
            h -= a
    return np.array(pts)


# ------------------------------------------------------------------ curves ---

def koch():
    s = lsystem('F--F--F', {'F': 'F+F--F+F'}, 4)
    return stroke(fit([turtle(s, 60)]))


def gosper():
    s = lsystem('A', {'A': 'A-B--B+A++AA+B-', 'B': '+A-BB--B-A++A+B'}, 4)
    return stroke(fit([turtle(s, 60)]))


def terdragon():
    s = lsystem('F', {'F': 'F+F-F'}, 7)
    return stroke(fit([turtle(s, 120, heading=150)]))


def pythagoras():
    squares = []

    def grow(a, b, depth):
        # a -> b is the square's base, and it grows to the left of that heading.
        d = b - a
        n = np.array([d[1], -d[0]])
        c, e = b + n, a + n
        squares.append(np.array([a, b, c, e]))
        if depth == 0:
            return
        apex = e + (d + n) / 2
        grow(e, apex, depth - 1)
        grow(apex, c, depth - 1)

    grow(np.array([0.0, 0.0]), np.array([1.0, 0.0]), 9)
    return stroke(fit(squares), closed=True)


def apollonian():
    R = BOX_H / 2 + 6
    circles = []

    def add(k, z):
        circles.append((k, z))

    def fill(c1, c2, c3, c4):
        # The circle tangent to c1, c2, c3 that is not c4 (Descartes, complex form).
        k = 2 * (c1[0] + c2[0] + c3[0]) - c4[0]
        if 1.0 / k * R < 1.6:
            return
        z = (2 * (c1[0] * c1[1] + c2[0] * c2[1] + c3[0] * c3[1]) - c4[0] * c4[1]) / k
        c = (k, z)
        add(k, z)
        fill(c1, c2, c, c3)
        fill(c1, c3, c, c2)
        fill(c2, c3, c, c1)

    r = 2 * math.sqrt(3) - 3
    outer = (-1.0, 0j)
    inner = [(1 / r, (1 - r) * complex(math.cos(t), math.sin(t)))
             for t in (math.pi / 2, math.pi / 2 + 2 * math.pi / 3,
                       math.pi / 2 + 4 * math.pi / 3)]
    add(*outer)
    for c in inner:
        add(*c)
    fill(inner[0], inner[1], inner[2], outer)
    fill(outer, inner[0], inner[1], inner[2])
    fill(outer, inner[0], inner[2], inner[1])
    fill(outer, inner[1], inner[2], inner[0])

    im = Image.new('L', (W, H), 0)
    dr = ImageDraw.Draw(im)
    for k, z in circles:
        rad = abs(1.0 / k) * R
        cx, cy = W / 2 + z.real * R, H / 2 - z.imag * R
        dr.ellipse([cx - rad, cy - rad, cx + rad, cy + rad], outline=LINE)
    return np.array(im, dtype=float)


# -------------------------------------------------------------- escape time ---

def _escape(c, z, iters):
    """Smooth escape count, and a mask of what never left."""
    n = np.zeros(z.shape)
    alive = np.ones(z.shape, bool)
    for i in range(iters):
        z[alive] = z[alive] ** 2 + c[alive]
        out = alive & (np.abs(z) > 16.0)
        n[out] = i + 1 - np.log2(np.log(np.abs(z[out])) / math.log(16.0))
        alive &= ~out
    return n, alive


def _plane(cx, cy, height):
    """Cell centres on the complex plane, `height` units across the fitted box."""
    s = height / BOX_H
    x = (np.arange(W) - W / 2 + 0.5) * s + cx
    y = (np.arange(H) - H / 2 + 0.5) * s + cy
    return x[None, :] + 1j * y[:, None]


def _glow(n, inside, near, far):
    # Solid inside, and a dithered halo outside: full where a point takes `far`
    # steps to leave, gone by `near`, so the halo dies out and the page stays dark.
    d = np.clip((np.log(np.maximum(n, 1.0)) - math.log(near)) /
                (math.log(far) - math.log(near)), 0, 1)
    body = np.where(inside, LO + 12.0, 0.0)
    return np.maximum(body, halftone(np.where(inside, 0.0, d)))


def mandelbrot():
    c = _plane(-0.66, 0.0, 2.5)
    n, inside = _escape(c, np.zeros_like(c), 160)
    return _glow(n, inside, 5.0, 40.0)


def julia():
    z = _plane(0.0, 0.0, 2.25)
    # Turned a quarter so the set lies along the page rather than up it.
    z = z * np.exp(1j * math.radians(-28))
    n, inside = _escape(np.full(z.shape, -0.4 + 0.6j), z.copy(), 220)
    return _glow(n, inside, 7.0, 60.0)


# --------------------------------------------------------------- attractor ---

def clifford():
    a, b, c, d = -1.4, 1.6, 1.0, 0.7
    rng = np.random.default_rng(7)
    x = rng.uniform(-1, 1, 20000)
    y = rng.uniform(-1, 1, 20000)
    xs, ys = [], []
    for i in range(260):
        x, y = np.sin(a * y) + c * np.cos(a * x), np.sin(b * x) + d * np.cos(b * y)
        if i >= 20:
            xs.append(x)
            ys.append(y)
    p = fit([np.column_stack([np.concatenate(xs), -np.concatenate(ys)])])[0]
    hist, _, _ = np.histogram2d(p[:, 1], p[:, 0], bins=(H, W), range=((0, H), (0, W)))
    dens = np.log1p(hist) / np.log1p(hist.max())
    return halftone(np.clip((dens - 0.30) / 0.55, 0, 1) ** 0.9)


# ---------------------------------------------------------- from wallpaper ---

def from_wallpaper(path):
    a = np.array(Image.open(path).convert('L'), dtype=float)
    # The dots sit on every third pixel; find which third.
    best = max(((a[py::3, px::3].sum(), py, px) for py in range(3) for px in range(3)))
    cells = a[best[1]::3, best[2]::3]
    out = np.zeros((H, W))
    h, w = min(H, cells.shape[0]), min(W, cells.shape[1])
    out[:h, :w] = cells[:h, :w]
    return out


GENERATED = {
    'koch': koch,
    'gosper': gosper,
    'terdragon': terdragon,
    'pythagoras': pythagoras,
    'apollonian': apollonian,
    'mandelbrot': mandelbrot,
    'julia': julia,
    'clifford': clifford,
}

if __name__ == '__main__':
    args = sys.argv[1:]
    if args and args[0] == '--wallpaper':
        save(args[2], from_wallpaper(os.path.expanduser(args[1])))
    else:
        for name in (args or GENERATED):
            save(name, GENERATED[name]())
