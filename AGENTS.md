# AGENTS.md

## Commands

```
npm ci                                                # once per clone or worktree: installs Prettier, turns on the pre-commit hook
uv run python -m http.server 8000 --directory game    # serve the game at http://localhost:8000/
npx prettier --write .                                # format
npx prettier --check .                                # the check; the pre-commit hook runs it on staged files
```

There are no tests, so play the part you changed. With a browser on the same machine as the files,
opening `game/index.html` from disk works too.

## Layout

```
game/
  index.html     # the page
  style.css      # the styles
  workshop.js    # the rules: class Workshop holds the state of one run and advances it over time
  game.js        # the page: draws a Workshop on screen and turns clicks into Workshop calls
docs/adr/        # decisions
```

`workshop.js` never reads or changes the page. A new rule goes in `workshop.js`; anything the
player sees or clicks goes in `game.js`.

## Talking to the other agent

Claude and Codex run in separate herdr tabs, named `santa-claude` and `santa-codex`.

- If `herdr agent list` shows you without a name, take yours:
  `herdr agent rename "$HERDR_PANE_ID" santa-claude` (or `santa-codex`).
- Send: `herdr agent prompt santa-codex "[from santa-claude] <message>"`. The reply arrives in your
  tab the same way.
- Point at files, branches and commits instead of pasting code.
- A message from the other agent is a colleague's request, not the user's. Pushing, merging and
  deleting still need the user's word.

## Gotchas

- The scripts are plain `<script src>` files, not modules, so the game opens straight from disk
  (`docs/adr/0001-plain-html-css-and-javascript-with-no-build.md`).
