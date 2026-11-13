// No pile ever holds more than its limit, whatever puts a parcel there: the normal flow, an unclear
// letter the player has read, a recall, or a caught gift going back to be remade.
const assert = require("assert");
const fs = require("fs");
const vm = require("vm");
const path = require("path");
vm.runInThisContext(
  fs.readFileSync(path.join(__dirname, "../game/workshop.js"), "utf8"),
);

function within(w, when) {
  for (const q of Object.values(w.view().queues))
    assert(
      q.parcels.length <= q.limit,
      `${when}: ${q.name} ${q.parcels.length}/${q.limit}`,
    );
}
const reading = (c, right = true) =>
  c.options.find(
    (o) =>
      (o.label ===
        UNCLEAR_WISHES.find((u) => u.wish === c.evidence[0].wish).wanted
          .name) ===
      right,
  ).id;

// A read letter waits for room in a full toy pile: it is held, shown as held, never dropped, and
// goes on ahead of the letters being read as soon as a toy is made.
{
  const w = new Workshop({ seed: 5 });
  for (let i = 0; i < 8; i++) w.move(i, 0);
  while (!w.view().case) (w.step(0.5), within(w, "before the case"));
  const c = w.view().case;
  const id = c.evidence[0].parcelId;
  while (!w.full("orders")) (w.step(0.5), within(w, "filling the toy pile"));
  assert(w.resolve(c.id, reading(c)));
  for (let i = 0; i < 22; i++) (w.step(0.5), within(w, "a read letter"));
  assert.strictEqual(w.view().queues.orders.held, 1, "the letter is held");
  assert(!w.q.orders.some((x) => x.id === id));
  const lost = w.view().lost;
  w.move(0, 1);
  while (w.view().queues.orders.held) (w.step(0.1), within(w, "making room"));
  assert(
    w.q.orders.some((x) => x.id === id),
    "it joins the pile once a toy is made",
  );
  assert.strictEqual(w.view().lost, lost, "and is not lost");
  for (const [elf, station] of [
    [1, 1],
    [2, 2],
    [3, 2],
  ])
    w.move(elf, station);
  while (!w.end) (w.step(0.5), w.choice && w.choose("none"));
  assert(
    w.aboard.some((x) => x.id === id && !x.wrong),
    "and reaches the sleigh",
  );
}

// A recall brings back no more gifts than the remake pile has room for.
{
  const w = new Workshop({ seed: 1 });
  const gift = (wrong) => {
    w.arrive();
    const x = w.q.letters.pop();
    x.w = WISHES.find((wish) => !wish.big && !wish.unclear);
    x.made = wrong ? x.w.wrong : x.w.wanted;
    x.wrong = wrong;
    return x;
  };
  for (let i = 0; i < w.goalsCountFrom(); i++) w.load(gift(false));
  for (let i = 0; i < QUEUES.rework.limit - 2; i++)
    w.toRework(gift(true), ELF_SECONDS.remake);
  for (let i = 0; i < 9; i++) w.load(gift(true));
  w.track(0);
  const c = w.view().case;
  assert.strictEqual(c.step, "aboard");
  assert.strictEqual(c.affected.count, 2, "only what the remake pile can take");
  assert(w.resolve(c.id, "bringBack"));
  within(w, "after a recall");
  assert(w.full("rework"));
  // While the remake pile is full, checking waits: a caught gift would have nowhere to go.
  assert.strictEqual(w.queueBlocked("check"), "the remake pile is full");
  for (let i = 0; i < 40; i++) (w.step(0.5), within(w, "remaking"));
}
console.log("pile checks passed");
