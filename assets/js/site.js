/* PLAY reveals the server address; the copy button puts it on the clipboard. */

(function () {
  'use strict';

  /* Reshuffle the thanks list on every load, so "no particular order" is
     actually true. Source order is already shuffled, so this degrades fine
     with JS off. */
  var thanks = document.querySelector('ul.thanks');
  if (thanks) {
    var items = Array.prototype.slice.call(thanks.children);
    for (var i = items.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var tmp = items[i]; items[i] = items[j]; items[j] = tmp;
    }
    items.forEach(function (li) { thanks.appendChild(li); });
  }

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
