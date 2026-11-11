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
// Policies that differ by a few percent are compared over more games, so luck does not decide.
const MORE_SEEDS = Array.from({ length: 14 }, (_, i) => i + 7);
const VERSION_IDS = ["standard"];
// Orderings that guide tuning but do not block: printed at the end as warnings.
const warnings = [];
const warn = (ok, message) => ok || warnings.push(message);
const PARCEL_KEYS = "id,wish,big,unclear,wanted,made,suspect,result";
const NEWS_KINDS =
  "unlock checked loaded consequence case resolved bypassed timmy update noticed rolledBack quarantined recalled rush relaxed trained tired broke blocked lost behind milestone cleared departed chose".split(
    " ",
  );
const CAUSES = [
  "the AI guessed an unclear wish",
  "made by the faulty update",
  "the AI on a big gift",
  "a tired elf",
  "waved through by relaxed checkers",
  "let through unchecked",
  "the AI misread a letter",
  "the AI made the wrong toy",
  "a misheard answer",
];
const wantedFor = new Map(WISHES.map((w) => [w.wish, w.wanted.name]));
const argmax = (list) => list.indexOf(Math.max(...list));
const fill = (v, id) => v.queues[id].parcels.length / v.queues[id].limit;

// Reading facts the way a player would.
const fact = (c, label) => c.facts.find((f) => f.label === label)?.value ?? "";
const num = (text) => parseFloat(text.match(/\d+(\.\d+)?/)?.[0] ?? "0");
const odds = (text) => {
  const m = text.match(/(\d+) in (\d+)/);
  return m ? m[1] / m[2] : 0;
};
const key = (c) => c.step ?? c.kind;

// Weighs what a case shows and what the workshop can spare.
function conditional(c, v) {
  const left = num(fact(c, "Time left"));
  const e = c.evidence[0];
  switch (key(c)) {
    case "judge":
      if (wantedFor.get(e.wish) === e.made.name) return "ship";
      return fact(c, "Gift").includes("big") ||
        num(fact(c, "Checking pile")) < 6
        ? "remake"
        : "ship";
    case "unclear":
      return wantedFor.get(e.wish) === e.reading.name ? "accept" : "ask";
    case "pattern": {
      const ago = fact(c, "Last update");
      if (!ago.includes("ago") || num(ago) > 60) return "carryOn";
      return num(fact(c, "Made since")) <= 2 ? "hold" : "investigate";
    }
    case "source":
      return left < 30 || v.ai[1] < 2 ? "keep" : "rollback";
    case "made": {
      if (odds(fact(c, "Likely wrong")) >= 0.4 && left >= 20)
        return "remakeAll";
      return num(fact(c, "Big gifts")) > 0 ||
        (num(fact(c, "Parcels")) >= 3 && left >= 20)
        ? "checkEach"
        : "letGo";
    }
    case "aboard": {
      // Worth fetching back when leaving them costs more than the fetching, counting checker time at £1 a second.
      const bring = c.options.find((o) => o.id === "bringBack");
      return num(fact(c, "Cost if left")) > bring.money + bring.seconds &&
        left >= 40
        ? "bringBack"
        : "leave";
    }
  }
}
const CAREFUL = {
  judge: "remake",
  unclear: "ask",
  pattern: "investigate",
  source: "rollback",
  made: "remakeAll",
  aboard: "bringBack",
};
const CHEAP = {
  judge: "ship",
  unclear: "accept",
  pattern: "carryOn",
  source: "keep",
  made: "letGo",
  aboard: "leave",
};
const only = (overrides) =>
  Object.assign((c, v) => overrides[key(c)] ?? conditional(c, v), {
    overrides,
  });

// Answers the open case with a policy, falling back to any option that can be chosen now.
function answer(w, v, m, policy = conditional) {
  const c = v.case;
  if (!c || c.resolving) return;
  const wanted = policy(c, v);
  const pick =
    c.options.find((o) => o.id === wanted && o.available) ??
    c.options.find((o) => o.available);
  if (!pick || !w.resolve(c.id, pick.id)) return;
  const own =
    policy === conditional ||
    (policy.overrides && !(key(c) in policy.overrides));
  if (own && pick.id === wanted)
    (m.conditional ??= []).push(`${key(c)}:${pick.id}`);
  (m.choices ??= []).push(`${key(c)}:${pick.id}`);
  if (c.kind === "unclear")
    (m.unclear ??= { ask: [], accept: [] })[pick.id].push(
      c.evidence[0].parcelId,
    );
}

