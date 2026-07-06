import { initStarfield } from "./starfield.js";
import { initGlobe } from "./globe-view.js";
import { initConstellation } from "./constellation.js";
import { initPanel } from "./panel.js";

const data = await (await fetch("data/participants.json")).json();
const byId = new Map(data.participants.map((p) => [p.id, p]));

initStarfield(document.getElementById("starfield"));

// --- view switching ---------------------------------------------------------
const views = {
  globe: { btn: document.getElementById("btn-globe"), el: document.getElementById("globe-view") },
  constellation: { btn: document.getElementById("btn-constellation"), el: document.getElementById("constellation-view") },
};
let current = "globe";

function showView(name) {
  current = name;
  for (const [key, v] of Object.entries(views)) {
    v.btn.classList.toggle("active", key === name);
    v.btn.setAttribute("aria-selected", String(key === name));
    v.el.classList.toggle("active", key === name);
  }
  // Views can miss resize events while hidden — recheck when shown.
  if (name === "globe") globeView?.refresh();
  if (name === "constellation") constellationView?.refresh();
}
views.globe.btn.addEventListener("click", () => showView("globe"));
views.constellation.btn.addEventListener("click", () => showView("constellation"));

// --- panel + views wiring ----------------------------------------------------
const panel = initPanel(data, {
  onShowJourney(id) {
    showView("globe");
    globeView.focusParticipant(id);
    globeView.highlight(id);
  },
  onClose() {
    globeView.highlight(null);
    constellationView.selectParticipant(null);
  },
});

function selectParticipant(id) {
  if (!id) {
    panel.close();
    return;
  }
  const p = byId.get(id);
  panel.open(p);
  globeView.highlight(id);
  if (current === "constellation") constellationView.selectParticipant(id);
}

const globeView = initGlobe(document.getElementById("globe"), data, selectParticipant);
const constellationView = initConstellation(document.getElementById("constellation"), data, selectParticipant);

// Small public API — lets kiosk deep-links (e.g. ?p=HelenG) open a participant directly.
window.connectionApp = { showView, selectParticipant };
const preselect = new URLSearchParams(location.search).get("p");
if (preselect && byId.has(preselect)) selectParticipant(preselect);
