// Loads connection.csv (the single source of truth) and builds the model the
// app renders: participants (with parsed attributes + coordinates), the
// trajectory arcs, each participant's full journey to Lviv, and the
// constellation edges linking people who share something in common.

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

// --- attribute cell parser --------------------------------------------------
// Canonical order: Age; Profession; Retired; Ancestry; Postcrossing; Reference;
// Hobby — but the data is irregular (missing Retired, commas instead of
// semicolons, a merged "yes, Name"). Normalize first, then map by field count.
function parseAttrs(raw) {
  const out = {
    ageGroup: "", professions: [], retired: "", ancestry: [],
    postcrossing: "", references: [], hobbies: [],
  };
  if (!raw) return out;
  // "40, construction" → "40; construction" (age wrongly comma-joined)
  let s = raw.replace(/^\s*(\d+)\s*,\s*/, "$1; ");
  let f = s.split(";").map((x) => x.trim()).filter((x) => x !== "");
  const list = (v) =>
    (v || "").split(",").map((x) => x.trim()).filter((x) => x && !/^n\/?a$/i.test(x));
  const yn = (v) => (/^\s*y/i.test(v || "") ? "yes" : /^\s*n/i.test(v || "") ? "no" : "");

  let age = f[0] || "", prof, ret = "", anc, post, ref, hob;
  if (f.length >= 7) {
    [, prof, ret, anc, post, ref, hob] = f;
  } else if (f.length === 6 && (yn(f[2]) === "yes" || yn(f[2]) === "no")) {
    // retired present, postcrossing+reference merged into one ("yes, Helen")
    prof = f[1]; ret = f[2]; anc = f[3];
    const m = (f[4] || "").split(",");
    post = m[0]; ref = m.slice(1).join(","); hob = f[5];
  } else {
    // retired omitted: age; profession; ancestry; postcrossing; reference; hobby
    prof = f[1]; anc = f[2]; post = f[3]; ref = f[4]; hob = f[5];
  }
  out.ageGroup = (age.match(/\d+/) || [""])[0];
  out.professions = list(prof);
  out.retired = yn(ret);
  out.ancestry = list(anc);
  out.postcrossing = yn(post);
  out.references = list(ref);
  out.hobbies = list(hob);
  return out;
}

// --- media ------------------------------------------------------------------
function mediaOf(material) {
  const m = (material || "").trim();
  if (/^https?:\/\//i.test(m)) {
    const slug = (m.replace(/\/+$/, "").split("/").pop() || "").replace(/-/g, " ");
    const title = slug.charAt(0).toUpperCase() + slug.slice(1);
    return { type: "article", url: m, title };
  }
  if (/\.mp3$/i.test(m)) return { type: "audio", src: `public/media/${m}` };
  return { type: "video", src: `public/media/${m}` };
}

const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

// Sample postcard images (cycled) — placeholder "results" until real ones land.
const POSTCARDS = [
  "public/postcards/bethany-hummingbirds.jpg", "public/postcards/bethany-frog.jpg",
  "public/postcards/bethany-gazebo.jpg", "public/postcards/kamloops-card-1.jpg",
  "public/postcards/kamloops-card-2.jpg", "public/postcards/dear-soldier-poem.jpg",
  "public/postcards/teddy-bear-cards.jpg", "public/postcards/debbie-xmas-3.jpg",
  "public/postcards/debbie-xmas-4.jpg", "public/postcards/bowie-postcards.jpg",
  "public/postcards/laura-embroidered.jpg", "public/postcards/arrival-frontlines-1.jpg",
  "public/postcards/arrival-frontlines-2.jpg",
];