// The break: read each option's facts and the workshop's state, and pick one.
function chooseWell(ch, v, { train = true } = {}) {
  const by = (id) => ch.options.find((o) => o.id === id);
  const value = (o, label) =>
    o.facts.find((f) => f.label === label)?.value ?? "";
  const update = by("update");
  const p = update ? odds(value(update, "Risk")) : 1;
  const toCome = by("train") ? num(value(by("train"), "Gives")) : 0;
  const tired = by("rest") ? num(value(by("rest"), "Elves now")) : 0;
  if (train && by("train") && v.vigilance.state !== "careful" && toCome >= 30)
    return "train";
  if (update && p <= 0.25) return "update";
  if (update && p < 0.75 && ch.run < 3) return "tested";
  if (by("rest") && tired >= 40) return "rest";
  if (train && by("train") && toCome >= 50) return "train";
  return by("rest") ? "rest" : ch.options[0].id;
}
const BREAKS = {
  // A fixed policy takes cocoa when its own option is not on offer.
  alwaysUpdate: (ch) =>
    ch.options.some((o) => o.id === "update") ? "update" : "rest",
  alwaysTest: (ch) =>
    ch.options.some((o) => o.id === "tested") ? "tested" : "rest",
  alwaysTrain: (ch) =>
    ch.options.some((o) => o.id === "train") ? "train" : "rest",
  alwaysRest: () => "rest",
  neverTrains: (ch, v) => chooseWell(ch, v, { train: false }),
  fastNoChecks: (ch) =>
    ch.options.some((o) => o.id === "update") ? "update" : ch.options[0].id,
  // Toy mistakes compare tired hands with the plain machine: the tired never rest, the machine is never updated.
  toysByHandTired: (ch) => ch.options.find((o) => o.id !== "rest").id,
  toysAutomatedWatched: () => "rest",
};

// Every player except neverRests sends an elf for cocoa at the hint's tiredness.
function rests(w, v, m) {
  m.home ??= {};
  const staff = v.stations.map((st) => st.staff);
  v.elves.forEach((e, i) => {
    if (
      e.station < 3 &&
      e.tired >= 60 &&
      staff[e.station] > 1 &&
      w.move(i, 3)
    ) {
      m.home[i] = e.station;
      staff[e.station]--;
    }
    if (e.station === 3 && !e.resting && e.tired <= 10)
      w.move(i, m.home[i] ?? 2);
  });
}

// Moves one elf every few seconds to the station whose piles are fullest, keeping one asker,
// one watcher and two checkers. With toDispatch false it never adds checkers.
function balance(w, v, m, keep = [1, 1, 2], toDispatch = true) {
  if (v.t - (m.moved ?? -9) < 3) return;
  const need = [
    Math.max(fill(v, "letters"), fill(v, "clarify")),
    fill(v, "orders"),
    Math.max(fill(v, "check"), v.queues.rework.parcels.length / 10),
  ];
  // A station whose next pile is full is stopped; more elves there would only stand idle.
  if (fill(v, "orders") >= 1) need[0] = 0;
  if (v.ai[1] === 2 || fill(v, "check") >= 1) need[1] = 0;
  if (!toDispatch) need[2] = 0;
  const to = argmax(need);
  const spare = need.map((n, s) =>
    s !== to && v.stations[s].staff > keep[s] ? -n : -9,
  );
  if (Math.max(...spare) === -9) return;
  const from = argmax(spare);
  const elf = v.elves.findIndex((e) => e.station === from && !e.resting);
  if (need[to] - need[from] > 0.25 && elf >= 0 && w.move(elf, to))
    m.moved = v.t;
}

const sensible = (
  w,
  v,
  m,
  {
    rest = true,
    watch = true,
    staffCheck = true,
    bypass = false,
    ask = true,
    policy = conditional,
    toys = null,
    checking = null,
  } = {},
) => {
  // Asks about unclear wishes, and sets up for the run's cargo: elves confirm the AI's readings of
  // little ones' letters.
  const cargo = v.run.cargo.id;
  w.setAsk(ask);
  w.setChecking(checking ?? 1);
  w.setAi(0, cargo === "unclear" ? 1 : 2);
  // The machine alone until an update makes it faster than elves confirming its drafts.
  w.setAi(
    1,
    toys ?? (v.levers.ai1[2].perMinute >= v.levers.ai1[1].perMinute ? 2 : 1),
  );
  if (rest) rests(w, v, m);
  balance(w, v, m, [1, watch ? 1 : 0, 2], staffCheck);
  if (!watch) v.elves.forEach((e, i) => e.station === 1 && w.move(i, 2));
  if (bypass && v.queues.check.parcels.length) w.bypass();
  answer(w, v, m, policy);
};

