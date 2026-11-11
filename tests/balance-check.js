// Plays scripted players through the rules and checks the balance and the interface: node tests/balance-check.js
const assert = require("assert");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

vm.runInThisContext(
  fs.readFileSync(path.join(__dirname, "../game/workshop.js"), "utf8"),
);

const SEEDS = [1, 2, 3, 4, 5, 6];
const PARCEL_KEYS = "id,wish,big,wanted,made,suspect,result";
const NEWS_KINDS =
  "unlock checked loaded timmy update rolledBack quarantined recalled rush behind overtrust trained tired broke blocked lost".split(
    " ",
  );
const wantedFor = new Map(WISHES.map((w) => [w.wish, w.wanted.name]));
const argmax = (list) => list.indexOf(Math.max(...list));

// Every player except neverRests sends an elf for cocoa at the hint's tiredness, so each
// player differs from the sensible one in the one thing its name says.
function rests(w, v, m) {
  m.home ??= {};
  v.elves.forEach((e, i) => {
    if (
      e.station < 3 &&
      e.tired >= 60 &&
      v.stations[e.station].staff > 1 &&
      w.move(i, 3)
    )
      m.home[i] = e.station;
    if (e.station === 3 && !e.resting && e.tired <= 10)
      w.move(i, m.home[i] ?? 2);
  });
}

// Players see only view() and call only the action methods.
const players = {
  byHand: rests,
  fastNoChecks(w, v, m) {
    rests(w, v, m);
    w.setAi(0, 2);
    w.setAi(1, 2);
  },
  // Asks, trains and rolls back like the sensible player, so blanket checking is the difference.
  checkAll(w, v, m) {
    rests(w, v, m);
    w.setAi(0, 1);
    w.setAi(1, 1);
    w.setChecking(2);
    w.setAsk(true);
    if (v.t >= 100) w.train();
    if (v.incident?.known) w.rollback();
  },
  sensible(w, v, m, { update = true, rest = true, train = true } = {}) {
    w.setAsk(true);
    w.setChecking(1);
    const slow = v.pace.slowest;
    for (const s of [0, 1]) {
      const fill = v.stations[s].waiting.length / v.stations[s].limit;
      w.setAi(
        s,
        s === slow && fill > 0.25
          ? 2
          : fill < 0.1 || v.ai[s] === 0
            ? 1
            : v.ai[s],
      );
    }
    if (train && v.t >= 100) w.train();
    if (v.t - (m.moved ?? -9) >= 3) {
      const rates = v.stations.map((st, s) =>
        st.staff > 1 && s !== slow ? st.rate : 0,
      );
      const from = argmax(rates);
      const elf = v.elves.findIndex((e) => e.station === from);
      if (rates[from] > 1.3 * v.stations[slow].rate && w.move(elf, slow))
        m.moved = v.t;
    }
    if (rest) rests(w, v, m);
    if (v.inspection?.ready) {
      const p = v.inspection.parcel;
      w.decide(p.id, wantedFor.get(p.wish) === p.made.name ? "ship" : "remake");
    } else if (!v.inspection && v.t - (m.opened ?? -99) >= 20) {
      const pick = v.stations[2].waiting.find((p) => p.big && p.suspect);
      if (pick && w.inspect(pick.id)) m.opened = v.t;
    }
    if (!update) return;
    if (v.incident?.known) w.rollback();
    if (
      v.incident?.suspectWaiting >= 3 &&
      v.t - (m.quarantined ?? -99) >= 15 &&
      w.quarantine()
    )
      m.quarantined = v.t;
    const wrongShare =
      v.sleigh.wrong / Math.max(1, v.sleigh.right + v.sleigh.wrong);
    if (
      v.sleigh.wrong >= 4 &&
      wrongShare > 0.06 &&
      v.t - (m.recalled ?? -99) >= 20 &&
      w.recall()
    )
      m.recalled = v.t;
  },
  lateOnUpdate: (w, v, m) => players.sensible(w, v, m, { update: false }),
  neverRests: (w, v, m) => players.sensible(w, v, m, { rest: false }),
  neverTrains: (w, v, m) => players.sensible(w, v, m, { train: false }),
  // Skips checking and fixes mistakes after loading instead: must not beat checking first.
  recallHappy(w, v, m) {
    rests(w, v, m);
    w.setAi(0, 2);
    w.setAi(1, 2);
    w.setAsk(true);
    if (v.incident?.known) w.rollback();
    w.recall();
  },
};

const NORMAL_MAKE_WRONG = MAKE_RISK.map((r) => Math.round(r * 100)).join();

