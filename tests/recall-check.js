// Exercises reputation decisions at their threshold and follows a paid recall through the checkers.
const assert = require("assert");
const fs = require("fs");
const vm = require("vm");
const path = require("path");
vm.runInThisContext(
  fs.readFileSync(path.join(__dirname, "../game/workshop.js"), "utf8"),
);

function gift(w, wrong = false) {
  w.arrive();
  const x = w.q.letters.pop();
  x.w = WISHES.find((wish) => !wish.big && !wish.unclear);
  x.made = wrong ? x.w.wrong : x.w.wanted;
  x.wrong = wrong;
  w.load(x);
  w.track(0);
  return x;
}
function ready() {
  const w = new Workshop({ seed: 1 });
  for (let i = 0; i < w.goalsCountFrom(); i++) gift(w);
  return w;
}
const mistakes = (w) => w.goals().find((g) => g.id === "right");

{
  const w = ready();
  assert.strictEqual(w.bypass, undefined);
  assert(!("bypass" in w.view().actions));
  assert(!("bypassed" in w.view()));
  for (let i = 0; i < mistakes(w).need; i++) gift(w, true);
  assert.strictEqual(w.view().case, null);
  gift(w, true);
  const c = w.view().case;
  assert.strictEqual(c.step, "aboard");
  assert.strictEqual(c.title, "Santa's reputation at risk");
  assert.strictEqual(c.affected.count, 1);
  assert(!mistakes(w).met);
  const option = c.options.find((o) => o.id === "bringBack");
  assert(option.available && option.money > 0 && option.seconds > 0);
  assert.match(option.goal, /Few mistakes star saved/);
  const before = w.spent.fixing;
  assert(w.resolve(c.id, "bringBack"));
  assert(mistakes(w).met);
  assert.strictEqual(w.q.rework.length, 1);
  assert(w.spent.fixing > before);
  for (let i = 0; i < 8; i++) w.move(i, 0);
  w.step(option.seconds + 1);
  assert.strictEqual(w.q.rework.length, 1, "a recall needs checker capacity");
  w.move(0, 2);
  w.step(option.seconds + 1);
  assert.strictEqual(w.q.rework.length, 0);
  assert.strictEqual(w.spent.fixing - before, option.money);
  assert(mistakes(w).met);
  gift(w, true);
  assert.strictEqual(
    w.view().case.step,
    "aboard",
    "another wrong gift can raise the second recall immediately",
  );
  w.resolve(w.view().case.id, "leave");
  assert(!mistakes(w).met);
  gift(w, true);
  assert.strictEqual(w.view().case, null, "at most two recalls");
  w.depart();
  assert(
    w.end.practices.flatMap((p) => p.actions).find((a) => a.id === "recalled")
      .used,
  );
}
{
  const w = ready();
  for (let i = 0; i <= mistakes(w).need; i++) gift(w, true);
  w.resolve(w.view().case.id, "leave");
  w.track(0);
  assert.strictEqual(
    w.view().case,
    null,
    "leaving does not repeat the same decision",
  );
  gift(w, true);
  assert.strictEqual(w.view().case.step, "aboard");
}
{
  const w = ready();
  w.t = w.duration - 1;
  for (let i = 0; i <= mistakes(w).need; i++) gift(w, true);
  const c = w.view().case;
  assert.strictEqual(
    c.step,
    "aboard",
    "late mistakes still show their reputation consequence",
  );
  const option = c.options.find((o) => o.id === "bringBack");
  assert(!option.available);
  assert.match(option.why, /no time/);
  assert(c.options.find((o) => o.id === "leave").available);
}
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
  for (let i = 0; i <= mistakes(w).need; i++) gift(w, true);
  assert(
    w.cases.some((c) => c.step === "aboard"),
    "a faulty update does not suppress recall",
  );
  w.resolve(w.view().case.id, "keep");
  assert.strictEqual(w.view().case.step, "aboard");
}
console.log("recall checks passed");
