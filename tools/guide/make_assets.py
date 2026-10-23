"""Everything the Garden Party guide draws that is not a screenshot.

    python3 tools/guide/make_assets.py PLATES PHOTOS

PLATES is the folder tools/plates/batch.sh wrote the cutouts into (from
tools/guide/jobs.txt), PHOTOS the one tools/guide/photos.py wrote the cropped
screenshots into. Writes into assets/img/garden/:

  cut/*.webp       the cutouts, trimmed to their alpha and capped at 900 px
  icon/*.webp      the game's own item icons (ui/icons/items)
  oumo/*.webp      Oumo renders off the growth and elemental sheets
  *.webp           the photos, as they are
  grain.png        a tile of film grain the panels are dusted with
  rough-*.png      ragged rectangles, used as masks so a panel's edge is torn
  torn.png         the ripped edge between the hero and the guide
  sky-*.png        each lane's skyline, cut out of the game's own renders
  badge-*.webp     the round chart at the head of each lane
  title.webp       the art the headline's letters are filled with
"""
import glob, os, random, shutil, sys
from PIL import Image, ImageChops, ImageDraw, ImageFilter, ImageOps

ROOT = os.path.join(os.path.dirname(__file__), "..", "..")
OUT = os.path.join(ROOT, "assets", "img", "garden")
GAME = "/home/djt/Games/Godot/drith-godot"
plates, photos = sys.argv[1], sys.argv[2]
random.seed(7)
for d in ("cut", "icon", "oumo"):
    os.makedirs(os.path.join(OUT, d), exist_ok=True)


def trim(im, cap):
    bb = im.getchannel("A").point(lambda a: 255 if a > 8 else 0).getbbox()
    im = im.crop(bb) if bb else im
    im.thumbnail((cap, cap), Image.LANCZOS)
    return im


# --- cutouts -----------------------------------------------------------------
for f in sorted(glob.glob(os.path.join(plates, "*.png"))):
    name = os.path.splitext(os.path.basename(f))[0]
    trim(Image.open(f).convert("RGBA"), 900).save(
        os.path.join(OUT, "cut", name + ".webp"), quality=86, method=6)

icons = ["armor_wear_jet_boots", "armor_wear_pirate_hat", "armor_wear_pirate_hat_small",
         "food_chili_cheese_fries", "food_churro", "food_pretzel", "food_soda",
         "crystal_fire", "crystal_ice", "crystal_thunder", "crystal_water", "crystal_wind",
         "crystal_earth", "crystal_light", "crystal_dark", "ingot_gun", "ingot_magic",
         "ingot_health", "grenade_frag", "grenade_fire", "grenade_emp", "grenade_cluster",
         "grenade_smoke"]
for n in icons:
    Image.open(f"{GAME}/ui/icons/items/{n}.png").convert("RGBA").save(
        os.path.join(OUT, "icon", n + ".webp"), quality=90, method=6)

