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
const VERSION_IDS = ["piles", "cases", "calm"];
const PARCEL_KEYS = "id,wish,big,unclear,wanted,made,suspect,result";
const NEWS_KINDS =
  "unlock checked loaded consequence case resolved bypassed timmy update noticed rolledBack quarantined recalled rush relaxed trained tired broke blocked lost behind".split(
    " ",
  );
const wantedFor = new Map(WISHES.map((w) => [w.wish, w.wanted.name]));
const argmax = (list) => list.indexOf(Math.max(...list));
const fill = (v, id) => v.queues[id].parcels.length / v.queues[id].limit;

// Every player except neverRests sends an elf for cocoa at the hint's tiredness, so each player
// differs from the sensible one in the one thing its name says.
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

// Answers cases as a careful player would: judges the toy against the wish, asks, investigates.
// `unclear` forces the answer to unclear cases, and the letters answered each way are remembered.
function answer(w, v, m = {}, unclear = null) {
  const c = v.case;
  if (!c || c.resolving) return;
  const ok = (id) => c.options.find((o) => o.id === id && o.available);
  const pick =
    c.kind === "judge"
      ? wantedFor.get(c.evidence[0].wish) === c.evidence[0].made.name
        ? "ship"
        : "remake"
      : c.kind === "unclear"
        ? (unclear ?? (ok("ask") ? "ask" : "accept"))
        : ok("investigate")
          ? "investigate"
          : ok("hold")
            ? "hold"
            : "carryOn";
  if (!ok(pick) || !w.resolve(c.id, pick) || c.kind !== "unclear") return;
  m.unclear ??= { ask: [], accept: [] };
  m.unclear[pick].push(c.evidence[0].parcelId);
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
  if (v.ai[1] === 2) need[1] = 0;
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

function respond(w, v, m) {
  if (v.incident?.known) w.rollback();
  if (
    v.incident?.suspectWaiting >= 2 &&
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
}

// Players see only view() and call only the action methods.
const players = {
  byHand: rests,
  fastNoChecks(w, v, m) {
    rests(w, v, m);
    w.setAi(0, 2);
    w.setAi(1, 2);
  },
  // Asks, trains, answers cases and rolls back like the sensible player; checking everything is the difference.
  checkAll(w, v, m) {
    rests(w, v, m);
    w.setAi(0, 1);
    w.setAi(1, 1);
    w.setChecking(2);
    w.setAsk(true);
    if (v.t >= 80) w.train();
    answer(w, v);
    if (v.incident?.known) w.rollback();
  },
  sensible(
    w,
    v,
    m,
    {
      update = true,
      rest = true,
      train = true,
      watch = true,
      staffCheck = true,
      bypass = false,
      ask = true,
      unclear = null,
    } = {},
  ) {
    w.setAsk(ask);
    w.setChecking(1);
    w.setAi(0, 2);
    w.setAi(1, 2);
    if (rest) rests(w, v, m);
    if (train && v.t >= 80) w.train();
    balance(w, v, m, [1, watch ? 1 : 0, 2], staffCheck);
    if (!watch) v.elves.forEach((e, i) => e.station === 1 && w.move(i, 2));
    if (bypass && fill(v, "check") >= 0.3) w.bypass();
    answer(w, v, m, unclear);
    if (update) respond(w, v, m);
  },
  lateOnUpdate: (w, v, m) => players.sensible(w, v, m, { update: false }),
  neverRests: (w, v, m) => players.sensible(w, v, m, { rest: false }),
  neverTrains: (w, v, m) => players.sensible(w, v, m, { train: false }),
  // Never adds checkers and lets the checking pile through whenever three parcels wait.
  bypassHeavy: (w, v, m) =>
    players.sensible(w, v, m, { staffCheck: false, bypass: true }),
  // Nobody watches the toy machine, so only checkers, cases or the sleigh can notice the update.
  noWatcher: (w, v, m) => players.sensible(w, v, m, { watch: false }),
  // Asking is off, so unclear big gifts come as cases: one player asks the child, one accepts the AI.
  askUnclear: (w, v, m) =>
    players.sensible(w, v, m, { ask: false, unclear: "ask" }),
  acceptUnclear: (w, v, m) =>
    players.sensible(w, v, m, { ask: false, unclear: "accept" }),
  // Skips checking and fixes mistakes after loading instead: must not beat checking first.
  recallHappy(w, v, m) {
    rests(w, v, m);
    w.setAi(0, 2);
    w.setAi(1, 2);
    w.setAsk(true);
    if (v.incident?.known) w.rollback();
    w.recall();
  },
  // Toy mistakes: tired elves by hand against the machine with rested watchers.
  toysByHandTired(w) {
    w.setAi(0, 1);
  },
  toysAutomatedWatched(w, v, m) {
    rests(w, v, m);
    w.setAi(0, 1);
    w.setAi(1, 2);
    if (v.incident?.known) w.rollback();
  },
};

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
  if (!v.case) return;
  for (const e of v.case.evidence)
    assert.strictEqual(Object.keys(e).join(), "parcelId,wish,made");
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
}

// Parcels picked for a check reach the sleigh only checked, waved through by relaxed checkers,
// judged in a case, remade after quarantine or a hold, or bypassed by the player.
function checkGate(w) {
  const everywhere = [
    ...w.aboard,
    ...Object.values(w.q).flat(),
    ...w.cases.flatMap((c) => c.parcels),
  ];
  for (const x of w.aboard.filter((x) => x.route === "check"))
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
    cocoa: () => v.elves.some((e) => e.station < 3 && e.tired >= 60),
    bypass: () => v.queues.check.parcels.length >= v.queues.check.limit,
    recall: () => v.sleigh.wrong > 0,
    quarantine: () => v.incident?.suspectWaiting > 0,
    rollback: () => v.actions.rollback.available,
    train: () => v.vigilance.state !== "careful",
  }[m.id];
  assert(!live || live(), `moment ${m.id} shown after its example has gone`);
}

