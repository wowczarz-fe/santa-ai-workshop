// Plays scripted players through the rules and checks the balance and the interface: node tests/balance-check.js
const assert = require("assert");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

vm.runInThisContext(
  fs.readFileSync(path.join(__dirname, "../game/workshop.js"), "utf8"),
);
// No wrong-gift line blames tiredness when every elf at that station was fresh: the checkers when
// it says to rest them, the station that made the gift when it says to send tired elves for cocoa.
{
  const advice = Workshop.prototype.advice;
  Workshop.prototype.advice = function (x) {
    const said = advice.call(this, x);
    const tired = (s) => this.staff(s).some((e) => e.tired > SLIPS_FROM);
    if (said.action === "Rest the checkers")
      assert(tired(2), `${said.text} with every checker fresh`);
    if (said.action === "Rest tired elves")
      assert(
        x.cause === "a tired elf" || tired(x.wrongAt),
        `${said.text} with every elf fresh`,
      );
    return said;
  };
}

const SEEDS = Array.from({ length: 40 }, (_, i) => i + 1);
// Orderings that guide tuning but do not block: printed at the end as warnings.
const warnings = [];
const warn = (ok, message) => ok || warnings.push(message);
const PARCEL_KEYS = "id,wish,big,unclear,wanted,made,suspect,result";
const NEWS_KINDS =
  "checked loaded consequence case resolved update noticed rolledBack recalled relaxed trained tired rested blocked lost behind milestone cleared halftime chose departed".split(
    " ",
  );
const CONTROLS_NAMED = ["checking", "ai:0", "ai:1", "cocoa", "ask"];
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
      return num(fact(c, "In your cost now")) > bring.money + bring.seconds &&
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
  if (v.vigilance.state !== "careful") return "train";
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

