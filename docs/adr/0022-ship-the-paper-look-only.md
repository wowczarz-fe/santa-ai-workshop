---
status: accepted
---

# 0022: Ship the paper look only

Date: 2026-11-19

Replaces the look-sharing part of 0008.

## Context

The game is going onto the company website, which hosts plain HTML and JavaScript files copied
into one folder. `game/` carried more than the game: a second, polished look behind
`?look=polish` with its own stylesheet and art (0008), three static design mock-ups in
`game/designs/`, an old text review page in `game/copy-review/` and the live text feedback page
for outside reviewers in `game/text-feedback/`. Players only ever see the paper look; the rest is
weight and confusion for whoever copies the folder.

## Considered options

- Keep both looks behind the hidden chooser. Rejected: nobody plays the polished look, and every
  page change had to keep two stylesheets in step.
- Fold the paper stylesheet into the base styles and drop the paper-only scoping. Rejected for
  now: the scoping is what lets the paper rules win over the base ones, so removing it changes
  which rule wins, and checking that across every state and screen width costs more than it saves.
- Ship the paper look only, keep the stylesheets as they are, and move everything that is not the
  game out of `game/`. Chosen.

## Decision

- `game/` holds the game and nothing else; its contents are what a website copies.
- The paper look is the only look. `polish.css`, `polish-art.js`, the hidden look chooser and the
  `look` address parameter are gone. The page still marks `body` with `data-look="paper"`, because
  the paper stylesheets are scoped to it.
- The design mock-ups and the old copy review page are deleted. They, and the polished look, stay
  on the branch `archive/before-paper-cleanup`.
- The text feedback page moves to `review/text-feedback/`. GitHub Pages still publishes the game
  at the site root and this page at `/text-feedback/`: the workflow stages both into one folder.
  The page borrows the game's `fonts.css`, fonts and logo through `../`, so the two keep that
  layout.

## Consequences

The bundle is the game's own files only. A change to the page now needs checking in one look.
The old addresses `/designs/` and `/copy-review/` on GitHub Pages stop working at the next
publish. Bringing the polished look back means restoring it from the archive branch.
