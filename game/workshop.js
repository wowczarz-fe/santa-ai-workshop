// The rules of one run. It never touches the page, so it also runs in Node for balance checks.

const ELF_NAMES = "Pip Holly Jingle Noel Ivy Fig Tinsel Coco".split(" ");
const CONTROLS =
  "ai0 ai1 ask checking bypass train rollback quarantine recall".split(" ");
const PAID = "train rollback quarantine recall".split(" ");
const BREAK = 3;
const STATION_NAMES = [
  "Reading letters",
  "Making toys",
  "Checking and dispatch",
];
const LEVELS = ["By hand", "Assist", "Automate"];

const VERSIONS = {
  piles: {
    name: "Piles",
    text: "Every check and every question is a pile your elves have to staff.",
    cases: false,
    letters: 1,
  },
  cases: {
    name: "Piles and cases",
    text: "As Piles, and now and then a checker brings you a case to decide.",
    cases: true,
    letters: 1,
  },
  calm: {
    name: "Calm",
    text: "Piles and cases, with fewer letters and a lower target.",
    cases: true,
    letters: 0.8,
  },
};

const QUEUES = {
  letters: { name: "Letters", station: 0, limit: 24 },
  clarify: { name: "Ask the child", station: 0, limit: 8 },
  orders: { name: "Toy orders", station: 1, limit: 20 },
  check: { name: "To check", station: 2, limit: 10 },
  pass: { name: "Straight through", station: 2, limit: 12 },
  rework: { name: "To remake", station: 2, limit: 30 },
};
const STATION_QUEUES = [
  ["letters", "clarify"],
  ["orders"],
  ["check", "pass", "rework"],
];

// Seconds one fresh elf needs per parcel (reading and making by AI level); the AI alone needs AI_SECONDS.
const ELF_SECONDS = {
  read: [5.5, 2.6],
  make: [5.5, 2.6],
  ask: 12,
  check: 2.9,
  pass: 0.16,
  remake: 5.3,
  unwrap: 2,
  recall: 10.7,
};
const AI_SECONDS = 0.6;
const INVESTIGATE_SECONDS = 5;
const ROLLBACK_SECONDS = 8;
const TRAINING_SECONDS = 10;

// What goes wrong. Elves get worse as they tire; the AI is steady on clear work and confidently
// wrong on unclear wishes; the faulty update makes the same wrong toy again and again.
const RISK = {
  elfRead: 0.02,
  elfGuess: 0.3,
  aiRead: 0.02,
  aiGuess: 0.5,
  asked: 0.01,
  elfMake: 0.02,
  aiMake: 0.03,
  fault: 0.65,
  perStrain: 0.004,
};
const CONFIRM_CATCH = 0.85; // an elf confirming an AI draft spots a wrong one
const WATCH_CATCH = 0.4; // a watching elf spots one faulty toy
const CHECK_CATCH = 0.9;
const UNSURE_IF_WRONG = 0.7;
const UNSURE_IF_RIGHT = 0.06;
const SAMPLE = 0.08; // share of parcels "a few" sends to the checking pile
const NOTICE_AFTER = 4; // faulty trains seen by checkers or on the sleigh before anyone says so

// Checkers relax after a run of clean AI-made parcels: quicker checks, some skipped, drafts trusted.
const VIGILANCE = [
  { state: "careful", from: 0, speed: 1, skip: 0, trust: 0 },
  { state: "relaxing", from: 8, speed: 0.75, skip: 0.5, trust: 0.3 },
  { state: "waving through", from: 20, speed: 0.5, skip: 0.9, trust: 0.6 },
];

// A cocoa break in time is short; a burnt-out elf is gone for a minute and comes back still tired.
const BURNOUT_AT = 88;
const BURNOUT_SECONDS = 60;
const BURNOUT_RECOVERY = 0.5;
const COCOA_RECOVERY = 6;
// Tiredness 0 to 100. Above FRESH it slows an elf and makes it miss more.
const FRESH = 30;
const TIRED_SLOWS = 0.014;
const TIRED_MISSES = 0.01;
const strain = (tired) => Math.max(0, tired - FRESH);
const CHECKER_STRAIN = 0.25; // checking tires more than reading or making

const BUDGET = 1300;
const WAGE = 0.15; // a working elf, per second
const COCOA_WAGE = 0.08;
const AI_PRICE = [0, 0.22, 0.72]; // per station, per second
const PRICE = {
  check: 2,
  train: 70,
  remake: 3,
  rollback: 65,
  quarantine: 15,
  recall: 40,
  investigate: 10,
};
const WRONG_PRICE = { everyday: 12, big: 60 };

const AT = { timmy: 45, update: 75, rush: 110, calm: 150, close: 211 };
const INFLOW = 0.88;
const RUSH_INFLOW = 1.65;
const CASE_CAP = 6;
const CASE_GAP = 20;
const CONSEQUENCE_GAP = 45;
const CASES_FROM = 60;
const PATTERN_WINDOW = 30; // seconds within which the same wrong toy from the AI counts as a pattern

// child | words | wanted toy | wrong toy the AI might make | flags
const WISHES = [
  "Timmy | A little train, please. | 🚃 model train | 🚂 full-sized locomotive | unclear",
  "Mia | A red bike for the park. | 🚲 red bike | 🚲 blue bike | big",
  "Noah | A teddy bear to cuddle. | 🧸 teddy bear | 🐻 live bear cub",
  "Ava | Something to paint with. I already have brushes. | 🎨 box of watercolours | 🪣 tin of wall paint | unclear",
  "Leo | A mouse for my desk. | 🖱️ computer mouse | 🐭 pet mouse | unclear",
  "Isla | A blue football. | ⚽ blue football | 🏈 rugby ball",
  "Oliver | A rocket for my space toys. | 🚀 toy rocket | 🎆 box of fireworks | unclear",
  "Grace | A small drum to play music. | 🥁 toy drum | 🛢️ oil drum",
  "Amir | A bat, please! I love caves. | 🦇 cuddly bat | 🏏 cricket bat | unclear",
  "Ella | Building bricks, no screens. | 🧱 box of building bricks | 📱 tablet game",
  "Finn | A book about dinosaurs. | 📕 dinosaur book | 🦖 live T. rex",
  "Sofia | A star for my bedroom. | ⭐ star night light | 🍪 star-shaped biscuit",
  "Zara | A doll in a pink dress. | 🪆 doll in a pink dress | 🪆 doll in a green dress",
  "Max | A kite that flies really high. | 🪁 kite | 🦅 real eagle",
  "Ruby | A puppy toy that barks. | 🐶 toy puppy | 🪵 sack of tree bark",
  "Jack | A pirate ship for the bath. | 🏴‍☠️ toy pirate ship | ⛵ full-sized galleon | big",
  "Lily | A yellow rubber duck. | 🐤 yellow rubber duck | 🦆 live duck",
  "Sam | Some cool shades, please. | 🕶️ pair of sunglasses | 💡 lampshade | unclear",
  "Maya | A crown like a real queen. | 👑 toy crown | 💎 set of crown jewels",
  "Ben | A dragon that breathes fire! | 🐉 toy dragon | 🔥 garden bonfire",
  "Chloe | A green dinosaur. | 🦕 green dinosaur | 🦕 purple dinosaur",
  "Ethan | Something for the snow. | 🛷 sledge | 🧂 bag of road salt | unclear big",
  "Hannah | A horse with a horn! | 🦄 toy unicorn | 🐴 horse in a party hat",
  "Lucas | A robot that helps me tidy up. | 🤖 toy robot | 🧹 broom",
  "Poppy | Something sweet, please. | 🍬 bag of sweets | 🍠 sweet potato | unclear",
  "Theo | A big red fire engine. | 🚒 red fire engine | 🚒 blue fire engine | big",
  "Nina | A guitar so I can rock. | 🎸 toy guitar | 🪨 big rock | unclear big",
  "Omar | A space helmet. | 👩‍🚀 space helmet | 🐠 fishbowl",
  "Rosa | A chess set, please. | ♟️ chess set | 🗄️ chest of drawers | unclear big",
  "Freya | Pink roller skates. | 🛼 pair of pink roller skates | ⛸️ pair of ice skates | big",
  "Kai | A yo-yo. | 🪀 yo-yo | 🥣 bowl of yoghurt",
  "Elsie | A magic wand. | 🪄 magic wand | 🥖 baguette",
].map((line) => {
  const [child, wish, wanted, wrong, flags = ""] = line.split(" | ");
  const toy = (text) => ({
    name: text.slice(text.indexOf(" ") + 1),
    icon: text.slice(0, text.indexOf(" ")),
  });
  return {
    child,
    wish,
    wanted: toy(wanted),
    wrong: toy(wrong),
    unclear: flags.includes("unclear"),
    big: flags.includes("big"),
  };
});
const TIMMY = WISHES[0];
const EVERYDAY_WISHES = WISHES.slice(1);
const LOCOMOTIVE = { name: "full-sized locomotive", icon: "🚂" };

