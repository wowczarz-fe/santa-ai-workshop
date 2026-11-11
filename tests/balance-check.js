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

// Reading a case's facts the way a player would.
const fact = (c, label) => c.facts.find((f) => f.label === label)?.value ?? "";
const num = (text) => parseFloat(text.match(/\d+(\.\d+)?/)?.[0] ?? "0");
const odds = (text) => {
  const m = text.match(/(\d+) in (\d+)/);
  return m ? m[1] / m[2] : 0;
};
const key = (c) => c.step ?? c.kind;

// Weighs what the case shows and what the workshop can spare; picks a different option when they change.
function conditional(c, v) {
  const left = num(fact(c, "Time left"));
  const e = c.evidence[0];
  switch (key(c)) {
    case "judge": {
      if (wantedFor.get(e.wish) === e.made.name) return "ship";
      return fact(c, "Gift worth").includes("big") ||
        num(fact(c, "Checking pile")) < 6
        ? "remake"
        : "ship";
    }
    case "unclear":
      return wantedFor.get(e.wish) === e.reading.name ? "accept" : "ask";
    case "pattern": {
      const ago = fact(c, "Last update installed");
      if (!ago.includes("ago") || num(ago) > 60) return "carryOn";
      return num(fact(c, "Made since")) <= 2 ? "hold" : "investigate";
    }
    case "offered": {
      const p = odds(fact(c, "Updates like this go wrong"));
      // A test is worth its price only when the odds are uncertain and there is time to use the result.
      if (p <= 0.2) return "install";
      if (p >= 0.8) return "skip";
      return left >= 90 ? "test" : "skip";
    }
    case "tested":
      return odds(fact(c, "After the test")) <= 0.3 ? "install" : "skip";
    case "source":
      return left < 30 || v.ai[1] < 2 ? "keep" : "rollback";
    case "made": {
      const n = num(fact(c, "Parcels from the update"));
      const big = num(fact(c, "Big gifts among them"));
      if (odds(fact(c, "Likely wrong")) >= 0.4 && left >= 20)
        return "remakeAll";
      return big > 0 || (n >= 3 && left >= 20) ? "checkEach" : "letGo";
    }
    case "aboard": {
      // Worth fetching back when leaving them costs more than the fetching, counting checker time at £1 a second.
      const bring = c.options.find((o) => o.id === "bringBack");
      return num(fact(c, "Their cost if they stay")) >
        bring.money + bring.seconds && left >= 40
        ? "bringBack"
        : "leave";
    }
  }
}
const CAREFUL = {
  judge: "remake",
  unclear: "ask",
  pattern: "investigate",
  offered: "test",
  tested: "skip",
  source: "rollback",
  made: "remakeAll",
  aboard: "bringBack",
};
const CHEAP = {
  judge: "ship",
  unclear: "accept",
  pattern: "carryOn",
  offered: "install",
  tested: "install",
  source: "keep",
  made: "letGo",
  aboard: "leave",
};

// Answers the open case with a policy, falling back to any option that can be chosen now.
function answer(w, v, m, policy = conditional) {
  const c = v.case;
  if (!c || c.resolving) return;
  const wanted = policy(c, v);
  const pick =
    c.options.find((o) => o.id === wanted && o.available) ??
    c.options.find((o) => o.available);
  if (!pick || !w.resolve(c.id, pick.id)) return;
  m.choices ??= [];
  m.choices.push(`${key(c)}:${pick.id}`);
  // What the conditional player itself chose, as opposed to a fixed rule standing in for it.
  const own =
    policy === conditional ||
    (policy.overrides && !(key(c) in policy.overrides));
  if (own && pick.id === wanted)
    (m.conditional ??= []).push(`${key(c)}:${pick.id}`);
  if (c.kind === "unclear") {
    m.unclear ??= { ask: [], accept: [] };
    m.unclear[pick.id].push(e(c).parcelId);
  }
}
const e = (c) => c.evidence[0];
const only = (overrides) =>
  Object.assign((c, v) => overrides[key(c)] ?? conditional(c, v), {
    overrides,
  });

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

