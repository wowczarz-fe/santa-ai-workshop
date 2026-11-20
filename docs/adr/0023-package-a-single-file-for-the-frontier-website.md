---
status: accepted
---

# 0023: Package a single file for the Frontier website

Date: 2026-11-19

## Context

The game is to appear on the Frontier Economics website, an Umbraco site that shows it in an
iframe. An editor uploads the files by hand, sub-folders are recreated by hand, and the hosting
company prefers one self-contained HTML file. The game is built as many plain files with no build
(ADR 0001), and agents keep changing those files.

## Considered options

- Turn the source into one file. Rejected: it brings back the collisions ADR 0001 removed.
- Add a bundler. Rejected: a dependency and a build step for what is copying text into a page.
- Keep the source as it is and add a packaging script. Chosen.

## Decision

`npm run package` runs `scripts/package-website.js`, plain Node with no dependencies. It reads the
stylesheet and script tags in `game/index.html` and writes one file, `dist/website/index.html`,
with every stylesheet, script, font and image inside it. The website's policy allows inline styles
and `data:` fonts, so no other version is needed. It fails when the page names a file it cannot find. `game/height.js`, the
hosting company's script, tells the website the game's height and does nothing outside a frame.

## Consequences

GitHub Pages and the files on disk stay the source; the website copy is made from them on demand
and is not committed. A file the game builds a path to while it runs cannot be followed by the
script, which reports it as an error.
