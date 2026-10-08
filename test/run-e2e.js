// Wardrobe AI e2e — realistic user flows through the logic layer.
"use strict";
const W = require("../js/logic.js");

let flows = 0;
function flow(name, fn) {
  fn();
  flows++;
  console.log("E2E PASS: " + name);
}
function mk(cat, name, extra) {
  return Object.assign({
    name: name, category: cat, color: "Navy",
    seasons: ["spring", "summer", "fall", "winter"],
    occasions: ["casual", "work"]
  }, extra || {});
}

// 1: building a full closet from scratch
flow("build a full closet", () => {
  let items = [];
  const pieces = [
    ["tops", "White linen shirt", { seasons: ["summer"] }],
    ["tops", "Grey merino sweater", { seasons: ["fall", "winter"] }],
    ["bottoms", "Dark jeans"],
    ["bottoms", "Khaki chinos"],
    ["dresses", "Black wrap dress", { occasions: ["evening", "formal"] }],
    ["outerwear", "Wool overcoat", { seasons: ["fall", "winter"] }],
    ["shoes", "White sneakers"],
    ["shoes", "Brown leather boots", { seasons: ["fall", "winter"] }],
    ["accessories", "Silk scarf", { seasons: ["fall", "winter"] }]
  ];
  pieces.forEach(([c, n, ex]) => { items = W.addItem(items, mk(c, n, ex)); });
  if (W.activeItems(items).length !== 9) throw new Error("expected 9 active items");
  const ids = items.map(i => i.id);
  if (new Set(ids).size !== 9) throw new Error("ids not unique");
});

// 2: validation guards bad input
flow("validation rejects bad input", () => {
  const bad = [
    mk("hats", "Beanie"),                       // bad category
    mk("tops", ""),                             // empty name
    mk("tops", "   "),                          // blank name
    mk("tops", "Tee", { seasons: [] }),         // no seasons
    mk("tops", "Tee", { occasions: [] }),        // no occasions
    mk("tops", "Tee", { photo: "x".repeat(W.PHOTO_MAX_CHARS + 1) }) // oversized photo
  ];
  bad.forEach((d, i) => {
    let threw = false;
    try { W.addItem([], d); } catch (e) { threw = true; }
    if (!threw) throw new Error("bad input accepted at index " + i);
  });
  let items = W.addItem([], mk("tops", "Tee"));
  let threw = false;
  try { W.updateItem(items, items[0].id, { category: "hats" }); } catch (e) { threw = true; }
  if (!threw) throw new Error("bad update accepted");
});

// 3: closet → donate → keep → sell lifecycle
flow("donate/sell pile lifecycle", () => {
  let items = W.addItem([], mk("tops", "Old tee"));
  const id = items[0].id;
  items = W.setStatus(items, id, "donate");
  if (W.activeItems(items).length !== 0) throw new Error("donated item still active");
  if (W.pileItems(items, "donate").length !== 1) throw new Error("donate pile empty");
  items = W.setStatus(items, id, "active"); // changed mind
  if (W.activeItems(items).length !== 1) throw new Error("keep-back failed");
  items = W.setStatus(items, id, "sell");
  if (W.pileItems(items, "sell").length !== 1) throw new Error("sell pile empty");
  items = W.removeItem(items, id);
  if (items.length !== 0) throw new Error("remove failed");
  let threw = false;
  try { W.setStatus(items, id, "limbo"); } catch (e) { threw = true; }
  if (!threw) throw new Error("bad status accepted");
});

// 4: cold formal suggestion includes outerwear and honors seasons
flow("cold formal suggestion", () => {
  let items = [];
  items = W.addItem(items, mk("tops", "White dress shirt", { seasons: ["fall", "winter"], occasions: ["formal", "work"] }));
  items = W.addItem(items, mk("bottoms", "Wool trousers", { seasons: ["fall", "winter"], occasions: ["formal", "work"] }));
  items = W.addItem(items, mk("outerwear", "Wool overcoat", { seasons: ["fall", "winter"], occasions: ["formal"] }));
  items = W.addItem(items, mk("shoes", "Oxford shoes", { occasions: ["formal", "work"] }));
  items = W.addItem(items, mk("tops", "Linen shirt", { seasons: ["summer"], occasions: ["casual"] })); // must be excluded
  const sug = W.suggestOutfit(items, { weather: "cold", occasion: "formal" });
  if (!sug.pieces.top || !sug.pieces.bottom) throw new Error("missing core pieces");
  if (!sug.pieces.outerwear) throw new Error("no outerwear suggested in cold weather");
  if (sug.pieces.top.name === "Linen shirt") throw new Error("summer item suggested in cold");
  if (!sug.complete) throw new Error("should be complete: " + sug.notes.join("; "));
});