// The first real example of each decision in a guided run; each unlocks the controls it names.
const MOMENTS = {
  elves: {
    control: "elves",
    unlocks: [],
    completes: ["move"],
    title: "Move your elves",
    text: "Letters are piling up at reading. Move one elf from making toys to reading letters.",
  },
  ai0: {
    control: "ai0",
    unlocks: ["ai0"],
    completes: ["setAi"],
    title: "Let the AI help read",
    text: "Reading by hand is slow. With Assist the AI drafts each reading and an elf confirms it.",
  },
  ai1: {
    control: "ai1",
    unlocks: ["ai1"],
    completes: ["setAi"],
    title: "Let the AI make toys",
    text: "Toy orders are piling up. Automate needs no elves here, so they can watch the machine or move.",
  },
  ask: {
    control: "ask",
    unlocks: ["ask"],
    completes: ["setAsk"],
    title: "Ask when a wish is unclear",
    text: "Timmy wants 'a little train'. Asking puts unclear letters in their own pile for an elf to ask the child.",
  },
  checking: {
    control: "checking",
    unlocks: ["checking"],
    completes: ["setChecking"],
    title: "A wrong gift is aboard",
    text: "Nothing checked it before it left. Choose which parcels go to the checking pile.",
  },
  bypass: {
    control: "bypass",
    unlocks: ["bypass"],
    completes: ["move", "bypass"],
    title: "The checking pile is full",
    text: "The line waits until checkers catch up. Move an elf to dispatch, or let the waiting parcels through unchecked.",
  },
  cocoa: {
    control: "cocoa",
    unlocks: [],
    completes: ["move"],
    title: "A tired elf",
    text: "Tired elves slow down and miss mistakes. Send this one for cocoa before it burns out.",
  },
  case: {
    control: "case",
    unlocks: [],
    completes: ["resolve"],
    title: "A checker needs you",
    text: "A checker has brought you a case. Look at the evidence and choose an option.",
  },
  rollback: {
    control: "rollback",
    unlocks: ["rollback"],
    completes: ["rollback"],
    title: "The update is faulty",
    text: "The toy machine keeps making the same wrong toy. Roll the update back to stop it.",
  },
  quarantine: {
    control: "quarantine",
    unlocks: ["quarantine"],
    completes: ["quarantine"],
    title: "Parcels from the bad update",
    text: "Parcels made during the update are marked. Quarantine sends them to be remade before they ship.",
  },
  recall: {
    control: "recall",
    unlocks: ["recall"],
    completes: ["recall"],
    title: "Wrong gifts on the sleigh",
    text: "Recall brings the wrong gifts back to be remade. It ties up your checkers and costs money.",
  },
  train: {
    control: "train",
    unlocks: ["train"],
    completes: ["train"],
    title: "The checkers are relaxing",
    text: "After many clean AI parcels they check faster and skip some. Training keeps them careful for good.",
  },
};

const FIRST_MOMENTS = ["elves", "ai0", "ai1", "ask", "checking"];
const URGENT_MOMENTS = ["bypass", "rollback", "quarantine", "recall"];
const MOMENT_GAP = 15;

const DOING = {
  letters: ["reading letters", "confirming the AI's readings"],
  clarify: ["asking a child"],
  orders: ["making toys", "confirming the AI's toys"],
  check: ["checking parcels"],
  pass: ["loading parcels"],
  rework: ["remaking parcels"],
};

const a = (name) => (/^[aeio]/.test(name) ? "an " : "a ") + name;
const money = (n) => "£" + Math.round(n);
const share = (test) =>
  EVERYDAY_WISHES.filter(test).length / EVERYDAY_WISHES.length;
const sum = (list) => list.reduce((total, n) => total + n, 0);
const countDown = (n, dt) => (n - dt < 1e-9 ? 0 : n - dt);
const AVERAGE_PRICE =
  share((w) => !w.big) * WRONG_PRICE.everyday +
  share((w) => w.big) * WRONG_PRICE.big;

class Workshop {
  constructor({ seed = 1, guided = false, version = "cases" } = {}) {
    this.seed = seed >>> 0;
    this.guided = guided;
    this.versionId = VERSIONS[version] ? version : "cases";
    this.v = VERSIONS[this.versionId];
    this.duration = 240;
    this.target = Math.round(155 * this.v.letters);
    this.t = 0;
    this.elves = ELF_NAMES.map((name, i) => ({
      name,
      station: i < 3 ? 0 : i < 6 ? 1 : 2,
      home: 0,
      tired: 8,
      rest: 0,
      doing: "",
    }));
    this.q = Object.fromEntries(Object.keys(QUEUES).map((id) => [id, []]));
    this.work = {};
    this.last = {};
    this.aboard = [];
    this.ai = [0, 0];
    this.ask = false;
    this.checking = 0;
    this.bypassed = 0;
    this.vig = { cleanRun: 0, skipped: 0, trained: false };
    this.training = 0;
    this.incident = null;
    this.cases = [];
    this.caseCount = 0;
    this.lastCaseAt = -CASE_GAP;
    this.lastCaseId = 0;
    this.sightings = [];
    this.patternAt = {};
    this.recent = [];
    this.report = { checking: this.fresh(), ask: this.fresh() };
    this.unlocked = new Set(guided ? [] : CONTROLS);
    this.happened = new Set();
    this.moment = null;
    this.momentQueue = [];
    this.shown = new Set();
    this.lastMomentAt = -MOMENT_GAP;
    this.consequenceAt = {};
    this.news = [];
    this.lastNews = 0;
    this.newsAt = {};
    this.lost = 0;
    this.unreportedLost = 0;
    this.behindNoted = false;
    this.lastId = 0;
    this.inflow = 0;
    this.spent = { people: 0, ai: 0, checking: 0, fixing: 0 };
    this.stats = {
      ai: [0, 0, 0],
      checking: [0, 0, 0],
      passed: 0,
      checked: 0,
      caught: 0,
      prevented: 0,
      waved: 0,
      wavedCost: 0,
      burnouts: 0,
      checkerBurnouts: 0,
      jammed: 0,
      faulty: 0,
      rolledBack: false,
      brokeAt: null,
      toys: 0,
      toyMistakes: 0,
    };
    this.end = null;
    for (let i = 0; i < 6; i++) this.arrive();
    this.assignWork();
    ({ projected: this.projected, slowest: this.slowest } = this.estimate());
    this.reach("elves");
  }

  rng() {
    this.seed = (Math.imul(1664525, this.seed) + 1013904223) >>> 0;
    return this.seed / 4294967296;
  }

  say(kind, text, extra = {}) {
    this.news.unshift(
      Object.freeze({
        id: ++this.lastNews,
        t: Math.round(this.t * 10) / 10,
        kind,
        text,
        ...extra,
      }),
    );
    this.news.length = Math.min(this.news.length, 30);
  }

  // Says it unless the same key went out in the last few seconds.
  sayEvery(seconds, key, kind, text, extra) {
    if (this.t - (this.newsAt[key] ?? -99) < seconds) return false;
    this.newsAt[key] = this.t;
    this.say(kind, text, extra);
    return true;
  }

  // An assurance decision reporting what it did; facts that do not apply are left out.
  // At most one per subject every CONSEQUENCE_GAP seconds, and only when there is something to say.
  consequence(about, text, facts) {
    const telling = facts.caught > 0 || facts.waiting > 0 || facts.money >= 10;
    if (
      !telling ||
      this.t - (this.consequenceAt[about] ?? -99) < CONSEQUENCE_GAP
    )
      return;
    this.consequenceAt[about] = this.t;
    const kept = Object.fromEntries(
      Object.entries(facts)
        .filter(([, n]) => n !== undefined)
        .map(([k, n]) => [k, Math.round(n)]),
    );
    this.say("consequence", text, { about, facts: kept });
  }

  fresh() {
    return {
      since: this.t ?? 0,
      checked: 0,
      caught: 0,
      avoided: 0,
      money: 0,
      asked: 0,
    };
  }

  // Tutorial moments: the first real example of each decision, one open at a time.
  // A moment waits for its turn: the first ones in a fixed order, then as they come, with at least
  // MOMENT_GAP seconds of play between two. Controls that matter at once work before their card shows.
  reach(id, parcelId = null) {
    if (!this.guided || this.happened.has("moment:" + id)) return;
    this.happened.add("moment:" + id);
    if (URGENT_MOMENTS.includes(id))
      MOMENTS[id].unlocks.forEach((c) => this.unlocked.add(c));
    this.momentQueue.push({ id, parcelId });
    this.showMoment();
  }

  showMoment() {
    if (
      this.moment ||
      !this.momentQueue.length ||
      this.t - this.lastMomentAt < MOMENT_GAP
    )
      return;
    const next = FIRST_MOMENTS.find((id) => !this.shown.has(id));
    const i = next ? this.momentQueue.findIndex((q) => q.id === next) : 0;
    if (i < 0) return;
    const [{ id, parcelId }] = this.momentQueue.splice(i, 1);
    const m = MOMENTS[id];
    for (const control of m.unlocks) {
      this.unlocked.add(control);
      this.say("unlock", m.title, { control });
    }
    this.shown.add(id);
    this.lastMomentAt = this.t;
    this.moment = {
      id,
      control: m.control,
      title: m.title,
      text: m.text,
      parcelId,
      completes: [...m.completes],
    };
  }

