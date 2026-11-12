// Plays scripted players through the rules and checks the balance and the interface: node tests/balance-check.js
const assert = require("assert");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

vm.runInThisContext(
  fs.readFileSync(path.join(__dirname, "../game/workshop.js"), "utf8"),
);

const SEEDS = Array.from({ length: 40 }, (_, i) => i + 1);
// Orderings that guide tuning but do not block: printed at the end as warnings.
const warnings = [];
const warn = (ok, message) => ok || warnings.push(message);
const PARCEL_KEYS = "id,wish,big,unclear,wanted,made,suspect,result";
const NEWS_KINDS =
  "checked loaded consequence case resolved update noticed rolledBack recalled relaxed trained tired blocked lost behind milestone cleared halftime chose departed".split(
    " ",
  );
const CONTROLS_NAMED = ["checking", "ai:0", "ai:1", "cocoa"];
const argmax = (list) => list.indexOf(Math.max(...list));
const fill = (v, id) => v.queues[id].parcels.length / v.queues[id].limit;
const mean = (list) => list.reduce((s, n) => s + n, 0) / list.length;
const shareOf = (list, test) => list.filter(test).length / list.length;

// Reading facts the way a player would.
const fact = (c, label) => c.facts.find((f) => f.label === label)?.value ?? "";
const num = (text) => parseFloat(text.match(/\d+(\.\d+)?/)?.[0] ?? "0");
const odds = (text) => {
  const m = text.match(/(\d+) in (\d+)/);
  return m ? m[1] / m[2] : 0;
};
const key = (c) => c.step ?? c.kind;

// Weighs what a decision shows and what the workshop can spare.
function conditional(c) {
  const left = num(fact(c, "Time left"));
  switch (key(c)) {
    case "unclear":
      return left > 15 ? "ask" : "guess";
    case "source":
      return left < 20 ? "keep" : "rollback";
    case "aboard": {
      // Worth fetching back when leaving them costs more than the fetching, counting checker time at £1 a second.
      const bring = c.options.find((o) => o.id === "bringBack");
      return num(fact(c, "Cost if left")) > bring.money + bring.seconds &&
        left >= 30
        ? "bringBack"
        : "leave";
    }
  }
}

// Answers the open decision with a policy, falling back to any option that can be chosen now.
function answer(w, v, m, policy = conditional) {
  const c = v.case;
  if (!c || c.resolving) return;
  const wanted = policy(c, v);
  const pick =
    c.options.find((o) => o.id === wanted && o.available) ??
    c.options.find((o) => o.available);
  if (pick && w.resolve(c.id, pick.id))
    (m.choices ??= []).push(`${key(c)}:${pick.id}`);
}

// Half-time: read each option's facts and the workshop's state, and buy at most one change.
function chooseWell(ch, v) {
  const by = (id) => ch.options.find((o) => o.id === id);
  const value = (o, label) =>
    o.facts.find((f) => f.label === label)?.value ?? "";
  const p = odds(value(by("update"), "Risk"));
  const toCome = num(value(by("train"), "Gives"));
  if (v.vigilance.state !== "careful" && toCome >= 30) return "train";
  if (p <= 0.25 && v.ai[1] > 0) return "update";
  if (num(value(by("rest"), "Energy now")) < 45) return "rest";
  if (p < 0.75 && v.ai[1] > 0) return "tested";
  return "none";
}

// Sends an elf for cocoa once it turns tired, and back to work once fresh.
function rests(w, v, m) {
  m.home ??= {};
  const staff = v.stations.map((st) => st.staff);
  v.elves.forEach((e, i) => {
    if (
      e.station < 3 &&
      e.mood === "tired" &&
      staff[e.station] > 1 &&
      w.move(i, 3)
    ) {
      m.home[i] = e.station;
      staff[e.station]--;
    }
    if (e.station === 3 && !e.resting && e.mood === "fresh")
      w.move(i, m.home[i] ?? 2);
  });
}