// 5: dresses short-circuit separates; incomplete outfit reports missing pieces
flow("dress logic and incomplete notes", () => {
  let items = [];
  items = W.addItem(items, mk("dresses", "Wrap dress", { occasions: ["evening"] }));
  items = W.addItem(items, mk("shoes", "Heels", { occasions: ["evening"] }));
  const sug = W.suggestOutfit(items, { weather: "warm", occasion: "evening" });
  if (!sug.pieces.dress) throw new Error("dress not chosen");
  if (sug.pieces.top || sug.pieces.bottom) throw new Error("separates chosen alongside dress");
  const bare = W.suggestOutfit([], { weather: "warm", occasion: "casual" });
  if (bare !== null) throw new Error("empty closet should return null");
  const thin = W.addItem([], mk("shoes", "Sneakers"));
  const thinSug = W.suggestOutfit(thin, { weather: "warm", occasion: "casual" });
  if (thinSug.complete) throw new Error("shoes-only should not be complete");
  if (!thinSug.notes.length) throw new Error("no missing-piece notes");
});

// 6: save, resolve, and delete outfits
flow("saved outfits lifecycle", () => {
  let items = [];
  items = W.addItem(items, mk("tops", "Shirt"));
  items = W.addItem(items, mk("bottoms", "Jeans"));
  const ids = items.map(i => i.id);
  let outfits = W.saveOutfit([], { name: "Weekend", itemIds: ids });
  if (outfits.length !== 1) throw new Error("outfit not saved");
  const resolved = W.outfitItems(outfits[0], items);
  if (resolved.length !== 2) throw new Error("outfit items not resolved");
  outfits = W.saveOutfit(outfits, { name: "Weekend", itemIds: ids }); // same name ok
  let threw = false;
  try { W.saveOutfit([], { name: "", itemIds: ids }); } catch (e) { threw = true; }
  if (!threw) throw new Error("nameless outfit accepted");
  threw = false;
  try { W.saveOutfit([], { name: "Empty", itemIds: [] }); } catch (e) { threw = true; }
  if (!threw) throw new Error("empty outfit accepted");
  outfits = W.deleteOutfit(outfits, outfits[0].id);
  if (outfits.length !== 1) throw new Error("delete removed wrong outfit");
});

// 7: suggestOutfit validates weather/occasion input
flow("suggestion input validation", () => {
  let items = W.addItem([], mk("tops", "Tee"));
  ["freezing", ""].forEach(w => {
    let threw = false;
    try { W.suggestOutfit(items, { weather: w, occasion: "casual" }); } catch (e) { threw = true; }
    if (!threw) throw new Error("bad weather accepted: " + w);
  });
  let threw = false;
  try { W.suggestOutfit(items, { weather: "warm", occasion: "party" }); } catch (e) { threw = true; }
  if (!threw) throw new Error("bad occasion accepted");
});

// 8: wear log — log wears, counts, last-worn, dedupe, bad dates rejected
flow("wear log lifecycle", () => {
  let items = W.addItem([], mk("tops", "Tee"));
  const id = items[0].id;
  let log = {};
  if (W.wearCount(log, id) !== 0) throw new Error("fresh count should be 0");
  if (W.lastWorn(log, id) !== null) throw new Error("fresh lastWorn should be null");
  log = W.logWear(log, id, "2026-09-01");
  log = W.logWear(log, id, "2026-09-10");
  log = W.logWear(log, id, "2026-09-01"); // duplicate date ignored
  if (W.wearCount(log, id) !== 2) throw new Error("count should be 2, got " + W.wearCount(log, id));
  if (W.lastWorn(log, id) !== "2026-09-10") throw new Error("lastWorn wrong: " + W.lastWorn(log, id));
  const before = JSON.stringify(log);
  const log2 = W.logWear({}, "other", "2026-09-05");
  if (JSON.stringify(log) !== before) throw new Error("logWear mutated the input");
  if (W.wearCount(log2, "other") !== 1) throw new Error("second log broken");
  let threw = false;
  try { W.logWear({}, id, "not-a-date"); } catch (e) { threw = true; }
  if (!threw) throw new Error("bad date accepted");
});

