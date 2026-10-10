"""Trim the renders to their alpha, size them for the page, write WebP."""
import sys, os
from PIL import Image
SRC, DST = sys.argv[1], sys.argv[2]
os.makedirs(DST, exist_ok=True)

def cut(name, pad=0.03):
    im = Image.open(os.path.join(SRC, name + '.png')).convert('RGBA')
    bb = im.getchannel('A').point(lambda a: 255 if a > 6 else 0).getbbox()
    im = im.crop(bb)
    p = int(max(im.size) * pad)
    c = Image.new('RGBA', (im.width + 2 * p, im.height + 2 * p), (0, 0, 0, 0))
    c.alpha_composite(im, (p, p))
    return c

def save(im, name, maxw=1400, maxh=1400, q=84):
    im = im.copy(); im.thumbnail((maxw, maxh), Image.LANCZOS)
    out = os.path.join(DST, name + '.webp')
    im.save(out, 'WEBP', quality=q, method=6)
    print(name, im.size, os.path.getsize(out) // 1024, 'K')
    return im.size

def group(parts, W, H, name, **kw):
    """parts: (render, height as a fraction of H, centre x as a fraction of W, flip, lift)"""
    c = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    for n, hf, xf, flip, lift in parts:
        im = cut(n, 0)
        if flip: im = im.transpose(Image.FLIP_LEFT_RIGHT)
        h = int(H * hf); w = int(im.width * h / im.height)
        im = im.resize((w, h), Image.LANCZOS)
        c.alpha_composite(im, (int(W * xf - w / 2), int(H - h - H * lift)))
    return save(c, name, **kw)

if __name__ == '__main__':
    only = sys.argv[3].split(',') if len(sys.argv) > 3 else None
    S1 = dict(maxw=900, maxh=900)
    jobs = {
        'hero': lambda: group([('bigal', 0.98, 0.17, False, 0.0), ('minion_b', 0.70, 0.84, True, 0.0),
                               ('hero', 0.90, 0.50, False, 0.02), ('forgie', 0.40, 0.69, True, 0.0),
                               ('windshield', 0.20, 0.33, False, 0.0)], 1900, 1150, 'hero', maxw=1900, maxh=1200, q=86),
        'minions': lambda: group([('minion_b', 0.98, 0.20, False, 0), ('minion_c', 0.86, 0.80, True, 0), ('minion_a', 0.90, 0.50, False, 0)], 1500, 900, 'minions', maxw=1100),
        'you': lambda: group([('you_run', 0.90, 0.11, False, 0), ('you_guard', 0.98, 0.37, False, 0), ('you_roll', 0.52, 0.63, False, 0.0), ('you_glide', 0.40, 0.88, False, 0.50)], 2400, 1000, 'you', maxw=1800),
    }
    for n in ['bigal', 'forgie', 'gideon', 'windshield', 'gull', 'genesis', 'ml08']:
        jobs[n] = (lambda n=n: save(cut(n), n, **S1))
    for n in ['deli', 'venaria', 'beachtown', 'forest', 'elite', 'havoc', 'cleaver', 'hw01', 'apache', 'minicopter', 'nb26']:
        jobs[n] = (lambda n=n: save(cut(n), n, maxw=1400, maxh=1100))
    for k, fn in jobs.items():
        if only and k not in only: continue
        try: fn()
        except FileNotFoundError as e: print('missing', k, e)
