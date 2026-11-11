// The rules of Checker Rota: one seeded run of five nights. Never touches the page.
class CheckerRota {
  static LINES = [
    {
      name: "Socks",
      item: "🧦",
      stakes: 1,
      rate: 24,
      error: 0.08,
      face: "🤷",
      jokes: [
        ["🧤", "one sock and one mitten"],
        ["🦒", "socks sized for a giraffe"],
        ["🍝", "socks knitted from spaghetti"],
        ["🐟", "a pair of kippers"],
        ["🧀", "socks that smell of cheese, on purpose"],
        ["🕳️", "socks that are mostly hole"],
      ],
    },
    {
      name: "Toys",
      item: "🧸",
      stakes: 4,
      rate: 16,
      error: 0.15,
      face: "😭",
      jokes: [
        ["🥬", "a lettuce instead of a teddy"],
        ["🧱", "one brick instead of a castle set"],
        ["🪨", "a rock with googly eyes instead of a puppy"],
        ["📄", "a tax form instead of a colouring book"],
        ["🧽", "a sponge instead of a football"],
        ["🥄", "a spoon instead of a drum kit"],
      ],
    },
    {
      name: "Bikes",
      item: "🚲",
      stakes: 12,
      rate: 8,
      error: 0.08,
      face: "🚑",
      jokes: [
        ["🧈", "a bike with butter for brake pads"],
        ["🔲", "a bike with square wheels"],
        ["🔩", "a bike whose handlebars come off in your hands"],
        ["🚀", "a bike with a rocket where the bell should be"],
        ["🌀", "a bike with the front wheel on sideways"],
        ["🔔", "a bike with no brakes, just a very loud bell"],
      ],
    },
  ];
  static NIGHTS = [
    {
      card: "A calm first night. The AI is making gifts on all three lines.",
      checkers: 4,
    },
    {
      card: "Rush order! Three times as many toys, and the AI is cutting corners.",
      tip: "New: each line has an AI switch. By hand is slow but almost never wrong.",
      volume: [1, 3, 1],
      error: [null, 0.3, null],
      flag: [null, "📦 x3 rush", null],
    },
    {
      card: "An AI update just landed on the sock line. Most socks come out wrong.",
      volume: [2.5, 1, 1],
      error: [0.85, null, null],
      flag: ["⚠️ new update", null, null],
    },
    {
      card: "The sock update is fixed, but Tinsel is tired: only three checkers tonight.",
      checkers: 3,
    },
    {
      card: "Christmas Eve! A new bike model the AI has never built before.",
      error: [null, null, 0.5],
      flag: [null, null, "🆕 new model"],
    },
  ];
  static NAMES =
    "Ava Leo Mia Noah Isla Finn Zara Omar Ruby Theo Priya Sam Lily Kofi Elsie Jack Maya Arlo".split(
      " ",
    );
  static TARGET = 125;
  static HAND_SPEED = 0.3; // by hand makes this share of what the AI makes
  static HAND_ERROR = 0.01;
  static CATCH = 0.5; // each checker catches half of the wrong gifts the others missed
  static SLOW = 0.12; // each checker slows its line by this share
  static NIGHT_LENGTH = 10; // seconds
  static SPAWN = 7.5; // gifts leave the machine during the first 7.5 seconds
  static TRAVEL = 2.5; // seconds from machine to sleigh
  static CHECK_AT = 0.55; // where along the belt the checkers stand

