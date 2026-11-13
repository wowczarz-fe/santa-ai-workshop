// The budget ends the game: node tests/budget-check.js
// Seeded games are played with different habits. The game runs only while budget is left, ends on
// the one event that takes the last of it, caps its stars at two, and never offers the player a
// choice the budget cannot cover.
const assert = require("assert");
const fs = require("fs");
const vm = require("vm");
const path = require("path");
vm.runInThisContext(
  fs.readFileSync(path.join(__dirname, "../game/workshop.js"), "utf8"),
);

// Every event that adds to the cost, as it happens: a payment, or a wrong gift going aboard.
let events = [];
{
  const pay = Workshop.prototype.pay;
  Workshop.prototype.pay = function (kind, amount) {
    if (amount > 0) events.push(amount);
    return pay.call(this, kind, amount);
  };
  const load = Workshop.prototype.load;
  Workshop.prototype.load = function (x) {
    if (x.wrong) events.push(this.price(x));
    return load.call(this, x);
  };
}

const HALF_TIME = ["update", "tested", "train", "rest", "none"];
const players = [
  { name: "automate, few checks", ai: [2, 2], checking: 0, pick: 0 },
  { name: "automate, risky checks", ai: [2, 2], checking: 1, pick: 0 },
  { name: "automate, all checks", ai: [2, 2], checking: 2, pick: 1 },
  { name: "assist, risky checks", ai: [1, 1], checking: 1, pick: 0 },
  { name: "by hand, few checks", ai: [0, 0], checking: 0, pick: 1 },
];
const seen = { budget: 0, time: 0, low: 0, refused: 0 };

// Nothing on offer would take the last of the budget, and what is not on offer cannot be chosen.
function checkOffers(w, v, name) {
  for (const o of v.case?.options ?? []) {
    const adds = o.extra ?? o.money;
    if (o.available)
      assert(adds === 0 || adds < v.cost.left, `${name}: ${o.id}`);
    else if (o.why === "not enough budget left") {
      assert(
        adds >= v.cost.left,
        `${name}: ${o.id} refused with budget to spare`,
      );
      assert(!w.resolve(v.case.id, o.id), `${name}: ${o.id} resolved anyway`);
      seen.refused++;
    }
  }
  for (const o of v.choice?.options ?? []) {
    const price = HALF_TIME_PRICE[o.id];
    assert.strictEqual(o.available, price === 0 || price < v.cost.left);
    assert.strictEqual(o.why, o.available ? null : "not enough budget left");
    if (!o.available) {
      assert(!w.choose(o.id), `${name}: ${o.id} chosen anyway`);
      seen.refused++;
    }
  }
}

