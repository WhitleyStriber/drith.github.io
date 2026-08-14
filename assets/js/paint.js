/* ============================================================================
   THE MARKER UNDER COMING 202X — shaders/paint_stroke.gdshader, ported.

   Everything else on the board is a fact about the machine, set in hairlines
   and steel type. COMING 202X is the one line that is a promise, so it is the
   one line that gets pigment: the generated marker drag the inventory's tabs
   already sit on (board::paint_stroke in src/hud/core/board_style.h), in the
   same orange, at the same seed.

   It is generated rather than an image for the reason the shader is: a stroke
   behind a label has to be whatever width that label happens to be, and a
   stretched bitmap smears its bristles into bars the moment the text is longer
   than the source. So this is the same four ideas, evaluated per pixel:

     1. THE ENDS      chewed per row, so bristles run out at different lengths
     2. THE BRISTLES  striations dragged along the stroke, some rows nearly dry
     3. THE EDGES     top and bottom wobble along the length
     4. THE SPECKLE   sparse pinholes where the paint did not take

   Only `grow` moves — the reveal menu.gd drags across once the words have
   arrived — so everything else is evaluated once into a static coverage field
   and the reveal is a mask walked over it. That is what makes a per-pixel
   shader affordable on the main thread.
   ========================================================================== */

