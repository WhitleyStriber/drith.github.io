/* Drith crystal — a real 3D mesh (hexagonal bipyramid), rotated and
   perspective-projected onto a 2D canvas each frame. Faces are depth-sorted
   and lit, so it reads as a solid holographic solid rather than a flat SVG.
   No dependencies. */

(function () {
  'use strict';

  var cv = document.getElementById('crystal');
  if (!cv || !cv.getContext) return;
  var ctx = cv.getContext('2d');

  var ACC = [77, 230, 122];          // HUD_EMBER
  var still = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---- geometry: two hex rings between a top and bottom apex ------------ */

  var V = [{ x: 0, y: 1.55, z: 0 }];  // 0 — top apex
  var R_HI = 0.60, R_LO = 0.76, Y_HI = 0.50, Y_LO = -0.50;
  var i;
  for (i = 0; i < 6; i++) {          // 1..6 — upper ring
    var a = (i / 6) * Math.PI * 2;
    V.push({ x: Math.cos(a) * R_HI, y: Y_HI, z: Math.sin(a) * R_HI });
  }
  for (i = 0; i < 6; i++) {          // 7..12 — lower ring
    var b = (i / 6) * Math.PI * 2;
    V.push({ x: Math.cos(b) * R_LO, y: Y_LO, z: Math.sin(b) * R_LO });
  }
  V.push({ x: 0, y: -1.80, z: 0 });  // 13 — bottom apex

  var F = [];
  for (i = 0; i < 6; i++) {
    var n = (i + 1) % 6;
    F.push([0, 1 + i, 1 + n]);                    // crown
    F.push([1 + i, 7 + i, 7 + n, 1 + n]);         // belt
    F.push([7 + n, 7 + i, 13]);                   // base
  }

  /* ---- transform -------------------------------------------------------- */

  var TILT = -0.30;                  // fixed lean, so it never reads flat
  var DIST = 4.6;                    // camera distance for the perspective divide
  var LIGHT = { x: -0.45, y: 0.72, z: 0.52 };

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

  function rgba(a) { return 'rgba(' + ACC[0] + ',' + ACC[1] + ',' + ACC[2] + ',' + a + ')'; }

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

  function frame(spin) {
    ctx.clearRect(0, 0, w, h);

    var cx = w / 2, cy = h / 2;

    // Inner bloom. Radius stays inside the shortest half-dimension so it
    // reaches zero alpha before the canvas edge — otherwise the fill clips
    // and you see a rectangle around the crystal.
    var bloom = Math.min(w, h) * 0.48;
    var g = ctx.createRadialGradient(cx, cy, 0, cx, cy, bloom);
    g.addColorStop(0, rgba(0.30));
    g.addColorStop(0.42, rgba(0.07));
    g.addColorStop(1, rgba(0));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);

    // transform every vertex once
    var P = V.map(function (p) {
      var r = rotate(p, spin);
      var f = DIST / (DIST - r.z);
      return { x: cx + r.x * scale * f, y: cy - r.y * scale * f, r: r };
    });

    // depth-sort faces, far to near
    var faces = F.map(function (f) {
      var z = 0;
      for (var k = 0; k < f.length; k++) z += P[f[k]].r.z;
      return { f: f, z: z / f.length };
    }).sort(function (a, b) { return a.z - b.z; });

    ctx.lineJoin = 'round';

    faces.forEach(function (o) {
      var f = o.f;
      var nrm = normal(P[f[0]].r, P[f[1]].r, P[f[2]].r);
      var lam = Math.max(0, nrm.x * LIGHT.x + nrm.y * LIGHT.y + nrm.z * LIGHT.z);
      var facing = nrm.z > 0;                 // toward the camera

      ctx.beginPath();
      ctx.moveTo(P[f[0]].x, P[f[0]].y);
      for (var k = 1; k < f.length; k++) ctx.lineTo(P[f[k]].x, P[f[k]].y);
      ctx.closePath();

      // Glassy: back faces stay dim so the solid reads as translucent.
      ctx.fillStyle = rgba((facing ? 0.10 : 0.03) + lam * (facing ? 0.26 : 0.06));
      ctx.fill();

      ctx.strokeStyle = rgba(facing ? 0.34 + lam * 0.5 : 0.12);
      ctx.lineWidth = facing ? 1.15 : 0.7;
      ctx.stroke();
    });

    // hot core
    var c2 = ctx.createRadialGradient(cx, cy + scale * 0.05, 0, cx, cy + scale * 0.05, scale * 0.62);
    c2.addColorStop(0, 'rgba(223,255,233,.55)');
    c2.addColorStop(0.5, rgba(0.16));
    c2.addColorStop(1, rgba(0));
    ctx.fillStyle = c2;
    ctx.fillRect(0, 0, w, h);
  }

  /* ---- loop ------------------------------------------------------------- */

  resize();
  window.addEventListener('resize', resize);

  if (still) {
    frame(0.5);
    return;
  }

  var t0 = null;
  (function loop(t) {
    if (t0 === null) t0 = t;
    frame(((t - t0) / 1000) * 0.42);
    requestAnimationFrame(loop);
  })(performance.now());
})();