for (let seed = 1; seed <= 12; seed++)
  for (const [n, p] of players.entries()) {
    const w = new Workshop({ seed });
    const name = `seed ${seed}, ${p.name}`;
    w.setAi(0, p.ai[0]);
    w.setAi(1, p.ai[1]);
    w.setChecking(p.checking);
    if (p.ai[0] === 2) w.elves.forEach((e, i) => e.station < 2 && w.move(i, 2));
    let low = 0;
    let lastNews = 0;
    while (!w.end) {
      events = [];
      w.step(0.1);
      const v = w.view();
      // While the game runs there is budget left, and the figures agree with each other.
      assert.strictEqual(v.cost.left, Math.max(0, v.cost.limit - v.cost.spent));
      assert.strictEqual(v.cost.low, v.cost.left <= BUDGET_LOW * v.cost.limit);
      if (!v.end)
        assert(v.cost.left > 0, `${name}: playing on with nothing left`);
      for (const line of v.news.filter((x) => x.id > lastNews))
        if (line.kind === "budgetLow") {
          low++;
          assert(v.cost.low && line.text.split(/\s+/).length <= 5, line.text);
        }
      lastNews = v.news[0]?.id ?? lastNews;
      if (v.end) break;
      checkOffers(w, v, name);
      if (v.choice)
        w.choose(HALF_TIME[(seed + n) % HALF_TIME.length]) || w.choose("none");
      else if (v.case) {
        const open = v.case.options.filter((o) => o.available);
        assert(open.length, `${name}: a decision with nothing to choose`);
        w.resolve(v.case.id, open[Math.min(p.pick, open.length - 1)].id);
      }
    }
    const e = w.view().end;
    const cost = w.costSoFar();
    assert(low <= 1, `${name}: the budget ran low ${low} times`);
    seen.low += low;
    seen[e.reason]++;
    if (e.reason === "budget") {
      // Ended on the one event that took the last of the budget, and not a pound later.
      const last = events.at(-1);
      assert(cost >= COST_LIMIT, `${name}: ended with ${cost} spent`);
      assert(
        cost - COST_LIMIT < last + 1e-6,
        `${name}: ${cost - COST_LIMIT} over after an event of ${last}`,
      );
      assert.strictEqual(low, 1, `${name}: ended without the low line`);
      assert(
        e.stars <= 2,
        `${name}: ${e.stars} stars after the budget ran out`,
      );
      assert(!e.goals.find((g) => g.id === "cost").met);
      assert.strictEqual(e.headline, "Out of money.");
      assert.match(e.lesson.text, / took £[\d,]+ of your £900 budget\.$/);
      assert.strictEqual(e.leftAt, Math.round(w.duration - w.t));
      assert(e.leftAt > 0 || w.t >= w.duration - 0.2);
      assert.strictEqual(w.view().cost.left, 0);
      // Nothing moves and nothing can be chosen once the sleigh has left.
      const t = w.t;
      w.step(5);
      assert(w.t === t && !w.setAi(0, 1) && !w.move(0, 3));
    } else {
      assert.strictEqual(e.reason, "time");
      assert(e.leftAt === 0 && cost < COST_LIMIT && e.costs.total < COST_LIMIT);
    }
  }

// Half-time with little budget left: only what it can cover is on offer, and carrying on always is.
{
  const w = new Workshop({ seed: 3 });
  w.step(HALF_SECONDS - 1);
  w.spent.fixing += w.budgetLeft() - 60;
  w.step(2);
  const ch = w.view().choice;
  assert(ch, "half-time is open");
  assert.deepStrictEqual(
    ch.options.map((o) => [o.id, o.available]),
    [
      ["update", true],
      ["tested", true],
      ["train", false],
      ["rest", true],
      ["none", true],
    ],
  );
  assert(
    !w.choose("train") && w.view().choice,
    "an unaffordable change is refused",
  );
  assert(
    w.choose("rest") && !w.end,
    "an affordable change leaves the game running",
  );
}
// A recall the budget cannot cover is not on offer; leaving the gifts aboard always is.
{
  const w = new Workshop({ seed: 1 });
  const gift = (wrong) => {
    w.arrive();
    const x = w.q.letters.pop();
    x.w = WISHES.find((wish) => wish.big && !wish.unclear);
    x.made = wrong ? x.w.wrong : x.w.wanted;
    x.wrong = wrong;
    w.load(x);
  };
  for (let i = 0; i < w.goalsCountFrom(); i++) gift(false);
  for (let i = 0; i <= WRONG_ALLOWED; i++) gift(true);
  w.spent.fixing += w.budgetLeft() - 30;
  w.track(0);
  const c = w.view().case;
  assert.strictEqual(c.step, "aboard");
  const [bring, leave] = c.options;
  assert(bring.extra >= 30 && !bring.available);
  assert.strictEqual(bring.why, "not enough budget left");
  assert(leave.available && leave.why === null);
  assert(!w.resolve(c.id, "bringBack") && w.resolve(c.id, "leave") && !w.end);
}

for (const [what, count] of Object.entries(seen))
  assert(count > 0, `the games reached no ${what}`);
console.log(
  `budget checks passed: ${Object.entries(seen)
    .map(([what, count]) => `${count} ${what}`)
    .join(", ")}`,
);