// Players see only view() and call only the action methods.
const sensible = (
  w,
  v,
  m,
  {
    rest = true,
    train = true,
    watch = true,
    staffCheck = true,
    bypass = false,
    ask = false,
    policy = conditional,
    toys = null,
    checking = 1,
  } = {},
) => {
  w.setAsk(ask);
  w.setChecking(checking);
  w.setAi(0, 2);
  // The machine alone until an update makes it faster than elves confirming its drafts.
  w.setAi(
    1,
    toys ?? (v.levers.ai1[2].perMinute >= v.levers.ai1[1].perMinute ? 2 : 1),
  );
  if (rest) rests(w, v, m);
  if (train && v.vigilance.state !== "careful" && v.t < 170) w.train();
  balance(w, v, m, [1, watch ? 1 : 0, 2], staffCheck);
  if (!watch) v.elves.forEach((e, i) => e.station === 1 && w.move(i, 2));
  if (bypass && v.queues.check.parcels.length) w.bypass();
  answer(w, v, m, policy);
};
const players = {
  byHand: (w, v, m) => (rests(w, v, m), answer(w, v, m)),
  fastNoChecks(w, v, m) {
    rests(w, v, m);
    w.setAi(0, 2);
    w.setAi(1, 2);
    answer(
      w,
      v,
      m,
      only({
        offered: "install",
        tested: "install",
        source: "keep",
        made: "letGo",
        aboard: "leave",
      }),
    );
  },
  // Asks, trains and answers cases like the sensible player; checking everything is the difference.
  checkAll(w, v, m) {
    rests(w, v, m);
    w.setAi(0, 1);
    w.setAi(1, 1);
    w.setChecking(2);
    w.setAsk(true);
    if (v.vigilance.state !== "careful") w.train();
    answer(w, v, m);
  },
  sensible: (w, v, m) => sensible(w, v, m),
  careful: (w, v, m) => sensible(w, v, m, { policy: (c) => CAREFUL[key(c)] }),
  cheap: (w, v, m) => sensible(w, v, m, { policy: (c) => CHEAP[key(c)] }),
  alwaysInstall: (w, v, m) =>
    sensible(w, v, m, {
      policy: only({ offered: "install", tested: "install" }),
    }),
  alwaysTest: (w, v, m) =>
    sensible(w, v, m, { policy: only({ offered: "test" }) }),
  alwaysSkip: (w, v, m) =>
    sensible(w, v, m, { policy: only({ offered: "skip", tested: "skip" }) }),
  neverRests: (w, v, m) => sensible(w, v, m, { rest: false }),
  neverTrains: (w, v, m) => sensible(w, v, m, { train: false }),
  // Never adds checkers and lets the checking pile through whenever anything waits.
  bypassHeavy: (w, v, m) =>
    sensible(w, v, m, { staffCheck: false, bypass: true }),
  // Nobody watches the toy machine, so only checkers, cases or the sleigh can notice a faulty update.
  noWatcher: (w, v, m) =>
    sensible(w, v, m, {
      watch: false,
      policy: only({ offered: "install", tested: "install" }),
    }),
  // Asking is off, so unclear big gifts come as cases: one player asks the child, one accepts the AI.
  // Pays for everything: both stations automated, every parcel checked, the careful option always.
  spendthrift(w, v, m) {
    rests(w, v, m);
    w.setAi(0, 2);
    w.setAi(1, 2);
    w.setChecking(2);
    w.setAsk(true);
    w.train();
    balance(w, v, m);
    answer(w, v, m, (c) => CAREFUL[key(c)]);
  },
  // Toys stay on Assist, so confirming elves catch most of a faulty update's trains.
  assistToys: (w, v, m) =>
    sensible(w, v, m, {
      toys: 1,
      policy: only({ offered: "install", tested: "install" }),
    }),
  // Asking off with cases read on their merits: unclear cases get asked or accepted by what the AI reads.
  // Asks about every unclear wish, big or small.
  askAll: (w, v, m) => sensible(w, v, m, { ask: true }),
  // The three checking levels for a player who otherwise plays sensibly.
  checkFew: (w, v, m) => sensible(w, v, m, { checking: 0 }),
  checkEverything: (w, v, m) => sensible(w, v, m, { checking: 2 }),
  askUnclear: (w, v, m) =>
    sensible(w, v, m, { ask: false, policy: only({ unclear: "ask" }) }),
  acceptUnclear: (w, v, m) =>
    sensible(w, v, m, { ask: false, policy: only({ unclear: "accept" }) }),
  // Toy mistakes: tired elves by hand against the machine with rested watchers.
  toysByHandTired: (w, v, m) => (w.setAi(0, 1), answer(w, v, m)),
  toysAutomatedWatched(w, v, m) {
    rests(w, v, m);
    w.setAi(0, 1);
    w.setAi(1, 2);
    answer(w, v, m);
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
  assert.strictEqual(
    Object.keys(v.case).join(),
    "id,kind,step,text,facts,evidence,affected,options,resolving",
  );
  for (const f of v.case.facts)
    assert.strictEqual(Object.keys(f).join(), "label,value");
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
    train: () => !v.vigilance.trained,
  }[m.id];
  assert(!live || live(), `moment ${m.id} shown after its example has gone`);
  assert(
    m.text.split(/(?<=[.!?])\s+(?=[A-Z])/).length <= 2,
    `moment ${m.id} is longer than two sentences`,
  );
}

