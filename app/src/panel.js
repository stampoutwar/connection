// Participant side panel: interview media, journey line, postcards.

export function initPanel(data, { onShowJourney, onClose }) {
  const panel = document.getElementById("panel");
  const content = document.getElementById("panel-content");
  const lightbox = document.getElementById("lightbox");
  const lightboxImg = document.getElementById("lightbox-img");

  document.getElementById("panel-close").addEventListener("click", close);
  lightbox.addEventListener("click", () => (lightbox.hidden = true));

  function journeyLine(p) {
    const hub = data.hub.name;
    const legs = p.receiving
      ? [data.hub.name, `${p.city}, ${p.country}`]
      : p.city.includes(hub)
        ? [p.city, data.destination.name]
        : [`${p.city}`, hub, data.destination.name];
    return legs
      .map((l) => `<span class="leg">${l}</span>`)
      .join('<span class="arrow">&#10148;</span>');
  }

  function mediaBlock(p) {
    const m = p.media;
    if (m.type === "video") {
      return `<div class="p-media"><video controls preload="metadata" src="${m.src}"></video></div>`;
    }
    if (m.type === "audio") {
      return `<div class="p-media"><audio controls preload="metadata" src="${m.src}"></audio></div>`;
    }
    return `
      <a class="p-article" href="${m.url}" target="_blank" rel="noopener">
        &ldquo;${m.title}&rdquo;
        <span class="read">Read the interview on the PTTF blog &#8599;</span>
      </a>`;
  }

  function open(p) {
    content.innerHTML = `
      <div class="p-name">${p.name}</div>
      <div class="p-place">${p.city} &middot; ${p.country}</div>
      <p class="p-bio">${p.bio}</p>
      <div class="p-journey">${journeyLine(p)}</div>
      <div class="p-section-title">${p.media.type === "article" ? "Their story" : "In their own words"}</div>
      ${mediaBlock(p)}
      ${
        p.postcards?.length
          ? `<div class="p-section-title">${p.receiving ? "Cards arriving at the front" : "Postcards they sent"}</div>
             <div class="p-postcards">${p.postcards
               .map((src) => `<img src="${src}" alt="Postcard by ${p.name}" loading="lazy" />`)
               .join("")}</div>`
          : ""
      }
      <div class="p-actions"><button id="btn-journey">See the journey on the globe</button></div>
    `;

    content.querySelectorAll(".p-postcards img").forEach((img) =>
      img.addEventListener("click", () => {
        lightboxImg.src = img.src;
        lightbox.hidden = false;
      })
    );
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