// Moves one elf every few seconds to the station whose piles are fullest, keeping at least the
// given number at each station.
function balance(w, v, m, keep) {
  if (v.t - (m.moved ?? -9) < 3) return;
  const need = [
    v.ai[0] === 2 ? 0 : fill(v, "letters"),
    v.ai[1] === 2 || fill(v, "check") >= 1 ? 0 : fill(v, "orders"),
    Math.max(fill(v, "check"), v.queues.rework.parcels.length / 10),
  ];
  // A station whose next pile is full is stopped; more elves there would only stand idle.
  if (fill(v, "orders") >= 1) need[0] = 0;
  const to = argmax(need);
  const spare = need.map((n, s) =>
    s !== to && v.stations[s].staff > keep[s] ? -n : -9,
  );
  if (Math.max(...spare) === -9) return;
  const from = argmax(spare);
  const elf = v.elves.findIndex((e) => e.station === from && !e.resting);
  if (need[to] - need[from] > 0.2 && elf >= 0 && w.move(elf, to)) m.moved = v.t;
}

// Lets the AI read alone and has elves confirm its toys, where its slips cost most; checks the risky
// ones, moves elves to the slowest station, rests tired elves, answers decisions and buys one
// sensible change at half-time.
const active =
  ({ ai = [2, 1], checking = 1, rest = true, policy = conditional } = {}) =>
  (w, v, m) => {
    w.setAi(0, ai[0]);
    w.setAi(1, ai[1]);
    w.setChecking(checking);
    if (rest) rests(w, v, m);
    balance(w, v, m, [ai[0] === 1 ? 1 : 0, ai[1] === 1 ? 1 : 0, 2]);
    answer(w, v, m, policy);
  };

// Players see only view() and call only the action methods.
const players = {
  byHandIdle: () => {},
  automateIdle: (w) => (w.setAi(0, 2), w.setAi(1, 2)),
  assistIdle: (w) => (w.setAi(0, 1), w.setAi(1, 1)),
  sensible: active(),
  automateActive: active({ ai: [2, 2] }),
  checkAll: active({ checking: 2 }),
  checkFew: active({ checking: 0 }),
  neverRests: active({ rest: false }),
  alwaysGuess: active({
    policy: (c) => (c.kind === "unclear" ? "guess" : conditional(c)),
  }),
};
const IDLE = ["byHandIdle", "automateIdle", "assistIdle"];
const HALF_TIME = {
  sensible: chooseWell,
  automateActive: chooseWell,
  checkAll: chooseWell,
  checkFew: chooseWell,
  neverRests: chooseWell,
  alwaysGuess: chooseWell,
};

// Nothing in view() may show what the player has not found out, and the shape holds.
function checkView(v) {
  const all = [
    ...Object.values(v.queues).flatMap((q) => q.parcels),
    ...v.sleigh.parcels,
  ];
  for (const p of all) {
    assert.strictEqual(Object.keys(p).join(), PARCEL_KEYS);
    assert([false, "unsure", "batch"].includes(p.suspect));
    if (p.suspect === "batch")
      assert(v.incident?.known, "batch mark before the update is known");
    if (p.result === null)
      assert(
        p.wanted === null && p.made === null,
        `parcel ${p.id} shows its answer`,
      );
  }
  for (const e of v.elves) {
    assert(e.energy >= 0 && e.energy <= 100, "energy is 0 to 100");
    assert(["fresh", "tiring", "tired", "spent"].includes(e.mood), e.mood);
    assert.strictEqual(e.mood === "spent", e.resting, "spent while burnt out");
  }
  assert.strictEqual(
    Object.keys(v.run).join(),
    "half,halves,halfLeft,leavesIn,aboard,target,cargo,goals,goalsCountFrom",
  );
  assert.strictEqual(v.run.goals.map((g) => g.id).join(), "full,right,cost");
  for (const g of v.run.goals) {
    assert.strictEqual(
      Object.keys(g).join(),
      "id,name,now,need,text,met,waiting",
    );
    assert(!(g.met && g.waiting), `goal ${g.id} waits only when unmet`);
  }
  assert.strictEqual(v.run.goals[2].now, v.cost.spent, "cost goal is cost");
  assert.strictEqual(v.cost.limit, v.run.goals[2].need);
  assert.strictEqual(Object.keys(v.actions).join(), "ai0,ai1,checking,bypass");
  for (const a of Object.values(v.actions))
    assert.strictEqual(Object.keys(a).join(), "available,why,cost");
  const f = v.focus;
  if (f) {
    assert(
      Object.keys(f).join() === "station,control,text" &&
        [0, 1, 2, 3].includes(f.station),
      "focus shape",
    );
    assert(f.text.split(/\s+/).length <= 4, `focus "${f.text}" too long`);
  }
  if (!v.case) return;
  assert.strictEqual(
    Object.keys(v.case).join(),
    "id,kind,step,title,text,facts,evidence,affected,options,resolving",
  );
  assert(["unclear", "incident"].includes(v.case.kind), v.case.kind);
  const primary = v.case.facts.filter((f) => f.primary).length;
  assert(primary >= 1 && primary <= 3, `${key(v.case)} primary facts`);
  for (const ev of v.case.evidence)
    assert.strictEqual(Object.keys(ev).join(), "parcelId,child,wish,made");
  for (const o of v.case.options)
    assert.strictEqual(
      Object.keys(o).join(),
      "id,label,seconds,money,risk,scope,why,goal,available",
    );
  if (v.case.kind === "unclear")
    assert.strictEqual(
      v.case.options.map((o) => o.id).join(),
      "ask,guess",
      "an unclear letter offers ask or guess",
    );
}