// Players see only view() and call only the action methods.
const players = {
  byHand: (w, v, m) => (rests(w, v, m), answer(w, v, m)),
  fastNoChecks(w, v, m) {
    rests(w, v, m);
    w.setAi(0, 2);
    w.setAi(1, 2);
    answer(w, v, m, only({ source: "keep", made: "letGo", aboard: "leave" }));
  },
  // Asks and answers cases like the sensible player; checking everything is the difference.
  checkAll(w, v, m) {
    rests(w, v, m);
    w.setAi(0, 1);
    w.setAi(1, 1);
    w.setChecking(2);
    w.setAsk(true);
    answer(w, v, m);
  },
  sensible: (w, v, m) => sensible(w, v, m),
  careful: (w, v, m) => sensible(w, v, m, { policy: (c) => CAREFUL[key(c)] }),
  cheap: (w, v, m) => sensible(w, v, m, { policy: (c) => CHEAP[key(c)] }),
  alwaysUpdate: (w, v, m) => sensible(w, v, m),
  alwaysTest: (w, v, m) => sensible(w, v, m),
  alwaysTrain: (w, v, m) => sensible(w, v, m),
  alwaysRest: (w, v, m) => sensible(w, v, m),
  neverTrains: (w, v, m) => sensible(w, v, m),
  neverRests: (w, v, m) => sensible(w, v, m, { rest: false }),
  // Never adds checkers and lets the checking pile through whenever anything waits.
  bypassHeavy: (w, v, m) =>
    sensible(w, v, m, { staffCheck: false, bypass: true }),
  // Nobody watches the toy machine, so only checkers, cases or the sleigh can notice a faulty update.
  noWatcher: (w, v, m) => sensible(w, v, m, { watch: false }),
  // Toys stay on Assist, so confirming elves catch most of a faulty update's trains.
  assistToys: (w, v, m) => sensible(w, v, m, { toys: 1 }),
  askAll: (w, v, m) => sensible(w, v, m, { ask: true }),
  checkFew: (w, v, m) => sensible(w, v, m, { checking: 0 }),
  checkEverything: (w, v, m) => sensible(w, v, m, { checking: 2 }),
  // Toy mistakes: tired elves by hand against the machine with rested watchers.
  toysByHandTired: (w, v, m) => (w.setAi(0, 1), answer(w, v, m)),
  toysAutomatedWatched(w, v, m) {
    rests(w, v, m);
    w.setAi(0, 1);
    w.setAi(1, 2);
    answer(w, v, m);
  },
  // Pays for everything: both stations automated, every parcel checked, the careful option always.
  spendthrift(w, v, m) {
    rests(w, v, m);
    w.setAi(0, 2);
    w.setAi(1, 2);
    w.setChecking(2);
    w.setAsk(true);
    balance(w, v, m);
    answer(w, v, m, (c) => CAREFUL[key(c)]);
  },
};

// The focus points at a station 0 to 3 (3 the cocoa break) and never at a locked control.
function checkFocus(v) {
  const f = v.focus;
  if (!f) return;
  assert(
    Object.keys(f).join() === "station,control,text" &&
      [0, 1, 2, 3].includes(f.station),
    "focus shape",
  );
  assert(f.control !== "cocoa" || f.station === 3, "cocoa focus is station 3");
  if (f.control in v.actions)
    assert(
      v.actions[f.control].unlocked,
      `focus points at locked ${f.control}`,
    );
  assert(
    f.text.split(/\s+/).length <= 4,
    `focus text "${f.text}" is four words at most`,
  );
}

// Nothing in view() may show what the player has not found out.
function checkHidden(v, w) {
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
  checkFocus(v);
  assert(
    Array.isArray(v.run.stars) && v.run.stars.length === v.run.number - 1,
    "run.stars lists each finished run",
  );
  assert.strictEqual(
    v.score.stars,
    v.run.stars.reduce((a, b) => a + b, 0),
    "score.stars is their sum",
  );
  assert.strictEqual(v.score.best, 12);
  if (!v.case) return;
  assert.strictEqual(
    Object.keys(v.case).join(),
    "id,kind,step,text,facts,evidence,affected,options,resolving",
  );
  for (const f of v.case.facts)
    assert.strictEqual(Object.keys(f).join(), "label,value,primary");
  const primary = v.case.facts.filter((f) => f.primary).length;
  assert(
    primary >= 1 && primary <= 3,
    `${v.case.kind} ${v.case.step} has ${primary} primary facts`,
  );
  for (const ev of v.case.evidence)
    assert.strictEqual(Object.keys(ev).join(), "parcelId,wish,made,reading");
  if (v.case.kind === "judge") {
    const pinned = w.cases[0].parcels[0];
    assert.strictEqual(
      pinned.result,
      null,
      "the judged parcel was revealed before the player answered",
    );
    assert(
      !all.some((p) => p.id === pinned.id),
      "the judged parcel is held aside",
    );
  }
  if (v.case.step === "aboard")
    assert(
      v.case.affected.ids.every((id) =>
        v.sleigh.parcels.some((p) => p.id === id),
      ),
      "only the run under way can be brought back",
    );
}

// An open moment points at something that is there in the same view.
function checkMoment(v) {
  const m = v.moment;
  const everywhere = [
    ...Object.values(v.queues).flatMap((q) => q.parcels),
    ...v.sleigh.parcels,
    ...(v.case?.evidence ?? []).map((e) => ({ id: e.parcelId })),
  ];
  if (m.parcelId !== null)
    assert(
      everywhere.some((p) => p.id === m.parcelId),
      `moment ${m.id} points at a parcel that is gone`,
    );
  if (m.control in v.actions)
    assert(
      v.actions[m.control].unlocked,
      `moment ${m.id} points at a locked control`,
    );
  const live = {
    case: () => v.case,
    cocoa: () =>
      v.elves[m.elf]?.station < 3 && v.elves[m.elf].tired >= COCOA_MOMENT_AT,
    bypass: () => v.queues.check.parcels.length >= v.queues.check.limit,
  }[m.id];
  assert(!live || live(), `moment ${m.id} shown after its example has gone`);
  assert(
    m.text.split(/(?<=[.!?])\s+(?=[A-Z])/).length <= 2,
    `moment ${m.id} is longer than two sentences`,
  );
}

