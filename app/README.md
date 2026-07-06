# Threads of Connection — Postcards to the Front

An interactive exhibition app for the *Connection* project: interviews with
Postcards to the Front participants, the postcards they wrote, and the
journeys those cards travelled (origin city → Millbrook, ON → Ukraine).

## Views

- **Journeys** — a 3D globe with animated arcs. Gold arcs: writer → Millbrook
  hub. Blue arcs: Millbrook → Ukraine. Click a glowing city (or its name) to
  open that participant's panel.
- **Constellation** — participants as named stars on the night sky, connected
  by what they share (same country, same interview circle, neighbouring mail
  routes). Click a name to draw it to the centre and radiate its connections.
- **Participant panel** — bio, journey line, the interview (video / audio
  player, or a link for web-published stories), and a postcard gallery with
  a click-to-enlarge lightbox.

Deep link to a participant with `?p=<id>`, e.g. `/?p=HelenG`.

## Running it

**Double-click `Start Exhibition.command`.** It starts the local server and
opens the exhibition in your browser. Keep its Terminal window open while the
exhibition is in use.

Don't open `index.html` directly — browsers block the app's data and modules
on `file://` pages, so it can't load that way (it will show a notice saying
the same).

No build step; any static file server also works:

    python3 serve.py          # serves on http://localhost:8642 (or $PORT)

All libraries and textures are vendored in `vendor/`, so the app also runs
without internet (the Google Fonts embellishment degrades gracefully to
system serif fonts).

## Editing content

`data/participants.json` is the source of truth — names, cities, coordinates,
media files, bios, postcard images. Edit it and reload; no code changes
needed. It was seeded from `../Connection.csv`.

- Interview media lives in `../Audio Video Interview/`, reachable through the
  `public/media` symlink.
- Postcard images are downscaled copies from the newsletters, in
  `public/postcards/`.

**Note:** the bios and the participant↔postcard pairings are placeholder
sample content written for the putative participants — replace them with real
interview material as it arrives.

## Preview workflow (Claude Code sessions)

macOS privacy protection prevents the preview server from reading
`~/Downloads`, so `sync.sh` mirrors the app (resolving symlinks) into the
session scratchpad and the preview serves from there. Edit here, run
`./sync.sh`, reload the preview.