// Half-time: the rules stand still and the card carries the report, the next half and the options.
function checkChoice(v, w) {
  const ch = v.choice;
  assert.strictEqual(
    Object.keys(ch).join(),
    "title,text,report,next,options,openCase",
  );
  assert.strictEqual(
    Object.keys(ch.report).join(),
    "aboard,wrong,target,cost,limit,tired,burnouts,goals,causes",
  );
  assert(ch.report.tired >= 0 && ch.report.tired <= 100);
  assert.strictEqual(ch.next.cargo.id, "big");
  assert(ch.next.text.length < 100, "next is one short line");
  assert.strictEqual(
    ch.options.map((o) => o.id).join(),
    "update,tested,train,rest,none",
  );
  for (const o of ch.options) assert(o.facts.length <= 3, "option facts");
  const waiting = w.cases.find((c) => !c.resolving);
  assert.strictEqual(ch.openCase?.id ?? null, waiting?.id ?? null);
  const t = w.t;
  w.step(5);
  assert.strictEqual(w.t, t, "nothing moves while half-time is open");
}

// Every wrong gift's news line names one action open now, and nothing said during play points at
// what only half-time sells.
function checkNews(n) {
  if (n.kind === "loaded") {
    assert(
      CONTROLS_NAMED.includes(n.control),
      `wrong gift control ${n.control}`,
    );
    assert(
      /(Check|Put|Send|Rest) [^.]*\.$/.test(n.text),
      `wrong gift line names an action: ${n.text}`,
    );
    assert(n.cause in WRONG_CAUSES, `cause ${n.cause}`);
  }
  if (!["halftime", "chose", "trained", "departed"].includes(n.kind))
    assert(
      !/\btrain(ing|ed)? (the|them)|half-time|at a break|update first/i.test(
        n.text,
      ),
      `a line during play points at half-time: ${n.text}`,
    );
}

// Parcels picked for a check reach the sleigh only checked, waved through, remade or bypassed.
function checkGate(w) {
  for (const x of w.aboard.filter((x) => x.route === "check"))
    assert(
      ["checked", "skipped", "bypassed", "remade"].includes(x.exit),
      `parcel ${x.id} left the checking pile unchecked`,
    );
  const everywhere = [...w.aboard, ...Object.values(w.q).flat()];
  assert.strictEqual(
    everywhere.filter((x) => x.exit === "bypassed").length,
    w.bypassed,
    "bypassed count",
  );
}

function play(name, seed) {
  const w = new Workshop({ seed });
  const r = {
    name,
    kinds: new Set(),
    cards: 0,
    burnouts: [],
    firstBurnout: {},
    hash: crypto.createHash("sha1"),
  };
  let lastNews = 0;
  const memo = {};
  const seen = new Set();
  for (let i = 0; !w.end; i++) {
    if (i % 5 === 0 || w.choice) {
      const v = w.view();
      checkView(v);
      r.hash.update(JSON.stringify(v));
      for (const n of v.news.filter((n) => n.id > lastNews).reverse()) {
        r.kinds.add(n.kind);
        checkNews(n);
        if (n.kind === "tired") {
          r.burnouts.push(n.t);
          r.firstBurnout[n.elf] ??= n.t;
        }
      }
      lastNews = v.news[0]?.id ?? lastNews;
      if (v.case && !seen.has(v.case.id)) (seen.add(v.case.id), r.cards++);
      if (v.choice) {
        checkChoice(v, w);
        const pick = (HALF_TIME[name] ?? (() => "none"))(v.choice, v);
        r.halfTime = pick;
        assert(w.choose(pick), `choose ${pick}`);
        continue;
      }
      players[name](w, v, memo);
    }
    w.step(0.1);
  }
  checkGate(w);
  const v = w.view();
  for (const n of v.news.filter((n) => n.id > lastNews)) r.kinds.add(n.kind);
  r.end = v.end;
  r.stars = v.end.stars;
  r.met = Object.fromEntries(v.end.goals.map((g) => [g.id, g.met]));
  r.choices = memo.choices ?? [];
  r.hash = r.hash.digest("hex");
  return r;
}

