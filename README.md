# santa-ai-workshop

Santa's AI Workshop: a browser game where you run Santa's workshop and keep its
AI in check.

Play: run `uv run python -m http.server 8000 --directory game` and open <http://localhost:8000/>.
With a browser on the same machine as the files, opening `game/index.html` from disk works too.

## Play online

Address: <https://wowczarz-fe.github.io/santa-ai-workshop/>

Three design directions for testers to compare, as static mock-ups in `game/designs/`:
<https://wowczarz-fe.github.io/santa-ai-workshop/designs/>

Every push to `main` publishes the `game/` folder exactly as it is, through the
[`publish-game.yml`](.github/workflows/publish-game.yml) workflow. There is no build step. To
publish again without a new push, run "Publish game" by hand from the repository's Actions tab.

Publishing needs GitHub Pages switched on once: in the repository's Settings, under Pages, set the
source to "GitHub Actions". Who can open the site depends on the repository: a public site is open
to anyone who has the address.

Working on the game with an agent: start at [`AGENTS.md`](AGENTS.md).
