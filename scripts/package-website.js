// Packs the game for the Frontier website into dist/website/ (ADR 0023): npm run package
const fs = require("fs");
const path = require("path");
const zip = require("./write-zip");

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
const isFont = (file) => mediaTypes[path.extname(file)]?.startsWith("font/");

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

// Builds one output as a Map of path -> Buffer.
// inline: false copies each file; "all" turns stylesheets, scripts and assets into the page;
// "keep-fonts" does the same but leaves fonts as files beside it.
function build(inline) {
  const files = new Map();

  // Rewrites every reference in `text`, whose paths start from `dir` (relative to game/).
  function rewrite(text, owner, dir) {
    return text.replace(
      reference,
      (match, q1, url, attr, q2, attrValue, q3, literal) => {
        const target = url ?? attrValue ?? literal;
        if (target === "" || elsewhere.test(target)) return match;
        const local = resolve(target, owner, dir);
        if (local === null) return match;
        let replacement = target.replace(/[?#].*$/, "");
        const asData =
          inline &&
          !/\.(css|js|html)$/.test(local) &&
          !(inline === "keep-fonts" && isFont(local));
        if (asData)
          replacement = `data:${mediaTypes[path.extname(local)]};base64,${read(local).toString("base64")}`;
        else {
          if (inline) replacement = local; // the page now holds the text, so paths start from it
          if (!files.has(local)) emit(local);
        }
        if (url !== undefined) return `url("${replacement}")`;
        if (attr !== undefined) return `${attr}=${q2}${replacement}${q2}`;
        return `${q3}${replacement}${q3}`;
      },
    );
  }

  function emit(local) {
    files.set(local, null); // claims the path before a stylesheet that names itself recurses
    const ext = path.extname(local);
    if (ext !== ".css" && ext !== ".js") return files.set(local, read(local));
    files.set(
      local,
      Buffer.from(rewrite(read(local, "utf8"), local, base(local))),
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
    if (!inline) {
      if (!files.has(local)) emit(local);
      return tag.replace(target, target.replace(/[?#].*$/, ""));
    }
    const text = rewrite(read(local, "utf8"), local, base(local));
    if (script)
      return `<script>\n${text.replace(/<\/(script)/gi, "<\\/$1").replace(/<!--/g, "<\\!--")}</script>`;
    if (/<\/style/i.test(text))
      problems.push(
        `${local} contains "</style", which would end the inlined stylesheet early`,
      );
    return `<style>\n${text}</style>`;
  });
  files.set("index.html", Buffer.from(page));
  return files;
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

const outputs = {
  single: build("all"),
  "single-with-font-files": build("keep-fonts"),
  folder: build(false),
};

if (problems.length) {
  for (const problem of new Set(problems)) console.error(`error: ${problem}`);
  process.exit(1);
}

const size = (bytes) =>
  bytes < 1024 ? `${bytes} B` : `${(bytes / 1024).toFixed(1)} KB`;
fs.rmSync(out, { recursive: true, force: true });
for (const [name, files] of Object.entries(outputs)) {
  const sorted = new Map(
    [...files].sort(([a], [b]) =>
      a === "index.html" ? -1 : b === "index.html" ? 1 : a.localeCompare(b),
    ),
  );
  for (const [local, data] of sorted) {
    fs.mkdirSync(path.dirname(path.join(out, name, local)), {
      recursive: true,
    });
    fs.writeFileSync(path.join(out, name, local), data);
  }
  const archive = zip(sorted);
  fs.writeFileSync(path.join(out, `${name}.zip`), archive);
  const total = [...sorted.values()].reduce(
    (sum, data) => sum + data.length,
    0,
  );
  console.log(
    `\n${path.relative(root, path.join(out, name))}/  ${sorted.size} files, ${size(total)}; ${name}.zip ${size(archive.length)}`,
  );
  for (const [local, data] of sorted)
    console.log(`  ${local.padEnd(44)} ${size(data.length).padStart(10)}`);
}