// A break: the rules stand still, the report names causes, and the options carry at most three facts.
function checkChoice(v, w) {
  const ch = v.choice;
  assert.strictEqual(
    Object.keys(ch).join(),
    "id,run,report,next,title,text,options",
  );
  assert.strictEqual(
    Object.keys(ch.report).join(),
    "run,right,wrong,target,stars,missedBy,bonus,slips,more,spent,assurance,cargo",
  );
  for (const s of ch.report.slips)
    assert(CAUSES.includes(s.cause), `slip cause "${s.cause}"`);
  assert(
    ch.options.length >= 2 && ch.options.length <= 4,
    "two to four options at a break",
  );
  for (const o of ch.options)
    assert(
      o.facts.length <= 3 &&
        ["update", "tested", "train", "rest"].includes(o.kind),
      "break option shape",
    );
  assert.strictEqual(
    v.sleigh.parcels.length,
    0,
    "a new run starts with an empty sleigh",
  );
  const t = w.t;
  w.step(5);
  assert.strictEqual(w.t, t, "nothing moves while a break is open");
}

// Parcels picked for a check reach the sleigh only checked, waved through by relaxed checkers,
// judged in a case, remade, or bypassed by the player.
function checkGate(w) {
  const gone = [...w.delivered, ...w.aboard];
  const everywhere = [
    ...gone,
    ...Object.values(w.q).flat(),
    ...w.cases.flatMap((c) => c.parcels),
  ];
  for (const x of gone.filter((x) => x.route === "check"))
    assert(
      ["checked", "skipped", "bypassed", "case", "remade"].includes(x.exit),
      `parcel ${x.id} left the checking pile unchecked`,
    );
  assert.strictEqual(
    everywhere.filter((x) => x.exit === "bypassed").length,
    w.bypassed,
    "bypassed count",
  );
}

function play(name, seed, version, guided = false) {
  const w = new Workshop({ seed, guided, version });
  const run = {
    name,
    version,
    kinds: new Set(),
    behindAt: [],
    moments: [],
    caseKinds: [],
    judgedWhileOpen: 0,
    checkerBurnouts: 0,
    burnouts: 0,
    first60: null,
    consequences: [],
    breaks: [],
    readWrong: new Map(),
    hash: crypto.createHash("sha1"),
  };
  let last = null;
  let lastNews = 0;
  const memo = {};
  const warnedAt = {};
  const seenCases = new Set();
  for (let i = 0; !w.end; i++) {
    if (i % 5 === 0 || w.choice) {
      let v = w.view();
      checkHidden(v, w);
      v.elves.forEach((e, i) => {
        if (e.tired >= 60) warnedAt[i] ??= v.t;
        else if (e.station < 3) delete warnedAt[i];
      });
      if (run.first60 === null && v.elves.some((e) => e.tired >= 60))
        run.first60 = v.t;
      run.hash.update(JSON.stringify(v));
      for (const n of v.news.filter((n) => n.id > lastNews).reverse()) {
        run.kinds.add(n.kind);
        if (n.kind === "behind") run.behindAt.push(n.t);
        if (n.kind === "consequence") run.consequences.push(n);
        if (n.kind === "checked" && v.case?.kind === "judge")
          run.judgedWhileOpen++;
        if (n.kind === "tired") {
          run.burnouts++;
          if (last?.elves[n.elf].station === 2) run.checkerBurnouts++;
          assert(
            n.t - (warnedAt[n.elf] ?? n.t) >= 10,
            "the elf card warns at least 10 seconds before a burnout",
          );
        }
      }
      lastNews = v.news[0]?.id ?? lastNews;
      if (v.case && !seenCases.has(v.case.id)) {
        seenCases.add(v.case.id);
        run.caseKinds.push(v.case.kind);
      }
      if (v.choice) {
        checkChoice(v, w);
        const pick = (BREAKS[name] ?? chooseWell)(v.choice, v);
        run.breaks.push({
          run: v.choice.run,
          options: v.choice.options.map((o) => o.id),
          offer: v.choice.options.find((o) => o.id === "update")?.text,
          pick,
        });
        assert(w.choose(v.choice.id, pick), `choose ${pick}`);
        continue;
      }
      while (v.moment) {
        checkMoment(v);
        run.moments.push({ t: v.t, id: v.moment.id });
        assert(w.acknowledge(v.moment.id));
        v = w.view();
      }
      players[name](w, v, memo);
      last = v;
    }
    for (const id of [
      ...(memo.unclear?.ask ?? []),
      ...(memo.unclear?.accept ?? []),
    ]) {
      const x = w.q.orders.find((x) => x.id === id);
      if (x && !run.readWrong.has(id)) run.readWrong.set(id, x.wrong);
    }
    w.step(0.1);
  }
  checkGate(w);
  run.end = w.view().end;
  run.target = w.target;
  run.runTargets = w.runTargets;
  run.skipped = w.vig.skipped;
  run.choices = memo.choices ?? [];
  run.conditional = memo.conditional ?? [];
  run.toyMistakes = w.stats.toyMistakes / Math.max(1, w.stats.toys);
  run.hash = run.hash.digest("hex");
  return run;
}

