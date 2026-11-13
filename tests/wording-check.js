// No text the page can show holds a semicolon: every line is short plain sentences or fragments.
// Seeded games are played with different habits, through half-time and to the end screen, and
// every string anywhere in view() is read at each step.
const assert = require("assert");
const fs = require("fs");
const vm = require("vm");
const path = require("path");
vm.runInThisContext(
  fs.readFileSync(path.join(__dirname, "../game/workshop.js"), "utf8"),
);

let read = 0;
function strings(value, where, name) {
  if (typeof value === "string") {
    read++;
    assert(!value.includes(";"), `${name}, ${where}: ${value}`);
  } else if (value && typeof value === "object")
    for (const [key, inner] of Object.entries(value))
      strings(inner, `${where}.${key}`, name);
}

// How each player answers what comes up. Half-time picks go round all five options over the seeds.
const HALF_TIME = ["update", "tested", "train", "rest", "none"];
const players = [
  { name: "by hand, few checks", ai: [0, 0], checking: 0, pick: 1 },
  {
    name: "assist, risky checks",
    ai: [1, 1],
    checking: 1,
    pick: 0,
    rests: true,
  },
  { name: "automate, few checks, recalls", ai: [2, 2], checking: 0, pick: 0 },
  {
    name: "automate, all checks",
    ai: [2, 2],
    checking: 2,
    pick: 1,
    rests: true,
  },
  { name: "automate, leaves cards", ai: [2, 1], checking: 0, pick: null },
];

const seen = { halfTime: 0, unclear: 0, recall: 0, incident: 0, end: 0 };
for (let seed = 1; seed <= 10; seed++)
  for (const [n, p] of players.entries()) {
    const w = new Workshop({ seed });
    const name = `seed ${seed}, ${p.name}`;
    w.setAi(0, p.ai[0]);
    w.setAi(1, p.ai[1]);
    w.setChecking(p.checking);
    if (p.ai[0] === 2)
      w.elves.forEach((e, i) => e.station === 0 && w.move(i, 2));
    while (!w.end) {
      w.step(0.5);
      const v = w.view();
      strings(v, "view", name);
      if (v.choice) {
        seen.halfTime++;
        w.choose(HALF_TIME[(seed + n) % HALF_TIME.length]);
        strings(w.view(), "after half-time", name);
      }
      if (v.case && p.pick !== null) {
        const kind = v.case.kind === "unclear" ? "unclear" : v.case.step;
        seen[
          kind === "aboard"
            ? "recall"
            : kind === "unclear"
              ? "unclear"
              : "incident"
        ]++;
        const open = v.case.options.filter((o) => o.available);
        const option = open[Math.min(p.pick, open.length - 1)];
        if (option) w.resolve(v.case.id, option.id);
        strings(w.view(), "after a decision", name);
      }
      if (p.rests)
        w.elves.forEach(
          (e, i) => e.station < 3 && e.tired >= 80 && w.move(i, 3),
        );
    }
    seen.end++;
    strings(w.view(), "end", name);
  }

for (const [what, count] of Object.entries(seen))
  assert(count > 0, `the games reached no ${what}`);
console.log(
  `wording check passed: ${read} strings read, ${Object.entries(seen)
    .map(([what, count]) => `${count} ${what}`)
    .join(", ")}`,
);
