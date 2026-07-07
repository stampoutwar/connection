// 3D globe of postcard journeys: origin city → Millbrook hub → Ukraine.
// Uses the vendored globe.gl UMD bundle (global `Globe`).

import { cityShort } from "./util.js";

const COLOR_LEG1 = ["rgba(232, 196, 118, 0.05)", "rgba(232, 196, 118, 0.9)"]; // gold: writer → hub
const COLOR_LEG2 = ["rgba(140, 170, 255, 0.05)", "rgba(150, 200, 255, 0.95)"]; // blue: hub → Ukraine

// High-res, area-by-area tiles (like Google Maps) used ONLY at the deepest
// zoom levels, where the base texture would otherwise pixelate: NASA GIBS
// "Black Marble" night lights, and ESRI World Imagery in daylight mode.
const TILE_NIGHT = (x, y, l) =>
  `https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/VIIRS_Black_Marble/default/2016-01-01/GoogleMapsCompatible_Level8/${l}/${y}/${x}.png`;
const TILE_DAY = (x, y, l) =>
  `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/${l}/${y}/${x}`;

// Zoom range, expressed as camera altitude (globe radius = 100, so distance =
// 100 * (1 + altitude)). The two farthest levels are trimmed; the near end now
// goes deeper than the base texture can stay sharp, so tiles cover those.
const MIN_ALT = 0.22; // ~distance 122 — deepest, e.g. European cities (tiles)
const MAX_ALT = 2.2; // ~distance 320 — farthest (two farthest levels dropped)
const DEFAULT_ALT = 2.2;
const TILES_ON_DIST = 155; // enable tiles closer than this…
const TILES_OFF_DIST = 178; // …disable beyond this (hysteresis)

