/* ===========================================================================
   THE GROUND — the board's generated background field, and the CRT power-on.

   The field is a PORT of shaders/menu_field.gdshader from the game, not an
   impression of it: the lattice pitch, the sweep period, the diagonal the band
   travels along and the ice-to-gold tip at its crest are the shader's own
   numbers. It is drawn as real lines and dots rather than per-pixel, because
   the shader is only ever drawing lines and dots — same picture, and it holds
   60fps in a browser instead of melting it.

   Lifted from drith-godot/ui/mockups/_board.js, which is where that port was
   first written and approved.
   =========================================================================== */

(function () {
  'use strict';

  /* --- menu_field.gdshader uniforms, verbatim ----------------------------- */
  var PITCH        = 52.0;   // lattice spacing, px
  var SWEEP_PERIOD = 19.0;   // seconds per pass
  var GRID_BASE    = 0.028;
  var DOT_BASE     = 0.095;
  var SWEEP_GAIN   = 0.62;
  var COOL = [0.72, 0.92, 1.00];  // `cool`
  var WARM = [1.00, 0.88, 0.55];  // `warm`

  function smoothstep(e0, e1, x) {
    var t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
    return t * t * (3 - 2 * t);
  }
  function clamp01(x) { return x < 0 ? 0 : x > 1 ? 1 : x; }

  /* Colour/alpha lookup, so a frame is not 800 template strings. The shader's
     dot colour is a single mix driven by lift, so 24 buckets across it are
     visually continuous. */
  var STEPS = 24;
  var DOT_STYLE = [];
  for (var s = 0; s < STEPS; s++) {
    var lift = s / (STEPS - 1);
    var t = smoothstep(0.55, 0.92, lift);
    var r = Math.round(255 * (COOL[0] + (WARM[0] - COOL[0]) * t));
    var g = Math.round(255 * (COOL[1] + (WARM[1] - COOL[1]) * t));
    var b = Math.round(255 * (COOL[2] + (WARM[2] - COOL[2]) * t));
    var a = DOT_BASE + lift * SWEEP_GAIN;
    DOT_STYLE.push('rgba(' + r + ',' + g + ',' + b + ',' + a.toFixed(3) + ')');
  }

  var still = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function startField(canvas) {
    var ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) return;

    var w = 0, h = 0;

    function resize() {
      var dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = canvas.clientWidth;
      h = canvas.clientHeight;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    resize();
    window.addEventListener('resize', resize);

    function draw(time) {
      ctx.clearRect(0, 0, w, h);

      // The band runs diagonally, so it never reads as a plain horizontal wipe.
      var span = w + h;
      var band = ((time / SWEEP_PERIOD) % 1) * span - h * 0.5;

      var cols = Math.ceil(w / PITCH) + 1;
      var rows = Math.ceil(h / PITCH) + 1;
      var i, j, lift, alpha;

      /* --- grid lines ----------------------------------------------------
         Every fifth line sits slightly brighter, so the grid has a read at
         distance rather than dissolving into an even wash. */
      ctx.lineWidth = 1;
      for (i = 0; i < cols; i++) {
        var x = i * PITCH;
        lift = clamp01(1 - Math.abs(x + (h * 0.5) * 0.6 - band) / (PITCH * 5));
        alpha = GRID_BASE + (i % 5 === 0 ? 0.020 : 0) + lift * 0.10;
        ctx.strokeStyle = 'rgba(184,235,255,' + alpha.toFixed(3) + ')';
        ctx.beginPath();
        ctx.moveTo(x + 0.5, 0);
        ctx.lineTo(x + 0.5, h);
        ctx.stroke();
      }
      for (j = 0; j < rows; j++) {
        var y = j * PITCH;
        lift = clamp01(1 - Math.abs((w * 0.5) + y * 0.6 - band) / (PITCH * 5));
        alpha = GRID_BASE + (j % 5 === 0 ? 0.020 : 0) + lift * 0.10;
        ctx.strokeStyle = 'rgba(184,235,255,' + alpha.toFixed(3) + ')';
        ctx.beginPath();
        ctx.moveTo(0, y + 0.5);
        ctx.lineTo(w, y + 0.5);
        ctx.stroke();
      }

      /* --- dots on the intersections --------------------------------------
         Radius and colour both ride `lift`, so the crest of the band is a
         travelling swell of larger, gold-tipped dots. */
      for (i = 0; i < cols; i++) {
        var lx = i * PITCH;
        for (j = 0; j < rows; j++) {
          var ly = j * PITCH;
          lift = clamp01(1 - Math.abs((lx + ly * 0.6) - band) / (PITCH * 4.5));
          var rad = 0.9 + lift * 1.6;
          ctx.fillStyle = DOT_STYLE[(lift * (STEPS - 1)) | 0];
          ctx.fillRect(lx - rad, ly - rad, rad * 2, rad * 2);
        }
      }
    }

    /* A still frame is the whole field for a reader who has asked for no
       motion: the lattice is the picture, the sweep is only what moves over
       it. Drawn at a time where the band is on screen so the still is not the
       flat resting state. */
    if (still) {
      draw(SWEEP_PERIOD * 0.42);
      window.addEventListener('resize', function () { draw(SWEEP_PERIOD * 0.42); });
      return;
    }

    var t0 = null;
    (function loop(now) {
      if (t0 === null) t0 = now;
      // Nothing to look at on a background tab, and rAF is throttled there
      // anyway — skip the work rather than drawing into a hidden buffer.
      if (!document.hidden) draw((now - t0) / 1000);
      requestAnimationFrame(loop);
    })(performance.now());
  }

  /* --- CRT power-on -------------------------------------------------------
     The collapsing white line that flashes through ahead of the snap. The
     element removes itself when the animation ends, so it can never sit over
     the page as a stray 2px rule. */
  function powerOn() {
    if (still) return;
    var line = document.createElement('div');
    line.id = 'powerline';
    document.body.appendChild(line);
    line.addEventListener('animationend', function () { line.remove(); });
  }

  function boot() {
    var canvas = document.getElementById('field');
    if (canvas) startField(canvas);
    powerOn();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
