/* Wardrobe AI — DOM glue. Depends on window.Wardrobe. */
(function () {
"use strict";

const W = window.Wardrobe;

let items = W.loadItems();
let outfits = W.loadOutfits();
let currentTab = "closet";
let draftIds = [];
let pendingPhoto = "";

function el(id) { return document.getElementById(id); }
function esc(s) {
  return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
    return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
  });
}

function refresh() {
  W.persistItems(items);
  W.persistOutfits(outfits);
  renderCounts();
  if (currentTab === "closet") renderCloset();
  else if (currentTab === "outfits") renderOutfits();
  else if (currentTab === "wear") renderWearIntro();
  else renderPiles();
}

function renderCounts() {
  const active = W.activeItems(items).length;
  el("countLine").textContent =
    active + " in closet · " + outfits.length + " saved outfits · " +
    W.pileItems(items, "donate").length + " to donate · " +
    W.pileItems(items, "sell").length + " to sell";
}

function setTab(name) {
  currentTab = name;
  document.querySelectorAll(".tab").forEach(function (t) {
    t.classList.toggle("active", t.dataset.tab === name);
  });
  document.querySelectorAll(".pane").forEach(function (p) {
    p.classList.toggle("active", p.id === "pane-" + name);
  });
  refresh();
}

function itemCard(it, opts) {
  opts = opts || {};
  const photo = it.photo
    ? '<img class="thumb" src="' + it.photo + '" alt="">'
    : '<div class="thumb none">' + esc((W.CATEGORY_LABELS[it.category] || "?")[0]) + "</div>";
  let actions = "";
  if (opts.inCloset) {
    actions =
      '<button class="mini" data-act="draft" data-id="' + it.id + '">+ Outfit</button>' +
      '<button class="mini" data-act="donate" data-id="' + it.id + '">Donate</button>' +
      '<button class="mini" data-act="sell" data-id="' + it.id + '">Sell</button>' +
      '<button class="mini danger" data-act="del" data-id="' + it.id + '">Delete</button>';
  } else if (opts.inPile) {
    actions =
      '<button class="mini" data-act="active" data-id="' + it.id + '">Keep</button>' +
      '<button class="mini danger" data-act="del" data-id="' + it.id + '">Remove</button>';
  } else if (opts.inDraft) {
    actions = '<button class="mini danger" data-act="undraft" data-id="' + it.id + '">Remove</button>';
  } else if (opts.builder) {
    actions = '<button class="mini" data-act="draft" data-id="' + it.id + '">+ Outfit</button>';
  }
  return '<div class="item">' + photo +
    '<div class="iname">' + esc(it.name) + "</div>" +
    '<div class="itags">' + esc(W.CATEGORY_LABELS[it.category]) +
    (it.color ? " · " + esc(it.color) : "") + "</div>" +
    '<div class="itags dim">' + it.seasons.join(", ") + "</div>" +
    '<div class="iactions">' + actions + "</div></div>";
}

function bindCardActions(root) {
  root.querySelectorAll("[data-act]").forEach(function (b) {
    b.onclick = function () {
      const id = b.dataset.id, act = b.dataset.act;
      if (act === "del") { if (confirm("Remove this item?")) items = W.removeItem(items, id); }
      else if (act === "draft") { if (draftIds.indexOf(id) === -1) draftIds.push(id); }
      else if (act === "undraft") { draftIds = draftIds.filter(function (x) { return x !== id; }); }
      else items = W.setStatus(items, id, act);
      refresh();
    };
  });
}

// ---------- Closet ----------
function renderCloset() {
  const cat = el("filterCat").value;
  const list = W.activeItems(items).filter(function (it) { return !cat || it.category === cat; });
  const box = el("closetGrid");
  box.innerHTML = list.length
    ? list.map(function (it) { return itemCard(it, { inCloset: true }); }).join("")
    : '<p class="muted">Your closet is empty. Add your first piece above.</p>';
  bindCardActions(box);
}