function play(name, seed, version, guided = false) {
  const w = new Workshop({ seed, guided, version });
  const run = {
    name,
    version,
    kinds: new Set(),
    behindAt: [],
    moments: [],
    cases: 0,
    judgedWhileOpen: 0,
    noticedBy: null,
    checkerBurnouts: 0,
    burnouts: 0,
    first60: null,
    caseKinds: [],
    firstCaseAt: null,
    consequences: [],
    trainsLoaded: 0,
    readWrong: new Map(),
    hash: crypto.createHash("sha1"),
  };
  const seenCases = new Set();
  let last = null;
  let lastNews = 0;
  const memo = {};
  const warnedAt = {};
  for (let i = 0; !w.end; i++) {
    if (i % 5 === 0) {
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
        if (n.kind === "case") {
          run.cases++;
          run.firstCaseAt ??= n.t;
        }
        if (n.kind === "consequence") run.consequences.push(n);
        if (
          n.kind === "loaded" &&
          n.check.made.name === "full-sized locomotive"
        )
          run.trainsLoaded++;
        if (n.kind === "noticed") run.noticedBy = n.by;
        if (n.kind === "checked" && v.case?.kind === "judge")
          run.judgedWhileOpen++;
        if (n.kind === "tired" && last?.elves[n.elf].station === 2)
          run.checkerBurnouts++;
        if (n.kind === "tired") run.burnouts++;
        if (n.kind === "tired")
          assert(
            n.t - (warnedAt[n.elf] ?? n.t) >= 10,
            "the elf card warns at least 10 seconds before a burnout",
          );
      }
      lastNews = v.news[0]?.id ?? lastNews;
      if (v.case && !seenCases.has(v.case.id)) {
        seenCases.add(v.case.id);
        run.caseKinds.push(v.case.kind);
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
    // How an answered unclear letter was read, seen while it waits for the toy line.
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
  run.skipped = w.vig.skipped;
  run.memo = memo;
  run.sleigh = w.view().sleigh.parcels;
  run.toyMistakes = w.stats.toyMistakes / Math.max(1, w.stats.toys);
  run.hash = run.hash.digest("hex");
  return run;
}

const mean = (runs, f) => runs.reduce((s, r) => s + f(r), 0) / runs.length;
const everyRun = [];

for (const version of VERSION_IDS) {
  const results = Object.fromEntries(
    Object.keys(players).map((name) => [
      name,
      SEEDS.map((seed) => play(name, seed, version)),
    ]),
  );
  everyRun.push(...Object.values(results).flat());
  console.log(
    `\n${version}: player        right wrong lost  ratings  check prevented mistakes total  lessons`,
  );
  for (const [name, runs] of Object.entries(results)) {
    const c = (k) =>
      String(Math.round(mean(runs, (r) => r.end.costs[k]))).padStart(6);
    const avg = (k) =>
      String(Math.round(mean(runs, (r) => r.end[k]))).padStart(5);
    const lessons = [...new Set(runs.map((r) => r.end.lesson.title))].join(
      " / ",
    );
    console.log(
      `  ${name.padEnd(21)}${avg("right")} ${avg("wrong")}${avg("lost")}  ${runs.map((r) => r.end.rating).join("")}  ${c("checking")}  ${c("prevented")}  ${c("mistakes")} ${c("total")}  ${lessons}`,
    );
  }

  const expect = {
    byHand: "By hand is careful but slow",
    fastNoChecks: "Too little checking",
    checkAll: "Too much checking",
    sensible: "Checking in the right places",
  };
  for (const [name, title] of Object.entries(expect))
    for (const r of results[name]) {
      assert.strictEqual(
        r.end.lesson.title,
        title,
        `${version} ${name} lesson`,
      );
      if (name !== "neverTrains")
        assert.strictEqual(
          r.end.rating === 3,
          name === "sensible",
          `${version} ${name} rating ${r.end.rating}`,
        );
    }
  for (const r of results.sensible)
    assert(
      r.end.costs.total <= r.end.costs.budget,
      `${version} sensible within budget`,
    );

  const avgCost = (name, k) => mean(results[name], (r) => r.end.costs[k]);
  assert(
    avgCost("sensible", "checking") < avgCost("sensible", "prevented"),
    `${version}: sensible checking pays for itself`,
  );
  assert(
    avgCost("checkAll", "checking") > avgCost("checkAll", "prevented"),
    `${version}: checking everything costs more than it stops`,
  );
  const skipped =
    avgCost("sensible", "checking") - avgCost("fastNoChecks", "checking");
  assert(
    avgCost("fastNoChecks", "mistakes") > 2 * skipped,
    `${version}: little checking costs far more than the checking skipped`,
  );

  // Calm has too little pressure for tiredness or trust to cost the rating; there they only show.
  const most = (runs, test) =>
    runs.filter(test).length >= (version === "calm" ? 0 : 4);
  assert(
    most(
      results.neverTrains,
      (r) => r.end.lesson.title === "The checkers trusted the AI too much",
    ) && results.neverTrains.filter((r) => r.skipped > 0).length >= 4,
    `${version}: untrained checkers skip checks and wave mistakes through`,
  );
  assert(
    most(results.neverRests, (r) => r.end.rating < 3) &&
      most(results.neverRests, (r) => r.checkerBurnouts > 0) &&
      results.neverRests.every((r) => r.burnouts > 0),
    `${version}: a player who never rests loses elves to burnout and misses top rating`,
  );
  assert(
    results.byHand.every((r) => r.behindAt.length > 0),
    `${version}: behind fires for the by-hand player`,
  );
  assert(
    results.sensible.every((r) => r.behindAt.every((t) => t < 60)),
    `${version}: behind stays quiet for the sensible player`,
  );
  assert(
    mean(results.toysAutomatedWatched, (r) => r.toyMistakes) <
      mean(results.toysByHandTired, (r) => r.toyMistakes),
    `${version}: automating with watchers makes fewer toy mistakes than tired elves`,
  );
  assert(
    mean(results.bypassHeavy, (r) => r.end.wrong) >
      mean(results.sensible, (r) => r.end.wrong),
    `${version}: bypassing ships more wrong gifts than staffing the pile`,
  );

  const runs = Object.values(results).flat();
  for (const r of runs)
    assert(
      version === "piles" ? r.cases === 0 : r.cases <= 6,
      `${version}: case count ${r.cases}`,
    );
  for (const r of runs) {
    assert(
      r.firstCaseAt === null || r.firstCaseAt >= 60,
      `${version}: no case before 60 seconds`,
    );
    const bySubject = {};
    for (const n of r.consequences) {
      const f = n.facts;
      assert(
        f.caught > 0 || f.waiting > 0 || f.money >= 10,
        `${version}: consequence with nothing to say`,
      );
      assert(
        n.t - (bySubject[n.about] ?? -99) >= 45,
        `${version}: consequences about ${n.about} too close`,
      );
      bySubject[n.about] = n.t;
    }
  }
  for (const r of results.byHand)
    assert(
      !r.caseKinds.includes("pattern"),
      `${version}: a by-hand line raised a pattern case`,
    );
  assert(
    mean(results.bypassHeavy, (r) => r.trainsLoaded) >
      mean(results.sensible, (r) => r.trainsLoaded),
    `${version}: bypassing during the faulty update ships trains`,
  );
  if (version !== "piles") {
    // How the answered letters were read, before the toy line or a check could change them.
    const wrongShare = (runs, choice) => {
      const made = runs.flatMap((r) =>
        (r.memo.unclear?.[choice] ?? [])
          .filter((id) => r.readWrong.has(id))
          .map((id) => r.readWrong.get(id)),
      );
      return {
        n: made.length,
        wrong: made.filter(Boolean).length / Math.max(1, made.length),
      };
    };
    const asked = wrongShare(results.askUnclear, "ask");
    const accepted = wrongShare(results.acceptUnclear, "accept");
    console.log(
      `  unclear cases: ${asked.n} asked, ${Math.round(asked.wrong * 100)}% misread; ${accepted.n} accepted, ${Math.round(accepted.wrong * 100)}% misread`,
    );
    assert(
      asked.n >= 5 && accepted.n >= 5 && asked.wrong + 0.2 < accepted.wrong,
      `${version}: asking the child beats accepting the AI's guess`,
    );
    assert(
      runs.some((r) => r.noticedBy === "case"),
      `${version}: investigating a real pattern makes the update known`,
    );
    assert(
      runs.some((r) => r.judgedWhileOpen > 0),
      `${version}: another check finished while a judge case was open`,
    );
  }

  const guided = SEEDS.map((seed) => play("sensible", seed, version, true));
  everyRun.push(...guided);
  for (const r of guided) {
    assert(
      r.end.right >= r.target,
      `${version}: guided sensible reaches the target (${r.end.right})`,
    );
    assert(r.first60 >= 60, `${version}: first tired elf at ${r.first60}s`);
  }
  console.log(
    `  guided sensible right: ${guided.map((r) => r.end.right).join(" ")}`,
  );
  console.log(
    `  moments (seed 1): ${guided[0].moments.map((m) => `${Math.round(m.t)}s ${m.id}`).join(", ")}`,
  );
  for (const r of guided) {
    const ids = r.moments.map((m) => m.id);
    assert.deepStrictEqual(
      ids.slice(0, FIRST_MOMENTS.length),
      FIRST_MOMENTS,
      `${version}: first moments in order`,
    );
    r.moments.forEach((m, i) =>
      assert(
        i === 0 || m.t - r.moments[i - 1].t >= MOMENT_GAP - 0.5,
        `${version}: moments ${MOMENT_GAP}s apart`,
      ),
    );
    const train = r.moments.find((m) => m.id === "train");
    assert(
      !train || train.t >= 90,
      `${version}: training moment after 90 seconds`,
    );
    assert(
      r.firstCaseAt === null || r.firstCaseAt >= 60,
      `${version}: no case before 60 seconds`,
    );
  }
  assert.strictEqual(
    play("sensible", 3, version).hash,
    play("sensible", 3, version).hash,
    `${version}: same seed and calls give the same run`,
  );
}

const kinds = new Set(everyRun.flatMap((r) => [...r.kinds]));
for (const k of NEWS_KINDS) assert(kinds.has(k), `news kind ${k} is emitted`);

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
    train: () => w.train(),
    rollback: () => w.rollback(),
    quarantine: () => w.quarantine(),
    recall: () => w.recall(),
    resolve: () =>
      v.case &&
      w.resolve(v.case.id, v.case.options.find((o) => o.available)?.id),
  };
  return m.completes.some((call) => calls[call]());
}
// The player automates and checks everything once it can, so the checking pile fills and every
// moment, bypass included, comes up.
const closed = new Set();
for (const version of ["piles", "cases"]) {
  const w = new Workshop({ seed: 2, guided: true, version });
  const memo = {};
  while (!w.end) {
    const v = w.view();
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
console.log(`\nmoments closed by their own calls: ${[...closed].join(", ")}`);
for (const id of Object.keys(MOMENTS))
  assert(closed.has(id), `moment ${id} closed by its own call`);

// A full checking pile makes the line wait and lets nothing through by itself.
{
  const w = new Workshop({ seed: 4, version: "piles" });
  w.setAi(0, 2);
  w.setAi(1, 2);
  w.setChecking(2);
  let waited = 0;
  while (!w.end) {
    w.step(0.5);
    const v = w.view();
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
    const w = new Workshop({ seed, version: "piles" });
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
    `\nlevers: reading by hand promised ${promised.toFixed(1)}/min, did ${did.toFixed(1)}`,
  );
  assert(
    Math.abs(did - promised) <= 0.15 * promised,
    "reading lever is honest",
  );
}

console.log("\nall checks passed");
