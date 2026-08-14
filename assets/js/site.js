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
     sweeping the cursor across a row of buttons doesn't machine-gun it.
     `.row` covers both the board's ledger entries and the devlog list, which
     are the same row — see the note in board.css. */
  var last = 0;
  var TARGETS = '.btn, .row, .copy, .mute, .mast a';

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

  /* ------------------------------------------------------------- ledger --- */
  /* THE RULE TURNS. menu.gd's _spin, which is the half of the highlight that
     survives being looked at from across the room — the board is as often
     driven on a pad from the couch as with a cursor sitting on the row.

     Lit, it is one relative, linear, looping revolution, so it keeps
     accumulating turns for as long as the entry is highlighted. SPIN_PERIOD is
     fast enough that running the cursor down the ledger — three tenths of a
     second on a row — still shows a quarter turn.

     Let go, it COASTS. Three things make that read as a spinning object being
     released rather than a fault:
       - it carries on FORWARDS. Easing back to the nearest mark would run the
         rule backwards for up to half a turn.
       - it stops on the next HALF turn. The rule is a straight line, so it is
         its own mirror at pi — landing there is visually identical to landing
         square, at half the distance to travel.
       - sine ease-out over pi/2 times the time that arc was going to take
         anyway. A sine out opens at pi/2 of its average speed, so stretching
         the duration by exactly that much means it leaves at the speed it was
         already turning. Any shorter and the release is a speed-up. */

  var SPIN_PERIOD = 0.5;
  var TAU = Math.PI * 2;
  var spins = typeof WeakMap === 'function' ? new WeakMap() : null;

  function spinState(tick) {
    if (!spins) return null;
    var s = spins.get(tick);
    if (!s) { s = { rot: 0, raf: 0 }; spins.set(tick, s); }
    return s;
  }

  function spin(tick, on) {
    var s = spinState(tick);
    if (!s) return;
    if (s.raf) { cancelAnimationFrame(s.raf); s.raf = 0; }

    if (on) {
      var last = null;
      (function turn(now) {
        if (last === null) last = now;
        s.rot += (now - last) / 1000 * TAU / SPIN_PERIOD;
        last = now;
        tick.style.transform = 'rotate(' + s.rot + 'rad)';
        s.raf = requestAnimationFrame(turn);
      })(performance.now());
      return;
    }

    var into = ((s.rot % Math.PI) + Math.PI) % Math.PI;
    if (into < 0.001) {                    // never turned, or let go on the mark
      s.rot = 0;
      tick.style.transform = '';
      return;
    }
    var rest = Math.PI - into;
    var secs = rest / TAU * SPIN_PERIOD * Math.PI * 0.5;
    var from = s.rot, t0 = null;
    (function settle(now) {
      if (t0 === null) t0 = now;
      var k = Math.min(1, (now - t0) / 1000 / secs);
      s.rot = from + rest * Math.sin(k * Math.PI / 2);
      tick.style.transform = 'rotate(' + s.rot + 'rad)';
      if (k < 1) { s.raf = requestAnimationFrame(settle); return; }
      s.raf = 0;
      s.rot = 0;                           // park, so it never spends its
      tick.style.transform = '';           // precision on the turn count
    })(performance.now());
  }

  var rows = [].slice.call(document.querySelectorAll('.ledger .row, .log .row'));
  var turning = !window.matchMedia('(prefers-reduced-motion: reduce)').matches &&
                window.matchMedia('(hover: hover)').matches;

  rows.forEach(function (row) {
    var tick = row.querySelector('.tick');
    if (!tick || !turning) return;
    row.addEventListener('pointerenter', function () { spin(tick, true); });
    row.addEventListener('focus', function () { spin(tick, true); });
    row.addEventListener('pointerleave', function () { spin(tick, false); });
    row.addEventListener('blur', function () { spin(tick, false); });
  });

  /* The wheel and the arrows walk the ledger, and what moves is FOCUS — the
     rows already light on focus, so this rides the same path the keyboard and
     the pad take and there stays exactly one idea of "which entry". It wraps,
     because at three entries stopping dead at the end reads as the input having
     broken rather than as a boundary. */
  var ledger = document.querySelector('.ledger');
  if (ledger) {
    var entries = [].slice.call(ledger.querySelectorAll('.row'));
    var step = function (dir) {
      var cur = entries.indexOf(document.activeElement);
      var next = cur < 0 ? (dir > 0 ? 0 : entries.length - 1)
                         : (cur + dir + entries.length) % entries.length;
      entries[next].focus();
    };
    if (entries.length) {
      window.addEventListener('wheel', function (e) {
        step(e.deltaY > 0 ? 1 : -1);
      }, { passive: true });
      document.addEventListener('keydown', function (e) {
        if (e.key === 'ArrowDown') { e.preventDefault(); step(1); }
        else if (e.key === 'ArrowUp') { e.preventDefault(); step(-1); }
      });
    }
  }

  /* -------------------------------------------------------- play panel --- */

  var play = document.getElementById('play');
  var panel = document.getElementById('server');
  if (!play || !panel) return;

  var copy = document.getElementById('copy');
  var addr = document.getElementById('addr');

  /* Reassigned below IF a status responder is configured. It has to exist as a
     no-op first: with site.status_url empty this file returns before the probe
     is set up, and a hoisted `function check()` would still be callable from the
     click handler — reaching for a #state element that Jekyll never rendered and
     throwing on every press of PLAY. */
  var check = function () {};

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

  check = function () {
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
  };

  /* Re-probe while someone sits with the panel open, so a server coming up
     mid-visit turns the light green without a reload. */
  setInterval(function () { if (!panel.hidden) check(); }, 30000);
})();
