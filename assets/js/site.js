/* PLAY reveals the server address; the copy button puts it on the clipboard. */

(function () {
  'use strict';

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