function buildAddForm() {
  const catSel = el("fCategory");
  catSel.innerHTML = W.CATEGORIES.map(function (c) {
    return '<option value="' + c + '">' + W.CATEGORY_LABELS[c] + "</option>";
  }).join("");
  const seasonBox = el("fSeasons");
  seasonBox.innerHTML = W.SEASONS.map(function (s) {
    return '<label class="chk"><input type="checkbox" value="' + s + '" checked> ' + s + "</label>";
  }).join("");
  const occBox = el("fOccasions");
  occBox.innerHTML = W.OCCASIONS.map(function (o) {
    return '<label class="chk"><input type="checkbox" value="' + o + '" checked> ' + W.OCCASION_LABELS[o] + "</label>";
  }).join("");
}

function checkedValues(containerId) {
  return Array.prototype.map.call(
    document.querySelectorAll("#" + containerId + " input:checked"),
    function (i) { return i.value; }
  );
}

function handlePhoto(file) {
  pendingPhoto = "";
  el("photoNote").textContent = "";
  if (!file) return;
  const img = new Image();
  const url = URL.createObjectURL(file);
  img.onload = function () {
    URL.revokeObjectURL(url);
    const maxDim = 400;
    const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
    const cv = document.createElement("canvas");
    cv.width = Math.round(img.width * scale);
    cv.height = Math.round(img.height * scale);
    cv.getContext("2d").drawImage(img, 0, 0, cv.width, cv.height);
    const dataUrl = cv.toDataURL("image/jpeg", 0.7);
    if (dataUrl.length > W.PHOTO_MAX_CHARS) {
      el("photoNote").textContent = "⚠ Photo still too large after resizing — skipped.";
      pendingPhoto = "";
    } else {
      pendingPhoto = dataUrl;
      el("photoNote").textContent = "✓ Photo attached (" + Math.round(dataUrl.length / 1024) + " KB).";
    }
  };
  img.src = url;
}

// ---------- Outfits ----------
function renderOutfits() {
  const pool = W.activeItems(items);
  const draftBox = el("draftGrid");
  const draftItems = draftIds
    .map(function (id) { return W.getItem(items, id); })
    .filter(Boolean);
  draftBox.innerHTML = draftItems.length
    ? draftItems.map(function (it) { return itemCard(it, { inDraft: true }); }).join("")
    : '<p class="muted">Nothing in the draft yet — add pieces from below.</p>';
  bindCardActions(draftBox);

  const box = el("builderGrid");
  box.innerHTML = pool.length
    ? pool.map(function (it) {
        const inDraft = draftIds.indexOf(it.id) !== -1;
        return inDraft ? "" : itemCard(it, { builder: true });
      }).join("") || '<p class="muted">Every closet piece is already in the draft.</p>'
    : '<p class="muted">Add clothes in the Closet tab first.</p>';
  bindCardActions(box);

  const obox = el("savedOutfits");
  obox.innerHTML = outfits.length ? outfits.map(function (o) {
    const parts = W.outfitItems(o, items).map(function (it) { return esc(it.name); }).join(", ");
    return '<div class="card outfit"><strong>' + esc(o.name) + "</strong>" +
      '<div class="muted">' + (parts || "items removed") + "</div>" +
      '<button class="mini danger" data-deloutfit="' + o.id + '">Delete</button></div>';
  }).join("") : '<p class="muted">No saved outfits yet.</p>';
  obox.querySelectorAll("[data-deloutfit]").forEach(function (b) {
    b.onclick = function () { outfits = W.deleteOutfit(outfits, b.dataset.deloutfit); refresh(); };
  });
}

// ---------- What to wear ----------
function renderWearIntro() {
  el("suggestion").innerHTML = '<p class="muted">Pick the weather and occasion, then hit Suggest.</p>';
}

