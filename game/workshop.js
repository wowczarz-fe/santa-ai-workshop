// The rules of one run. It never touches the page, so it also runs in Node for balance checks.

const ELF_NAMES = "Pip Holly Jingle Noel Ivy Fig Tinsel Coco".split(" ");
const CONTROLS = "ai0 ai1 ask checking bypass".split(" ");
const BREAK = 3;
const STATION_NAMES = [
  "Reading letters",
  "Making toys",
  "Checking and dispatch",
];
const LEVELS = ["By hand", "Assist", "Automate"];

// One game, kept under a version name so a build can still be picked by address. `kinds` are the cases
// besides updates and incidents, at most `cap` of them a run.
const VERSIONS = {
  standard: {
    name: "Santa's workshop",
    text: "Keep the letters moving, let the AI help where it pays, and check where its mistakes would cost most.",
    kinds: ["judge"],
    cap: 3,
    letters: 1,
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
  readUnclear: 9, // an elf reading an unclear wish by hand works out what the child means
  make: [5.5, 2.6],
  ask: 5,
  check: 4.5,
  pass: 0.16,
  remake: 10, // remaking a caught mistake: catching it late costs more than preventing it
  recall: 20, // fetching a gift back off a loaded sleigh, then remaking it
};
const AI_SECONDS = { read: 0.6, make: 0.75 };
const INVESTIGATE_SECONDS = 5;
const ROLLBACK_SECONDS = 8;

// What goes wrong. Elves get worse as they tire. The AI is steady on everyday work, slips on big
// gifts it has seen less of, and is confidently wrong on unclear wishes; a faulty update makes the
// same wrong toy again and again.
const RISK = {
  elfRead: 0.005,
  aiRead: 0.02,
  aiReadBig: 0.15,
  aiGuess: 0.8,
  asked: 0.01,
  elfMake: 0.005,
  aiMake: 0.05,
  aiMakeBig: 0.3,
  fault: 0.65,
  perStrain: 0.008, // per point of tiredness above SLIPS_FROM
};
const CONFIRM_CATCH = 0.85; // an elf confirming an AI draft spots a wrong one
const WATCH_CATCH = 0.4; // a watching elf spots one faulty toy
const CHECK_CATCH = 0.9;
const UNSURE_IF_WRONG = 0.7;
const CATCH_SHARPENS = 5; // clean parcels a caught mistake takes off the checkers' run
const UNSURE_IF_RIGHT = 0.06;
const SAMPLE = 0.08; // share of parcels "a few" sends to the checking pile
const NOTICE_AFTER = 4; // faulty trains seen by checkers or on the sleigh before anyone says so

// Updates on offer for the toy machine. A worrying sign (a big change, brief supplier testing) is
// likelier on a faulty update, so reading the signs beats chance without making it certain.
// An update is offered at each break; its promise varies and so do its signs of risk.
const PROMISES = [0.3, 0.4, 0.5, 0.6];
const SIGN_IF_FAULTY = 0.7;
const SIGN_IF_GOOD = 0.3;
const TEST_TOYS = 4;
const KEEP_AGAIN = 20; // seconds before a kept-running update is raised again
const ABOARD_AT = 5;

// Four sleigh runs of a minute. Each target sits just above what a careful player managed in tests,
// and well above what elves working by hand deliver, so every run needs the player.
const RUNS = 4;
const RUN_SECONDS = 60;
const POINTS = { right: 10, star: 20, clean: 50, budgetLeft: 0.2 };
// Each sleigh run has three goals, one star each. full: the right gifts aboard reach the target.
// right: wrong gifts aboard stay within one for every WRONG_PER gifts of target, and never below
// WRONG_MIN. cost: the money spent during the run, the break before it
// included, stays within ALLOWANCE.base plus ALLOWANCE.perGift for each gift of target. The right
// and cost goals count only once the sleigh holds GOALS_FROM of its target, so a near-empty sleigh
// earns nothing.
const WRONG_PER = 12;
const WRONG_MIN = 1;
const ALLOWANCE = { base: 300, perGift: 4 };
const GOALS_FROM = 2 / 3;
// Where a wrong gift that reached the sleigh came from, and the control that would have stopped it.
const WRONG_CAUSES = {
  guessed: {
    name: "The AI guessed unclear wishes",
    control: "ask",
    fix: "Turn on Ask the child, or put reading on Assist.",
  },
  big: {
    name: "AI slips on big gifts that went out unchecked",
    control: "checking",
    fix: "Check the risky ones, so every big gift gets a check.",
  },
  misread: {
    name: "AI misreadings of everyday letters",
    control: "ai0",
    fix: "Put reading on Assist so an elf confirms, or check a few more.",
  },
  misMade: {
    name: "AI slips making everyday toys",
    control: "ai1",
    fix: "Put toys on Assist so an elf confirms, or check a few more.",
  },
  waved: {
    name: "Checkers let mistakes through",
    control: "train",
    fix: "Train the checkers at a break, and send tired ones for cocoa.",
  },
  faulty: {
    name: "The faulty update",
    control: "update",
    fix: "Roll a faulty update back as soon as it shows, or test updates first.",
  },
  tired: {
    name: "Tired elves' slips",
    control: "cocoa",
    fix: "Send elves for cocoa before they get tired.",
  },
};
const BREAK_PRICE = { update: 20, tested: 20, train: 70, rest: 40 };
const TEST_DELAY = 20; // seconds into the next run a tested update goes in, when the test is clean

// Checkers relax after a run of clean AI-made parcels they checked: quicker checks, some skipped.
const VIGILANCE = [
  { state: "careful", from: 0, speed: 1, skip: 0, trust: 0 },
  { state: "relaxing", from: 8, speed: 0.75, skip: 0.5, trust: 0.3 },
  { state: "waving through", from: 20, speed: 0.5, skip: 0.9, trust: 0.6 },
];

// A cocoa break in time is short; a burnt-out elf is gone for a minute and comes back still tired.
const BURNOUT_AT = 88;
const BURNOUT_SECONDS = 15;
const BURNOUT_RECOVERY = 2.5; // back at about 50, so a burnt-out elf soon tires again
const COCOA_RECOVERY = 13; // from 60 to fresh in about 4 seconds
// Tiredness 0 to 100. Above FRESH it slows an elf and makes it miss more.
const FRESH = 30;
const TIRED_SLOWS = 0.014;
const TIRED_MISSES = 0.01;
const strain = (tired) => Math.max(0, tired - FRESH);
// Elves working by hand make almost no mistakes until properly tired, and then only ordinary slips.
const SLIPS_FROM = 50;
const slipping = (tired) => Math.max(0, tired - SLIPS_FROM);
const CHECKER_STRAIN = 0.6; // checking tires more than reading or making
const COCOA_MOMENT_AT = 55; // tiredness at which a guided run suggests cocoa for a working elf

const BUDGET = 1800;
const WAGE = 0.15; // a working elf, per second
const COCOA_WAGE = 0.08;
const AI_PRICE = [0, 0.22, 0.72]; // per station, per second
const PRICE = {
  check: 2,
  remake: 3,
  rollback: 65,
  made: 15,
  recall: 20,
  recallEach: 22, // per gift brought back, on top of its remake
  investigate: 10,
  ask: 3, // a letter back to the child
};
const WRONG_PRICE = { everyday: 12, big: 100 };
// For the end summary: what a gift that misses its sleigh while it waits to be checked is worth. The
// child gets it late or not at all, so it counts as half a wrong everyday gift.
const LATE_PRICE = WRONG_PRICE.everyday / 2;
// The kinds of parcel the end summary splits checking by. A gift that is both big and unclear counts
// as big, because its mistake costs the big price.
const GROUPS = [
  { id: "everyday", name: "Everyday gifts", icon: "🎁", one: "everyday gift" },
  { id: "big", name: "Big gifts", icon: "📦", one: "big gift" },
  { id: "unclear", name: "Unclear wishes", icon: "❓", one: "unclear wish" },
];
const groupOf = (w) => (w.big ? "big" : w.unclear ? "unclear" : "everyday");
// The end summary dial: below little it reads too little checking, above much too much. settle is the
// share of all money spent that the two losses must reach before the dial moves far from the middle.
const ASSURANCE = { little: 0.2, much: 0.8, settle: 0.1 };

const AT = { close: 211 };
// When the letters speed up, when Timmy writes, and the latest each card may wait for its real
// example. A guided run moves faster so every basic control is met inside the first sleigh run.
const OPENING = {
  trickle: 0.5,
  speedUp: 30,
  timmy: 45,
  ai0: 50,
  ai1: 70,
  checking: 80,
};
const GUIDED_OPENING = {
  trickle: 0.4,
  speedUp: 13,
  timmy: 24,
  ai0: 14,
  ai1: 22,
  checking: 40,
};
// What each sleigh run carries. The first run always carries everyday gifts, the plain mix of all
// wishes; the other three carry one each of big, unclear and rush, in an order drawn from the seed.
// big and unclear are the shares of letters drawn from the big wishes and from the unclear ones that
// are not big, the rest coming from plain wishes. rate scales LETTER_RATE for that run, and target is
// the right gifts the run needs for three stars.
const CARGO = {
  everyday: {
    name: "Everyday gifts",
    icon: "🎁",
    big: null,
    unclear: null,
    rate: 1,
    target: 40,
  },
  big: {
    name: "Big gifts",
    icon: "📦",
    big: 0.7,
    unclear: 0.05,
    rate: 1,
    target: 50,
  },
  unclear: {
    name: "Letters from little ones",
    icon: "🖍️",
    big: 0.05,
    unclear: 0.8,
    rate: 1,
    target: 44,
  },
  rush: {
    name: "The rush",
    icon: "⏱️",
    big: 0.05,
    unclear: 0.05,
    rate: 2,
    target: 72,
  },
};
const LATER_CARGO = ["big", "unclear", "rush"];
const LETTER_RATE = 1.3; // letters a second after the first minute, before the cargo's rate
// Seconds of letters already in the workshop that a run still delivers after letters stop coming.
const PIPELINE_SECONDS = 15;
// Letters a second from each time on: a trickle three readers nearly manage, then faster than hand
// reading can keep up with, then from the second run on whatever that run's cargo brings.
const ramp = (cargo, { trickle, speedUp }) => [
  [0, trickle],
  [speedUp, 0.8],
  ...cargo
    .slice(1)
    .map((id, i) => [(i + 1) * RUN_SECONDS, LETTER_RATE * CARGO[id].rate]),
];
const CASE_GAP = 20;
const CASES_FROM = 60;
const CONSEQUENCE_GAP = 45;
const PATTERN_WINDOW = 30; // seconds within which the same wrong toy from the AI counts as a pattern
// Waiting cases take their turn in this order; the other kinds come last.
const CASE_ORDER = { source: 0, made: 1, aboard: 2 };

// child | words | wanted toy | wrong toy the AI might make | flags
const WISHES = [
  "Timmy | A little train, please. | 🚃 model train | 🚂 full-sized locomotive | unclear",
  "Mia | A red bike for the park. | 🚲 red bike | 🚲 blue bike | big subtle",
  "Noah | A teddy bear to cuddle. | 🧸 teddy bear | 🐻 live bear cub",
  "Ava | Something to paint with. I already have brushes. | 🎨 box of watercolours | 🪣 tin of wall paint | unclear",
  "Leo | A mouse for my desk. | 🖱️ computer mouse | 🐭 pet mouse | unclear",
  "Isla | A blue football. | ⚽ blue football | 🏈 rugby ball | subtle",
  "Oliver | A rocket for my space toys. | 🚀 toy rocket | 🎆 box of fireworks | unclear",
  "Grace | A small drum to play music. | 🥁 toy drum | 🛢️ oil drum",
  "Amir | A bat, please! I love caves. | 🦇 cuddly bat | 🏏 cricket bat | unclear",
  "Ella | Building bricks, no screens. | 🧱 box of building bricks | 📱 tablet game",
  "Finn | A book about dinosaurs. | 📕 dinosaur book | 🦖 live T. rex",
  "Sofia | A star for my bedroom. | ⭐ star night light | 🍪 star-shaped biscuit",
  "Zara | A doll in a pink dress. | 🪆 doll in a pink dress | 🪆 doll in a green dress | subtle",
  "Max | A kite that flies really high. | 🪁 kite | 🦅 real eagle",
  "Ruby | A puppy toy that barks. | 🐶 toy puppy | 🪵 sack of tree bark",
  "Jack | A pirate ship for the bath. | 🏴‍☠️ toy pirate ship | ⛵ full-sized galleon | big",
  "Lily | A yellow rubber duck. | 🐤 yellow rubber duck | 🦆 live duck",
  "Sam | Some cool shades, please. | 🕶️ pair of sunglasses | 💡 lampshade | unclear",
  "Maya | A crown like a real queen. | 👑 toy crown | 💎 set of crown jewels",
  "Ben | A dragon that breathes fire! | 🐉 toy dragon | 🔥 garden bonfire",
  "Chloe | A green dinosaur. | 🦕 green dinosaur | 🦕 purple dinosaur | subtle",
  "Ethan | Something for the snow. | 🛷 sledge | 🧂 bag of road salt | unclear big",
  "Hannah | A horse with a horn! | 🦄 toy unicorn | 🐴 horse in a party hat",
  "Lucas | A robot that helps me tidy up. | 🤖 toy robot | 🧹 broom",
  "Poppy | Something sweet, please. | 🍬 bag of sweets | 🍠 sweet potato | unclear",
  "Theo | A big red fire engine. | 🚒 red fire engine | 🚒 blue fire engine | big subtle",
  "Nina | A guitar so I can rock. | 🎸 toy guitar | 🪨 big rock | unclear big",
  "Omar | A space helmet. | 👩‍🚀 space helmet | 🐠 fishbowl",
  "Rosa | A chess set, please. | ♟️ chess set | 🗄️ chest of drawers | big",
  "Lena | A car like my mum's. | 🚗 pedal car | 🚙 full-sized car | unclear big",
  "Freya | Pink roller skates. | 🛼 pair of pink roller skates | ⛸️ pair of ice skates | big subtle",
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
    subtle: flags.includes("subtle"), // the wrong toy is a near miss, not an absurd blunder
  };
});
const TIMMY = WISHES[0];
const BIG_WISHES = WISHES.slice(1).filter((w) => w.big);
const UNCLEAR_WISHES = WISHES.slice(1).filter((w) => w.unclear && !w.big);
const PLAIN_WISHES = WISHES.slice(1).filter((w) => !w.big && !w.unclear);
const EVERYDAY_WISHES = WISHES.slice(1);
const slug = (name) => name.toLowerCase().replace(/[^a-z]+/g, "-");
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
// The absurd wrong toys the AI can make, for the page's collection.
const BLUNDERS = new Map(
  [...WISHES.filter((w) => !w.subtle).map((w) => w.wrong), LOCOMOTIVE].map(
    (toy) => [slug(toy.name), toy],
  ),
);
const BLUNDER_TOTAL = BLUNDERS.size;
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
      "Letters arrive faster than three elves can read. Move an elf from toys to reading.",
  },
  ai0: {
    control: "ai0",
    unlocks: ["ai0"],
    completes: ["setAi"],
    title: "Let the AI help read",
    text: () =>
      "Letters are arriving faster than the elves can read. Switch reading to Assist.",
  },
  ai1: {
    control: "ai1",
    unlocks: ["ai1"],
    completes: ["setAi"],
    title: "Let the AI make toys",
    text: () =>
      "Toy orders are piling up. Switch toys to Automate, and the elves there can watch or move.",
  },
  ask: {
    control: "ask",
    unlocks: ["ask"],
    completes: ["setAsk"],
    title: "Ask when a wish is unclear",
    text: (w, x) =>
      `${x.w.child}'s wish could mean two toys, and the AI just guesses. Turn on asking.`,
  },
  checking: {
    control: "checking",
    unlocks: ["checking"],
    completes: ["setChecking"],
    title: "A wrong gift went aboard",
    text: (w, x) =>
      x?.result === "wrong"
        ? "A wrong gift just went aboard unchecked. Choose which parcels the elves check."
        : "Nothing checks parcels before they leave. Choose which parcels the elves check.",
  },
  bypass: {
    control: "bypass",
    unlocks: ["bypass"],
    completes: ["move", "bypass"],
    title: "The checking pile is full",
    text: () =>
      "The checking pile is full and the toy line has stopped. Add a checker or let parcels through.",
  },
  cocoa: {
    control: "cocoa",
    unlocks: [],
    completes: ["move"],
    title: "Send a tired elf for cocoa",
    text: (w, x, e) =>
      `${e.name} is tiring and will start missing mistakes. Drag them to cocoa for a short break.`,
  },
  case: {
    control: "case",
    unlocks: [],
    completes: ["resolve"],
    title: "A case for you",
    text: (w) =>
      ({
        judge:
          "A checker is unsure about a parcel. Compare the toy with the wish, then ship or remake it.",
        unclear:
          "The AI is unsure what a child means. Accept its reading or have an elf ask.",
        pattern:
          "The same wrong toy keeps turning up. Decide whether to look into it.",
        update:
          "A toy machine update is on offer. Read its facts, then install, test or skip it.",
        incident:
          "Your update is making full-sized trains. Decide what to do, one step at a time.",
      })[w.cases[0].kind],
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
  constructor({ seed = 1, guided = false, version = "standard" } = {}) {
    this.seed = seed >>> 0;
    this.guided = guided;
    this.versionId = VERSIONS[version] ? version : "standard";
    this.v = VERSIONS[this.versionId];
    this.duration = 240;
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
    this.machineSpeed = 1;
    this.updates = this.planUpdates();
    this.opening = this.guided ? GUIDED_OPENING : OPENING;
    // One draw picks one of the six orders of the later cargoes.
    const order = Math.floor(this.rng() * 6);
    const later = [...LATER_CARGO];
    const first = later.splice(order % 3, 1);
    if (order >= 3) later.reverse();
    this.cargo = ["everyday", ...first, ...later];
    // A run's target is its cargo's, cut down in proportion for a run that letters stop arriving for
    // part-way through (the last one, after the workshop closes to new letters).
    this.runTargets = this.cargo.map((id, i) => {
      const open =
        Math.min((i + 1) * RUN_SECONDS, AT.close + PIPELINE_SECONDS) -
        i * RUN_SECONDS;
      return Math.round(
        CARGO[id].target * Math.min(1, open / RUN_SECONDS) * this.v.letters,
      );
    });
    this.target = sum(this.runTargets);
    this.ramp = ramp(this.cargo, this.opening);
    this.runNumber = 1;
    this.delivered = [];
    this.reports = [];
    this.choice = null;
    this.lastChoiceId = 0;
    this.pendingTest = null;
    this.aiUsed = false;
    this.blunders = new Map();
    this.points = 0;
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
    this.flow = Object.fromEntries(
      Object.keys(QUEUES).map((id) => [
        id,
        { ids: new Set(), arrived: 0, seconds: [], halfFull: false },
      ]),
    );
    this.milestones = [25, 50, 75, 100, 125]
      .filter((n) => n < this.target)
      .concat(this.target);
    this.secondAt = 0;
    this.unreportedLost = 0;
    this.behindNoted = false;
    this.lastId = 0;
    this.inflow = 0;
    this.spent = { people: 0, ai: 0, checking: 0, fixing: 0 };
    this.spentAtRun = { ...this.spent };
    // What checking did, by kind of parcel and for the sleigh run under way, for the summaries.
    this.assure = {
      groups: Object.fromEntries(
        GROUPS.map((g) => [
          g.id,
          {
            parcels: 0,
            wrongMade: 0,
            wrongMadeCost: 0,
            checked: 0,
            caught: 0,
            shipped: 0,
            checkCost: 0,
            prevented: 0,
            shippedCost: 0,
            shippedUnchecked: 0,
            shippedUncheckedCost: 0,
          },
        ]),
      ),
      run: this.freshRun(),
      held: 0,
      recallCost: 0,
      askCost: 0,
      trainCost: 0,
    };
    // What the player has done at least once, for the end summary.
    this.used = {
      assist: false,
      risky: false,
      asked: false,
      tested: false,
      rolledBack: false,
      trained: false,
      rested: false,
    };
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

  // One update for each break, at least one good and one faulty, each with two signs that lean the
  // right way and a promise of its own.
  planUpdates() {
    const faulty =
      this.rng() < 0.5 ? [true, false, false] : [true, true, false];
    for (let i = faulty.length - 1; i > 0; i--) {
      const j = Math.floor(this.rng() * (i + 1));
      [faulty[i], faulty[j]] = [faulty[j], faulty[i]];
    }
    return faulty.map((bad) => {
      const sign = () => this.rng() < (bad ? SIGN_IF_FAULTY : SIGN_IF_GOOD);
      return {
        faulty: bad,
        bigChange: sign(),
        briefTesting: sign(),
        promise: PROMISES[Math.floor(this.rng() * PROMISES.length)],
        testRolls: Array.from({ length: TEST_TOYS }, () => this.rng()),
      };
    });
  }

  // A wish from the mix of the run under way. Everyday runs draw from all wishes alike.
  pickWish() {
    const c = CARGO[this.cargo[this.runNumber - 1]];
    const from = (list) => list[Math.floor(this.rng() * list.length)];
    if (c.big === null) return from(EVERYDAY_WISHES);
    const r = this.rng();
    return from(
      r < c.big
        ? BIG_WISHES
        : r < c.big + c.unclear
          ? UNCLEAR_WISHES
          : PLAIN_WISHES,
    );
  }

  // A cargo as the page sees it, with one plain sentence a player can act on.
  cargoView(id) {
    const c = CARGO[id];
    const text = {
      everyday: `Everyday gifts: a wrong one costs ${money(WRONG_PRICE.everyday)}, a wrong big one ${money(WRONG_PRICE.big)}.`,
      big: `Mostly big gifts: the AI slips more on them, and a wrong one costs ${money(WRONG_PRICE.big)}.`,
      unclear: `Letters from little ones: about ${Math.round(c.unclear * 10)} in 10 wishes are unclear, and the AI guesses them.`,
      rush: `A rush: letters come about ${c.rate} times as fast.`,
    }[id];
    return { id, name: c.name, icon: c.icon, text };
  }

  inflowAt(t) {
    return this.ramp.findLast(([from]) => t >= from)[1];
  }

  // Letters expected between two times, following the ramp.
  lettersBetween(from, to) {
    return sum(
      this.ramp.map(
        ([start, rate], i) =>
          rate *
          Math.max(
            0,
            Math.min(to, this.ramp[i + 1]?.[0] ?? AT.close, AT.close) -
              Math.max(from, start),
          ),
      ),
    );
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

  freshRun() {
    return {
      caught: 0,
      prevented: 0,
      shipped: 0,
      shippedCost: 0,
      held: 0,
      checkCost: 0,
    };
  }

  // Adds to a kind of parcel's tally, and to the sleigh run's when the run keeps that figure.
  assured(x, field, amount = 1) {
    this.assure.groups[groupOf(x.w)][field] += amount;
    if (field in this.assure.run) this.assure.run[field] += amount;
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
  reach(id, parcelId = null, elf = null) {
    if (!this.guided || this.happened.has("moment:" + id)) return;
    this.happened.add("moment:" + id);
    if (URGENT_MOMENTS.includes(id))
      MOMENTS[id].unlocks.forEach((c) => this.unlocked.add(c));
    this.momentQueue.push({ id, parcelId, elf });
    this.showMoment();
  }

  // A moment whose example has gone closes, or never shows, and waits for the next real example.
  showMoment() {
    if (
      this.moment &&
      this.example(this.moment.id, this.moment.parcelId, this.moment.elf) ===
        false
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
      const parcelId = this.example(q.id, q.parcelId, q.elf);
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
        text: m.text(this, x, this.elves[q.elf]),
        parcelId,
        elf: q.elf,
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
  example(id, parcelId, elf = null) {
    switch (id) {
      case "bypass":
        return this.full("check") ? this.q.check[0].id : false;
      case "ask": {
        // Timmy while his letter is still here, or else any unclear letter not yet read.
        if (this.find(parcelId)) return parcelId;
        return this.q.letters.find((x) => x.w.unclear && !x.asked)?.id ?? false;
      }
      case "cocoa": {
        const e = this.elves[elf];
        return e && e.station < BREAK && e.tired >= COCOA_MOMENT_AT
          ? null
          : false;
      }
      case "case":
        return this.cases.length ? null : false;
      default:
        return parcelId === null || this.find(parcelId) ? parcelId : false;
    }
  }

  find(id) {
    return [
      ...this.aboard,
      ...Object.values(this.q).flat(),
      ...this.cases.flatMap((c) => c.parcels),
    ].find((x) => x.id === id);
  }

  // After a player action the pace is worked out afresh, so the page sees its effect at once.
  did(call, closes = true) {
    ({ projected: this.projected, slowest: this.slowest } = this.estimate());
    if (closes && this.moment?.completes.includes(call)) this.moment = null;
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
    const w = timmy ? TIMMY : this.pickWish();
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

  slipAt(s) {
    const team = this.staff(s);
    return sum(team.map((e) => slipping(e.tired))) / Math.max(1, team.length);
  }

  // What a tired elf gets wrong: the right toy in the wrong size, not something absurd.
  slipToy(x) {
    return {
      name: `${x.w.wanted.name} in the wrong size`,
      icon: x.w.wanted.icon,
    };
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
    return this.power(s);
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
    if (id === "letters") {
      if (this.ai[0] === 2) return AI_SECONDS.read;
      return this.ai[0] === 0 && x?.w?.unclear && !x.asked
        ? ELF_SECONDS.readUnclear
        : ELF_SECONDS.read[this.ai[0]];
    }
    if (id === "orders") return this.makeSeconds(this.ai[1]);
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
      Math.max(0, CONFIRM_CATCH - this.slipAt(s) * TIRED_MISSES) *
      (1 - this.vigilance().trust)
    );
  }

  checkCatch() {
    return Math.max(0.35, CHECK_CATCH - this.slipAt(2) * TIRED_MISSES);
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

  // Advances the run; nothing moves while a break choice is open.
  step(dt) {
    while (dt > 1e-9 && !this.end && !this.choice) {
      const d = Math.min(dt, 0.1);
      this.tick(d);
      dt -= d;
    }
  }

  tick(dt) {
    this.t = Math.min(this.duration, this.t + dt);
    this.events();
    if (this.t < AT.close) {
      this.inflow += dt * this.inflowAt(this.t) * this.v.letters;
      for (; this.inflow >= 1; this.inflow--) this.arrive();
    }
    this.timers(dt);
    this.route();
    for (const s of [0, 1, 2])
      for (const pool of ["elf", "ai"]) this.run(s, pool, dt);
    this.assignWork();
    this.elvesTick(dt);
    this.watchPiles(dt);
    this.track(dt);
    if (this.ai.some((l) => l > 0)) this.aiUsed = true;
    if (this.t >= this.runNumber * RUN_SECONDS - 1e-9) this.depart();
  }

  events() {
    const at = (time, key, fn) => {
      if (this.t >= time && !this.happened.has(key)) {
        this.happened.add(key);
        fn();
      }
    };
    const o = this.opening;
    at(o.timmy, "timmy", () => {
      this.arrive(true);
      this.say(
        "timmy",
        "Timmy writes: 'A little train, please.' How little is little?",
      );
    });
    const rushRun = this.cargo.indexOf("rush");
    at(rushRun * RUN_SECONDS, "rush", () =>
      this.say(
        "rush",
        `The rush is on! Letters now arrive about ${CARGO.rush.rate} times as fast.`,
      ),
    );
    if (this.pendingTest && this.t >= this.pendingTest.at) this.finishTest();
    this.raiseIncident();
    // Guided runs fall back to these times when the real example has not come by then.
    // Each AI lever comes as the answer to a pile that has started to grow.
    const growing = (id, n) =>
      this.trend(id) === "growing" && this.q[id].length >= n;
    if ((this.t >= this.ramp[1][0] && growing("letters", 8)) || this.t >= o.ai0)
      this.reach("ai0");
    if (
      this.happened.has("moment:ai0") &&
      (growing("orders", 8) || this.t >= o.ai1)
    )
      this.reach("ai1");
    const unclear = this.q.letters.find((x) => x.w.unclear && !x.asked);
    if (this.t > o.timmy && unclear) this.reach("ask", unclear.id);
    if (this.t >= o.checking) this.reach("checking");
    if (this.happened.has("moment:checking") && this.full("check"))
      this.reach("bypass", this.q.check[0].id);
    const tired = this.elves.findIndex(
      (e) => e.station < BREAK && e.tired >= COCOA_MOMENT_AT,
    );
    if (tired >= 0) this.reach("cocoa", null, tired);
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
        this.canOpenOther("unclear")
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
      this.asked(x);
      this.report.ask.asked++;
      this.q.orders.push(x);
    } else if (id === "orders") this.make(x);
    else if (id === "check" || id === "pass") {
      this.stats.passed++;
      if (id === "check") this.checkParcel(x);
      else this.load(x);
    } else this.remade(x);
  }

  // A child has explained the wish; the elf who asked rarely gets it wrong, and then only slightly.
  asked(x) {
    x.asked = true;
    this.used.asked = true;
    this.pay("people", PRICE.ask);
    this.assure.askCost += PRICE.ask;
    x.wrong = x.roll.read < RISK.asked;
    if (x.wrong)
      Object.assign(x, {
        wrongToy: this.slipToy(x),
        cause: "a misheard answer",
      });
  }

  // How the AI reads a letter, decided by the letter's own roll so a case can show it in advance.
  aiReading(x) {
    const guess = x.w.unclear && !x.asked;
    const risk = guess ? RISK.aiGuess : x.w.big ? RISK.aiReadBig : RISK.aiRead;
    return x.w === TIMMY || x.roll.read < risk ? x.w.wrong : x.w.wanted;
  }

  read(x) {
    const level = this.ai[0];
    const guess = x.w.unclear && !x.asked;
    if (level === 0) {
      x.wrong = x.roll.read < RISK.elfRead + this.slipAt(0) * RISK.perStrain;
      if (x.wrong)
        Object.assign(x, { wrongToy: this.slipToy(x), cause: "a tired elf" });
    } else {
      const draftWrong = this.aiReading(x) !== x.w.wanted;
      x.byAi = true;
      x.confident = guess;
      x.wrong =
        draftWrong && !(level === 1 && x.roll.confirm < this.confirmCatch(0));
      const cause = guess
        ? "the AI guessed an unclear wish"
        : x.w.big
          ? "the AI on a big gift"
          : "the AI misread a letter";
      if (x.wrong) Object.assign(x, { wrongToy: x.w.wrong, cause });
    }
    this.q.orders.push(x);
  }

  make(x) {
    const level = this.ai[1];
    x.madeAt = this.t;
    x.batch = Boolean(this.incident?.fault) && level > 0;
    let faulty = false;
    let slip;
    if (level === 0) {
      slip = x.roll.make < RISK.elfMake + this.slipAt(1) * RISK.perStrain;
      if (slip && !x.wrong)
        Object.assign(x, { wrongToy: this.slipToy(x), cause: "a tired elf" });
    } else {
      x.byAi = true;
      faulty = x.batch && x.roll.make < RISK.fault;
      const draftWrong =
        faulty || x.roll.make < (x.w.big ? RISK.aiMakeBig : RISK.aiMake);
      const confirmed =
        level === 1 && draftWrong && x.roll.confirm < this.confirmCatch(1);
      if (confirmed && faulty) this.notice("watcher");
      if (confirmed) faulty = false;
      slip = draftWrong && !confirmed;
      if (slip && !x.wrong)
        Object.assign(x, {
          wrongToy: x.w.wrong,
          cause: x.w.big ? "the AI on a big gift" : "the AI made the wrong toy",
        });
      if (faulty) x.cause = "made by the faulty update";
      // What a parcel made now is likely to be, for the incident's facts.
      x.batchRisk = x.batch
        ? RISK.fault * (level === 1 ? 1 - this.confirmCatch(1) : 1)
        : 0;
    }
    x.wrong ||= slip;
    this.assured(x, "parcels");
    if (x.wrong) {
      this.assured(x, "wrongMade");
      this.assured(x, "wrongMadeCost", this.price(x));
    }
    this.stats.toys++;
    if (slip) this.stats.toyMistakes++;
    x.made = faulty ? LOCOMOTIVE : x.wrong ? x.wrongToy : x.w.wanted;
    // An absurd wrong toy joins the game's collection of blunders, caught or not.
    const absurd = x.wrong && BLUNDERS.get(slug(x.made.name));
    if (absurd)
      this.blunders.set(slug(x.made.name), {
        id: slug(x.made.name),
        name: absurd.name,
        icon: absurd.icon,
      });
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
    this.assured(x, "checked");
    this.assured(x, "checkCost", PRICE.check);
    this.report.checking.checked++;
    this.report.checking.money += PRICE.check;
    x.exit = "checked";
    // An unsure checker brings the parcel to the player instead of deciding; nothing is revealed yet.
    if (x.unsure && x.roll.judge < 0.3 && this.canOpenOther("judge")) {
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
    // A caught mistake sharpens the checkers for a while; it does not wipe out a long clean stretch.
    this.vig.cleanRun = Math.max(0, this.vig.cleanRun - CATCH_SHARPENS);
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
    this.assured(x, "caught");
    this.assured(x, "prevented", this.price(x));
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
        // A gift brought back off the sleigh was not stopped in time; its remake is part of the recall.
        if (x.recalled) {
          if (x.recalled === "unchecked")
            this.assure.recallCost += PRICE.remake;
        } else {
          this.assured(x, "caught");
          this.assured(x, "prevented", this.price(x));
        }
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
    const cause = this.causeId(x);
    this.say("loaded", text, {
      check: this.copy(x),
      cause,
      control: WRONG_CAUSES[cause].control,
    });
    if (this.t >= this.opening.timmy) this.reach("checking", x.id);
    if (x.exit === "skipped" && !this.vig.trained) {
      const elf = this.staff(2)[0]?.name ?? "A checker";
      this.sayEvery(
        20,
        "waved",
        "relaxed",
        `${elf} waved ${x.w.child}'s ${x.made.name} through without opening it. Training at the next break would stop that.`,
      );
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
      this.canOpenOther("pattern")
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
  canOpenOther(kind) {
    const waitingOther = this.cases
      .slice(1)
      .some((c) => !(c.kind in { update: 1, incident: 1 }));
    return (
      this.v.kinds.includes(kind) &&
      this.unlocked.has("checking") &&
      this.t >= CASES_FROM &&
      !waitingOther &&
      this.caseCount < this.v.cap &&
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

  // What happened, then what the player can do; the figures belong to the options.
  caseText(c) {
    const x = c.parcels[0];
    switch (c.kind) {
      case "judge":
        return `A checker is unsure about ${x.w.child}'s parcel. Check the toy against the wish, then ship or remake it.`;
      case "unclear":
        return `${x.w.child}'s wish is unclear: '${x.w.wish}' Accept the AI's reading or have an elf ask.`;
      case "pattern":
        return `The checkers keep seeing ${a(c.name)}. Look into it, hold what was made, or carry on.`;
      default:
        return {
          source:
            "Your update is making full-sized trains. Roll it back, or keep it running for now.",
          made: "Parcels from the faulty update are still in the workshop. Remake them, check each, or let them go.",
          aboard:
            "Wrong gifts are on the sleigh. Bring them back to be remade, or leave them aboard.",
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

  // Seconds per toy: the machine alone, or each elf confirming its drafts, goes faster with a faster
  // machine; by hand does not.
  makeSeconds(level, speed = this.machineSpeed) {
    if (level === 2) return AI_SECONDS.make / speed;
    return ELF_SECONDS.make[level] / (level ? speed : 1);
  }

  toyRate(speed = this.machineSpeed) {
    const people = this.ai[1] === 2 ? 1 : this.power(1);
    return Math.round((people * 60) / this.makeSeconds(this.ai[1], speed));
  }

  // The figures each decision turns on, shown before the choice.
  // The figures each decision turns on, shown before the choice: three primary ones on the card, the
  // rest behind the info pop-up. Values are kept to a few words.
  facts(c) {
    const f = (label, value, primary = false) => ({
      label,
      value: String(value),
      primary,
    });
    const x = c.parcels[0];
    const list = this.affected(c);
    const big = list.filter((x) => x.w.big).length;
    const worth = (x) =>
      x.w.big
        ? `${money(WRONG_PRICE.big)}, big gift`
        : `${money(WRONG_PRICE.everyday)}, everyday`;
    const time = f("Time left", `${this.timeLeft()} s`);
    switch (c.kind) {
      case "judge":
        return [
          f("Gift", worth(x), true),
          f("Why unsure", "the AI flagged it", true),
          f("Checking pile", `${this.q.check.length} waiting`, true),
          time,
        ];
      case "unclear":
        return [
          f("Gift", worth(x), true),
          f("AI reads it as", this.aiReading(x).name, true),
          f("Asking", `${ELF_SECONDS.ask} s, ${money(PRICE.ask)}`, true),
          f("Waiting to be asked", this.q.clarify.length),
          time,
        ];
      case "pattern": {
        const ago =
          this.lastInstallAt === null
            ? "none"
            : `${Math.round(this.t - this.lastInstallAt)} s ago`;
        return [
          f("Seen", `${c.parcels.length} times in ${PATTERN_WINDOW} s`, true),
          f("Last update", ago, true),
          f("Made since", `${list.length}, ${big} big`, true),
          time,
        ];
      }
      default: {
        if (c.step === "source")
          return [
            f("Trains so far", this.incident.trains, true),
            f(
              "Rolling back",
              `${ROLLBACK_SECONDS} s, ${money(PRICE.rollback)}`,
              true,
            ),
            f(
              "Toys a minute",
              `${this.toyRate()} now, ${this.toyRate(this.incident.speedBefore)} after`,
              true,
            ),
            time,
          ];
        if (c.step === "made") {
          const likely = list.length
            ? sum(list.map((x) => x.batchRisk ?? 0)) / list.length
            : 0;
          return [
            f("Parcels", list.length, true),
            f("Big gifts", big, true),
            f("Likely wrong", chance(likely), true),
            f("Checking pile", `${this.q.check.length} waiting`),
            time,
          ];
        }
        return [
          f("Wrong gifts", list.length, true),
          f("Big gifts", big, true),
          f("Cost if left", money(sum(list.map((x) => this.price(x)))), true),
          time,
        ];
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
            PRICE.ask,
            `this letter; an elf at reading for ${ELF_SECONDS.ask} s and a letter back`,
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
              PRICE.recall + n * (PRICE.recallEach + PRICE.remake),
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
    if (["remake", "ask", "investigate"].includes(optionId)) {
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

  // Applies an answer and says what it did with the time, money and parcels involved.
  closeCase(c, optionId) {
    const x = c.parcels[0];
    const extra = { caseId: c.id, option: optionId };
    let text;
    let outcome = {};
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
        this.asked(x);
        this.q.orders.push(x);
        text = `An elf spent ${ELF_SECONDS.ask} s and ${money(PRICE.ask)} asking ${x.w.child}: the letter went on as ${a(x.w.wanted.name)}.`;
        outcome = { seconds: ELF_SECONDS.ask, money: PRICE.ask, parcels: 1 };
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

  install(u) {
    this.lastInstallAt = this.t;
    const speedBefore = this.machineSpeed;
    this.machineSpeed *= 1 + u.promise;
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
        this.used.rolledBack = true;
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
          money: PRICE.recall + n * PRICE.recallEach,
          since: this.t,
        };
        list.forEach((x) => {
          // The summary counts a recall against too little checking only for a gift that went out unchecked.
          x.recalled =
            x.exit === "checked" || x.exit === "case" ? "checked" : "unchecked";
          if (x.recalled === "unchecked")
            this.assure.recallCost += PRICE.recall / n + PRICE.recallEach;
          this.toRework(x, ELF_SECONDS.recall, job);
        });
        this.pay("fixing", PRICE.recall + n * PRICE.recallEach);
        this.say(
          "recalled",
          `${plural(n, "wrong gift")} came back off the sleigh to be remade.`,
          { count: n },
        );
        tell(
          `${does(n, "wrong gift", "comes", "come")} back to be remade: about ${Math.round(n * ELF_SECONDS.recall)} s of checkers and ${money(PRICE.recall + n * (PRICE.recallEach + PRICE.remake))}.`,
          {
            seconds: n * ELF_SECONDS.recall,
            money: PRICE.recall + n * (PRICE.recallEach + PRICE.remake),
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
        0.6 +
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
        `At this pace Santa leaves with about ${pace.projected} right gifts.${pace.slowest === null ? "" : ` ${STATION_NAMES[pace.slowest]} is holding things up.`}`,
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

  // What arrives in each pile and how long it is, kept second by second for the last ten seconds,
  // so the page can show whether the player's last move helped.
  watchPiles(dt) {
    for (const [id, flow] of Object.entries(this.flow)) {
      const ids = new Set(this.q[id].map((x) => x.id));
      for (const i of ids) if (!flow.ids.has(i)) flow.arrived++;
      flow.ids = ids;
      if (ids.size > QUEUES[id].limit / 2) flow.halfFull = true;
      if (!ids.size && flow.halfFull) {
        flow.halfFull = false;
        this.say(
          "cleared",
          `The ${QUEUES[id].name.toLowerCase()} pile is clear.`,
          { queue: id },
        );
      }
    }
    if (this.t - this.secondAt < 1 - 1e-9) return;
    this.secondAt = this.t;
    for (const [id, flow] of Object.entries(this.flow)) {
      flow.seconds = [
        ...flow.seconds.slice(-10),
        { length: this.q[id].length, arrived: flow.arrived },
      ];
      flow.arrived = 0;
    }
    const right = this.rightSoFar();
    while (this.milestones.length && right >= this.milestones[0]) {
      const n = this.milestones.shift();
      this.say(
        "milestone",
        n === this.target
          ? `${n} right gifts: the target is met!`
          : `${n} right gifts are on the sleigh.`,
        { right: n },
      );
    }
  }

  inflowOf(id) {
    return (
      sum(this.flow[id].seconds.map((s) => s.arrived)) *
      (60 / Math.max(1, this.flow[id].seconds.length))
    );
  }

  // Compares the pile now with ten seconds ago, a few seconds averaged at each end so it does not flicker.
  trend(id) {
    const seconds = this.flow[id].seconds;
    if (seconds.length < 6) return "steady";
    const mean = (list) => sum(list.map((s) => s.length)) / list.length;
    const change = mean(seconds.slice(-3)) - mean(seconds.slice(0, 3));
    return change >= 1 ? "growing" : change <= -1 ? "shrinking" : "steady";
  }

  // The one thing that most needs the player now, in four words at most, or null.
  focus() {
    const tired = this.elves
      .filter((e) => e.station < BREAK && e.tired >= 70)
      .sort((x, y) => y.tired - x.tired)[0];
    if (tired)
      return { station: BREAK, control: "cocoa", text: `rest ${tired.name}` };
    const piles = ["letters", "clarify", "orders", "check"].filter(
      (id) =>
        this.trend(id) === "growing" &&
        this.q[id].length >= QUEUES[id].limit * 0.3,
    );
    piles.sort(
      (x, y) =>
        this.q[y].length / QUEUES[y].limit - this.q[x].length / QUEUES[x].limit,
    );
    for (const id of piles) {
      const s = QUEUES[id].station;
      const lever = `ai${s}`;
      const aiHelps =
        s < 2 &&
        id !== "clarify" &&
        this.ai[s] < 2 &&
        this.unlocked.has(lever) &&
        this.staff(s).length >= 3;
      return aiHelps
        ? { station: s, control: lever, text: "try the AI" }
        : { station: s, control: "elves", text: "needs another elf" };
    }
    const recentWrong = this.news.filter(
      (n) => n.kind === "loaded" && this.t - n.t <= 30,
    ).length;
    if (
      recentWrong >= 2 &&
      this.checking === 0 &&
      this.unlocked.has("checking")
    )
      return { station: 2, control: "checking", text: "check more" };
    return null;
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

  // Average seconds an elf at reading spends per letter at a level: unclear letters are asked about
  // when asking is on, and take a hand reader longer when it is off.
  elfReadSeconds(level) {
    const unclear = share((w) => w.unclear);
    const unclearSeconds = this.ask
      ? ELF_SECONDS.ask
      : level === 0
        ? ELF_SECONDS.readUnclear
        : ELF_SECONDS.read[level];
    return (1 - unclear) * ELF_SECONDS.read[level] + unclear * unclearSeconds;
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
        : elves(0) / this.elfReadSeconds(this.ai[0]);
    const making =
      (this.ai[1] === 2 ? 1 : elves(1)) / this.makeSeconds(this.ai[1]);
    const checked = this.checkShare();
    const dispatch =
      elves(2) /
      (checked * this.secondsPerCheck() +
        (1 - checked) * ELF_SECONDS.pass +
        0.05 * ELF_SECONDS.remake);
    return [reading, making, dispatch];
  }

  // The station holding gifts back: the furthest along the line whose own pile is filling up. A pile
  // also fills when the station after it is stopped, so the furthest one is where the line is stuck.
  // null when no pile is filling, because letters are not arriving faster than the workshop works.
  // Letters waiting to be asked hold nothing back until their pile is full and stops the letter pile.
  holdingUp() {
    const filling = (id) =>
      this.q[id].length >= QUEUES[id].limit / 2 ||
      (this.trend(id) === "growing" &&
        this.q[id].length >= QUEUES[id].limit / 4);
    const s = [2, 1, 0].find((s) =>
      STATION_QUEUES[s].some(
        (id) => !["rework", "clarify"].includes(id) && filling(id),
      ),
    );
    return s ?? null;
  }

  // Right gifts expected at departure if every station keeps its current speed.
  estimate() {
    const rates = this.rates();
    const slowest = this.holdingUp();
    const letters = this.v.letters * this.lettersBetween(this.t, AT.close);
    const supply = sum(Object.values(this.q).map((q) => q.length)) + letters;
    const all = [...this.delivered, ...this.aboard];
    const right = all.filter((x) => !x.wrong).length;
    const rightShare = all.length >= 10 ? right / all.length : 0.95;
    return {
      projected:
        right +
        Math.min(Math.min(...rates) * (this.duration - this.t), supply) *
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
          : (elves(s) * 60) /
            (s === 0 ? this.elfReadSeconds(level) : this.makeSeconds(level)),
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
                  : `big gifts: ${chance(RISK.aiMakeBig).replace("about ", "")} wrong`;
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
      [
        "The risky ones",
        "elves check big, unclear and unsure parcels, where the AI slips most",
      ],
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
    const right = this.delivered.filter((x) => !x.wrong).length;
    const wrongGifts = this.delivered.filter((x) => x.wrong);
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
    const wrongShare = wrongGifts.length / Math.max(1, this.delivered.length);
    this.points += Math.max(0, this.left()) * POINTS.budgetLeft;
    const top = right >= this.target && wrongShare <= 0.1 && total <= BUDGET;
    const rating = top
      ? 3
      : right >= this.target * 0.8 && wrongShare <= 0.2
        ? 2
        : 1;
    const assurance = this.assurance();
    let lesson = this.lesson(rating, right, costs);
    // A lesson about how much was checked takes its title and words from the assurance verdict, so
    // the two always agree and both tell how this game turned out.
    const titles = {
      "too little": "Too little checking",
      "about right": "Checking in the right places",
      "too much": "Too much checking",
    };
    if (Object.values(titles).includes(lesson.title))
      lesson = { title: titles[assurance.verdict], text: assurance.text };
    this.end = {
      right,
      wrong: wrongGifts.length,
      lost: this.lost,
      rating,
      costs,
      lesson,
      assurance,
      used: { ...this.used },
      causes: this.causes(this.delivered.filter((x) => x.wrong)),
      stars: sum(this.reports.map((r) => r.stars)),
      points: Math.round(this.points),
      runs: this.reports.map((r) => ({
        ...r,
        slips: r.slips.map((x) => ({ ...x })),
        spent: { ...r.spent },
        assurance: { ...r.assurance },
        cargo: { ...r.cargo },
        goals: r.goals.map((g) => ({ ...g })),
        causes: r.causes.map((c) => ({ ...c })),
      })),
      blunders: [...this.blunders.values()].map((b) => ({ ...b })),
      blunderTotal: BLUNDER_TOTAL,
    };
  }

  // Whether checking was too little, about right or too much, in the game's own money.
  //   underCost: what under-checking lost: for each kind of gift, what its wrong gifts that reached
  //     children without a check (never sent for one, waved through, or let through) cost beyond
  //     what checking every unchecked parcel of that kind would have cost, plus the recalls and
  //     remakes of unchecked gifts brought back off the sleigh. Leaving cheap mistakes unchecked when
  //     checking them all would cost more is not under-checking, and a mistake that slipped past a
  //     checker who did look is the price of checks being imperfect.
  //   overCost: what over-checking lost: the checking money spent on kinds of parcel where the checks
  //     cost more than the mistakes they stopped, plus LATE_PRICE for each gift that missed a sleigh
  //     because checking held it up.
  //   position = 0.5 + (overCost / (underCost + overCost) - 0.5) * weight, where
  //     weight = lost / (lost + ASSURANCE.settle * all money spent) and lost = underCost + overCost.
  //   So 0 is all under-checking, 1 all over-checking, and losses that are small against the whole
  //   bill keep the dial near the middle. Below ASSURANCE.little it reads "too little", above
  //   ASSURANCE.much "too much", and "about right" between.
  // The texts tell how this game turned out, not whether a choice was wise beforehand: a risky batch
  // can happen to come out clean. Estimated amounts (what checks prevented, gifts held up) read "about".
  assurance() {
    const a = this.assure;
    const groups = GROUPS.map((g) => {
      const t = a.groups[g.id];
      const unchecked = t.parcels - t.checked;
      // Left exposed: the wrong gifts that got through unchecked cost more than checking the rest would have.
      const verdict =
        t.shippedUncheckedCost > unchecked * PRICE.check
          ? "left exposed"
          : t.checkCost > t.prevented
            ? "cost more than it saved"
            : "paid";
      const kind = g.name.toLowerCase();
      const count = (n) => `${n} ${n === 1 ? g.one : kind}`;
      const stopped = t.prevented
        ? `about ${money(t.prevented)} of wrong gifts`
        : "no wrong gifts";
      const text = {
        paid: t.checked
          ? `This time, checking ${count(t.checked)} cost ${money(t.checkCost)} and stopped ${stopped}.`
          : `This time, no ${kind} were checked, and their unchecked slips cost ${money(t.shippedUncheckedCost)}.`,
        "cost more than it saved": `This time, checking ${count(t.checked)} cost ${money(t.checkCost)} and stopped ${t.prevented ? "only " : ""}${stopped}.`,
        "left exposed": `This time, wrong ${kind} that went out unchecked cost ${money(t.shippedUncheckedCost)}, more than the ${money(unchecked * PRICE.check)} that checking the other ${unchecked} would have cost.`,
      }[verdict];
      const { wrongMadeCost, ...shown } = t;
      return {
        id: g.id,
        name: g.name,
        icon: g.icon,
        ...Object.fromEntries(
          Object.entries(shown).map(([k, v]) => [k, Math.round(v)]),
        ),
        verdict,
        text,
      };
    });
    const total = (field) => sum(Object.values(a.groups).map((t) => t[field]));
    // Only the avoidable part of an unchecked mistake counts: what the wrong gifts of a kind cost
    // beyond what checking every unchecked parcel of that kind would have cost.
    const underCost =
      sum(
        Object.values(a.groups).map((t) =>
          Math.max(
            0,
            t.shippedUncheckedCost - (t.parcels - t.checked) * PRICE.check,
          ),
        ),
      ) + a.recallCost;
    const overCost =
      sum(
        Object.values(a.groups)
          .filter((t) => t.checkCost > t.prevented)
          .map((t) => t.checkCost),
      ) +
      a.held * LATE_PRICE;
    const lost = underCost + overCost;
    const weight =
      lost /
      Math.max(1, lost + ASSURANCE.settle * sum(Object.values(this.spent)));
    const position = lost ? 0.5 + (overCost / lost - 0.5) * weight : 0.5;
    const verdict =
      position < ASSURANCE.little
        ? "too little"
        : position > ASSURANCE.much
          ? "too much"
          : "about right";
    const under = money(underCost);
    const over = money(overCost);
    const text = {
      "too little": `This time there was too little checking: unchecked wrong gifts and recalls cost ${under}, against about ${over} for checks that did not pay and gifts held up. The figures for each kind of gift show where the mistakes got through.`,
      "about right": `This time checking was about right: unchecked wrong gifts and recalls cost ${under}, and checks that did not pay and gifts held up about ${over}. Neither side of the bill ran away.`,
      "too much": `This time there was too much checking: checks that did not pay and gifts held up cost about ${over}, against ${under} of unchecked wrong gifts and recalls. The figures for each kind of gift show where checks cost more than they saved.`,
    }[verdict];
    return {
      verdict,
      position: Math.round(position * 100) / 100,
      underCost: Math.round(underCost),
      overCost: Math.round(overCost),
      wrongMade: total("wrongMade"),
      caught: total("caught"),
      prevented: Math.round(total("prevented")),
      shipped: total("shipped"),
      shippedCost: Math.round(total("shippedCost")),
      held: a.held,
      spent: Math.round(this.spent.checking + a.askCost + a.trainCost),
      groups,
      noChecks: {
        wrong: total("wrongMade"),
        cost: Math.round(total("wrongMadeCost")),
      },
      text,
    };
  }

  rightSoFar() {
    return [...this.delivered, ...this.aboard].filter((x) => !x.wrong).length;
  }

  // The three goals of a sleigh run, as they stand for the gifts aboard now.
  goals(n = this.runNumber) {
    const target = this.runTargets[n - 1];
    const right = this.aboard.filter((x) => !x.wrong).length;
    const wrong = this.aboard.filter((x) => x.wrong).length;
    const allowed = Math.max(WRONG_MIN, Math.floor(target / WRONG_PER));
    const allowance = Math.round(ALLOWANCE.base + ALLOWANCE.perGift * target);
    const spent = Math.round(
      sum(
        Object.keys(this.spent).map((k) => this.spent[k] - this.spentAtRun[k]),
      ),
    );
    const from = Math.ceil(target * GOALS_FROM);
    const loaded = right >= from;
    // A goal whose figures are within its limit waits, unlit, until the sleigh holds enough gifts.
    const counted = (within) => ({
      met: loaded && within,
      waiting: !loaded && within,
      note: !loaded && within ? `counts from ${from} right gifts` : null,
    });
    return [
      {
        id: "full",
        name: "Full sleigh",
        now: right,
        need: target,
        text: `${target} right gifts`,
        met: right >= target,
        waiting: false,
        note: null,
      },
      {
        id: "right",
        name: "Right gifts",
        now: wrong,
        need: allowed,
        text: `at most ${plural(allowed, "wrong gift")}`,
        ...counted(wrong <= allowed),
      },
      {
        id: "cost",
        name: "Within budget",
        now: spent,
        need: allowance,
        text: `spend at most ${money(allowance)}`,
        ...counted(spent <= allowance),
      },
    ];
  }

  // Which cause a wrong gift on the sleigh comes under: what let it through a check, else what made it wrong.
  causeId(x) {
    if (x.made === LOCOMOTIVE || x.cause === "made by the faulty update")
      return "faulty";
    if (x.slipped || x.exit === "skipped") return "waved";
    if (x.cause === "a tired elf") return "tired";
    if (x.cause === "the AI guessed an unclear wish") return "guessed";
    if (x.w.big) return "big";
    return x.cause === "the AI made the wrong toy" ? "misMade" : "misread";
  }

  // Up to three causes of the wrong gifts given, dearest first.
  causes(list) {
    return Object.entries(Object.groupBy(list, (x) => this.causeId(x)))
      .map(([id, xs]) => ({
        id,
        name: WRONG_CAUSES[id].name,
        wrong: xs.length,
        cost: sum(xs.map((x) => this.price(x))),
        control: WRONG_CAUSES[id].control,
        fix: WRONG_CAUSES[id].fix,
      }))
      .sort((p, q) => q.cost - p.cost || q.wrong - p.wrong)
      .slice(0, 3);
  }

  // The first goal a run missed, in the player's words, or null when it earned all three.
  missedGoal(goals) {
    const [full, right, cost] = goals;
    if (!full.met)
      return `${plural(full.need - full.now, "gift")} short of a full sleigh`;
    if (!right.met)
      return `${plural(right.now - right.need, "wrong gift")} too many`;
    if (!cost.met) return `${money(cost.now - cost.need)} over the allowance`;
    return null;
  }

  // What let a wrong gift reach a child: how it went past dispatch, or else how it was made wrong.
  causeOf(x) {
    if (x.exit === "skipped") return "waved through by relaxed checkers";
    if (x.exit === "bypassed") return "let through unchecked";
    return x.cause ?? "a slip";
  }

  // A sleigh run leaves: its gifts are delivered and cannot come back; what is still in the workshop
  // carries over to the next run.
  depart() {
    const n = this.runNumber;
    const right = this.aboard.filter((x) => !x.wrong).length;
    const wrongGifts = this.aboard.filter((x) => x.wrong);
    const target = this.runTargets[n - 1];
    const goals = this.goals(n);
    const stars = goals.filter((g) => g.met).length;
    const bonus = right >= target && !wrongGifts.length ? POINTS.clean : 0;
    this.points +=
      right * POINTS.right -
      sum(wrongGifts.map((x) => this.price(x))) +
      bonus +
      stars * POINTS.star;
    const slips = wrongGifts
      .map((x) => ({
        wish: x.w.wish,
        wanted: { ...x.w.wanted },
        made: { ...x.made },
        cause: this.causeOf(x),
        cost: this.price(x),
      }))
      .sort((p, q) => q.cost - p.cost);
    for (const x of wrongGifts) {
      this.assured(x, "shipped");
      this.assured(x, "shippedCost", this.price(x));
      // Unchecked: never sent for a check, waved through, or let through; not one a checker or the player looked at.
      if (x.exit !== "checked" && x.exit !== "case") {
        this.assured(x, "shippedUnchecked");
        this.assured(x, "shippedUncheckedCost", this.price(x));
      }
    }
    // Gifts held up by checking: waiting in the checking pile, or toy orders stuck behind it while it is full.
    const held =
      this.q.check.length + (this.full("check") ? this.q.orders.length : 0);
    this.assure.held += held;
    this.assure.run.held += held;
    const round = (o) =>
      Object.fromEntries(Object.entries(o).map(([k, v]) => [k, Math.round(v)]));
    const report = {
      run: n,
      right,
      wrong: wrongGifts.length,
      target,
      stars,
      missedBy: this.missedGoal(goals),
      bonus,
      slips: slips.slice(0, 3),
      more: Math.max(0, slips.length - 3),
      spent: round(
        Object.fromEntries(
          Object.entries(this.spent).map(([k, v]) => [
            k,
            v - this.spentAtRun[k],
          ]),
        ),
      ),
      assurance: round(this.assure.run),
      cargo: this.cargoView(this.cargo[n - 1]),
      goals,
      causes: this.causes(wrongGifts),
    };
    this.spentAtRun = { ...this.spent };
    this.assure.run = this.freshRun();
    this.allSlips = [...(this.allSlips ?? []), ...slips];
    this.reports.push(report);
    this.delivered.push(...this.aboard);
    this.aboard = [];
    this.aboardSeen = 0;
    const wrongText = wrongGifts.length
      ? ` and ${plural(wrongGifts.length, "wrong one")}`
      : "";
    this.say(
      "departed",
      `Sleigh run ${n} left with ${right} right gifts${wrongText}: ${plural(stars, "star")}.`,
      { run: n, right, wrong: wrongGifts.length, target, stars },
    );
    if (n === RUNS) return this.finish();
    this.runNumber++;
    this.choice = this.makeChoice(report);
    this.aiUsed = false;
  }

  // The break: one thing to do before the next run. Each option says what it gives, risks and costs.
  makeChoice(report) {
    const u = this.updates[report.run - 1];
    const fact = (label, value) => ({ label, value: String(value) });
    const pct = Math.round(u.promise * 100);
    const signs = `It changes ${u.bigChange ? "a large" : "a small"} part of the machine and the supplier tested it ${u.briefTesting ? "briefly" : "thoroughly"}.`;
    const update = {
      id: "update",
      kind: "update",
      label: "Install the AI update",
      text: `An update for the toy machine promises toys ${pct}% faster. ${signs}`,
      facts: [
        fact("Gives", `toys ${pct}% faster`),
        fact("Risk", `goes wrong ${chance(this.failChance(u))}`),
        fact("Costs", money(BREAK_PRICE.update)),
      ],
    };
    const tested = {
      id: "tested",
      kind: "tested",
      label: "Test the update first",
      text: `The update is tried on a few toys first. If they come out right it goes in ${TEST_DELAY} s into the next run; if not, nothing is installed.`,
      facts: [
        fact("Gives", `the same, ${TEST_DELAY} s later, if clean`),
        fact(
          "Risk",
          `a good update fails 1 in ${Math.round(1 / (1 - (1 - RISK.aiMake) ** TEST_TOYS))}`,
        ),
        fact("Costs", money(BREAK_PRICE.tested)),
      ],
    };
    const state = this.vigilance().state;
    const train = {
      id: "train",
      kind: "train",
      label: "Train the checkers",
      text: `The checkers are ${state} and have skipped ${plural(this.vig.skipped, "check")}; about ${this.aiParcelsToCome()} AI parcels are still to come.`,
      facts: [
        fact(
          "Gives",
          `careful checks on about ${this.aiParcelsToCome()} AI parcels`,
        ),
        fact("Checkers now", state),
        fact("Costs", money(BREAK_PRICE.train)),
      ],
    };
    const tired = this.elves.map((e) => e.tired);
    const average = Math.round(sum(tired) / tired.length);
    const rest = {
      id: "rest",
      kind: "rest",
      label: "Cocoa for everyone",
      text: `The elves average ${average} tiredness, and ${tired.filter((t) => t >= 60).length} are over 60.`,
      facts: [
        fact("Gives", "every elf fresh"),
        fact("Elves now", `${average} tired on average`),
        fact("Costs", money(BREAK_PRICE.rest)),
      ],
    };
    const options = [
      ...(this.aiUsed ? [update, tested] : []),
      ...(this.vig.trained ? [] : [train]),
      rest,
    ];
    // With no AI in use there is no update to offer, unless the break would otherwise have one option.
    if (options.length < 2) options.unshift(update);
    return {
      id: ++this.lastChoiceId,
      run: report.run,
      report,
      next: {
        cargo: this.cargoView(this.cargo[report.run]),
        target: this.runTargets[report.run],
      },
      title: `Sleigh run ${report.run} has left`,
      text: `Pick one thing to do before run ${report.run + 1}.`,
      options,
    };
  }

  choose(choiceId, optionId) {
    const c = this.choice;
    const option = c?.options.find((o) => o.id === optionId);
    if (!c || c.id !== choiceId || !option) return false;
    const u = this.updates[c.run - 1];
    const machine = (speed) => Math.round((60 / AI_SECONDS.make) * speed);
    const before = machine(this.machineSpeed);
    let text;
    let outcome;
    if (optionId === "update") {
      this.pay("ai", BREAK_PRICE.update);
      this.install(u);
      text = `Installed: the toy machine can now make ${machine(this.machineSpeed)} toys a minute instead of ${before}.`;
      outcome = {
        money: BREAK_PRICE.update,
        gained: machine(this.machineSpeed) - before,
      };
    } else if (optionId === "tested") {
      this.pay("ai", BREAK_PRICE.tested);
      this.used.tested = true;
      this.pendingTest = { u, at: this.t + TEST_DELAY };
      text = `The update will be tried on a few toys; it goes in ${TEST_DELAY} s into the next run if they come out right.`;
      outcome = { money: BREAK_PRICE.tested, seconds: TEST_DELAY };
    } else if (optionId === "train") {
      this.pay("people", BREAK_PRICE.train);
      this.assure.trainCost += BREAK_PRICE.train;
      this.used.trained = true;
      this.vig.trained = true;
      this.say(
        "trained",
        "Training done. The checkers stay careful however clean the AI looks.",
      );
      text = `Trained the checkers for ${money(BREAK_PRICE.train)}: they will check properly however clean the AI looks.`;
      outcome = { money: BREAK_PRICE.train };
    } else {
      this.pay("people", BREAK_PRICE.rest);
      this.used.rested = true;
      for (const e of this.elves)
        Object.assign(e, {
          tired: 0,
          rest: 0,
          station: e.station === BREAK && e.rest > 0 ? e.home : e.station,
        });
      text = `Cocoa for everyone for ${money(BREAK_PRICE.rest)}: every elf starts the next run fresh.`;
      outcome = { money: BREAK_PRICE.rest };
    }
    this.say("chose", text, { choiceId, option: optionId, outcome });
    this.choice = null;
    return true;
  }

  // A tested update: trial toys on the new version; it goes in only if they all come out right.
  finishTest() {
    const { u } = this.pendingTest;
    this.pendingTest = null;
    const found = u.testRolls.filter(
      (r) => r < (u.faulty ? RISK.fault : RISK.aiMake),
    ).length;
    if (!found) return this.install(u);
    this.consequence(
      "tested",
      `The test found ${found} of ${TEST_TOYS} trial toys wrong, so the update was not installed.`,
      { money: BREAK_PRICE.tested },
    );
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
    // Where most of what the delivered mistakes cost came from, when one cause stands out. Weighed by
    // cost, so a few wrong big gifts outweigh many cheap slips.
    const slips = this.allSlips ?? [];
    const costOf = (list) => sum(list.map((x) => x.cost));
    const top = Object.entries(Object.groupBy(slips, (x) => x.cause)).sort(
      (p, q) => costOf(q[1]) - costOf(p[1]),
    )[0];
    const byCause = {
      "the AI guessed an unclear wish": [
        "Unclear wishes, guessed",
        "Most of what your wrong gifts cost came from unclear wishes the AI guessed. Asking the child, or checking unclear wishes, stops them.",
      ],
      "the AI on a big gift": [
        "Big gifts the AI got wrong",
        "Most of what your wrong gifts cost came from big gifts the AI got wrong. Check the big ones: they cost the most.",
      ],
      "made by the faulty update": [
        "The faulty update's trains",
        "Most of what your wrong gifts cost came from the faulty update. Roll it back as soon as it shows, then deal with what it made.",
      ],
      "waved through by relaxed checkers": [
        "Waved through",
        "Most of what your wrong gifts cost came from gifts relaxed checkers waved through. Training them at a break keeps them careful.",
      ],
      "let through unchecked": [
        "Let through unchecked",
        "Most of what your wrong gifts cost came from gifts let through without a check. One more checker would have kept the pile moving.",
      ],
      "a tired elf": [
        "Tired hands",
        "Most of what your wrong gifts cost came from slips by tired elves. A short cocoa break keeps them sharp.",
      ],
    };
    if (
      missed &&
      top &&
      slips.length >= 4 &&
      costOf(top[1]) * 2 >= costOf(slips) &&
      byCause[top[0]]
    )
      return L(...byCause[top[0]]);
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
    this.did("move", this.moment?.id !== "cocoa" || station === BREAK);
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
    if (level === 1) this.used.assist = true;
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
    if (level === 1) this.used.risky = true;
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
    if (name === "bypass")
      return this.q.check.length ? null : "Nothing waiting for a check";
    return null;
  }

  costText(name) {
    const perMinute = (level) => money(AI_PRICE[level] * 60);
    const waiting = this.q.check.length;
    return {
      ai0: `${perMinute(1)} a minute on assist, ${perMinute(2)} on automate`,
      ai1: `${perMinute(1)} a minute on assist, ${perMinute(2)} on automate`,
      ask: `each unclear letter takes an elf about ${ELF_SECONDS.ask} seconds and a ${money(PRICE.ask)} letter back`,
      checking: `each check takes a checker about ${Math.round(this.secondsPerCheck())} seconds and costs ${money(PRICE.check)}`,
      bypass: `lets ${plural(waiting, "waiting parcel")} through unchecked; free, but nobody looks at them`,
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
      inflow: Math.round(this.inflowOf(id)),
      trend: this.trend(id),
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
      this.example(this.moment.id, this.moment.parcelId, this.moment.elf) !==
        false
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
      stations: this.rates().map((rate, s) => {
        const working = this.staff(s).filter(
          (e) => e.doing !== "nothing to do",
        ).length;
        return {
          staff: this.staff(s).length,
          working,
          idle: this.staff(s).length - working,
          queues: [...STATION_QUEUES[s]],
          blocked: this.stationBlocked(s),
          rate: Math.round(rate * 60),
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
      choice: this.choice && {
        ...this.choice,
        report: {
          ...this.choice.report,
          slips: this.choice.report.slips.map((x) => ({ ...x })),
          spent: { ...this.choice.report.spent },
          assurance: { ...this.choice.report.assurance },
          cargo: { ...this.choice.report.cargo },
          goals: this.choice.report.goals.map((g) => ({ ...g })),
          causes: this.choice.report.causes.map((c) => ({ ...c })),
        },
        next: {
          cargo: { ...this.choice.next.cargo },
          target: this.choice.next.target,
        },
        options: this.choice.options.map((o) => ({
          ...o,
          facts: o.facts.map((f) => ({ ...f })),
        })),
      },
      score: {
        points: Math.round(this.points),
        stars: sum(this.reports.map((r) => r.stars)),
        best: RUNS * 3,
      },
      run: {
        number: this.runNumber,
        of: RUNS,
        target: this.runTargets[this.runNumber - 1],
        cargo: this.cargoView(this.cargo[this.runNumber - 1]),
        goals: this.goals(),
        leavesIn: Math.max(
          0,
          Math.round(this.runNumber * RUN_SECONDS - this.t),
        ),
        stars: this.reports.map((r) => r.stars),
      },
      focus: this.focus(),
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
        assurance: {
          ...this.end.assurance,
          groups: this.end.assurance.groups.map((g) => ({ ...g })),
          noChecks: { ...this.end.assurance.noChecks },
        },
        used: { ...this.end.used },
        runs: this.end.runs.map((r) => ({
          ...r,
          slips: r.slips.map((x) => ({ ...x })),
          spent: { ...r.spent },
          assurance: { ...r.assurance },
          cargo: { ...r.cargo },
          goals: r.goals.map((g) => ({ ...g })),
          causes: r.causes.map((c) => ({ ...c })),
        })),
        causes: this.end.causes.map((c) => ({ ...c })),
      },
    };
  }
}
