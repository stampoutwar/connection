// Constellation of participants — names as stars on the night sky, joined by
// threads of what they share (country, interview circle, neighbouring routes).
// Clicking a name draws it to the centre and radiates its connections,
// echoing the museum kiosk in the reference video.

export function initConstellation(canvas, data, onSelect) {
  const ctx = canvas.getContext("2d");
  const { participants } = data;

  // --- graph ---------------------------------------------------------------
  const nodes = participants.map((p, i) => ({
    p,
    i,
    x: 0, y: 0,        // current (animated) position
    hx: 0, hy: 0,      // home position in the scattered sky
    r: 3,
    phase: Math.random() * Math.PI * 2,
  }));

  const edges = [];
  const seen = new Set();
  function link(a, b, kind) {
    const key = a.i < b.i ? `${a.i}-${b.i}` : `${b.i}-${a.i}`;
    if (seen.has(key)) return;
    seen.add(key);
    edges.push({ a, b, kind });
  }
  for (const a of nodes) {
    for (const b of nodes) {
      if (a.i >= b.i) continue;
      if (a.p.country === b.p.country) link(a, b, "country");
      if (a.p.circle === b.p.circle) link(a, b, "circle");
    }
  }
  // Longitude neighbours — postcards that share a stretch of sky on their way east.
  const byLng = [...nodes].sort((a, b) => a.p.lng - b.p.lng);
  for (let i = 0; i < byLng.length - 1; i++) link(byLng[i], byLng[i + 1], "route");

  const neighbours = (n) =>
    edges.filter((e) => e.a === n || e.b === n).map((e) => (e.a === n ? e.b : e.a));

  // --- layout ---------------------------------------------------------------
  let W = 0, H = 0;
  function needsLayout() {
    return (
      canvas.width !== Math.round(canvas.clientWidth * devicePixelRatio) ||
      canvas.height !== Math.round(canvas.clientHeight * devicePixelRatio)
    );
  }
  function layout(snap = false) {
    W = canvas.width = Math.round(canvas.clientWidth * devicePixelRatio);
    H = canvas.height = Math.round(canvas.clientHeight * devicePixelRatio);
    // Scatter on a loose golden-angle spiral so names never collide badly.
    const cx = W * 0.5, cy = H * 0.52;
    const maxR = Math.min(W, H) * 0.4;
    nodes.forEach((n, k) => {
      const t = (k + 1) / nodes.length;
      const ang = k * 2.39996 + 0.7;
      const rad = maxR * (0.35 + 0.65 * Math.sqrt(t));
      n.hx = cx + Math.cos(ang) * rad * 1.25;
      n.hy = cy + Math.sin(ang) * rad * 0.8;
      if (!started || snap) { n.x = n.hx; n.y = n.hy; }
    });
    if (selected) applyFocusTargets(selected);
  }

  // --- selection ------------------------------------------------------------
  let selected = null;
  let hovered = null;
  const targets = new Map(); // node -> {x, y}

  function applyFocusTargets(sel) {
    targets.clear();
    const cx = W * 0.32, cy = H * 0.5; // leave room for the side panel
    targets.set(sel, { x: cx, y: cy });
    const ring = neighbours(sel);
    const R = Math.min(W, H) * 0.33;
    ring.forEach((n, k) => {
      const ang = (k / ring.length) * Math.PI * 2 - Math.PI / 2;
      const wobble = k % 2 ? 1.0 : 1.22; // alternate radii so names don't collide
      targets.set(n, { x: cx + Math.cos(ang) * R * 1.15 * wobble, y: cy + Math.sin(ang) * R * wobble });
    });
  }

  function select(node) {
    selected = node;
    if (node) applyFocusTargets(node);
    else targets.clear();
  }

  // --- interaction ----------------------------------------------------------
  function nodeAt(mx, my) {
    const dpr = devicePixelRatio;
    const x = mx * dpr, y = my * dpr;
    const pad = 14 * dpr; // generous halo around both the star and its name
    let best = null, bestD = Infinity;
    for (const n of nodes) {
      const dDot = Math.hypot(n.x - x, n.y - y);
      const r = n.hit; // label bounds captured during the last draw
      const inLabel =
        r && x >= r.x - pad && x <= r.x + r.w + pad && y >= r.y - pad && y <= r.y + r.h + pad;
      if (!inLabel && dDot > 46 * dpr) continue;
      const d = inLabel
        ? Math.min(dDot, Math.hypot(r.x + r.w / 2 - x, r.y + r.h / 2 - y))
        : dDot;
      if (d < bestD) { best = n; bestD = d; }
    }
    return best;
  }

  canvas.addEventListener("pointermove", (e) => {
    const r = canvas.getBoundingClientRect();
    hovered = nodeAt(e.clientX - r.left, e.clientY - r.top);
    canvas.style.cursor = hovered ? "pointer" : "default";
  });

  canvas.addEventListener("click", (e) => {
    const r = canvas.getBoundingClientRect();
    const n = nodeAt(e.clientX - r.left, e.clientY - r.top);
    if (n) {
      select(n);
      onSelect(n.p.id);
    } else {
      select(null);
      onSelect(null);
    }
  });

  // --- render ---------------------------------------------------------------
  let started = false;
  let frameCount = 0;
  let lastError = null;
  function frame(t) {
    try {
      frameInner(t);
    } catch (err) {
      lastError = String(err.stack || err);
    }
    requestAnimationFrame(frame);
  }
  function frameInner(t) {
    started = true;
    frameCount++;
    // Self-heal if the canvas size changed without a resize event firing
    // (tab opened at a new size, window resized while hidden, etc.).
    if (needsLayout()) layout(true);
    ctx.clearRect(0, 0, W, H);
    const dpr = devicePixelRatio;

    // ease nodes toward their targets (focus ring) or home
    for (const n of nodes) {
      const tgt = targets.get(n) || { x: n.hx, y: n.hy };
      const drift = targets.has(n) || !selected ? 1 : 0.35; // unrelated stars recede
      n.x += (tgt.x - n.x) * 0.06;
      n.y += (tgt.y - n.y) * 0.06;
      n.alphaTarget = selected ? (targets.has(n) ? 1 : 0.18) : 1;
      n.alpha = (n.alpha ?? 1) + ((n.alphaTarget - (n.alpha ?? 1)) * 0.08) * drift;
    }

    // edges
    for (const e of edges) {
      const active =
        (selected && (e.a === selected || e.b === selected)) ||
        (!selected && hovered && (e.a === hovered || e.b === hovered));
      const dim = selected && !(e.a === selected || e.b === selected);
      ctx.strokeStyle = active ? "rgba(236,234,251,0.75)" : "rgba(236,234,251,0.16)";
      ctx.lineWidth = (active ? 1.1 : 0.6) * dpr;
      ctx.globalAlpha = dim ? 0.25 : 1;
      ctx.beginPath();
      ctx.moveTo(e.a.x, e.a.y);
      ctx.lineTo(e.b.x, e.b.y);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;

    // nodes + names
    for (const n of nodes) {
      const isSel = n === selected;
      const isHover = n === hovered;
      const tw = 0.6 + 0.4 * Math.sin(n.phase + t / 900);
      const glow = isSel ? 16 : isHover ? 12 : 7 * tw;

      ctx.globalAlpha = n.alpha ?? 1;
      ctx.shadowColor = n.p.receiving ? "rgba(150,200,255,0.9)" : "rgba(232,196,118,0.9)";
      ctx.shadowBlur = glow * dpr;
      ctx.fillStyle = n.p.receiving ? "#bcd9ff" : "#f4e3b8";
      ctx.beginPath();
      ctx.arc(n.x, n.y, (isSel ? 5 : 3.2) * dpr, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;

      const fs = (isSel ? 34 : isHover ? 24 : 19) * dpr;
      ctx.font = `500 ${fs}px "Cormorant Garamond", Georgia, serif`;
      ctx.fillStyle = "#eceafb";
      // Ring members get their name pushed radially outward from the selected
      // star so labels never collide with its large title.
      let lx = n.x, ly = n.y - (isSel ? 18 : 12) * dpr, align = "center";
      if (selected && !isSel && targets.has(n)) {
        const dx = n.x - selected.x, dy = n.y - selected.y;
        const len = Math.hypot(dx, dy) || 1;
        const ux = dx / len, uy = dy / len;
        lx = n.x + ux * 24 * dpr;
        ly = n.y + uy * 24 * dpr + 7 * dpr;
        align = ux > 0.35 ? "left" : ux < -0.35 ? "right" : "center";
      }
      ctx.textAlign = align;
      ctx.fillText(n.p.name, lx, ly);
      // Remember where the name was drawn so clicks anywhere on it (not just
      // the star) select this participant.
      const textW = ctx.measureText(n.p.name).width;
      const rx = align === "left" ? lx : align === "right" ? lx - textW : lx - textW / 2;
      n.hit = { x: rx, y: ly - fs, w: textW, h: fs * 1.2 };
      ctx.textAlign = "center";

      if (isSel || isHover) {
        ctx.font = `300 ${11 * dpr}px "Jost", sans-serif`;
        ctx.fillStyle = "rgba(232,196,118,0.95)";
        ctx.fillText(`${n.p.city} · ${n.p.country}`.toUpperCase(), n.x, n.y + 24 * dpr);
      }
      ctx.globalAlpha = 1;
    }
  }

  window.addEventListener("resize", () => layout());
  if (typeof ResizeObserver !== "undefined") {
    new ResizeObserver(() => { if (needsLayout()) layout(); }).observe(canvas);
  }
  layout();
  requestAnimationFrame(frame);

  canvas.__debug = {
    nodes, edges,
    get selected() { return selected; },
    get started() { return started; },
    get frames() { return frameCount; },
    get lastError() { return lastError; },
  };

  return {
    selectParticipant(id) {
      select(id ? nodes.find((n) => n.p.id === id) ?? null : null);
    },
    refresh() {
      if (needsLayout()) layout(true);
    },
  };
}