  did(call) {
    if (this.moment?.completes.includes(call)) this.moment = null;
  }

  acknowledge(momentId) {
    if (this.moment?.id !== momentId) return false;
    this.moment = null;
    return true;
  }

  arrive(timmy = false) {
    const w = timmy
      ? TIMMY
      : EVERYDAY_WISHES[Math.floor(this.rng() * EVERYDAY_WISHES.length)];
    const roll = {};
    for (const k of "read make unsure sample catch confirm watch skip judge".split(
      " ",
    ))
      roll[k] = this.rng();
    if (timmy) Object.assign(roll, { read: 1, make: 1, confirm: 1 });
    if (!timmy && this.q.letters.length >= QUEUES.letters.limit) {
      this.lost++;
      this.unreportedLost++;
      return;
    }
    this.q.letters.push({
      id: ++this.lastId,
      w,
      roll,
      made: null,
      wrong: false,
      asked: false,
      accepted: false,
      byAi: false,
      confident: false,
      unsure: false,
      batch: false,
      result: null,
      remake: 0,
      held: false,
      job: null,
      exit: null,
    });
    if (timmy) this.reach("ask", this.lastId);
  }

  // Elves at a station; station 3 is the cocoa break.
  staff(s) {
    return this.elves.filter((e) => e.station === s);
  }

  strainAt(s) {
    const team = this.staff(s);
    return sum(team.map((e) => strain(e.tired))) / Math.max(1, team.length);
  }

  // Elf-seconds of work a station's elves do each second, less any elf busy with a case.
  power(s) {
    const busy =
      this.cases[0]?.resolving && this.cases[0].station === s ? 1 : 0;
    return Math.max(
      0,
      sum(this.staff(s).map((e) => 1 - strain(e.tired) * TIRED_SLOWS)) - busy,
    );
  }

  capacity(s, pool) {
    if (s === 1 && this.incident?.rollingBack) return 0;
    if (pool === "ai") return 1;
    return this.power(s) * (s === 2 && this.training ? 0.5 : 1);
  }

  poolFor(id) {
    if (id === "letters") return this.ai[0] === 2 ? "ai" : "elf";
    if (id === "orders") return this.ai[1] === 2 ? "ai" : "elf";
    return "elf";
  }

  poolQueues(s, pool) {
    if (s === 2 && this.holding()) return pool === "elf" ? ["rework"] : [];
    return STATION_QUEUES[s].filter((id) => this.poolFor(id) === pool);
  }

  holding() {
    return this.q.rework.some((x) => x.held);
  }

  seconds(id, x) {
    if (id === "letters")
      return this.ai[0] === 2 ? AI_SECONDS : ELF_SECONDS.read[this.ai[0]];
    if (id === "orders")
      return this.ai[1] === 2 ? AI_SECONDS : ELF_SECONDS.make[this.ai[1]];
    if (id === "check") return this.secondsPerCheck();
    if (id === "rework") return x.remake;
    return ELF_SECONDS[id === "clarify" ? "ask" : "pass"];
  }

  full(id) {
    return this.q[id].length >= QUEUES[id].limit;
  }

  waitsToAsk(x) {
    return this.ask && x.w.unclear && !x.asked && !x.accepted;
  }

  // Why a queue cannot move its next parcel now, or null.
  queueBlocked(id) {
    const nobody =
      this.poolFor(id) === "elf" && !this.staff(QUEUES[id].station).length;
    switch (id) {
      case "letters":
        if (nobody) return "nobody reading";
        if (this.q.letters[0] && this.waitsToAsk(this.q.letters[0]))
          return "the clarify pile is full";
        return this.full("orders") ? "the toy pile is full" : null;
      case "clarify":
        if (nobody) return "nobody here to ask";
        return this.full("orders") ? "the toy pile is full" : null;
      case "orders":
        if (this.incident?.rollingBack) return "rolling back the update";
        if (nobody) return "nobody making toys";
        if (this.full("check")) return "the checking pile is full";
        return this.full("pass") ? "the straight-through pile is full" : null;
      default:
        if (nobody) return "no checkers here";
        return id !== "rework" && this.holding()
          ? "waiting for the quarantined parcels"
          : null;
    }
  }

  stationBlocked(s) {
    if (s === 0) return this.full("orders") ? "the toy pile is full" : null;
    if (s === 1)
      return this.full("check")
        ? "the checking pile is full"
        : this.full("pass")
          ? "the straight-through pile is full"
          : null;
    return this.holding() ? "waiting for the quarantined parcels" : null;
  }

  vigilance() {
    if (this.vig.trained) return VIGILANCE[0];
    return VIGILANCE.findLast((v) => this.vig.cleanRun >= v.from);
  }

  secondsPerCheck() {
    return ELF_SECONDS.check * this.vigilance().speed;
  }

  confirmCatch(s) {
    return (
      Math.max(0, CONFIRM_CATCH - this.strainAt(s) * TIRED_MISSES) *
      (1 - this.vigilance().trust)
    );
  }

  checkCatch() {
    return Math.max(0.35, CHECK_CATCH - this.strainAt(2) * TIRED_MISSES);
  }

  suspect(x) {
    if (x.batch && this.incident?.known) return "batch";
    return x.unsure ? "unsure" : false;
  }

  // An unclear wish stops being risky once the child has been asked.
  needsCheck(x, level = this.checking) {
    const sample = x.roll.sample < SAMPLE;
    const risky = x.w.big || (x.w.unclear && !x.asked) || this.suspect(x);
    return [sample, sample || Boolean(risky), true][level];
  }

  marked() {
    return this.incident?.known
      ? [...this.q.check, ...this.q.pass].filter((x) => x.batch)
      : [];
  }

  left() {
    return BUDGET - sum(Object.values(this.spent));
  }

  pay(kind, amount) {
    this.spent[kind] += amount;
    if (this.left() <= 0 && this.stats.brokeAt === null) {
      this.stats.brokeAt = this.t;
      this.say("broke", "The money has run out. Paid actions have stopped.");
    }
  }

  price(x) {
    return x.w.big ? WRONG_PRICE.big : WRONG_PRICE.everyday;
  }

  step(dt) {
    while (dt > 1e-9 && !this.end) {
      const d = Math.min(dt, 0.1);
      this.tick(d);
      dt -= d;
    }
  }

  tick(dt) {
    this.t = Math.min(this.duration, this.t + dt);
    this.events();
    if (this.t < AT.close) {
      const rush = this.t >= AT.rush && this.t < AT.calm;
      this.inflow += dt * (rush ? RUSH_INFLOW : INFLOW) * this.v.letters;
      for (; this.inflow >= 1; this.inflow--) this.arrive();
    }
    this.timers(dt);
    this.route();
    for (const s of [0, 1, 2])
      for (const pool of ["elf", "ai"]) this.run(s, pool, dt);
    this.assignWork();
    this.elvesTick(dt);
    this.track(dt);
    if (this.t >= this.duration) this.finish();
  }

  events() {
    const at = (time, key, fn) => {
      if (this.t >= time && !this.happened.has(key)) {
        this.happened.add(key);
        fn();
      }
    };
    at(AT.timmy, "timmy", () => {
      this.arrive(true);
      this.say(
        "timmy",
        "Timmy writes: 'A little train, please.' How little is little?",
      );
    });
    at(AT.update, "update", () => {
      this.incident = { fault: true, known: false, rollingBack: 0, seen: 0 };
      this.say("update", "A shiny new AI update just reached the toy machine.");
    });
    at(AT.rush, "rush", () =>
      this.say("rush", "Last-minute rush! Letters now arrive twice as fast."),
    );
    // Guided runs fall back to these times when the real example has not come by then.
    if (this.q.letters.length >= 12 || this.t >= 25) this.reach("ai0");
    if (
      this.happened.has("moment:ai0") &&
      (this.q.orders.length >= 10 || this.t >= 40)
    )
      this.reach("ai1");
    if (this.t >= 60) this.reach("checking");
    if (this.happened.has("moment:checking") && this.full("check"))
      this.reach("bypass", this.q.check[0].id);
    const tired = this.elves.find((e) => e.station < BREAK && e.tired >= 60);
    if (tired) this.reach("cocoa");
    if (this.t >= 90 && this.vigilance().state === "waving through")
      this.reach("train");
    this.showMoment();
  }

  // Unclear letters go to the clarify pile when asking is on; an unclear big gift may become a case.
  route() {
    for (let x = this.q.letters[0]; x; x = this.q.letters[0]) {
      if (this.waitsToAsk(x) && !this.full("clarify"))
        this.q.clarify.push(this.q.letters.shift());
      else if (
        x.w.unclear &&
        x.w.big &&
        !this.ask &&
        !x.accepted &&
        this.ai[0] > 0 &&
        this.canOpenCase()
      )
        this.openCase("unclear", [this.q.letters.shift()]);
      else break;
    }
  }

