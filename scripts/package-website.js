// Packs the game into one file for the Frontier website, dist/website/index.html (ADR 0023):
// npm run package
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const game = path.join(root, "game");
const out = path.join(root, "dist", "website");

const mediaTypes = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".woff2": "font/woff2",
  ".woff": "font/woff",
  ".ttf": "font/ttf",
  ".otf": "font/otf",
};

// The three ways a file names another: url(...) in CSS, src= or href= in HTML, and a quoted asset
// name in a script. One pattern, so a reference is rewritten once even where two would match.
const reference = new RegExp(
  [
    /url\(\s*(["']?)([^"')]*)\1\s*\)/.source,
    /\b(src|href)\s*=\s*(["'])([^"']*)\4/.source,
    /(["'`])([^"'`\s<>()]+\.(?:png|jpe?g|gif|webp|svg|woff2?|ttf|otf)(?:\?[^"'`\s]*)?)\6/
      .source,
  ].join("|"),
  "g",
);
const elsewhere = /^(?:[a-z][a-z0-9+.-]*:|\/\/|#)/i; // data:, https:, mailto:, a fragment
const linkedFile =
  /<link\b[^>]*\brel=["']?stylesheet\b[^>]*>|<script\b[^>]*\bsrc=[^>]*>\s*<\/script>/gi;

const problems = [];

// Builds the page with every stylesheet, script and asset written into it.
function build() {
  // Rewrites every reference in `text`, whose paths start from `dir` (relative to game/).
  function rewrite(text, owner, dir) {
    return text.replace(
      reference,
      (match, q1, url, attr, q2, attrValue, q3, literal) => {
        const target = url ?? attrValue ?? literal;
        if (target === "" || elsewhere.test(target)) return match;
        const local = resolve(target, owner, dir);
        if (local === null) return match;
        if (/\.(css|js|html)$/.test(local)) {
          problems.push(
            `${owner}: "${target}" names a page, stylesheet or script outside index.html's tags`,
          );
          return match;
        }
        const replacement = `data:${mediaTypes[path.extname(local)]};base64,${read(local).toString("base64")}`;
        if (url !== undefined) return `url("${replacement}")`;
        if (attr !== undefined) return `${attr}=${q2}${replacement}${q2}`;
        return `${q3}${replacement}${q3}`;
      },
    );
  }

  let page = read("index.html", "utf8");
  const tags = [];
  page = page.replace(linkedFile, (tag) => `\u0000${tags.push(tag) - 1}\u0000`);
  page = rewrite(page, "index.html", ".");
  page = page.replace(/\u0000(\d+)\u0000/g, (_, i) => {
    const tag = tags[i];
    const target = tag.match(/\b(?:href|src)=["']?([^"'\s>]+)/i)[1];
    if (elsewhere.test(target)) return tag;
    const local = resolve(target, "index.html", ".");
    if (local === null) return tag;
    const script = /^<script/i.test(tag);
    const text = rewrite(read(local, "utf8"), local, base(local));
    if (script)
      return `<script>\n${text.replace(/<\/(script)/gi, "<\\/$1").replace(/<!--/g, "<\\!--")}</script>`;
    if (/<\/style/i.test(text))
      problems.push(
        `${local} contains "</style", which would end the inlined stylesheet early`,
      );
    return `<style>\n${text}</style>`;
  });
  return page;
}

// The path of a local file relative to game/, or null after recording why it cannot be used.
function resolve(target, owner, dir) {
  if (
    target.includes("${") ||
    target.includes("'+") ||
    target.includes("' +")
  ) {
    problems.push(
      `${owner}: "${target}" is built while the game runs, so the packager cannot follow it`,
    );
    return null;
  }
  if (target.startsWith("/")) {
    problems.push(
      `${owner}: "${target}" starts at the site root; the website needs relative paths`,
    );
    return null;
  }
  const local = path.posix.normalize(
    path.posix.join(dir, target.replace(/[?#].*$/, "")),
  );
  const file = path.join(game, local);
  if (
    local.startsWith("../") ||
    !fs.existsSync(file) ||
    !fs.statSync(file).isFile()
  ) {
    problems.push(`${owner}: cannot find "${target}"`);
    return null;
  }
  return local;
}

// Stylesheets resolve paths against themselves; scripts resolve them against the page.
const base = (local) =>
  local.endsWith(".css") ? path.posix.dirname(local) : ".";

function read(local, encoding) {
  return fs.readFileSync(path.join(game, local), encoding);
}

const page = build();

if (problems.length) {
  for (const problem of new Set(problems)) console.error(`error: ${problem}`);
  process.exit(1);
}

fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });
fs.writeFileSync(path.join(out, "index.html"), page);
console.log(
  `${path.relative(root, path.join(out, "index.html"))}  ${(Buffer.byteLength(page) / 1024).toFixed(1)} KB`,
);