export function initGlobe(container, data, onSelect) {
  const { participants, hubs } = data;
  const partById = new Map(participants.map((p) => [p.id, p]));
  const hubByKey = new Map(hubs.map((h) => [h.key, { lat: h.lat, lng: h.lng }]));
  const latLngToVec = (lat, lng) => {
    const φ = (lat * Math.PI) / 180, λ = (lng * Math.PI) / 180;
    return { x: Math.cos(φ) * Math.cos(λ), y: Math.sin(φ), z: Math.cos(φ) * Math.sin(λ) };
  };
  const vecToLatLng = (x, y, z) => ({
    lat: (Math.asin(Math.max(-1, Math.min(1, y))) * 180) / Math.PI,
    lng: (Math.atan2(z, x) * 180) / Math.PI,
  });

  // Trajectory arcs: one per participant (town → "Sent to"). Blue if the card
  // is heading to Ukraine, yellow otherwise. `journeyKey` matches legs so a
  // participant's full onward path can be highlighted together.
  const arcs = data.arcs.map((a) => ({
    ...a,
    key: `${a.fromKey}>${a.toKey}`,
    colors: a.toUkraine ? COLOR_LEG2 : COLOR_LEG1,
  }));

  const BASE_ALT = 0.02;
  const participantPoints = participants.map((p) => ({
    ...p,
    size: 0.055,
    color: p.receiving ? "#96c8ff" : "#e8c476",
    labelAlt: BASE_ALT,
  }));
  // Lift clustered city labels to different altitudes so nearby ones don't pile.
  const angDist = (a, b) => {
    const dLat = a.lat - b.lat;
    const dLng = (a.lng - b.lng) * Math.cos((a.lat * Math.PI) / 180);
    return Math.hypot(dLat, dLng);
  };
  const clusters = [];
  for (const p of participantPoints) {
    const c = clusters.find((cl) => cl.some((q) => angDist(p, q) < 6));
    if (c) c.push(p);
    else clusters.push([p]);
  }
  for (const cl of clusters) {
    if (cl.length < 2) continue;
    cl.sort((a, b) => a.lat - b.lat);
    cl.forEach((p, i) => { p.labelAlt = BASE_ALT + i * 0.12; p.lifted = i > 0; });
  }

  // Hub dots (Millbrook, Melbourne, Lviv) — no labels.
  const waypointPoints = hubs.map((h) => ({
    id: h.id, lat: h.lat, lng: h.lng, size: 0.08,
    color: h.country === "Ukraine" ? "#96c8ff" : "#ffffff", isWaypoint: true,
  }));
  const points = [...participantPoints, ...waypointPoints];

  const globe = Globe()(container)
    .globeImageUrl("vendor/earth-night.jpg")
    .backgroundColor("rgba(0,0,0,0)")
    .atmosphereColor("#7a74e2")
    .atmosphereAltitude(0.22)
    .arcsData(arcs)
    .arcColor("colors")
    .arcAltitudeAutoScale(0.4)
    .arcStroke(0.5)
    .arcDashLength(0.35)
    .arcDashGap(0.6)
    .arcDashAnimateTime((d) => 2600 + ((d.key ? d.key.length : 0) % 5) * 350)
    .pointsData(points)
    .pointLat("lat")
    .pointLng("lng")
    .pointColor("color")
    .pointAltitude(0.012)
    .pointRadius("size")
    // Names as HTML overlays instead of 3D text: real DOM elements with a
    // padded hit area, so they are much easier to click. Only participants get
    // labels (waypoints are dots). Clustered labels are raised to different
    // altitudes; a short stem drops back toward the city dot.
    .htmlElementsData(participantPoints)
    .htmlLat("lat")
    .htmlLng("lng")
    .htmlAltitude((d) => d.labelAlt)
    .htmlElement((d) => {
      const el = document.createElement("div");
      el.className = "globe-label" + (d.lifted ? " lifted" : "");
      el.innerHTML =
        `<span class="stem"></span>` +
        `<span class="label-body">` +
        `<span class="pname">${d.name}</span>` +
        `<span class="loc">${cityShort(d.city)}</span>` +
        `</span>`;
      el.addEventListener("click", (ev) => {
        ev.stopPropagation();
        onSelect(d.id); // selection re-centres the globe (see main.js)
      });
      el.addEventListener("mouseenter", () => hoverHighlight(d.id));
      el.addEventListener("mouseleave", () => hoverHighlight(null));
      return el;
    })
    .htmlElementVisibilityModifier((el, isVisible) => {
      el.style.opacity = isVisible ? 1 : 0;
      el.style.pointerEvents = isVisible ? "auto" : "none";
    })
    // Country borders + names (hidden until toggled on; data loaded lazily).
    .polygonCapColor(() => "rgba(0,0,0,0)")
    .polygonSideColor(() => "rgba(0,0,0,0)")
    .polygonStrokeColor(() => "rgba(180, 200, 255, 0.4)")
    .polygonAltitude(0.006)
    .labelLat((d) => d.lat)
    .labelLng((d) => d.lng)
    .labelText((d) => d.text)
    .labelSize(0.5)
    .labelDotRadius(0)
    .labelColor(() => "rgba(200, 214, 255, 0.55)")
    .labelResolution(1)
    .labelAltitude(0.007)
    .onPointClick((pt) => {
      if (pt.isWaypoint) return;
      onSelect(pt.id);
    })
    .pointOfView({ lat: 42, lng: -45, altitude: DEFAULT_ALT }, 0);

  // Controls: zoom responds immediately. Damping was adding inertia that felt
  // like lag, so it is off; the auto-spin still pauses during wheel/drag so it
  // never fights the zoom. The distance range is trimmed to the crisp zone.
  const controls = globe.controls();
  controls.enableDamping = false;
  controls.zoomSpeed = 1.1;
  controls.rotateSpeed = 0.85;
  controls.minDistance = 100 * (1 + MIN_ALT);
  controls.maxDistance = 100 * (1 + MAX_ALT);
  controls.autoRotate = true;
  controls.autoRotateSpeed = 0.45;

  let spinTimer;
  function pauseSpin(resumeAfter) {
    controls.autoRotate = false;
    clearTimeout(spinTimer);
    if (resumeAfter) spinTimer = setTimeout(() => (controls.autoRotate = true), resumeAfter);
  }
  container.addEventListener("pointerdown", () => pauseSpin(0));
  container.addEventListener("pointerup", () => pauseSpin(6000));
  container.addEventListener("wheel", () => pauseSpin(4000), { passive: true });

  // Centre on a participant WITHOUT changing the zoom level — keep the current
  // altitude, just swing to her lat/lng.
  function focusOn(p) {
    pauseSpin(0);
    const alt = globe.pointOfView().altitude;
    globe.pointOfView({ lat: p.lat, lng: p.lng, altitude: alt }, 1000);
  }

  // Sharpen the map: max anisotropic filtering keeps the 8K texture crisp at
  // grazing angles / close zoom instead of smearing into pixels. Re-applied
  // whenever the day/night texture swaps.
  function sharpenTexture() {
    try {
      const mat = globe.globeMaterial && globe.globeMaterial();
      const maxAniso = globe.renderer().capabilities.getMaxAnisotropy();
      if (mat && mat.map) {
        mat.map.anisotropy = maxAniso;
        mat.map.needsUpdate = true;
      }
    } catch (e) {
      /* best-effort */
    }
  }
  if (globe.onGlobeReady) globe.onGlobeReady(sharpenTexture);
  else setTimeout(sharpenTexture, 800);

  // The early-night blue texture is the globe for the normal viewing range.
  // Only when you zoom in past TILES_ON_DIST do high-res tiles stream in for
  // that area (crisp city detail); zooming back out returns to the blue map.
  let currentDay = false;
  let tilesOn = false;
  function setTiles(on) {
    tilesOn = on;
    // Desaturate the globe canvas while the (yellow) Black Marble tiles show, so
    // the warm city lights read closer to white and the gold name labels — HTML
    // overlays, unaffected by the canvas filter — stand out. Night only.
    container.classList.toggle("tiles-active", on && !currentDay);
    if (on && navigator.onLine) {
      globe.globeTileEngineUrl(currentDay ? TILE_DAY : TILE_NIGHT).globeTileEngineMaxLevel(currentDay ? 12 : 8);
    } else {
      globe.globeTileEngineUrl(null);
    }
  }
  function updateTilesForZoom() {
    const d = controls.getDistance();
    if (!tilesOn && d < TILES_ON_DIST) setTiles(true);
    else if (tilesOn && d > TILES_OFF_DIST) setTiles(false);
  }
  // Poll distance so this works however the zoom changed (wheel, slider,
  // buttons, autorotate) — controls "change" alone misses programmatic zooms.
  controls.addEventListener("change", updateTilesForZoom);
  setInterval(updateTilesForZoom, 400);

  function applyBasemap(day) {
    currentDay = day;
    globe
      .globeImageUrl(day ? "vendor/earth-day.jpg" : "vendor/earth-night.jpg")
      .atmosphereColor(day ? "#a9c7ff" : "#7a74e2");
    setTiles(false);
    updateTilesForZoom(); // re-enable if already deep-zoomed
    [300, 900, 1600].forEach((ms) => setTimeout(sharpenTexture, ms));
  }
  applyBasemap(false);

  // Trajectory highlighting: `committedId` is the selected participant; hover
  // previews another without losing the selection.
  let committedId = null;
  // Set of arc keys ("from>to") that make up a participant's full journey to
  // Lviv — so her onward hub→Lviv leg (drawn as someone else's arc) highlights
  // together with her own.
  function journeyKeys(id) {
    const p = id ? partById.get(id) : null;
    if (!p || !p.journey) return null;
    return new Set(p.journey.map((l) => `${l.from}>${l.to}`));
  }
  function applyHighlight(id) {
    const keys = journeyKeys(id);
    globe
      .arcColor((d) => {
        if (!keys || keys.has(d.key)) return d.colors;
        return ["rgba(236,234,251,0.02)", "rgba(236,234,251,0.1)"];
      })
      .arcStroke((d) => (keys && keys.has(d.key) ? 1.1 : 0.5));
  }
  function hoverHighlight(id) {
    applyHighlight(id || committedId);
  }

  // Frame the camera to show a participant's WHOLE journey (her town → hub →
  // Lviv) rather than centring tight on her — used by "See the journey".
  function frameJourney(id) {
    const p = partById.get(id);
    if (!p || !p.journey || !p.journey.length) return focusOn(p);
    // Gather the journey's points (towns + hubs) as unit vectors.
    const pts = [];
    const add = (lat, lng) => pts.push(latLngToVec(lat, lng));
    add(p.lat, p.lng);
    for (const leg of p.journey) {
      const g = hubByKey.get(leg.to);
      if (g) add(g.lat, g.lng);
    }
    // Centre = normalized average direction; span = max angle from centre.
    let cx = 0, cy = 0, cz = 0;
    for (const v of pts) { cx += v.x; cy += v.y; cz += v.z; }
    const cl = Math.hypot(cx, cy, cz) || 1;
    cx /= cl; cy /= cl; cz /= cl;
    let maxAng = 0;
    for (const v of pts) maxAng = Math.max(maxAng, Math.acos(Math.max(-1, Math.min(1, v.x * cx + v.y * cy + v.z * cz))));
    const center = vecToLatLng(cx, cy, cz);
    const alt = Math.max(0.9, Math.min(MAX_ALT, 0.3 + maxAng * 1.7));
    pauseSpin(0);
    globe.pointOfView({ lat: center.lat, lng: center.lng, altitude: alt }, 1300);
  }

  // --- country borders + names (loaded on first toggle) ----------------------
  let countryFeatures = null;
  let countryLabels = null;
  function centroid(f) {
    const g = f.geometry;
    const ring =
      g.type === "Polygon"
        ? g.coordinates[0]
        : g.coordinates.map((poly) => poly[0]).sort((a, b) => b.length - a.length)[0];
    let x = 0, y = 0;
    for (const [lng, lat] of ring) { x += lng; y += lat; }
    return { lng: x / ring.length, lat: y / ring.length };
  }
  async function ensureCountryData() {
    if (countryFeatures) return;
    const geo = await (await fetch("vendor/countries-110m.geojson")).json();
    countryFeatures = geo.features;
    // Name only the more prominent countries, to keep the globe legible.
    countryLabels = countryFeatures
      .filter((f) => (f.properties.LABELRANK ?? 9) <= 4)
      .map((f) => ({ ...centroid(f), text: f.properties.ADMIN }));
  }

  function resize() {
    globe.width(container.clientWidth).height(container.clientHeight);
  }
  window.addEventListener("resize", resize);
  resize();

  return {
    refresh: resize,
    setDayMode(day) {
      if (globe.globeTileEngineClearCache) globe.globeTileEngineClearCache();
      applyBasemap(day);
    },
    async setCountries(show) {
      if (show) {
        await ensureCountryData();
        globe.polygonsData(countryFeatures).labelsData(countryLabels);
      } else {
        globe.polygonsData([]).labelsData([]);
      }
    },
    focusParticipant(id) {
      const p = participants.find((x) => x.id === id);
      if (p) focusOn(p);
    },
    zoomLimits() {
      return { min: (controls.minDistance - 100) / 100, max: (controls.maxDistance - 100) / 100 };
    },
    getAltitude() {
      return globe.pointOfView().altitude;
    },
    setAltitude(alt, dur = 0) {
      const min = (controls.minDistance - 100) / 100;
      const max = (controls.maxDistance - 100) / 100;
      pauseSpin(6000);
      globe.pointOfView({ altitude: Math.max(min, Math.min(max, alt)) }, dur);
    },
    onZoomChange(cb) {
      controls.addEventListener("change", () => cb(globe.pointOfView().altitude));
    },
    highlight(id) {
      committedId = id;
      applyHighlight(id);
    },
    showJourney(id) {
      committedId = id;
      applyHighlight(id);
      frameJourney(id);
    },
  };
}