// A scripted player's own sloppiness, drawn from its seed apart from the workshop's, so a game
// replays the same.
function sloppy(seed) {
  let s = Math.imul(seed, 2654435761) >>> 0;
  return () => {
    s = (Math.imul(1664525, s) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}
const between = (m, lo, hi) => lo + m.r() * (hi - lo);

// Rests an elf once its energy shows red, unless the player misses it this time (one time in four),
// and sends it back to where it came from once it is fresh.
function restsWhenRed(w, v, m) {
  m.home ??= {};
  m.missed ??= new Set();
  v.elves.forEach((e, i) => {
    if (e.station < 3 && e.mood === "tired" && !m.missed.has(i)) {
      if (m.r() < 0.25) m.missed.add(i);
      else if (w.move(i, 3)) m.home[i] = e.station;
    }
    if (e.mood !== "tired") m.missed.delete(i);
    if (e.station === 3 && !e.resting && e.mood === "fresh")
      w.move(i, m.home[i] ?? 2);
  });
}

// Every so often moves one elf to the station the page points at, else the one a stopped station
// waits for, else the one with the fullest pile; it takes the elf from where elves stand idle or the
// pile is emptiest.
function shuffle(w, v, m) {
  m.shuffleAt ??= between(m, 15, 25);
  if (v.t < m.shuffleAt) return;
  const piles = [
    fill(v, "letters"),
    fill(v, "orders"),
    Math.max(fill(v, "check"), fill(v, "pass")),
  ];
  const to =
    v.focus?.control === "elves"
      ? v.focus.station
      : v.stations[1].blocked
        ? 2
        : v.stations[0].blocked
          ? 1
          : argmax(piles);
  const spare = piles.map((p, s) =>
    s !== to && v.stations[s].staff > 1 ? v.stations[s].idle - p : -9,
  );
  const from = argmax(spare);
  if (spare[from] === -9 || piles[to] < 0.3) return;
  m.shuffleAt = v.t + between(m, 15, 25);
  const elf = v.elves.findIndex((e) => e.station === from && !e.resting);
  if (v.stations[from].staff > 1 && elf >= 0) w.move(elf, to);
}

// Answers a decision 5 to 10 seconds after it shows, with a policy that may be a guess.
function decideSlowly(w, v, m, policy) {
  const c = v.case;
  if (!c || c.resolving) return;
  if (m.caseId !== c.id) {
    m.caseId = c.id;
    m.answerAt = v.t + between(m, 5, 10);
  }
  if (v.t < m.answerAt) return;
  const wanted = policy(c, m);
  const pick =
    c.options.find((o) => o.id === wanted && o.available) ??
    c.options.find((o) => o.available);
  if (pick && w.resolve(c.id, pick.id))
    (m.choices ??= []).push(`${key(c)}:${pick.id}`);
}

// Someone who did the tour and means well but is slow and imperfect: sets the AI and checking some
// seconds in, looks at the screen only every 2 to 4 seconds, moves an elf about every 20 seconds,
// rests elves that show red but misses some, and answers decisions late, mostly asking, rolling
// back and fetching back. On the good strategy both stations start on Assist and reading goes up to
// Automate once letters pile up, as the tour says more AI is faster. With follows, it also does
// what each wrong-gift line says, a look or two later.
const meansWell = (c, m) =>
  (key(c) === "unclear" && m.asks) ||
  m.r() < ({ unclear: 0.75, source: 0.75, aboard: 0.75 }[key(c)] ?? 0.5)
    ? { unclear: "ask", source: "rollback", aboard: "bringBack" }[key(c)]
    : { unclear: "guess", source: "keep", aboard: "leave" }[key(c)];
const firstTimer =
  ({
    ai = "good",
    checking = 1,
    rest = true,
    policy = meansWell,
    follows = false,
  } = {}) =>
  (w, v, m) => {
    m.r ??= sloppy(m.seed);
    m.lookAt ??= between(m, 2, 4);
    if (v.t < m.lookAt) return;
    m.lookAt = v.t + between(m, 2, 4);
    m.aiAt ??= between(m, 4, 10);
    m.checkAt ??= m.aiAt + between(m, 2, 8);
    m.checking ??= checking;
    m.dropped ??= [false, false];
    const start = ai === "good" ? [1, 1] : ai;
    if (v.t >= m.aiAt && !m.aiSet)
      m.aiSet = w.setAi(0, start[0]) && w.setAi(1, start[1]);
    if (v.t >= m.checkAt && !m.checkSet) m.checkSet = w.setChecking(m.checking);
    m.raiseAt ??= between(m, 0.3, 0.6);
    if (
      ai === "good" &&
      m.aiSet &&
      !m.dropped[0] &&
      fill(v, "letters") >= m.raiseAt
    )
      w.setAi(0, 2);
    if (follows) followAdvice(w, v, m);
    if (rest) restsWhenRed(w, v, m);
    shuffle(w, v, m);
    decideSlowly(w, v, m, policy);
  };

// Does what each new wrong-gift line says: checks the risky ones, checks all for 20 seconds, puts a
// station on Assist, sends the named elf or the most tired elf (or checker) for cocoa, or asks
// the child next time. "Keep checking" asks for nothing new.
function followAdvice(w, v, m) {
  const fresh = v.news.filter((n) => n.id > (m.seenNews ?? 0));
  m.seenNews = v.news[0]?.id ?? m.seenNews;
  if (m.backAt && v.t >= m.backAt) {
    w.setChecking(m.checking);
    m.backAt = null;
  }
  for (const n of fresh.filter((n) => n.kind === "loaded")) {
    (m.followed ??= []).push(n.action);
    if (n.control === "checking" && n.action === "Check more") {
      m.checking = Math.max(m.checking, 1);
      if (!m.backAt) w.setChecking(m.checking);
    } else if (n.action === "Keep checking") {
      continue;
    } else if (n.control === "ask") {
      m.asks = true;
    } else if (n.control === "checking") {
      w.setChecking(2);
      m.backAt = v.t + 20;
    } else if (n.control.startsWith("ai:")) {
      const s = Number(n.control.slice(3));
      m.dropped[s] = true;
      w.setAi(s, 1);
    } else {
      const at = n.action === "Rest the checkers" ? [2] : [0, 1, 2];
      const named = v.elves.findIndex((e) => n.action === `Swap ${e.name}`);
      const most =
        named >= 0
          ? { e: v.elves[named], i: named }
          : v.elves
              .map((e, i) => ({ e, i }))
              .filter(({ e }) => at.includes(e.station) && !e.resting)
              .sort((x, y) => x.e.energy - y.e.energy)[0];
      if (most && v.stations[most.e.station].staff > 1) {
        (m.home ??= {})[most.i] = most.e.station;
        w.move(most.i, 3);
      }
    }
  }
}
// Half-time without working anything out: a likely-sounding option, drawn by the player's seed.
function pickOnAHunch(ch, v, m) {
  const roll = m.r();
  return roll < 0.3
    ? "train"
    : roll < 0.55
      ? "rest"
      : roll < 0.75
        ? "tested"
        : roll < 0.9
          ? "update"
          : "none";
}

// Players see only view() and call only the action methods. The same strategies are played at two
// skills: an expert (instant, moves elves every few seconds, works the half-time sums out) and a
// first-timer (above). Good: reading on Automate, toys on Assist, the risky ones checked.
const players = {
  byHandIdle: () => {},
  automateIdle: (w) => (w.setAi(0, 2), w.setAi(1, 2)),
  assistIdle: (w) => (w.setAi(0, 1), w.setAi(1, 1)),
  expert: active(),
  expertCheckAll: active({ checking: 2 }),
  expertCheckFew: active({ checking: 0 }),
  expertAutomate: active({ ai: [2, 2] }),
  expertNeverRests: active({ rest: false }),
  expertGuesses: active({
    policy: (c) => (c.kind === "unclear" ? "guess" : conditional(c)),
  }),
  first: firstTimer(),
  firstCheckAll: firstTimer({ checking: 2 }),
  firstCheckFew: firstTimer({ checking: 0 }),
  firstAutomate: firstTimer({ ai: [2, 2] }),
  firstNeverRests: firstTimer({ rest: false }),
  firstFollows: firstTimer({ follows: true }),
  // A careless first-timer: checking left on a few, every unclear wish guessed and other decisions
  // answered at random, and nobody rested.
  careless: firstTimer({
    checking: 0,
    rest: false,
    policy: (c, m) =>
      c.kind === "unclear"
        ? "guess"
        : c.options[Math.floor(m.r() * c.options.length)].id,
  }),
};
const EXPERT = Object.keys(players).filter((n) => n.startsWith("expert"));
const IDLE = ["byHandIdle", "automateIdle", "assistIdle"];
const HALF_TIME = Object.fromEntries(
  Object.keys(players)
    .filter((n) => !IDLE.includes(n))
    .map((n) => [n, EXPERT.includes(n) ? chooseWell : pickOnAHunch]),
);

// Nothing in view() may show what the player has not found out, and the shape holds.
function checkView(v) {
  // The drift to fix names an elf who is at that station now.
  const swap = v.vigilance.swap;
  if (swap)
    assert(
      v.elves[swap.elf].station === swap.station &&
        v.elves[swap.elf].name === swap.name,
      "the drift names an elf at its station",
    );
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
    "id,kind,step,title,text,facts,evidence,affected,options,resolving" +
      (v.case.kind === "unclear" ? ",stake" : ""),
  );
  if (v.case.kind === "unclear")
    assert([WRONG_PRICE.everyday, WRONG_PRICE.big].includes(v.case.stake));
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
  assert(
    v.run.half === 1 && v.run.halfLeft === 0 && v.run.cargo.id === "everyday",
    "half-time shows the first half over",
  );
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
  // A caught gift never reached the child, and a drift line waits for the first DRIFT_QUIET seconds
  // and names what to do now.
  if (n.kind === "checked" && /^Caught/.test(n.text))
    assert(
      !/ got /.test(n.text) && /remade/.test(n.text),
      `a caught line says the child got it: ${n.text}`,
    );
  if (n.kind === "relaxed")
    assert(
      n.t >= DRIFT_QUIET &&
        n.text.startsWith(`${ELF_NAMES[n.elf]} is trusting`) &&
        n.text.includes(`Send ${ELF_NAMES[n.elf]} for cocoa`) &&
        [0, 1, 2].includes(n.station),
      `drift line at ${n.t} s: ${n.text}`,
    );
  if (n.kind === "loaded") {
    assert(
      CONTROLS_NAMED.includes(n.control),
      `wrong gift control ${n.control}`,
    );
    assert(
      /(Check|Put|Send|Rest|Swap|Keep|Ask) [^.]*\.$/.test(n.text),
      `wrong gift line names an action: ${n.text}`,
    );
    assert(n.cause in WRONG_CAUSES, `cause ${n.cause}`);
    assert(
      n.action && n.action.split(/\s+/).length <= 4,
      `wrong gift action tag ${n.action}`,
    );
    assert(
      !/by hand/i.test(n.text),
      `advice sends a station by hand: ${n.text}`,
    );
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
    // What asked for the player's attention in each half: decisions, burnouts and wrong-gift lines.
    calls: [0, 0].map(() => ({ cards: 0, burnouts: 0, wrong: 0 })),
  };
  let lastNews = 0;
  // Seconds the line has stood stopped, or a pile full, with nothing pointed at, and the longest such stretch.
  let unhinted = 0;
  r.unhinted = 0;
  const idle = Array(8).fill(0);
  r.idleBreak = 0;
  const memo = { seed };
  const seen = new Set();
  for (let i = 0; !w.end; i++) {
    if (i % 5 === 0 || w.choice) {
      const v = w.view();
      checkView(v);
      r.hash.update(JSON.stringify(v));
      for (const n of v.news.filter((n) => n.id > lastNews).reverse()) {
        r.kinds.add(n.kind);
        checkNews(n);
        if (n.kind === "loaded") r.calls[v.run.half - 1].wrong++;
        if (n.kind === "tired") {
          r.calls[v.run.half - 1].burnouts++;
          r.burnouts.push(n.t);
          r.firstBurnout[n.elf] ??= n.t;
        }
      }
      lastNews = v.news[0]?.id ?? lastNews;
      const stuck =
        !v.choice &&
        !v.incident?.rollingBack &&
        (v.stations.some((st) => st.blocked) ||
          ["letters", "orders", "check", "pass"].some(
            (id) => fill(v, id) >= 1,
          ));
      unhinted = stuck && !v.focus ? unhinted + 0.5 : 0;
      r.unhinted = Math.max(r.unhinted, unhinted);
      // Seconds an elf has sat on a break fully rested, the longest such wait.
      v.elves.forEach((e, k) => {
        idle[k] =
          e.station === 3 && !e.resting && e.energy === 100 ? idle[k] + 0.5 : 0;
      });
      r.idleBreak = Math.max(r.idleBreak, ...idle);
      if (v.case && !seen.has(v.case.id)) {
        seen.add(v.case.id);
        r.cards++;
        r.calls[v.run.half - 1].cards++;
      }
      if (v.choice) {
        checkChoice(v, w);
        const pick = (HALF_TIME[name] ?? (() => "none"))(v.choice, v, memo);
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
  r.followed = memo.followed ?? [];
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
  `\nplayer             stars  0/1/2/3      full right cost  right wrong lost   cost  cards  ai/checks/half/fix/wrong  lessons`,
);
for (const [name, rs] of Object.entries(results)) {
  const s = starsOf(name);
  const spread = [0, 1, 2, 3].map((n) => s.filter((x) => x === n).length);
  const avg = (f, d = 0) => mean(rs.map(f)).toFixed(d).padStart(6);
  const pct = (id) => `${Math.round(metShare(name, id) * 100)}%`.padStart(5);
  const lessons = [...new Set(rs.map((r) => r.end.lesson.title))].join(" / ");
  console.log(
    `  ${name.padEnd(17)}${mean(s).toFixed(2).padStart(5)}  ${spread.join("/").padEnd(12)}${pct("full")}${pct("right")}${pct("cost")}${avg((r) => r.end.right)}${avg((r) => r.end.wrong)}${avg((r) => r.end.lost)}${avg((r) => r.end.costs.total)}${avg((r) => r.cards, 1)}  ${["ai", "checking", "halfTime", "fixing", "mistakes"].map((k) => Math.round(mean(rs.map((r) => r.end.costs[k])))).join("/")}  ${lessons}`,
  );
}

// The balance targets of the one-sleigh game (ADR 0014), each strategy played at the same skill:
// both extremes lose, the good strategy wins, and a first game on it fills the sleigh now and then.
const starShare = (name, test) => shareOf(starsOf(name), test);
const avgStars = (name) => mean(starsOf(name));
const pc = (x) => `${Math.round(x * 100)}%`;
for (const name of IDLE)
  assert(
    starShare(name, (s) => s === 3) === 0 &&
      starShare(name, (s) => s <= 1) >= 0.6,
    `${name}: never three stars, mostly 0 or 1`,
  );
const firstThree = starShare("first", (s) => s === 3);
assert(
  starShare("first", (s) => s === 0) < 0.1 &&
    starShare("first", (s) => s >= 2) >= 0.6,
  "a first-timer on the good strategy: rarely no star, two or more in most games",
);
assert(
  metShare("first", "full") >= 0.3 && metShare("first", "full") <= 0.55,
  `a first-timer on the good strategy fills the sleigh in a third to a half of games (${pc(metShare("first", "full"))})`,
);
warn(
  firstThree >= 0.1 && firstThree <= 0.25,
  `a first-timer on the good strategy earns three stars in 10 to 25% of games (${pc(firstThree)})`,
);
assert(
  firstThree <= 0.3,
  `a first-timer earns three stars in under 30% of games (${pc(firstThree)})`,
);
// Checking everything loses through its cost for an expert. A first-timer's checkers, rested now
// and then, look at every gift properly and hold the sleigh up, so it loses the cost or the Full
// sleigh star.
assert(
  1 - metShare("expertCheckAll", "cost") >= 0.6,
  `an expert checking everything breaks the cost limit in most games (${pc(1 - metShare("expertCheckAll", "cost"))})`,
);
assert(
  shareOf(results.firstCheckAll, (r) => !r.met.cost || !r.met.full) >= 0.85,
  "a first-timer checking everything loses the cost or the Full sleigh star",
);
warn(
  1 - metShare("firstCheckAll", "cost") >= 0.6,
  `a first-timer checking everything breaks the cost limit in most games (${pc(1 - metShare("firstCheckAll", "cost"))})`,
);
assert(
  starShare("firstCheckAll", (s) => s < 3) >= 0.85 &&
    starShare("firstCheckAll", (s) => s === 3) < 0.05,
  "a first-timer checking everything loses a star in nearly every game",
);
assert(
  1 - metShare("firstCheckFew", "right") > 0.5 &&
    1 - metShare("expertCheckFew", "right") > 0.75,
  "checking only a few loses the mistakes star in most games",
);
const expertThree = starShare("expert", (s) => s === 3);
warn(
  expertThree >= 0.6,
  `an expert on the good strategy earns three stars in 60% of games or more (${pc(expertThree)})`,
);
assert(
  expertThree >= 0.45 && avgStars("expert") >= avgStars("first"),
  `an expert on the good strategy earns three stars in about half of games or more (${pc(expertThree)})`,
);
for (const name of ["expertCheckAll", "expertAutomate", "expertCheckFew"])
  assert(
    starShare(name, (s) => s === 3) <= 0.15 &&
      avgStars(name) <= avgStars("expert") - 0.5,
    `${name}: three stars in at most 15% of games, well behind the good strategy`,
  );
for (const name of ["firstCheckAll", "firstCheckFew"])
  assert(
    avgStars(name) <= avgStars("first") - 0.4,
    `${name} scores well behind the good strategy at the same skill`,
  );
assert(
  avgStars("firstAutomate") < avgStars("first") &&
    starShare("firstAutomate", (s) => s === 3) < firstThree,
  "a first-timer on Automate everywhere scores below the good strategy",
);
assert(
  starShare("careless", (s) => s <= 1) >= 0.6,
  "a careless first-timer mostly ends with 0 or 1 star",
);
// Never resting costs a first-timer about a star; an expert, a fraction of one.
assert(
  avgStars("first") - avgStars("firstNeverRests") >= 0.5,
  `never resting costs a first-timer a star (${avgStars("firstNeverRests").toFixed(2)} against ${avgStars("first").toFixed(2)})`,
);
warn(
  avgStars("expert") - avgStars("expertNeverRests") >= 0.5,
  "never resting costs an expert a star",
);
// Doing what the wrong-gift lines say never makes the game worse.
assert(
  avgStars("firstFollows") >= avgStars("first") - 0.05,
  `following the wrong-gift advice scores no worse (${avgStars("firstFollows").toFixed(2)} against ${avgStars("first").toFixed(2)})`,
);
warn(
  avgStars("expertGuesses") <= avgStars("expert"),
  "asking about unclear wishes pays at least as well as guessing",
);
for (const name of ["expert", "expertCheckAll", "expertCheckFew"])
  for (const r of results[name])
    assert(
      r.cards >= 2 && r.cards <= 4,
      `${name} seed: ${r.cards} decisions, two to four in a game`,
    );
// An elf by hand, never rested, burns out once or twice a game; a first-timer who rests elves when
// they turn red sees about one burnout a game.
const perElf = mean(results.byHandIdle.map((r) => r.burnouts.length / 8));
const firstAt = mean(
  results.byHandIdle.flatMap((r) => Object.values(r.firstBurnout)),
);
const firstBurnouts = mean(results.first.map((r) => r.burnouts.length));
console.log(
  `\nburnouts by hand, untouched: ${perElf.toFixed(2)} an elf a game, the first at ${firstAt.toFixed(0)} s on average; first-timer ${firstBurnouts.toFixed(1)} a game`,
);
assert(
  perElf >= 0.3 && perElf <= 1.5,
  `an elf never rested burns out once or twice a game (${perElf.toFixed(2)} a game)`,
);
assert(
  firstBurnouts <= 1.5,
  `a first-timer who rests red elves burns out about once a game (${firstBurnouts.toFixed(1)})`,
);
// Whenever a first-timer's line stops or a pile fills, the page points at what would free it within
// about 5 seconds.
const unhinted = Math.max(...results.first.map((r) => r.unhinted));
assert(
  unhinted <= 5,
  `a first-timer's line stood stopped ${unhinted} s with nothing pointed at`,
);
// What asks for a first-timer's attention in each half, the half-time card counted in both: at most
// one thing every 15 seconds.
for (const half of [0, 1]) {
  const calls = ["cards", "burnouts", "wrong"].map((k) =>
    mean(results.first.map((r) => r.calls[half][k])),
  );
  const all = sum(calls) + 1;
  const [cards, burnouts, wrong] = calls.map((n) => n.toFixed(1));
  console.log(
    `first-timer, half ${half + 1}: ${cards} decisions, ${burnouts} burnouts, ${wrong} wrong-gift lines and half-time, one every ${(HALF_SECONDS / all).toFixed(0)} s`,
  );
  assert(all <= HALF_SECONDS / 15, `half ${half + 1} asks too often`);
}
console.log(
  `half-time picks (expert): ${Object.entries(
    Object.groupBy(results.expert, (r) => r.halfTime),
  )
    .map(([k, rs]) => `${k} ${rs.length}`)
    .join(", ")}`,
);
console.log(
  `decisions answered (expert): ${Object.entries(
    Object.groupBy(
      results.expert.flatMap((r) => r.choices),
      (x) => x,
    ),
  )
    .map(([k, xs]) => `${k} ${xs.length}`)
    .join(", ")}`,
);
console.log(
  `advice followed (first-timer): ${Object.entries(
    Object.groupBy(
      results.firstFollows.flatMap((r) => r.followed ?? []),
      (x) => x,
    ),
  )
    .map(([k, xs]) => `${k} ${xs.length}`)
    .join(", ")}`,
);
// The end screen agrees with itself. The dial measures checking by its own two figures: one far
// above the other and large decides its side, it reads about right on three stars, and never too
// much when checking stayed on a few all game. The words never contradict it: the checking answer
// goes the same way (never "No" on three stars), a checking lesson sits on the dial's side, and
// the headline praises care only without too many wrong gifts or too few checks. The headline
// names the lesson's loss, and a lesson about a loss shows only when that loss cost a goal.
const ANSWERS = {
  "too little": /more checks|^Too few: nothing was checked/,
  "too much": /cost more than they saved|fewer checks would have done/,
  "about right": /^(Yes|Mostly|Nothing)/,
  bottleneck: /^Not as run/,
};
const HEADLINES = {
  slow: [
    "Careful, but slow.",
    "Slow, and wrong.",
    "Slow, with too few checks.",
  ],
  tired: ["Too tired to keep up."],
  wrong: [
    "Fast, but wrong.",
    "Wrong gifts cost too much.",
    "Too many wrong gifts.",
  ],
  cost: ["Over budget."],
};
const STAYED_ON_A_FEW = [
  "byHandIdle",
  "automateIdle",
  "assistIdle",
  "expertCheckFew",
  "firstCheckFew",
  "careless",
];
for (const [name, rs] of Object.entries(results))
  for (const r of rs) {
    const e = r.end;
    // Too much checking either held the sleigh up or broke the cost limit.
    const losses =
      e.lesson.title === "Too much checking"
        ? ["slow", "cost"]
        : [LOSSES[e.lesson.title]];
    const a = e.assurance;
    const why = `${name}: "${e.headline}" over "${e.lesson.title}" (${e.stars} stars), dial ${a.verdict} (${a.underCost} lost to too few checks, ${a.overCost} on extra checks): ${e.checkingAnswer}`;
    assert(losses[0], `lesson "${e.lesson.title}" names a loss`);
    assert(ANSWERS[a.verdict].test(e.checkingAnswer), why);
    const clear = (x, y) => x >= ASSURANCE.clear * y && x >= ASSURANCE.floor;
    if (a.verdict !== "bottleneck" && e.stars < 3) {
      if (clear(a.underCost, a.overCost))
        assert.strictEqual(a.verdict, "too little", why);
      if (clear(a.overCost, a.underCost) && !STAYED_ON_A_FEW.includes(name))
        assert.strictEqual(a.verdict, "too much", why);
    }
    if (e.lesson.title === "Checking in the right places")
      assert.strictEqual(a.verdict, "about right", why);
    if (STAYED_ON_A_FEW.includes(name))
      assert.notStrictEqual(a.verdict, "too much", why);
    if (e.stars === 3) {
      assert.strictEqual(e.headline, "Christmas, carefully delivered.", why);
      assert(a.verdict === "about right" && !/^No/.test(e.checkingAnswer), why);
      continue;
    }
    if (e.wrong > WRONG_ALLOWED || a.verdict === "too little")
      assert(!/careful/i.test(e.headline), why);
    const loss = losses.find((l) => HEADLINES[l].includes(e.headline));
    assert(loss, why);
    if (loss === "slow" || loss === "tired") assert(!r.met.full, why);
    if (loss === "wrong") assert(!r.met.right || !r.met.cost, why);
    if (loss === "cost") assert(!r.met.cost, why);
    if (e.lesson.title === "Too much checking")
      assert.strictEqual(e.assurance.verdict, "too much", why);
    if (e.lesson.title === "Too little checking")
      assert.strictEqual(e.assurance.verdict, "too little", why);
  }
// The end screen tells what the player did: a recall shows among the causes, and an action shows
// as used only when it was done. No elf sits on a break fully rested.
for (const [name, rs] of Object.entries(results))
  for (const r of rs) {
    const acts = Object.fromEntries(
      r.end.practices.flatMap((p) => p.actions).map((a) => [a.id, a]),
    );
    const why = `${name}: ${JSON.stringify(Object.values(acts).map((a) => [a.id, a.used, a.figure]))}`;
    assert.strictEqual(acts.tested.used, r.halfTime === "tested", why);
    assert.strictEqual(
      acts.rolledBack.used,
      r.choices.includes("source:rollback"),
      why,
    );
    assert.strictEqual(
      acts.asked.used,
      !/^asked 0 /.test(acts.asked.figure),
      why,
    );
    for (const p of r.end.practices)
      assert.strictEqual(
        p.used,
        p.actions.some((a) => a.used),
        why,
      );
    if (r.choices.includes("aboard:bringBack"))
      assert(
        r.end.causes.some((c) => c.id === "recalled"),
        `${name}: a recall shows as a cause`,
      );
    assert(
      r.idleBreak <= COCOA_LEAST + 1,
      `${name}: an elf sat rested on a break for ${r.idleBreak} s`,
    );
  }
for (const name of IDLE)
  for (const r of results[name])
    assert.strictEqual(
      r.end.practices.find((p) => p.id === "escalate").actions[0].figure,
      "asked 0 of 2",
      "an untouched player asked no child",
    );
for (const r of results.expert) {
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
for (const name of ["expert", "first", "firstFollows"])
  assert.strictEqual(
    play(name, 3).hash,
    play(name, 3).hash,
    `${name}: same seed and calls give the same game`,
  );
// The unclear letters come from at least five children, Timmy among them.
const children = new Set(
  SEEDS.flatMap((seed) => new Workshop({ seed }).unclear.map((u) => u.w.child)),
);
assert(children.size >= 5 && children.has("Timmy"), [...children].join());

// The end dial reads too little for few checks on automation, too much for checking everything, and
// in between for the expert on the good strategy.
const dial = (name) => results[name].map((r) => r.end.assurance);
console.log(
  `dial: ${["expertCheckFew", "expert", "expertCheckAll"]
    .map(
      (n) =>
        `${n} ${Object.entries(Object.groupBy(dial(n), (a) => a.verdict))
          .map(([k, xs]) => `${k} ${xs.length}`)
          .join(", ")}`,
    )
    .join("; ")}`,
);
assert(
  shareOf(dial("expertCheckFew"), (a) => a.verdict === "too little") >= 0.75,
  "checking a few reads too little",
);
// Checking everything never reads too little; it reads too much or a bottleneck unless wrong gifts
// were its loss, when the dial follows them to "about right".
for (const name of ["expertCheckAll", "firstCheckAll"])
  assert(
    dial(name).every((a) => a.verdict !== "too little") &&
      shareOf(dial(name), (a) =>
        ["too much", "bottleneck"].includes(a.verdict),
      ) >= 0.5,
    `${name} reads too much or a bottleneck in most games`,
  );
warn(
  shareOf(dial("expert"), (a) => a.verdict === "about right") >= 0.5,
  "the expert on the good strategy mostly reads about right",
);
for (const a of dial("expert"))
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

// A rested elf goes where an elf is needed, else back where it came from, and says so; two elves
// rested together do not both answer one need.
{
  const w = new Workshop({ seed: 23 });
  w.step(10);
  w.setAi(1, 1);
  w.move(3, 0);
  w.move(4, 0);
  for (const i of [0, 1]) {
    w.move(i, 3);
    w.elves[i].tired = 0;
    w.elves[i].breakAt = w.t - 5;
  }
  // Nobody left making toys while orders wait: toy making needs an elf.
  w.move(5, 0);
  w.q.orders.push({ ...w.q.letters[0], id: 1000 });
  w.step(0.1);
  assert.deepStrictEqual(
    [w.elves[0].station, w.elves[1].station],
    [1, 0],
    "one rested elf answers the need, the other goes home",
  );
  const said = w.view().news.filter((n) => n.kind === "rested");
  assert(
    said.length === 2 &&
      said.every((n) => n.text.startsWith(w.elves[n.elf].name)),
    said.map((n) => n.text).join(" / "),
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
