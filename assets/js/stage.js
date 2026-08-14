/* ============================================================================
   THE BOARD'S GROUND AND ITS OBJECT — world/menu.tscn, in WebGL.

   The menu stacks five layers back to front and this file is all five of them:

     Void       flat ColorRect, Color(0.027, 0.043, 0.043)
     Field      shaders/menu_field.gdshader, additive over the void
     Bloom      a radial GradientTexture2D sat right of centre
     StageView  a 3D SubViewport: the real Drith base, drawn as a dark
                Fresnel-lit HULL (shaders/menu_hull.gdshader) under an emissive
                WIREFRAME (shaders/menu_wireframe.gdshader), tonemapped and
                glowed by the viewport's own Environment
     Vignette   a second radial gradient, this one closing the corners down

   The two fragment shaders and the field are ported line for line — same
   uniforms, same defaults, same maths. The camera is menu.tscn's Camera3D
   (fov 40 vertical, the transform verbatim) and the model is the actual
   Drith_01 mesh exported out of the .blend, normalised by the same _frame()
   rule menu.gd runs: longest axis to `model_span`, centred on the pivot.

   WHY THE OBJECT LANDS WHERE IT DOES, at any window size, without a single
   magic offset: the game runs stretch/mode="canvas_items" with
   aspect="keep_height", so its logical viewport is always 1080 tall and only
   its width moves. The camera therefore keeps a constant VERTICAL fov and
   takes the window's aspect. Reproduce those two facts and the projection puts
   the base exactly where the engine puts it — see the note on --u in board.css,
   which is the same rule applied to the type.

   WHERE THIS DEPARTS, and why:
     - The 3D pass is supersampled rather than MSAA'd (msaa_3d = 2 on the
       SubViewport). One code path instead of two, and the wireframe is the only
       thing on the stage that needs the coverage.
     - The Environment's glow is five mip levels rather than seven, taking the
       two the default glow_levels actually turn on. The rest are below a pixel.
     - Below a certain aspect the camera is nudged so the base stays on screen.
       The game never renders a portrait window; a phone does. See NARROW.
   ========================================================================== */