// Fictive, evocative descriptions. The CSV attributes (age, profession,
// ancestry, etc.) are for internal use and MUST NOT be exposed — these bios
// use only the public place and pure imagination. Keyed by participant id.
const FICTIVE_BIOS = {
  helen: "A quiet fixture of a small Ontario town, she is said to know the weight of every letter before it leaves her hands.",
  linda: "A Montreal wanderer who collects sunsets and gives them away, one card at a time.",
  cindy: "They say she writes with the patience of the tides that ring her island home.",
  kael: "Somewhere under the California haze, he keeps a drawer full of half-finished kindnesses, each one addressed east.",
  claudius: "A meticulous soul from a city of quiet workshops, he measures his words the way a craftsman measures wood.",
  karine: "By a slow green river in France, she writes the way others daydream — without quite meaning to stop.",
  jessica: "A keeper of small warmths in a city of endless summer, she mails light to places the winter forgot.",
  mirai: "From a town practiced in beginning again, she sends folded courage across the sea.",
  peter: "An early riser and incorrigible optimist, he swears the best conversations still happen on paper.",
  "aloy-and-edu": "Two voices from the green heart of the isthmus, writing as one and laughing between the lines.",
  megan: "In a city of arrivals and farewells, she writes words that refuse to be lost in transit.",
  daniel: "From the still centre of a continent, he aims his steady handwriting at its farthest, loudest edge.",
  juan: "From the oldest port in Europe, he sends letters that arrive smelling faintly of salt and stubborn hope.",
  helens: "At the very bottom of the map, she writes upward — toward the front, toward the light.",
  debbie: "In a hush of country lanes, she turns paper and ink into something like a hand held across the world.",
  oksana: "Close to the story itself, she gathers strangers' words and carries them the last, hardest mile.",
  tamara: "In Lviv, where the cards finally land, she makes certain not a single one goes unread.",
};

function bioOf(p) {
  return (
    FICTIVE_BIOS[p.id] ||
    `A far-flung friend writing from ${p.city} — one small light on a long thread of them.`
  );
}

// --- constellation edges: link people who share something --------------------
// Each undirected pair gets one edge, weighted by how many things they share;
// `reasons` lists them for display. "Reference" means referred by the same
// person/source.
const SHARED = [
  { key: "age", label: (v) => `both in their ${v}s`, get: (a) => (a.ageGroup ? [a.ageGroup] : []) },
  { key: "profession", label: (v) => `both ${v}s`, get: (a) => a.professions },
  { key: "hobby", label: (v) => `share ${v}`, get: (a) => a.hobbies },
  { key: "ancestry", label: (v) => `${v} heritage`, get: (a) => a.ancestry },
  { key: "reference", label: (v) => `both found the project via ${v}`, get: (a) => a.references },
  { key: "postcrossing", label: () => "both postcrossers", get: (a) => (a.postcrossing === "yes" ? ["postcrossing"] : []) },
];

function buildEdges(participants) {
  const edges = [];
  for (let i = 0; i < participants.length; i++) {
    for (let j = i + 1; j < participants.length; j++) {
      const A = participants[i], B = participants[j];
      const reasons = [];
      for (const s of SHARED) {
        const sa = new Set(s.get(A.attrs).map((x) => x.toLowerCase()));
        const shared = s.get(B.attrs).filter((x) => sa.has(x.toLowerCase()));
        for (const v of shared) reasons.push({ kind: s.key, text: s.label(v) });
      }
      if (reasons.length) edges.push({ a: A.id, b: B.id, weight: reasons.length, reasons });
    }
  }
  return edges;
}

// --- journeys ---------------------------------------------------------------
// Full path each card travels to Lviv, following hub → onward legs.
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

// --- main -------------------------------------------------------------------
export async function loadData() {
  const text = await (await fetch("data/connection.csv")).text();
  const rows = parseCSV(text);
  rows.shift(); // header

  const usedIds = new Set();
  const participants = [];
  for (const r of rows) {
    const [name, material, city, country, sentTo, attrsRaw] = r;
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
      attrs: parseAttrs(attrsRaw),
      postcards: [],
      receiving: cityKey(city) === "Lviv",
    });
  }

  // bios + cycled postcards
  participants.forEach((p, i) => {
    p.bio = bioOf(p);
    p.postcards = [POSTCARDS[i % POSTCARDS.length], POSTCARDS[(i + 5) % POSTCARDS.length]];
  });

  buildJourneys(participants);
  const edges = buildEdges(participants);

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

  return { participants, arcs, edges, hubs, destinationKey: "Lviv" };
}