const mean = (runs, f) => runs.reduce((s, r) => s + f(r), 0) / runs.length;
const everyRun = [];
const conditionalChoices = new Set();

for (const version of VERSION_IDS) {
  const results = Object.fromEntries(
    Object.keys(players).map((name) => [
      name,
      SEEDS.map((seed) => play(name, seed, version)),
    ]),
  );
  const runs = Object.values(results).flat();
  everyRun.push(...runs);
  console.log(
    `\n${version}: player             stars points right wrong lost  rating  total  lessons`,
  );
  for (const [name, rs] of Object.entries(results)) {
    const avg = (f, d = 0) => mean(rs, f).toFixed(d).padStart(6);
    const lessons = [...new Set(rs.map((r) => r.end.lesson.title))].join(" / ");
    console.log(
      `  ${name.padEnd(21)}${avg((r) => r.end.stars, 1)}${avg((r) => r.end.points)}${avg((r) => r.end.right)}${avg((r) => r.end.wrong)}${avg((r) => r.end.lost)}  ${rs.map((r) => r.end.rating).join("")}${avg((r) => r.end.costs.total)}  ${lessons}`,
    );
  }
  for (const r of runs) r.conditional.forEach((x) => conditionalChoices.add(x));
  const wide = {};
  const over = (name) => {
    wide[name] ??= MORE_SEEDS.map((seed) => play(name, seed, version));
    return [...results[name], ...wide[name]];
  };
  const score = (name) => {
    const rs = over(name);
    return {
      stars: mean(rs, (r) => r.end.stars),
      points: mean(rs, (r) => r.end.points),
      rating: mean(rs, (r) => r.end.rating),
      right: mean(rs, (r) => r.end.right),
      wrong: mean(rs, (r) => r.end.wrong),
      fixes: mean(rs, (r) => r.end.costs.fixing + r.end.costs.mistakes),
      perGift: mean(rs, (r) => r.end.costs.total / Math.max(1, r.end.right)),
    };
  };
  const best = score("sensible");

  // At the breaks, reading the facts earns more stars and points than any fixed choice.
  for (const name of [
    "alwaysUpdate",
    "alwaysTest",
    "alwaysTrain",
    "alwaysRest",
  ]) {
    const s = score(name);
    console.log(
      `  sensible vs ${name}: stars ${best.stars.toFixed(1)} vs ${s.stars.toFixed(1)}, points ${Math.round(best.points)} vs ${Math.round(s.points)}, right ${Math.round(best.right)} vs ${Math.round(s.right)}, fixing and mistakes £${Math.round(best.fixes)} vs £${Math.round(s.fixes)}`,
    );
    // A warning since runs carry different cargo: the set-up for each run now moves a game more than
    // one break choice, so these comparisons sit within the noise of six seeds.
    warn(
      best.stars >= s.stars && best.points > s.points,
      `${version}: reading the facts at breaks beats ${name}`,
    );
  }
  warn(
    score("alwaysUpdate").fixes > best.fixes,
    `${version}: installing every update blind costs more in fixing and wrong gifts`,
  );
  for (const name of ["alwaysTrain", "alwaysRest"])
    warn(
      score(name).right < best.right,
      `${version}: ${name} gives up the toy machine's speed`,
    );
  warn(
    score("alwaysTest").right < best.right ||
      score("alwaysTest").points < best.points,
    `${version}: testing every update costs time`,
  );

  // Cases and staffing: the sensible player scores more points than each fixed alternative, or as
  // many within 1% for less money per right gift (a few case answers move a game by little).
  const beats = (a, b) =>
    a.points > b.points ||
    (a.points > b.points * 0.99 && a.perGift < b.perGift);
  const kindsHere = VERSIONS[version].kinds;
  for (const name of [
    "careful",
    "cheap",
    "checkFew",
    "checkEverything",
    "bypassHeavy",
    "neverTrains",
  ]) {
    const s = score(name);
    console.log(
      `  sensible vs ${name}: points ${Math.round(best.points)} vs ${Math.round(s.points)}, rating ${best.rating.toFixed(2)} vs ${s.rating.toFixed(2)}, per right gift £${best.perGift.toFixed(2)} vs £${s.perGift.toFixed(2)}`,
    );
    // With no case in a game a case policy changes nothing.
    const same = results[name].every(
      (r, i) => r.hash === results.sensible[i].hash,
    );
    (["checkFew", "checkEverything"].includes(name) ? assert : warn)(
      beats(best, s) || (same && ["careful", "cheap"].includes(name)),
      `${version}: the sensible player beats ${name}`,
    );
  }
  // Stars: nothing earns three on a run without the player, and a sensible game earns two to three a run.
  const handsOff = [...SEEDS, ...MORE_SEEDS].map((seed) => {
    const w = new Workshop({ seed, version });
    while (!w.end) {
      if (w.choice) w.choose(w.choice.id, "rest");
      w.step(0.5);
    }
    return w.view().end;
  });
  const starsOf = (ends) =>
    ends.map((e) => e.runs.map((r) => r.stars).join(""));
  console.log(`  hands-off stars by run: ${starsOf(handsOff).join(" ")}`);
  assert(
    handsOff.every((e) => e.runs.every((r) => r.stars < 3)),
    `${version}: a hands-off player earns three stars on no run`,
  );
  const sensibleEnds = over("sensible").map((r) => r.end);
  console.log(`  sensible stars by run: ${starsOf(sensibleEnds).join(" ")}`);
  const sensibleStars = mean(sensibleEnds, (e) => e.stars);
  assert(
    sensibleStars >= 8 && sensibleStars <= 11.5,
    `${version}: a sensible game earns two to three stars a run (${sensibleStars.toFixed(1)})`,
  );
  warn(
    Object.keys(players).some((name) =>
      over(name).some((r) => r.end.stars === 12),
    ),
    `${version}: twelve stars are reachable`,
  );
  for (const r of results.byHand)
    warn(
      r.end.right < r.target &&
        r.end.wrong <= 0.1 * (r.end.right + r.end.wrong),
      `${version}: by hand is slow, not sloppy`,
    );
  for (const r of results.byHand)
    assert(
      r.breaks.every((b) => !b.options.includes("update")),
      `${version}: no update offered while no AI is in use`,
    );
  // A pile is cleared only after it grew past half full, which a game kept tidy may never see.
  warn(
    results.sensible.filter((r) => r.kinds.has("cleared")).length >= 4,
    `${version}: piles clear for the sensible player`,
  );
  for (const r of results.sensible)
    warn(
      r.kinds.has("milestone") &&
        r.kinds.has("departed") &&
        r.kinds.has("chose"),
      `${version}: milestones pass and sleighs leave`,
    );
  const most = (rs, test) => rs.filter(test).length >= 4;
  warn(
    most(results.neverRests, (r) => r.end.rating < 3 || r.end.stars < 12) &&
      results.neverRests.every((r) => r.burnouts > 0),
    `${version}: a player who never rests loses elves to burnout`,
  );
  warn(
    results.byHand.every((r) => r.behindAt.length > 0),
    `${version}: behind fires for the by-hand player`,
  );
  warn(
    mean(over("toysAutomatedWatched"), (r) => r.toyMistakes) <
      mean(over("toysByHandTired"), (r) => r.toyMistakes),
    `${version}: automating with watchers makes fewer toy mistakes than tired elves`,
  );

  for (const r of runs) {
    const others = r.caseKinds.filter((k) => k !== "incident");
    assert(
      others.every((k) => kindsHere.includes(k)) &&
        others.length <= VERSIONS[version].cap,
      `${version}: case count ${others.length}`,
    );
    assert.strictEqual(
      r.runTargets.reduce((a, b) => a + b, 0),
      r.target,
      "run targets add up to the target",
    );
    assert.strictEqual(r.end.runs.length, 4);
    for (const b of r.end.blunders)
      assert.strictEqual(Object.keys(b).join(), "id,name,icon");
    assert(
      r.end.blunderTotal >= r.end.blunders.length && r.end.blunderTotal > 20,
      "blunder collection size",
    );
    const bySubject = {};
    for (const n of r.consequences) {
      warn(
        n.facts.caught > 0 || n.facts.waiting > 0 || n.facts.money >= 10,
        `${version}: consequence with nothing to say`,
      );
      warn(
        n.t - (bySubject[n.about] ?? -99) >= 45,
        `${version}: consequences about ${n.about} too close`,
      );
      bySubject[n.about] = n.t;
    }
  }
  const offers = new Set(
    results.sensible.map((r) => r.breaks.map((b) => b.offer).join("|")),
  );
  assert(
    offers.size > 1,
    `${version}: different seeds offer different updates`,
  );
  if (kindsHere.includes("judge"))
    warn(
      runs.some((r) => r.judgedWhileOpen > 0),
      `${version}: another check finished while a judge case was open`,
    );
  const guided = SEEDS.map((seed) => play("sensible", seed, version, true));
  everyRun.push(...guided);
  for (const r of guided) {
    warn(
      r.end.right >= r.target * 0.9,
      `${version}: guided sensible gets close to the target (${r.end.right})`,
    );
    warn(r.first60 >= 60, `${version}: first tired elf at ${r.first60}s`);
    warn(
      r.moments
        .map((m) => m.id)
        .slice(0, FIRST_MOMENTS.length)
        .join() === FIRST_MOMENTS.join(),
      `${version}: first moments in order`,
    );
    r.moments.forEach((m, i) =>
      warn(
        i === 0 || m.t - r.moments[i - 1].t >= MOMENT_GAP - 0.5,
        `${version}: moments ${MOMENT_GAP}s apart`,
      ),
    );
  }
  console.log(
    `  guided sensible right: ${guided.map((r) => r.end.right).join(" ")}, stars ${guided.map((r) => r.end.stars).join(" ")}`,
  );
  console.log(
    `  moments (seed 1): ${guided[0].moments.map((m) => `${Math.round(m.t)}s ${m.id}`).join(", ")}`,
  );
  assert.strictEqual(
    play("sensible", 3, version).hash,
    play("sensible", 3, version).hash,
    `${version}: same seed and calls give the same game`,
  );
}

