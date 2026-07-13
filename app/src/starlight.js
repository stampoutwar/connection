// Starlights — the Defenders' collective gallery. A near-black room where
// arrival photos hang as softly glowing tiles ("every card is a ray of
// sunshine in the kingdom of darkness" — Defender Vadym). Tiles kindle one
// by one the first time the view opens; clicking a photo opens the shared
// lightbox with the newsletter's published caption.

export function initStarlight(container) {
  const lightbox = document.getElementById("lightbox");
  const lightboxImg = document.getElementById("lightbox-img");
  const lightboxCap = document.getElementById("lightbox-cap");

  let built = false;
  let kindled = false;

  async function build() {
    let doc;
    try {
      doc = await (await fetch("data/defenders.json")).json();
    } catch {
      container.innerHTML = "";
      return;
    }
    const wall = document.createElement("div");
    wall.className = "sl-wall";
    for (const e of doc.entries || []) {
      if (e.quote) {
        const q = document.createElement("figure");
        q.className = "sl-tile sl-quote";
        q.innerHTML =
          `<blockquote>&ldquo;${e.quote}&rdquo;</blockquote>` +
          `<figcaption>&mdash; ${e.attribution}</figcaption>`;
        wall.appendChild(q);
      } else {
        const t = document.createElement("figure");
        t.className = "sl-tile sl-photo";
        t.innerHTML =
          `<img src="${e.src}" alt="${e.caption}" loading="lazy" />` +
          `<figcaption>${e.date || ""}</figcaption>`;
        t.querySelector("img").addEventListener("click", () => {
          lightboxImg.src = e.src;
          lightboxCap.textContent = e.date ? `${e.date} — ${e.caption}` : e.caption;
          lightbox.hidden = false;
        });
        wall.appendChild(t);
      }
    }
    container.appendChild(wall);
    built = true;
  }

  // Stagger the tiles' first appearance: the room "comes on" like stars at
  // dusk. Runs once, the first time the view is shown.
  function kindle() {
    if (kindled) return;
    kindled = true;
    const tiles = [...container.querySelectorAll(".sl-tile")];
    // Kindle in a gently shuffled order so lighting spreads, not sweeps.
    const order = tiles
      .map((el, i) => ({ el, k: (i * 7919) % tiles.length }))
      .sort((a, b) => a.k - b.k);
    order.forEach(({ el }, i) => {
      setTimeout(() => el.classList.add("lit"), 90 * i + Math.random() * 60);
    });
  }

  build();

  return {
    refresh() {
      if (built) kindle();
      else {
        // data may still be loading on first show; kindle once it lands
        const wait = setInterval(() => {
          if (built) { clearInterval(wait); kindle(); }
        }, 120);
      }
    },
  };
}