  run(s, pool, dt) {
    const key = s + pool;
    const ready = () =>
      this.poolQueues(s, pool).filter(
        (id) => this.q[id].length && !this.queueBlocked(id),
      );
    if (!ready().length) return void (this.work[key] = 0);
    this.work[key] = (this.work[key] ?? 0) + this.capacity(s, pool) * dt;
    for (let open = ready(); open.length; open = ready()) {
      const id = this.nextQueue(key, open);
      const cost = this.seconds(id, this.q[id][0]);
      if (this.work[key] < cost) break;
      this.work[key] -= cost;
      this.last[key] = id;
      this.finishWork(id, this.q[id].shift());
    }
  }

  // Queues sharing a pool take turns, one parcel each.
  nextQueue(key, open) {
    const order = STATION_QUEUES.flat();
    const after = order.indexOf(this.last[key]);
    return open.find((id) => order.indexOf(id) > after) ?? open[0];
  }

  finishWork(id, x) {
    if (id === "letters") this.read(x);
    else if (id === "clarify") {
      x.asked = true;
      x.wrong = x.roll.read < RISK.asked;
      this.report.ask.asked++;
      this.q.orders.push(x);
    } else if (id === "orders") this.make(x);
    else if (id === "check" || id === "pass") {
      this.stats.passed++;
      if (id === "check") this.checkParcel(x);
      else this.load(x);
    } else this.remade(x);
  }

  read(x) {
    const level = this.ai[0];
    const guess = x.w.unclear && !x.asked;
    if (level === 0)
      x.wrong =
        x.roll.read <
        (guess ? RISK.elfGuess : RISK.elfRead) +
          this.strainAt(0) * RISK.perStrain;
    else {
      const draftWrong = x.roll.read < (guess ? RISK.aiGuess : RISK.aiRead);
      x.byAi = true;
      x.confident = guess;
      x.wrong =
        draftWrong && !(level === 1 && x.roll.confirm < this.confirmCatch(0));
    }
    if (x.w === TIMMY) x.wrong = true;
    this.q.orders.push(x);
  }

  make(x) {
    const level = this.ai[1];
    x.madeAt = this.t;
    x.batch = Boolean(this.incident?.fault) && level > 0;
    let faulty = false;
    let slip;
    if (level === 0)
      slip = x.roll.make < RISK.elfMake + this.strainAt(1) * RISK.perStrain;
    else {
      x.byAi = true;
      faulty = x.batch && x.roll.make < RISK.fault;
      const draftWrong = faulty || x.roll.make < RISK.aiMake;
      const confirmed =
        level === 1 && draftWrong && x.roll.confirm < this.confirmCatch(1);
      if (confirmed && faulty) this.notice("watcher");
      if (confirmed) faulty = false;
      slip = draftWrong && !confirmed;
    }
    x.wrong ||= slip;
    this.stats.toys++;
    if (slip) this.stats.toyMistakes++;
    x.made = faulty ? LOCOMOTIVE : x.wrong ? x.w.wrong : x.w.wanted;
    x.unsure =
      x.byAi &&
      x.roll.unsure <
        (x.wrong && !faulty && !x.confident
          ? UNSURE_IF_WRONG
          : UNSURE_IF_RIGHT);
    if (faulty && level === 2) {
      const missed = this.staff(1).reduce(
        (p, e) => p * (1 - WATCH_CATCH * (1 - strain(e.tired) * TIRED_MISSES)),
        1,
      );
      if (x.roll.watch < 1 - missed) this.notice("watcher");
    }
    this.recent = [...this.recent.slice(-49), x];
    x.route = this.needsCheck(x) ? "check" : "pass";
    this.q[x.route].push(x);
  }

  checkParcel(x) {
    const v = this.vigilance();
    if (x.byAi && x.roll.skip < v.skip) {
      this.vig.skipped++;
      x.exit = "skipped";
      if (x.wrong) {
        this.stats.waved++;
        this.stats.wavedCost += this.price(x);
      }
      return this.load(x);
    }
    this.stats.checked++;
    this.pay("checking", PRICE.check);
    this.report.checking.checked++;
    this.report.checking.money += PRICE.check;
    x.exit = "checked";
    // An unsure checker brings the parcel to the player instead of deciding; nothing is revealed yet.
    if (x.unsure && x.roll.judge < 0.3 && this.canOpenCase()) {
      x.exit = "case";
      return this.openCase("judge", [x]);
    }
    if (x.wrong && x.roll.catch >= this.checkCatch()) {
      x.slipped = true;
      return this.load(x);
    }
    this.reveal(x);
    const text = x.wrong
      ? `A checker caught a mistake: ${x.w.child} wished for ${a(x.w.wanted.name)} and got ${a(x.made.name)}.`
      : `A checker opened ${x.w.child}'s ${x.w.wanted.name}: just right.`;
    this.say("checked", text, {
      check: this.copy(x, Math.round(this.secondsPerCheck() * 10) / 10, "elf"),
    });
    if (!x.wrong) {
      if (x.byAi) this.cleanParcel();
      return this.load(x);
    }
    this.caught(x);
    this.vig.cleanRun = 0;
    this.sighting(x, "checker");
    this.toRework(x, ELF_SECONDS.remake);
  }

  cleanParcel() {
    const before = this.vigilance().state;
    this.vig.cleanRun++;
    if (before === "careful" && this.vigilance().state !== "careful") {
      this.sayEvery(
        20,
        "relaxed",
        "relaxed",
        `After ${this.vig.cleanRun} clean AI parcels in a row the checkers have started to skim and skip.`,
      );
    }
  }

  caught(x) {
    this.stats.caught++;
    this.stats.prevented += this.price(x);
    this.report.checking.caught++;
    this.report.checking.avoided += this.price(x);
  }

  toRework(x, seconds, job = null) {
    Object.assign(x, { remake: seconds, job });
    this.q.rework.push(x);
  }

  remade(x) {
    const job = x.job;
    if (job) {
      job.left--;
      if (x.wrong) {
        job.caught++;
        job.avoided += this.price(x);
      }
    }
    x.exit ??= "remade";
    Object.assign(x, {
      remake: 0,
      held: false,
      job: null,
      wrong: false,
      batch: false,
      unsure: false,
      made: x.w.wanted,
      result: "right",
    });
    this.pay("fixing", PRICE.remake);
    this.load(x);
    if (job && !job.left) this.finishJob(job);
  }

  finishJob(job) {
    const seconds = this.t - job.since;
    const text = `${job.what}: ${job.count} remade in ${Math.round(seconds)} seconds, ${job.caught} of them wrong, about ${money(job.avoided)} of mistakes avoided, ${money(job.money + job.count * PRICE.remake)} spent.`;
    this.consequence(job.about, text, {
      seconds,
      checked: job.count,
      caught: job.caught,
      estimatedAvoided: job.avoided,
      money: job.money + job.count * PRICE.remake,
    });
  }

  load(x) {
    this.reveal(x);
    this.aboard.push(x);
    if (!x.wrong) return;
    const slipped = x.slipped
      ? " It slipped past a checker."
      : x.exit === "skipped"
        ? " A relaxed checker waved it through."
        : "";
    const text = `Wrong gift aboard! ${x.w.child} wished for ${a(x.w.wanted.name)} and got ${a(x.made.name)}.${slipped}`;
    this.say("loaded", text, { check: this.copy(x) });
    if (this.t >= AT.timmy) this.reach("checking", x.id);
    if (this.incident) this.reach("recall", x.id);
    this.sighting(x, "sleigh");
  }

  reveal(x) {
    x.result ??= x.wrong ? "wrong" : "right";
  }

  // A wrong toy someone has now seen. Trains from the update add up until someone says so, and the
  // same wrong toy seen twice is a pattern a checker can bring to the player.
  sighting(x, by) {
    this.sightings.push({ t: this.t, name: x.made.name, parcel: x });
    if (x.made === LOCOMOTIVE && ++this.incident.seen >= NOTICE_AFTER)
      this.notice(by);
    // Only the AI repeats itself; the same slip by two different elves is a coincidence.
    const same = this.sightings.filter(
      (s) =>
        s.name === x.made.name &&
        s.parcel.byAi &&
        this.t - s.t <= PATTERN_WINDOW,
    );
    const fresh = !this.cases.some(
      (c) => c.kind === "pattern" && c.name === x.made.name,
    );
    if (
      same.length >= 2 &&
      fresh &&
      this.t - (this.patternAt[x.made.name] ?? -99) > 60 &&
      this.canOpenCase()
    ) {
      this.patternAt[x.made.name] = this.t;
      this.openCase(
        "pattern",
        same.slice(-3).map((s) => s.parcel),
        x.made.name,
      );
    }
  }

  notice(by) {
    if (!this.incident || this.incident.known) return;
    this.incident.known = true;
    const who = {
      watcher: "An elf watching the toy machine",
      checker: "The checkers",
      sleigh: "The sleigh crew",
      case: "Your investigation",
    }[by];
    this.say(
      "noticed",
      `${who} spotted it: the new update keeps making full-sized trains.`,
      { by },
    );
    this.reach("rollback");
  }

