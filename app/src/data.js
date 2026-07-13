// Loads connection.csv (the internal roster: who, where, mail route) and
// builds the model the app renders: participants with coordinates, the
// trajectory arcs, each participant's full journey to home base in
// western Ukraine, and the constellation edges linking people who share
// something in common.
// Approved public content (bios, quotes, publicAttrs, images) is overlaid
// from participants.json; the CSV's internal attribute columns are ignored.

import { GEO, cityKey, coordsOf, isUkraine } from "./geo.js";

// --- tiny CSV parser (handles quoted fields with commas) --------------------
function parseCSV(text) {
  const rows = [];
  let row = [], field = "", inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') inQuotes = false;
      else field += c;
    } else if (c === '"') inQuotes = true;
    else if (c === ",") { row.push(field); field = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field); field = "";
      if (row.some((f) => f.trim() !== "")) rows.push(row);
      row = [];
    } else field += c;
  }
  if (field !== "" || row.length) { row.push(field); if (row.some((f) => f.trim() !== "")) rows.push(row); }
  return rows;
}

// --- media ------------------------------------------------------------------
function mediaOf(material) {
  const m = (material || "").trim();
  if (!m) return null; // postcard-only contributor: no interview media
  if (/^https?:\/\//i.test(m)) {
    const slug = (m.replace(/\/+$/, "").split("/").pop() || "").replace(/-/g, " ");
    const title = slug.charAt(0).toUpperCase() + slug.slice(1);
    return { type: "article", url: m, title };
  }
  if (/\.mp3$/i.test(m)) return { type: "audio", src: `public/media/${m}` };
  return { type: "video", src: `public/media/${m}` };
}

const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

// Fallback line for roster rows whose approved bio hasn't been folded into
// participants.json yet. All real content comes from the JSON overlay.
function bioOf(p) {
  return `A far-flung friend writing from ${p.city} — one small light on a long thread of them.`;
}

// --- constellation edges: link people who share something --------------------
// Each undirected pair gets one edge, weighted by how many things they share;
// `reasons` lists them for display. Edges are built ONLY from publicAttrs
// (facts stated in the participant's published interview, approved per batch)
// plus country, which is public by definition. The internal CSV attribute
// columns must never feed these.
// Hobbies are stored verbatim (traceable to the interview) but matched by
// broad group where one applies, so a knitter and a calligrapher still
// connect ("share art and craft").
const HOBBY_GROUPS = {
  "art and craft": [
    "paint", "draw", "sketch", "calligraph", "knit", "embroider", "sew",
    "crochet", "quilt", "printmak", "watercolour", "watercolor", "pottery",
    "ceramic", "origami", "papercraft", "card making", "card-making",
    "scrapbook", "collage", "tangl", "zentangle", "art", "craft",
    "colour", "coloring", "colouring",
  ],
  "music": [
    "music", "sing", "choir", "bandura", "piano", "guitar", "accordion",
    "violin", "band", "concert", "instrument",
  ],
  "outdoors": [
    "hik", "bik", "cycl", "camp", "walk", "garden", "fish", "kayak",
    "canoe", "sail", "ski", "swim", "birdwatch", "travel", "nature",
  ],
};
function hobbyTag(hobby) {
  const h = (hobby || "").toLowerCase();
  for (const [group, stems] of Object.entries(HOBBY_GROUPS)) {
    if (stems.some((s) => h.includes(s))) return group;
  }
  return h;
}

const SHARED = [
  { key: "country", label: (v) => `both write from ${v}`, get: (a) => (a.country ? [a.country] : []) },
  { key: "profession", label: (v) => `both ${v}s`, get: (a) => a.professions || [] },
  { key: "hobby", label: (v) => `share ${v}`, get: (a) => [...new Set((a.hobbies || []).map(hobbyTag))] },
  { key: "foundVia", label: (v) => `both found the project via ${v}`, get: (a) => (a.foundVia ? [a.foundVia] : []) },
  { key: "writingStyle", label: (v) => `both ${v}`, get: (a) => (a.writingStyle ? [a.writingStyle] : []) },
  { key: "pets", label: (v) => `both share life with a ${v}`, get: (a) => a.pets || [] },
  { key: "retired", label: () => "both retired", get: (a) => (a.retired === "yes" ? ["retired"] : []) },
];

