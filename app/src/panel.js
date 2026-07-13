// Participant side panel: interview media, journey line, postcards.

export function initPanel(data, { onShowJourney, onClose }) {
  const panel = document.getElementById("panel");
  const content = document.getElementById("panel-content");
  const lightbox = document.getElementById("lightbox");
  const lightboxImg = document.getElementById("lightbox-img");
  const lightboxCap = document.getElementById("lightbox-cap");

  document.getElementById("panel-close").addEventListener("click", close);
  lightbox.addEventListener("click", () => (lightbox.hidden = true));

  // Build the readable path from the participant's computed journey legs:
  // e.g. Montreal → Millbrook → Western Ukraine.
  function journeyLine(p) {
    if (!p.journey || !p.journey.length) {
      return `<span class="leg">${cityShort(p.city)}</span>`;
    }
    const stops = [p.journey[0].from, ...p.journey.map((l) => l.to)];
    return stops
      .map((s) => `<span class="leg">${s}</span>`)
      .join('<span class="arrow">&#10148;</span>');
  }
  const cityShort = (c) => (c || "").replace(/\s*\([^)]*\)/g, "").split(",")[0].trim();

  function mediaBlock(p) {
    const m = p.media;
    if (!m) return postcardBack(p); // postcard-only: quote from their cards
    if (m.type === "video") {
      return `<div class="p-media"><video controls preload="metadata" src="${m.src}"></video></div>`;
    }
    if (m.type === "audio") {
      return `<div class="p-media"><audio controls preload="metadata" src="${m.src}"></audio></div>`;
    }
    return postcardBack(p);
  }

  // Written interviews render as the back of a postcard: pull-quote in the
  // message area, portrait (or a decorative stamp) in the stamp corner, the
  // participant's city as the postmark, context line, and the blog link.
  function postcardBack(p) {
    const m = p.media;
    const stamp = p.portrait
      ? `<img class="pb-portrait" src="${p.portrait}" alt="Portrait of ${p.name}"${
          p.portraitPosition ? ` style="object-position:${p.portraitPosition}"` : ""
        } />`
      : `<span class="pb-stamp-art" aria-hidden="true">&#9993;</span>`;
    return `
      <div class="p-postcard-back">
        <div class="pb-row">
          <blockquote class="pb-quote">&ldquo;${p.pullQuote || m?.title || ""}&rdquo;</blockquote>
          <div class="pb-corner">
            <div class="pb-stamp">${stamp}</div>
            <div class="pb-postmark"><span>${cityShort(p.city)}</span></div>
          </div>
        </div>
        ${p.quoteContext ? `<p class="pb-context">${p.quoteContext}</p>` : ""}
        ${m?.url ? `<a class="pb-read" href="${m.url}" target="_blank" rel="noopener">Read the full interview &#8594;</a>` : ""}
      </div>`;
  }

  function open(p) {
    content.innerHTML = `
      <div class="p-name">${p.name}</div>
      <div class="p-place">${p.city} &middot; ${p.country}</div>
      <p class="p-bio">${p.bio}</p>
      <div class="p-journey">${journeyLine(p)}</div>
      ${
        p.media || p.pullQuote
          ? `<div class="p-section-title">${p.media?.type === "article" ? "Their story" : "In their own words"}</div>
             ${mediaBlock(p)}`
          : ""
      }
      ${
        p.postcards?.length
          ? `<div class="p-section-title">${p.receiving ? "Cards arriving at the front" : "Postcards they sent"}</div>
             <div class="p-postcards">${p.postcards
               .map((src, i) => {
                 // photoPositions (parallel to postcards) nudges the thumbnail
                 // crop so faces in people-photos stay in frame.
                 const pos = p.photoPositions?.[i];
                 return `<img src="${src}" alt="Postcard by ${p.name}" loading="lazy"${
                   pos ? ` style="object-position:${pos}"` : ""
                 } />`;
               })
               .join("")}</div>`
          : ""
      }
      ${
        p.defenderReplies?.length
          ? `<div class="p-section-title">A reply from the front</div>
             <div class="p-postcards p-replies">${p.defenderReplies
               .map((src) => `<img src="${src}" alt="Reply from a Defender" loading="lazy" />`)
               .join("")}</div>`
          : ""
      }
      <div class="p-actions"><button id="btn-journey">See the journey on the globe</button></div>
    `;

    content.querySelectorAll(".p-postcards img").forEach((img) =>
      img.addEventListener("click", () => {
        lightboxImg.src = img.src;
        lightboxCap.textContent = ""; // captions belong to the Starlights view
        lightbox.hidden = false;
      })
    );
    // The stamp portrait opens full-size in the lightbox too — the stamp
    // crop is tiny, so visitors can see the person properly.
    const stampPortrait = content.querySelector(".pb-portrait");
    if (stampPortrait) {
      stampPortrait.addEventListener("click", () => {
        lightboxImg.src = stampPortrait.src;
        lightboxCap.textContent = "";
        lightbox.hidden = false;
      });
    }
    content.querySelector("#btn-journey").addEventListener("click", () => onShowJourney(p.id));

    panel.classList.add("open");
    panel.setAttribute("aria-hidden", "false");
  }

  function close() {
    // Stop any playing media when the panel slides away.
    content.querySelectorAll("video, audio").forEach((el) => el.pause());
    panel.classList.remove("open");
    panel.setAttribute("aria-hidden", "true");
    onClose();
  }

  return { open, close };
}
