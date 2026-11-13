// Plays scripted players through the rules and checks the balance and the interface: node tests/balance-check.js
const assert = require("assert");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

vm.runInThisContext(
  fs.readFileSync(path.join(__dirname, "../game/workshop.js"), "utf8"),
);
// A drift line names the same elf and station as the drift prompt the page shows at that moment.
{
  const say = Workshop.prototype.say;
  Workshop.prototype.say = function (kind, text, extra = {}) {
    if (kind === "relaxed") {
      const swap = this.view().vigilance.swap;
      assert(
        swap && swap.elf === extra.elf && swap.station === extra.station,
        `drift line "${text}" while the prompt names ${JSON.stringify(swap)}`,
      );
    }
    return say.call(this, kind, text, extra);
  };
}
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
  "checked loaded consequence case resolved update noticed rolledBack recalled relaxed trained tired rested blocked lost behind milestone cleared halftime chose departed budgetLow".split(
    " ",
  );
const CONTROLS_NAMED = ["checking", "ai:0", "ai:1", "cocoa", "decide"];
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
// An unclear wish read the way a person would, from the clue in the child's line: the option for the
// right reading, or for the wrong one. view() never says which is right, so the script looks it up.
function reading(c, right = true) {
  const wanted = UNCLEAR_WISHES.find((u) => u.wish === c.evidence[0].wish)
    .wanted.name;
  return c.options.find((o) => (o.label === wanted) === right).id;
}

// Weighs what a decision shows and what the workshop can spare.
function conditional(c, v) {
  const left = num(fact(c, "Time left"));
  switch (key(c)) {
    case "unclear":
      return reading(c);
    case "source":
      return left < 20 ? "keep" : "rollback";
    case "aboard": {
      // Read the stated star trade first; otherwise compare money saved with checker time at £1 a second.
      const bring = c.options.find((o) => o.id === "bringBack");
      // A recall costs more than leaving the gifts aboard, so it is worth it only for the star.
      const savesStar =
        /Few mistakes star saved/.test(bring.goal) &&
        !/Within budget star lost/.test(bring.goal);
      if (!bring.available) return "leave";
      if (savesStar) return "bringBack";
      // One wrong gift with no star at stake yet: worth fetching back while the margin for
      // mistakes is thin, or while it costs little of the budget that is left.
      const single = bring.goal === "No mistake counted";
      const wrong = num(fact(c, "Wrong gifts aboard"));
      return single && (wrong >= 2 || bring.extra <= 0.12 * v.cost.left)
        ? "bringBack"
        : "leave";
    }
  }
}

