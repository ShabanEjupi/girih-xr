# Girih XR

**A seated, hands-only puzzle of Islamic geometric tiles, for Meta Quest in the browser (WebXR).**

Live: https://girih-xr.spacecode.tech · Built for the Meta Connect 2026 VR Start developer competition.

Girih tiles are the five shapes medieval craftsmen used to lay out the star patterns on mosques and madrasas: a decagon, a pentagon, a rhombus, a bowtie and an elongated hexagon. Every edge has the same length and every angle is a multiple of 36°, so the tiles fit together in endless ways, and a line drawn through their edge midpoints becomes one continuous star pattern.

In Girih XR the tiles lie on a table in front of you:

- **Pinch** a tile with thumb and index finger to pick it up.
- **Turn your wrist** like a dial to rotate it. It clicks through 36° steps, with a soft tick for each one.
- **Release** it over its place. If the shape and the angle are right, it snaps in with a chime.
- Fill every place and the hidden girih lines light up across the whole pattern. Three patterns, a few minutes each.
- Not every tile in the tray belongs in the pattern: the decoys teach you to read the shapes.

No controllers, no standing, no reading needed. Taking the headset off pauses the game, and every placed tile is saved, so you can continue later. The interface is in English and Albanian.

The same puzzle runs in any browser with a mouse or touch screen (drag, then scroll, Q / E or the ⟲ ⟳ buttons to rotate).

## How it works

- `girih.js`: the geometry. Tiles are built by a turtle walk from their interior angles, levels are made by attaching tiles edge to edge, and a separating-axis test checks that no two places overlap.
- `app.js`: three.js scene, WebXR session with the `hand-tracking` feature, pinch detection with hysteresis (1.8 cm to grab, 3.5 cm to let go), and the wrist heading from the index and little-finger knuckles projected onto the table.
- No build step and no runtime dependencies besides three.js r169, which is vendored in `vendor/`.

## Tests

- `node test/girih.test.mjs`: geometry invariants (unit edges, closed outlines, no overlaps, snapping rules).
- `test/ui.mjs` (Playwright): solves all three patterns with a mouse on desktop and phone sizes.
- `test/hands.mjs` (Playwright + Meta's [Immersive Web Emulation Runtime](https://github.com/meta-quest/immersive-web-emulation-runtime)): enters VR on an emulated Quest 3 with hand tracking, pinches each tile, carries it, turns the wrist until it faces the right way, releases it, and checks that it snapped and that the next pattern opened. Copy `node_modules/iwer/build/iwer.module.js` from `iwer@2.7.0` to `test/` first.

## Run it

Serve the folder with any static web server, for example `python3 -m http.server`, and open it. WebXR needs HTTPS (or localhost).

## Shqip — përmbledhje

**Girih XR** është enigmë me pllaka gjeometrike islame (girih), që luhet ulur dhe vetëm me duar, me syze Meta Quest në shfletues (WebXR). Kape pllakën me dy gishta, rrotulloje duke kthyer kyçin e dorës (me hapa 36°), dhe lëshoje në vendin e saj. Kur plotësohet modeli, ndizen vijat girih në të gjithë yllin. Heqja e syzeve e ndal lojën, dhe çdo pllakë e vendosur ruhet. Luhet edhe me mi ose me prekje në çdo shfletues.

## License

MIT, see `LICENSE`.
