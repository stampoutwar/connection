// 3D globe of postcard journeys: origin city → Millbrook hub → Ukraine.
// Uses the vendored globe.gl UMD bundle (global `Globe`).

const COLOR_LEG1 = ["rgba(232, 196, 118, 0.05)", "rgba(232, 196, 118, 0.9)"]; // gold: writer → hub
const COLOR_LEG2 = ["rgba(140, 170, 255, 0.05)", "rgba(150, 200, 255, 0.95)"]; // blue: hub → Ukraine

export function initGlobe(container, data, onSelect) {
  const { hub, destination, participants } = data;

  const arcs = [];
  for (const p of participants) {
    if (p.receiving) {
      // The Ukrainian coordinator: one leg, hub → her town.
      arcs.push({ p, startLat: hub.lat, startLng: hub.lng, endLat: p.lat, endLng: p.lng, colors: COLOR_LEG2 });
      continue;
    }
    const atHub = Math.abs(p.lat - hub.lat) < 0.01 && Math.abs(p.lng - hub.lng) < 0.01;
    if (!atHub) {
      arcs.push({ p, startLat: p.lat, startLng: p.lng, endLat: hub.lat, endLng: hub.lng, colors: COLOR_LEG1 });
    }
    arcs.push({ p, startLat: hub.lat, startLng: hub.lng, endLat: destination.lat, endLng: destination.lng, colors: COLOR_LEG2 });
  }

  const points = participants.map((p) => ({
    ...p,
    size: 0.055,
    color: p.receiving ? "#96c8ff" : "#e8c476",
  }));
  points.push({
    id: "__hub", name: hub.name, city: hub.label, lat: hub.lat, lng: hub.lng,
    size: 0.09, color: "#ffffff", isWaypoint: true,
  });
  points.push({
    id: "__dest", name: destination.name, city: destination.label, lat: destination.lat, lng: destination.lng,
    size: 0.09, color: "#96c8ff", isWaypoint: true,
  });

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
    .arcDashAnimateTime((d) => 2600 + ((d.p ? d.p.id.length : 0) % 5) * 350)
    .pointsData(points)
    .pointLat("lat")
    .pointLng("lng")
    .pointColor("color")
    .pointAltitude(0.012)
    .pointRadius("size")
    // Names as HTML overlays instead of 3D text: real DOM elements with a
    // padded hit area, so they are much easier to click.
    .htmlElementsData(points)
    .htmlLat("lat")
    .htmlLng("lng")
    .htmlAltitude(0.015)
    .htmlElement((d) => {
      const el = document.createElement("div");
      el.className = "globe-label" + (d.isWaypoint ? " waypoint" : "");
      el.innerHTML = `<span>${d.name}</span>`;
      if (!d.isWaypoint) {
        el.addEventListener("click", (ev) => {
          ev.stopPropagation();
          focusOn(d);
          onSelect(d.id);
        });
      }
      return el;
    })
    .htmlElementVisibilityModifier((el, isVisible) => {
      el.style.opacity = isVisible ? 1 : 0;
      el.style.pointerEvents = isVisible && !el.classList.contains("waypoint") ? "auto" : "none";
    })
    .onPointClick((pt) => {
      if (pt.isWaypoint) return;
      focusOn(pt);
      onSelect(pt.id);
    })
    .pointOfView({ lat: 42, lng: -45, altitude: 2.3 }, 0);

  globe.controls().autoRotate = true;
  globe.controls().autoRotateSpeed = 0.45;
  globe.controls().enableDamping = true;

  // Pause the slow spin while the visitor is holding the globe.
  container.addEventListener("pointerdown", () => (globe.controls().autoRotate = false));
  container.addEventListener("pointerup", () => setTimeout(() => (globe.controls().autoRotate = true), 6000));

  function focusOn(p) {
    globe.controls().autoRotate = false;
    globe.pointOfView({ lat: p.lat, lng: p.lng, altitude: 1.7 }, 900);
  }

  function resize() {
    globe.width(container.clientWidth).height(container.clientHeight);
  }
  window.addEventListener("resize", resize);
  resize();

  return {
    refresh: resize,
    focusParticipant(id) {
      const p = participants.find((x) => x.id === id);
      if (p) focusOn(p);
    },
    highlight(id) {
      globe
        .arcColor((d) => {
          if (!id || (d.p && d.p.id === id)) return d.colors;
          return ["rgba(236,234,251,0.03)", "rgba(236,234,251,0.12)"];
        })
        .arcStroke((d) => (id && d.p && d.p.id === id ? 0.9 : 0.5));
    },
  };
}
