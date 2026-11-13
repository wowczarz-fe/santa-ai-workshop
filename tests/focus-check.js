// A station on Automate is never said to need an elf: the machine works alone there, so another
// elf adds nothing. Checked on the focus, the behind line and the rested-elf line.
const assert = require("assert");
const fs = require("fs");
const vm = require("vm");
const path = require("path");
vm.runInThisContext(
  fs.readFileSync(path.join(__dirname, "../game/workshop.js"), "utf8"),
);

const automated = (w, s) => s < 2 && w.ai[s] === 2;
function watch(w, name) {
  const v = w.view();
  const f = v.focus;
  assert(
    !(f && f.control === "elves" && automated(w, f.station)),
    `${name} at ${Math.round(w.t)} s: ${STATION_NAMES[f?.station]} on Automate ${f?.text}`,
  );
  for (const n of v.news.filter((n) => n.id > (w.seenNews ?? 0))) {
    if (n.kind === "behind")
      assert(!automated(w, n.station), `${name}: ${n.text}`);
    if (n.kind === "rested" && /needs an elf/.test(n.text))
      assert(!automated(w, n.station), `${name}: ${n.text}`);
  }
  w.seenNews = v.news[0]?.id ?? w.seenNews;
}

// Whole games with one or both stations on Automate, at each checking level, with the elves left
// where they stand or all sent to Checking, and tired elves rested so that they walk back.
let focused = 0;
for (let seed = 1; seed <= 8; seed++)
  for (const ai of [
    [2, 2],
    [1, 2],
    [2, 1],
    [0, 2],
  ])
    for (const checking of [0, 1, 2])
      for (const toChecking of [false, true]) {
        const w = new Workshop({ seed });
        const name = `seed ${seed}, AI ${ai}, checking ${checking}`;
        w.setAi(0, ai[0]);
        w.setAi(1, ai[1]);
        w.setChecking(checking);
        if (toChecking)
          w.elves.forEach(
            (e, i) => automated(w, e.station) && i % 2 && w.move(i, 2),
          );
        while (!w.end) {
          w.step(0.5);
          if (w.choice) w.choose("none");
          w.elves.forEach(
            (e, i) => e.station < 3 && e.tired >= 80 && w.move(i, 3),
          );
          watch(w, name);
          if (w.view().focus) focused++;
        }
      }
assert(focused > 500, "the games did raise a focus to check");

// A full toy pile at a machine that works alone: nothing an elf could do, so no elf is asked for,
// at Toys or at Letters behind it.
{
  const w = new Workshop({ seed: 3 });
  w.setAi(1, 2);
  w.step(20);
  while (!w.full("orders")) (w.arrive(), w.q.orders.push(w.q.letters.pop()));
  for (let i = 0; i < 12; i++) {
    w.step(1);
    while (!w.full("orders")) (w.arrive(), w.q.orders.push(w.q.letters.pop()));
    watch(w, "full toy pile on Automate");
    assert.notStrictEqual(
      w.view().focus?.station,
      0,
      "Letters is only waiting",
    );
  }
  // The same pile with elves making toys does ask for one.
  w.setAi(1, 1);
  assert.deepStrictEqual(
    [w.view().focus.station, w.view().focus.control],
    [1, "elves"],
  );
}
console.log("focus checks passed");
