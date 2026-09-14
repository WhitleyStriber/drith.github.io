/* ============================================================================
   THE RESUME PAGE — the sheet switch, the ruled borders, the entrances, the
   lattice and the foot wave. See the header of resume.css for what each is.
   ========================================================================== */

(function () {
  'use strict';

  var doc = document.documentElement;
  var still = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function sheet() { return doc.getAttribute('data-sheet') === 'dark' ? 'dark' : 'light'; }

  /* ------------------------------------------------------------ the switch ---
     Light is the Human sheet and dark is Human_Dark, and the download follows
     whichever one is on screen, so the PDF someone saves is the page they saw. */

  var dl = document.getElementById('dl');
  var buttons = [].slice.call(document.querySelectorAll('.sheets button'));
  var onSheet = [];

  function applySheet(name, remember) {
    doc.classList.add('switching');
    if (name === 'dark') doc.setAttribute('data-sheet', 'dark');
    else doc.removeAttribute('data-sheet');
    buttons.forEach(function (b) {
      b.setAttribute('aria-pressed', String(b.getAttribute('data-sheet') === name));
    });
    if (dl) dl.setAttribute('href', dl.getAttribute('data-' + name));
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', name === 'dark' ? '#2E3237' : '#FAF7F1');
    if (remember) {
      try { localStorage.setItem('resume-sheet', name); } catch (e) {}
    }
    onSheet.forEach(function (fn) { fn(name); });
    setTimeout(function () { doc.classList.remove('switching'); }, 400);
  }

  buttons.forEach(function (b) {
    b.addEventListener('click', function () { applySheet(b.getAttribute('data-sheet'), true); });
  });
  applySheet(sheet(), false);

  /* ------------------------------------------------------------- the rules ---
     Each card's border is an SVG rect the card's own size, so it can be drawn
     round its perimeter with a dash. Sized from offsetWidth rather than the
     bounding box, which would include the entrance's scale. */

  var ruled = [].slice.call(document.querySelectorAll('.sheet, .card'));
  var SVG = 'http://www.w3.org/2000/svg';

  function sizeRule(el) {
    var svg = el._rule;
    var w = el.offsetWidth, h = el.offsetHeight;
    var r = el.classList.contains('sheet') ? 4 : 8;
    var inset = 0.5;
    svg.setAttribute('width', w);
    svg.setAttribute('height', h);
    var rect = svg.firstChild;
    rect.setAttribute('x', inset);
    rect.setAttribute('y', inset);
    rect.setAttribute('width', Math.max(0, w - inset * 2));
    rect.setAttribute('height', Math.max(0, h - inset * 2));
    rect.setAttribute('rx', r);
    var len = 2 * (w + h) + 8;
    rect.style.setProperty('--len', len + 'px');
  }

  ruled.forEach(function (el) {
    var svg = document.createElementNS(SVG, 'svg');
    svg.setAttribute('class', 'rule');
    svg.setAttribute('aria-hidden', 'true');
    svg.appendChild(document.createElementNS(SVG, 'rect'));
    el._rule = svg;
    el.insertBefore(svg, el.firstChild);
    sizeRule(el);
  });

  if (window.ResizeObserver) {
    var ro = new ResizeObserver(function (entries) {
      entries.forEach(function (e) { sizeRule(e.target); });
    });
    ruled.forEach(function (el) { ro.observe(el); });
  } else {
    window.addEventListener('resize', function () { ruled.forEach(sizeRule); });
  }

  /* ------------------------------------------------------------ entrances ---
     Rows take their place in the card on a short beat, capped so a long card
     does not keep a reader waiting on its last bullet. A label's paint lands
     just after the row it belongs to. */

  var cards = [].slice.call(document.querySelectorAll('.card'));

  cards.forEach(function (card) {
    var rows = [].slice.call(card.querySelectorAll('[data-r]'));
    var first = card.classList.contains('masthead') ? 1.0 : 0.22;
    rows.forEach(function (row, n) {
      row.style.setProperty('--d', Math.min(first + n * 0.045, 1.4).toFixed(3) + 's');
    });
    [].slice.call(card.querySelectorAll('.paint')).forEach(function (p) {
      var row = p.closest('[data-r]');
      var at = row ? parseFloat(row.style.getPropertyValue('--d')) + 0.14 : 0.12;
      if (card.classList.contains('masthead') && !row) at = 0.62;
      p.style.setProperty('--pd', at.toFixed(3) + 's');
    });
  });

  var sheetEl = document.querySelector('.sheet');
  var dlPaint = document.querySelector('.bar .dl');

  function reveal(el, delay) {
    el.style.setProperty('--cd', delay.toFixed(3) + 's');
    el.classList.add('on');
  }

  if (still || !window.IntersectionObserver) {
    if (sheetEl) sheetEl.classList.add('on');
    if (dlPaint) dlPaint.classList.add('on');
    cards.forEach(function (c) { c.classList.add('on'); });
  } else {
    /* Two frames, so the armed state is painted before .on lands and the
       transitions have somewhere to start from. */
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        if (sheetEl) reveal(sheetEl, 0);
        if (dlPaint) reveal(dlPaint, 0.9);

        var batch = 0, batchTimer = 0;
        var io = new IntersectionObserver(function (entries) {
          entries.forEach(function (e) {
            if (!e.isIntersecting) return;
            // Cards arriving together come in one after another, not at once.
            reveal(e.target, batch * 0.14);
            batch++;
            io.unobserve(e.target);
          });
          clearTimeout(batchTimer);
          batchTimer = setTimeout(function () { batch = 0; }, 120);
        }, { rootMargin: '0px 0px -6% 0px', threshold: 0 });
        cards.forEach(function (c) { io.observe(c); });
      });
    });
  }

  /* ----------------------------------------------------------- the lattice ---
     shaders/menu_field.gdshader as tools/make_field.py bakes it for the sheet:
     COVERAGE, not light — alpha is how much ink lands, composited over the
     stock, so the same maths is ink on paper for one sheet and light on the
     panel for the other. Unlike the bake, the sweep travels. */

  var FIELD = {
    light: { rest: [90, 100, 114], crest: [107, 96, 195], grid: 0.105, major: 0.17, dot: 0.20, gain: 0.72 },
    dark:  { rest: [158, 184, 209], crest: [185, 140, 240], grid: 0.055, major: 0.09, dot: 0.13, gain: 0.62 }
  };
  var PITCH = 28;          // CSS px; the sheet's 20 pt lattice at screen size
  var SWEEP_PERIOD = 19;   // menu.tscn's sweep_period

  var FS = [
    'precision highp float;',
    'uniform vec2 uRes;',
    'uniform float uScale;',
    'uniform float uTime;',
    'uniform vec3 rest;',
    'uniform vec3 crest;',
    'uniform float pitch;',
    'uniform float gridBase;',
    'uniform float gridMajor;',
    'uniform float dotBase;',
    'uniform float gain;',
    'uniform float period;',
    'void main() {',
    '  vec2 px = vec2(gl_FragCoord.x, uRes.y - gl_FragCoord.y) / uScale;',
    '  vec2 screen = uRes / uScale;',
    '  float lead = pitch * 5.0;',
    '  float travel = screen.x + screen.y * 0.6 + lead * 2.0;',
    '  float band = fract(uTime / period) * travel - lead;',
    '',
    '  vec2 cell = px / pitch;',
    '  vec2 toLine = (0.5 - abs(fract(cell) - 0.5)) * pitch;',
    '  float lineD = min(toLine.x, toLine.y);',
    '  float lineM = 1.0 - smoothstep(0.0, 1.1 / uScale, lineD);',
    '  float isMajor = max(step(mod(floor(cell.x + 0.5), 5.0), 0.0),',
    '                      step(mod(floor(cell.y + 0.5), 5.0), 0.0));',
    '  float diag = px.x + px.y * 0.6;',
    '  float liftLine = clamp(1.0 - abs(diag - band) / (pitch * 5.0), 0.0, 1.0);',
    '  float ga = (gridBase + isMajor * (gridMajor - gridBase) + liftLine * 0.04) * lineM;',
    '',
    '  vec2 lat = floor(cell + 0.5) * pitch;',
    '  float dotD = length(px - lat);',
    '  float liftDot = clamp(1.0 - abs((lat.x + lat.y * 0.6) - band) / (pitch * 4.5), 0.0, 1.0);',
    '  float r = (0.9 + liftDot * 1.6) * pitch / 40.0;',
    '  float aa = 0.6 / uScale;',
    '  float dotM = 1.0 - smoothstep(r - aa, r + aa, dotD);',
    '  float da = (dotBase + liftDot * gain) * dotM;',
    '',
    '  float a = clamp(ga * (1.0 - da) + da, 0.0, 1.0);',
    '  vec3 tipped = mix(rest, crest, smoothstep(0.55, 0.92, liftDot));',
    '  float wdot = a > 0.00001 ? da / a : 0.0;',
    '  vec3 col = mix(rest, tipped, wdot);',
    '  gl_FragColor = vec4(col * a, a);',
    '}'
  ].join('\n');

  var VS = 'attribute vec2 aPos; void main() { gl_Position = vec4(aPos, 0.0, 1.0); }';

  var drawField = (function () {
    var cv = document.getElementById('field');
    if (!cv) return null;
    var gl = cv.getContext('webgl', { alpha: true, premultipliedAlpha: true, antialias: false, depth: false });
    if (!gl) { cv.style.display = 'none'; return null; }

    function shader(type, src) {
      var s = gl.createShader(type);
      gl.shaderSource(s, src);
      gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
      return s;
    }
    var prog;
    try {
      prog = gl.createProgram();
      gl.attachShader(prog, shader(gl.VERTEX_SHADER, VS));
      gl.attachShader(prog, shader(gl.FRAGMENT_SHADER, FS));
      gl.linkProgram(prog);
      if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog));
    } catch (e) {
      cv.style.display = 'none';
      return null;
    }
    gl.useProgram(prog);

    var buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    var aPos = gl.getAttribLocation(prog, 'aPos');
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

    var u = {};
    ['uRes', 'uScale', 'uTime', 'rest', 'crest', 'pitch', 'gridBase', 'gridMajor', 'dotBase', 'gain', 'period']
      .forEach(function (n) { u[n] = gl.getUniformLocation(prog, n); });

    return function (time) {
      var scale = Math.min(window.devicePixelRatio || 1, 1.5);
      var w = Math.round(cv.clientWidth * scale), h = Math.round(cv.clientHeight * scale);
      if (w < 1 || h < 1) return;
      if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; }
      var f = FIELD[sheet()];
      gl.viewport(0, 0, w, h);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.uniform2f(u.uRes, w, h);
      gl.uniform1f(u.uScale, scale);
      gl.uniform1f(u.uTime, time);
      gl.uniform3f(u.rest, f.rest[0] / 255, f.rest[1] / 255, f.rest[2] / 255);
      gl.uniform3f(u.crest, f.crest[0] / 255, f.crest[1] / 255, f.crest[2] / 255);
      gl.uniform1f(u.pitch, PITCH);
      gl.uniform1f(u.gridBase, f.grid);
      gl.uniform1f(u.gridMajor, f.major);
      gl.uniform1f(u.dotBase, f.dot);
      gl.uniform1f(u.gain, f.gain);
      gl.uniform1f(u.period, SWEEP_PERIOD);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    };
  })();

  /* -------------------------------------------------------------- the wave ---
     tools/make_wave.py's three sines at incommensurate frequencies, inked teal ->
     blue -> violet along the drag. Here each drifts at its own speed, so it never
     quite repeats, and on arrival it is drawn out from the left. */

  var WAVES = [
    // cycles, amplitude (of half-height), phase, half-width (px of 1600), weight, drift (rad/s)
    [2.20, 0.66, 0.00, 1.5, 1.00, 0.35],
    [3.45, 0.38, 1.10, 1.1, 0.62, -0.52],
    [1.35, 0.24, 2.40, 0.9, 0.38, 0.23]
  ];
  var WAVE_INK = {
    light: ['#157B6D', '#0062F7', '#8D43E7'],
    dark:  ['#52E2CE', '#6FA8FF', '#B98CF0']
  };

  var drawWave = (function () {
    var cv = document.getElementById('wave');
    if (!cv || !cv.getContext) return null;
    var ctx = cv.getContext('2d');
    var shown = still ? 1 : 0, drawStart = null;

    if (!still && window.IntersectionObserver) {
      new IntersectionObserver(function (entries, obs) {
        if (entries[0].isIntersecting) { drawStart = performance.now(); obs.disconnect(); }
      }).observe(cv);
    } else {
      shown = 1;
    }

    return function (time, now) {
      var scale = Math.min(window.devicePixelRatio || 1, 2);
      var w = cv.clientWidth, h = cv.clientHeight;
      if (w < 1 || h < 1) return;
      if (cv.width !== Math.round(w * scale) || cv.height !== Math.round(h * scale)) {
        cv.width = Math.round(w * scale);
        cv.height = Math.round(h * scale);
      }
      if (drawStart !== null && shown < 1) {
        var k = Math.min(1, (now - drawStart) / 1600);
        shown = 1 - Math.pow(1 - k, 3);
      }
      ctx.setTransform(scale, 0, 0, scale, 0, 0);
      ctx.clearRect(0, 0, w, h);
      if (shown <= 0) return;

      var ink = WAVE_INK[sheet()];
      var g = ctx.createLinearGradient(0, 0, w, 0);
      g.addColorStop(0, ink[0]);
      g.addColorStop(0.5, ink[1]);
      g.addColorStop(1, ink[2]);
      ctx.strokeStyle = g;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      var mid = h / 2, k1600 = w / 1600, end = w * shown;
      WAVES.forEach(function (wv) {
        var lw = Math.max(1, wv[3] * 2 * k1600 * 1.4);
        var amp = wv[1] * (h / 2 - lw);
        ctx.globalAlpha = wv[4];
        ctx.lineWidth = lw;
        ctx.beginPath();
        for (var x = 0; x <= end; x += 2) {
          var y = mid + amp * Math.sin(2 * Math.PI * wv[0] * (x / w) + wv[2] + time * wv[5]);
          if (x === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }
        ctx.stroke();
      });
      ctx.globalAlpha = 1;
    };
  })();

  /* -------------------------------------------------------------- the loop --- */

  var t0 = performance.now();
  function frame(now) {
    var t = still ? 6.0 : (now - t0) / 1000;
    if (drawField) drawField(t);
    if (drawWave) drawWave(t, now);
  }

  onSheet.push(function () { requestAnimationFrame(frame); });

  if (still) {
    requestAnimationFrame(frame);
    window.addEventListener('resize', function () { requestAnimationFrame(frame); });
  } else {
    (function loop(now) {
      requestAnimationFrame(loop);
      if (!document.hidden) frame(now);
    })(performance.now());
  }
})();