(function () {
  'use strict';

  var cv = document.getElementById('stage');
  if (!cv) return;

  var gl = cv.getContext('webgl2', { alpha: false, antialias: true, depth: false,
                                     premultipliedAlpha: false });
  var GL2 = !!gl;
  if (!gl) {
    gl = cv.getContext('webgl', { alpha: false, antialias: true, depth: false,
                                  premultipliedAlpha: false });
  }
  if (!gl) { cv.style.display = 'none'; return; }

  var still = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var wantsObject = document.body.classList.contains('board-page');

  /* ---------------------------------------------------------------- scene ---
     menu.tscn's own numbers. Void is the ColorRect's colour; the two gradients
     are the GradientTexture2Ds, each a radial fill running from the middle of
     its rect out to the middle of its right edge (fill_from 0.5,0.5 ->
     fill_to 1,0.5), which is an ellipse once the 320px square is stretched
     across a rect that is not square. All of it is 2D, so all of it is sRGB —
     Godot's canvas renderer does no linear conversion.                      */

  var VOID = [0.027, 0.043, 0.043];

  // Bloom TextureRect: anchors 0.5 / 0.08 -> 0.98 / 0.98.
  var BLOOM = {
    rect: [0.50, 0.08, 0.98, 0.98],
    stops: [0.0, 0.30, 0.62, 1.0],
    cols: [[1.00, 0.88, 0.55, 0.130],
           [0.72, 0.92, 1.00, 0.070],
           [0.59, 0.78, 0.92, 0.025],
           [0.59, 0.78, 0.92, 0.000]]
  };

  // Vignette TextureRect: full rect.
  var VIGNETTE = {
    rect: [0.0, 0.0, 1.0, 1.0],
    stops: [0.0, 0.55, 1.0, 1.0],
    cols: [[0.000, 0.000, 0.000, 0.00],
           [0.016, 0.024, 0.024, 0.32],
           [0.016, 0.024, 0.024, 0.86],
           [0.016, 0.024, 0.024, 0.86]]
  };

  /* --- menu.gd's stage ---------------------------------------------------- */
  var MODEL_PERIOD = 34.0;              // seconds per revolution
  var MODEL_SPAN   = 2.6;               // longest axis, metres, once on stage
  var MODEL_TILT   = 13.0;              // degrees of look-down
  var HOLD = 5.0, FADE = 1.8;           // material_hold / material_fade
  var CYCLE = (HOLD + FADE) * 2;
  var EDGE_LIFT = 0.004;                // world metres, converted by _build_model

  // Camera3D: transform verbatim out of menu.tscn, and its 40 degree fov. Godot
  // cameras keep the HEIGHT by default, so 40 is the vertical angle — the same
  // axis the project's stretch mode holds fixed.
  //
  // ROW-major, which is how a .tscn serialises a Transform3D — the twelve
  // numbers are basis.rows[0], rows[1], rows[2], origin, not the three axis
  // vectors. Read as columns instead it is the transpose, which for this one
  // (a pure X rotation) is a camera pitched four degrees UP rather than down,
  // and the base sits a fifth of the screen too low.
  var CAM_BASIS = [1, 0, 0,  0, 0.9976, 0.0698,  0, -0.0698, 0.9976];
  var CAM_ORIGIN = [0, 0.55, 5.6];
  var CAM_FOV = 40.0, CAM_NEAR = 0.05, CAM_FAR = 4000.0;

  /* THE FAR PLANE IS A DEPTH-PRECISION NUMBER, not a framing one — nothing in
     this scene is past six metres, so where it sits changes no pixel. It matters
     because the wireframe's hidden-line culling IS the hull's depth buffer, and
     the edges are lifted off that hull by four millimetres (see EDGE_LIFT). At
     Godot's 0.05..4000 a 16-bit buffer resolves about 7 mm at the object's
     distance, so the lift lands inside one depth step, the front-facing edges
     z-fight themselves away, and the wireframe pass comes through as a bare
     silhouette. 24-bit holds the scene's own far plane with room to spare;
     where only 16 is available the plane comes in far enough to buy the same
     margin, which costs nothing because there is nothing out there. */
  var FAR_16BIT = 60.0;

  // Pivot node: right of centre, because the ledger owns the left half.
  var PIVOT = [1.28, -0.08, 0];

  // Environment: tonemap_mode 2 (filmic), glow at intensity 0.5 / bloom 0.12.
  var GLOW_INTENSITY = 0.5, GLOW_BLOOM = 0.12;
  var GLOW_THRESHOLD = 1.0, GLOW_SCALE = 2.0, GLOW_CAP = 12.0;

  /* WHERE THE OBJECT STOPS BEING EXACT, and why it has to.

     keep_height means a narrower window shows LESS of the world across, so the
     pivot's 1.28 m of offset takes up more of the frame the narrower it gets: at
     16:9 the base sits at 68% of the width, at 4:3 it is at 81% and clipping the
     right edge, and by portrait it has walked off entirely. The game never
     renders those windows. A browser does.

     So above NARROW the camera is menu.tscn's, untouched — which covers every
     ordinary desktop window, 16:10 included. Below it the camera slides back
     toward the middle, reaching dead centre by 1:2, and the object fades as the
     frame goes portrait and the ledger starts sitting on top of it. Sliding the
     CAMERA rather than the model keeps the same three-quarter attitude the base
     has on a wide screen. */
  var NARROW = 1.5;

  /* ------------------------------------------------------------ sRGB <-> linear
     3D is lit and tonemapped in linear light and presented in sRGB; `source_color`
     uniforms are converted on the way in. 2D is sRGB throughout and converts
     nothing, which is why the field and the two gradients are used raw. */

  function toLinear(c) {
    return c.map(function (v) {
      return v < 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    });
  }

  /* --------------------------------------------------------------- plumbing --- */

  function compile(type, src) {
    var s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
      throw new Error(gl.getShaderInfoLog(s) + '\n' + src);
    }
    return s;
  }

  function program(vs, fs) {
    var p = gl.createProgram();
    gl.attachShader(p, compile(gl.VERTEX_SHADER, vs));
    gl.attachShader(p, compile(gl.FRAGMENT_SHADER, fs));
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
      throw new Error(gl.getProgramInfoLog(p));
    }
    // Uniform and attribute locations, looked up once and hung off the program.
    p.u = {}; p.a = {};
    var i, n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
    for (i = 0; i < n; i++) {
      var un = gl.getActiveUniform(p, i).name.replace(/\[0\]$/, '');
      p.u[un] = gl.getUniformLocation(p, un);
    }
    n = gl.getProgramParameter(p, gl.ACTIVE_ATTRIBUTES);
    for (i = 0; i < n; i++) {
      var an = gl.getActiveAttrib(p, i).name;
      p.a[an] = gl.getAttribLocation(p, an);
    }
    return p;
  }

  var QUAD_VS = [
    'attribute vec2 aPos;',
    'varying vec2 vUv;',
    'void main() {',
    '  vUv = aPos * 0.5 + 0.5;',
    '  gl_Position = vec4(aPos, 0.0, 1.0);',
    '}'
  ].join('\n');

  var quadBuf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, quadBuf);
  gl.bufferData(gl.ARRAY_BUFFER,
    new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);

  function drawQuad(p) {
    gl.bindBuffer(gl.ARRAY_BUFFER, quadBuf);
    gl.enableVertexAttribArray(p.a.aPos);
    gl.vertexAttribPointer(p.a.aPos, 2, gl.FLOAT, false, 0, 0);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  /* ========================================================================
     THE FIELD — shaders/menu_field.gdshader, ported.

     Two changes, both forced by the coordinate system rather than chosen:
     Godot's FRAGCOORD counts down from the top-left and GL's counts up from the
     bottom-left, so y is flipped back before anything reads it (the sweep runs
     on a diagonal, and unflipped it would travel the wrong way); and
     SCREEN_PIXEL_SIZE is handed in as its reciprocal, which is all the shader
     ever wanted it for.

     It stays in RENDER-TARGET pixels, exactly as the shader does — `pitch` is
     52 of the pixels the thing is actually drawn in, so the lattice is finer on
     a dense display. That is the engine's own behaviour, not a rounding of it.
     ======================================================================== */

  var FIELD_FS = [
    'precision highp float;',
    'uniform vec2 uRes;',           // 1.0 / SCREEN_PIXEL_SIZE
    'uniform float uTime;',
    'uniform vec3 cool;',
    'uniform vec3 warm;',
    'uniform float pitch;',
    'uniform float sweep_period;',
    'uniform float grid_base;',
    'uniform float dot_base;',
    'uniform float sweep_gain;',
    'uniform float opacity;',
    'uniform float grain_amount;',
    'uniform float grain_bite;',
    'uniform float grain_px;',
    'uniform float grain_drift;',
    'uniform float grain_churn;',
    'uniform float grain_beat;',
    '',
    'float hash21(vec2 p) {',
    '  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);',
    '}',
    '',
    // Blocky brush strokes: the plane is sheared so the drag runs at an angle,
    // chopped into cells wide across the stroke and short along it, each cell a
    // FLAT value — a brush lays a slab of pigment, not a gradient.
    'float strokes(vec2 px, float cell, float aspect, float beat) {',
    '  vec2 sheared = vec2(px.x + px.y * 0.35, px.y);',
    '  vec2 c = vec2(sheared.x / (cell * aspect), sheared.y / cell);',
    '  vec2 id = floor(c);',
    '  float slab = hash21(id);',
    '  float seg = hash21(id + vec2(37.0, 11.0) + vec2(floor(fract(c.x) * 3.0), 0.0));',
    '  float v = mix(slab, seg, 0.35);',
    '  float t = beat + slab * 4.0;',
    '  float b0 = floor(t);',
    '  float swap = smoothstep(0.66, 0.94, fract(t));',
    '  float re = mix(hash21(id + vec2(b0 * 3.7, b0 * 1.9)),',
    '                 hash21(id + vec2((b0 + 1.0) * 3.7, (b0 + 1.0) * 1.9)),',
    '                 swap);',
    '  return mix(v, re, grain_churn);',
    '}',
    '',
    'void main() {',
    '  vec2 px = vec2(gl_FragCoord.x, uRes.y - gl_FragCoord.y);',
    '',
    '  vec2 drift_a = vec2(uTime * grain_drift, uTime * -grain_drift * 0.38);',
    '  vec2 drift_b = vec2(uTime * -grain_drift * 0.55, uTime * grain_drift * 0.27);',
    '  float beat = uTime * grain_beat;',
    '  float grain = strokes(px + drift_a, grain_px, 3.2, beat) * 0.65',
    '              + strokes(px * 0.37 + drift_b + vec2(91.0, 17.0), grain_px, 2.1, beat * 0.7) * 0.35;',
    '  grain -= 0.5;',
    '',
    '  vec2 screen = uRes;',
    '  float diag = px.x + px.y * 0.6;',
    '  float lead = pitch * 5.0;',
    '  float travel = screen.x + screen.y * 0.6 + lead * 2.0;',
    '  float band = fract(uTime / sweep_period) * travel - lead;',
    '',
    '  vec2 cell = px / pitch;',
    '  vec2 to_line = (0.5 - abs(fract(cell) - 0.5)) * pitch;',
    '  float line_d = min(to_line.x, to_line.y);',
    '  float line_m = 1.0 - smoothstep(0.0, 1.25, line_d);',
    '',
    '  float is_major = max(',
    '    step(mod(floor(cell.x + 0.5), 5.0), 0.0),',
    '    step(mod(floor(cell.y + 0.5), 5.0), 0.0)',
    '  );',
    '',
    '  float lift_line = clamp(1.0 - abs(diag - band) / (pitch * 5.0), 0.0, 1.0);',
    '  float ga = (grid_base + is_major * 0.020 + lift_line * 0.10) * line_m;',
    '',
    '  vec2 lattice = floor(cell + 0.5) * pitch;',
    '  float dot_d = length(px - lattice);',
    '  float lift_dot = clamp(1.0 - abs((lattice.x + lattice.y * 0.6) - band) / (pitch * 4.5), 0.0, 1.0);',
    '',
    '  float r = 0.9 + lift_dot * 1.6;',
    '  float dot_m = 1.0 - smoothstep(r - 0.7, r + 0.7, dot_d);',
    '  float da = (dot_base + lift_dot * sweep_gain) * dot_m;',
    '',
    '  vec3 dot_col = mix(cool, warm, smoothstep(0.55, 0.92, lift_dot));',
    '',
    '  float uneven = 1.0 + grain * grain_bite;',
    '  ga *= uneven;',
    '  da *= uneven;',
    '  vec3 haze = cool * max(grain, 0.0) * grain_amount;',
    '',
    '  gl_FragColor = vec4(cool * ga + dot_col * da + haze, opacity);',
    '}'
  ].join('\n');

  /* ========================================================================
     THE TWO GRADIENTS — Bloom and Vignette, as GradientTexture2D does them:
     a radial fill from the middle of the rect out to the middle of its right
     edge, sampled in the rect's own normalised space so it is an ellipse, and
     interpolated linearly through four stops in sRGB.
     ======================================================================== */

  var GRAD_FS = [
    'precision highp float;',
    'varying vec2 vUv;',
    'uniform vec4 uRect;',           // x0, y0, x1, y1 — 0..1, y down
    'uniform vec4 uStops;',
    'uniform vec4 uC0, uC1, uC2, uC3;',
    '',
    'void main() {',
    '  vec2 uv = vec2(vUv.x, 1.0 - vUv.y);',
    '  if (uv.x < uRect.x || uv.x > uRect.z || uv.y < uRect.y || uv.y > uRect.w) discard;',
    '  vec2 p = (uv - uRect.xy) / (uRect.zw - uRect.xy);',
    '  float t = clamp(length(p - vec2(0.5)) / 0.5, 0.0, 1.0);',
    '  vec4 c = uC0;',
    '  c = mix(c, uC1, clamp((t - uStops.x) / max(1e-5, uStops.y - uStops.x), 0.0, 1.0));',
    '  c = mix(c, uC2, clamp((t - uStops.y) / max(1e-5, uStops.z - uStops.y), 0.0, 1.0));',
    '  c = mix(c, uC3, clamp((t - uStops.z) / max(1e-5, uStops.w - uStops.z), 0.0, 1.0));',
    '  gl_FragColor = vec4(c.rgb * c.a, c.a);',   // premultiplied, blended ONE/1-SRC_A
    '}'
  ].join('\n');

  /* ========================================================================
     THE OBJECT.

     Both passes read the same Fresnel term the shaders do — 1 - |dot(N, V)| in
     VIEW space, which is where Godot's NORMAL and VIEW live — so the body stays
     near-black and only the rim gathers light. That is what makes a dark object
     read on a dark screen with no lights in the scene at all.
     ======================================================================== */

  var OBJ_VS = [
    'attribute vec3 aPos;',
    'attribute vec3 aNrm;',
    'uniform mat4 uMV;',
    'uniform mat4 uProj;',
    'uniform mat3 uNrmMat;',
    'varying vec3 vN;',
    'varying vec3 vV;',
    'void main() {',
    '  vec4 p = uMV * vec4(aPos, 1.0);',
    '  vN = uNrmMat * aNrm;',
    '  vV = -p.xyz;',                    // Godot's VIEW: normalize(-VERTEX)
    '  gl_Position = uProj * p;',
    '}'
  ].join('\n');

  // shaders/menu_hull.gdshader. Opaque, so it writes depth — and that is the
  // reason the pass exists at all. Only the SHADING fades out across the cross;
  // the depth it writes is the wireframe's hidden-line culling.
  var HULL_FS = [
    'precision highp float;',
    'varying vec3 vN;',
    'varying vec3 vV;',
    'uniform vec3 body;',
    'uniform vec3 rim_cool;',
    'uniform vec3 rim_warm;',
    'uniform float rim_power;',
    'uniform float rim_gain;',
    'uniform float warm_at;',
    'uniform float pulse_amt;',
    'uniform float pulse_hz;',
    'uniform float wire_blend;',
    'uniform float uTime;',
    'void main() {',
    '  float f = 1.0 - abs(dot(normalize(vN), normalize(vV)));',
    '  f = pow(clamp(f, 0.0, 1.0), rim_power);',
    '  vec3 rim = mix(rim_cool, rim_warm, smoothstep(warm_at, 0.98, f));',
    '  float breath = 1.0 + pulse_amt * sin(uTime * 6.2831853 * pulse_hz);',
    // Equal-power leg of the cross (the wireframe takes the sine leg): a linear
    // pair sums to half brightness at the midpoint and the object visibly dips.
    '  float k = cos(clamp(wire_blend, 0.0, 1.0) * 1.5707963);',
    '  gl_FragColor = vec4((body + rim * f * rim_gain * breath) * k, 1.0);',
    '}'
  ].join('\n');

  // shaders/menu_wireframe.gdshader. Additive, writes no depth, but still TESTS
  // against the hull's — so only the near-side edges survive.
  var WIRE_FS = [
    'precision highp float;',
    'varying vec3 vN;',
    'varying vec3 vV;',
    'uniform vec3 rim_cool;',
    'uniform vec3 rim_warm;',
    'uniform float power;',
    'uniform float gain;',
    'uniform float base;',
    'uniform float warm_at;',
    'uniform float pulse_amt;',
    'uniform float pulse_hz;',
    'uniform float wire_blend;',
    'uniform float uTime;',
    'void main() {',
    '  float f = 1.0 - abs(dot(normalize(vN), normalize(vV)));',
    '  f = pow(clamp(f, 0.0, 1.0), power);',
    '  vec3 col = mix(rim_cool, rim_warm, smoothstep(warm_at, 0.97, f));',
    '  float breath = 1.0 + pulse_amt * sin(uTime * 6.2831853 * pulse_hz);',
    '  float k = sin(clamp(wire_blend, 0.0, 1.0) * 1.5707963);',
    '  gl_FragColor = vec4(col * (base + f * gain) * breath * k, 1.0);',
    '}'
  ].join('\n');

  /* --- the Environment's post chain --------------------------------------- */

  // Bright pass, Godot's own: everything over the threshold, plus a floor of
  // `glow_bloom` so the whole image contributes a little.
  var BRIGHT_FS = [
    'precision highp float;',
    'varying vec2 vUv;',
    'uniform sampler2D uTex;',
    'uniform float uThreshold, uScale, uBloom, uCap;',
    'void main() {',
    '  vec4 c = texture2D(uTex, vUv);',
    '  float lum = max(c.r, max(c.g, c.b));',
    '  float fb = max(smoothstep(uThreshold, uThreshold + uScale, lum), uBloom);',
    '  gl_FragColor = vec4(min(c.rgb * fb, vec3(uCap)), c.a);',
    '}'
  ].join('\n');

  var BLUR_FS = [
    'precision highp float;',
    'varying vec2 vUv;',
    'uniform sampler2D uTex;',
    'uniform vec2 uStep;',
    'void main() {',
    '  vec4 s = texture2D(uTex, vUv) * 0.2270270;',
    '  s += (texture2D(uTex, vUv + uStep * 1.3846153) +',
    '        texture2D(uTex, vUv - uStep * 1.3846153)) * 0.3162162;',
    '  s += (texture2D(uTex, vUv + uStep * 3.2307692) +',
    '        texture2D(uTex, vUv - uStep * 3.2307692)) * 0.0702702;',
    '  gl_FragColor = s;',
    '}'
  ].join('\n');

  // Glow in (additive, glow_blend_mode 0), filmic tonemap, out to sRGB. Godot's
  // filmic is the Uncharted 2 curve at exposure_bias 2, normalised on white.
  var POST_FS = [
    'precision highp float;',
    'varying vec2 vUv;',
    'uniform sampler2D uScene;',
    'uniform sampler2D uGlowA;',
    'uniform sampler2D uGlowB;',
    'uniform float uGlow;',
    'uniform float uDim;',
    '',
    'vec3 filmic(vec3 c) {',
    '  const float A = 0.22 * 4.0, B = 0.30 * 2.0, C = 0.10;',
    '  const float D = 0.20, E = 0.01, F = 0.30;',
    '  vec3 t = ((c * (A * c + C * B) + D * E) / (c * (A * c + B) + D * F)) - E / F;',
    '  float w = 1.0;',
    '  float tw = ((w * (A * w + C * B) + D * E) / (w * (A * w + B) + D * F)) - E / F;',
    '  return t / tw;',
    '}',
    '',
    'vec3 toSrgb(vec3 c) {',
    '  c = clamp(c, 0.0, 1.0);',
    '  return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055,',
    '             step(vec3(0.0031308), c));',
    '}',
    '',
    'void main() {',
    '  vec4 s = texture2D(uScene, vUv);',
    '  vec3 g = (texture2D(uGlowA, vUv).rgb + texture2D(uGlowB, vUv).rgb) * 0.5 * uGlow;',
    '  vec3 c = filmic(s.rgb + g);',
    // The SubViewport has transparent_bg, so what leaves it is straight alpha —
    // opaque where the hull is, and lifted by whatever the glow spills past the
    // silhouette, because a halo the compositor throws away is not a halo.
    '  float a = clamp(s.a + max(g.r, max(g.g, g.b)) * 2.0, 0.0, 1.0) * uDim;',
    '  gl_FragColor = vec4(toSrgb(c) * a, a);',
    '}'
  ].join('\n');

  /* --------------------------------------------------------------- targets --- */

  var texFmt = { internal: gl.RGBA, type: gl.UNSIGNED_BYTE };
  if (GL2) {
    if (gl.getExtension('EXT_color_buffer_float') ||
        gl.getExtension('EXT_color_buffer_half_float')) {
      texFmt = { internal: gl.RGBA16F, type: gl.HALF_FLOAT };
    }
  } else {
    var ohf = gl.getExtension('OES_texture_half_float');
    if (ohf && gl.getExtension('EXT_color_buffer_half_float')) {
      texFmt = { internal: gl.RGBA, type: ohf.HALF_FLOAT_OES };
    }
  }
  var HDR = texFmt.type !== gl.UNSIGNED_BYTE;

  // See FAR_16BIT: 24-bit depth is what lets the edge lift survive at the
  // scene's own far plane, and WebGL2 has it unconditionally.
  var DEPTH_FMT = GL2 ? gl.DEPTH_COMPONENT24 : gl.DEPTH_COMPONENT16;
  var FAR = GL2 ? CAM_FAR : FAR_16BIT;

  function target(w, h, depth) {
    var t = { w: w, h: h };
    t.tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, t.tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, texFmt.internal, w, h, 0,
                  gl.RGBA, texFmt.type, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    t.fbo = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, t.fbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0,
                            gl.TEXTURE_2D, t.tex, 0);
    if (depth) {
      t.depth = gl.createRenderbuffer();
      gl.bindRenderbuffer(gl.RENDERBUFFER, t.depth);
      gl.renderbufferStorage(gl.RENDERBUFFER, DEPTH_FMT, w, h);
      gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT,
                                 gl.RENDERBUFFER, t.depth);
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    return t;
  }

  function release(t) {
    if (!t) return;
    gl.deleteTexture(t.tex);
    gl.deleteFramebuffer(t.fbo);
    if (t.depth) gl.deleteRenderbuffer(t.depth);
  }

  /* ------------------------------------------------------------- programs --- */

  var pField, pGrad, pHull, pWire, pBright, pBlur, pPost;
  try {
    pField  = program(QUAD_VS, FIELD_FS);
    pGrad   = program(QUAD_VS, GRAD_FS);
    pBright = program(QUAD_VS, BRIGHT_FS);
    pBlur   = program(QUAD_VS, BLUR_FS);
    pPost   = program(QUAD_VS, POST_FS);
    pHull   = program(OBJ_VS, HULL_FS);
    pWire   = program(OBJ_VS, WIRE_FS);
  } catch (e) {
    if (window.console) console.warn('stage: ' + e.message);
    cv.style.display = 'none';
    return;
  }

  /* ------------------------------------------------------------------ mesh ---
     Loaded rather than baked: assets/models/drith_01.json is the actual
     Drith_01.blend mesh — the same asset players build in the world — exported
     as position + normal per vertex and a triangle index list. */

  var mesh = null;
  var redraw = function () {};        // set to pose() below, for the still path

  function buildMesh(data) {
    var v = data.v, t = data.t;
    var n = v.length / 6, i, k;

    // _frame(): every mesh's box, longest axis normalised to model_span, and the
    // whole thing recentred on the pivot. One node here, but taken the same way.
    var lo = [1e30, 1e30, 1e30], hi = [-1e30, -1e30, -1e30];
    for (i = 0; i < n; i++) {
      for (k = 0; k < 3; k++) {
        var c = v[i * 6 + k];
        if (c < lo[k]) lo[k] = c;
        if (c > hi[k]) hi[k] = c;
      }
    }
    var longest = Math.max(hi[0] - lo[0], hi[1] - lo[1], hi[2] - lo[2]);
    if (!(longest > 0)) return null;
    var scale = MODEL_SPAN / longest;
    var centre = [(hi[0] + lo[0]) / 2, (hi[1] + lo[1]) / 2, (hi[2] + lo[2]) / 2];

    var pos = new Float32Array(n * 3);
    var nrm = new Float32Array(n * 3);
    for (i = 0; i < n; i++) {
      pos[i * 3]     = v[i * 6];
      pos[i * 3 + 1] = v[i * 6 + 1];
      pos[i * 3 + 2] = v[i * 6 + 2];
      nrm[i * 3]     = v[i * 6 + 3];
      nrm[i * 3 + 1] = v[i * 6 + 4];
      nrm[i * 3 + 2] = v[i * 6 + 5];
    }

    /* THE WIREFRAME IS REAL LINE PRIMITIVES, built here the way
       _line_mesh_from builds them: every triangle contributes three edges, each
       edge kept once. Godot does this because `render_mode wireframe` parses but
       does not rasterise as lines under Forward+, so a wireframe shader on
       triangles arrives as a solid silhouette. The same is true of a browser —
       there is no wireframe fill mode — so the reason survives the port intact.

       The vertices are lifted a hair along their normals, ~4 mm on screen:
       enough that the edges never z-fight the hull they sit on, far too little
       to read as a floating shell. */
    var seen = {}, lines = [];
    for (i = 0; i + 2 < t.length; i += 3) {
      var tri = [t[i], t[i + 1], t[i + 2]];
      for (k = 0; k < 3; k++) {
        var a = tri[k], b = tri[(k + 1) % 3];
        var key = Math.min(a, b) * 1000003 + Math.max(a, b);
        if (seen[key]) continue;
        seen[key] = 1;
        lines.push(Math.min(a, b), Math.max(a, b));
      }
    }

    var lift = EDGE_LIFT / scale;
    var wirePos = new Float32Array(n * 3);
    for (i = 0; i < n; i++) {
      var m = Math.hypot(nrm[i * 3], nrm[i * 3 + 1], nrm[i * 3 + 2]) || 1;
      for (k = 0; k < 3; k++) wirePos[i * 3 + k] = pos[i * 3 + k] + nrm[i * 3 + k] / m * lift;
    }

    var big = n > 65535;
    if (big && !GL2 && !gl.getExtension('OES_element_index_uint')) return null;
    var IdxT = (n > 65535) ? Uint32Array : Uint16Array;

    function buf(kind, data, arr) {
      var b = gl.createBuffer();
      gl.bindBuffer(kind, b);
      gl.bufferData(kind, arr ? new arr(data) : data, gl.STATIC_DRAW);
      return b;
    }

    return {
      scale: scale,
      centre: centre,
      pos: buf(gl.ARRAY_BUFFER, pos),
      nrm: buf(gl.ARRAY_BUFFER, nrm),
      wirePos: buf(gl.ARRAY_BUFFER, wirePos),
      tris: buf(gl.ELEMENT_ARRAY_BUFFER, t, IdxT),
      triCount: t.length,
      lines: buf(gl.ELEMENT_ARRAY_BUFFER, lines, IdxT),
      lineCount: lines.length,
      idxType: (n > 65535) ? gl.UNSIGNED_INT : gl.UNSIGNED_SHORT
    };
  }

  if (wantsObject) {
    var base = document.body.getAttribute('data-base') || '';
    fetch(base + '/assets/models/drith_01.json', { cache: 'force-cache' })
      .then(function (r) { return r.json(); })
      .then(function (d) { mesh = buildMesh(d); redraw(); })
      ['catch'](function () { /* no model, the board runs without it */ });
  }

  /* ------------------------------------------------------------------ maths --- */

  function clamp01(v) { return v < 0 ? 0 : (v > 1 ? 1 : v); }

  function mul(a, b) {                   // column-major 4x4, a * b
    var o = new Float32Array(16), i, j, k;
    for (i = 0; i < 4; i++) {
      for (j = 0; j < 4; j++) {
        var s = 0;
        for (k = 0; k < 4; k++) s += a[k * 4 + j] * b[i * 4 + k];
        o[i * 4 + j] = s;
      }
    }
    return o;
  }

  function perspective(fovYDeg, aspect, near, far) {
    var f = 1 / Math.tan(fovYDeg * Math.PI / 360);
    var o = new Float32Array(16);
    o[0] = f / aspect; o[5] = f;
    o[10] = (far + near) / (near - far); o[11] = -1;
    o[14] = 2 * far * near / (near - far);
    return o;
  }

  /* The camera's own transform, inverted. Its basis is orthonormal, so the
     inverse is the transpose and a re-projected origin — no general inverse
     needed, and none of the drift one would bring.

     CAM_BASIS is row-major (see above), so the view rotation R = Bᵀ has
     R[r][c] = B[c*3+r], and GL wants it column-major: m[c*4+r] = R[r][c]. */
  function viewMatrix(shiftX) {
    var B = CAM_BASIS, o = [CAM_ORIGIN[0] + shiftX, CAM_ORIGIN[1], CAM_ORIGIN[2]];
    var m = new Float32Array(16);
    m[0] = B[0]; m[1] = B[3]; m[2]  = B[6];
    m[4] = B[1]; m[5] = B[4]; m[6]  = B[7];
    m[8] = B[2]; m[9] = B[5]; m[10] = B[8];
    m[12] = -(B[0] * o[0] + B[3] * o[1] + B[6] * o[2]);
    m[13] = -(B[1] * o[0] + B[4] * o[1] + B[7] * o[2]);
    m[14] = -(B[2] * o[0] + B[5] * o[1] + B[8] * o[2]);
    m[15] = 1;
    return m;
  }

  /* The pivot, then the model inside it.

     rotate_y() pre-multiplies in the PARENT's space, so the turn wraps the tilt
     rather than running under it: Ry(t) * Rx(-tilt), never the other way round.
     The instance is a plain scale and a recentring offset, which is what
     Vector3.ONE * s and -box.get_center() * s come to. */
  function modelMatrix(spin, tilt, scale, centre) {
    var cy = Math.cos(spin), sy = Math.sin(spin);
    var cx = Math.cos(-tilt), sx = Math.sin(-tilt);

    // Ry(spin) * Rx(-tilt), column-major.
    var r = [
      cy,      0,   -sy,     0,
      sy * sx, cx,  cy * sx, 0,
      sy * cx, -sx, cy * cx, 0,
      PIVOT[0], PIVOT[1], PIVOT[2], 1
    ];

    var off = [-centre[0] * scale, -centre[1] * scale, -centre[2] * scale];
    var inst = new Float32Array([
      scale, 0, 0, 0,
      0, scale, 0, 0,
      0, 0, scale, 0,
      off[0], off[1], off[2], 1
    ]);
    return mul(new Float32Array(r), inst);
  }

  /* 0 = solid hull, 1 = bare wireframe. _cycle_materials: hold, sine-in-out
     across, hold, sine-in-out back, forever. */
  function blendAt(t) {
    var x = t % CYCLE;
    if (x < HOLD) return 0;
    if (x < HOLD + FADE) return 0.5 * (1 - Math.cos(Math.PI * ((x - HOLD) / FADE)));
    if (x < HOLD * 2 + FADE) return 1;
    return 0.5 * (1 + Math.cos(Math.PI * ((x - HOLD * 2 - FADE) / FADE)));
  }

  /* --------------------------------------------------------------- resizing --- */

  var W = 0, H = 0, dpr = 1;
  var scene = null, mips = null;
  var SS = 1;                             // supersample, standing in for msaa_3d

  /* THE GLOW IS A MIP CHAIN, because Godot's is. The Environment's default
     glow_levels turn on levels 3 and 5 and nothing else — a blur gathered at a
     1/8 mip and one at a 1/32 mip, averaged. That pair is the whole character of
     it: the halo runs a long way out from a bright edge and stays soft, and a
     couple of tight blurs at quarter resolution do not read the same at all.
     Five levels, each blurred separably on the way down. */
  var MIPS = 5;

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    var w = Math.max(1, Math.round(cv.clientWidth * dpr));
    var h = Math.max(1, Math.round(cv.clientHeight * dpr));
    if (w === W && h === H) return;
    W = w; H = h;
    cv.width = W; cv.height = H;

    SS = dpr >= 2 ? 1 : 1.5;
    var sw = Math.max(1, Math.round(W * SS)), sh = Math.max(1, Math.round(H * SS));

    release(scene);
    if (mips) mips.forEach(function (m) { release(m.a); release(m.b); });
    scene = null; mips = null;
    if (!wantsObject) return;

    scene = target(sw, sh, true);
    mips = [];
    for (var i = 0; i < MIPS; i++) {
      var mw = Math.max(1, W >> (i + 1)), mh = Math.max(1, H >> (i + 1));
      mips.push({ w: mw, h: mh, a: target(mw, mh, false), b: target(mw, mh, false) });
    }
  }

  /* ------------------------------------------------------------------ draw --- */

  var COOL = [0.72, 0.92, 1.00];
  var WARM = [1.00, 0.88, 0.55];
  var HULL_BODY = toLinear([0.012, 0.024, 0.028]);
  var HULL_COOL = toLinear([0.72, 0.92, 1.00]);
  var HULL_WARM = toLinear([1.00, 0.84, 0.43]);

  function gradient(g) {
    gl.useProgram(pGrad);
    gl.uniform4fv(pGrad.u.uRect, g.rect);
    gl.uniform4fv(pGrad.u.uStops, g.stops);
    gl.uniform4fv(pGrad.u.uC0, g.cols[0]);
    gl.uniform4fv(pGrad.u.uC1, g.cols[1]);
    gl.uniform4fv(pGrad.u.uC2, g.cols[2]);
    gl.uniform4fv(pGrad.u.uC3, g.cols[3]);
    drawQuad(pGrad);
  }

  function bindObject(p, posBuf) {
    gl.bindBuffer(gl.ARRAY_BUFFER, posBuf);
    gl.enableVertexAttribArray(p.a.aPos);
    gl.vertexAttribPointer(p.a.aPos, 3, gl.FLOAT, false, 0, 0);
    gl.bindBuffer(gl.ARRAY_BUFFER, mesh.nrm);
    gl.enableVertexAttribArray(p.a.aNrm);
    gl.vertexAttribPointer(p.a.aNrm, 3, gl.FLOAT, false, 0, 0);
  }

  function stepAt(x, y) {
    return function (p) { gl.uniform2f(p.u.uStep, x, y); };
  }

  function blit(prog, src, dst, setup) {
    gl.bindFramebuffer(gl.FRAMEBUFFER, dst ? dst.fbo : null);
    gl.viewport(0, 0, dst ? dst.w : W, dst ? dst.h : H);
    gl.useProgram(prog);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, src.tex);
    gl.uniform1i(prog.u.uTex, 0);
    if (setup) setup(prog);
    drawQuad(prog);
  }

  function drawObject(time, aspect) {
    var wire = blendAt(time);
    var spin = (time / MODEL_PERIOD) * Math.PI * 2;

    // See NARROW. Zero on any window the game would recognise.
    var shift = PIVOT[0] * clamp01((NARROW - aspect) / (NARROW - 0.5));

    var proj = perspective(CAM_FOV, aspect, CAM_NEAR, FAR);
    var mv = mul(viewMatrix(shift),
                 modelMatrix(spin, MODEL_TILT * Math.PI / 180, mesh.scale, mesh.centre));

    // Uniform scale and rotation only, so the 3x3 is already its own normal
    // matrix once the scale is divided back out.
    var s = mesh.scale;
    var nm = new Float32Array([
      mv[0] / s, mv[1] / s, mv[2] / s,
      mv[4] / s, mv[5] / s, mv[6] / s,
      mv[8] / s, mv[9] / s, mv[10] / s
    ]);

    gl.bindFramebuffer(gl.FRAMEBUFFER, scene.fbo);
    gl.viewport(0, 0, scene.w, scene.h);
    gl.clearColor(0, 0, 0, 0);
    gl.clearDepth(1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    /* --- the hull. cull_back, depth_draw_opaque, no blending. ------------- */
    gl.enable(gl.DEPTH_TEST);
    gl.depthFunc(gl.LESS);
    gl.depthMask(true);
    gl.enable(gl.CULL_FACE);
    gl.cullFace(gl.BACK);
    gl.disable(gl.BLEND);

    gl.useProgram(pHull);
    bindObject(pHull, mesh.pos);
    gl.uniformMatrix4fv(pHull.u.uMV, false, mv);
    gl.uniformMatrix4fv(pHull.u.uProj, false, proj);
    gl.uniformMatrix3fv(pHull.u.uNrmMat, false, nm);
    gl.uniform3fv(pHull.u.body, HULL_BODY);
    gl.uniform3fv(pHull.u.rim_cool, HULL_COOL);
    gl.uniform3fv(pHull.u.rim_warm, HULL_WARM);
    gl.uniform1f(pHull.u.rim_power, 6.5);
    gl.uniform1f(pHull.u.rim_gain, 1.7);
    gl.uniform1f(pHull.u.warm_at, 0.55);
    gl.uniform1f(pHull.u.pulse_amt, 0.12);
    gl.uniform1f(pHull.u.pulse_hz, 0.22);
    gl.uniform1f(pHull.u.wire_blend, wire);
    gl.uniform1f(pHull.u.uTime, time);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, mesh.tris);
    gl.drawElements(gl.TRIANGLES, mesh.triCount, mesh.idxType, 0);

    /* --- the wireframe. cull_disabled, depth_draw_never, blend_add. ------- */
    if (wire > 0.002) {
      gl.depthMask(false);
      gl.disable(gl.CULL_FACE);
      gl.enable(gl.BLEND);
      gl.blendEquation(gl.FUNC_ADD);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE);

      gl.useProgram(pWire);
      bindObject(pWire, mesh.wirePos);
      gl.uniformMatrix4fv(pWire.u.uMV, false, mv);
      gl.uniformMatrix4fv(pWire.u.uProj, false, proj);
      gl.uniformMatrix3fv(pWire.u.uNrmMat, false, nm);
      gl.uniform3fv(pWire.u.rim_cool, HULL_COOL);
      gl.uniform3fv(pWire.u.rim_warm, HULL_WARM);
      gl.uniform1f(pWire.u.power, 1.6);
      gl.uniform1f(pWire.u.gain, 1.8);
      gl.uniform1f(pWire.u.base, 0.88);
      gl.uniform1f(pWire.u.warm_at, 0.62);
      gl.uniform1f(pWire.u.pulse_amt, 0.16);
      gl.uniform1f(pWire.u.pulse_hz, 0.24);
      gl.uniform1f(pWire.u.wire_blend, wire);
      gl.uniform1f(pWire.u.uTime, time);
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, mesh.lines);
      gl.drawElements(gl.LINES, mesh.lineCount, mesh.idxType, 0);
    }

    gl.disable(gl.DEPTH_TEST);
    gl.disable(gl.CULL_FACE);
    gl.disable(gl.BLEND);

    /* --- glow: bright pass into the top mip, then blurred all the way down.
       Levels 3 and 5 (index 2 and 4) are the ones the Environment asks for. -- */
    blit(pBright, scene, mips[0].a, function (p) {
      gl.uniform1f(p.u.uThreshold, HDR ? GLOW_THRESHOLD : 0.55);
      gl.uniform1f(p.u.uScale, GLOW_SCALE);
      gl.uniform1f(p.u.uBloom, GLOW_BLOOM);
      gl.uniform1f(p.u.uCap, GLOW_CAP);
    });
    for (var i = 0; i < MIPS; i++) {
      var m = mips[i];
      if (i > 0) blit(pBlur, mips[i - 1].a, m.a, stepAt(0, 0));  // linear downsample
      blit(pBlur, m.a, m.b, stepAt(1 / m.w, 0));
      blit(pBlur, m.b, m.a, stepAt(0, 1 / m.h));
    }

    /* --- glow in, tonemap, out to sRGB, composited over the field. -------- */
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, W, H);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    gl.useProgram(pPost);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, scene.tex);
    gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, mips[2].a.tex);
    gl.activeTexture(gl.TEXTURE2); gl.bindTexture(gl.TEXTURE_2D, mips[4].a.tex);
    gl.uniform1i(pPost.u.uScene, 0);
    gl.uniform1i(pPost.u.uGlowA, 1);
    gl.uniform1i(pPost.u.uGlowB, 2);
    gl.uniform1f(pPost.u.uGlow, GLOW_INTENSITY);
    // The fade is for the portrait case only, where the ledger ends up sitting
    // on the object rather than beside it.
    gl.uniform1f(pPost.u.uDim, 1.0 - 0.45 * clamp01((1.0 - aspect) / 0.4));
    drawQuad(pPost);
    gl.disable(gl.BLEND);
  }

  function frame(time) {
    resize();
    var aspect = W / H;

    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, W, H);
    gl.disable(gl.DEPTH_TEST);

    /* Void. */
    gl.clearColor(VOID[0], VOID[1], VOID[2], 1);
    gl.clear(gl.COLOR_BUFFER_BIT);

    /* Field — blend_add, so everything it writes is a light contribution over
       the void and never a surface colour. */
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE);
    gl.useProgram(pField);
    gl.uniform2f(pField.u.uRes, W, H);
    gl.uniform1f(pField.u.uTime, time);
    gl.uniform3fv(pField.u.cool, COOL);
    gl.uniform3fv(pField.u.warm, WARM);
    gl.uniform1f(pField.u.pitch, 52.0);
    gl.uniform1f(pField.u.sweep_period, 19.0);
    gl.uniform1f(pField.u.grid_base, 0.028);
    gl.uniform1f(pField.u.dot_base, 0.095);
    gl.uniform1f(pField.u.sweep_gain, 0.62);
    gl.uniform1f(pField.u.opacity, 1.0);
    gl.uniform1f(pField.u.grain_amount, 0.075);
    gl.uniform1f(pField.u.grain_bite, 0.62);
    gl.uniform1f(pField.u.grain_px, 46.0);
    gl.uniform1f(pField.u.grain_drift, 12.0);
    gl.uniform1f(pField.u.grain_churn, 0.45);
    gl.uniform1f(pField.u.grain_beat, 0.70);
    drawQuad(pField);

    /* Bloom, under the stage. */
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    gradient(BLOOM);
    gl.disable(gl.BLEND);

    /* The object. */
    if (mesh) drawObject(time, aspect);

    /* Vignette, over the stage and under the type. */
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    gradient(VIGNETTE);
    gl.disable(gl.BLEND);
  }

  /* ------------------------------------------------------------------ loop --- */

  var t0 = null;
  var queued = false;

  function loop(now) {
    requestAnimationFrame(loop);
    if (document.hidden) return;
    if (t0 === null) t0 = now;
    frame((now - t0) / 1000);
  }

  /* A pose, not the resting state: far enough into the cycle that the hull is
     solid and the rim is lit, so the still frame is the object as designed.
     Drawn on load, again when the window changes size, and again the moment the
     mesh lands — and never otherwise. */
  function pose() {
    if (queued) return;
    queued = true;
    requestAnimationFrame(function () { queued = false; frame(2.4); });
  }
  redraw = pose;

  if (still) {
    pose();
    window.addEventListener('resize', pose);
  } else {
    requestAnimationFrame(loop);
  }
})();