  copy(x, seconds, by) {
    const check = {
      wish: x.w.wish,
      wanted: { ...x.w.wanted },
      made: { ...x.made },
      result: x.wrong ? "wrong" : "right",
    };
    return by ? { ...check, seconds, by } : check;
  }

  // Cases: rare, tied to something a checker has really seen, at most one open and one waiting.
  canOpenCase() {
    return (
      this.v.cases &&
      this.unlocked.has("checking") &&
      this.t >= CASES_FROM &&
      this.cases.length < 2 &&
      this.caseCount < CASE_CAP &&
      this.t - this.lastCaseAt >= CASE_GAP
    );
  }

  openCase(kind, parcels, name = null) {
    this.caseCount++;
    this.lastCaseAt = this.t;
    const id = ++this.lastCaseId;
    const first = parcels[0];
    const texts = {
      judge: `A checker is unsure about ${first.w.child}'s parcel. Is this the toy the child asked for?`,
      unclear: `${first.w.child} wrote '${first.w.wish}' and it is a big gift. The AI would have to guess.`,
      pattern: `The checkers have now seen ${a(name)} ${parcels.length} times. Something may be making the same mistake.`,
    };
    this.cases.push({
      id,
      kind,
      name,
      parcels,
      text: texts[kind],
      station: kind === "unclear" ? 0 : 2,
      resolving: null,
      since: first.madeAt ?? this.t,
    });
    this.say("case", texts[kind], { caseId: id });
    this.reach("case");
  }

  // Parcels at dispatch made since the first sighting: what holding a pattern would cover.
  affected(c) {
    if (c.kind !== "pattern") return c.parcels;
    return [...this.q.check, ...this.q.pass].filter((x) => x.madeAt >= c.since);
  }

  options(c) {
    const checker = this.staff(2).length ? null : "no checker at dispatch";
    const broke = this.left() <= 0 ? "out of money" : null;
    const n = this.affected(c).length;
    const remake = Math.round(ELF_SECONDS.remake);
    const list = {
      judge: [
        {
          id: "ship",
          label: "It is right, ship it",
          seconds: 0,
          money: 0,
          scope: "this parcel",
          why: null,
        },
        {
          id: "remake",
          label: "It is wrong, remake it",
          seconds: remake,
          money: PRICE.remake,
          scope: "this parcel",
          why: checker,
        },
      ],
      unclear: [
        {
          id: "ask",
          label: "Ask the child",
          seconds: ELF_SECONDS.ask,
          money: 0,
          scope: "this letter",
          why: this.staff(0).length ? null : "nobody at reading to ask",
        },
        {
          id: "accept",
          label: "Accept the AI's reading",
          seconds: 0,
          money: 0,
          scope: "this letter",
          why: null,
        },
      ],
      pattern: [
        {
          id: "investigate",
          label: "Investigate",
          seconds: INVESTIGATE_SECONDS,
          money: PRICE.investigate,
          scope: "the toy line",
          why: checker ?? broke,
        },
        {
          id: "hold",
          label: "Hold the parcels made since",
          seconds: n * remake,
          money: n * PRICE.remake,
          scope: `${n} parcels`,
          why: n ? null : "none waiting",
        },
        {
          id: "carryOn",
          label: "Carry on",
          seconds: 0,
          money: 0,
          scope: "nothing",
          why: null,
        },
      ],
    }[c.kind];
    return list.map((o) => ({
      ...o,
      available: !o.why && !c.resolving,
      why: c.resolving ? "already answered" : o.why,
    }));
  }

  resolve(caseId, optionId) {
    const c = this.cases[0];
    if (this.end || !c || c.id !== caseId || c.resolving) return false;
    const option = this.options(c).find((o) => o.id === optionId);
    if (!option?.available) return false;
    this.did("resolve");
    const timed = ["remake", "ask", "investigate"].includes(optionId);
    if (timed) {
      c.resolving = {
        optionId,
        remaining: option.seconds,
        duration: option.seconds,
      };
      if (optionId === "investigate") this.pay("checking", PRICE.investigate);
      return true;
    }
    this.closeCase(c, optionId);
    return true;
  }

  closeCase(c, optionId) {
    this.cases.shift();
    const x = c.parcels[0];
    const extra = { caseId: c.id, option: optionId };
    let text;
    let facts;
    if (c.kind === "judge") {
      extra.check = this.copy(x, ELF_SECONDS.check, "player");
      this.reveal(x);
      if (optionId === "ship") {
        text = x.wrong
          ? `You shipped it, and it was wrong: ${x.w.child} wanted ${a(x.w.wanted.name)}.`
          : `You shipped it, and it was right.`;
        facts = { checked: 1, caught: 0, money: 0 };
        this.load(x);
      } else {
        if (x.wrong) this.caught(x);
        text = x.wrong
          ? `Good call: ${x.w.child} wanted ${a(x.w.wanted.name)}. Remade and loaded.`
          : `It was right after all; remaking it cost time and money.`;
        facts = {
          seconds: ELF_SECONDS.remake,
          checked: 1,
          caught: x.wrong ? 1 : 0,
          estimatedAvoided: x.wrong ? this.price(x) : 0,
          money: PRICE.remake,
        };
        Object.assign(x, { wrong: false, made: x.w.wanted, result: "right" });
        this.pay("fixing", PRICE.remake);
        this.aboard.push(x);
      }
    } else if (c.kind === "unclear") {
      if (optionId === "ask") {
        Object.assign(x, { asked: true, wrong: x.roll.read < RISK.asked });
        this.q.orders.push(x);
        text = `${x.w.child} explained. The letter went on to the toy makers.`;
        facts = {
          seconds: ELF_SECONDS.ask,
          estimatedAvoided: RISK.aiGuess * this.price(x),
          money: 0,
        };
      } else {
        x.accepted = true;
        this.q.letters.unshift(x);
        text = `The AI will read ${x.w.child}'s letter as best it can.`;
        facts = { money: 0 };
      }
    } else if (optionId === "investigate") {
      this.vig.cleanRun = 0;
      const real = c.name === LOCOMOTIVE.name && this.incident?.fault;
      if (real) this.notice("case");
      text = real
        ? "Investigated: the new toy update is faulty. The checkers are paying close attention again."
        : `Investigated: no shared fault, just bad luck with ${c.name}s. The checkers are paying close attention again.`;
      facts = { seconds: INVESTIGATE_SECONDS, money: PRICE.investigate };
    } else if (optionId === "hold") {
      const held = this.affected(c);
      this.q.check = this.q.check.filter((x) => !held.includes(x));
      this.q.pass = this.q.pass.filter((x) => !held.includes(x));
      const job = {
        about: "case",
        what: "Held parcels",
        count: held.length,
        left: held.length,
        caught: 0,
        avoided: 0,
        money: 0,
        since: this.t,
      };
      held.forEach((x) => this.toRework(x, ELF_SECONDS.remake, job));
      text = `${held.length} parcels made since the first ${c.name} are waiting to be remade.`;
      facts = { waiting: held.length, money: held.length * PRICE.remake };
    } else {
      text = "You carried on. The parcels made since stay in the line.";
      facts = { waiting: this.affected(c).length };
    }
    this.say("resolved", text, extra);
    this.consequence("case", text, facts);
  }

  timers(dt) {
    const c = this.cases[0];
    if (
      c?.resolving &&
      this.staff(c.station).length &&
      (c.resolving.remaining = countDown(c.resolving.remaining, dt)) === 0
    )
      this.closeCase(c, c.resolving.optionId);
    const inc = this.incident;
    if (
      inc?.rollingBack > 0 &&
      (inc.rollingBack = countDown(inc.rollingBack, dt)) === 0
    ) {
      inc.fault = false;
      this.say(
        "rolledBack",
        "Rollback done. The toy machine makes proper toys again.",
      );
      this.consequence(
        "rollback",
        `Rolled back: the toy line stood still for ${ROLLBACK_SECONDS} seconds and cost ${money(PRICE.rollback)}. New toys are safe.`,
        { seconds: ROLLBACK_SECONDS, money: PRICE.rollback },
      );
    }
    if (
      this.training > 0 &&
      (this.training = countDown(this.training, dt)) === 0
    ) {
      this.vig.trained = true;
      this.say(
        "trained",
        "Training done. The checkers stay careful however clean the AI looks.",
      );
      this.consequence(
        "train",
        `Training took ${TRAINING_SECONDS} seconds of half-speed checking and cost ${money(PRICE.train)}.`,
        { seconds: TRAINING_SECONDS, money: PRICE.train },
      );
    }
  }