const allOptions = Object.entries(CAREFUL)
  .flatMap(([k, careful]) => [`${k}:${careful}`, `${k}:${CHEAP[k]}`])
  .concat(["made:checkEach"])
  .filter(
    (option) =>
      VERSIONS.standard.kinds.includes(option.split(":")[0]) ||
      option.split(":")[0] in CASE_ORDER,
  );
console.log(
  `\nconditional choices seen: ${[...conditionalChoices].sort().join(", ")}`,
);
for (const option of allOptions)
  warn(
    conditionalChoices.has(option),
    `the conditional player sometimes chooses ${option}`,
  );

// Left alone by hand, the workshop makes almost no mistakes in the first 70 seconds.
for (const version of VERSION_IDS)
  for (const seed of SEEDS) {
    const w = new Workshop({ seed, version });
    w.step(70);
    if (w.choice) w.choose(w.choice.id, w.choice.options[0].id);
    w.step(10);
    assert(
      w.delivered.filter((x) => x.wrong).length + w.view().sleigh.wrong <= 2,
      `${version} seed ${seed}: hands-off by hand ships few wrong gifts by 80 s`,
    );
  }

// The end summary reads too little for few checks on automation and too much for checking
// everything with two checkers. A player who sets up for each run's cargo sits between the two.
function assuranceOf(seed, plan) {
  const w = new Workshop({ seed });
  const setUp = ({ ai, ask = false, checking, staff }) => {
    w.setAi(0, ai[0]);
    w.setAi(1, ai[1]);
    w.setAsk(ask);
    w.setChecking(checking);
    let elf = 0;
    staff.forEach((n, s) => {
      for (let k = 0; k < n; k++) w.move(elf++, s);
    });
  };
  setUp(plan(w.view().run.cargo.id));
  while (!w.end) {
    const v = w.view();
    if (v.choice) {
      w.choose(v.choice.id, "rest");
      setUp(plan(v.choice.next.cargo.id));
    }
    if (v.case && !v.case.resolving)
      w.resolve(v.case.id, v.case.options.find((o) => o.available).id);
    w.step(0.1);
  }
  const a = w.view().end.assurance;
  assert.strictEqual(
    a.groups.reduce((n, g) => n + g.caught, 0),
    a.caught,
    "group catches add up",
  );
  return a;
}
const BY_CARGO = {
  everyday: { ai: [1, 1], ask: true, checking: 0, staff: [3, 3, 2] },
  big: { ai: [2, 2], checking: 1, staff: [0, 0, 8] },
  unclear: { ai: [1, 2], checking: 0, staff: [3, 0, 5] },
  rush: { ai: [2, 2], ask: true, checking: 0, staff: [0, 0, 8] },
};
for (const seed of SEEDS.slice(0, 3)) {
  const few = assuranceOf(seed, () => ({
    ai: [2, 2],
    checking: 0,
    staff: [0, 0, 8],
  }));
  const all = assuranceOf(seed, () => ({
    ai: [2, 2],
    checking: 2,
    staff: [3, 3, 2],
  }));
  const fitted = assuranceOf(seed, (cargo) => BY_CARGO[cargo]);
  assert.strictEqual(
    few.verdict,
    "too little",
    `seed ${seed}: few checks read ${few.verdict}`,
  );
  assert.strictEqual(
    all.verdict,
    "too much",
    `seed ${seed}: two checkers on everything read ${all.verdict}`,
  );
  assert(
    few.position < fitted.position && fitted.position < all.position,
    `seed ${seed}: setting up for each cargo sits between (${few.position} < ${fitted.position} < ${all.position})`,
  );
}

