/* PLAY reveals the server address, plus UI sound.
   Sounds are the real in-game ones (SFX_HoverSlot / SFX_UI_Click) and an
   ambient computer hum. Browsers block audio until the page has been
   interacted with, so the hum starts on the first click or keypress. */

(function () {
  'use strict';

  /* ------------------------------------------------------------- sound --- */

  var root = document.body.getAttribute('data-base') || '';
  var KEY = 'drith-muted';
  var muted = localStorage.getItem(KEY) === '1';

  function make(src, vol, loop) {
    var a = new Audio(root + src);
    a.volume = vol;
    a.loop = !!loop;
    a.preload = loop ? 'auto' : 'none';
    return a;
  }

  var hum = make('/assets/audio/hum.mp3', 0.18, true);
  var hover = make('/assets/audio/hover.mp3', 0.16);
  var click = make('/assets/audio/click.mp3', 0.32);

  function blip(a) {
    if (muted) return;
    try {
      a.currentTime = 0;
      var p = a.play();
      if (p) p.catch(function () {});   // autoplay refusal is fine, stay quiet
    } catch (e) {}
  }

  var started = false;
  function startHum() {
    if (started || muted) return;
    started = true;
    var p = hum.play();
    if (p) p.catch(function () { started = false; });
  }

  document.addEventListener('pointerdown', startHum, { once: false });
  document.addEventListener('keydown', startHum, { once: false });

  /* Mute toggle, bottom-right, remembers the choice. */
  var btn = document.createElement('button');
  btn.className = 'mute';
  btn.type = 'button';
  function paint() {
    btn.textContent = muted ? 'Sound off' : 'Sound on';
    btn.setAttribute('aria-pressed', String(muted));
  }
  paint();
  btn.addEventListener('click', function () {
    muted = !muted;
    localStorage.setItem(KEY, muted ? '1' : '0');
    paint();
    if (muted) { hum.pause(); }
    else { started = false; startHum(); blip(click); }
  });
  document.body.appendChild(btn);

  /* Hover and click on anything button-shaped. Hover is throttled so
     sweeping the cursor across a row of buttons doesn't machine-gun it. */
  var last = 0;
  var TARGETS = '.btn, .row, .copy, .mute, .head a';

  document.addEventListener('pointerover', function (e) {
    var t = e.target.closest && e.target.closest(TARGETS);
    if (!t) return;
    var now = Date.now();
    if (now - last < 90) return;
    last = now;
    blip(hover);
  });

  document.addEventListener('pointerdown', function (e) {
    if (e.target.closest && e.target.closest(TARGETS)) blip(click);
  });

  /* -------------------------------------------------------- play panel --- */

  var play = document.getElementById('play');
  var panel = document.getElementById('server');
  if (!play || !panel) return;

  play.addEventListener('click', function () {
    var open = !panel.hidden;
    panel.hidden = open;
    play.setAttribute('aria-expanded', String(!open));
  });

  var copy = document.getElementById('copy');
  var addr = document.getElementById('addr');
  if (!copy || !addr || !navigator.clipboard) return;

  copy.addEventListener('click', function () {
    navigator.clipboard.writeText(addr.textContent.trim()).then(function () {
      copy.textContent = 'Copied';
      setTimeout(function () { copy.textContent = 'Copy'; }, 1600);
    });
  });
})();