const results = Object.fromEntries(
  Object.keys(players).map((name) => [
    name,
    SEEDS.map((seed) => play(name, seed)),
  ]),
);
const starsOf = (name) => results[name].map((r) => r.stars);
const metShare = (name, id) => shareOf(results[name], (r) => r.met[id]);

console.log(
  `\nplayer           stars  0/1/2/3      full right cost  right wrong lost   cost  cards  ai/checks/half/fix/wrong  lessons`,
);
for (const [name, rs] of Object.entries(results)) {
  const s = starsOf(name);
  const spread = [0, 1, 2, 3].map((n) => s.filter((x) => x === n).length);
  const avg = (f, d = 0) => mean(rs.map(f)).toFixed(d).padStart(6);
  const pct = (id) => `${Math.round(metShare(name, id) * 100)}%`.padStart(5);
  const lessons = [...new Set(rs.map((r) => r.end.lesson.title))].join(" / ");
  console.log(
    `  ${name.padEnd(15)}${mean(s).toFixed(2).padStart(5)}  ${spread.join("/").padEnd(12)}${pct("full")}${pct("right")}${pct("cost")}${avg((r) => r.end.right)}${avg((r) => r.end.wrong)}${avg((r) => r.end.lost)}${avg((r) => r.end.costs.total)}${avg((r) => r.cards, 1)}  ${["ai", "checking", "halfTime", "fixing", "mistakes"].map((k) => Math.round(mean(rs.map((r) => r.end.costs[k])))).join("/")}  ${lessons}`,
  );
}

// The balance targets of the one-sleigh game (ADR 0014).
const starShare = (name, test) => shareOf(starsOf(name), test);
assert(
  starShare("automateIdle", (s) => s <= 1) >= 0.9,
  "everything on Automate, untouched: 0 or 1 star in nearly every game",
);
assert(
  starShare("assistIdle", (s) => s === 1) >= 0.5 &&
    starShare("assistIdle", (s) => s >= 2) <= 0.25 &&
    starShare("assistIdle", (s) => s === 3) === 0,
  "Assist, untouched: 1 star typical, 2 rare",
);
assert(
  starShare("byHandIdle", (s) => s <= 1) >= 0.9,
  "by hand, untouched: 0 or 1 star",
);
const sensible = mean(starsOf("sensible"));
const three = starShare("sensible", (s) => s === 3);
assert(
  sensible >= 2 && starShare("sensible", (s) => s >= 2) >= 0.75,
  `a sensible player earns two stars typically (${sensible.toFixed(2)})`,
);
assert(
  three >= 0.2 && three <= 0.55,
  `a sensible player earns three stars in a quarter to a half of games (${Math.round(three * 100)}%)`,
);
// Both ends lose, the middle wins.
assert(
  mean(starsOf("checkAll")) <= sensible - 0.5 &&
    shareOf(results.checkAll, (r) => !r.met.cost || !r.met.full) >= 0.75,
  "checking everything costs a star through the cost goal or a held-up sleigh",
);
assert(
  mean(starsOf("checkFew")) <= sensible - 0.5 &&
    metShare("checkFew", "right") <= 0.25,
  "checking only a few costs the mistakes star",
);
warn(
  mean(starsOf("alwaysGuess")) <= sensible,
  "asking about unclear wishes pays at least as well as guessing",
);
for (const name of ["sensible", "checkAll", "checkFew"])
  for (const r of results[name])
    assert(
      r.cards >= 2 && r.cards <= 4,
      `${name} seed: ${r.cards} decisions, two to four in a game`,
    );