function buildEdges(participants) {
  const edges = [];
  const publicOf = (p) => ({ ...(p.publicAttrs || {}), country: p.country });
  for (let i = 0; i < participants.length; i++) {
    for (let j = i + 1; j < participants.length; j++) {
      const A = participants[i], B = participants[j];
      const pa = publicOf(A), pb = publicOf(B);
      const reasons = [];
      for (const s of SHARED) {
        const sa = new Set(s.get(pa).map((x) => x.toLowerCase()));
        const shared = s.get(pb).filter((x) => sa.has(x.toLowerCase()));
        for (const v of shared) reasons.push({ kind: s.key, text: s.label(v) });
      }
      if (reasons.length) edges.push({ a: A.id, b: B.id, weight: reasons.length, reasons });
    }
  }
  return edges;
}

// --- constellation grouping ---------------------------------------------------
// A few clean, overlapping figures (a star can belong to several, like the
// real sky). Each is a merged, meaningful shared trait with 3+ members.
// Participants in no figure stay as scattered background stars in the view.
const GROUP_NAMES = {
  makers: ["The Makers", "they craft their own cards"],
  postcrossing: ["The Postcrossers", "found through Postcrossing"],
  outdoors: ["The Outdoors", "at home under open sky"],
  teacher: ["The Teachers", "teachers on both sides of the ocean"],
  bookish: ["The Bookish", "at home with books and letters"],
};

// Merged, deliberately small set of figure tags per participant.
function groupTags(p) {
  const tags = new Set();
  const a = p.publicAttrs || {};
  const style = (a.writingStyle || "").toLowerCase();
  const hobbies = (a.hobbies || []).map(hobbyTag);
  const rawHobbies = (a.hobbies || []).map((h) => h.toLowerCase());

  // The Makers absorbs both "make their own postcard art" and the art-and-craft hobby.
  if (style.includes("make their own") || hobbies.includes("art and craft")) tags.add("makers");
  if ((a.foundVia || "").toLowerCase().includes("postcrossing")) tags.add("postcrossing");
  if (hobbies.includes("outdoors")) tags.add("outdoors");
  for (const pr of a.professions || []) if (pr.toLowerCase() === "teacher") tags.add("teacher");
  // The Bookish merges reading and letter-writing.
  if (rawHobbies.some((h) => h.includes("read") || h.includes("letter"))) tags.add("bookish");

  return [...tags];
}

function buildConstellations(participants) {
  const byTag = new Map();
  for (const p of participants) {
    for (const tag of groupTags(p)) {
      if (!byTag.has(tag)) byTag.set(tag, []);
      byTag.get(tag).push(p);
    }
  }
  return [...byTag]
    .filter(([, members]) => members.length >= 3)
    .sort((a, b) => b[1].length - a[1].length)
    .map(([tag, members]) => {
      const [name, caption] = GROUP_NAMES[tag] || [tag, "something shared"];
      return { key: tag, name, caption, members: members.map((m) => m.id) };
    });
}

// --- journeys ---------------------------------------------------------------
// Full path each card travels to home base (western Ukraine), following
// hub → onward legs.
function buildJourneys(participants) {
  // hubOnward[hubCityKey] = where a participant located AT that hub sends to.
  const hubOnward = {};
  for (const p of participants) {
    if (p.sentToKey && GEO[p.cityKey]) hubOnward[p.cityKey] = p.sentToKey;
  }
  for (const p of participants) {
    const legs = [];
    let from = p.cityKey, to = p.sentToKey;
    const seen = new Set();
    while (to && GEO[to] && !seen.has(from + ">" + to)) {
      seen.add(from + ">" + to);
      legs.push({ from, to, toUkraine: GEO[to].country === "Ukraine" });
      const onward = hubOnward[to];
      if (onward && onward !== to) { from = to; to = onward; } else break;
    }
    p.journey = legs;
  }
}

