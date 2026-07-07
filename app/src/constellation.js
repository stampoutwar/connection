// Constellation — participants as stars in an abstract 3D night sky. Two people
// are joined by a thread when they share something (age group, profession,
// hobby, ancestry, the same referrer, both postcrossers…). The extra dimension
// gives the dense web of shared traits room to breathe: drag to rotate the
// space, scroll to zoom, click a name to light up who they're connected to.

import { cityShort } from "./util.js";

export function initConstellation(canvas, data, onSelect) {
  const ctx = canvas.getContext("2d");
  const { participants, edges: rawEdges } = data;

  // --- nodes on a 3D sphere (even Fibonacci spread) ---------------------------
  const N = participants.length;
  const golden = Math.PI * (3 - Math.sqrt(5));
  const nodes = participants.map((p, i) => {
    const y = 1 - (i / (N - 1 || 1)) * 2; // 1 → -1
    const r = Math.sqrt(Math.max(0, 1 - y * y));
    const th = i * golden;
    return {
      p, i,
      bx: Math.cos(th) * r, by: y, bz: Math.sin(th) * r, // base unit position
      sx: 0, sy: 0, depth: 0, persp: 1, // filled each frame
      phase: Math.random() * Math.PI * 2,
      dph: 0.2 + Math.random() * 0.5,
    };
  });
  const nodeById = new Map(nodes.map((n) => [n.p.id, n]));

  const edges = (rawEdges || [])
    .map((e) => ({ a: nodeById.get(e.a), b: nodeById.get(e.b), weight: e.weight, reasons: e.reasons }))
    .filter((e) => e.a && e.b);
  const neighbourIds = new Map(nodes.map((n) => [n, new Set()]));
  for (const e of edges) { neighbourIds.get(e.a).add(e.b); neighbourIds.get(e.b).add(e.a); }

  // --- camera -----------------------------------------------------------------
  let rotY = 0.5, rotX = -0.15, zoom = 1;
  const cam = { rotY, rotX, zoom }; // eased toward the targets above
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

  function project(n, t) {
    // gentle drift on the base position
    const d = 0.05;
    let x = n.bx + Math.sin(t * 0.0002 * n.dph + n.phase) * d;
    let y = n.by + Math.cos(t * 0.00017 * n.dph + n.phase) * d;
    let z = n.bz + Math.sin(t * 0.00023 * n.dph + n.phase * 1.7) * d;
    // rotate Y then X
    const cY = Math.cos(cam.rotY), sY = Math.sin(cam.rotY);
    let x1 = x * cY + z * sY;
    let z1 = -x * sY + z * cY;
    const cX = Math.cos(cam.rotX), sX = Math.sin(cam.rotX);
    let y2 = y * cX - z1 * sX;
    let z2 = y * sX + z1 * cX;
    const persp = FOCAL / (FOCAL - z2); // z2 large = nearer = bigger
    const cx = W / 2, cy = H * 0.52;
    n.sx = cx + x1 * SCALE * cam.zoom * persp;
    n.sy = cy - y2 * SCALE * cam.zoom * persp;
    n.depth = z2;
    n.persp = persp;
  }

  // --- selection & focus ------------------------------------------------------
  let selected = null;
  let hovered = null;
  let targetRotY = rotY, targetRotX = rotX, targetZoom = zoom;
  function faceNode(n) {
    // rotate the space so this star swings to the front-centre
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
      const r = (n.hitR || 20) ; // set during draw (name width)
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

    // idle auto-rotation (only when nothing is held/selected)
    if (!dragging && !selected) targetRotY += 0.0016;
    cam.rotY += (targetRotY - cam.rotY) * 0.08;
    cam.rotX += (targetRotX - cam.rotX) * 0.08;
    cam.zoom += (targetZoom - cam.zoom) * 0.1;

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, W, H);

    for (const n of nodes) project(n, t);
    const order = [...nodes].sort((a, b) => a.depth - b.depth); // far → near

    const selNeighbours = selected ? neighbourIds.get(selected) : null;
    const isLit = (n) => !selected || n === selected || selNeighbours.has(n);

    // edges
    for (const e of edges) {
      const active =
        (selected && (e.a === selected || e.b === selected)) ||
        (!selected && hovered && (e.a === hovered || e.b === hovered));
      const dim = selected && !(e.a === selected || e.b === selected);
      const depth = (e.a.depth + e.b.depth) / 2;
      const near = (depth + 1) / 2; // 0 far → 1 near
      let alpha = (0.05 + e.weight * 0.03) * (0.4 + 0.6 * near);
      if (active) alpha = 0.55;
      else if (dim) alpha *= 0.15;
      ctx.strokeStyle = active ? "rgba(236,234,251,0.8)" : `rgba(200,206,244,${alpha.toFixed(3)})`;
      ctx.lineWidth = (active ? 1.1 : 0.5 + e.weight * 0.08) * dpr;
      ctx.beginPath();
      ctx.moveTo(e.a.sx, e.a.sy);
      ctx.lineTo(e.b.sx, e.b.sy);
      ctx.stroke();
    }

    // nodes + names (near ones drawn last / on top)
    for (const n of order) {
      const isSel = n === selected;
      const isHover = n === hovered;
      const lit = isLit(n);
      const tw = 0.6 + 0.4 * Math.sin(n.phase + t / 900);
      const baseAlpha = lit ? 1 : 0.16;
      const nearFade = 0.55 + 0.45 * ((n.depth + 1) / 2); // dimmer when far

      // star
      const glow = (isSel ? 16 : isHover ? 12 : 7 * tw) * n.persp;
      ctx.globalAlpha = baseAlpha * nearFade;
      ctx.shadowColor = n.p.receiving ? "rgba(150,200,255,0.9)" : "rgba(232,196,118,0.9)";
      ctx.shadowBlur = glow * dpr;
      ctx.fillStyle = n.p.receiving ? "#bcd9ff" : "#f4e3b8";
      ctx.beginPath();
      ctx.arc(n.sx, n.sy, (isSel ? 4.5 : 3) * n.persp * dpr, 0, Math.PI * 2);
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

      // place caption — blue uppercase, on hover/select
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
    nodes, edges, get selected() { return selected; },
    get frames() { return frameCount; }, get lastError() { return lastError; },
  };

  return {
    selectParticipant(id) {
      select(id ? nodeById.get(id) ?? null : null);
    },
    refresh() { if (needsLayout()) layout(); },
  };
}
