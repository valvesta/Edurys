#!/usr/bin/env bash
# Paleidžia komandą; nepavykus — paskutines išvesties eilutes parodo kaip
# vieną klaidos pastabą (annotation), kad klaidą būtų matyti be žurnalų failo.
set -o pipefail
out=$(mktemp)
"$@" >"$out" 2>&1
code=$?
if [ $code -eq 0 ]; then cat "$out"; exit 0; fi
cat "$out"
msg=$(grep -v '^[[:space:]]*$' "$out" | tail -60 | sed -e 's/%/%25/g' -e 's/\r//g' | sed ':a;N;$!ba;s/\n/%0A/g')
echo "::error title=$1 nepavyko::$msg"
exit $code