  constructor(seed) {
    this.seed = seed >>> 0 || 1;
    // Rolls are drawn up front so the same seed gives the same faults whatever the player does.
    this.rolls = CheckerRota.NIGHTS.map(() =>
      CheckerRota.LINES.map(() =>
        Array.from({ length: 80 }, () => [
          this.rng(),
          this.rng(),
          this.rng(),
          this.rng(),
        ]),
      ),
    );
    // Fractions of a wrong or caught gift carry over to the next night, so over a run each line
    // gets close to its expected share and the plan matters more than luck.
    this.carry = CheckerRota.LINES.map(() => [this.rng(), this.rng()]);
    this.night = 0;
    this.phase = "plan";
    this.score = 0;
    this.history = [];
    this.checkers = [0, 0, 0];
    this.ai = [true, true, true];
  }
  rng() {
    this.seed = (Math.imul(1664525, this.seed) + 1013904223) >>> 0;
    return this.seed / 4294967296;
  }
  get tonight() {
    return CheckerRota.NIGHTS[this.night];
  }
  get available() {
    return this.tonight.checkers ?? 4;
  }
  get free() {
    return this.available - this.checkers.reduce((a, b) => a + b);
  }
  get leversOn() {
    return this.night > 0;
  }
  addChecker(line) {
    if (this.phase !== "plan" || this.free < 1) return;
    this.checkers[line]++;
  }
  removeChecker(line) {
    if (this.phase !== "plan" || this.checkers[line] < 1) return;
    this.checkers[line]--;
  }
  toggleAI(line) {
    if (this.phase !== "plan" || !this.leversOn) return;
    this.ai[line] = !this.ai[line];
  }
  catchRate(n) {
    return 1 - (1 - CheckerRota.CATCH) ** n;
  }
  // What this line does tonight with the current plan: gifts made and share wrong.
  plan(line) {
    const { LINES, HAND_SPEED, HAND_ERROR, SLOW } = CheckerRota;
    const n = this.tonight,
      base = LINES[line].rate * (1 - SLOW * this.checkers[line]);
    if (!this.ai[line])
      return { count: Math.round(base * HAND_SPEED), error: HAND_ERROR };
    return {
      count: Math.round(base * (n.volume?.[line] ?? 1)),
      error: n.error?.[line] ?? LINES[line].error,
    };
  }
  go() {
    if (this.phase !== "plan") return;
    const { LINES, SPAWN } = CheckerRota;
    this.gifts = [];
    LINES.forEach((spec, line) => {
      // The carry decides how many are wrong and caught; the rolls decide which ones.
      const { count, error } = this.plan(line),
        rolls = this.rolls[this.night][line],
        share = (slot, expected) => {
          const exact = expected + this.carry[line][slot];
          this.carry[line][slot] = exact % 1;
          return Math.floor(exact);
        },
        lowest = (ids, n, roll) =>
          new Set(
            ids.sort((a, b) => rolls[a][roll] - rolls[b][roll]).slice(0, n),
          ),
        wrong = lowest([...Array(count).keys()], share(0, count * error), 0),
        caught = lowest(
          [...wrong],
          share(1, wrong.size * this.catchRate(this.checkers[line])),
          1,
        );
      for (let k = 0; k < count; k++) {
        const [, , j, name] = rolls[k];
        this.gifts.push({
          line,
          t: ((k + 0.5) * SPAWN) / count,
          wrong: wrong.has(k),
          caught: caught.has(k),
          joke: spec.jokes[Math.floor(j * spec.jokes.length)],
          child: CheckerRota.NAMES[Math.floor(name * CheckerRota.NAMES.length)],
        });
      }
    });
    this.clock = 0;
    this.phase = "night";
  }
  // Running totals the player may see during the night: wrong gifts stay hidden until morning.
  progress() {
    const { TRAVEL, CHECK_AT } = CheckerRota,
      done = (g, at) => g.t + TRAVEL * at <= this.clock;
    return {
      loaded: this.gifts.filter((g) => !g.caught && done(g, 1)).length,
      caught: this.gifts.filter((g) => g.caught && done(g, CHECK_AT)).length,
    };
  }
  tick(dt) {
    if (this.phase !== "night") return;
    this.clock = Math.min(this.clock + dt, CheckerRota.NIGHT_LENGTH);
    if (this.clock >= CheckerRota.NIGHT_LENGTH) this.morning();
  }
  morning() {
    const lines = CheckerRota.LINES.map((spec, line) => {
      const gifts = this.gifts.filter((g) => g.line === line),
        slipped = gifts.filter((g) => g.wrong && !g.caught),
        right = gifts.filter((g) => !g.wrong).length;
      return {
        right,
        caught: gifts.filter((g) => g.caught).length,
        slipped,
        points: right - slipped.length * spec.stakes,
      };
    });
    const points = lines.reduce((a, l) => a + l.points, 0);
    this.score += points;
    this.result = { lines, points };
    this.history.push({
      checkers: [...this.checkers],
      ai: [...this.ai],
      points,
    });
    this.phase = "morning";
  }
  nextNight() {
    if (this.phase !== "morning") return;
    this.night++;
    if (this.night >= CheckerRota.NIGHTS.length) {
      this.phase = "end";
      return;
    }
    // A tired night has fewer checkers: send back the spares from the busiest line.
    while (this.free < 0)
      this.checkers[this.checkers.indexOf(Math.max(...this.checkers))]--;
    this.phase = "plan";
  }
  // One lesson picked from what the player did, not from how lucky the run was.
  lesson() {
    const h = this.history,
      covered = (night, line) =>
        !h[night].ai[line] || h[night].checkers[line] >= 2,
      handNights = h.filter((x) => x.ai.filter((on) => !on).length >= 2),
      checks = h.reduce((a, x) => a + x.checkers.reduce((b, c) => b + c), 0),
      even = h.every(
        (x) =>
          Math.min(...x.checkers) >= 1 &&
          Math.max(...x.checkers) - Math.min(...x.checkers) <= 1,
      ),
      focus = (x) => x.checkers.indexOf(Math.max(...x.checkers)),
      stuck =
        h.every((x) => focus(x) === focus(h[0])) &&
        h.every((x) => !x.ai.includes(false));
    if (checks <= 2)
      return "You barely used your checkers. The AI was fast, and its mistakes went out just as fast, straight under the tree.";
    if (handNights.length >= 3)
      return "You played it so safe that the sleigh left half empty. Doing things by hand and checking everything costs gifts, so save it for where a mistake really hurts.";
    if (even)
      return "You spread your checkers evenly every night. That wastes them on socks nobody minds and leaves too few where a mistake is dangerous or the AI just changed.";
    if (stuck)
      return "You kept roughly the same plan all week, but the risk moved every night. A plan that was right last night can be wrong tonight.";
    if (!covered(2, 0))
      return "The sock update made most socks wrong, and they went out by the sackful. When the AI changes, look at that line first: switch it off or put checkers on it.";
    if (!covered(4, 2))
      return "The AI had never built the new bike, and children rode what it made. A brand-new job with a dangerous downside is exactly where checking pays most.";
    if (!covered(1, 1))
      return "The rush order tripled the toys and the mistakes with them. When the AI speeds up, the checking has to scale up too.";
    return "You moved your checkers to wherever a mistake would hurt most that night. That is the whole skill: check in proportion to what is at stake and what just changed.";
  }
}