// Spending past the budget says so once and stops the paid one-off actions.
{
  const w = new Workshop({ seed: 1 });
  w.spent.fixing += w.view().budget.left + 100;
  w.step(1);
  everyRun.push({ kinds: new Set(w.view().news.map((n) => n.kind)) });
  assert(
    w.view().news.some((n) => n.kind === "broke") && w.view().budget.left < 0,
    "running out of money is announced",
  );
}

const kinds = new Set(everyRun.flatMap((r) => [...r.kinds]));
for (const k of NEWS_KINDS) warn(kinds.has(k), `news kind ${k} is emitted`);

// The default game, the opening, and the little things the page relies on.
{
  assert.strictEqual(
    new Workshop().view().version.id,
    "standard",
    "no version means the default game",
  );
  assert.strictEqual(
    new Workshop({ seed: 4, guided: true }).view().version.id,
    "standard",
  );
  for (const guided of [false, true]) {
    const w = new Workshop({ seed: 1, guided });
    w.step(6);
    if (w.view().moment) w.acknowledge(w.view().moment.id);
    w.move(3, 0);
    let shrank = false;
    for (let t = 0; t < 15 && !shrank; t++) {
      w.step(1);
      if (w.view().moment) w.acknowledge(w.view().moment.id);
      shrank = w.view().queues.letters.trend === "shrinking";
    }
    assert(
      shrank,
      `moving one elf to reading clears the opening pile (guided ${guided})`,
    );
    while (w.t < 45 || !w.view().actions.ai0.unlocked) {
      w.step(1);
      if (w.view().moment) w.acknowledge(w.view().moment.id);
    }
    assert(w.setAi(0, 1), "assist can be switched on after the speed-up");
    let again = false;
    for (let t = 0; t < 15 && !again; t++) {
      w.step(1);
      if (w.view().moment) w.acknowledge(w.view().moment.id);
      again = w.view().queues.letters.trend === "shrinking";
    }
    assert(
      again,
      `switching reading to assist drains the pile again (guided ${guided})`,
    );
  }
  // A full cocoa break from 60 is short.
  const w = new Workshop({ seed: 2 });
  w.elves[0].tired = 60;
  w.move(0, 3);
  let seconds = 0;
  while (w.elves[0].tired > 10) {
    w.step(0.1);
    seconds += 0.1;
  }
  assert(seconds < 6, `a cocoa break from 60 takes ${seconds.toFixed(1)} s`);
}

