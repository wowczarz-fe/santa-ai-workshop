// The rules of one run. It never touches the page, so it also runs in Node for balance checks.

const ELF_NAMES = "Pip Holly Jingle Noel Ivy Fig Tinsel Coco".split(" ");
const CONTROLS = "ai0 ai1 ask checking bypass train".split(" ");
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
    text: "Every check and every question is a pile your elves have to staff. Only AI updates and their trouble come to you as cases.",
    cases: false,
    letters: 1,
  },
  cases: {
    name: "Piles and cases",
    text: "As Piles, and checkers also bring you single parcels, unclear wishes and repeated mistakes to decide.",
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

// Seconds one fresh elf needs per parcel (reading and making by AI level); the AI alone is faster,
// and good updates make the toy machine faster still.
const ELF_SECONDS = {
  read: [5.5, 2.6],
  make: [5.5, 2.6],
  ask: 12,
  check: 2.9,
  pass: 0.16,
  remake: 5.3,
  recall: 10.7,
};
const AI_SECONDS = { read: 0.6, make: 1.6 };
const INVESTIGATE_SECONDS = 5;
const ROLLBACK_SECONDS = 8;
const TRAINING_SECONDS = 10;

// What goes wrong. Elves get worse as they tire; the AI is steady on clear work and confidently
// wrong on unclear wishes; a faulty update makes the same wrong toy again and again.
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

// Updates on offer for the toy machine. A worrying sign (a big change, brief supplier testing) is
// likelier on a faulty update, so reading the signs beats chance without making it certain.
const UPDATES_AT = [50, 100, 150];
const SPEED_UP = 1.5;
const SIGN_IF_FAULTY = 0.7;
const SIGN_IF_GOOD = 0.3;
const TEST_SECONDS = 25;
const TEST_TOYS = 4;
const KEEP_AGAIN = 20; // seconds before a kept-running update is raised again
const ABOARD_AT = 5;

// Checkers relax after a run of clean AI-made parcels they checked: quicker checks, some skipped.
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

const BUDGET = 1000;
const WAGE = 0.15; // a working elf, per second
const COCOA_WAGE = 0.08;
const AI_PRICE = [0, 0.22, 0.72]; // per station, per second
const PRICE = {
  check: 2,
  train: 70,
  remake: 3,
  rollback: 65,
  made: 15,
  recall: 40,
  investigate: 10,
  test: 10,
};
const WRONG_PRICE = { everyday: 12, big: 60 };

const AT = { timmy: 45, rush: 110, calm: 150, close: 211 };
const INFLOW = 0.88;
const RUSH_INFLOW = 1.65;
const CASE_CAP = 6;
const CASE_GAP = 20;
const CASES_FROM = 60;
const CONSEQUENCE_GAP = 45;
const PATTERN_WINDOW = 30; // seconds within which the same wrong toy from the AI counts as a pattern
// Waiting cases take their turn in this order; the other kinds come last.
const CASE_ORDER = { source: 0, made: 1, aboard: 2, offered: 3, tested: 3 };

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
  "Rosa | A chess set, please. | ♟️ chess set | 🗄️ chest of drawers | big",
  "Lena | Drums like my dad plays. | 🥁 toy drum kit | 🪘 full concert drum kit | unclear big",
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

const a = (name) => (/^[aeio]/.test(name) ? "an " : "a ") + name;
const money = (n) => "£" + Math.round(n);
const share = (test) =>
  EVERYDAY_WISHES.filter(test).length / EVERYDAY_WISHES.length;
const sum = (list) => list.reduce((total, n) => total + n, 0);
const countDown = (n, dt) => (n - dt < 1e-9 ? 0 : n - dt);
const plural = (n, word) => `${n} ${word}${n === 1 ? "" : "s"}`;
// "1 parcel goes", "2 parcels go".
const does = (n, word, one, many) =>
  `${plural(n, word)} ${n === 1 ? one : many}`;
// "about 2 in 3" for a chance, rounded to a fraction a player reads at a glance.
const chance = (p) => {
  const n =
    [2, 3, 4, 5, 10, 20].find(
      (d) =>
        Math.abs(Math.round(p * d) / d - p) < 0.06 && Math.round(p * d) > 0,
    ) ?? 20;
  return `about ${Math.max(1, Math.round(p * n))} in ${n}`;
};
const AVERAGE_PRICE =
  share((w) => !w.big) * WRONG_PRICE.everyday +
  share((w) => w.big) * WRONG_PRICE.big;

// The first real example of each decision in a guided run. Each text starts from what just happened.
const MOMENTS = {
  elves: {
    control: "elves",
    unlocks: [],
    completes: ["move"],
    title: "Move your elves",
    text: () =>
      "Letters are arriving faster than three elves can read them. Move one elf from making toys to reading letters.",
  },
  ai0: {
    control: "ai0",
    unlocks: ["ai0"],
    completes: ["setAi"],
    title: "Let the AI help read",
    text: (w) =>
      `The letter pile has reached ${w.q.letters.length}. Put the AI on reading: on Assist it drafts each letter and an elf confirms it.`,
  },
  ai1: {
    control: "ai1",
    unlocks: ["ai1"],
    completes: ["setAi"],
    title: "Let the AI make toys",
    text: (w) =>
      `${does(w.q.orders.length, "toy order", "is", "are")} waiting. On Automate the AI makes toys alone, so the elves there can watch it or move.`,
  },
  ask: {
    control: "ask",
    unlocks: ["ask"],
    completes: ["setAsk"],
    title: "Ask when a wish is unclear",
    text: () =>
      "Timmy just wrote 'A little train, please.' Turn on asking so an elf asks him what he means instead of the AI guessing.",
  },
  checking: {
    control: "checking",
    unlocks: ["checking"],
    completes: ["setChecking"],
    title: "A wrong gift went aboard",
    text: (w, x) =>
      x?.result === "wrong"
        ? `${x.w.child}'s ${x.made.name} just went aboard instead of ${a(x.w.wanted.name)}, unchecked. Choose which parcels the elves check before they leave.`
        : "Nothing checks the parcels before they leave yet. Choose which parcels the elves check.",
  },
  bypass: {
    control: "bypass",
    unlocks: ["bypass"],
    completes: ["move", "bypass"],
    title: "The checking pile is full",
    text: (w) =>
      `The checking pile is full with ${w.q.check.length}, so the toy line has stopped. Move an elf to checking, or let the waiting parcels through unchecked.`,
  },
  cocoa: {
    control: "cocoa",
    unlocks: [],
    completes: ["move"],
    title: "A tired elf",
    text: (w) => {
      const e = w.elves
        .filter((e) => e.station < BREAK)
        .sort((x, y) => y.tired - x.tired)[0];
      return `${e.name} is at ${Math.round(e.tired)} tiredness and slowing down. Send ${e.name} for cocoa before burning out.`;
    },
  },
  case: {
    control: "case",
    unlocks: [],
    completes: ["resolve"],
    title: "A case for you",
    text: (w) =>
      ({
        judge:
          "A checker is unsure about one parcel and has brought it to you. Compare the toy with the wish, then ship it or remake it.",
        unclear:
          "The AI is unsure what a child means and shows you how it reads the wish. Accept its reading or have an elf ask.",
        pattern:
          "Checkers have seen the same wrong toy more than once. Decide whether it is worth looking into.",
        update:
          "A new update is on offer for the toy machine. Read what is known about it, then install, test or skip.",
        incident:
          "The update you installed is making full-sized trains. Decide what to do about it, one step at a time.",
      })[w.cases[0].kind],
  },
  train: {
    control: "train",
    unlocks: ["train"],
    completes: ["train"],
    title: "A checker waved one through",
    text: (w, x) =>
      `A relaxed checker waved ${x.w.child}'s ${x.made.name} through without opening it. Training keeps the checkers careful for good.`,
  },
};
const FIRST_MOMENTS = ["elves", "ai0", "ai1", "ask", "checking"];
const URGENT_MOMENTS = ["bypass"];
const MOMENT_GAP = 8;

const DOING = {
  letters: ["reading letters", "confirming the AI's readings"],
  clarify: ["asking a child"],
  orders: ["making toys", "confirming the AI's toys"],
  check: ["checking parcels"],
  pass: ["loading parcels"],
  rework: ["remaking parcels"],
};

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
    this.machineSpeed = 1;
    this.updates = this.planUpdates();
    this.lastInstallAt = null;
    this.incident = null;
    this.cases = [];
    this.caseCount = 0;
    this.lastCaseAt = -CASE_GAP;
    this.lastCaseId = 0;
    this.aboardSeen = 0;
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

  // Three updates, at least one good and one faulty, each with two signs that lean the right way.
  planUpdates() {
    const faulty =
      this.rng() < 0.5 ? [true, false, false] : [true, true, false];
    for (let i = faulty.length - 1; i > 0; i--) {
      const j = Math.floor(this.rng() * (i + 1));
      [faulty[i], faulty[j]] = [faulty[j], faulty[i]];
    }
    return UPDATES_AT.map((at, i) => {
      const sign = () =>
        this.rng() < (faulty[i] ? SIGN_IF_FAULTY : SIGN_IF_GOOD);
      return {
        at,
        faulty: faulty[i],
        bigChange: sign(),
        briefTesting: sign(),
        testRolls: Array.from({ length: TEST_TOYS }, () => this.rng()),
      };
    });
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

  // A moment whose example has gone closes, or never shows, and waits for the next real example.
  showMoment() {
    if (
      this.moment &&
      this.example(this.moment.id, this.moment.parcelId) === false
    ) {
      this.forget(this.moment.id);
      this.moment = null;
    }
    if (this.moment || !this.guided || this.t - this.lastMomentAt < MOMENT_GAP)
      return;
    while (this.momentQueue.length) {
      const next = FIRST_MOMENTS.find((id) => !this.shown.has(id));
      const i = next ? this.momentQueue.findIndex((q) => q.id === next) : 0;
      if (i < 0) return;
      const [q] = this.momentQueue.splice(i, 1);
      const parcelId = this.example(q.id, q.parcelId);
      if (parcelId === false) {
        this.forget(q.id);
        continue;
      }
      const m = MOMENTS[q.id];
      for (const control of m.unlocks) {
        this.unlocked.add(control);
        this.say("unlock", m.title, { control });
      }
      this.shown.add(q.id);
      this.lastMomentAt = this.t;
      const x = parcelId === null ? null : this.find(parcelId);
      this.moment = {
        id: q.id,
        control: m.control,
        title: m.title,
        text: m.text(this, x),
        parcelId,
        completes: [...m.completes],
      };
      return;
    }
  }

  forget(id) {
    this.happened.delete("moment:" + id);
    this.shown.delete(id);
  }

  // The parcel a moment points at now, null when it points at no parcel, or false when its example has gone.
  example(id, parcelId) {
    switch (id) {
      case "bypass":
        return this.full("check") ? this.q.check[0].id : false;
      case "cocoa":
        return this.elves.some((e) => e.station < BREAK && e.tired >= 60)
          ? null
          : false;
      case "case":
        return this.cases.length ? null : false;
      case "train":
        return !this.vig.trained && !this.training && this.find(parcelId)
          ? parcelId
          : false;
      default:
        return parcelId;
    }
  }

  find(id) {
    return [
      ...this.aboard,
      ...Object.values(this.q).flat(),
      ...this.cases.flatMap((c) => c.parcels),
    ].find((x) => x.id === id);
  }

  did(call) {
    if (this.moment?.completes.includes(call)) this.moment = null;
  }

  acknowledge(momentId) {
    if (this.moment?.id !== momentId) return false;
    this.moment = null;
    return true;
  }

  skipGuidance() {
    if (!this.guided) return false;
    this.guided = false;
    CONTROLS.forEach((c) => this.unlocked.add(c));
    this.moment = null;
    this.momentQueue = [];
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
      return this.ai[0] === 2 ? AI_SECONDS.read : ELF_SECONDS.read[this.ai[0]];
    if (id === "orders")
      return this.ai[1] === 2
        ? AI_SECONDS.make / this.machineSpeed
        : ELF_SECONDS.make[this.ai[1]];
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
          ? "waiting for the parcels being remade"
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
    return this.holding() ? "waiting for the parcels being remade" : null;
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

  // Parcels from a known faulty update still in the workshop.
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

  timeLeft() {
    return Math.round(this.duration - this.t);
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
    at(AT.rush, "rush", () =>
      this.say("rush", "Last-minute rush! Letters now arrive twice as fast."),
    );
    this.updates.forEach((u, i) => at(u.at, "update" + i, () => this.offer(u)));
    this.raiseIncident();
    // Guided runs fall back to these times when the real example has not come by then.
    if (this.q.letters.length >= 10 || this.t >= 18) this.reach("ai0");
    if (
      this.happened.has("moment:ai0") &&
      (this.q.orders.length >= 8 || this.t >= 26)
    )
      this.reach("ai1");
    if (this.t >= 60) this.reach("checking");
    if (this.happened.has("moment:checking") && this.full("check"))
      this.reach("bypass", this.q.check[0].id);
    if (this.elves.some((e) => e.station < BREAK && e.tired >= 60))
      this.reach("cocoa");
    this.showMoment();
  }

  // Unclear letters go to the clarify pile when asking is on; an unclear big gift the AI reads may become a case.
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
        this.canOpenOther()
      )
        this.openCase({ kind: "unclear", parcels: [this.q.letters.shift()] });
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

  // How the AI reads a letter, decided by the letter's own roll so a case can show it in advance.
  aiReading(x) {
    const guess = x.w.unclear && !x.asked;
    return x.w === TIMMY || x.roll.read < (guess ? RISK.aiGuess : RISK.aiRead)
      ? x.w.wrong
      : x.w.wanted;
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
      const draftWrong = this.aiReading(x) !== x.w.wanted;
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
      // What a parcel made now is likely to be, for the incident's facts.
      x.batchRisk = x.batch
        ? RISK.fault * (level === 1 ? 1 - this.confirmCatch(1) : 1)
        : 0;
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
    if (faulty) {
      this.incident.trains++;
      if (level === 2) {
        const missed = this.staff(1).reduce(
          (p, e) =>
            p * (1 - WATCH_CATCH * (1 - strain(e.tired) * TIRED_MISSES)),
          1,
        );
        if (x.roll.watch < 1 - missed) this.notice("watcher");
      }
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
    if (x.unsure && x.roll.judge < 0.3 && this.canOpenOther()) {
      x.exit = "case";
      return this.openCase({ kind: "judge", parcels: [x] });
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
    if (before === "careful" && this.vigilance().state !== "careful")
      this.sayEvery(
        20,
        "relaxed",
        "relaxed",
        `After ${this.vig.cleanRun} clean AI parcels in a row the checkers have started to skim and skip.`,
      );
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
    const spent = job.money + job.count * PRICE.remake;
    const text = `${job.what}: ${job.count} remade in ${Math.round(seconds)} seconds, ${job.caught} of them wrong, about ${money(job.avoided)} of mistakes avoided, ${money(spent)} spent.`;
    this.consequence("case", text, {
      seconds,
      checked: job.count,
      caught: job.caught,
      estimatedAvoided: job.avoided,
      money: spent,
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
    if (x.exit === "skipped" && !this.vig.trained) {
      const elf = this.staff(2)[0]?.name ?? "A checker";
      this.sayEvery(
        20,
        "waved",
        "relaxed",
        `${elf} waved ${x.w.child}'s ${x.made.name} through without opening it.`,
      );
      this.reach("train", x.id);
    }
    this.sighting(x, "sleigh");
  }

  reveal(x) {
    x.result ??= x.wrong ? "wrong" : "right";
  }

  // A wrong toy someone has now seen. Trains from a faulty update add up until someone says so, and
  // the same wrong toy from the AI seen twice is a pattern a checker can bring to the player.
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
    if (
      same.length >= 2 &&
      this.t - (this.patternAt[x.made.name] ?? -99) > 60 &&
      this.canOpenOther()
    ) {
      this.patternAt[x.made.name] = this.t;
      this.openCase({
        kind: "pattern",
        parcels: same.slice(-3).map((s) => s.parcel),
        name: x.made.name,
        since: Math.min(...same.map((s) => s.parcel.madeAt ?? this.t)),
      });
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

  // Cases. Update and incident cases always get their turn; the other kinds are rare, tied to
  // something a checker has really seen, and at most one of them waits.
  canOpenOther() {
    const waitingOther = this.cases
      .slice(1)
      .some((c) => !(c.kind in { update: 1, incident: 1 }));
    return (
      this.v.cases &&
      this.unlocked.has("checking") &&
      this.t >= CASES_FROM &&
      !waitingOther &&
      this.caseCount < CASE_CAP &&
      this.t - this.lastCaseAt >= CASE_GAP
    );
  }

  openCase(spec) {
    const c = {
      id: ++this.lastCaseId,
      step: null,
      name: null,
      parcels: [],
      resolving: null,
      station: 2,
      since: this.t,
      opened: this.t,
      ...spec,
    };
    if (!(c.kind in { update: 1, incident: 1 })) {
      this.caseCount++;
      this.lastCaseAt = this.t;
    }
    if (c.kind === "unclear") c.station = 0;
    this.cases.push(c);
    const order = (c) => CASE_ORDER[c.step] ?? 4;
    const [open, ...waiting] = this.cases;
    this.cases = [
      open,
      ...waiting.sort((x, y) => order(x) - order(y) || x.id - y.id),
    ];
    this.say("case", this.caseText(c), { caseId: c.id });
    this.reach("case");
    return c;
  }

  offer(u) {
    this.openCase({ kind: "update", step: "offered", update: u });
  }

  // Raises the incident's steps in turn once a faulty installed update is known.
  raiseIncident() {
    const inc = this.incident;
    if (!inc?.known || !inc.fault) return;
    const pending = (step) =>
      this.cases.some((c) => c.kind === "incident" && c.step === step);
    if (
      !inc.sourceRaised ||
      (inc.keptAt !== null &&
        !pending("made") &&
        !pending("aboard") &&
        this.t - inc.keptAt >= KEEP_AGAIN &&
        !pending("source"))
    ) {
      inc.sourceRaised = true;
      inc.keptAt = null;
      this.openCase({ kind: "incident", step: "source" });
    }
  }

  // Wrong gifts on the sleigh reach five more than last time: bring them back or leave them.
  raiseAboard() {
    const wrong = this.aboard.filter((x) => x.wrong).length;
    const pending = this.cases.some(
      (c) => c.kind === "incident" && c.step === "aboard",
    );
    if (
      !pending &&
      wrong >= ABOARD_AT &&
      wrong >= this.aboardSeen + ABOARD_AT &&
      !this.incident?.fault
    ) {
      this.aboardSeen = wrong;
      this.openCase({ kind: "incident", step: "aboard" });
    }
  }

  caseText(c) {
    const x = c.parcels[0];
    const n = this.affected(c).length;
    switch (c.kind) {
      case "judge":
        return `A checker is unsure about ${x.w.child}'s parcel. Is this the toy the child asked for?`;
      case "unclear":
        return `${x.w.child} wrote '${x.w.wish}' and the AI is not sure what that means.`;
      case "pattern":
        return `The checkers have seen ${a(c.name)} ${c.parcels.length} times in a short while.`;
      case "update":
        return c.step === "tested"
          ? "The test of the new toy machine update is done."
          : "A new update is on offer for the toy machine.";
      default:
        return {
          source: "The update you installed is making full-sized trains.",
          made: `${plural(n, "parcel")} made during the faulty update ${n === 1 ? "is" : "are"} still in the workshop.`,
          aboard: `${plural(n, "wrong gift")} ${n === 1 ? "is" : "are"} on the sleigh.`,
        }[c.step];
    }
  }

  // Parcels an option could cover.
  affected(c) {
    if (c.kind === "pattern")
      return [...this.q.check, ...this.q.pass].filter(
        (x) => x.byAi && x.madeAt >= c.since,
      );
    if (c.kind === "incident" && c.step === "made") return this.marked();
    if (c.kind === "incident" && c.step === "aboard")
      return this.aboard.filter((x) => x.wrong);
    return c.parcels;
  }

  failChance(u) {
    const signs = Number(u.bigChange) + Number(u.briefTesting);
    const lean = (p) => p ** signs * (1 - p) ** (2 - signs);
    const prior = 0.5; // half the planned updates are faulty
    return (
      (prior * lean(SIGN_IF_FAULTY)) /
      (prior * lean(SIGN_IF_FAULTY) + (1 - prior) * lean(SIGN_IF_GOOD))
    );
  }

  // How likely the update is faulty once the test is in, from the signs and what the trial toys showed.
  testedChance(c) {
    const p = this.failChance(c.update);
    const ifFaulty = c.found
      ? 1 - (1 - RISK.fault) ** TEST_TOYS
      : (1 - RISK.fault) ** TEST_TOYS;
    const ifGood = c.found
      ? 1 - (1 - RISK.aiMake) ** TEST_TOYS
      : (1 - RISK.aiMake) ** TEST_TOYS;
    return (p * ifFaulty) / (p * ifFaulty + (1 - p) * ifGood);
  }

  toyRate(speed = this.machineSpeed) {
    return Math.round(
      this.ai[1] === 2
        ? (60 / AI_SECONDS.make) * speed
        : (this.power(1) * 60) / ELF_SECONDS.make[this.ai[1]],
    );
  }

  // The figures each decision turns on, shown before the choice.
  facts(c) {
    const f = (label, value) => ({ label, value: String(value) });
    const x = c.parcels[0];
    const list = this.affected(c);
    const big = list.filter((x) => x.w.big).length;
    const worth = (x) =>
      x.w.big
        ? `${money(WRONG_PRICE.big)}, a big gift`
        : `${money(WRONG_PRICE.everyday)}, an everyday gift`;
    const time = f("Time left", `${this.timeLeft()} s`);
    switch (c.kind) {
      case "judge":
        return [
          f("Gift worth", worth(x)),
          f("Why unsure", "the AI flagged this toy as unsure"),
          f("Checking pile", `${this.q.check.length} waiting`),
          time,
        ];
      case "unclear":
        return [
          f("Gift worth", worth(x)),
          f("AI reads it as", this.aiReading(x).name),
          f(
            "Asking",
            `an elf for ${ELF_SECONDS.ask} s; ${this.q.clarify.length} letters waiting to be asked`,
          ),
          time,
        ];
      case "pattern": {
        const ago =
          this.lastInstallAt === null
            ? "no update installed"
            : `${Math.round(this.t - this.lastInstallAt)} s ago`;
        return [
          f("Seen", `${c.parcels.length} times in ${PATTERN_WINDOW} s`),
          f("Last update installed", ago),
          f("Made since", `${list.length} parcels, ${big} big`),
          time,
        ];
      }
      case "update": {
        const u = c.update;
        const facts = [
          f(
            "Promises",
            `toys about ${Math.round((SPEED_UP - 1) * 100)}% faster`,
          ),
          f(
            "How much it changes",
            u.bigChange
              ? "a large part of the machine"
              : "a small part of the machine",
          ),
          f("Supplier testing", u.briefTesting ? "brief" : "thorough"),
          f("Updates like this go wrong", chance(this.failChance(u))),
          f("Toys a minute now", this.toyRate()),
        ];
        if (c.step === "offered")
          facts.push(
            f(
              "A test now",
              `${TEST_SECONDS} s and ${money(PRICE.test)}; a good update fails it about 1 in 9`,
            ),
          );
        else
          facts.push(
            f("Test", `${c.found} of ${TEST_TOYS} trial toys came out wrong`),
            f(
              "After the test",
              `${chance(this.testedChance(c))} chance it is faulty`,
            ),
          );
        return [...facts, time];
      }
      default: {
        if (c.step === "source")
          return [
            f("Trains so far", this.incident.trains),
            f("Toys a minute now", this.toyRate()),
            f(
              "Rolling back",
              `line stops ${ROLLBACK_SECONDS} s, ${money(PRICE.rollback)}, back to ${this.toyRate(this.incident.speedBefore)} toys a minute`,
            ),
            time,
          ];
        const likely = list.length
          ? sum(
              list.map((x) => (c.step === "aboard" ? 1 : (x.batchRisk ?? 0))),
            ) / list.length
          : 0;
        const facts = [
          f(
            c.step === "made"
              ? "Parcels from the update"
              : "Wrong gifts aboard",
            list.length,
          ),
          f("Big gifts among them", big),
        ];
        if (c.step === "made")
          facts.push(
            f("Likely wrong", chance(likely)),
            f("Checking pile", `${this.q.check.length} waiting`),
          );
        else
          facts.push(
            f(
              "Their cost if they stay",
              money(sum(list.map((x) => this.price(x)))),
            ),
          );
        return [...facts, time];
      }
    }
  }

  options(c) {
    const checker = this.staff(2).length ? null : "no checker at dispatch";
    const broke = this.left() <= 0 ? "out of money" : null;
    const list = this.affected(c);
    const n = list.length;
    const atRisk = money(
      sum(
        list.map(
          (x) =>
            this.price(x) *
            (c.step === "aboard" ? 1 : (x.batchRisk ?? RISK.fault)),
        ),
      ),
    );
    const remake = Math.round(ELF_SECONDS.remake);
    const o = (id, label, seconds, money, scope, why = null) => ({
      id,
      label,
      seconds: Math.round(seconds),
      money: Math.round(money),
      scope,
      why,
    });
    const x = c.parcels[0];
    let options;
    switch (c.kind) {
      case "judge":
        options = [
          o(
            "ship",
            "Ship it",
            0,
            0,
            `this parcel; if it is wrong, ${money(this.price(x))} lost`,
          ),
          o(
            "remake",
            "Remake it",
            remake,
            PRICE.remake,
            `this parcel; a checker for ${remake} s while ${this.q.check.length} wait`,
            checker,
          ),
        ];
        break;
      case "unclear":
        options = [
          o(
            "ask",
            "Ask the child",
            ELF_SECONDS.ask,
            0,
            `this letter; an elf at reading for ${ELF_SECONDS.ask} s`,
            this.staff(0).length ? null : "nobody at reading to ask",
          ),
          o(
            "accept",
            "Accept the AI's reading",
            0,
            0,
            `this letter; if the reading is wrong, ${money(this.price(x))} at risk`,
          ),
        ];
        break;
      case "pattern":
        options = [
          o(
            "investigate",
            "Investigate",
            INVESTIGATE_SECONDS,
            PRICE.investigate,
            "the toy machine; a checker looks into it",
            checker ?? broke,
          ),
          o(
            "hold",
            "Hold the parcels made since",
            n * ELF_SECONDS.remake,
            n * PRICE.remake,
            `${plural(n, "parcel")} remade, about ${Math.round(n * ELF_SECONDS.remake)} s of checkers`,
            n ? null : "none waiting",
          ),
          o(
            "carryOn",
            "Carry on",
            0,
            0,
            `nothing; ${n === 1 ? "the parcel" : `the ${n} parcels`} made since ${n === 1 ? "goes" : "go"} on as they are`,
          ),
        ];
        break;
      case "update":
        options = [
          o(
            "install",
            "Install it",
            0,
            0,
            `the toy machine from now on; ${chance(c.step === "offered" ? this.failChance(c.update) : this.testedChance(c))} chance it makes wrong toys`,
          ),
          ...(c.step === "offered"
            ? [
                o(
                  "test",
                  "Test it first",
                  TEST_SECONDS,
                  PRICE.test,
                  `the old version keeps working for ${TEST_SECONDS} s`,
                  broke,
                ),
              ]
            : []),
          o(
            "skip",
            "Skip it",
            0,
            0,
            `the toy machine stays at ${this.toyRate()} toys a minute`,
          ),
        ];
        break;
      default:
        options = {
          source: [
            o(
              "rollback",
              "Roll it back",
              ROLLBACK_SECONDS,
              PRICE.rollback,
              `the toy line stops ${ROLLBACK_SECONDS} s and loses the speed-up`,
              broke,
            ),
            o(
              "keep",
              "Keep it running",
              0,
              0,
              `keeps making trains, about ${Math.round(this.toyRate() * RISK.fault)} a minute; asked again in ${KEEP_AGAIN} s`,
            ),
          ],
          made: [
            o(
              "remakeAll",
              "Remake them all",
              n * ELF_SECONDS.remake,
              PRICE.made + n * PRICE.remake,
              `${plural(n, "parcel")}; dispatch waits until they are done`,
              broke,
            ),
            o(
              "checkEach",
              "Check each one",
              n * ELF_SECONDS.check,
              n * PRICE.check,
              `${does(n, "parcel", "goes", "go")} to the checking pile; wrong ones get remade`,
            ),
            o(
              "letGo",
              "Let them go",
              0,
              0,
              `${does(n, "parcel", "goes", "go")} on as they are; about ${atRisk} of wrong gifts`,
            ),
          ],
          aboard: [
            o(
              "bringBack",
              "Bring them back",
              n * ELF_SECONDS.recall,
              PRICE.recall + n * PRICE.remake,
              `${plural(n, "wrong gift")}, about ${Math.round(n * ELF_SECONDS.recall)} s of checkers`,
              broke ?? checker,
            ),
            o(
              "leave",
              "Leave them",
              0,
              0,
              `${does(n, "wrong gift", "stays", "stay")} aboard, ${atRisk} at departure`,
            ),
          ],
        }[c.step];
    }
    return options.map((o) => ({
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
    if (["remake", "ask", "investigate", "test"].includes(optionId)) {
      c.resolving = {
        optionId,
        remaining: option.seconds,
        duration: option.seconds,
      };
      if (optionId === "investigate") this.pay("checking", PRICE.investigate);
      if (optionId === "test") this.pay("checking", PRICE.test);
      if (optionId === "test") c.station = null;
      return true;
    }
    this.closeCase(c, optionId);
    return true;
  }

  // Applies an answer and says what it did with the time, money and parcels involved.
  closeCase(c, optionId) {
    const x = c.parcels[0];
    const extra = { caseId: c.id, option: optionId };
    let text;
    let outcome = {};
    if (optionId === "test") return this.finishTest(c);
    this.cases.shift();
    if (c.kind === "judge") {
      extra.check = this.copy(x, ELF_SECONDS.check, "player");
      this.reveal(x);
      if (optionId === "ship") {
        text = x.wrong
          ? `Shipped, and it was wrong: a ${money(this.price(x))} gift went aboard as ${a(x.made.name)}.`
          : "Shipped, and it was right: no checker time or money spent.";
        outcome = { parcels: 1 };
        this.load(x);
      } else {
        if (x.wrong) this.caught(x);
        text = x.wrong
          ? `Remade: a checker spent ${Math.round(ELF_SECONDS.remake)} s and ${money(PRICE.remake)} to save a ${money(this.price(x))} gift.`
          : `Remade, though it was right: a checker spent ${Math.round(ELF_SECONDS.remake)} s and ${money(PRICE.remake)} for nothing.`;
        outcome = {
          seconds: ELF_SECONDS.remake,
          money: PRICE.remake,
          parcels: 1,
        };
        Object.assign(x, { wrong: false, made: x.w.wanted, result: "right" });
        this.pay("fixing", PRICE.remake);
        this.aboard.push(x);
      }
    } else if (c.kind === "unclear") {
      if (optionId === "ask") {
        Object.assign(x, { asked: true, wrong: x.roll.read < RISK.asked });
        this.q.orders.push(x);
        text = `An elf spent ${ELF_SECONDS.ask} s asking ${x.w.child}: the letter went on as ${a(x.w.wanted.name)}.`;
        outcome = { seconds: ELF_SECONDS.ask, parcels: 1 };
      } else {
        x.accepted = true;
        this.q.letters.unshift(x);
        text = `Accepted: the AI makes ${a(this.aiReading(x).name)} for ${x.w.child}, and no elf time was spent.`;
        outcome = { parcels: 1 };
      }
    } else if (c.kind === "pattern") {
      const held = this.affected(c);
      if (optionId === "investigate") {
        this.vig.cleanRun = 0;
        const real = c.name === LOCOMOTIVE.name && this.incident?.fault;
        if (real) this.notice("case");
        text = real
          ? `A checker spent ${INVESTIGATE_SECONDS} s and ${money(PRICE.investigate)}: the last update is making these trains.`
          : `A checker spent ${INVESTIGATE_SECONDS} s and ${money(PRICE.investigate)}: no shared fault, the repeats were bad luck.`;
        outcome = { seconds: INVESTIGATE_SECONDS, money: PRICE.investigate };
      } else if (optionId === "hold") {
        this.take(held);
        const job = {
          what: "Held parcels",
          count: held.length,
          left: held.length,
          caught: 0,
          avoided: 0,
          money: 0,
          since: this.t,
        };
        held.forEach((x) => this.toRework(x, ELF_SECONDS.remake, job));
        text = `${plural(held.length, "parcel")} made since the first ${c.name} go to be remade: about ${Math.round(held.length * ELF_SECONDS.remake)} s of checkers and ${money(held.length * PRICE.remake)}.`;
        outcome = {
          seconds: held.length * ELF_SECONDS.remake,
          money: held.length * PRICE.remake,
          parcels: held.length,
        };
      } else {
        text = `Carried on: ${plural(held.length, "parcel")} made since ${held.length === 1 ? "goes" : "go"} on as before, with no time spent.`;
        outcome = { parcels: held.length };
      }
    } else if (c.kind === "update") {
      const before = this.toyRate();
      if (optionId === "install") {
        this.install(c.update);
        const gained = this.toyRate() - before;
        const late =
          c.step === "tested"
            ? ` ${TEST_SECONDS} s later than installing at once`
            : "";
        text = `Installed${late}: the toy machine can now make ${this.toyRate()} toys a minute instead of ${before}.`;
        outcome = {
          gained,
          ...(c.step === "tested"
            ? { seconds: TEST_SECONDS, money: PRICE.test }
            : {}),
        };
      } else {
        text = `Skipped: the toy machine stays at ${before} toys a minute.`;
        outcome = {
          gained: 0,
          ...(c.step === "tested"
            ? { seconds: TEST_SECONDS, money: PRICE.test }
            : {}),
        };
      }
    } else
      this.closeIncident(c, optionId, (t, o) => ((text = t), (outcome = o)));
    const kept = Object.fromEntries(
      Object.entries(outcome).map(([k, n]) => [k, Math.round(n)]),
    );
    this.say("resolved", text, { ...extra, outcome: kept });
    this.consequence("case", text, {
      seconds: outcome.seconds,
      money: outcome.money,
      waiting:
        optionId === "letGo" || optionId === "leave"
          ? outcome.parcels
          : undefined,
    });
  }

  // A test runs trial toys on the new version; the case comes back with what it found.
  finishTest(c) {
    c.found = c.update.testRolls.filter(
      (r) => r < (c.update.faulty ? RISK.fault : RISK.aiMake),
    ).length;
    c.step = "tested";
    c.resolving = null;
    c.station = 2;
    this.say(
      "resolved",
      `Tested for ${TEST_SECONDS} s and ${money(PRICE.test)} while the old version kept working: ${c.found} of ${TEST_TOYS} trial toys came out wrong.`,
      {
        caseId: c.id,
        option: "test",
        outcome: { seconds: TEST_SECONDS, money: PRICE.test },
      },
    );
  }

  install(u) {
    this.lastInstallAt = this.t;
    const speedBefore = this.machineSpeed;
    this.machineSpeed *= SPEED_UP;
    if (u.faulty)
      this.incident = {
        fault: true,
        known: false,
        rollingBack: 0,
        seen: 0,
        trains: 0,
        speedBefore,
        sourceRaised: false,
        keptAt: null,
      };
    this.say("update", "The new update is running on the toy machine.");
  }

  closeIncident(c, optionId, tell) {
    const inc = this.incident;
    const list = this.affected(c);
    const n = list.length;
    switch (optionId) {
      case "rollback":
        inc.rollingBack = ROLLBACK_SECONDS;
        this.stats.rolledBack = true;
        this.pay("fixing", PRICE.rollback);
        tell(
          `Rolling back: the toy line stops ${ROLLBACK_SECONDS} s, costs ${money(PRICE.rollback)}, and goes back to ${this.toyRate(inc.speedBefore)} toys a minute.`,
          { seconds: ROLLBACK_SECONDS, money: PRICE.rollback },
        );
        break;
      case "keep":
        inc.keptAt = this.t;
        tell(
          `Kept running at ${this.toyRate()} toys a minute, with about ${Math.round(this.toyRate() * RISK.fault)} trains a minute; you will be asked again.`,
          {},
        );
        break;
      case "remakeAll": {
        this.take(list);
        const job = {
          what: "Remade the update's parcels",
          count: n,
          left: n,
          caught: 0,
          avoided: 0,
          money: PRICE.made,
          since: this.t,
        };
        list.forEach((x) =>
          Object.assign(x, { held: true, remake: ELF_SECONDS.remake, job }),
        );
        this.q.rework.unshift(...list);
        this.pay("fixing", PRICE.made);
        this.say(
          "quarantined",
          `${plural(n, "parcel")} from the update went to be remade. Dispatch waits for them.`,
          { count: n },
        );
        tell(
          `${does(n, "parcel", "goes", "go")} to be remade first: about ${Math.round(n * ELF_SECONDS.remake)} s of checkers and ${money(PRICE.made + n * PRICE.remake)}.`,
          {
            seconds: n * ELF_SECONDS.remake,
            money: PRICE.made + n * PRICE.remake,
            parcels: n,
          },
        );
        break;
      }
      case "checkEach":
        this.take(list);
        list.forEach((x) => (x.route = "check"));
        this.q.check.unshift(...list);
        tell(
          `${plural(n, "parcel")} went to the checking pile: about ${Math.round(n * ELF_SECONDS.check)} s of checks, and the wrong ones get remade.`,
          {
            seconds: n * ELF_SECONDS.check,
            money: n * PRICE.check,
            parcels: n,
          },
        );
        break;
      case "letGo":
        tell(
          `${plural(n, "parcel")} from the update go on unchanged; no time spent.`,
          { parcels: n },
        );
        break;
      case "bringBack": {
        this.aboard = this.aboard.filter((x) => !list.includes(x));
        const job = {
          what: "Brought back",
          count: n,
          left: n,
          caught: 0,
          avoided: 0,
          money: PRICE.recall,
          since: this.t,
        };
        list.forEach((x) => this.toRework(x, ELF_SECONDS.recall, job));
        this.pay("fixing", PRICE.recall);
        this.say(
          "recalled",
          `${plural(n, "wrong gift")} came back off the sleigh to be remade.`,
          { count: n },
        );
        tell(
          `${does(n, "wrong gift", "comes", "come")} back to be remade: about ${Math.round(n * ELF_SECONDS.recall)} s of checkers and ${money(PRICE.recall + n * PRICE.remake)}.`,
          {
            seconds: n * ELF_SECONDS.recall,
            money: PRICE.recall + n * PRICE.remake,
            parcels: n,
          },
        );
        break;
      }
      default:
        tell(
          `${does(n, "wrong gift", "stays", "stay")} aboard, costing ${money(sum(list.map((x) => this.price(x))))} at departure.`,
          { money: sum(list.map((x) => this.price(x))), parcels: n },
        );
    }
    // After the source, what the update made comes next, then what is already aboard.
    if (c.step === "source") {
      if (this.marked().length)
        this.openCase({ kind: "incident", step: "made" });
      if (this.aboard.some((x) => x.wrong))
        this.openCase({ kind: "incident", step: "aboard" });
    }
    if (c.step === "aboard")
      this.aboardSeen = this.aboard.filter((x) => x.wrong).length;
  }

  take(list) {
    for (const id of ["orders", "check", "pass"])
      this.q[id] = this.q[id].filter((x) => !list.includes(x));
  }

  timers(dt) {
    const c = this.cases[0];
    const working =
      c?.resolving && (c.station === null || this.staff(c.station).length);
    if (
      working &&
      (c.resolving.remaining = countDown(c.resolving.remaining, dt)) === 0
    )
      this.closeCase(c, c.resolving.optionId);
    const inc = this.incident;
    if (
      inc?.rollingBack > 0 &&
      (inc.rollingBack = countDown(inc.rollingBack, dt)) === 0
    ) {
      inc.fault = false;
      this.machineSpeed = inc.speedBefore;
      this.say(
        "rolledBack",
        "Rollback done. The toy machine makes proper toys again.",
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
        if (c?.resolving && c.station === s && i === 0)
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
    this.raiseAboard();
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
            1 / AI_SECONDS.read / (1 - asking),
            asking ? elves(0) / ELF_SECONDS.ask / asking : Infinity,
          )
        : elves(0) /
          ((1 - asking) * ELF_SECONDS.read[this.ai[0]] +
            asking * ELF_SECONDS.ask);
    const making =
      this.ai[1] === 2
        ? this.machineSpeed / AI_SECONDS.make
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

  // What each lever position does now, in words read at a glance.
  levers() {
    const tired = (s) =>
      Math.round(
        sum(this.staff(s).map((e) => e.tired)) /
          Math.max(1, this.staff(s).length),
      );
    const elves = (s) =>
      sum(this.staff(s).map((e) => 1 - strain(e.tired) * TIRED_SLOWS));
    const unclearWaiting = this.q.letters.filter((x) => x.w.unclear).length;
    const fault = this.incident?.known && this.incident.fault;
    const ai = (s) => {
      const kind = s === 0 ? "read" : "make";
      const perMinute = [0, 1, 2].map((level) =>
        level === 2
          ? (60 / AI_SECONDS[kind]) * (s === 1 ? this.machineSpeed : 1)
          : (elves(s) * 60) / ELF_SECONDS[kind][level],
      );
      return LEVELS.map((name, level) => {
        const who = [
          [
            "elves read every letter",
            "AI drafts, an elf confirms",
            "AI reads alone; elves ask children",
          ],
          [
            "elves make every toy",
            "AI drafts, an elf confirms",
            "AI makes toys; elves watch it",
          ],
        ][s][level];
        const ratio = perMinute[level] / perMinute[0];
        const speed =
          level === 0
            ? "the slow, steady way"
            : !perMinute[0]
              ? level === 2
                ? "works without any elves"
                : "needs elves to confirm"
              : `about ${Math.round(ratio * 10) / 10} times as fast`;
        const here = this.staff(s).length ? tired(s) : null;
        const risk =
          level === 0
            ? here === null
              ? "no elves here to work"
              : `tired elves slip: yours at ${here}`
            : level === 1
              ? here === null
                ? "no elves here to confirm"
                : `confirmers at ${here} miss slips`
              : s === 0
                ? this.ask
                  ? `unclear wishes wait for askers: ${this.q.clarify.length}`
                  : `guesses unclear wishes: ${unclearWaiting} waiting`
                : fault
                  ? "faulty update: same wrong toy"
                  : "steady, unless an update fails";
        return {
          name,
          who,
          speed,
          risk,
          perMinute: Math.round(perMinute[level]),
          costPerMinute: Math.round(AI_PRICE[level] * 60),
        };
      });
    };
    const checking = [
      ["A few", "elves check a few at random"],
      ["The risky ones", "elves check big, unclear, unsure"],
      ["All", "elves check every single parcel"],
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
        `The broken update kept making full-sized trains for ${Math.round(st.faulty)} seconds after they were spotted. When the AI suddenly goes wrong, stop it first, then deal with what it made.`,
      );
    if (
      missed &&
      right < this.target &&
      this.machineSpeed <= 1 &&
      this.updates.some((u) => !u.faulty)
    )
      return L(
        "The toy machine stayed slow",
        `Only ${right} right gifts made the sleigh, and the toy machine never got faster. Updates whose signs looked good were worth installing, or at least testing.`,
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

  // AI-made parcels still to come at the current pace, which is what training pays back on.
  aiParcelsToCome() {
    if (!this.ai.some((l) => l > 0)) return 0;
    const rates = this.rates();
    return Math.round(Math.min(...rates) * Math.max(0, AT.close - this.t));
  }

  // Why a control cannot be used now, or null when it can.
  why(name) {
    if (!this.unlocked.has(name)) return "Unlocks later in this run";
    if (this.end) return "The sleigh has left";
    if (name === "train" && this.left() <= 0) return "Out of money";
    if (name === "bypass")
      return this.q.check.length ? null : "Nothing waiting for a check";
    if (name === "train")
      return this.vig.trained
        ? "Already trained"
        : this.training
          ? "Training now"
          : null;
    return null;
  }

  costText(name) {
    const perMinute = (level) => money(AI_PRICE[level] * 60);
    const waiting = this.q.check.length;
    return {
      ai0: `${perMinute(1)} a minute on assist, ${perMinute(2)} on automate`,
      ai1: `${perMinute(1)} a minute on assist, ${perMinute(2)} on automate`,
      ask: `each unclear letter takes an elf about ${ELF_SECONDS.ask} seconds; nothing else`,
      checking: `each check takes a checker about ${Math.round(this.secondsPerCheck())} seconds and costs ${money(PRICE.check)}`,
      bypass: `lets ${plural(waiting, "waiting parcel")} through unchecked; free, but nobody looks at them`,
      train: `${money(PRICE.train)} and ${TRAINING_SECONDS} s of half-speed checks; about ${this.aiParcelsToCome()} AI parcels still to come`,
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
    const reading = (x) =>
      c.kind === "unclear" ? { ...this.aiReading(x) } : null;
    const affected = this.affected(c);
    return {
      id: c.id,
      kind: c.kind,
      step: c.step,
      text: this.caseText(c),
      facts: this.facts(c),
      evidence: c.parcels.map((x) => ({
        parcelId: x.id,
        wish: x.w.wish,
        made: x.made && { ...x.made },
        reading: reading(x),
      })),
      affected: { count: affected.length, ids: affected.map((x) => x.id) },
      options: this.options(c),
      resolving: c.resolving && { ...c.resolving },
    };
  }

  view() {
    const inc = this.incident;
    const v = this.vigilance();
    const moment =
      this.moment &&
      this.example(this.moment.id, this.moment.parcelId) !== false
        ? this.moment
        : null;
    return {
      t: this.t,
      duration: this.duration,
      target: this.target,
      version: { id: this.versionId, name: this.v.name, text: this.v.text },
      moment: moment && { ...moment, completes: [...moment.completes] },
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
