/* ===========================================================================
   THE OBJECT ON THE STAGE.

   world/menu.tscn stands the real Drith base on a turntable right of centre and
   draws it twice: a dark Fresnel-lit HULL (shaders/menu_hull.gdshader) under an
   emissive WIREFRAME (shaders/menu_wireframe.gdshader), cross-fading between the
   two on a loop. The hull is opaque so it writes depth; the wireframe is
   additive and writes none but still tests against that depth, so only the
   near-side edges survive — drawn on its own the wireframe is every edge of the
   model at once, which is an additive mass with no shape in it. The hull is what
   turns it into an object.

   That is the whole trick, and it is what this file ports. The mesh here is the
   site's own monument rather than the base model — a browser has no Blend
   importer and the base is a 14 m fortress — but every shading number below is
   the shader's: the interior colour, the Fresnel power and gain, where the rim
   tips from ice to gold, the breathing pulse, the turn rate, and the hold/fade
   of the cross-fade. Faces are depth-sorted and the wireframe is drawn only on
   the ones facing the camera, which is the depth test doing its job by hand.
   =========================================================================== */

(function () {
  'use strict';

  var cv = document.getElementById('crystal');
  if (!cv || !cv.getContext) return;
  var ctx = cv.getContext('2d');

  /* --- menu_hull.gdshader ------------------------------------------------- */
  var BODY      = [3, 6, 7];          // `body`, interior, barely above void
  var RIM_COOL  = [184, 235, 255];    // `rim_cool`  C_NAME
  var RIM_WARM  = [255, 214, 110];    // `rim_warm`  C_HEAD
  var RIM_POWER = 6.5;                // how tight the rim sits to the silhouette
  var RIM_GAIN  = 1.7;
  var WARM_AT   = 0.55;               // where the rim tips from cool to gold
  var PULSE_AMT = 0.12;
  var PULSE_HZ  = 0.22;

  /* --- menu_wireframe.gdshader -------------------------------------------- */
  var WIRE_POWER = 1.6;
  var WIRE_GAIN  = 1.8;
  var WIRE_BASE  = 0.88;              // face-on floor, keeps structure readable
  var WIRE_WARM  = 0.62;
  var WIRE_PULSE_AMT = 0.16;
  var WIRE_PULSE_HZ  = 0.24;

  /* --- menu.gd stage ------------------------------------------------------ */
  var PERIOD   = 34.0;                // model_period, seconds per revolution
  var TILT     = 13.0 * Math.PI / 180;// model_tilt_deg
  var HOLD     = 5.0;                 // material_hold
  var FADE     = 1.8;                 // material_fade
  var CYCLE    = (HOLD + FADE) * 2;

  var still = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---- geometry: two hex rings between a top and bottom apex ------------- */

  var V = [{ x: 0, y: 1.55, z: 0 }];   // 0 — top apex
  var R_HI = 0.60, R_LO = 0.76, Y_HI = 0.50, Y_LO = -0.50;
  var i;
  for (i = 0; i < 6; i++) {            // 1..6 — upper ring
    var a = (i / 6) * Math.PI * 2;
    V.push({ x: Math.cos(a) * R_HI, y: Y_HI, z: Math.sin(a) * R_HI });
  }
  for (i = 0; i < 6; i++) {            // 7..12 — lower ring
    var b = (i / 6) * Math.PI * 2;
    V.push({ x: Math.cos(b) * R_LO, y: Y_LO, z: Math.sin(b) * R_LO });
  }
  V.push({ x: 0, y: -1.80, z: 0 });    // 13 — bottom apex

  var F = [];
  for (i = 0; i < 6; i++) {
    var n = (i + 1) % 6;
    F.push([0, 1 + i, 1 + n]);                    // crown
    F.push([1 + i, 7 + i, 7 + n, 1 + n]);         // belt
    F.push([7 + n, 7 + i, 13]);                   // base
  }

  /* Per-VERTEX normals, averaged from the faces meeting at each one.
     The engine's Fresnel is evaluated per pixel and interpolates across a face.
     A per-face value is constant over the whole facet, which collapses the rim
     to "whichever facets happen to be edge-on" and leaves the rest of the
     silhouette black — the object reads as a flat hole. Averaging here, and
     shading each face as a gradient between its own dimmest and brightest
     vertex, is what puts the rim back the whole way round. */
  var VN = V.map(function () { return { x: 0, y: 0, z: 0 }; });
  F.forEach(function (f) {
    var nrm = normal(V[f[0]], V[f[1]], V[f[2]]);
    for (var k = 0; k < f.length; k++) {
      VN[f[k]].x += nrm.x; VN[f[k]].y += nrm.y; VN[f[k]].z += nrm.z;
    }
  });
  VN = VN.map(function (n) {
    var m = Math.hypot(n.x, n.y, n.z) || 1;
    return { x: n.x / m, y: n.y / m, z: n.z / m };
  });

  /* ---- transform -------------------------------------------------------- */

  var DIST = 4.6;                      // camera distance for the perspective divide

  function rotate(p, ay) {
    var c = Math.cos(ay), s = Math.sin(ay);
    var x = p.x * c - p.z * s;
    var z = p.x * s + p.z * c;
    var c2 = Math.cos(TILT), s2 = Math.sin(TILT);
    return { x: x, y: p.y * c2 - z * s2, z: p.y * s2 + z * c2 };
  }

  function normal(a, b, c) {
    var ux = b.x - a.x, uy = b.y - a.y, uz = b.z - a.z;
    var vx = c.x - a.x, vy = c.y - a.y, vz = c.z - a.z;
    var nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    var m = Math.hypot(nx, ny, nz) || 1;
    return { x: nx / m, y: ny / m, z: nz / m };
  }

  function smoothstep(e0, e1, x) {
    var t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
    return t * t * (3 - 2 * t);
  }

  /* The rim tips from ice to gold at the crest of the Fresnel, exactly the
     mix() both shaders do. */
  function rim(f, warmAt) {
    var t = smoothstep(warmAt, 1.0, f);
    return [
      RIM_COOL[0] + (RIM_WARM[0] - RIM_COOL[0]) * t,
      RIM_COOL[1] + (RIM_WARM[1] - RIM_COOL[1]) * t,
      RIM_COOL[2] + (RIM_WARM[2] - RIM_COOL[2]) * t
    ];
  }

  /* 0 = solid hull, 1 = bare wireframe. menu.gd drives this with a looping
     tween: hold, sine-in-out across, hold, sine-in-out back. */
  function blendAt(time) {
    var t = time % CYCLE;
    if (t < HOLD) return 0;
    if (t < HOLD + FADE) return 0.5 * (1 - Math.cos(Math.PI * ((t - HOLD) / FADE)));
    if (t < HOLD * 2 + FADE) return 1;
    return 0.5 * (1 + Math.cos(Math.PI * ((t - HOLD * 2 - FADE) / FADE)));
  }

  /* ---- draw ------------------------------------------------------------- */

  var w = 0, h = 0, scale = 0;

  function resize() {
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var css = cv.getBoundingClientRect();
    w = css.width; h = css.height;
    cv.width = Math.round(w * dpr);
    cv.height = Math.round(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    scale = Math.min(w, h) * 0.30;
  }

  function frame(time) {
    ctx.clearRect(0, 0, w, h);

    var spin = (time / PERIOD) * Math.PI * 2;
    var wire = blendAt(time);
    var hullK = 1 - wire;

    // `breath` — the slow brightness swell both passes ride, out of phase
    // between them because they run at different rates in the shaders.
    var hullBreath = 1 + Math.sin(time * PULSE_HZ * Math.PI * 2) * PULSE_AMT;
    var wireBreath = 1 + Math.sin(time * WIRE_PULSE_HZ * Math.PI * 2) * WIRE_PULSE_AMT;

    var cx = w / 2, cy = h / 2;

    // transform every vertex once, normal included — `rotate` is a pure
    // rotation, so the same call carries the normal into view space.
    var P = V.map(function (p, idx) {
      var r = rotate(p, spin);
      var f = DIST / (DIST - r.z);
      return { x: cx + r.x * scale * f, y: cy - r.y * scale * f, r: r, n: rotate(VN[idx], spin) };
    });

    /* The hull's ALBEDO for one Fresnel value: interior colour plus the rim,
       tipping ice to gold at the crest, dimmed by the cross-fade. */
    function hullInk(fres) {
      var col = rim(fres, WARM_AT);
      var lit = fres * RIM_GAIN * hullBreath * hullK;
      return 'rgb(' +
        Math.round(Math.min(255, BODY[0] + col[0] * lit)) + ',' +
        Math.round(Math.min(255, BODY[1] + col[1] * lit)) + ',' +
        Math.round(Math.min(255, BODY[2] + col[2] * lit)) + ')';
    }

    // depth-sort faces, far to near
    var faces = F.map(function (f) {
      var z = 0;
      for (var k = 0; k < f.length; k++) z += P[f[k]].r.z;
      return { f: f, z: z / f.length };
    }).sort(function (a, b) { return a.z - b.z; });

    ctx.lineJoin = 'round';

    /* --- pass one: the hull ---------------------------------------------
       Opaque, so it occludes — that never stops, even at the wireframe end of
       the cross. It goes dark but keeps covering, which is what keeps the
       far-side edges culled the whole way across. Only the rim term fades. */
    faces.forEach(function (o) {
      var f = o.f, k;

      ctx.beginPath();
      ctx.moveTo(P[f[0]].x, P[f[0]].y);
      for (k = 1; k < f.length; k++) ctx.lineTo(P[f[k]].x, P[f[k]].y);
      ctx.closePath();

      // The face's dimmest and brightest corner, and a gradient run between
      // them — the stand-in for interpolating the Fresnel across the facet.
      var fr = [], lo = 0, hi = 0;
      for (k = 0; k < f.length; k++) {
        fr[k] = Math.pow(1 - Math.abs(P[f[k]].n.z), RIM_POWER);
        if (fr[k] < fr[lo]) lo = k;
        if (fr[k] > fr[hi]) hi = k;
      }

      if (lo === hi) {
        ctx.fillStyle = hullInk(fr[0]);
      } else {
        var g = ctx.createLinearGradient(P[f[lo]].x, P[f[lo]].y, P[f[hi]].x, P[f[hi]].y);
        g.addColorStop(0, hullInk(fr[lo]));
        g.addColorStop(1, hullInk(fr[hi]));
        ctx.fillStyle = g;
      }
      ctx.fill();
    });

    /* --- pass two: the wireframe ----------------------------------------
       Additive, and only on the faces pointing at the camera. That pairing is
       the depth test: the near-side edges are the ones in front of the hull,
       and the far side is behind opaque geometry and never arrives.

       Switched off outright once the blend reaches zero — the pass is nothing
       but line primitives and there is nothing to see for the price. */
    if (wire > 0.002) {
      ctx.globalCompositeOperation = 'lighter';
      faces.forEach(function (o) {
        var f = o.f;
        var nrm = normal(P[f[0]].r, P[f[1]].r, P[f[2]].r);
        if (nrm.z <= 0) return;                     // facing away — culled
        var fres = Math.pow(1 - Math.abs(nrm.z), WIRE_POWER);
        var col = rim(fres, WIRE_WARM);
        var lit = (WIRE_BASE + fres * WIRE_GAIN) * wireBreath * wire * 0.5;

        ctx.beginPath();
        ctx.moveTo(P[f[0]].x, P[f[0]].y);
        for (var k = 1; k < f.length; k++) ctx.lineTo(P[f[k]].x, P[f[k]].y);
        ctx.closePath();

        ctx.strokeStyle = 'rgba(' +
          Math.round(col[0]) + ',' + Math.round(col[1]) + ',' + Math.round(col[2]) + ',' +
          Math.min(1, lit).toFixed(3) + ')';
        ctx.lineWidth = 1.1;
        ctx.stroke();
      });
      ctx.globalCompositeOperation = 'source-over';
    }

    /* The Environment's glow, standing in for glow_intensity 0.5 / bloom 0.12.
       Kept tight to the silhouette: the wide bloom behind the object is the
       page's own #bloom layer, which is menu.tscn's Bloom TextureRect. */
    var glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, scale * 1.5);
    glow.addColorStop(0, 'rgba(184,235,255,' + (0.10 + wire * 0.05).toFixed(3) + ')');
    glow.addColorStop(0.45, 'rgba(184,235,255,0.035)');
    glow.addColorStop(1, 'rgba(184,235,255,0)');
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, w, h);
    ctx.globalCompositeOperation = 'source-over';
  }

  /* ---- loop ------------------------------------------------------------- */

  resize();
  window.addEventListener('resize', function () { resize(); if (still) frame(2.4); });

  if (still) {
    // A pose, not the resting state: far enough into the cycle that the hull is
    // solid and the rim is lit, so the still frame is the object as designed.
    frame(2.4);
    return;
  }

  var t0 = null;
  (function loop(t) {
    if (t0 === null) t0 = t;
    if (!document.hidden) frame((t - t0) / 1000);
    requestAnimationFrame(loop);
  })(performance.now());
})();