function renderSuggestion() {
  const weather = el("wWeather").value, occasion = el("wOccasion").value;
  let sug;
  try {
    sug = W.suggestOutfit(items, { weather: weather, occasion: occasion });
  } catch (err) {
    el("suggestion").innerHTML = '<p class="muted">⚠ ' + esc(err.message) + "</p>";
    return;
  }
  if (!sug) {
    el("suggestion").innerHTML = '<p class="muted">Your closet is empty — add some clothes first.</p>';
    return;
  }
  const order = ["dress", "top", "bottom", "outerwear", "shoes"];
  let html = '<div class="card"><h3>' +
    esc(W.WEATHER_LABELS[weather]) + " · " + esc(W.OCCASION_LABELS[occasion]) +
    (sug.complete ? ' <span class="pill">Complete look ✓</span>' : ' <span class="pill warn">Incomplete</span>') +
    "</h3><div class='grid'>";
  order.forEach(function (k) {
    const it = sug.pieces[k];
    if (it) html += itemCard(it, {});
  });
  if (sug.pieces.accessories) {
    sug.pieces.accessories.forEach(function (it) { html += itemCard(it, {}); });
  }
  html += "</div>";
  if (sug.notes.length) {
    html += '<ul class="notes">' + sug.notes.map(function (n) { return "<li>" + esc(n) + "</li>"; }).join("") + "</ul>";
  }
  html += '<button class="primary" id="saveSug">Save as outfit</button></div>';
  el("suggestion").innerHTML = html;
  el("saveSug").onclick = function () {
    const ids = [];
    ["dress", "top", "bottom", "outerwear", "shoes"].forEach(function (k) {
      if (sug.pieces[k]) ids.push(sug.pieces[k].id);
    });
    (sug.pieces.accessories || []).forEach(function (it) { ids.push(it.id); });
    const name = W.OCCASION_LABELS[occasion] + " · " + W.WEATHER_LABELS[weather] + " · " + new Date().toLocaleDateString();
    try {
      outfits = W.saveOutfit(outfits, { name: name, itemIds: ids });
      refresh();
      alert("Saved to Outfits ✓");
    } catch (err) { alert("⚠ " + err.message); }
  };
}

// ---------- Piles ----------
function renderPiles() {
  ["donate", "sell"].forEach(function (st) {
    const list = W.pileItems(items, st);
    const box = el("pile-" + st);
    box.innerHTML = list.length
      ? list.map(function (it) { return itemCard(it, { inPile: true }); }).join("")
      : '<p class="muted">Nothing here.</p>';
    bindCardActions(box);
  });
}

function init() {
  buildAddForm();
  const f = el("filterCat");
  f.innerHTML = '<option value="">All categories</option>' + W.CATEGORIES.map(function (c) {
    return '<option value="' + c + '">' + W.CATEGORY_LABELS[c] + "</option>";
  }).join("");
  f.onchange = renderCloset;

  el("addItemBtn").onclick = function () {
    const data = {
      name: el("fName").value,
      category: el("fCategory").value,
      color: el("fColor").value,
      seasons: checkedValues("fSeasons"),
      occasions: checkedValues("fOccasions"),
      photo: pendingPhoto
    };
    try {
      items = W.addItem(items, data);
      el("fName").value = ""; el("fColor").value = "";
      el("fPhoto").value = ""; pendingPhoto = "";
      el("photoNote").textContent = "";
      el("formNote").textContent = "✓ Added.";
      refresh();
    } catch (err) {
      el("formNote").textContent = "⚠ " + err.message;
    }
  };
  el("fPhoto").onchange = function (ev) {
    handlePhoto(ev.target.files && ev.target.files[0]);
  };

  el("saveOutfitBtn").onclick = function () {
    const name = el("outfitName").value;
    try {
      outfits = W.saveOutfit(outfits, { name: name, itemIds: draftIds.slice() });
      draftIds = [];
      el("outfitName").value = "";
      refresh();
    } catch (err) { alert("⚠ " + err.message); }
  };
  el("clearDraftBtn").onclick = function () { draftIds = []; refresh(); };

  el("suggestBtn").onclick = renderSuggestion;

  document.querySelectorAll(".tab").forEach(function (t) {
    t.onclick = function () { setTab(t.dataset.tab); };
  });
  setTab("closet");
}

document.addEventListener("DOMContentLoaded", init);
})();
