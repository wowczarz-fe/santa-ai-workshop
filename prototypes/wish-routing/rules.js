class WishRouting {
  constructor(seed = "2026") {
    this.seed = seed;
    let n = 2166136261;
    for (const c of seed) n = Math.imul(n ^ c.charCodeAt(0), 16777619);
    const random = () => {
      n = (Math.imul(n, 1664525) + 1013904223) >>> 0;
      return n / 4294967296;
    };
    const wishes = [
      {
        name: "Isla",
        wish: "A blue football, please.",
        gift: "⚽",
        label: "Blue football",
        wrong: "🥦",
        mistake: "A very round broccoli",
        kind: "clear",
      },
      {
        name: "Leo",
        wish: "A mouse for my desk.",
        gift: "🖱️",
        label: "Computer mouse",
        wrong: "🐭",
        mistake: "A mouse that eats the desk",
        kind: "question",
        reply: "For my computer, please!",
      },
      {
        name: "Noah",
        wish: "A teddy bear to cuddle.",
        gift: "🧸",
        label: "Teddy bear",
        wrong: "🐻",
        mistake: "A bear that needs its own bedroom",
        kind: "clear",
      },
      {
        name: "Ava",
        wish: "A bike helmet that fits me.",
        gift: "⛑️",
        label: "Helmet fitted for Ava",
        wrong: "🪣",
        mistake: "A bucket with a chin strap",
        kind: "fit",
        reply: "My head measures 52 cm.",
      },
      {
        name: "Amir",
        wish: "A bat, please!",
        gift: "🏏",
        label: "Cricket bat",
        wrong: "🦇",
        mistake: "A bat that sleeps upside down",
        kind: "question",
        reply: "For cricket with my sister.",
      },
      {
        name: "Finn",
        wish: "A paper book about dinosaurs.",
        gift: "📗",
        label: "Dinosaur picture book",
        wrong: "🦖",
        mistake: "A dinosaur who eats books",
        kind: "clear",
      },
      {
        name: "Grace",
        wish: "A little drum to play music.",
        gift: "🥁",
        label: "Toy drum",
        wrong: "🛢️",
        mistake: "An oil drum with a bow",
        kind: "clear",
      },
      {
        name: "Sofia",
        wish: "Skates in my size, please.",
        gift: "⛸️",
        label: "Skates fitted for Sofia",
        wrong: "🛶",
        mistake: "Two canoes with shoelaces",
        kind: "fit",
        reply: "Size 32, and I am learning.",
      },
    ];
    this.orders = Array.from({ length: 32 }, (_, id) => {
      const at = id < 2 ? 0 : (id - 1) * 2.6;
      const phase = at < 28 ? 0 : at < 56 ? 1 : 2;
      const template =
        wishes[id === 0 ? 0 : Math.floor(random() * wishes.length)];
      const supplied = phase === 2 && template.kind === "question";
      const risk = supplied
        ? 0.04
        : template.kind === "clear"
          ? 0.04
          : template.kind === "fit"
            ? 0.8
            : 0.7;
      return {
        ...template,
        id,
        at,
        supplied,
        risk,
        roll: random(),
        deadline: at + 18,
      };
    });
    this.time = 0;
    this.queue = [];
    this.next = 0;
    this.jobs = { ai: null, elf: null };
    this.repairUntil = 0;
    this.deliveries = [];
    this.good = 0;
    this.missed = 0;
    this.done = false;
    this.choices = {
      ai: 0,
      elf: 0,
      riskyAI: 0,
      safeElf: 0,
      carefulElf: 0,
      suppliedAI: 0,
    };
    this.advance(0);
  }
  advance(dt) {
    if (this.done) return;
    this.time = Math.min(90, this.time + dt);
    while (
      this.next < this.orders.length &&
      this.orders[this.next].at <= this.time
    )
      this.queue.push(this.orders[this.next++]);
    this.queue = this.queue.filter((order) => {
      if (order.deadline > this.time) return true;
      this.missed++;
      return false;
    });
    for (const route of ["ai", "elf"]) {
      const job = this.jobs[route];
      if (!job || job.end > this.time) continue;
      const correct = route === "elf" || job.order.roll >= job.order.risk;
      if (correct) this.good++;
      const repair = !correct && job.order.kind === "fit";
      if (repair) this.repairUntil = this.time + 4;
      this.deliveries.unshift({ ...job.order, correct, route, repair });
      this.jobs[route] = null;
    }
    if (this.time >= 90) this.done = true;
  }
  route(id, maker) {
    if (
      this.done ||
      !["ai", "elf"].includes(maker) ||
      this.jobs[maker] ||
      (maker === "ai" && this.repairUntil > this.time)
    )
      return false;
    const order = this.queue.find((item) => item.id === id);
    if (!order) return false;
    this.queue = this.queue.filter((item) => item.id !== id);
    this.jobs[maker] = { order, end: this.time + (maker === "ai" ? 2 : 7) };
    this.choices[maker]++;
    if (maker === "ai" && order.risk > 0.5) this.choices.riskyAI++;
    if (maker === "elf" && order.risk < 0.5) this.choices.safeElf++;
    if (maker === "elf" && order.risk > 0.5) this.choices.carefulElf++;
    if (maker === "ai" && order.supplied) this.choices.suppliedAI++;
    return true;
  }
  lesson() {
    const c = this.choices;
    if (!c.ai && !c.elf)
      return "The workshop waited for a decision. Try AI on a clear wish, then save Pip for a wish that needs a question.";
    if (c.riskyAI > c.carefulElf)
      return `You sent ${c.riskyAI} wishes with missing context or fit checks to AI. Speed helps with familiar work; reserve human checks for the mistakes that matter most.`;
    if (c.safeElf >= 3)
      return `You used Pip on ${c.safeElf} wishes whose details were already clear. Those checks used time that could have helped children with missing details. Match the effort to the uncertainty.`;
    return `You gave Pip ${c.carefulElf} wishes needing extra care and AI ${c.ai} wishes in total. ${c.suppliedAI ? "When replies arrived, you let AI use the new information. " : ""}Good assurance puts limited human attention where it changes the result.`;
  }
}
