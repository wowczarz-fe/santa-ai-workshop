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

Working on the game with an agent: start at [`AGENTS.md`](AGENTS.md).

## Publish on the Frontier website

The Frontier website shows the game in an Interactive block, from a folder under Media ›
Interactives.

1. Run `npm run package`. It writes `dist/website/index.html`, one file that holds the whole game:
   every stylesheet, script, font and image. It stops with an error if a file the page names is
   missing.
2. Send the editor that file, and `website/preview-800x600.png` separately as the picture phone
   visitors see.
3. Ask for these block settings: title "Santa's AI Workshop", Display Mode `fullScreenButton`,
   Aspect Ratio `fixed` at 800 px high, Lazy Load off if the block sits at the top of the page,
   Mobile Breakpoint left empty.

To update the game, run `npm run package` again and upload the new `index.html` onto the old one,
under the same name.

Hosting notes:

- Nothing is fetched from elsewhere. The only outside addresses are the two Frontier links on the
  end screen, which open in a new tab.
- The website's security policy must allow inline styles (`style-src 'unsafe-inline'`, the drawings
  also use `style` attributes) and `data:` fonts and images.
- It keeps five small `localStorage` entries on the site's domain, all named `workshop-...`: best
  stars, blunders seen, walkthrough done, the reduce-motion choice, and an old one it deletes.
- "Copy result" shares a link to the game file itself, not the article page around it.

Why the website gets a packed copy:
[ADR 0023](docs/adr/0023-package-a-single-file-for-the-frontier-website.md).
