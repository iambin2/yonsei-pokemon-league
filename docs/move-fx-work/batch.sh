#!/usr/bin/env bash
# 한 타입을 돌린다: 에이전트가 읽은 시각(<work>/seg/<type>.tsv)을 segments.tsv에 넣고, 재고, 각본에 숫자를 적고, 다시 잰다.
# bash batch.sh <type> <work> [rounds=2]   (개발 서버 ypl-dev-offline 5182가 떠 있어야 한다)
set -euo pipefail
cd "$(dirname "$0")"
T="$1"; W="$2"; N="${3:-2}"
if [ -f "$W/seg/$T.tsv" ] && ! grep -qP "\t$T\t" segments.tsv; then tail -n +2 "$W/seg/$T.tsv" | tr -d '\r' | awk -F'\t' 'NF>=3' >> segments.tsv; fi
node match.mjs "$T" "$W" --ms 6500 | grep ERROR || true
for i in $(seq 1 "$N"); do node fit.mjs "$T"; node match.mjs "$T" "$W" --reshoot all --ms 6500 | grep ERROR || true; done
node show.mjs "$T" | grep -v "^  "