  // What each elf is doing now: elves at a station take turns over the queues that have work.
  assignWork() {
    for (const s of [0, 1, 2]) {
      const team = this.staff(s);
      const open = this.poolQueues(s, "elf").filter(
        (id) => this.q[id].length && !this.queueBlocked(id),
      );
      const watching =
        s === 1 &&
        this.ai[1] === 2 &&
        this.q.orders.length &&
        !this.incident?.rollingBack;
      const c = this.cases[0];
      team.forEach((e, i) => {
        const caseJob = c?.resolving && c.station === s && i === 0;
        if (caseJob)
          e.doing = {
            remake: "remaking a parcel",
            ask: "asking a child",
            investigate: "investigating a pattern",
          }[c.resolving.optionId];
        else if (watching) e.doing = "watching the toy machine";
        else if (!open.length) e.doing = "nothing to do";
        else {
          const id = open[i % open.length];
          e.doing =
            DOING[id][id === "letters" || id === "orders" ? this.ai[s] : 0];
        }
      });
    }
    for (const e of this.staff(BREAK))
      e.doing = e.rest > 0 ? "burnt out" : "having cocoa";
  }

  elvesTick(dt) {
    this.elves.forEach((e, i) => {
      this.pay("people", dt * (e.station === BREAK ? COCOA_WAGE : WAGE));
      if (e.station === BREAK) {
        e.tired = Math.max(
          0,
          e.tired - dt * (e.rest > 0 ? BURNOUT_RECOVERY : COCOA_RECOVERY),
        );
        if (e.rest > 0 && (e.rest = countDown(e.rest, dt)) === 0)
          e.station = e.home;
        return;
      }
      const s = e.station;
      const ids = STATION_QUEUES[s].filter((id) => id !== "rework");
      const pressure =
        sum(ids.map((id) => this.q[id].length)) /
        sum(ids.map((id) => QUEUES[id].limit));
      const effort =
        0.5 +
        Math.max(0, pressure - 0.25) * 0.75 +
        (s === 2 ? CHECKER_STRAIN + 0.1 * this.checking : 0);
      const gain =
        e.doing === "nothing to do"
          ? -0.12
          : e.doing === "watching the toy machine"
            ? 0.15
            : effort;
      e.tired = Math.min(100, Math.max(0, e.tired + dt * gain));
      if (e.tired < BURNOUT_AT) return;
      Object.assign(e, { home: s, station: BREAK, rest: BURNOUT_SECONDS });
      this.stats.burnouts++;
      if (s === 2) this.stats.checkerBurnouts++;
      this.say(
        "tired",
        `${e.name} burnt out and walked off for a long cocoa break.`,
        { elf: i },
      );
    });
  }

  track(dt) {
    this.pay("ai", dt * (AI_PRICE[this.ai[0]] + AI_PRICE[this.ai[1]]));
    this.stats.ai[this.ai[0]] += dt;
    this.stats.ai[this.ai[1]] += dt;
    this.stats.checking[this.checking] += dt;
    if (this.full("check") || this.holding()) this.stats.jammed += dt;
    const inc = this.incident;
    if (inc?.fault && inc.known && !inc.rollingBack && this.ai[1] > 0)
      this.stats.faulty += dt;
    if (this.stationBlocked(0))
      this.sayEvery(
        10,
        "blocked0",
        "blocked",
        "Reading stopped: the toy pile is full.",
        { station: 0 },
      );
    if (this.stationBlocked(1))
      this.sayEvery(
        10,
        "blocked1",
        "blocked",
        `The toy line stopped: ${this.stationBlocked(1)}.`,
        { station: 1 },
      );
    const count = this.unreportedLost;
    if (
      count &&
      this.sayEvery(
        5,
        "lost",
        "lost",
        `${count} ${count === 1 ? "letter was" : "letters were"} lost: the letter pile is full.`,
        { count },
      )
    )
      this.unreportedLost = 0;
    if (inc?.known && this.marked().length)
      this.reach("quarantine", this.marked()[0].id);
    if (this.t - this.report.checking.since >= CONSEQUENCE_GAP)
      this.reportChecking();
    if (this.t - this.report.ask.since >= CONSEQUENCE_GAP) this.reportAsking();
    // Averaged over about 15 seconds; too early to judge in the first seconds; re-armed once comfortably back.
    const now = this.estimate();
    this.projected += (now.projected - this.projected) * Math.min(1, dt / 15);
    this.slowest = now.slowest;
    const pace = this.pace();
    if (this.t >= 20 && pace.behind && !this.behindNoted) {
      this.behindNoted = true;
      this.say(
        "behind",
        `At this pace Santa leaves with about ${pace.projected} right gifts. ${STATION_NAMES[pace.slowest]} is holding things up.`,
        { station: pace.slowest },
      );
    }
    if (pace.projected >= this.target + 5) this.behindNoted = false;
  }

  reportChecking() {
    const r = this.report.checking;
    const seconds = this.t - r.since;
    if (r.checked && seconds >= 5) {
      const text = `${["A few checks", "Risky checks", "Checking everything"][this.checking]}, last ${Math.round(seconds)} seconds: ${r.checked} checked, ${r.caught} caught, about ${money(r.avoided)} of mistakes avoided, ${this.q.check.length} waiting, ${money(r.money)} spent.`;
      this.consequence("checking", text, {
        seconds,
        checked: r.checked,
        caught: r.caught,
        estimatedAvoided: r.avoided,
        waiting: this.q.check.length,
        money: r.money,
      });
    }
    this.report.checking = this.fresh();
  }

  // Estimated from what a guess at the current AI level gets wrong and what a mistake costs.
  reportAsking() {
    const r = this.report.ask;
    const seconds = this.t - r.since;
    if (r.asked && seconds >= 5) {
      const avoided =
        r.asked *
        [RISK.elfGuess, RISK.aiGuess, RISK.aiGuess][this.ai[0]] *
        AVERAGE_PRICE;
      const text = `Asking, last ${Math.round(seconds)} seconds: ${r.asked} children asked, about ${money(avoided)} of wrong guesses avoided, ${this.q.clarify.length} letters waiting to be asked.`;
      this.consequence("ask", text, {
        seconds,
        checked: r.asked,
        estimatedAvoided: avoided,
        waiting: this.q.clarify.length,
      });
    }
    this.report.ask = this.fresh();
  }

  pace() {
    return {
      projected: Math.round(this.projected),
      behind: this.projected < this.target,
      slowest: this.slowest,
    };
  }

  checkShare(level = this.checking) {
    if (this.recent.length < 10)
      return [
        SAMPLE,
        SAMPLE + share((w) => w.big || (w.unclear && !this.ask)),
        1,
      ][level];
    return (
      this.recent.filter((x) => this.needsCheck(x, level)).length /
      this.recent.length
    );
  }

  // Parcels a second each station manages at its steady speed now.
  rates() {
    const unclear = share((w) => w.unclear);
    const elves = (s) =>
      sum(this.staff(s).map((e) => 1 - strain(e.tired) * TIRED_SLOWS));
    const asking = this.ask ? unclear : 0;
    const reading =
      this.ai[0] === 2
        ? Math.min(
            1 / AI_SECONDS / (1 - asking),
            asking ? elves(0) / ELF_SECONDS.ask / asking : Infinity,
          )
        : elves(0) /
          ((1 - asking) * ELF_SECONDS.read[this.ai[0]] +
            asking * ELF_SECONDS.ask);
    const making =
      this.ai[1] === 2
        ? 1 / AI_SECONDS
        : elves(1) / ELF_SECONDS.make[this.ai[1]];
    const checked = this.checkShare();
    const dispatch =
      elves(2) /
      (checked * this.secondsPerCheck() +
        (1 - checked) * ELF_SECONDS.pass +
        0.05 * ELF_SECONDS.remake);
    return [reading, making, dispatch];
  }

  // Right gifts expected at departure if every station keeps its current speed.
  estimate() {
    const rates = this.rates();
    const slowest = rates.indexOf(Math.min(...rates));
    const later = (from, to) =>
      Math.max(0, Math.min(to, AT.close) - Math.max(from, this.t));
    const letters =
      this.v.letters *
      (INFLOW * (later(0, AT.rush) + later(AT.calm, AT.close)) +
        RUSH_INFLOW * later(AT.rush, AT.calm));
    const supply = sum(Object.values(this.q).map((q) => q.length)) + letters;
    const right = this.aboard.filter((x) => !x.wrong).length;
    const rightShare =
      this.aboard.length >= 10 ? right / this.aboard.length : 0.95;
    return {
      projected:
        right +
        Math.min(rates[slowest] * (this.duration - this.t), supply) *
          rightShare,
      slowest,
    };
  }