// An elf working without rest burns out about once a half: by hand every elf works all game.
const perElf = mean(results.byHandIdle.map((r) => r.burnouts.length / 8));
const firstAt = mean(
  results.byHandIdle.flatMap((r) => Object.values(r.firstBurnout)),
);
console.log(
  `\nburnouts by hand, untouched: ${perElf.toFixed(2)} an elf a game, the first at ${firstAt.toFixed(0)} s on average`,
);
assert(
  perElf >= 1.3 && perElf <= 2.7,
  `an elf never rested burns out about once a half (${perElf.toFixed(2)} a game)`,
);
console.log(
  `half-time picks (sensible): ${Object.entries(
    Object.groupBy(results.sensible, (r) => r.halfTime),
  )
    .map(([k, rs]) => `${k} ${rs.length}`)
    .join(", ")}`,
);
console.log(
  `decisions answered (sensible): ${Object.entries(
    Object.groupBy(
      results.sensible.flatMap((r) => r.choices),
      (x) => x,
    ),
  )
    .map(([k, xs]) => `${k} ${xs.length}`)
    .join(", ")}`,
);
for (const name of IDLE)
  for (const r of results[name])
    assert.strictEqual(
      r.end.practices.find((p) => p.id === "escalate").actions[0].figure,
      "asked 0 of 2",
      "an untouched player asked no child",
    );
for (const r of results.sensible) {
  const escalate = r.end.practices.find((p) => p.id === "escalate");
  assert(escalate.used && /^asked [12] of 2$/.test(escalate.actions[0].figure));
  assert.strictEqual(
    r.end.practices.map((p) => p.id).join(),
    "human-in-loop,risk-check,escalate,test-release,oversight",
  );
  assert(
    r.end.practices
      .find((p) => p.id === "oversight")
      .actions.some(
        (a) => a.label === "Trained the checkers not to just defer to AI",
      ),
  );
  assert(/trust/.test(r.end.practices.find((p) => p.id === "risk-check").note));
  assert.strictEqual(
    Object.keys(r.end).join(),
    "stars,goals,right,wrong,lost,costs,headline,lesson,assurance,checkingAnswer,practices,causes,blunders,blunderTotal",
  );
  for (const b of r.end.blunders)
    assert.strictEqual(Object.keys(b).join(), "id,name,icon");
  assert(r.end.blunderTotal >= r.end.blunders.length);
}
assert.strictEqual(
  play("sensible", 3).hash,
  play("sensible", 3).hash,
  "same seed and calls give the same game",
);
// The unclear letters come from at least five children, Timmy among them.
const children = new Set(
  SEEDS.flatMap((seed) => new Workshop({ seed }).unclear.map((u) => u.w.child)),
);
assert(children.size >= 5 && children.has("Timmy"), [...children].join());

// The end dial reads too little for few checks on automation, too much for checking everything, and
// in between for the sensible player.
const dial = (name) => results[name].map((r) => r.end.assurance);
console.log(
  `dial: ${["checkFew", "sensible", "checkAll"]
    .map(
      (n) =>
        `${n} ${Object.entries(Object.groupBy(dial(n), (a) => a.verdict))
          .map(([k, xs]) => `${k} ${xs.length}`)
          .join(", ")}`,
    )
    .join("; ")}`,
);
assert(
  shareOf(dial("checkFew"), (a) => a.verdict === "too little") >= 0.75,
  "checking a few reads too little",
);
assert(
  shareOf(dial("checkAll"), (a) =>
    ["too much", "bottleneck"].includes(a.verdict),
  ) >= 0.75,
  "checking everything reads too much or a bottleneck",
);
warn(
  shareOf(dial("sensible"), (a) => a.verdict === "about right") >= 0.5,
  "the sensible player mostly reads about right",
);
for (const a of dial("sensible"))
  assert.strictEqual(
    a.groups.reduce((n, g) => n + g.caught, 0),
    a.caught,
    "group catches add up",
  );

const kinds = new Set(
  Object.values(results)
    .flat()
    .flatMap((r) => [...r.kinds]),
);
for (const k of NEWS_KINDS) warn(kinds.has(k), `news kind ${k} is emitted`);

// Every control works from the first second.
{
  const w = new Workshop({ seed: 1 });
  assert(w.setAi(0, 2) && w.setAi(1, 1) && w.setChecking(2) && w.move(3, 0));
  assert(
    Object.values(w.view().actions).every((a) => a.why !== "Unlocks later"),
  );
}

