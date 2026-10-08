#!/bin/bash
# Wardrobe AI smoke tests — static checks. All must pass.
set -e
cd "$(dirname "$0")/.."
PASS=0; FAIL=0
ok()   { PASS=$((PASS+1)); echo "SMOKE PASS: $1"; }
bad()  { FAIL=$((FAIL+1)); echo "SMOKE FAIL: $1"; }

# 1: required files exist
for f in index.html css/style.css js/logic.js js/app.js README.md test/e2e.sh test/run-e2e.js; do
  [ -f "$f" ] && ok "file exists: $f" || bad "missing file: $f"
done

# 2: index.html wires all assets
for ref in 'css/style.css' 'js/logic.js' 'js/app.js'; do
  grep -q "$ref" index.html && ok "index references $ref" || bad "index missing $ref"
done

# 3: JS syntax valid
for j in js/logic.js js/app.js test/run-e2e.js; do
  node --check "$j" && ok "syntax ok: $j" || bad "syntax error: $j"
done

# 4: every DOM id used by app.js exists in index.html
for id in countLine filterCat fCategory fSeasons fOccasions fName fColor fPhoto photoNote formNote \
          addItemBtn closetGrid outfitName saveOutfitBtn clearDraftBtn draftGrid builderGrid \
          savedOutfits wWeather wOccasion suggestBtn suggestion pile-donate pile-sell \
          closetSearch sortBy exportCloset neglectBox; do
  grep -q "id=\"$id\"" index.html && ok "dom id present: $id" || bad "dom id missing: $id"
done

# 5: logic module loads and exposes the API
node -e "const W=require('./js/logic.js'); ['addItem','suggestOutfit','saveOutfit','setStatus','searchItems','sortItems','logWear','wearCount','lastWorn','neglectedItems','itemsToCSV','loadWear','persistWear','todayISO'].forEach(k=>{if(typeof W[k]!=='function')throw new Error('missing '+k)});" \
  && ok "logic API exports present" || bad "logic API incomplete"

# 5b: app.js wires search/sort/export/wear UI
missing=""
for n in closetSearch sortBy exportCloset neglectBox searchItems sortItems logWear neglectedItems itemsToCSV exportClosetCSV; do
  grep -q "$n" js/app.js || grep -q "$n" index.html || missing="$missing $n"
done
[ -z "$missing" ] && ok "app wires search/sort/export/wear UI" || bad "missing wiring:$missing"

# 6: premium styling — no gradients anywhere
! grep -qi "gradient" css/style.css && ok "no gradients in CSS" || bad "gradient found in CSS"

# 7: premium styling — system font stack in use
grep -q "BlinkMacSystemFont" css/style.css && ok "system font stack present" || bad "system font stack missing"

# 8: responsive breakpoint present
grep -q "@media" css/style.css && ok "responsive @media present" || bad "no @media rules"

# 9: no emoji in brand/header markup
! grep -q 'class="brand">[^<]*[📓👕🎽🧥👗👠👜✨]' index.html && ok "no emoji in brand header" || bad "emoji in brand header"

# 10: localStorage persistence wired
grep -q "localStorage" js/logic.js && ok "localStorage persistence wired" || bad "no localStorage usage"

# 11: photo size cap enforced in logic
grep -q "PHOTO_MAX_CHARS" js/logic.js && ok "photo size cap present" || bad "photo cap missing"

# 12: all six categories labelled
node -e "const W=require('./js/logic.js'); const c=['tops','bottoms','dresses','outerwear','shoes','accessories']; c.forEach(k=>{if(!W.CATEGORY_LABELS[k])throw new Error(k)});" \
  && ok "all 6 categories labelled" || bad "category labels incomplete"

echo "WARDROBE SMOKE: $PASS passed, $FAIL failed"
[ "$FAIL" -eq 0 ]