// Nothing in view() may show what the player has not found out.
function checkHidden(v) {
  if (v.incident && !v.incident.known)
    assert.strictEqual(
      v.levers.ai1.map((l) => l.wrongPer100).join(),
      NORMAL_MAKE_WRONG,
      "levers show the faulty update before it is known",
    );
  const parcels = [
    ...v.stations.flatMap((s) => s.waiting),
    ...v.sleigh.parcels,
  ];
  for (const p of parcels) {
    assert.strictEqual(Object.keys(p).join(), PARCEL_KEYS);
    assert([false, "unsure", "batch"].includes(p.suspect));
    if (p.suspect === "batch")
      assert(v.incident?.known, "batch mark too early");
    if (p.result === null)
      assert(
        p.wanted === null && p.made === null,
        `parcel ${p.id} shows its answer`,
      );
  }
  const ins = v.inspection?.parcel;
  if (ins)
    assert(
      ins.result === null &&
        ins.wanted === null &&
        (v.inspection.ready || ins.made === null),
    );
}

function play(name, seed, guided = false) {
  const w = new Workshop({ seed, guided });
  const run = {
    name,
    kinds: new Set(),
    behindAt: [],
    unlocks: [],
    checkerBurnouts: 0,
    first60: null,
    knownAt: null,
    holds: [],
    hash: crypto.createHash("sha1"),
  };
  let last = null;
  let lastNews = 0;
  let heldSince = null;
  const warnedAt = {};
  const memo = {};
  for (let i = 0; !w.end; i++) {
    if (i % 5 === 0) {
      const v = w.view();
      checkHidden(v);
      v.elves.forEach((e, i) => {
        if (e.tired >= 60) warnedAt[i] ??= v.t;
        else if (e.station < 3) delete warnedAt[i];
      });
      if (run.first60 === null && v.elves.some((e) => e.tired >= 60))
        run.first60 = v.t;
      if (run.knownAt === null && v.incident?.known) run.knownAt = v.t;
      if (v.dispatchHeld) heldSince ??= v.t;
      else if (heldSince !== null) {
        run.holds.push(v.t - heldSince);
        heldSince = null;
      }
      run.hash.update(JSON.stringify(v));
      for (const n of v.news.filter((n) => n.id > lastNews).reverse()) {
        run.kinds.add(n.kind);
        if (n.kind === "behind") run.behindAt.push(n.t);
        if (n.kind === "unlock")
          run.unlocks.push(`${n.t.toFixed(1)}s ${n.control}`);
        if (n.kind === "tired" && last?.elves[n.elf].station === 2)
          run.checkerBurnouts++;
        if (n.kind === "tired")
          assert(
            n.t - (warnedAt[n.elf] ?? n.t) >= 10,
            "the elf card warns at least 10 seconds before a burnout",
          );
      }
      lastNews = v.news[0]?.id ?? lastNews;
      players[name](w, v, memo);
      last = v;
    }
    w.step(0.1);
  }
  run.end = w.view().end;
  run.hash = run.hash.digest("hex");
  return run;
}

const mean = (runs, f) => runs.reduce((s, r) => s + f(r), 0) / runs.length;
const results = Object.fromEntries(
  Object.keys(players).map((name) => [
    name,
    SEEDS.map((seed) => play(name, seed)),
  ]),
);

console.log(
  "player        right wrong lost  ratings  people ai  check fixing mistakes prevented total  lessons",
);
for (const [name, runs] of Object.entries(results)) {
  const c = (k) =>
    String(Math.round(mean(runs, (r) => r.end.costs[k]))).padStart(5);
  const lessons = [...new Set(runs.map((r) => r.end.lesson.title))].join(" / ");
  const avg = (k) =>
    String(Math.round(mean(runs, (r) => r.end[k]))).padStart(5);
  console.log(
    `${name.padEnd(13)}${avg("right")} ${avg("wrong")}${avg("lost")}  ${runs.map((r) => r.end.rating).join("")}  ${c("people")}${c("ai")}${c("checking")}${c("fixing")}  ${c("mistakes")}   ${c("prevented")}  ${c("total")}  ${lessons}`,
  );
}

const expect = {
  byHand: "By hand is careful but slow",
  fastNoChecks: "Too little checking",
  checkAll: "Too much checking",
  sensible: "Checking in the right places",
  neverTrains: "The checkers trusted the AI too much",
};
for (const [name, title] of Object.entries(expect))
  for (const r of results[name]) {
    assert.strictEqual(r.end.lesson.title, title, `${name} seed lesson`);
    if (name !== "neverTrains")
      assert.strictEqual(
        r.end.rating === 3,
        name === "sensible",
        `${name} rating ${r.end.rating}`,
      );
  }
for (const r of results.sensible)
  assert(r.end.costs.total <= r.end.costs.budget, "sensible within budget");

const avgCost = (name, k) => mean(results[name], (r) => r.end.costs[k]);
assert(
  avgCost("sensible", "checking") < avgCost("sensible", "prevented"),
  "sensible checking pays for itself",
);
assert(
  avgCost("checkAll", "checking") > avgCost("checkAll", "prevented"),
  "checking everything costs more than it stops",
);
const skipped =
  avgCost("sensible", "checking") - avgCost("fastNoChecks", "checking");
assert(
  avgCost("fastNoChecks", "mistakes") > 2 * skipped,
  "little checking: mistakes cost far more than the checking skipped",
);

