// Exercises reputation decisions at their threshold and follows a paid recall through the checkers.
const assert = require("assert");
const fs = require("fs");
const vm = require("vm");
const path = require("path");
vm.runInThisContext(
  fs.readFileSync(path.join(__dirname, "../game/workshop.js"), "utf8"),
);

// Puts a gift on the sleigh: right or wrong, everyday or big. With look false the rules do not get
// to raise a decision yet, so several gifts can go aboard at once.
function gift(w, wrong = false, big = false, look = true) {
  w.arrive();
  const x = w.q.letters.pop();
  x.w = WISHES.find((wish) => wish.big === big && !wish.unclear);
  x.made = wrong ? x.w.wrong : x.w.wanted;
  x.wrong = wrong;
  w.load(x);
  if (look) w.track(0);
  return x;
}
// A made gift to stand on the remake pile.
function filler(w) {
  w.arrive();
  const x = w.q.letters.pop();
  x.made = x.w.wanted;
  x.wrong = false;
  return x;
}
const wrongAboard = (w) => w.aboard.filter((x) => x.wrong).length;
// Every recall card says how many gifts bringing back takes off the sleigh, and which.
function checkAffected(w) {
  const c = w.view().case;
  const before = wrongAboard(w);
  const ids = c.affected.ids;
  assert.strictEqual(c.affected.count, ids.length);
  assert(ids.every((id) => w.aboard.some((x) => x.id === id && x.wrong)));
  return { c, before, ids };
}
function bringBack(w) {
  const { c, before, ids } = checkAffected(w);
  assert(w.resolve(c.id, "bringBack"));
  assert.strictEqual(
    before - wrongAboard(w),
    c.affected.count,
    "bringing back takes affected.count gifts off the sleigh",
  );
  assert(ids.every((id) => !w.aboard.some((x) => x.id === id)));
  return c;
}
function ready() {
  const w = new Workshop({ seed: 1 });
  for (let i = 0; i < w.goalsCountFrom(); i++) gift(w);
  return w;
}
const mistakes = (w) => w.goals().find((g) => g.id === "right");
const option = (c, id) => c.options.find((o) => o.id === id);

