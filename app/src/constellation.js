// Constellations — participants as stars in overlapping figures, like the
// real sky where Alpheratz belongs to Pegasus AND Andromeda. Every shared
// public attribute with 3+ people is a figure (see buildConstellations in
// data.js); a star lives in its home figure's region and its other figures
// reach out to it as a guest. Figures join star-atlas style: closed
// polygons, open arcs for trios, interior chords on the largest wreaths.
// Selecting a star lights ALL its figures, plus dotted lines to kin it
// shares no figure with.

import { cityShort } from "./util.js";

export function initConstellation(canvas, data, onSelect) {
  const ctx = canvas.getContext("2d");
  const { participants, edges: rawEdges, constellations = [] } = data;

  // Deterministic per-string jitter so the sky looks the same on every visit.
  function hash01(s) {
    let h = 2166136261;
    for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
    return ((h >>> 0) % 100000) / 100000;
  }

  // --- constellation layout ---------------------------------------------------
  // Figures may overlap (a star can belong to several). Each figure gets a
  // region of sky (Fibonacci-spread centres); every star is PLACED in the
  // ring of its HOME figure (the first figure that claims it — Hearth, then
  // largest first), and its other figures reach out to it as a guest.
  const G = constellations.length || 1;
  const golden = Math.PI * (3 - Math.sqrt(5));
  const groups = constellations.map((g, gi) => {
    const y = 1 - ((gi + 0.5) / G) * 2;
    const r = Math.sqrt(Math.max(0, 1 - y * y));
    const th = gi * golden;
    const c = { x: Math.cos(th) * r, y, z: Math.sin(th) * r };
    const ref = Math.abs(c.y) < 0.9 ? { x: 0, y: 1, z: 0 } : { x: 1, y: 0, z: 0 };
    let u = {
      x: c.y * ref.z - c.z * ref.y,
      y: c.z * ref.x - c.x * ref.z,
      z: c.x * ref.y - c.y * ref.x,
    };
    const ul = Math.hypot(u.x, u.y, u.z);
    u = { x: u.x / ul, y: u.y / ul, z: u.z / ul };
    const v = {
      x: c.y * u.z - c.z * u.y,
      y: c.z * u.x - c.x * u.z,
      z: c.x * u.y - c.y * u.x,
    };
    return { ...g, gi, c, u, v, nodes: [] };
  });

  // home figure per star = first group that lists it
  const homeOf = new Map();
  const groupsOf = new Map(); // star id → all its groups
  for (const g of groups) {
    for (const id of g.members) {
      if (!homeOf.has(id)) homeOf.set(id, g);
      if (!groupsOf.has(id)) groupsOf.set(id, []);
      groupsOf.get(id).push(g);
    }
  }

  const partById = new Map(participants.map((p) => [p.id, p]));
  const nodes = [];
  for (const g of groups) {
    const homeMembers = g.members.filter((id) => homeOf.get(id) === g);
    const n = homeMembers.length;
    if (!n) continue;
    const rho0 = 0.22 + 0.055 * Math.sqrt(n);
    homeMembers.forEach((id, k) => {
      const p = partById.get(id);
      if (!p) return;
      const jTheta = (hash01(id) - 0.5) * ((2 * Math.PI) / n) * 0.55;
      const jRho = 1 + (hash01(id + "r") - 0.5) * 0.45;
      const theta = (2 * Math.PI * k) / n + jTheta;
      const rho = rho0 * jRho;
      const cosR = Math.cos(rho), sinR = Math.sin(rho);
      const dx = Math.cos(theta), dy = Math.sin(theta);
      nodes.push({
        p,
        home: g,
        groups: groupsOf.get(id) || [g],
        bx: cosR * g.c.x + sinR * (dx * g.u.x + dy * g.v.x),
        by: cosR * g.c.y + sinR * (dx * g.u.y + dy * g.v.y),
        bz: cosR * g.c.z + sinR * (dx * g.u.z + dy * g.v.z),
        sx: 0, sy: 0, depth: 0, persp: 1,
        phase: Math.random() * Math.PI * 2,
        dph: 0.2 + Math.random() * 0.5,
      });
    });
  }
  let nodeById = new Map(nodes.map((n) => [n.p.id, n]));
  for (const g of groups) {
    g.nodes = g.members.map((id) => nodeById.get(id)).filter(Boolean);
  }

  // Stars in no figure: scattered background stars (still named, clickable,
  // and showing dotted kinships on selection) — most stars in a real sky
  // belong to no constellation figure.
  const placed = new Set(nodes.map((n) => n.p.id));
  const loose = participants.filter((p) => !placed.has(p.id));
  const goldenL = Math.PI * (3 - Math.sqrt(5));
  loose.forEach((p, i) => {
    const y = 1 - ((i + 0.5) / (loose.length || 1)) * 2;
    const r = Math.sqrt(Math.max(0, 1 - y * y));
    const th = i * goldenL + 1.7; // offset from the figure centres
    nodes.push({
      p, home: null, groups: [],
      bx: Math.cos(th) * r, by: y, bz: Math.sin(th) * r,
      sx: 0, sy: 0, depth: 0, persp: 1,
      phase: Math.random() * Math.PI * 2,
      dph: 0.2 + Math.random() * 0.5,
    });
  });
  nodeById = new Map(nodes.map((n) => [n.p.id, n]));

  // Figure lines, star-atlas style. Members (home AND guest) are ordered by
  // angle around the figure's true centroid, then joined: closed polygons,
  // open arcs for trios, interior chords on ten-plus wreaths. The label sits
  // at the centroid too, so guests pull the name toward the figure's real
  // middle.
  const figureEdges = [];
  for (const g of groups) {
    const ring = g.nodes;
    const n = ring.length;
    if (n < 2) continue;
    // centroid + tangent basis
    let cx = 0, cy = 0, cz = 0;
    for (const m of ring) { cx += m.bx; cy += m.by; cz += m.bz; }
    const cl = Math.hypot(cx, cy, cz) || 1e-6;
    cx /= cl; cy /= cl; cz /= cl;
    g.labelDir = { x: cx, y: cy, z: cz };
    const ref = Math.abs(cy) < 0.9 ? { x: 0, y: 1, z: 0 } : { x: 1, y: 0, z: 0 };
    let ux = cy * ref.z - cz * ref.y, uy = cz * ref.x - cx * ref.z, uz = cx * ref.y - cy * ref.x;
    const ul = Math.hypot(ux, uy, uz) || 1e-6;
    ux /= ul; uy /= ul; uz /= ul;
    const vx = cy * uz - cz * uy, vy = cz * ux - cx * uz, vz = cx * uy - cy * ux;
    ring.sort((a, b) => {
      const angA = Math.atan2(a.bx * vx + a.by * vy + a.bz * vz, a.bx * ux + a.by * uy + a.bz * uz);
      const angB = Math.atan2(b.bx * vx + b.by * vy + b.bz * vz, b.bx * ux + b.by * uy + b.bz * uz);
      return angA - angB;
    });
    const closed = n >= 4;
    for (let k = 0; k < (closed ? n : n - 1); k++) {
      figureEdges.push({ a: ring[k], b: ring[(k + 1) % n], group: g });
    }
    if (n >= 10) figureEdges.push({ a: ring[0], b: ring[Math.floor(n / 2)], group: g, chord: true });
    if (n >= 14) {
      figureEdges.push({
        a: ring[Math.floor(n / 4)],
        b: ring[Math.floor((3 * n) / 4)],
        group: g, chord: true,
      });
    }
  }

  // Cross-constellation kinships (dotted, selection only): pairs who share
  // something but sit in none of the same figures.
  const shareFigure = (a, b) => a.groups.some((g) => b.groups.includes(g));
  const crossEdges = (rawEdges || [])
    .map((e) => ({ a: nodeById.get(e.a), b: nodeById.get(e.b), reasons: e.reasons }))
    .filter((e) => e.a && e.b && !shareFigure(e.a, e.b));
  const crossKin = new Map(nodes.map((n) => [n, new Set()]));
  for (const e of crossEdges) { crossKin.get(e.a).add(e.b); crossKin.get(e.b).add(e.a); }

  // --- camera -----------------------------------------------------------------
  let rotY = 0.5, rotX = -0.15, zoom = 1;
  const cam = { rotY, rotX, zoom };
  let W = 0, H = 0, SCALE = 1;
  const FOCAL = 3.0;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  function needsLayout() {
    return (
      canvas.width !== Math.round(canvas.clientWidth * devicePixelRatio) ||
      canvas.height !== Math.round(canvas.clientHeight * devicePixelRatio)
    );
  }
  function layout() {
    W = canvas.width = Math.round(canvas.clientWidth * devicePixelRatio);
    H = canvas.height = Math.round(canvas.clientHeight * devicePixelRatio);
    SCALE = Math.min(W, H) * 0.34;
  }

  function projectDir(x, y, z) {
    const cY = Math.cos(cam.rotY), sY = Math.sin(cam.rotY);
    const x1 = x * cY + z * sY;
    const z1 = -x * sY + z * cY;
    const cX = Math.cos(cam.rotX), sX = Math.sin(cam.rotX);
    const y2 = y * cX - z1 * sX;
    const z2 = y * sX + z1 * cX;
    const persp = FOCAL / (FOCAL - z2);
    return {
      sx: W / 2 + x1 * SCALE * cam.zoom * persp,
      sy: H * 0.52 - y2 * SCALE * cam.zoom * persp,
      depth: z2,
      persp,
    };
  }

  function project(n, t) {
    const d = 0.035; // gentle drift — small enough to keep the figures crisp
    const pr = projectDir(
      n.bx + Math.sin(t * 0.0002 * n.dph + n.phase) * d,
      n.by + Math.cos(t * 0.00017 * n.dph + n.phase) * d,
      n.bz + Math.sin(t * 0.00023 * n.dph + n.phase * 1.7) * d
    );
    n.sx = pr.sx; n.sy = pr.sy; n.depth = pr.depth; n.persp = pr.persp;
  }

  // --- selection & focus ------------------------------------------------------
  let selected = null;
  let hovered = null;
  let targetRotY = rotY, targetRotX = rotX, targetZoom = zoom;
  function faceNode(n) {
    const mag = Math.hypot(n.bx, n.bz) || 1e-6;
    targetRotY = Math.atan2(-n.bx, n.bz);
    targetRotX = clamp(Math.atan2(n.by, mag), -1.2, 1.2);
  }
  function select(node) {
    selected = node;
    if (node) faceNode(node);
  }

  // --- interaction ------------------------------------------------------------
  function nodeAt(mx, my) {
    const x = mx * devicePixelRatio, y = my * devicePixelRatio;
    let best = null, bestD = 30 * devicePixelRatio;
    for (const n of nodes) {
      const d = Math.hypot(n.sx - x, n.sy - y);
      const r = (n.hitR || 20);
      const tol = Math.max(bestD, r);
      if (d < tol && d < (best ? bestD : tol)) { best = n; bestD = d; }
    }
    return best;
  }

  let dragging = false, dragMoved = false, lastX = 0, lastY = 0;
  canvas.addEventListener("pointerdown", (e) => {
    dragging = true; dragMoved = false; lastX = e.clientX; lastY = e.clientY;
    canvas.setPointerCapture?.(e.pointerId);
    canvas.style.cursor = "grabbing";
  });
  canvas.addEventListener("pointermove", (e) => {
    const r = canvas.getBoundingClientRect();
    if (dragging) {
      const dx = e.clientX - lastX, dy = e.clientY - lastY;
      targetRotY += dx * 0.006;
      targetRotX = clamp(targetRotX + dy * 0.006, -1.35, 1.35);
      cam.rotY += dx * 0.006; cam.rotX = clamp(cam.rotX + dy * 0.006, -1.35, 1.35);
      if (Math.abs(dx) + Math.abs(dy) > 3) dragMoved = true;
      lastX = e.clientX; lastY = e.clientY; hovered = null;
      return;
    }
    hovered = nodeAt(e.clientX - r.left, e.clientY - r.top);
    canvas.style.cursor = hovered ? "pointer" : "grab";
  });
  canvas.addEventListener("pointerup", (e) => {
    if (!dragging) return;
    dragging = false; canvas.style.cursor = "grab";
    if (dragMoved) return;
    const r = canvas.getBoundingClientRect();
    const n = nodeAt(e.clientX - r.left, e.clientY - r.top);
    if (n) { select(n); onSelect(n.p.id); }
    else { select(null); onSelect(null); }
  });
  canvas.addEventListener("wheel", (e) => {
    e.preventDefault();
    targetZoom = clamp(targetZoom * Math.exp(-e.deltaY * 0.0012), 0.55, 3);
  }, { passive: false });

  // --- render -----------------------------------------------------------------
  let started = false, frameCount = 0, lastError = null;
  function frame(t) {
    try { frameInner(t); } catch (err) { lastError = String(err.stack || err); }
    requestAnimationFrame(frame);
  }
  function frameInner(t) {
    started = true; frameCount++;
    if (needsLayout()) layout();
    const dpr = devicePixelRatio;

    if (!dragging && !selected) targetRotY += 0.0016;
    cam.rotY += (targetRotY - cam.rotY) * 0.08;
    cam.rotX += (targetRotX - cam.rotX) * 0.08;
    cam.zoom += (targetZoom - cam.zoom) * 0.1;

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, W, H);

    for (const n of nodes) project(n, t);
    const order = [...nodes].sort((a, b) => a.depth - b.depth);

    const focus = selected || hovered;
    const activeGroups = focus ? focus.groups : null;
    const selKin = selected ? crossKin.get(selected) : null;
    const isLit = (n) =>
      !selected || shareFigure(n, selected) || selKin.has(n);

    // figure lines — the constellation polygons, silvery like a star atlas
    for (const e of figureEdges) {
      const near = ((e.a.depth + e.b.depth) / 2 + 1) / 2;
      const active = activeGroups?.includes(e.group) ?? false;
      const dim = selected && !active;
      let alpha = (e.chord ? 0.1 : 0.16) * (0.35 + 0.65 * near);
      if (active) alpha = e.chord ? 0.3 : 0.5;
      if (dim) alpha *= 0.25;
      ctx.strokeStyle = `rgba(200, 206, 244, ${alpha.toFixed(3)})`;
      ctx.lineWidth = (active ? 1.2 : 0.7) * dpr;
      ctx.beginPath();
      ctx.moveTo(e.a.sx, e.a.sy);
      ctx.lineTo(e.b.sx, e.b.sy);
      ctx.stroke();
    }

    // dotted kinships across figures — only for the selected star
    if (selected) {
      ctx.setLineDash([3 * dpr, 5 * dpr]);
      for (const e of crossEdges) {
        if (e.a !== selected && e.b !== selected) continue;
        const near = ((e.a.depth + e.b.depth) / 2 + 1) / 2;
        ctx.strokeStyle = `rgba(151, 176, 230, ${(0.25 + 0.35 * near).toFixed(3)})`;
        ctx.lineWidth = 0.8 * dpr;
        ctx.beginPath();
        ctx.moveTo(e.a.sx, e.a.sy);
        ctx.lineTo(e.b.sx, e.b.sy);
        ctx.stroke();
      }
      ctx.setLineDash([]);
    }

    // constellation names — printed on the sky like a celestial map
    for (const g of groups) {
      const dir = g.labelDir || g.c;
      const pr = projectDir(dir.x, dir.y, dir.z);
      if (pr.depth < -0.15) continue; // facing away
      const a = Math.min(1, (pr.depth + 0.15) * 2) *
        (activeGroups && !activeGroups.includes(g) ? 0.25 : 0.8);
      ctx.globalAlpha = a;
      ctx.textAlign = "center";
      ctx.font = `500 ${12.5 * dpr}px "Jost", sans-serif`;
      ctx.fillStyle = "rgba(151, 176, 230, 0.9)";
      const nm = g.name.toUpperCase().split("").join(" ");
      ctx.fillText(nm, pr.sx, pr.sy - 4 * dpr);
      ctx.font = `italic 400 ${11 * dpr}px "Cormorant Garamond", Georgia, serif`;
      ctx.fillStyle = "rgba(151, 176, 230, 0.65)";
      ctx.fillText(g.caption, pr.sx, pr.sy + 12 * dpr);
      ctx.globalAlpha = 1;
    }

    // stars + names (near ones on top)
    for (const n of order) {
      const isSel = n === selected;
      const isHover = n === hovered;
      const lit = isLit(n);
      const tw = 0.6 + 0.4 * Math.sin(n.phase + t / 900);
      const baseAlpha = lit ? 1 : 0.16;
      const nearFade = 0.55 + 0.45 * ((n.depth + 1) / 2);

      // starburst with diffraction spikes
      const glow = (isSel ? 16 : isHover ? 12 : 7 * tw) * n.persp;
      ctx.globalAlpha = baseAlpha * nearFade;
      const size = (isSel ? 4.5 : 3) * n.persp * dpr;
      const rayRGB = n.p.receiving ? "188, 217, 255" : "244, 227, 184";
      const rayLen = size * (isSel || isHover ? 6.5 : 3.6 + 2.2 * tw);
      const diagLen = rayLen * 0.42;
      for (let k = 0; k < 8; k++) {
        const diag = k >= 4;
        const ang = diag ? (Math.PI / 4) * (2 * (k - 4) + 1) : (Math.PI / 2) * k;
        const len = diag ? diagLen : rayLen;
        const ex = n.sx + Math.cos(ang) * len;
        const ey = n.sy + Math.sin(ang) * len;
        const g = ctx.createLinearGradient(n.sx, n.sy, ex, ey);
        g.addColorStop(0, `rgba(${rayRGB}, 0.9)`);
        g.addColorStop(0.35, `rgba(${rayRGB}, 0.35)`);
        g.addColorStop(1, `rgba(${rayRGB}, 0)`);
        ctx.strokeStyle = g;
        ctx.lineWidth = (diag ? 0.7 : 1.05) * dpr;
        ctx.beginPath();
        ctx.moveTo(n.sx, n.sy);
        ctx.lineTo(ex, ey);
        ctx.stroke();
      }
      ctx.shadowColor = n.p.receiving ? "rgba(150,200,255,0.9)" : "rgba(232,196,118,0.9)";
      ctx.shadowBlur = glow * dpr;
      ctx.fillStyle = n.p.receiving ? "#bcd9ff" : "#f4e3b8";
      ctx.beginPath();
      ctx.arc(n.sx, n.sy, size * 0.75, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;

      // name — warm serif (gold when focused)
      const fs = (isSel ? 26 : isHover ? 21 : 16) * n.persp * dpr;
      ctx.font = `600 ${fs}px "Cormorant Garamond", Georgia, serif`;
      ctx.fillStyle = isSel || isHover ? "#e8c476" : "#f6ecc9";
      ctx.textAlign = "center";
      ctx.shadowColor = "rgba(0,0,0,0.9)";
      ctx.shadowBlur = 4 * dpr;
      ctx.fillText(n.p.name, n.sx, n.sy - 10 * n.persp * dpr);
      ctx.shadowBlur = 0;
      n.hitR = (ctx.measureText(n.p.name).width / 2 + 8 * dpr);

      if (isSel || isHover) {
        ctx.font = `400 ${10 * dpr}px "Jost", sans-serif`;
        ctx.fillStyle = "#97b0e6";
        ctx.fillText(cityShort(n.p.city).toUpperCase(), n.sx, n.sy + 16 * n.persp * dpr);
      }
      ctx.globalAlpha = 1;
    }
  }

  window.addEventListener("resize", () => { if (needsLayout()) layout(); });
  if (typeof ResizeObserver !== "undefined") {
    new ResizeObserver(() => { if (needsLayout()) layout(); }).observe(canvas);
  }
  layout();
  requestAnimationFrame(frame);

  canvas.__debug = {
    nodes, figureEdges, crossEdges, groups,
    get edges() { return figureEdges; }, // back-compat for checks
    get selected() { return selected; },
    get frames() { return frameCount; }, get lastError() { return lastError; },
  };

  return {
    selectParticipant(id) {
      select(id ? nodeById.get(id) ?? null : null);
    },
    refresh() { if (needsLayout()) layout(); },
  };
}