// --- approved public content --------------------------------------------------
// participants.json carries the reviewed public profile content (bio,
// pull-quote, portrait, curated postcards, defender replies). The CSV stays
// the internal roster that drives geometry and connections; the JSON, keyed
// to the same people, overrides what visitors actually read. Matched by id
// or name, case/punctuation-insensitively.
const normId = (s) => (s || "").toLowerCase().replace(/[^a-z0-9]/g, "");
const CONTENT_FIELDS = [
  "bio", "pullQuote", "quoteContext", "portrait", "portraitPosition",
  "postcards", "photoPositions", "defenderReplies", "media", "publicAttrs",
];

async function applyApprovedContent(participants) {
  let doc;
  try {
    doc = await (await fetch("data/participants.json")).json();
  } catch {
    return; // no approved-content file: CSV placeholders stand alone
  }
  const byNorm = new Map();
  for (const p of participants) {
    byNorm.set(normId(p.id), p);
    byNorm.set(normId(p.name), p);
  }
  for (const entry of doc.participants || []) {
    const target = byNorm.get(normId(entry.id)) || byNorm.get(normId(entry.name));
    if (!target) continue;
    for (const f of CONTENT_FIELDS) {
      if (entry[f] != null) target[f] = entry[f];
    }
  }
}

// --- main -------------------------------------------------------------------
export async function loadData() {
  const text = await (await fetch("data/connection.csv")).text();
  const rows = parseCSV(text);
  rows.shift(); // header

  const usedIds = new Set();
  const participants = [];
  for (const r of rows) {
    const [name, material, city, country, sentTo] = r;
    const geo = coordsOf(city);
    if (!geo) { console.warn("no coords for", city); continue; }
    let id = slug(name);
    while (usedIds.has(id)) id += "_";
    usedIds.add(id);
    participants.push({
      id,
      name: name.trim(),
      city: city.trim(),
      country: country.trim(),
      lat: geo.lat,
      lng: geo.lng,
      sentTo: (sentTo || "").trim(),
      cityKey: cityKey(city),
      sentToKey: cityKey(sentTo || ""),
      media: mediaOf(material),
      postcards: [],
      receiving: geo.country === "Ukraine",
    });
  }

  // fallback bios; real bios and postcards arrive via the JSON overlay
  participants.forEach((p) => {
    p.bio = bioOf(p);
  });

  await applyApprovedContent(participants);

  buildJourneys(participants);
  const edges = buildEdges(participants);
  const constellations = buildConstellations(participants);

  // Postcard-only contributors: silver stars on the globe. Clicking one
  // opens their actual written cards. Optional file — absence is fine.
  let contributors = [];
  try {
    contributors = (await (await fetch("data/contributors.json")).json()).contributors || [];
  } catch { /* no contributors file */ }

  // default globe arcs — one per participant's first leg (city → Sent to)
  const arcs = [];
  for (const p of participants) {
    if (!p.sentToKey || !GEO[p.sentToKey]) continue;
    const dest = GEO[p.sentToKey];
    arcs.push({
      pid: p.id,
      startLat: p.lat, startLng: p.lng,
      endLat: dest.lat, endLng: dest.lng,
      fromKey: p.cityKey, toKey: p.sentToKey,
      toUkraine: isUkraine(p.sentTo),
    });
  }

  // hubs (dots, no labels): the distinct Sent-to places
  const hubKeys = [...new Set(participants.map((p) => p.sentToKey).filter((k) => k && GEO[k]))];
  const hubs = hubKeys.map((k) => ({ id: "__" + k, key: k, lat: GEO[k].lat, lng: GEO[k].lng, country: GEO[k].country }));

  return { participants, arcs, edges, constellations, contributors, hubs, destinationKey: "Western Ukraine" };
}
