class BoxWorkshop {
  constructor(seed = 3719) {
    this.seed = seed >>> 0;
    this.time = 90;
    this.good = 0;
    this.round = 0;
    this.fault = false;
    this.update = false;
    this.busy = 0;
    this.phase = "ready";
    this.done = false;
    this.checks = 0;
    this.holds = 0;
    this.unchecked = 0;
    this.resets = 0;
    this.riskyShips = 0;
    this.shipsAfterUpdate = 0;
    this.shipped = 0;
    this.message =
      "Open a box to compare the wish with the gift. Then decide whether this load can fly.";
    this.next();
  }
  next() {
    this.round++;
    if (this.round === 4) {
      this.fault = true;
      this.update = true;
    }
    const types = [
      {
        name: "Cosy socks",
        wish: "Warm socks",
        good: "🧦",
        bad: "🐟",
        wrong: "A pair of sardines",
        risk: 0.08,
        delay: 0,
        note: "A silly mix-up disappoints one child.",
      },
      {
        name: "Toy trains",
        wish: "A toy train",
        good: "🚂",
        bad: "🥦",
        wrong: "The broccoli express",
        risk: 0.35,
        delay: 0,
        note: "New toy design. More room for a mix-up.",
      },
      {
        name: "Bike helmets",
        wish: "A safe bike helmet",
        good: "⛑️",
        bad: "🥣",
        wrong: "A cereal bowl",
        risk: 0.55,
        delay: 12,
        note: "One unsafe gift means a 12-second safety recall.",
      },
    ];
    this.kind = types[(this.round - 1) % 3];
    let state = (this.seed + Math.imul(this.round, 2654435761)) >>> 0;
    state = Math.imul(state ^ (state >>> 16), 2246822507) >>> 0;
    state = Math.imul(state ^ (state >>> 13), 3266489909) >>> 0;
    state = (state ^ (state >>> 16)) >>> 0;
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    const batchFault = this.fault || state / 4294967296 < this.kind.risk;
    this.boxes = Array.from({ length: 6 }, () => {
      state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
      return {
        bad: state / 4294967296 < (batchFault ? 0.85 : 0.02),
        open: false,
      };
    });
    this.phase = "ready";
  }
  open(index) {
    if (
      this.done ||
      this.busy ||
      this.phase !== "ready" ||
      this.boxes[index].open
    )
      return;
    this.boxes[index].open = true;
    this.checks++;
    this.busy = 2;
    this.message = this.boxes[index].bad
      ? "That does not match the wish. Hold this load to remake it, or take the risk and ship."
      : "This one matches. The unopened boxes are still uncertain.";
  }
  act(action) {
    if (this.done || this.busy || this.phase !== "ready") return;
    if (action === "reset" && this.update) {
      this.fault = false;
      this.update = false;
      this.resets++;
      this.busy = 8;
      this.message =
        "Rolling back: 8 seconds. Future batches use the old AI. These six boxes stay as they are.";
      return;
    }
    if (!["ship", "hold"].includes(action)) return;
    const checked = this.boxes.filter((b) => b.open).length;
    if (action === "ship") {
      this.shipped++;
      if (this.update) this.shipsAfterUpdate++;
      if (!checked) this.unchecked++;
      if (this.kind.delay && checked < 2) this.riskyShips++;
      this.busy = 3;
      this.phase = "shipping";
      this.message =
        "Sleigh in flight. The children will open the boxes on arrival…";
    } else {
      this.holds++;
      this.busy = 10;
      this.phase = "holding";
      this.boxes.forEach((b) => {
        b.open = true;
      });
      this.message =
        "Elves inspect and remake this load: 10 seconds. This does not change the AI making the next one.";
    }
  }
  tick(dt) {
    if (this.done) return;
    const elapsed = Math.min(dt, this.time);
    this.time = Math.max(0, this.time - elapsed);
    if (this.busy > 0) {
      this.busy = Math.max(0, this.busy - elapsed);
      if (!this.busy) {
        if (this.phase === "shipping" || this.phase === "holding") {
          const held = this.phase === "holding";
          const bad = held ? 0 : this.boxes.filter((b) => b.bad).length;
          this.good += 6 - bad;
          this.boxes.forEach((b) => {
            b.open = true;
            if (held) b.bad = false;
          });
          this.message = bad
            ? `${6 - bad} happy children; ${bad} puzzled faces.${this.kind.delay ? " Unsafe helmets recalled: the sleigh waits 12 seconds." : " Those wrong gifts earn no deliveries."}`
            : "Six wishes granted! The children love their gifts.";
          this.phase = "delivery";
          this.busy = 2 + (bad ? this.kind.delay : 0);
        } else if (this.phase === "delivery") {
          this.next();
          this.message =
            this.round === 4
              ? "A new AI update just arrived. Its results are untested. Check the evidence before trusting it."
              : "A fresh load. Match your checking to this wish and what you have learned.";
        }
      }
    }
    if (!this.time) this.done = true;
  }
  lesson() {
    if (!this.shipped && !this.holds)
      return "You did not send a load. Checking creates value when it helps you make a delivery decision: try opening one box, then ship or hold.";
    if (this.shipsAfterUpdate >= 2)
      return "You kept producing after the update without rolling it back. Checking one load cannot stop the same mistake appearing in the next: fix the source as well as the gifts.";
    if (this.holds >= 4 || this.checks >= 20)
      return "You spent much of the night checking or remaking gifts. Assurance takes time too: save the deepest checks for unfamiliar or consequential gifts.";
    if (this.unchecked >= 3 || this.riskyShips >= 2)
      return "You shipped several loads with little evidence. Fast delivery helps only when the gifts fit: spend more checking time where a mistake would force a recall.";
    if (!this.checks)
      return "You made delivery decisions without sampling. Try checking the unfamiliar or safety-critical loads and compare how many correct gifts arrive.";
    return "You used evidence before sending gifts. Keep adjusting the effort: a clean sample leaves uncertainty, and a changed AI needs fresh checking.";
  }
}