// The first wrong gift aboard, everyday or big, raises the card for that one gift, with no star at
// stake. Passing the goal raises the second card, for the excess. Two cards a game at most.
for (const big of [false, true]) {
  const w = ready();
  const need = mistakes(w).need;
  assert.strictEqual(w.bypass, undefined);
  assert(!("bypass" in w.view().actions));
  assert(!("bypassed" in w.view()));
  assert.strictEqual(w.view().case, null);
  const x = gift(w, true, big);
  const c = w.view().case;
  assert.strictEqual(c.step, "aboard");
  assert.strictEqual(c.title, "Santa's reputation at risk");
  assert.strictEqual(
    c.text,
    `${x.w.child} got ${a(x.made.name)}, not ${a(x.w.wanted.name)}.`,
  );
  assert.deepStrictEqual(c.affected, { count: 1, ids: [x.id] });
  assert.deepStrictEqual(c.gift, {
    child: x.w.child,
    wanted: { name: x.w.wanted.name },
    made: { name: x.made.name },
  });
  assert.deepStrictEqual(
    c.options.map((o) => o.id),
    ["bringBack", "leave"],
  );
  const bring = option(c, "bringBack");
  const leave = option(c, "leave");
  assert(bring.available && bring.seconds > 0);
  assert(bring.extra > 0 && bring.money > bring.instead);
  assert.strictEqual(
    bring.instead,
    big ? WRONG_PRICE.big : WRONG_PRICE.everyday,
  );
  assert.strictEqual(bring.goal, "No mistake counted");
  assert.strictEqual(leave.goal, `Counts as 1 of ${need} mistakes`);
  assert(!/star/.test(bring.goal + leave.goal), "no star is at stake yet");
  assert(leave.available && leave.extra === 0 && leave.money === 0);
  assert(mistakes(w).met);
  const before = w.spent.fixing;
  bringBack(w);
  assert.strictEqual(wrongAboard(w), 0);
  assert.strictEqual(w.q.rework.length, 1);
  assert(w.spent.fixing > before);
  for (let i = 0; i < 8; i++) w.move(i, 0);
  w.step(bring.seconds + 1);
  assert.strictEqual(w.q.rework.length, 1, "a recall needs checker capacity");
  w.move(0, 2);
  w.step(bring.seconds + 1);
  assert.strictEqual(w.q.rework.length, 0);
  assert.strictEqual(w.spent.fixing - before, bring.money);
  // Only the first wrong gift raises a card of its own.
  for (let i = 0; i < need; i++) {
    gift(w, true, big);
    assert.strictEqual(w.view().case, null, "within the goal, no second card");
  }
  // Passing the goal raises the second card, for the excess, with the star at stake.
  gift(w, true);
  const second = w.view().case;
  assert.strictEqual(second.step, "aboard");
  assert.strictEqual(second.affected.count, 1);
  assert.match(second.text, /more than Santa's name can take\.$/);
  assert.match(option(second, "bringBack").goal, /Few mistakes star saved/);
  assert.match(option(second, "leave").goal, /Few mistakes star lost/);
  assert(!mistakes(w).met);
  bringBack(w);
  assert(mistakes(w).met);
  gift(w, true, true);
  gift(w, true);
  assert.strictEqual(w.view().case, null, "at most two cards a game");
  assert.strictEqual(w.recallsRaised, 2);
  w.depart();
  assert(
    w.end.practices.flatMap((p) => p.actions).find((a) => a.id === "recalled")
      .used,
  );
}
// Leaving the first wrong gift aboard does not ask again, and the goal still gets its card.
{
  const w = ready();
  const need = mistakes(w).need;
  gift(w, true, true);
  assert(w.resolve(w.view().case.id, "leave"));
  w.track(0);
  assert.strictEqual(
    w.view().case,
    null,
    "leaving does not repeat the decision",
  );
  assert.strictEqual(wrongAboard(w), 1);
  for (let i = 1; i < need; i++) gift(w, true);
  assert.strictEqual(w.view().case, null);
  gift(w, true);
  const c = w.view().case;
  assert.strictEqual(c.affected.count, 1);
  assert.match(option(c, "leave").goal, /star lost/);
  assert(w.resolve(c.id, "leave"));
  w.track(0);
  assert.strictEqual(
    w.view().case,
    null,
    "leaving does not repeat the decision",
  );
  assert(!mistakes(w).met);
  gift(w, true);
  assert.strictEqual(w.view().case, null, "at most two cards a game");
}
// A card open for one gift follows the count: once the goal is passed it covers the excess.
{
  const w = ready();
  const need = mistakes(w).need;
  gift(w, true);
  const id = w.view().case.id;
  for (let i = 0; i < need + 1; i++) gift(w, true);
  const c = w.view().case;
  assert.strictEqual(c.id, id, "the same card stays open");
  assert.strictEqual(c.affected.count, wrongAboard(w) - need);
  assert.strictEqual(c.affected.count, 2);
  assert.strictEqual(c.gift, null, "more than one gift: none is named");
  assert.match(option(c, "bringBack").goal, /star saved/);
  bringBack(w);
  assert.strictEqual(wrongAboard(w), need);
}
// The card for the excess never covers more gifts than the remake pile has room for.
{
  const w = ready();
  const need = mistakes(w).need;
  gift(w, true);
  w.resolve(w.view().case.id, "leave");
  while (w.q.rework.length < QUEUES.rework.limit - 1)
    w.q.rework.push(filler(w));
  for (let i = 0; i < need + 1; i++) gift(w, true, false, false);
  w.track(0);
  const c = w.view().case;
  assert.strictEqual(c.step, "aboard");
  assert.strictEqual(wrongAboard(w) - need, 2);
  assert.strictEqual(
    c.affected.count,
    1,
    "capped by the room on the remake pile",
  );
  assert.strictEqual(
    option(c, "bringBack").goal,
    null,
    "one back does not save the star",
  );
  w.q.rework.length = 0;
  assert.strictEqual(w.view().case.affected.count, 2);
  bringBack(w);
}
// The card for one gift waits until the gift can be brought back: no budget, no time or no room on
// the remake pile means no card, and so no card slot is used.
{
  const w = ready();
  w.spent.fixing += w.budgetLeft() - 30;
  gift(w, true);
  assert.strictEqual(w.view().case, null, "the budget cannot cover it");
  assert.strictEqual(w.recallsRaised, 0);
}
{
  const w = ready();
  while (w.q.rework.length < QUEUES.rework.limit) w.q.rework.push(filler(w));
  gift(w, true, true);
  assert.strictEqual(w.view().case, null, "no room on the remake pile");
  w.q.rework.length = 0;
  w.track(0);
  assert.strictEqual(
    w.view().case.affected.count,
    1,
    "raised once there is room",
  );
}
// Late in the game the first gift has no card, and passing the goal still shows its consequence.
{
  const w = ready();
  w.t = w.duration - 1;
  gift(w, true, true);
  assert.strictEqual(w.view().case, null, "no time to bring one gift back");
  for (let i = 1; i <= mistakes(w).need; i++) gift(w, true);
  const c = w.view().case;
  assert.strictEqual(
    c.step,
    "aboard",
    "late mistakes still show their reputation consequence",
  );
  assert(!option(c, "bringBack").available);
  assert.match(option(c, "bringBack").why, /no time/);
  assert(option(c, "leave").available);
}
// Another decision open: the card waits its turn, and a faulty update does not suppress it.
{
  const w = ready();
  w.incident = {
    known: true,
    fault: true,
    trains: 1,
    speedBefore: 1,
    rollingBack: 0,
  };
  w.raiseIncident();
  gift(w, true, true);
  assert.strictEqual(w.view().case.step, "source");
  assert(w.cases.some((c) => c.step === "aboard"));
  w.resolve(w.view().case.id, "keep");
  assert.strictEqual(w.view().case.step, "aboard");
  assert.strictEqual(w.view().case.affected.count, 1);
}
console.log("recall checks passed");
