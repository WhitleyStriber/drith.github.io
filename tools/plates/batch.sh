#!/bin/sh
# usage: batch.sh jobs.txt outdir "extra opts"   (jobs: name|blend|opts)
S="$(dirname "$0")"; M=/home/djt/Documents/gamemodels/models
JOBS="$1"; OUT="$2"; EXTRA="$3"; mkdir -p "$OUT"
grep -v '^#' "$JOBS" | grep . | while IFS='|' read -r name blend opts; do
  echo "$name|$blend|$opts"
done | xargs -P "${PAR:-4}" -d '\n' -I{} sh -c '
  IFS="|" read -r name blend opts <<EOT
{}
EOT
  blender -b "'"$M"'/$blend" --python "'"$S"'/render.py" -- "'"$OUT"'/$name.png" $opts '"$EXTRA"' > "'"$OUT"'/$name.log" 2>&1; grep -q WROTE "'"$OUT"'/$name.log" && echo "ok $name" || echo "FAIL $name"'