// A full cocoa break from tired is short. By hand, reading falls behind once letters speed up, and
// the AI keeps the letter pile near empty.
{
  const w = new Workshop({ seed: 2 });
  w.elves[0].tired = 60;
  w.move(0, 3);
  let seconds = 0;
  while (w.view().elves[0].mood !== "fresh") {
    w.step(0.1);
    seconds += 0.1;
  }
  assert(seconds < 4, `a cocoa break from 60 takes ${seconds.toFixed(1)} s`);
  for (const seed of SEEDS.slice(0, 6)) {
    const hand = new Workshop({ seed });
    hand.step(35);
    const ai = new Workshop({ seed });
    ai.setAi(0, 2);
    ai.setAi(1, 2);
    ai.step(35);
    assert(
      hand.q.letters.length >= 8 && ai.q.letters.length <= 3,
      `seed ${seed}: by hand ${hand.q.letters.length} letters wait, with the AI ${ai.q.letters.length}`,
    );
  }
}

// An unclear letter waits for its decision: asking delays it and reads it right; a letter still
// waiting when the sleigh leaves is lost.
{
  const w = new Workshop({ seed: 5 });
  while (!w.view().case) w.step(0.5);
  const c = w.view().case;
  assert.strictEqual(c.kind, "unclear");
  assert(c.evidence[0].child && c.text.includes(c.evidence[0].child));
  const id = c.evidence[0].parcelId;
  assert(w.resolve(c.id, "ask"));
  w.step(ASK_SECONDS - 0.5);
  assert(w.view().case?.resolving, "the letter waits while the child answers");
  w.step(1);
  const x = w.q.orders.find((x) => x.id === id);
  assert(x && x.asked && !x.wrong, "an asked letter is read right");
  const lazy = new Workshop({ seed: 5 });
  while (!lazy.end) (lazy.step(1), lazy.choice && lazy.choose("none"));
  assert(lazy.view().end.lost >= 2, "unclear letters left undecided are lost");
}

// A full checking pile makes the line wait and lets nothing through by itself.
{
  const w = new Workshop({ seed: 4 });
  w.setAi(0, 2);
  w.setAi(1, 2);
  w.setChecking(2);
  let waited = 0;
  while (!w.end) {
    w.step(0.5);
    const v = w.view();
    if (v.choice) w.choose("none");
    if (v.queues.check.parcels.length >= v.queues.check.limit) {
      assert.strictEqual(
        v.queues.orders.parcels.length
          ? v.queues.orders.blocked
          : "the checking pile is full",
        "the checking pile is full",
      );
      waited++;
    }
  }
  checkGate(w);
  assert(waited > 0 && w.bypassed === 0, "the full pile made the line wait");
  const b = new Workshop({ seed: 4 });
  b.setAi(0, 2);
  b.setAi(1, 2);
  b.setChecking(2);
  b.step(30);
  const waiting = b.q.check.length;
  assert(
    waiting && b.bypass() && b.bypassed === waiting,
    "bypass lets the pile go",
  );
  assert(b.view().news.some((n) => n.kind === "bypassed"));
  checkGate(b);
}

// The lever figures must predict what the workshop then does over a steady stretch.
{
  let promised = 0;
  let did = 0;
  for (const seed of SEEDS.slice(0, 6)) {
    const w = new Workshop({ seed });
    w.step(20);
    const past = (v) =>
      v.queues.orders.parcels.length +
      v.queues.check.parcels.length +
      v.queues.pass.parcels.length +
      v.sleigh.right +
      v.sleigh.wrong +
      v.queues.rework.parcels.length;
    const before = past(w.view());
    for (let t = 20; t < 50; t++, w.step(1))
      promised += w.view().levers.ai0[0].perMinute / 30 / 6;
    did += ((past(w.view()) - before) * 2) / 6;
  }
  console.log(
    `levers: reading by hand promised ${promised.toFixed(1)}/min, did ${did.toFixed(1)}`,
  );
  warn(Math.abs(did - promised) <= 0.15 * promised, "reading lever is honest");
  const v = new Workshop({ seed: 1 }).view();
  for (const entry of [...v.levers.ai0, ...v.levers.ai1])
    for (const k of ["who", "speed", "risk"])
      warn(
        entry[k].split(/\s+/).length <= 6,
        `lever ${k} "${entry[k]}" is six words at most`,
      );
}

for (const w of warnings) console.log(`warning: ${w}`);
console.log(`\nall blocking checks passed, ${warnings.length} warnings`);
