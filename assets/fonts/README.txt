THE GAME'S OWN FACES, subset to the characters this site sets.

  ptsans-narrow-bold.woff2   PTSansNarrow-Bold.ttf — WORDMARK_FONT in
                             drith-godot/world/menu.gd, and the game's one
                             display face through display_face::at().
                             SIL Open Font License 1.1 — PTSansNarrow-OFL.txt.

  freesans.woff2             FreeSans.otf / FreeSansBold.otf — the board's UI
  freesansbold.woff2         face (src/hud/core/board_style.h) and the project's
                             default theme font. Part of GNU FreeFont, GPLv3 or
                             later with the font exception:
                             http://www.gnu.org/copyleft/gpl.html
                             Unmodified glyph outlines; only unused codepoints
                             were dropped (pyftsubset, U+0020-007E plus a few
                             punctuation marks).

  inter-black.woff2          Inter (InterVariable.ttf) pinned at wght 900,
                             opsz 32 — the small caps labels: kickers, buttons,
                             section names. SIL Open Font License 1.1 —
                             Inter-OFL.txt. Made with
                             fonttools varLib.instancer InterVariable.ttf wght=900 opsz=32
                             then the pyftsubset line below, plus U+2190,U+2192.

Regenerate with, from the game repo's fonts/ directory:

  pyftsubset PTSansNarrow-Bold.ttf --unicodes='U+0020-007E,U+00A0,U+2013,U+2014,U+2018,U+2019,U+201C,U+201D,U+2026' \
      --layout-features='kern,liga,ccmp' --output-file=/tmp/f.ttf && woff2_compress /tmp/f.ttf