// 9: neglected pieces — never-worn and stale items surface, fresh ones don't
flow("neglected pieces detection", () => {
  let items = W.addItem([], mk("tops", "Old tee"));
  const stale = items[0].id;
  items = W.addItem(items, mk("tops", "New tee"));
  const fresh = items[1].id;
  let log = W.logWear({}, stale, "2026-01-01");
  log = W.logWear(log, fresh, "2026-10-06");
  const neg = W.neglectedItems(items, log, 30, "2026-10-07");
  const ids = neg.map(i => i.id);
  if (ids.indexOf(stale) === -1) throw new Error("stale item not flagged");
  if (ids.indexOf(fresh) !== -1) throw new Error("fresh item wrongly flagged");
  // never-worn counts as neglected
  let items2 = W.addItem([], mk("shoes", "Unworn boots"));
  const neg2 = W.neglectedItems(items2, {}, 30, "2026-10-07");
  if (neg2.length !== 1) throw new Error("never-worn item not flagged");
  // donated items are excluded
  let items3 = W.setStatus(items, stale, "donate");
  const neg3 = W.neglectedItems(items3, log, 30, "2026-10-07");
  if (neg3.some(i => i.id === stale)) throw new Error("donated item flagged");
});

// 10: search + sort over the closet
flow("closet search and sort", () => {
  let items = [];
  items = W.addItem(items, mk("shoes", "White sneakers", { color: "White" }));
  items = W.addItem(items, mk("tops", "Navy blazer", { color: "Navy" }));
  items = W.addItem(items, mk("tops", "Red scarf", { color: "Red" }));
  const byColor = W.searchItems(items, "navy");
  if (byColor.length !== 1 || byColor[0].name !== "Navy blazer") throw new Error("color search failed");
  const byCat = W.searchItems(items, "shoes");
  if (byCat.length !== 1 || byCat[0].name !== "White sneakers") throw new Error("category search failed");
  if (W.searchItems(items, "zzz").length !== 0) throw new Error("no-match search failed");
  if (W.searchItems(items, "").length !== 3) throw new Error("empty search failed");
  const byName = W.sortItems(items, "name").map(i => i.name);
  if (byName.join("|") !== "Navy blazer|Red scarf|White sneakers") throw new Error("name sort wrong: " + byName.join("|"));
  const byCat2 = W.sortItems(items, "category").map(i => i.name);
  if (byCat2[0] !== "White sneakers") throw new Error("category sort wrong: " + byCat2.join("|"));
  const newest = W.sortItems(items, "newest");
  if (newest.length !== 3) throw new Error("newest sort dropped items");
  if (items[0].name !== "White sneakers") throw new Error("sort mutated the input");
});

// 11: CSV export covers items with wear stats and escapes commas
flow("closet CSV export", () => {
  let items = W.addItem([], mk("tops", 'Shirt, "blue"', { color: "Blue" }));
  const id = items[0].id;
  const log = W.logWear({}, id, "2026-10-01");
  const csv = W.itemsToCSV(items, log);
  const lines = csv.split("\n");
  if (lines[0] !== "name,category,color,seasons,occasions,status,wears,last_worn") throw new Error("bad header");
  if (lines.length !== 2) throw new Error("line count wrong");
  if (lines[1].indexOf('"Shirt, ""blue"""') !== 0) throw new Error("name not escaped: " + lines[1]);
  if (lines[1].indexOf(",1,2026-10-01") === -1) throw new Error("wear stats missing: " + lines[1]);
});

console.log("WARDROBE E2E: " + flows + "/11 flows passed");