  levers() {
    const tired = (s) =>
      Math.round(
        sum(this.staff(s).map((e) => e.tired)) /
          Math.max(1, this.staff(s).length),
      );
    const elves = (s) =>
      sum(this.staff(s).map((e) => 1 - strain(e.tired) * TIRED_SLOWS));
    const vig = this.vigilance().state;
    const unclearWaiting = this.q.letters.filter((x) => x.w.unclear).length;
    const fault = this.incident?.known && this.incident.fault;
    const ai = (s) =>
      LEVELS.map((name, level) => {
        const who = [
          [
            `elves read every letter`,
            `the AI drafts each reading and an elf confirms it`,
            `the AI reads alone; elves here ask children`,
          ],
          [
            `elves make every toy`,
            `the AI drafts each toy and an elf confirms it`,
            `the AI makes toys alone; elves here watch the machine`,
          ],
        ][s][level];
        const here = this.staff(s).length
          ? `yours here are at ${tired(s)}`
          : "no elves here";
        const mistakesFrom =
          level === 0
            ? `tired elves: ${here}`
            : level === 1
              ? `AI drafts the confirming elves miss: ${here}, checkers ${vig}`
              : s === 0
                ? this.ask
                  ? `unclear wishes the AI would guess go to the clarify pile: ${this.q.clarify.length} waiting`
                  : `unclear wishes the AI guesses: ${unclearWaiting} in the pile`
                : fault
                  ? "the faulty update: the same wrong toy again and again"
                  : "a steady machine: few mistakes, unless something changes";
        const perMinute =
          level === 2
            ? 60 / AI_SECONDS
            : (elves(s) * 60) / ELF_SECONDS[s === 0 ? "read" : "make"][level];
        return {
          name,
          who,
          perMinute: Math.round(perMinute),
          costPerMinute: Math.round(AI_PRICE[level] * 60),
          mistakesFrom,
        };
      });
    const checking = [
      ["A few", "a few parcels picked at random"],
      [
        "The risky ones",
        "big gifts, unclear wishes and parcels the AI was unsure about",
      ],
      ["All", "every parcel"],
    ].map(([name, sends], level) => ({
      name,
      sends,
      per100: Math.round(this.checkShare(level) * 100),
    }));
    return { ai0: ai(0), ai1: ai(1), checking };
  }

  finish() {
    this.reportChecking();
    this.reportAsking();
    const right = this.aboard.filter((x) => !x.wrong).length;
    const wrongGifts = this.aboard.filter((x) => x.wrong);
    const mistakes = sum(wrongGifts.map((x) => this.price(x)));
    const total = sum(Object.values(this.spent)) + mistakes;
    const costs = {
      ...this.spent,
      mistakes,
      prevented: this.stats.prevented,
      total,
      budget: BUDGET,
    };
    for (const k in costs) costs[k] = Math.round(costs[k]);
    const wrongShare = wrongGifts.length / Math.max(1, this.aboard.length);
    const top = right >= this.target && wrongShare <= 0.1 && total <= BUDGET;
    const rating = top
      ? 3
      : right >= this.target * 0.8 && wrongShare <= 0.2
        ? 2
        : 1;
    this.end = {
      right,
      wrong: wrongGifts.length,
      lost: this.lost,
      rating,
      costs,
      lesson: this.lesson(rating, right, costs),
    };
  }

  // One lesson from what the player did, biggest cause first, in the terms of the end account.
  lesson(rating, right, costs) {
    const st = this.stats;
    const d = this.duration;
    const missed = rating < 3;
    const checkedShare = st.checked / Math.max(1, st.passed);
    const bigWrong = sum(
      this.aboard.filter((x) => x.wrong && x.w.big).map((x) => this.price(x)),
    );
    const dear = costs.checking > costs.prevented;
    const L = (title, text) => ({ title, text });
    if (missed && st.ai[0] / (2 * d) >= 0.6 && right < this.target)
      return L(
        "By hand is careful but slow",
        `Your elves delivered only ${right} right gifts from ${this.lastId + this.lost} letters. With the AI doing some of the work, the same elves could have delivered far more and checked it too.`,
      );
    if (missed && st.brokeAt !== null)
      return L(
        "The money ran out",
        `The money ran out after ${Math.round(st.brokeAt)} seconds: checking cost ${money(costs.checking)} and fixing ${money(costs.fixing)}. Spend on the checks that stop the dearest mistakes.`,
      );
    if (missed && st.checking[2] / d >= 0.3 && (dear || st.jammed >= 30))
      return L(
        "Too much checking",
        dear
          ? `Checking cost ${money(costs.checking)} but stopped mistakes worth only about ${money(costs.prevented)}, and the line waited on the checking pile for ${Math.round(st.jammed)} seconds. Check where a mistake is likely or dear, and let the rest through.`
          : `Checking every parcel kept the line waiting on the checking pile for ${Math.round(st.jammed)} seconds, so only ${right} right gifts made the sleigh. Check where a mistake is likely or dear, and let the rest through.`,
      );
    if (missed && checkedShare < 0.2 && costs.mistakes > costs.checking)
      return L(
        "Too little checking",
        `Wrong gifts cost ${money(costs.mistakes)}, far more than the ${money(costs.checking)} spent on checking; wrong big gifts alone cost ${money(bigWrong)}. The more the AI does, the more its work needs checking, most of all on the big gifts.`,
      );
    if (missed && this.bypassed >= 15)
      return L(
        "Let through unchecked",
        `You let ${this.bypassed} parcels skip the checking pile to keep the line moving, and wrong gifts cost ${money(costs.mistakes)}. One more elf at the checking pile would have kept them checked.`,
      );
    if (st.faulty >= 15)
      return L(
        "The faulty update ran too long",
        `The broken update kept making full-sized trains for ${Math.round(st.faulty)} seconds after they were spotted. When the AI suddenly goes wrong, roll back first, then quarantine and recall what it made.`,
      );
    if (missed && st.checkerBurnouts >= 2)
      return L(
        "Tired checkers miss mistakes",
        `${st.checkerBurnouts} checkers burnt out, and tired ones let mistakes slip. Send elves for cocoa before they are worn out.`,
      );
    // Fires even with a top rating when the checkers were never trained: those mistakes are in the bill.
    if (!this.vig.trained && st.waved >= 2)
      return L(
        "The checkers trusted the AI too much",
        `After long runs of clean AI parcels the checkers skipped ${this.vig.skipped} checks and waved ${st.waved} wrong gifts through, costing ${money(st.wavedCost)}. Training keeps them careful.`,
      );
    if (!missed && st.checking[1] / d >= 0.5)
      return L(
        "Checking in the right places",
        `Checking cost ${money(costs.checking)} and stopped mistakes worth about ${money(costs.prevented)}. It went where a mistake was likeliest and dearest, which let the AI run faster.`,
      );
    if (!missed && st.rolledBack)
      return L(
        "The faulty update, handled",
        `You spotted the broken update, rolled it back and cleared up what it made. Checking cost ${money(costs.checking)} and stopped mistakes worth about ${money(costs.prevented)}.`,
      );
    if (!missed)
      return L(
        "Santa leaves happy",
        `${right} right gifts on time and within budget. Checking cost ${money(costs.checking)} and stopped mistakes worth about ${money(costs.prevented)}.`,
      );
    if (costs.total > BUDGET)
      return L(
        "Over budget",
        `The workshop cost ${money(costs.total)} against a budget of ${money(BUDGET)}, wrong gifts included. Look at which line of the bill grew most.`,
      );
    if (this.lost >= 15)
      return L(
        "Piles grew where nobody was working",
        `${this.lost} letters were lost when the letter pile overflowed. Move elves and AI help to whichever station has the biggest pile.`,
      );
    return L(
      "Almost there",
      "The workshop ran well but fell short. Use a little more AI where piles grow, and keep checks on the risky parcels.",
    );
  }

  // Player actions. Each returns true when it took effect.

  move(elf, station) {
    const e = this.elves[elf];
    if (
      this.end ||
      !e ||
      e.rest > 0 ||
      ![0, 1, 2, BREAK].includes(station) ||
      e.station === station
    )
      return false;
    e.station = station;
    this.assignWork();
    this.did("move");
    return true;
  }

  setAi(station, level) {
    if (
      ![0, 1].includes(station) ||
      ![0, 1, 2].includes(level) ||
      this.why(`ai${station}`)
    )
      return false;
    this.ai[station] = level;
    this.did("setAi");
    return true;
  }

  setAsk(on) {
    if (this.why("ask")) return false;
    if (this.ask && !on) this.reportAsking();
    this.ask = Boolean(on);
    this.did("setAsk");
    return true;
  }

  setChecking(level) {
    if (![0, 1, 2].includes(level) || this.why("checking")) return false;
    if (level !== this.checking) this.reportChecking();
    this.checking = level;
    this.did("setChecking");
    return true;
  }

  bypass() {
    if (this.why("bypass")) return false;
    const waiting = this.q.check.splice(0);
    const rate = this.stats.caught / Math.max(1, this.stats.checked);
    this.bypassed += waiting.length;
    this.say(
      "bypassed",
      `${waiting.length} parcels went through without a check.`,
      { count: waiting.length },
    );
    this.consequence(
      "bypass",
      `Let ${waiting.length} parcels through unchecked. At the catch rate so far, about ${Math.round(waiting.length * rate)} of them could be wrong, about ${money(waiting.length * rate * AVERAGE_PRICE)} at risk.`,
      { checked: 0, waiting: 0 },
    );
    // Straight onto the sleigh: whatever was wrong in them, a faulty batch included, ships.
    for (const x of waiting) {
      x.exit = "bypassed";
      this.stats.passed++;
      this.load(x);
    }
    this.did("bypass");
    return true;
  }

