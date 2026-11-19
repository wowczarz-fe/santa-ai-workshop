# santa-ai-workshop

Santa's AI Workshop: a browser game where you run Santa's workshop and keep its
AI in check.

Play: run `uv run python -m http.server 8000 --directory game` and open <http://localhost:8000/>.
With a browser on the same machine as the files, opening `game/index.html` from disk works too.

## Play online

Address: <https://wowczarz-fe.github.io/santa-ai-workshop/>

Text feedback page for outside reviewers:
<https://wowczarz-fe.github.io/santa-ai-workshop/text-feedback/>

Every push to `main` publishes the `game/` folder at the site root and `review/text-feedback/` at
`/text-feedback/`, through the
[`publish-game.yml`](.github/workflows/publish-game.yml) workflow. There is no build step. To
publish again without a new push, run "Publish game" by hand from the repository's Actions tab.

Publishing needs GitHub Pages switched on once: in the repository's Settings, under Pages, set the
source to "GitHub Actions". Who can open the site depends on the repository: a public site is open
to anyone who has the address.

## Deploy to the website

The game is the contents of `game/` and nothing else: `index.html`, `fonts.css`, `style.css`,
`paper.css`, `station-flow.css`, `workshop.js`, `paper-art.js`, `shared-art.js`, `station-flow.js`,
`game.js`, `frontier-logo-white.png` and the `fonts/` folder (five `.woff2` files with their
licence texts). About 0.7 MB. `review/`, `tests/` and `docs/` are not needed.

1. Try it first: `uv run python -m http.server 8000 --directory game` and open
   <http://localhost:8000/>.
2. In Umbraco, create a folder for the game in Media › Interactives.
3. Upload every file above to that folder, with `index.html` at its top. Create a `fonts`
   sub-folder by hand and upload the five `.woff2` files into it. Keep every file name as it is:
   the page finds its files by name and relative path.
4. Show the folder's `index.html` in an "Interactive block". The game needs no extra iframe
   permissions on the site's own domain.

Hosting notes:

- Every path is relative and nothing is fetched from elsewhere: the fonts are in the folder. The
  only outside addresses are the two Frontier links on the end screen, which open in a new tab.
- It works from a sub-folder, inside a frame and opened from disk.
- It keeps five small `localStorage` entries on the site's domain, all named `workshop-...`: best
  stars, blunders seen, walkthrough done, the reduce-motion choice, and an old one it deletes.
- Content Security Policy: no inline scripts or event handlers, but its drawings use `style`
  attributes, so a policy needs `style-src-attr 'unsafe-inline'`, plus `img-src 'self' data:`.
- The `?v=` tags in `index.html` only matter on a host that keeps old copies; Umbraco gives every
  upload a new address anyway.
- "Copy result" shares a link to the game file itself, not the article page around it.

Working on the game with an agent: start at [`AGENTS.md`](AGENTS.md).

## Publish on the Frontier website

The Frontier website shows the game in an Interactive block. Its editor uploads the files into a
folder under Media › Interactives.

1. Run `npm run package`. It writes three versions to `dist/website/`, each with a zip beside it,
   and stops with an error if a file the page names is missing.
2. Send the editor `dist/website/single/index.html`, one file that holds the whole game. If the
   website's security policy blocks fonts written into the page, send
   `single-with-font-files/` instead: `index.html` plus a `fonts/` folder. `folder/` is a plain
   copy of the game's files, for when one large file is a problem.
3. Send `website/preview-800x600.png` separately, as the picture phone visitors see.
4. Ask for these block settings: title "Santa's AI Workshop", Display Mode `fullScreenButton`,
   Aspect Ratio `fixed` at about 800 px high, Lazy Load off if the block sits at the top of the
   page, Mobile Breakpoint left empty.

To update the game, run `npm run package` again and send the new file or files. Every upload
gets a new address, so the page needs no cache tags. Why the website gets a packed copy:
[ADR 0023](docs/adr/0023-package-a-single-file-for-the-frontier-website.md).