// Parcels picked for a check reach the sleigh only checked, waved through by relaxed checkers,
// judged in a case, remade, or bypassed by the player.
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

function play(name, seed, version, guided = false) {
  const w = new Workshop({ seed, guided, version });
  const run = {
    name,
    version,
    kinds: new Set(),
    behindAt: [],
    moments: [],
    cases: 0,
    caseKinds: [],
    firstCaseAt: null,
    judgedWhileOpen: 0,
    noticedBy: null,
    checkerBurnouts: 0,
    burnouts: 0,
    first60: null,
    consequences: [],
    trainsLoaded: 0,
    readWrong: new Map(),
    hash: crypto.createHash("sha1"),
  };
  let last = null;
  let lastNews = 0;
  const memo = {};
  const warnedAt = {};
  const seenCases = new Set();
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
        if (n.kind === "case") run.firstCaseAt ??= n.t;
        if (n.kind === "consequence") run.consequences.push(n);
        if (n.kind === "noticed") run.noticedBy = n.by;
        if (
          n.kind === "loaded" &&
          n.check.made.name === "full-sized locomotive"
        )
          run.trainsLoaded++;
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
  run.cases = run.caseKinds.length;
  run.end = w.view().end;
  run.target = w.target;
  run.skipped = w.vig.skipped;
  run.choices = memo.choices ?? [];
  run.conditional = memo.conditional ?? [];
  run.toyMistakes = w.stats.toyMistakes / Math.max(1, w.stats.toys);
  run.speed = w.machineSpeed;
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
  everyRun.push(...Object.values(results).flat());
  console.log(
    `\n${version}: player             right wrong lost  ratings  check  fixing mistakes  total  lessons`,
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
      `  ${name.padEnd(21)}${avg("right")} ${avg("wrong")}${avg("lost")}  ${runs.map((r) => r.end.rating).join("")}  ${c("checking")}  ${c("fixing")}  ${c("mistakes")} ${c("total")}  ${lessons}`,
    );
  }
  for (const r of Object.values(results).flat())
    r.conditional.forEach((x) => conditionalChoices.add(x));

  // The conditional player beats every fixed case policy on rating or, at equal rating, on cost per right gift.
  const score = (name) => ({
    rating: mean(results[name], (r) => r.end.rating),
    total: mean(results[name], (r) => r.end.costs.total),
    right: mean(results[name], (r) => r.end.right),
    wrong: mean(results[name], (r) => r.end.wrong),
    fixes: mean(
      results[name],
      (r) => r.end.costs.fixing + r.end.costs.mistakes,
    ),
    perGift: mean(
      results[name],
      (r) => r.end.costs.total / Math.max(1, r.end.right),
    ),
  });
  const best = score("sensible");
  for (const name of [
    "careful",
    "cheap",
    "alwaysInstall",
    "alwaysTest",
    "alwaysSkip",
  ]) {
    const s = score(name);
    console.log(
      `  sensible vs ${name}: rating ${best.rating.toFixed(2)} vs ${s.rating.toFixed(2)}, total £${Math.round(best.total)} vs £${Math.round(s.total)}, right ${Math.round(best.right)} vs ${Math.round(s.right)}, wrong ${best.wrong.toFixed(1)} vs ${s.wrong.toFixed(1)}`,
    );
    assert(
      best.rating > s.rating ||
        (best.rating === s.rating && best.perGift < s.perGift),
      `${version}: reading the facts beats ${name}`,
    );
  }
  // Each fixed policy loses for the reason its choices make visible.
  assert(
    score("careful").perGift > best.perGift,
    `${version}: always careful costs more per right gift`,
  );
  assert(
    score("cheap").wrong > best.wrong,
    `${version}: always cheap ships more wrong gifts`,
  );
  assert(
    score("alwaysInstall").fixes > best.fixes,
    `${version}: installing every update blind costs more in fixing and wrong gifts`,
  );
  assert(
    score("alwaysSkip").right < best.right,
    `${version}: skipping every update delivers fewer gifts`,
  );
  assert(
    score("alwaysTest").total > best.total ||
      score("alwaysTest").right < best.right,
    `${version}: testing every update costs time or money`,
  );

  for (const r of results.sensible)
    assert(
      r.end.costs.total <= r.end.costs.budget,
      `${version}: sensible within budget`,
    );
  // Proportionate checking, staffing the pile, training and asking about big wishes each beat the
  // alternatives on rating or, at equal rating, on cost per right gift.
  const beats = (a, b) =>
    a.rating > b.rating || (a.rating === b.rating && a.perGift < b.perGift);
  const rivals = [
    "checkFew",
    "checkEverything",
    "bypassHeavy",
    "neverTrains",
    ...(version === "piles" ? [] : ["askAll", "acceptUnclear"]),
  ];
  for (const name of rivals) {
    const s = score(name);
    console.log(
      `  sensible vs ${name}: rating ${best.rating.toFixed(2)} vs ${s.rating.toFixed(2)}, per right gift £${best.perGift.toFixed(2)} vs £${s.perGift.toFixed(2)}`,
    );
    assert(beats(best, s), `${version}: the sensible player beats ${name}`);
  }
  // By hand loses on gifts delivered, not on mistakes.
  for (const r of results.byHand)
    assert(
      r.end.right < r.target &&
        r.end.wrong <= 0.1 * (r.end.right + r.end.wrong),
      `${version}: by hand is slow, not sloppy`,
    );
  const most = (runs, test) =>
    runs.filter(test).length >= (version === "calm" ? 0 : 4);
  assert(
    most(results.neverRests, (r) => r.end.rating < 3) &&
      results.neverRests.every((r) => r.burnouts > 0),
    `${version}: a player who never rests loses elves to burnout and misses top rating`,
  );
  assert(
    results.neverTrains.filter((r) => r.skipped > 0).length >= 4,
    `${version}: untrained checkers skip checks`,
  );
  assert(
    results.byHand.every((r) => r.behindAt.length > 0),
    `${version}: behind fires for the by-hand player`,
  );
  assert(
    results.sensible.every((r) => r.behindAt.every((t) => t < 180)),
    `${version}: the sensible player is never warned in the last minute, too late to act`,
  );
  // Calm leaves the by-hand elves too little work to get properly tired, so it is left out there.
  if (version !== "calm")
    assert(
      mean(results.toysAutomatedWatched, (r) => r.toyMistakes) <
        mean(results.toysByHandTired, (r) => r.toyMistakes),
      `${version}: automating with watchers makes fewer toy mistakes than tired elves`,
    );

  const runs = Object.values(results).flat();
  for (const r of runs) {
    const others = r.caseKinds.filter(
      (k) => !["update", "incident"].includes(k),
    );
    assert(
      version === "piles" ? others.length === 0 : others.length <= 6,
      `${version}: case count ${others.length}`,
    );
    assert(r.caseKinds.includes("update"), `${version}: updates are offered`);
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
  if (version !== "piles") {
    const misread = (runs, choice) => {
      const read = runs.flatMap((r) =>
        r.choices.includes(`unclear:${choice}`)
          ? [...r.readWrong.entries()]
          : [],
      );
      const picked = runs.flatMap((r) =>
        r.choices.filter((c) => c === `unclear:${choice}`),
      );
      return {
        n: picked.length,
        wrong: read.filter(([, w]) => w).length / Math.max(1, read.length),
      };
    };
    const asked = misread(results.askUnclear, "ask");
    const accepted = misread(results.acceptUnclear, "accept");
    console.log(
      `  unclear cases: ${asked.n} asked, ${Math.round(asked.wrong * 100)}% misread; ${accepted.n} accepted, ${Math.round(accepted.wrong * 100)}% misread`,
    );
    assert(
      asked.n >= 3 && accepted.n >= 3 && asked.wrong + 0.2 < accepted.wrong,
      `${version}: asking the child beats accepting the AI's guess`,
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
    assert.deepStrictEqual(
      r.moments.map((m) => m.id).slice(0, FIRST_MOMENTS.length),
      FIRST_MOMENTS,
      `${version}: first moments in order`,
    );
    r.moments.forEach((m, i) =>
      assert(
        i === 0 || m.t - r.moments[i - 1].t >= MOMENT_GAP - 0.5,
        `${version}: moments ${MOMENT_GAP}s apart`,
      ),
    );
  }
  console.log(
    `  guided sensible right: ${guided.map((r) => r.end.right).join(" ")}`,
  );
  console.log(
    `  moments (seed 1): ${guided[0].moments.map((m) => `${Math.round(m.t)}s ${m.id}`).join(", ")}`,
  );
  assert.strictEqual(
    play("sensible", 3, version).hash,
    play("sensible", 3, version).hash,
    `${version}: same seed and calls give the same run`,
  );
}

// The conditional player picks every option of every case kind somewhere: the answer depends on the case.
const allOptions = Object.entries(CAREFUL)
  .flatMap(([k, careful]) => [`${k}:${careful}`, `${k}:${CHEAP[k]}`])
  .concat(["pattern:hold", "made:checkEach"]);
console.log(
  `\nconditional choices seen: ${[...conditionalChoices].sort().join(", ")}`,
);
for (const option of allOptions)
  assert(
    conditionalChoices.has(option),
    `the conditional player sometimes chooses ${option}`,
  );

// Left alone by hand, the workshop makes almost no mistakes in the first 70 seconds: the first
// wrong gift a player sees follows from a choice they made.
for (const version of VERSION_IDS)
  for (const seed of SEEDS) {
    const w = new Workshop({ seed, version });
    w.step(70);
    assert(
      w.view().sleigh.wrong <= 2,
      `${version} seed ${seed}: hands-off by hand ships ${w.view().sleigh.wrong} wrong gifts by 70 s`,
    );
  }

// Spending past the budget says so once and stops the paid one-off actions.
{
  const w = new Workshop({ seed: 1 });
  w.spent.fixing += 1500;
  w.step(1);
  const v = w.view();
  assert(
    v.news.some((n) => n.kind === "broke") &&
      v.budget.left < 0 &&
      !v.actions.train.available,
    "running out of money stops paid actions",
  );
  everyRun.push({ kinds: new Set(v.news.map((n) => n.kind)) });
}

const kinds = new Set(everyRun.flatMap((r) => [...r.kinds]));
for (const k of NEWS_KINDS) assert(kinds.has(k), `news kind ${k} is emitted`);

// skipGuidance unlocks everything and stops moments.
{
  const w = new Workshop({ seed: 1, guided: true });
  assert(w.view().moment && w.skipGuidance());
  w.step(100);
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
    train: () => w.train(),
    resolve: () =>
      v.case &&
      w.resolve(v.case.id, v.case.options.find((o) => o.available)?.id),
  };
  return m.completes.some((call) => calls[call]());
}
const closed = new Set();
for (const version of ["piles", "cases"])
  for (const seed of [2, 3]) {
    const w = new Workshop({ seed, guided: true, version });
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
console.log(`moments closed by their own calls: ${[...closed].join(", ")}`);
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
    `levers: reading by hand promised ${promised.toFixed(1)}/min, did ${did.toFixed(1)}`,
  );
  assert(
    Math.abs(did - promised) <= 0.15 * promised,
    "reading lever is honest",
  );
  const words = (text) => text.split(/\s+/).length;
  const v = new Workshop({ seed: 1 }).view();
  for (const entry of [...v.levers.ai0, ...v.levers.ai1])
    for (const k of ["who", "speed", "risk"])
      assert(
        words(entry[k]) <= 6,
        `lever ${k} "${entry[k]}" is six words at most`,
      );
}

console.log("\nall checks passed");