// Answers the open decision with a policy, falling back to any option that can be chosen now.
function answer(w, v, m, policy = conditional) {
  const c = v.case;
  if (!c) return;
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

// A plan is the AI levels and the checking level for each part of the game. The good plan lets the
// AI work alone on the everyday gifts of the first part, where it is as reliable as a fresh elf, and
// puts people on the big gifts of the second: elves confirm the toys, and the risky ones are checked.
const part = (ai, checking) => ({ ai, checking });
const GOOD = { first: part([2, 2], 0), second: part([2, 1], 1) };
const allGame = (ai, checking) => ({
  first: part(ai, checking),
  second: part(ai, checking),
});
const goodWithChecking = (checking) => ({
  first: part(GOOD.first.ai, checking),
  second: part(GOOD.second.ai, checking),
});
const now = (plan, v) => (v.run.half === 1 ? plan.first : plan.second);

// Follows a plan, moves elves to the slowest station (three to a station the moment it goes on
// Assist), rests tired elves, answers decisions and buys one sensible change at half-time.
const active =
  ({ plan = GOOD, rest = true, policy = conditional } = {}) =>
  (w, v, m) => {
    const { ai, checking } = now(plan, v);
    w.setAi(0, ai[0]);
    w.setAi(1, ai[1]);
    w.setChecking(checking);
    for (const s of [0, 1])
      for (let n = v.stations[s].staff; ai[s] === 1 && n < 3; n++) {
        const elf = w.elves.findIndex(
          (e, i) => e.station === 2 && !e.rest && w.staff(2).length > 2,
        );
        if (elf < 0 || !w.move(elf, s)) break;
      }
    if (rest) rests(w, v, m);
    balance(w, v, m, [ai[0] === 1 ? 2 : 0, ai[1] === 1 ? 2 : 0, 2]);
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
  if (!c) return;
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
// rests elves that show red but misses some, and answers decisions late: it reads an unclear wish
// right nine times in ten, and mostly rolls back and fetches back. It follows a plan: the first
// part's settings some seconds in, and the second part's some seconds after half-time, since the
// half-time card says big gifts come next. With follows, it also does what each wrong-gift line
// says, a look or two later.
const meansWell = (c, m) =>
  key(c) === "unclear"
    ? reading(c, m.reads || m.r() < 0.9)
    : m.r() < 0.75
      ? { source: "rollback", aboard: "bringBack" }[key(c)]
      : { source: "keep", aboard: "leave" }[key(c)];
const firstTimer =
  ({ plan = GOOD, rest = true, policy = meansWell, follows = false } = {}) =>
  (w, v, m) => {
    m.r ??= sloppy(m.seed);
    m.lookAt ??= between(m, 2, 4);
    if (v.t < m.lookAt) return;
    m.lookAt = v.t + between(m, 2, 4);
    m.aiAt ??= between(m, 4, 10);
    m.checkAt ??= m.aiAt + between(m, 2, 8);
    m.checking ??= plan.first.checking;
    m.dropped ??= [false, false];
    if (v.t >= m.aiAt && !m.aiSet)
      m.aiSet = w.setAi(0, plan.first.ai[0]) && w.setAi(1, plan.first.ai[1]);
    if (v.t >= m.checkAt && !m.checkSet) m.checkSet = w.setChecking(m.checking);
    // After half-time the second part's settings go in a few seconds late, one control at a look.
    if (v.run.half === 2) {
      m.secondAt ??= v.t + between(m, 1, 6);
      if (v.t >= m.secondAt && !m.secondSet) {
        m.secondSet = true;
        for (const s of [0, 1])
          if (!m.dropped[s]) w.setAi(s, plan.second.ai[s]);
        m.checking = Math.max(m.checking, plan.second.checking);
        if (!m.backAt) w.setChecking(m.checking);
      }
    }
    if (follows) followAdvice(w, v, m);
    if (rest) restsWhenRed(w, v, m);
    shuffle(w, v, m);
    decideSlowly(w, v, m, policy);
  };

// Does what each new wrong-gift line says: checks the risky ones, checks all for 20 seconds, puts a
// station on Assist, sends the named elf or the most tired elf (or checker) for cocoa, or reads
// the child's clue next time. "Keep checking" asks for nothing new.
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
    } else if (["Keep checking", "Keep going"].includes(n.action)) {
      continue;
    } else if (n.control === "decide") {
      m.reads = true;
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
  // The good plan with elves confirming the letters of the second part too.
  expertAssistBoth: active({
    plan: { first: GOOD.first, second: part([1, 1], 1) },
  }),
  // The plan that was best before the AI matched a fresh elf on everyday gifts: elves confirm the
  // toys all game.
  expertAssistAll: active({ plan: allGame([2, 1], 1) }),
  expertCheckAll: active({ plan: goodWithChecking(2) }),
  expertCheckFew: active({ plan: goodWithChecking(0) }),
  // Automation everywhere all game, with the risky ones checked and everything else done well.
  expertAutomate: active({ plan: allGame([2, 2], 1) }),
  expertNeverRests: active({ rest: false }),
  // Picks the first picture without reading the child's line: right about half the time.
  expertPicksBlind: active({
    policy: (c, v) => (c.kind === "unclear" ? "pick:0" : conditional(c, v)),
  }),
  first: firstTimer(),
  firstCheckAll: firstTimer({ plan: goodWithChecking(2) }),
  firstCheckFew: firstTimer({ plan: goodWithChecking(0) }),
  firstAutomate: firstTimer({ plan: allGame([2, 2], 1) }),
  firstNeverRests: firstTimer({ rest: false }),
  firstFollows: firstTimer({ follows: true }),
  // A careless first-timer: automation everywhere, checking left on a few, every decision answered
  // at random (an unclear wish picked without reading the child's line), and nobody rested.
  careless: firstTimer({
    plan: allGame([2, 2], 0),
    rest: false,
    policy: (c, m) => c.options[Math.floor(m.r() * c.options.length)].id,
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
  assert.strictEqual(
    v.stations.map((st) => st.name).join(),
    "Letters,Toys,Checking",
    "stations carry the heading words",
  );
  // The drift to fix names an elf who is at that station now.
  const swap = v.vigilance.swap;
  if (swap)
    assert(
      v.elves[swap.elf].station === swap.station &&
        v.elves[swap.elf].name === swap.name,
      "the drift names an elf at its station",
    );
  // No pile ever holds more than its limit; a read letter waiting for room is counted as held.
  for (const q of Object.values(v.queues)) {
    assert(
      q.parcels.length <= q.limit,
      `${q.name} holds ${q.parcels.length} of ${q.limit} at ${Math.round(v.t)} s`,
    );
    assert(q.held >= 0 && (q.id === "orders" || q.held === 0));
  }
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
  // The budget counts down from its limit, never below nothing, and says when it runs low.
  assert.strictEqual(Object.keys(v.cost).join(), "spent,limit,left,low");
  assert.strictEqual(v.cost.left, Math.max(0, v.cost.limit - v.cost.spent));
  assert.strictEqual(v.cost.low, v.cost.left <= BUDGET_LOW * v.cost.limit);
  // While the game runs there is budget left: the game ends the moment it is gone.
  if (!v.end) assert(v.cost.left > 0, `playing on with ${v.cost.left} left`);
  // Nothing the player may choose would end the game by itself.
  for (const o of v.case?.options ?? [])
    if (o.available)
      assert(
        (o.extra ?? o.money) < v.cost.left,
        `${o.id} costs ${o.extra ?? o.money} with ${v.cost.left} left`,
      );
  assert.strictEqual(Object.keys(v.actions).join(), "ai0,ai1,checking");
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
    "id,kind,step,title,text,facts,evidence,affected,options" +
      (v.case.kind === "unclear"
        ? ",stake,readings"
        : v.case.step === "aboard"
          ? ",gift"
          : ""),
  );
  if (v.case.kind === "unclear") {
    assert([WRONG_PRICE.everyday, WRONG_PRICE.big].includes(v.case.stake));
    // The two readings are the wish's right and wrong toys, each a name and a drawing key.
    const w = UNCLEAR_WISHES.find((u) => u.wish === v.case.evidence[0].wish);
    assert.strictEqual(
      v.case.readings.map((r) => Object.keys(r).join()).join("|"),
      "name,art|name,art",
    );
    assert.deepStrictEqual(
      v.case.readings.map((r) => r.name).sort(),
      [w.wanted.name, w.wrong.name].sort(),
    );
  }
  assert(["unclear", "incident"].includes(v.case.kind), v.case.kind);
  const primary = v.case.facts.filter((f) => f.primary).length;
  assert(primary >= 1 && primary <= 3, `${key(v.case)} primary facts`);
  for (const ev of v.case.evidence)
    assert.strictEqual(Object.keys(ev).join(), "parcelId,child,wish,made");
  for (const o of v.case.options)
    assert.strictEqual(
      Object.keys(o).join(),
      v.case.step === "aboard"
        ? "id,label,seconds,money,risk,scope,why,instead,extra,goal,available"
        : "id,label,seconds,money,risk,scope,why,goal,available",
    );
  // An unclear letter offers its two readings, in the order the card draws them, and nothing in the
  // view says which is right.
  if (v.case.kind === "unclear") {
    assert.deepStrictEqual(
      v.case.options.map((o) => [o.id, o.label]),
      v.case.readings.map((r, i) => [`pick:${i}`, r.name]),
    );
    assert(!/"(right|wrong|wanted|correct)"/.test(JSON.stringify(v.case)));
  }
  // A recall costs more than leaving the gifts aboard; leaving costs nothing more.
  if (v.case.step === "aboard") {
    const [bring, leave] = v.case.options;
    // The card says how many gifts a recall takes off the sleigh, names a single one, and speaks
    // of a star only when the Few mistakes goal is passed.
    const c = v.case;
    const wrong = v.end ? 0 : v.sleigh.wrong;
    const allowed = v.run.goals.find((g) => g.id === "right").need;
    assert(c.affected.count === c.affected.ids.length);
    assert(c.affected.count <= Math.max(1, wrong - allowed));
    assert.strictEqual(c.gift === null, c.affected.count !== 1);
    if (c.gift)
      assert.strictEqual(
        Object.keys(c.gift).join() +
          Object.keys(c.gift.wanted) +
          Object.keys(c.gift.made),
        "child,wanted,madenamename",
      );
    if (wrong <= allowed) {
      assert.strictEqual(c.affected.count <= 1, true);
      assert.strictEqual(bring.goal, "No mistake counted");
      assert.strictEqual(
        leave.goal,
        `Counts as ${wrong} of ${allowed} mistakes`,
      );
      if (c.gift)
        assert.strictEqual(
          c.text,
          `${c.gift.child} got ${a(c.gift.made.name)}, not ${a(c.gift.wanted.name)}.`,
        );
    } else {
      assert.match(leave.goal, /star lost/);
      assert(bring.goal === null || /star saved/.test(bring.goal));
    }
    assert.strictEqual(bring.extra, bring.money - bring.instead);
    assert(bring.extra >= 40 && bring.money >= bring.instead * 1.5 - 1);
    assert(
      bring.scope.startsWith(`${money(bring.extra)} more, checkers busy `),
    );
    assert(!/;|star/.test(bring.scope), "the goal is its own field");
    assert.deepStrictEqual(
      [leave.money, leave.instead, leave.extra, leave.scope],
      [0, 0, 0, "nothing more"],
    );
  }
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
  for (const o of ch.options) {
    assert(o.facts.length <= 3, "option facts");
    assert.strictEqual(
      Object.keys(o).join(),
      "id,label,text,facts,available,why",
    );
    // An option the budget cannot cover is not on offer, and says why.
    const covered = HALF_TIME_PRICE[o.id] < v.cost.left;
    assert.strictEqual(
      o.available,
      covered,
      `${o.id} with ${v.cost.left} left`,
    );
    assert.strictEqual(o.why, covered ? null : "not enough budget left");
    if (!covered) assert(!w.choose(o.id), `${o.id} chosen without the budget`);
  }
  assert(ch.options.at(-1).available, "carrying on is always on offer");
  assert.strictEqual(ch.openCase?.id ?? null, w.cases[0]?.id ?? null);
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
      /(check|put|send|rest|swap|keep|read) [^.]*\.$/i.test(n.text),
      `wrong gift line names an action: ${n.text}`,
    );
    // Assist is asked for only where the AI is poor: a big gift.
    if (n.control.startsWith("ai:"))
      assert(
        WISHES.find((w) => w.wish === n.check.wish).big &&
          /Big gifts need a person/.test(n.text),
        `Assist asked for an everyday gift: ${n.text}`,
      );
    assert(!/wrong size/.test(n.text + n.check.made.name), n.text);
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

// Parcels picked for a check reach the sleigh only checked, waved through or remade.
function checkGate(w) {
  for (const x of w.aboard.filter((x) => x.route === "check"))
    assert(
      ["checked", "skipped", "remade"].includes(x.exit),
      `parcel ${x.id} left the checking pile unchecked`,
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
        const wanted = (HALF_TIME[name] ?? (() => "none"))(v.choice, v, memo);
        // An option the budget cannot cover is not on offer: the player carries on instead.
        const pick = v.choice.options.find((o) => o.id === wanted).available
          ? wanted
          : "none";
        r.halfTime = pick;
        assert(w.choose(pick), `choose ${pick}`);
        continue;
      }
      players[name](w, v, memo);
    }
    r.anyWrong ||= w.aboard.some((x) => x.wrong);
    w.step(0.1);
  }
  checkGate(w);
  const v = w.view();
  for (const n of v.news.filter((n) => n.id > lastNews)) r.kinds.add(n.kind);
  r.end = v.end;
  r.stars = v.end.stars;
  r.met = Object.fromEntries(v.end.goals.map((g) => [g.id, g.met]));
  r.choices = memo.choices ?? [];
  r.recalls = w.recallsRaised;
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
// The share of a player's games that the budget ended.
const brokeShare = (name) =>
  shareOf(results[name], (r) => r.end.reason === "budget");

console.log(
  `\nplayer             stars  0/1/2/3      full right cost broke  right wrong lost   cost  cards  ai/checks/half/fix/wrong  lessons`,
);
for (const [name, rs] of Object.entries(results)) {
  const s = starsOf(name);
  const spread = [0, 1, 2, 3].map((n) => s.filter((x) => x === n).length);
  const avg = (f, d = 0) => mean(rs.map(f)).toFixed(d).padStart(6);
  const pct = (id) => `${Math.round(metShare(name, id) * 100)}%`.padStart(5);
  const lessons = [...new Set(rs.map((r) => r.end.lesson.title))].join(" / ");
  console.log(
    `  ${name.padEnd(17)}${mean(s).toFixed(2).padStart(5)}  ${spread.join("/").padEnd(12)}${pct("full")}${pct("right")}${pct("cost")}${`${Math.round(brokeShare(name) * 100)}%`.padStart(6)}${avg((r) => r.end.right)}${avg((r) => r.end.wrong)}${avg((r) => r.end.lost)}${avg((r) => r.end.costs.total)}${avg((r) => r.cards, 1)}  ${["ai", "checking", "halfTime", "fixing", "mistakes"].map((k) => Math.round(mean(rs.map((r) => r.end.costs[k])))).join("/")}  ${lessons}`,
  );
}

// The balance targets (ADRs 0014, 0019 and 0020), each strategy played at the same skill: both
// extremes lose, the good plan wins, and a first game on it fills the sleigh now and then. The
// good plan lets the AI work alone on the everyday gifts of the first half and puts people on the
// big gifts of the second.
// How often each player meets the reputation card: in all its games, and in those where a wrong gift
// got aboard.
const cardShare = (name, rs = results[name]) =>
  rs.length ? shareOf(rs, (r) => r.recalls > 0) : 0;
console.log(
  "\nplayer             card  two cards  wrong gift aboard  card when one was",
);
for (const name of Object.keys(results)) {
  const rs = results[name];
  const big = rs.filter((r) => r.anyWrong);
  const p = (x) => `${Math.round(x * 100)}%`;
  console.log(
    `  ${name.padEnd(17)}${p(cardShare(name)).padStart(5)}${p(shareOf(rs, (r) => r.recalls > 1)).padStart(11)}${p(big.length / rs.length).padStart(18)}${p(cardShare(name, big)).padStart(19)}`,
  );
}
const starShare = (name, test) => shareOf(starsOf(name), test);
const avgStars = (name) => mean(starsOf(name));
const pc = (x) => `${Math.round(x * 100)}%`;
for (const name of IDLE)
  assert(
    starShare(name, (s) => s === 3) === 0 &&
      starShare(name, (s) => s <= 1) >= 0.6,
    `${name}: never three stars, mostly 0 or 1`,
  );
// Left alone, by hand earns nothing, and automation everywhere runs out of budget on the big gifts.
assert(
  starShare("byHandIdle", (s) => s === 0) === 1,
  "by hand, untouched: no star",
);
assert(
  starShare("automateIdle", (s) => s === 0) >= 0.75 &&
    brokeShare("automateIdle") >= 0.75,
  `Automate, untouched: no star and out of money in most games (${pc(brokeShare("automateIdle"))})`,
);
const firstThree = starShare("first", (s) => s === 3);
assert(
  starShare("first", (s) => s === 0) < 0.1 &&
    starShare("first", (s) => s >= 2) >= 0.6,
  "a first-timer on the good plan: rarely no star, two or more in most games",
);
assert(
  avgStars("first") >= 1.75 && avgStars("first") <= 2.35,
  `a first-timer on the good plan earns about two stars (${avgStars("first").toFixed(2)})`,
);
assert(
  metShare("first", "full") >= 0.3 && metShare("first", "full") <= 0.55,
  `a first-timer on the good plan fills the sleigh in a third to a half of games (${pc(metShare("first", "full"))})`,
);
warn(
  firstThree >= 0.1 && firstThree <= 0.25,
  `a first-timer on the good plan earns three stars in 10 to 25% of games (${pc(firstThree)})`,
);
assert(
  firstThree <= 0.3,
  `a first-timer earns three stars in under 30% of games (${pc(firstThree)})`,
);
// The budget ends a good first game in at most about one game in ten.
warn(
  brokeShare("first") <= 0.1,
  `the budget ends a first-timer's game on the good plan in at most 1 game in 10 (${pc(brokeShare("first"))})`,
);
assert(
  brokeShare("first") <= 0.15,
  `the budget ends a first-timer's game on the good plan in about 1 game in 10 at most (${pc(brokeShare("first"))})`,
);
// Checking everything runs an expert out of budget. A first-timer's checkers, rested now and then,
// look at every gift properly and hold the sleigh up, so it loses the budget or the Full sleigh star.
assert(
  1 - metShare("expertCheckAll", "cost") >= 0.6 &&
    brokeShare("expertCheckAll") >= 0.6,
  `an expert checking everything runs out of budget in most games (${pc(brokeShare("expertCheckAll"))})`,
);
assert(
  shareOf(results.firstCheckAll, (r) => !r.met.cost || !r.met.full) >= 0.85,
  "a first-timer checking everything loses the budget or the Full sleigh star",
);
warn(
  1 - metShare("firstCheckAll", "cost") >= 0.6,
  `a first-timer checking everything loses the budget star in most games (${pc(1 - metShare("firstCheckAll", "cost"))})`,
);
assert(
  starShare("firstCheckAll", (s) => s < 3) >= 0.85 &&
    starShare("firstCheckAll", (s) => s === 3) < 0.05,
  "a first-timer checking everything loses a star in nearly every game",
);
// Checking only a few leaves the big gifts of the second half to the AI's drafts and the elves
// confirming them. Recalls can buy the mistakes star back twice, at a price the budget often cannot
// bear, so it loses a star in most games.
assert(
  starShare("firstCheckFew", (s) => s < 3) >= 0.75 &&
    starShare("expertCheckFew", (s) => s < 3) >= 0.6,
  `checking only a few loses a star in most games (expert ${pc(starShare("expertCheckFew", (s) => s < 3))}, first-timer ${pc(starShare("firstCheckFew", (s) => s < 3))})`,
);
const expertThree = starShare("expert", (s) => s === 3);
assert(
  expertThree >= 0.6 && avgStars("expert") >= avgStars("first"),
  `an expert on the good plan earns three stars in 60% of games or more (${pc(expertThree)})`,
);
// The good plan is at or near the best of the plans an expert can follow.
for (const name of EXPERT)
  assert(
    avgStars("expert") >= avgStars(name) - 0.15,
    `the good plan is at or near the best: ${name} earns ${avgStars(name).toFixed(2)} against ${avgStars("expert").toFixed(2)}`,
  );
for (const name of ["expertCheckAll", "expertAutomate", "expertCheckFew"])
  assert(
    avgStars(name) <= avgStars("expert") - 0.5,
    `${name}: well behind the good plan (${avgStars(name).toFixed(2)} against ${avgStars("expert").toFixed(2)})`,
  );
assert(
  starShare("expertAutomate", (s) => s === 3) <= expertThree * 0.5,
  "automation everywhere earns three stars at most half as often as the good plan",
);
for (const name of ["firstCheckAll", "firstCheckFew", "firstAutomate"])
  assert(
    avgStars(name) <= avgStars("first") - 0.4,
    `${name} scores well behind the good plan at the same skill (${avgStars(name).toFixed(2)} against ${avgStars("first").toFixed(2)})`,
  );
assert(
  starShare("firstAutomate", (s) => s === 3) < firstThree,
  "a first-timer on Automate everywhere earns three stars less often than on the good plan",
);
assert(
  starShare("careless", (s) => s <= 1) >= 0.6,
  "a careless first-timer mostly ends with 0 or 1 star",
);
// Never resting costs little now: on the good plan the elves stand idle through the first half,
// while the AI works alone, and rest by themselves. Reported, not required (ADR 0019).
warn(
  avgStars("first") - avgStars("firstNeverRests") >= 0.5,
  `never resting costs a first-timer a star (${avgStars("firstNeverRests").toFixed(2)} against ${avgStars("first").toFixed(2)})`,
);
assert(
  avgStars("firstNeverRests") <= avgStars("first") &&
    avgStars("expertNeverRests") <= avgStars("expert"),
  "never resting never pays",
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
  avgStars("expertPicksBlind") <= avgStars("expert"),
  "reading the child's clue pays at least as well as picking blind",
);
console.log(
  `\nout of money: ${Object.keys(players)
    .map((name) => `${name} ${pc(brokeShare(name))}`)
    .join(", ")}`,
);
for (const name of ["expert", "expertCheckAll", "expertCheckFew"])
  for (const r of results[name])
    assert(
      r.cards >= 2 && r.cards <= 5,
      `${name} seed: ${r.cards} decisions, two to five in a game`,
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
  "too much": /cost more than they saved|Fewer checks would have done/,
  "about right": /^(Yes|Mostly|Nothing|Not as run)/,
  "too little": /[Mm]ore checks|^Too few: nothing was checked/,
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
  cost: ["Out of money."],
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
    const losses = [LOSSES[e.lesson.title]];
    // A game the budget ended says so, names where the money went and earns two stars at most; a
    // game the clock ended still had budget left.
    assert(["time", "budget"].includes(e.reason), e.reason);
    if (e.reason === "budget") {
      assert.strictEqual(e.headline, "Out of money.");
      assert.strictEqual(e.lesson.title, "Out of money");
      assert.match(
        e.lesson.text,
        /^[A-Z][^.]* took £[\d,]+ of your £[\d,]+ budget\.$/,
      );
      assert(e.stars <= 2 && !r.met.cost && e.leftAt >= 0);
      assert(e.costs.total >= e.costs.limit);
    } else {
      assert(e.leftAt === 0 && e.costs.total < e.costs.limit, e.costs.total);
      assert.notStrictEqual(e.headline, "Out of money.");
    }
    // Jobs done and done wrongly, by kind of gift and by who did them.
    assert.strictEqual(Object.keys(e.reliability).join(), "everyday,big");
    for (const kind of Object.values(e.reliability)) {
      assert.strictEqual(Object.keys(kind).join(), "ai,elves");
      for (const who of Object.values(kind)) {
        assert.strictEqual(Object.keys(who).join(), "made,wrong");
        assert(who.wrong >= 0 && who.wrong <= who.made);
      }
    }
    const a = e.assurance;
    const why = `${name}: "${e.headline}" over "${e.lesson.title}" (${e.stars} stars), dial ${a.verdict} (${a.underCost} lost to too few checks, ${a.overCost} on extra checks): ${e.checkingAnswer}`;
    assert(losses[0], `lesson "${e.lesson.title}" names a loss`);
    assert(ANSWERS[a.verdict].test(e.checkingAnswer), why);
    // Lost to too many checks is its two parts, and the checks part is no more than checking cost.
    assert(
      Math.abs(a.overCost - a.overChecks - a.overHeld) <= 1 &&
        a.overChecks <= e.costs.checking,
      why,
    );
    const clear = (x, y) => x >= ASSURANCE.clear * y && x >= ASSURANCE.floor;
    if (a.verdict !== "bottleneck" && e.stars < 3) {
      if (clear(a.underCost, a.overCost))
        assert.strictEqual(a.verdict, "too little", why);
      if (
        clear(a.overCost, a.underCost) &&
        !STAYED_ON_A_FEW.includes(name) &&
        e.wrong <= WRONG_ALLOWED
      )
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
    // Cause advice never asks for more checks while the dial reads too much.
    if (a.verdict === "too much")
      for (const c of e.causes)
        assert(!/(^|or )check\b/i.test(c.fix), `${why}; cause fix: ${c.fix}`);
    // A game that lost the mistakes star never reads too much checking or advises fewer checks.
    if (e.wrong > WRONG_ALLOWED)
      assert(
        a.verdict !== "too much" && !/fewer checks/.test(e.checkingAnswer),
        why,
      );
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
      acts.decided.used,
      !/^decided 0 /.test(acts.decided.figure),
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
    assert.match(
      r.end.practices.find((p) => p.id === "escalate").actions[0].figure,
      /^decided 0 of ([12]), 0 right, \1 left unanswered$/,
      "an untouched player read no unclear wish",
    );
for (const r of results.expert) {
  const escalate = r.end.practices.find((p) => p.id === "escalate");
  assert(
    escalate.used &&
      /^decided ([12]) of [12], \1 right/.test(escalate.actions[0].figure),
    escalate.actions[0].figure,
  );
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
    "stars,goals,right,wrong,lost,costs,headline,lesson,assurance,checkingAnswer,practices,causes,blunders,blunderTotal,blunderIds,reason,leftAt,reliability",
  );
  // Every blunder a game shows is one the catalogue lists, so the page can drop stale stored ones.
  assert.strictEqual(r.end.blunderIds.length, r.end.blunderTotal);
  for (const b of r.end.blunders) {
    assert.strictEqual(Object.keys(b).join(), "id,name,icon");
    assert(r.end.blunderIds.includes(b.id), b.id);
  }
  assert(r.end.blunderTotal >= r.end.blunders.length);
}
for (const name of ["expert", "first", "firstFollows"])
  assert.strictEqual(
    play(name, 3).hash,
    play(name, 3).hash,
    `${name}: same seed and calls give the same game`,
  );
// The two readings of an unclear wish come in an order drawn per case that does not tell which is
// right: over many seeds the right one comes first about half the time. Every reading has a drawing.
{
  let first = 0;
  let all = 0;
  for (let seed = 1; seed <= 300; seed++) {
    const w = new Workshop({ seed });
    while (!w.end) (w.step(5), w.choice && w.choose("none"));
    for (const c of w.cases.filter((c) => c.kind === "unclear")) {
      all++;
      if (w.readings(c)[0].name === c.parcels[0].w.wanted.name) first++;
    }
  }
  assert(
    all >= 500 && first / all > 0.45 && first / all < 0.55,
    `the right reading comes first in ${first} of ${all} cases`,
  );
  const drawn = ["shared-art.js", "paper-art.js"].flatMap((f) =>
    fs
      .readFileSync(path.join(__dirname, "../game", f), "utf8")
      .match(/"toy-[a-z-]+"/g)
      .map((id) => id.slice(5, -1)),
  );
  for (const u of UNCLEAR_WISHES)
    for (const t of [u.wanted, u.wrong])
      assert(drawn.includes(slug(t.name)), `no drawing for ${t.name}`);
}

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
// Checking a few reads too little whenever it cost a star: a game that kept all three reads about
// right by rule.
assert(
  shareOf(
    results.expertCheckFew.filter((r) => r.stars < 3),
    (r) => r.end.assurance.verdict === "too little",
  ) >= 0.75,
  "checking a few reads too little when it costs a star",
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
// Rested checkers go back to Checking while its pile is half full, even when Toys needs an elf and
// two checkers stay without them.
{
  const w = new Workshop({ seed: 61 });
  w.step(10);
  w.setAi(1, 1);
  for (const i of [1, 2]) w.move(i, 2);
  for (const i of [3, 4, 5]) w.move(i, 0);
  for (const i of [6, 7]) {
    w.move(i, 3);
    w.elves[i].tired = 0;
    w.elves[i].breakAt = w.t - 5;
  }
  w.q.orders.push({ ...w.q.letters[0], id: 1000 });
  while (w.q.check.length < QUEUES.check.limit / 2 + 1)
    w.q.check.push({ ...w.q.letters[0], id: 1100 + w.q.check.length });
  w.step(0.1);
  assert.deepStrictEqual(
    [w.elves[6].station, w.elves[7].station],
    [2, 2],
    "rested checkers go back to a filling checking pile",
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

// An unclear letter waits for the player to read it. The right pick sends it on to be made right at
// once; the wrong pick sends the wrong reading on, to be caught by a check or reach the sleigh as the
// player's own mistake. A letter still waiting when the sleigh leaves is lost.
for (const right of [true, false]) {
  const w = new Workshop({ seed: 5 });
  while (!w.view().case) w.step(0.5);
  const c = w.view().case;
  assert.strictEqual(c.kind, "unclear");
  assert(c.evidence[0].child && c.text.includes(c.evidence[0].child));
  const id = c.evidence[0].parcelId;
  assert(!w.resolve(c.id, "ask") && !w.resolve(c.id, "pick:2"));
  assert(w.resolve(c.id, reading(c, right)));
  assert.strictEqual(w.view().case, null, "the card closes at once");
  const x = w.q.orders.find((x) => x.id === id);
  assert(x && x.wrong === !right, "the letter goes on as the reading picked");
  const said = w.view().news.find((n) => n.kind === "resolved").text;
  assert(!/right|wrong/i.test(said), `"${said}" gives the answer away`);
  if (right) continue;
  assert.strictEqual(w.causeId(x), "picked");
  assert.strictEqual(w.advice({ ...x, exit: "checked" }).control, "decide");
  while (!w.end) (w.step(1), w.choice && w.choose("none"));
  const act = w.end.practices.find((p) => p.id === "escalate").actions[0];
  assert.match(act.figure, /^decided 1 of 2, 0 right, 1 left unanswered$/);
}
{
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
  assert(waited > 0, "the full pile made the line wait");
  // A full checking pile always names what frees it: another elf at Checking with one or two
  // checkers (or none), checking fewer when every gift is checked by three or more.
  for (const [checkers, control] of [
    [0, "elves"],
    [1, "elves"],
    [2, "elves"],
    [3, "checking"],
  ]) {
    const f = new Workshop({ seed: 4 });
    f.setAi(0, 2);
    f.setAi(1, 2);
    f.setChecking(2);
    f.step(5);
    for (let i = 0; i < 8 && f.staff(2).length > checkers; i++)
      if (f.elves[i].station === 2) f.move(i, 0);
    for (let i = 0; i < 8 && f.staff(2).length < checkers; i++)
      if (f.elves[i].station === 0) f.move(i, 2);
    const model = f.aboard[0];
    while (!f.full("check"))
      f.q.check.push({ ...model, id: 2000 + f.q.check.length });
    const focus = f.view().focus;
    assert(
      focus?.station === 2 && focus.control === control,
      `${checkers} checkers, full pile, checking all: ${JSON.stringify(focus)}`,
    );
  }
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
