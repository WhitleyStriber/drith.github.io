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

  var copy = document.getElementById('copy');
  var addr = document.getElementById('addr');

  play.addEventListener('click', function () {
    var open = !panel.hidden;
    panel.hidden = open;
    play.setAttribute('aria-expanded', String(!open));
    if (!open) check();                 // opening — take a fresh reading
  });

  if (copy && addr && navigator.clipboard) {
    copy.addEventListener('click', function () {
      navigator.clipboard.writeText(addr.textContent.trim()).then(function () {
        copy.textContent = 'Copied';
        setTimeout(function () { copy.textContent = 'Copy'; }, 1600);
      });
    });
  }

  /* ------------------------------------------------------ server status --- */
  /* The game is a Godot/ENet server on a UDP port and a browser can't poke a
     UDP port, so the box runs a small HTTP responder next to it
     (tools/status/status_server.py) that does the probe and answers JSON.
     site.status_url is the panel's data-status; empty means no responder is
     configured, so leave the panel exactly as Jekyll rendered it. */

  var statusUrl = panel.getAttribute('data-status') || '';
  var state = document.getElementById('state');
  if (!statusUrl || !state) return;

  var FRESH = 15000;      // don't re-probe more often than this
  var TIMEOUT = 4000;     // a box that won't answer in 4s is down as far as we care
  var checkedAt = 0;
  var pending = false;
  var settled = false;

  /* Not paint() — the mute button already owns that name in this scope. */
  function light(kind, text) {
    state.className = 'state ' + kind;
    state.textContent = text;           // the dot is a ::before
  }

  function show(el, on) { if (el) el.hidden = !on; }

  /* Online with an address shows the code and the copy button; anything else
     is just the status line. An address from the responder wins over the one
     baked in at build time, so changing ports doesn't need a site rebuild. */
  function settle(online, address) {
    settled = true;
    if (!online) {
      light('off', 'Server offline');
      show(addr, false);
      show(copy, false);
      return;
    }
    if (address && addr) addr.textContent = address;
    var code = addr && addr.textContent.trim() !== '';
    light('on', 'Online');
    show(addr, code);
    show(copy, code && !!navigator.clipboard);
  }

  function check() {
    if (pending || Date.now() - checkedAt < FRESH) return;
    if (!window.fetch) {                // too old to ask; show what we were given
      light('checking', 'Status unknown');
      show(addr, addr && addr.textContent.trim() !== '');
      show(copy, !!navigator.clipboard);
      return;
    }

    pending = true;
    if (!settled) light('checking', 'Checking');   // refreshes keep the old state

    var ctl = window.AbortController ? new AbortController() : null;
    var timer = setTimeout(function () { if (ctl) ctl.abort(); }, TIMEOUT);

    fetch(statusUrl, {
      cache: 'no-store',
      signal: ctl ? ctl.signal : undefined
    }).then(function (r) {
      if (!r.ok) throw new Error(r.status);
      return r.json();
    }).then(function (d) {
      settle(!!d.online, d.address);
    })['catch'](function () {
      settle(false, null);              // can't reach the box — it's down
    }).then(function () {
      clearTimeout(timer);
      pending = false;
      checkedAt = Date.now();
    });
  }

  /* Re-probe while someone sits with the panel open, so a server coming up
     mid-visit turns the light green without a reload. */
  setInterval(function () { if (!panel.hidden) check(); }, 30000);
})();