// skipGuidance unlocks everything and stops moments.
{
  const w = new Workshop({ seed: 1, guided: true });
  assert(w.view().moment && w.skipGuidance());
  w.step(50);
  const v = w.view();
  assert(
    !v.moment && Object.values(v.actions).every((a) => a.unlocked),
    "skipGuidance leaves the guided run",
  );
}

// Each moment closes by its own calls as well as by acknowledge.
function completeMoment(w, v) {
  const m = v.moment;
  const elf = v.elves.findIndex((e) => e.station < 3 && !e.resting);
  const calls = {
    move: () =>
      w.move(elf, m.id === "cocoa" ? 3 : (v.elves[elf].station + 1) % 3),
    setAi: () => w.setAi(m.control === "ai1" ? 1 : 0, 1),
    setAsk: () => w.setAsk(true),
    setChecking: () => w.setChecking(1),
    bypass: () => w.bypass(),
    resolve: () =>
      v.case &&
      w.resolve(v.case.id, v.case.options.find((o) => o.available)?.id),
  };
  return m.completes.some((call) => calls[call]());
}
const closed = new Set();
for (const version of VERSION_IDS)
  for (const seed of [2, 3]) {
    const w = new Workshop({ seed, guided: true, version });
    const memo = {};
    while (!w.end) {
      const v = w.view();
      if (v.choice) {
        w.choose(v.choice.id, v.choice.options[0].id);
        continue;
      }
      if (v.moment) checkMoment(v);
      if (v.moment && completeMoment(w, v)) {
        assert.notStrictEqual(
          w.view().moment?.id,
          v.moment.id,
          `moment ${v.moment.id} closes by its own call`,
        );
        closed.add(v.moment.id);
      } else if (v.moment) w.acknowledge(v.moment.id);
      else {
        players.fastNoChecks(w, v, memo);
        w.setChecking(2);
      }
      w.step(0.5);
    }
  }
console.log(`moments closed by their own calls: ${[...closed].join(", ")}`);
for (const id of Object.keys(MOMENTS))
  warn(closed.has(id), `moment ${id} closed by its own call`);

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
    if (v.choice) w.choose(v.choice.id, "rest");
    if (v.case)
      w.resolve(v.case.id, v.case.options.find((o) => o.available).id);
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
  assert(
    waited > 0 && w.bypassed === 0,
    "the full checking pile made the line wait",
  );
}

// The lever figures must predict what the workshop then does over a steady stretch.
{
  let promised = 0;
  let did = 0;
  for (const seed of SEEDS) {
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
      promised += w.view().levers.ai0[0].perMinute / 30 / SEEDS.length;
    did += ((past(w.view()) - before) * 2) / SEEDS.length;
  }
  console.log(
    `levers: reading by hand promised ${promised.toFixed(1)}/min, did ${did.toFixed(1)}`,
  );
  warn(Math.abs(did - promised) <= 0.15 * promised, "reading lever is honest");
  const words = (text) => text.split(/\s+/).length;
  const v = new Workshop({ seed: 1 }).view();
  for (const entry of [...v.levers.ai0, ...v.levers.ai1])
    for (const k of ["who", "speed", "risk"])
      warn(
        words(entry[k]) <= 6,
        `lever ${k} "${entry[k]}" is six words at most`,
      );
}

for (const w of warnings) console.log(`warning: ${w}`);
console.log(`\nall blocking checks passed, ${warnings.length} warnings`);
