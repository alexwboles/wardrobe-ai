// Wardrobe AI — pure logic layer (browser + node compatible).
// All state lives in localStorage; no network calls.
(function () {
"use strict";

const CATEGORIES = ["tops", "bottoms", "dresses", "outerwear", "shoes", "accessories"];
const CATEGORY_LABELS = {
  tops: "Tops", bottoms: "Bottoms", dresses: "Dresses",
  outerwear: "Outerwear", shoes: "Shoes", accessories: "Accessories"
};
const SEASONS = ["spring", "summer", "fall", "winter"];
const OCCASIONS = ["casual", "work", "formal", "sport", "evening"];
const OCCASION_LABELS = { casual: "Casual", work: "Work", formal: "Formal", sport: "Sport", evening: "Evening out" };
const WEATHERS = ["hot", "warm", "cool", "cold"];
const WEATHER_LABELS = { hot: "Hot", warm: "Warm", cool: "Cool", cold: "Cold" };
const STATUSES = ["active", "donate", "sell"];
const PHOTO_MAX_CHARS = 280000; // ~200 KB data-URL cap keeps localStorage safe

const WEATHER_SEASONS = {
  hot: ["summer"],
  warm: ["spring", "summer"],
  cool: ["fall", "spring"],
  cold: ["winter", "fall"]
};

// ---- storage ----
const memFallback = {};
const storage = {
  get(k) {
    try { if (typeof localStorage !== "undefined") return localStorage.getItem(k); } catch (e) {}
    return Object.prototype.hasOwnProperty.call(memFallback, k) ? memFallback[k] : null;
  },
  set(k, v) {
    try { if (typeof localStorage !== "undefined") { localStorage.setItem(k, v); return; } } catch (e) {}
    memFallback[k] = v;
  }
};
const ITEMS_KEY = "wardrobe:v1:items";
const OUTFITS_KEY = "wardrobe:v1:outfits";

function loadItems() { return loadArr(ITEMS_KEY); }
function loadOutfits() { return loadArr(OUTFITS_KEY); }
function loadArr(key) {
  try {
    const raw = storage.get(key);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr : [];
  } catch (e) { return []; }
}
function persistItems(items) { storage.set(ITEMS_KEY, JSON.stringify(items)); }
function persistOutfits(outfits) { storage.set(OUTFITS_KEY, JSON.stringify(outfits)); }

// ---- items ----
function newId() {
  return "it" + Date.now().toString(36) + Math.floor(Math.random() * 1e6).toString(36);
}

function validateItem(data) {
  const name = (data.name || "").trim();
  if (!name) throw new Error("item needs a name");
  if (CATEGORIES.indexOf(data.category) === -1) throw new Error("bad category: " + data.category);
  const seasons = Array.isArray(data.seasons) ? data.seasons : [];
  if (!seasons.length) throw new Error("pick at least one season");
  seasons.forEach(function (s) { if (SEASONS.indexOf(s) === -1) throw new Error("bad season: " + s); });
  const occasions = Array.isArray(data.occasions) ? data.occasions : [];
  if (!occasions.length) throw new Error("pick at least one occasion");
  occasions.forEach(function (o) { if (OCCASIONS.indexOf(o) === -1) throw new Error("bad occasion: " + o); });
  if (data.photo && data.photo.length > PHOTO_MAX_CHARS) {
    throw new Error("photo too large (over ~200 KB after resizing)");
  }
  return { name: name, seasons: seasons, occasions: occasions };
}

// item: {id, name, category, color, seasons[], occasions[], photo, status, createdAt}
function addItem(items, data) {
  const v = validateItem(data);
  const item = {
    id: newId(),
    name: v.name,
    category: data.category,
    color: (data.color || "").trim(),
    seasons: v.seasons,
    occasions: v.occasions,
    photo: data.photo || "",
    status: "active",
    createdAt: new Date().toISOString()
  };
  return items.concat([item]);
}

function updateItem(items, id, patch) {
  return items.map(function (it) {
    if (it.id !== id) return it;
    const merged = {
      name: patch.name !== undefined ? patch.name : it.name,
      category: patch.category !== undefined ? patch.category : it.category,
      color: patch.color !== undefined ? patch.color : it.color,
      seasons: patch.seasons !== undefined ? patch.seasons : it.seasons,
      occasions: patch.occasions !== undefined ? patch.occasions : it.occasions,
      photo: patch.photo !== undefined ? patch.photo : it.photo
    };
    const v = validateItem(merged);
    return {
      id: it.id, name: v.name, category: merged.category, color: merged.color.trim(),
      seasons: v.seasons, occasions: v.occasions, photo: merged.photo,
      status: it.status, createdAt: it.createdAt
    };
  });
}

function removeItem(items, id) {
  return items.filter(function (it) { return it.id !== id; });
}

function setStatus(items, id, status) {
  if (STATUSES.indexOf(status) === -1) throw new Error("bad status: " + status);
  return items.map(function (it) {
    return it.id === id ? Object.assign({}, it, { status: status }) : it;
  });
}

function activeItems(items) {
  return items.filter(function (it) { return it.status === "active"; });
}

function pileItems(items, status) {
  return items.filter(function (it) { return it.status === status; });
}

function getItem(items, id) {
  return items.find(function (it) { return it.id === id; }) || null;
}

// ---- outfit suggestions ----
function hashStr(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

function matchesContext(item, weather, occasion) {
  const seasons = WEATHER_SEASONS[weather] || [];
  const seasonOK = item.seasons.some(function (s) { return seasons.indexOf(s) !== -1; });
  const occasionOK = item.occasions.indexOf(occasion) !== -1;
  return seasonOK && occasionOK;
}

function pickOne(cands, salt) {
  if (!cands.length) return null;
  const sorted = cands.slice().sort(function (a, b) { return a.id < b.id ? -1 : 1; });
  return sorted[hashStr(salt) % sorted.length];
}

// Returns {weather, occasion, pieces:{...}, notes[]} or null when the closet is empty.
function suggestOutfit(items, opts) {
  const weather = opts.weather, occasion = opts.occasion;
  if (WEATHERS.indexOf(weather) === -1) throw new Error("bad weather: " + weather);
  if (OCCASIONS.indexOf(occasion) === -1) throw new Error("bad occasion: " + occasion);
  const pool = activeItems(items);
  if (!pool.length) return null;

  const salt = weather + "|" + occasion;
  const byCat = function (cat) {
    return pool.filter(function (it) { return it.category === cat && matchesContext(it, weather, occasion); });
  };
  const notes = [];
  const pieces = {};

  // Dress vs separates: prefer a dress for formal/evening when one fits.
  const dresses = byCat("dresses");
  const useDress = dresses.length > 0 &&
    (occasion === "formal" || occasion === "evening" || hashStr(salt + "|dress") % 2 === 0);
  if (useDress) {
    pieces.dress = pickOne(dresses, salt + "|dress");
    notes.push("Dress-based outfit.");
  } else {
    const top = pickOne(byCat("tops"), salt + "|top");
    const bottom = pickOne(byCat("bottoms"), salt + "|bottom");
    if (top) pieces.top = top;
    if (bottom) pieces.bottom = bottom;
    if (!top || !bottom) notes.push("No matching top/bottom combo — add more " + WEATHER_SEASONS[weather].join("/") + " pieces.");
  }

  if (weather === "cool" || weather === "cold") {
    const coat = pickOne(byCat("outerwear"), salt + "|outer");
    if (coat) { pieces.outerwear = coat; }
    else notes.push("It's " + weather + " — consider adding outerwear to your closet.");
  }

  // Shoes: for sport prefer sport-tagged shoes.
  let shoes = byCat("shoes");
  if (occasion === "sport") {
    const sporty = shoes.filter(function (s) { return s.name.toLowerCase().match(/sneaker|trainer|running|athletic|sport/); });
    if (sporty.length) shoes = sporty;
  }
  const shoe = pickOne(shoes, salt + "|shoes");
  if (shoe) pieces.shoes = shoe;
  else notes.push("No shoes match — add some for " + occasion + " wear.");

  const acc = byCat("accessories");
  if (acc.length) {
    const sorted = acc.slice().sort(function (a, b) { return a.id < b.id ? -1 : 1; });
    const n = Math.min(2, sorted.length);
    const start = hashStr(salt + "|acc") % sorted.length;
    pieces.accessories = [];
    for (let i = 0; i < n; i++) pieces.accessories.push(sorted[(start + i) % sorted.length]);
  }

  const essential = pieces.dress || (pieces.top && pieces.bottom);
  return {
    weather: weather, occasion: occasion,
    pieces: pieces, notes: notes,
    complete: !!(essential && pieces.shoes)
  };
}

// ---- saved outfits ----
function saveOutfit(outfits, data) {
  const name = (data.name || "").trim();
  if (!name) throw new Error("outfit needs a name");
  const itemIds = (data.itemIds || []).filter(Boolean);
  if (!itemIds.length) throw new Error("outfit needs at least one item");
  return outfits.concat([{
    id: "of" + Date.now().toString(36) + Math.floor(Math.random() * 1e6).toString(36),
    name: name,
    itemIds: itemIds,
    createdAt: new Date().toISOString()
  }]);
}

function deleteOutfit(outfits, id) {
  return outfits.filter(function (o) { return o.id !== id; });
}

function outfitItems(outfit, items) {
  return outfit.itemIds
    .map(function (id) { return getItem(items, id); })
    .filter(Boolean);
}

const api = {
  CATEGORIES: CATEGORIES, CATEGORY_LABELS: CATEGORY_LABELS,
  SEASONS: SEASONS, OCCASIONS: OCCASIONS, OCCASION_LABELS: OCCASION_LABELS,
  WEATHERS: WEATHERS, WEATHER_LABELS: WEATHER_LABELS, STATUSES: STATUSES,
  PHOTO_MAX_CHARS: PHOTO_MAX_CHARS,
  loadItems: loadItems, persistItems: persistItems,
  loadOutfits: loadOutfits, persistOutfits: persistOutfits,
  addItem: addItem, updateItem: updateItem, removeItem: removeItem,
  setStatus: setStatus, getItem: getItem,
  activeItems: activeItems, pileItems: pileItems,
  suggestOutfit: suggestOutfit,
  saveOutfit: saveOutfit, deleteOutfit: deleteOutfit, outfitItems: outfitItems
};

if (typeof window !== "undefined") window.Wardrobe = api;
if (typeof module !== "undefined" && module.exports) module.exports = api;
})();