(function () {
  'use strict';

  var host = document.querySelector('.tagline .date');
  if (!host || !document.createElement('canvas').getContext) return;

  /* menu.gd's call: PAINT_INK, PAINT_SEED, PAINT_BLEED. The rest of the
     uniforms are the shader's own defaults, because the board takes them. */
  var INK = [255, 148, 41];        // PAINT_INK  Color(1.0, 0.58, 0.16), sRGB — 2D
  var SEED = 6.3;                  // any other number is another stroke
  var BLEED = [22, 10];            // how far the paint runs past the word
  var FILL = 0.26;                 // PAINT_FILL — how long the drag takes
  var DELAY = 0.92;                // _play_intro's beat for it

  var BRISTLE_FREQ = 46.0;
  var BRISTLE_BITE = 0.42;
  var END_FRAY = 0.05;
  var EDGE_WOBBLE = 0.09;
  var SPECKLE = 0.12;
  var SOFT = 0.01;

  function hash(x) {
    var v = Math.sin(x * 127.1 + SEED * 311.7) * 43758.5453;
    return v - Math.floor(v);
  }

  function noise(x) {
    var i = Math.floor(x), f = x - i;
    f = f * f * (3 - 2 * f);
    var a = hash(i), b = hash(i + 1);
    return a + (b - a) * f;
  }

  // Three octaves: the coarse one shapes the run-out, the fine one is the bristle.
  function fbm(x) {
    return noise(x) * 0.60 + noise(x * 2.3 + 11.0) * 0.30 + noise(x * 5.7 + 23.0) * 0.10;
  }

  function smoothstep(e0, e1, x) {
    var t = (x - e0) / (e1 - e0);
    t = t < 0 ? 0 : (t > 1 ? 1 : t);
    return t * t * (3 - 2 * t);
  }

  var cv = document.createElement('canvas');
  cv.className = 'paint';
  cv.setAttribute('aria-hidden', 'true');
  host.appendChild(cv);
  var ctx = cv.getContext('2d');

  var W = 0, H = 0, img = null, cover = null, fray = null;

  /* The static half of the stroke: everything except the reveal. Rebuilt only
     when the box changes size, which is a font load or a window resize. */
  function bake() {
    var box = host.getBoundingClientRect();
    var dpr = Math.min(window.devicePixelRatio || 1, 2);

    /* One logical pixel, taken off the label rather than read back from --u:
       custom properties are not resolved by getComputedStyle unless they are
       registered, so --u comes back as the literal "min(...)" expression and
       parseFloat gives NaN. The date is set at 19 of the menu's logical pixels
       (menu.tscn's Date Label), so its own font size IS the scale, and the
       bleed stays in step with the word it runs past. */
    var u = parseFloat(getComputedStyle(host).fontSize) / 19;
    if (!(u > 0)) u = 1;

    var cssW = box.width + BLEED[0] * 2 * u;
    var cssH = box.height + BLEED[1] * 2 * u;
    if (cssW < 2 || cssH < 2) return false;

    cv.style.left = (-BLEED[0] * u) + 'px';
    cv.style.top = (-BLEED[1] * u) + 'px';
    cv.style.width = cssW + 'px';
    cv.style.height = cssH + 'px';

    var w = Math.max(2, Math.round(cssW * dpr));
    var h = Math.max(2, Math.round(cssH * dpr));
    if (w === W && h === H) return true;
    W = w; H = h;
    cv.width = W; cv.height = H;
    img = ctx.createImageData(W, H);
    cover = new Float32Array(W * H);
    fray = new Float32Array(H);

    // Per COLUMN: the band the ink occupies, wobbling along the drag.
    var top = new Float32Array(W), bot = new Float32Array(W);
    for (var xi = 0; xi < W; xi++) {
      var x = (xi + 0.5) / W;
      top[xi] = EDGE_WOBBLE * fbm(x * 5.0 + 3.0);
      bot[xi] = 1.0 - EDGE_WOBBLE * fbm(x * 5.0 + 61.0);
    }

    for (var yi = 0; yi < H; yi++) {
      var y = (yi + 0.5) / H;

      // Per ROW: the ends, chewed. Squared so most rows stop near the tip and a
      // few straggle well short — that rake is what stops it reading as a fade.
      var lf = fbm(y * 26.0 + 7.0), rf = fbm(y * 26.0 + 91.0);
      var l = END_FRAY * lf * lf * 2.0;
      var r = 1.0 - END_FRAY * rf * rf * 2.0;
      fray[yi] = END_FRAY * (fbm(y * 26.0 + 41.0) - 0.5);

      for (var xj = 0; xj < W; xj++) {
        var xx = (xj + 0.5) / W;
        var band = smoothstep(top[xj], top[xj] + SOFT, y) *
                   (1.0 - smoothstep(bot[xj] - SOFT, bot[xj], y));
        band *= smoothstep(l, l + SOFT * 1.5, xx) *
                (1.0 - smoothstep(r - SOFT * 1.5, r, xx));

        var br = fbm(y * BRISTLE_FREQ + xx * 1.6);
        var dry = BRISTLE_BITE * smoothstep(0.52, 0.95, br);
        var cell = hash(Math.floor(xx * 160.0) * 3.7 + Math.floor(y * 70.0) * 13.1);
        var holes = cell >= 0.90 ? SPECKLE : 0;

        cover[yi * W + xj] = band * (1.0 - dry) * (1.0 - holes);
      }
    }
    return true;
  }

  /* The reveal, frayed on the same noise so a half-painted stroke ends in
     bristles rather than a cut. */
  function paint(grow) {
    if (!cover) return;
    var d = img.data;
    for (var yi = 0; yi < H; yi++) {
      var g = grow + fray[yi];
      for (var xj = 0; xj < W; xj++) {
        var i = yi * W + xj;
        var a = cover[i];
        if (a > 0) {
          a *= 1.0 - smoothstep(g - SOFT * 2.0, g, (xj + 0.5) / W);
        }
        d[i * 4] = INK[0];
        d[i * 4 + 1] = INK[1];
        d[i * 4 + 2] = INK[2];
        d[i * 4 + 3] = a < 0 ? 0 : (a > 1 ? 255 : Math.round(a * 255));
      }
    }
    ctx.putImageData(img, 0, 0);
  }

  var still = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var intro = document.body.classList.contains('intro') && !still;
  var last = -1;

  function run() {
    if (!bake()) return;
    if (!intro) { paint(1); return; }
    var t0 = performance.now();
    (function step(now) {
      var t = (now - t0) / 1000;
      var g = t <= DELAY ? 0 : Math.min(1, (t - DELAY) / FILL);
      if (g !== last) { paint(g); last = g; }
      if (g < 1) requestAnimationFrame(step);
    })(t0);
  }

  /* Wait for the face: the stroke is sized off the word, and the word is a
     different width in FreeSans than in whatever the browser drew first. */
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(run);
  } else {
    run();
  }

  var redo;
  window.addEventListener('resize', function () {
    clearTimeout(redo);
    redo = setTimeout(function () {
      W = H = 0;                 // force a rebake at the new size
      intro = false;             // it has already played; land it painted
      if (bake()) paint(1);
    }, 120);
  });
})();