  train() {
    if (this.why("train")) return false;
    this.training = TRAINING_SECONDS;
    this.pay("people", PRICE.train);
    this.did("train");
    return true;
  }

  rollback() {
    if (this.why("rollback")) return false;
    this.incident.rollingBack = ROLLBACK_SECONDS;
    this.stats.rolledBack = true;
    this.pay("fixing", PRICE.rollback);
    this.did("rollback");
    return true;
  }

  quarantine() {
    if (this.why("quarantine")) return false;
    const marked = this.marked();
    this.q.check = this.q.check.filter((x) => !marked.includes(x));
    this.q.pass = this.q.pass.filter((x) => !marked.includes(x));
    const job = {
      about: "quarantine",
      what: "Quarantine",
      count: marked.length,
      left: marked.length,
      caught: 0,
      avoided: 0,
      money: PRICE.quarantine,
      since: this.t,
    };
    // Quarantined parcels go first, so the hold lasts only as long as they take.
    marked.forEach((x) =>
      Object.assign(x, { held: true, remake: ELF_SECONDS.unwrap, job }),
    );
    this.q.rework.unshift(...marked);
    this.pay("fixing", PRICE.quarantine);
    this.say(
      "quarantined",
      `${marked.length} parcels from the update went back to be remade. Dispatch waits for them.`,
      { count: marked.length },
    );
    this.did("quarantine");
    return true;
  }

  recall() {
    if (this.why("recall")) return false;
    const wrong = this.aboard.filter((x) => x.wrong);
    this.aboard = this.aboard.filter((x) => !x.wrong);
    const job = {
      about: "recall",
      what: "Recall",
      count: wrong.length,
      left: wrong.length,
      caught: 0,
      avoided: 0,
      money: PRICE.recall,
      since: this.t,
    };
    wrong.forEach((x) => this.toRework(x, ELF_SECONDS.recall, job));
    this.pay("fixing", PRICE.recall);
    this.say(
      "recalled",
      `${wrong.length} wrong gifts came back off the sleigh to be remade.`,
      { count: wrong.length },
    );
    this.did("recall");
    return true;
  }

  // Why a control cannot be used now, or null when it can.
  why(name) {
    if (!this.unlocked.has(name)) return "Unlocks later in this run";
    if (this.end) return "The sleigh has left";
    if (PAID.includes(name) && this.left() <= 0) return "Out of money";
    const inc = this.incident;
    switch (name) {
      case "bypass":
        return this.q.check.length ? null : "Nothing waiting for a check";
      case "train":
        return this.vig.trained
          ? "Already trained"
          : this.training
            ? "Training now"
            : null;
      case "rollback":
        if (!inc) return "No update to roll back";
        return inc.rollingBack
          ? "Rolling back now"
          : inc.fault
            ? null
            : "Already rolled back";
      case "quarantine":
        if (!inc?.known) return "Nothing marked by an update";
        return this.marked().length
          ? null
          : "No parcels from the update waiting";
      case "recall":
        return this.aboard.some((x) => x.wrong)
          ? null
          : "No wrong gifts aboard";
      default:
        return null;
    }
  }

  costText(name) {
    const perMinute = (level) => money(AI_PRICE[level] * 60);
    const each = (seconds) =>
      `about ${Math.round(seconds)} seconds of a checker and ${money(PRICE.remake)} each`;
    const marked = this.marked().length;
    const wrong = this.aboard.filter((x) => x.wrong).length;
    const waiting = this.q.check.length;
    return {
      ai0: `${perMinute(1)} a minute on assist, ${perMinute(2)} on automate`,
      ai1: `${perMinute(1)} a minute on assist, ${perMinute(2)} on automate`,
      ask: `each unclear letter takes an elf about ${ELF_SECONDS.ask} seconds; nothing else`,
      checking: `each check takes a checker about ${Math.round(this.secondsPerCheck())} seconds and costs ${money(PRICE.check)}`,
      bypass: `lets ${waiting} waiting ${waiting === 1 ? "parcel" : "parcels"} through unchecked; free, but nobody looks at them`,
      train: `halves checking speed for ${TRAINING_SECONDS} seconds, costs ${money(PRICE.train)}`,
      rollback: `stops the toy line for ${ROLLBACK_SECONDS} seconds, costs ${money(PRICE.rollback)}`,
      quarantine: `remakes ${marked} ${marked === 1 ? "parcel" : "parcels"} from the update, ${each(ELF_SECONDS.unwrap)}, plus ${money(PRICE.quarantine)}; dispatch waits`,
      recall: `brings back ${wrong} wrong ${wrong === 1 ? "gift" : "gifts"}, ${each(ELF_SECONDS.recall)}, plus ${money(PRICE.recall)}`,
    }[name];
  }

  // A parcel as the page may see it: the answer stays hidden until a check or loading reveals it.
  parcel(x) {
    const shown = x.result !== null;
    return {
      id: x.id,
      wish: x.w.wish,
      big: x.w.big,
      unclear: x.w.unclear,
      wanted: shown ? { ...x.w.wanted } : null,
      made: shown ? { ...x.made } : null,
      suspect: this.suspect(x),
      result: x.result,
    };
  }

  queueView(id) {
    const s = QUEUES[id].station;
    const pool = this.poolFor(id);
    const key = s + pool;
    const head = this.q[id][0];
    const open = this.poolQueues(s, pool).filter(
      (q) => this.q[q].length && !this.queueBlocked(q),
    );
    const next = open.length ? this.nextQueue(key, open) : null;
    const seconds = this.seconds(id, head ?? { remake: ELF_SECONDS.remake });
    return {
      id,
      name: QUEUES[id].name,
      parcels: this.q[id].map((x) => this.parcel(x)),
      limit: QUEUES[id].limit,
      rate: Math.round((this.capacity(s, pool) * 60) / seconds),
      progress:
        head && next === id ? Math.min(1, (this.work[key] ?? 0) / seconds) : 0,
      blocked: head ? this.queueBlocked(id) : null,
    };
  }

  caseView(c) {
    return {
      id: c.id,
      kind: c.kind,
      text: c.text,
      evidence: c.parcels.map((x) => ({
        parcelId: x.id,
        wish: x.w.wish,
        made: x.made && { ...x.made },
      })),
      affected: {
        count: this.affected(c).length,
        ids: this.affected(c).map((x) => x.id),
      },
      options: this.options(c),
      resolving: c.resolving && { ...c.resolving },
    };
  }

  view() {
    const inc = this.incident;
    const v = this.vigilance();
    return {
      t: this.t,
      duration: this.duration,
      target: this.target,
      version: { id: this.versionId, name: this.v.name, text: this.v.text },
      moment: this.moment && {
        ...this.moment,
        completes: [...this.moment.completes],
      },
      elves: this.elves.map((e) => ({
        name: e.name,
        station: e.station,
        tired: Math.round(e.tired),
        resting: e.rest > 0,
        doing: e.doing,
      })),
      ai: [...this.ai],
      ask: this.ask,
      checking: this.checking,
      levers: this.levers(),
      stations: [0, 1, 2].map((s) => {
        const working = this.staff(s).filter(
          (e) => e.doing !== "nothing to do",
        ).length;
        return {
          staff: this.staff(s).length,
          working,
          idle: this.staff(s).length - working,
          queues: [...STATION_QUEUES[s]],
          blocked: this.stationBlocked(s),
        };
      }),
      queues: Object.fromEntries(
        Object.keys(QUEUES).map((id) => [id, this.queueView(id)]),
      ),
      bypassed: this.bypassed,
      vigilance: {
        state: v.state,
        cleanRun: this.vig.cleanRun,
        secondsPerCheck: Math.round(this.secondsPerCheck() * 10) / 10,
        skipped: this.vig.skipped,
        trained: this.vig.trained,
      },
      case: this.cases[0] ? this.caseView(this.cases[0]) : null,
      casesWaiting: Math.max(0, this.cases.length - 1),
      sleigh: {
        right: this.aboard.filter((x) => !x.wrong).length,
        wrong: this.aboard.filter((x) => x.wrong).length,
        parcels: this.aboard.map((x) => this.parcel(x)),
      },
      lost: this.lost,
      budget: {
        left: Math.round(this.left()),
        spent: Object.fromEntries(
          Object.entries(this.spent).map(([k, n]) => [k, Math.round(n)]),
        ),
      },
      pace: this.pace(),
      incident: inc && {
        known: inc.known,
        rollingBack: inc.rollingBack,
        suspectWaiting: this.marked().length,
      },
      actions: Object.fromEntries(
        CONTROLS.map((name) => {
          const why = this.why(name);
          return [
            name,
            {
              unlocked: this.unlocked.has(name),
              available: !why,
              why,
              cost: this.costText(name),
            },
          ];
        }),
      ),
      news: this.news.slice(),
      end: this.end && {
        ...this.end,
        costs: { ...this.end.costs },
        lesson: { ...this.end.lesson },
      },
    };
  }
}