const restless = results.neverRests.filter((r) => r.end.rating < 3);
assert(restless.length >= 4, "a player who never rests misses top rating");
for (const r of restless)
  assert.strictEqual(r.end.lesson.title, "Tired checkers miss mistakes");
assert(
  results.neverRests.every((r) => r.checkerBurnouts > 0),
  "a player who never rests loses checkers to burnout",
);
const allRuns = Object.values(results).flat();
// checkAll's jammed toy line makes its first train after that; it is noticed as soon as it exists.
for (const r of allRuns.filter(
  (r) => r.knownAt !== null && r.name !== "checkAll",
))
  assert(r.knownAt - 75 <= 15, `update known ${r.knownAt - 75}s after landing`);
const holds = allRuns.flatMap((r) => r.holds);
console.log(
  `quarantine holds: ${holds.length}, longest ${Math.max(...holds).toFixed(1)}s, mean ${(holds.reduce((a, b) => a + b, 0) / holds.length).toFixed(1)}s`,
);
assert(
  Math.max(...holds) <= 16,
  "a quarantine holds dispatch for at most about 15 seconds",
);
assert(
  results.byHand.every((r) => r.behindAt.length > 0),
  "behind fires for the by-hand player",
);
assert(
  results.sensible.every((r) => r.behindAt.every((t) => t < 60)),
  "behind stays quiet for the sensible player",
);

const guided = SEEDS.map((seed) => play("sensible", seed, true));
for (const r of guided) {
  assert(
    r.end.right >= 155,
    `guided sensible reaches the target (${r.end.right})`,
  );
  assert(r.first60 >= 60, `first tired elf at ${r.first60}s, after the levers`);
}
console.log(
  "\nguided sensible right:",
  guided.map((r) => r.end.right).join(" "),
  " unlocks (seed 1):",
  guided[0].unlocks.join(", "),
);

assert.strictEqual(
  play("sensible", 3).hash,
  play("sensible", 3).hash,
  "same seed and calls give the same run",
);

const kinds = new Set(
  [...Object.values(results).flat(), ...guided].flatMap((r) => [...r.kinds]),
);
for (const k of NEWS_KINDS) assert(kinds.has(k), `news kind ${k} is emitted`);

// The lever figures must predict what the workshop then does over a steady stretch.
function measure(setup, from, to, promise, count) {
  let promised = 0;
  let did = 0;
  for (const seed of SEEDS) {
    const w = new Workshop({ seed });
    setup(w);
    w.step(from);
    const before = count(w.view());
    for (let t = from; t < to; t++, w.step(1))
      promised += promise(w.view().levers) / (to - from) / SEEDS.length;
    did += ((count(w.view()) - before) * 60) / (to - from) / SEEDS.length;
  }
  return { promised, did };
}
const pastReading = (v) =>
  v.stations.slice(1).reduce((s, st) => s + st.waiting.length, 0) +
  v.sleigh.right +
  v.sleigh.wrong +
  v.rework;
const aboard = (v) => v.sleigh.right + v.sleigh.wrong;
const reading = measure(
  () => {},
  20,
  60,
  (l) => l.ai0[0].perMinute,
  pastReading,
);
const checkAllSetup = (w) => (w.setAi(0, 1), w.setAi(1, 1), w.setChecking(2));
const dispatch = measure(
  checkAllSetup,
  30,
  55,
  (l) => l.checking[2].perMinute,
  aboard,
);
const near = (got, want, tol) => Math.abs(got - want) <= tol * want;
const fmt = (m) =>
  `promised ${m.promised.toFixed(1)}/min, did ${m.did.toFixed(1)}`;
console.log(
  `levers: reading by hand ${fmt(reading)}; check everything ${fmt(dispatch)}`,
);
assert(near(reading.did, reading.promised, 0.15), "reading lever is honest");
assert(near(dispatch.did, dispatch.promised, 0.15), "checking lever is honest");

// Mistakes: automate both before the update, spot-checking; the sleigh shows what the levers said.
let wrongAboard = 0;
let loaded = 0;
let promisedWrong = 0;
for (const seed of SEEDS) {
  const w = new Workshop({ seed });
  w.setAi(0, 2);
  w.setAi(1, 2);
  const l = w.view().levers;
  promisedWrong =
    1 - (1 - l.ai0[2].wrongPer100 / 100) * (1 - l.ai1[2].wrongPer100 / 100);
  w.step(74);
  wrongAboard += w.view().sleigh.wrong;
  loaded += aboard(w.view());
}
console.log(
  `mistakes on automate: levers say ${(promisedWrong * 100).toFixed(1)} in 100, sleigh shows ${((wrongAboard / loaded) * 100).toFixed(1)} (spot-checks catch a few)`,
);
assert(
  Math.abs(wrongAboard / loaded - promisedWrong) < 0.05,
  "mistake figures are honest",
);

console.log("\nall checks passed");