# The sheets are shot on a grey card. Each is cropped to the Oumo and kept on it.
sheets = {
    "gun": "oumo_growths/gun_1_Stand_1_90", "magic": "oumo_growths/magic_1_Stand_1_90",
    "health": "oumo_growths/health_1_Stand_1_90", "hatch": "oumo_growths/hatch_Stand_1_90",
    "fire": "oumo_elementals/fire_1_Stand_1_90", "frost": "oumo_elementals/frost_1_Stand_1_90",
    "thunder": "oumo_elementals/thunder_1_Stand_1_90", "earth": "oumo_elementals/earth_1_Stand_1_90",
    "light": "oumo_elementals/light_1_Stand_1_90", "dark": "oumo_elementals/dark_1_Stand_1_90",
}
for n, p in sheets.items():
    im = Image.open(f"{GAME}/ui/mockups/img/{p}.png").convert("RGB")
    w, h = im.size
    s = min(w, h)
    im.crop(((w - s) // 2, (h - s) // 2, (w + s) // 2, (h + s) // 2)).resize((640, 640), Image.LANCZOS).save(
        os.path.join(OUT, "oumo", n + ".webp"), quality=84, method=6)

for f in glob.glob(os.path.join(photos, "*.webp")):
    shutil.copy(f, OUT)

# --- grain ------------------------------------------------------------------
# Light and dark specks at low alpha, laid over a flat colour as a top layer.
g = ImageOps.autocontrast(Image.effect_noise((512, 512), 64).filter(ImageFilter.GaussianBlur(0.6)))
a = g.point(lambda v: int(abs(v - 128) / 128 * 70))
Image.merge("LA", (g.point(lambda v: 255 if v > 128 else 0), a)).save(os.path.join(OUT, "grain.png"), optimize=True)


def as_mask(m):
    """A CSS mask reads alpha: white, with the shape in the alpha channel."""
    return Image.merge("LA", (Image.new("L", m.size, 255), m))


# --- ragged edges -------------------------------------------------------------
def ragged(w, h, amp, step, seed):
    r = random.Random(seed)
    pts = []
    def run(x0, y0, x1, y1, nx, ny):
        n = max(2, int(((x1 - x0) ** 2 + (y1 - y0) ** 2) ** 0.5 / step))
        for i in range(n):
            t = i / n
            j = r.uniform(0, amp) * (1.6 if r.random() < 0.12 else 1)
            pts.append((x0 + (x1 - x0) * t + nx * j, y0 + (y1 - y0) * t + ny * j))
    run(0, 0, w, 0, 0, 1)
    run(w, 0, w, h, -1, 0)
    run(w, h, 0, h, 0, -1)
    run(0, h, 0, 0, 1, 0)
    m = Image.new("L", (w, h), 0)
    ImageDraw.Draw(m).polygon(pts, fill=255)
    return m

for i, (w, h, amp, step) in enumerate([(1200, 520, 16, 9), (1200, 700, 20, 11), (900, 900, 18, 10)]):
    as_mask(ragged(w, h, amp, step, i + 3)).save(os.path.join(OUT, f"rough-{'abc'[i]}.png"), optimize=True)

# The torn edge: a strip, solid below a ripped line, repeated across the page.
W, Hs = 1600, 90
r = random.Random(11)
pts, x, y = [(0, Hs)], 0, 40
while x < W:
    pts.append((x, y))
    x += r.uniform(6, 26)
    y = max(8, min(70, y + r.uniform(-14, 14)))
pts += [(W, 40), (W, Hs)]
t = Image.new("L", (W, Hs), 0)
ImageDraw.Draw(t).polygon(pts, fill=255)
as_mask(t).save(os.path.join(OUT, "torn.png"), optimize=True)


# --- skylines ------------------------------------------------------------------
# A lane's skyline is the game's own models, flattened to their silhouettes and
# stood on one ground line. The renders carry hairline leader lines; an opening
# (shrink, then grow) wipes those out before the shapes are laid down.
SL = os.path.join(ROOT, "assets", "img", "slides")
def silhouette(path, height):
    a = Image.open(path).convert("RGBA").getchannel("A").point(lambda v: 255 if v > 40 else 0)
    a = a.filter(ImageFilter.MinFilter(7)).filter(ImageFilter.MaxFilter(7))
    a = a.crop(a.getbbox())
    return a.resize((max(1, round(a.width * height / a.height)), height), Image.LANCZOS)

def skyline(parts, name, W=2400, H=420):
    sky = Image.new("L", (W, H), 0)
    x = -40
    while x < W:
        for path, hh, gap in parts:
            s = silhouette(path, int(H * hh))
            sky.paste(255, (int(x), H - s.height), s)
            x += s.width * 0.82 + gap
            if x >= W:
                break
    # a ground band so the shapes stand on something
    ImageDraw.Draw(sky).rectangle((0, H - 18, W, H), fill=255)
    as_mask(sky).save(os.path.join(OUT, f"sky-{name}.png"), optimize=True)

skyline([(f"{SL}/forest-render.webp", 0.42, 30), (f"{SL}/grotto-render.webp", 0.62, 60),
         (f"{plates}/imbuer.png", 0.55, 50), (f"{SL}/forest-render.webp", 0.36, 10),
         (f"{plates}/skyhook.png", 0.22, 120)], "garden")
skyline([(f"{SL}/haven-render.webp", 0.40, 0), (f"{SL}/monarca-render.webp", 0.96, 40),
         (f"{SL}/haven-render.webp", 0.34, 20), (f"{plates}/bubble.png", 0.30, 80)], "rokken")
skyline([(f"{SL}/radiotower-render.webp", 0.92, 30), (f"{SL}/oilrig-render.webp", 0.6, 20),
         (f"{SL}/tower-render.webp", 0.78, 40), (f"{SL}/hazard-render.webp", 0.5, 10),
         (f"{SL}/shipwreck-render.webp", 0.38, 30), (f"{SL}/provingground-render.webp", 0.3, 40)], "caldera")


# --- round charts ------------------------------------------------------------------
def badge(src, name, box=None, zoom=1.0):
    im = Image.open(src).convert("RGB")
    if box:
        w, h = im.size
        im = im.crop((int(box[0] * w), int(box[1] * h), int(box[2] * w), int(box[3] * h)))
    s = min(im.size)
    w, h = im.size
    c = int(s / zoom)
    im = im.crop(((w - c) // 2, (h - c) // 2, (w + c) // 2, (h + c) // 2)).resize((720, 720), Image.LANCZOS)
    m = Image.new("L", (720, 720), 0)
    ImageDraw.Draw(m).ellipse((0, 0, 719, 719), fill=255)
    out = Image.new("RGBA", (720, 720), (0, 0, 0, 0))
    out.paste(im, (0, 0), m)
    out.save(os.path.join(OUT, f"badge-{name}.webp"), quality=84, method=6)

badge(f"{GAME}/tools/shots/oumo_garden_over.png", "garden", zoom=1.25)
badge("/home/djt/Work/buildscripts/haven_piazza/out/aerial_top.png", "rokken", zoom=1.1)
badge("/home/djt/Pictures/hyprshot/2026-10-23-125233_hyprshot.png", "caldera", zoom=1.08)


# --- the headline's fill --------------------------------------------------------
tiles = ["r_fountain", "g_grotto_pink", "g_lawn", "g_rainbow", "g_island", "c_ice", "g_fruit", "r_plaza"]
T = Image.new("RGB", (2400, 700))
tw = 2400 // len(tiles)
for i, n in enumerate(tiles):
    im = Image.open(os.path.join(photos, n + ".webp")).convert("RGB")
    s = 700 / im.height
    im = im.resize((max(tw, int(im.width * s)), 700), Image.LANCZOS)
    x0 = (im.width - tw) // 2
    T.paste(im.crop((x0, 0, x0 + tw, 700)), (i * tw, 0))
T = T.filter(ImageFilter.GaussianBlur(0.5))
T.save(os.path.join(OUT, "title.webp"), quality=82, method=6)
print("wrote", OUT)
