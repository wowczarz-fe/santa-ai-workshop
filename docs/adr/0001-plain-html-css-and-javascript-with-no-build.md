---
status: accepted
---

# 0001: Plain HTML, CSS and JavaScript with no build

## Context

The game arrived as one HTML file with its styles and script on a handful of lines thousands of
characters long. Agents will change it from player feedback, often two at a time in separate
worktrees. With lines that long, any two changes collide and a one-word edit shows up as a diff of
the whole line. The game is a prototype, and players must be able to open it straight from disk as
well as from a hosted page.

## Considered options

- Keep one HTML file. Rejected because every change lands in the same file, and the game rules
  cannot be loaded on their own.
- TypeScript with Astro, built into one file. Rejected for now because it adds about 290 packages
  and a build step between every change and every player, for a 62 KB game that uses no Astro
  feature. A type check would catch a page that fails to load, which the chosen option cannot.
- Four plain files with no build, formatted by Prettier. Chosen because the files in the repo are
  the files the player opens, and formatting alone removes most collisions.

## Decision

The game lives in `game/`: `index.html`, `style.css`, `workshop.js` (the rules) and `game.js` (the
page), loaded with plain `<script src>` tags. Prettier formats everything; a pre-commit hook and
`npx prettier --check .` enforce it. There are no tests yet.

## Consequences

The scripts are plain scripts, not JavaScript modules, because a browser refuses to load a module
from a file opened off disk. `workshop.js` therefore shares `class Workshop` with `game.js` as a
global name. Nothing checks that the game still works: a change is verified by playing it. Tests on
`workshop.js` and a type check are the next steps once changes start to merge unplayed.
