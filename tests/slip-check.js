// An elf's slip is a mix-up: node tests/slip-check.js
// The child gets another child's toy of the same kind, never the toy asked for and never the
// wanted toy "in the wrong size". A mix-up is not one of the AI's blunders, and it counts as a
// wrong job by the elves.
const assert = require("assert");
const fs = require("fs");
const vm = require("vm");
const path = require("path");
vm.runInThisContext(
  fs.readFileSync(path.join(__dirname, "../game/workshop.js"), "utf8"),
);

const toys = new Map(WISHES.map((w) => [w.wanted.name, w]));
let slips = 0;
let named = 0;
let made = 0;
for (let seed = 1; seed <= 30; seed++) {
  // By hand and never rested, so tired elves slip. From half-time the toys go on Automate in half
  // the games, so mix-ups made at reading also meet the AI's toy making.
  const w = new Workshop({ seed });
  const everything = () => [...Object.values(w.q).flat(), ...w.aboard];
  const mixUps = new Map();
  while (!w.end) {
    w.step(0.5);
    if (w.choice) {
      w.choose("none");
      if (seed % 2) w.setAi(1, 2);
    }
    const v = w.view();
    if (v.case)
      w.resolve(v.case.id, v.case.options.find((o) => o.available).id);
    for (const x of everything()) {
      if (x.made) {
        made++;
        assert(!/wrong size/.test(x.made.name), x.made.name);
        assert(!("base" in x.made), "a made toy carries no base");
      }
      if (x.wrong && w.mixedUp(x)) mixUps.set(x.id, x);
    }
    // Nothing the page can see says "wrong size".
    assert(!/wrong size/.test(JSON.stringify(v)), `seed ${seed} at ${w.t} s`);
    for (const line of v.news)
      if (line.kind === "loaded" && /mix gifts up/.test(line.text)) named++;
  }
  for (const x of mixUps.values()) {
    slips++;
    const toy = x.wrongToy;
    const other = toys.get(toy.name);
    assert(other, `${toy.name} is not a toy a child asked for`);
    assert.notStrictEqual(toy.name, x.w.wanted.name, "the wanted toy itself");
    assert.strictEqual(
      other.big,
      x.w.big,
      `${toy.name} for ${x.w.wanted.name}`,
    );
    assert.deepStrictEqual(toy, w.slipToy(x), "the same mix-up every time");
    assert(!w.blunders.has(slug(toy.name)), `${toy.name} joined the blunders`);
  }
  const r = w.view().end.reliability;
  const wrongJobs = r.everyday.elves.wrong + r.big.elves.wrong;
  assert(wrongJobs >= mixUps.size, `seed ${seed}: ${wrongJobs} wrong elf jobs`);
}
assert(slips >= 20, `only ${slips} mix-ups in 30 games by hand`);
assert(named > 0, "no wrong-gift line named a mix-up by tired elves");
console.log(
  `slip checks passed: ${slips} mix-ups among ${made} looks at made toys, ${named} lines naming tired elves`,
);
