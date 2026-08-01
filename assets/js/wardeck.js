/* WARDECK — small bits of life for the terminal.
   No dependencies, no build step. Everything degrades to plain HTML. */

(function () {
  'use strict';

  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* Footer year stamp ---------------------------------------------------- */
  var year = document.getElementById('year');
  if (year) year.textContent = new Date().getFullYear();

  /* Top-bar status line -------------------------------------------------- */
  /* Mirrors the real panel's flash line: a rotating CLARIS readout, typed in
     one character at a time. Static first line if motion is reduced.        */
  var el = document.getElementById('statusline');
  if (!el) return;

  var lines;
  try {
    lines = JSON.parse(el.getAttribute('data-lines') || '[]');
  } catch (e) {
    lines = [];
  }
  if (!lines.length) return;

  function paint(text) {
    el.innerHTML = '<span class="tick">■</span> ' + text;
  }

  if (reduced) {
    paint(lines[0]);
    return;
  }

  var i = 0;

  function type(text, done) {
    var n = 0;
    (function step() {
      paint(text.slice(0, n));
      if (n++ <= text.length) {
        setTimeout(step, 18);
      } else {
        setTimeout(done, 4200);
      }
    })();
  }

  function cycle() {
    type(lines[i], function () {
      i = (i + 1) % lines.length;
      cycle();
    });
  }

  cycle();
})();
