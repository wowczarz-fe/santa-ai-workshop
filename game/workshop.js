// The rules of one game. It never touches the page, so it also runs in Node for balance checks.

const ELF_NAMES = "Pip Holly Jingle Noel Ivy Fig Tinsel Coco".split(" ");
const CONTROLS = "ai0 ai1 checking".split(" ");
const BREAK = 3;
// The stations by the words on the page's headings, used wherever a line points at a place.
const STATION_NAMES = ["Letters", "Toys", "Checking"];
const LEVELS = ["By hand", "Assist", "Automate"];

const QUEUES = {
  letters: { name: "Letters", station: 0, limit: 24 },
  orders: { name: "Toy orders", station: 1, limit: 20 },
  check: { name: "To check", station: 2, limit: 10 },
  pass: { name: "Waiting to load", station: 2, limit: 12 },
  rework: { name: "To remake", station: 2, limit: 30 },
};
// What the player calls each pile, for the line that says a full pile has cleared.
const PILE_NAMES = {
  letters: "Letter pile",
  orders: "Toy pile",
  check: "Checking pile",
  pass: "Waiting-to-load pile",
  rework: "Remake pile",
};
const STATION_QUEUES = [["letters"], ["orders"], ["check", "pass", "rework"]];

// Seconds one fresh elf needs per parcel (reading and making by AI level); the AI alone is faster,
// and good updates make the toy machine faster still.
const ELF_SECONDS = {
  read: [5.5, 2.6],
  make: [5.5, 2.6],
  check: 4.5,
  pass: 0.16,
  remake: 10, // remaking a caught mistake: catching it late costs more than preventing it
  recall: 4, // fetching a gift back off a loaded sleigh, then remaking it
};
// However many gifts come back, a recall takes the checkers at most this many seconds in all.
const RECALL_MAX_SECONDS = 20;
// What these wrong gifts count in the cost while they stay aboard.
const countedPrice = (list) =>
  sum(list.map((x) => (x.w.big ? WRONG_PRICE.big : WRONG_PRICE.everyday)));
// What bringing these gifts back off the sleigh costs, remakes included: half as much again as they
// count in the cost aboard, and at least RECALL_MARGIN more. Fixing a mistake after it has shipped
// costs more than living with it, so a recall buys Santa's good name with real money.
const RECALL_FACTOR = 1.5;
const RECALL_MARGIN = 40;
const recallPrice = (list) =>
  Math.round(
    Math.max(
      countedPrice(list) * RECALL_FACTOR,
      countedPrice(list) + RECALL_MARGIN,
    ),
  );
// Seconds of checker work for each of n gifts brought back.
const recallSeconds = (n) =>
  Math.min(ELF_SECONDS.recall, RECALL_MAX_SECONDS / Math.max(1, n));
const AI_SECONDS = { read: 0.6, make: 0.75 };
const ROLLBACK_SECONDS = 8;

// What goes wrong. On everyday gifts the AI is as reliable as a fresh elf, at reading and at making,
// and it never tires; elves get worse as they tire. On big gifts, which it has seen less of, the AI
// is poor. A faulty update makes the same wrong toy again and again.
const RISK = {
  elfRead: 0.005,
  aiRead: 0.005,
  aiReadBig: 0.15,
  elfMake: 0.005,
  aiMake: 0.005,
  aiMakeBig: 0.45,
  fault: 0.65,
  perStrain: 0.008, // per point of tiredness above SLIPS_FROM
};
const CONFIRM_CATCH = 0.95; // an elf confirming an AI draft spots a wrong one
const CHECK_CATCH = 0.9;
// The cause of a wrong gift the player made by picking the wrong reading of an unclear wish.
const PICKED_WRONG = "you read an unclear wish wrongly";
const UNSURE_IF_WRONG = 0.7;
const CATCH_SHARPENS = 10; // clean parcels a caught mistake takes off the elves' run
// A clean AI draft adds this much to the trust of each elf confirming drafts at that station, as a
// clean checked gift does for a checker.
const CONFIRM_TRUST = 1;
const UNSURE_IF_RIGHT = 0.06;
const SAMPLE = 0.08; // share of parcels "a few" sends to the checking pile
const NOTICE_AFTER = 4; // faulty trains seen by checkers or on the sleigh before anyone says so

// The update on offer at half-time. A worrying sign (a big change, brief supplier testing) is
// likelier on a faulty update, so reading the signs beats chance without making it certain.
const PROMISES = [0.3, 0.4, 0.5, 0.6];
const SIGN_IF_FAULTY = 0.7;
const SIGN_IF_GOOD = 0.3;
const TEST_TOYS = 4;
const RECALLS = 2;
const DRIFT_QUIET = 20; // seconds at the start with no line about elves trusting the AI
const DRIFT_GAP = 20; // seconds at least between two lines about elves trusting the AI
const COCOA_LEAST = 3; // seconds a cocoa break lasts at least, however rested the elf
const NEED_CLAIM = 5; // seconds a need answered by one rested elf is left to it
const WRONG_LINE_GAP = 20; // seconds before a wrong-gift line repeats the same advice

// One sleigh, filled over two halves with a pause between them. The target sits where a first-time
// player on the good plan (the AI alone on the everyday gifts of the first half, then elves
// confirming the toys and the risky ones checked once the big gifts come) fills it in about two
// games in five. Nearly every letter has to become a right gift, so a slow start, a jam or a batch
// of remakes costs the star. Checking everything is held back by the budget, not by this target.
const HALF_SECONDS = 75;
const DURATION = 2 * HALF_SECONDS;
const CLOSE = DURATION - 15; // letters stop coming, so the last ones can still reach the sleigh
const TARGET = 147;
// Three goals for the game, one star each (ADR 0014). full: the right gifts aboard reach the
// target. right: at most WRONG_ALLOWED wrong gifts aboard. cost: the sleigh leaves with budget
// left. The right and cost goals count only once the sleigh holds GOALS_FROM of its target, so a
// slow sleigh earns nothing for being cheap and clean.
// COST_LIMIT is the budget (ADR 0020): the cost so far, wrong gifts aboard at what they will cost
// included, counts down from it, and the game ends the moment nothing is left. A game that ends
// that way has lost the cost star, so it earns two stars at most.
const WRONG_ALLOWED = 2;
const COST_LIMIT = 900;
const GOALS_FROM = 0.7;
const BUDGET_LOW = 0.25; // the share of the budget left at which it is said to be running low
const NO_BUDGET = "not enough budget left";
// Where a wrong gift that reached the sleigh came from, and the control that would have stopped it.
// fix is the advice in parts, each with a test of whether the settings already follow it
// (causes() leaves those out).
const WRONG_CAUSES = {
  picked: {
    name: "Unclear wishes you read wrongly",
    control: "decide",
    fix: [["read the child's clue before you pick", () => false]],
  },
  big: {
    name: "Big gifts the AI made with no person looking",
    control: "checking",
    fix: [
      [
        "big gifts need a person: check the risky ones, or use Assist",
        (w) => w.checking >= 1,
      ],
    ],
  },
  // On everyday gifts the AI slips as rarely as a fresh elf, so there is nothing to change.
  misread: {
    name: "Rare AI slips reading everyday letters",
    control: "checking",
    fix: [],
  },
  misMade: {
    name: "Rare AI slips making everyday toys",
    control: "checking",
    fix: [],
  },
  slip: {
    name: "Gifts a fresh elf mixed up",
    control: "checking",
    fix: [],
  },
  waved: {
    name: "Checkers stopped looking",
    control: "train",
    fix: [
      ["train them at half-time", (w) => w.vig.trained],
      ["rest them with cocoa", () => false],
    ],
  },
  recalled: {
    name: "Wrong gifts brought back off the sleigh",
    control: "checking",
    fix: [
      [
        "check the risky ones, so fewer need fetching back",
        (w) => w.checking >= 1,
      ],
    ],
  },
  faulty: {
    name: "The faulty update",
    control: "update",
    fix: [
      ["roll a faulty update back as soon as it shows", () => false],
      ["test updates first", () => false],
    ],
  },
  tired: {
    name: "Gifts tired elves mixed up",
    control: "cocoa",
    fix: [["send elves for cocoa before they get tired", () => false]],
  },
};
// Seconds Assist or risky checking must run before the end summary counts it as used, so one click
// does not earn the practice.
const USED_FOR = 10;
// The loss each end lesson names: slow (the sleigh fell short), tired (tiredness held it up), wrong
// (wrong gifts cost a goal), cost (the budget ran out) or none (a tip after three stars). The
// headline is chosen from the same loss, so the two always agree.
const LOSSES = {
  "By hand is too slow": "slow",
  "Checking was the bottleneck": "slow",
  "Too much checking": "slow",
  "Letters piled up": "slow",
  "Piles grew where nobody was working": "slow",
  "Almost there": "slow",
  "Tired checkers held up the line": "tired",
  "Tired elves let letters pile up": "tired",
  "Burnouts slowed the line": "tired",
  "A decision waited too long": "wrong",
  "Unclear wishes read wrongly": "wrong",
  "Big gifts need a person": "wrong",
  "A faulty update ran unchecked": "wrong",
  "Checkers stopped looking": "wrong",
  "Tired elves mixed gifts up": "wrong",
  "Too little checking": "wrong",
  "The faulty update ran too long": "wrong",
  "Tired checkers miss mistakes": "wrong",
  "Too many wrong gifts": "wrong",
  "Out of money": "cost",
  "Checking in the right places": "none",
  "The faulty update, handled": "none",
  "Santa leaves happy": "none",
};
// The lesson under the checking dial: what to do next time, so it never repeats the dial's figures.
const CHECKING_ADVICE = {
  "too little":
    "Check where the AI is weak and a mistake costs most: the big gifts.",
  "about right": "Checks went where mistakes were likeliest and dearest.",
  "too much":
    "Check where a mistake is likely or dear, and let the rest through.",
  bottleneck:
    "A full checking pile stops the whole line, however good the checks.",
};
// What each half-time option costs, against the cost goal.
const HALF_TIME_PRICE = {
  update: 40,
  tested: 50,
  train: 100,
  rest: 50,
  none: 0,
};
const TEST_DELAY = 20; // seconds into the second half a tested update goes in, when the test is clean

// Checkers relax after a run of clean AI-made parcels they checked: quicker checks, some skipped.
const VIGILANCE = [
  { state: "careful", name: "sharp", from: 0, speed: 1, skip: 0, trust: 0 },
  {
    state: "relaxing",
    name: "drifting",
    from: 8,
    speed: 0.75,
    skip: 0.5,
    trust: 0.3,
  },
  {
    state: "waving through",
    name: "not looking",
    from: 20,
    speed: 0.5,
    skip: 0.9,
    trust: 0.6,
  },
];

// A cocoa break in time is short; a burnt-out elf is gone for 15 seconds and comes back still tired.
const BURNOUT_AT = 88;
const BURNOUT_SECONDS = 15;
const BURNOUT_RECOVERY = 2.5; // back at about 50, so a burnt-out elf soon tires again
const COCOA_RECOVERY = 13; // from 60 to fresh in about 4 seconds
// Tiredness 0 to 100. Above FRESH it slows an elf and makes it miss more.
const FRESH = 30;
const TIRED_SLOWS = 0.014;
const TIRED_MISSES = 0.02;
const strain = (tired) => Math.max(0, tired - FRESH);
// Elves working by hand make almost no mistakes until properly tired, and then only ordinary slips.
const SLIPS_FROM = 50;
const slipping = (tired) => Math.max(0, tired - SLIPS_FROM);
// Tiredness a working elf gains a second: one never rested burns out late in the first half and
// again in the second, so a player who rests elves when they turn red sees about one burnout a game.
const WORK_STRAIN = 0.65;
const CHECKER_STRAIN = 0.1; // checking tires a little more than reading or making
const PRESSURE_STRAIN = 0.2; // and a station whose piles are filling up more again
// Tiredness took this share of a station's working time or more: the end screen names it as the
// reason that station held the line up. Elves rested at about 60 lose about a tenth; never rested,
// about half.
const TIRED_SHARE = 0.25;
// Energy is tiredness turned round for the page: 100 fresh, 0 at burnout. The mood follows the
// mechanics: an elf slows past FRESH and starts slipping past SLIPS_FROM.
const energy = (tired) =>
  Math.max(0, Math.min(100, Math.round(100 * (1 - tired / BURNOUT_AT))));
const mood = (e) =>
  e.rest > 0
    ? "spent"
    : e.tired > SLIPS_FROM
      ? "tired"
      : e.tired > FRESH
        ? "tiring"
        : "fresh";

const AI_PRICE = [0, 0.22, 0.72]; // per station, per second
const PRICE = {
  check: 4, // each gift sent for a check
  remake: 3, // making an everyday gift again
  // Making a big gift again is dear: a mistake caught late costs far more than one prevented, which
  // is what puts automation everywhere behind people on the big gifts even with every one checked.
  remakeBig: 15,
  rollback: 65,
};
// What making these gifts again costs.
const remakePrice = (list) =>
  sum(list.map((x) => (x.w.big ? PRICE.remakeBig : PRICE.remake)));
const WRONG_PRICE = { everyday: 12, big: 100 };
// For the end summary: what a gift that misses its sleigh while it waits to be checked is worth. The
// child gets it late or not at all, so it counts as half a wrong everyday gift.
const LATE_PRICE = WRONG_PRICE.everyday / 2;
// Gifts held up at checking, or letters lost to a full pile, decide the end screen only when they
// cost at least this share of the game's target, so a well-played game a few gifts short is not told
// off for them.
const LATE_SHARE = 0.15;
// Wrong gifts decide the end headline only when the mistakes goal was missed, or they cost this share
// of the cost limit or more.
const WRONG_SHARE = 0.3;
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
// When one loss is clear times the other and at least floor pounds, the dial reads its side.
const ASSURANCE = { little: 0.1, much: 0.8, settle: 0.1, clear: 3, floor: 100 };

// What each half of the game carries: everyday gifts only, where the AI is as reliable as a fresh
// elf, then mostly big gifts, where the AI is poor and a mistake costs most. big is the share of
// letters drawn from the big wishes, the rest coming from plain wishes.
const CARGO = [
  { id: "everyday", name: "Everyday gifts", icon: "🎁", big: 0 },
  { id: "big", name: "Big gifts", icon: "📦", big: 0.6 },
];
// Seconds into the second half before the first big letter arrives: time to put people on the big
// gifts after the half-time card has said they are coming.
const BIG_FROM = 8;
// Letters a second from each time on: a trickle three readers nearly manage, then faster than hand
// reading can keep up with.
const RAMP = [
  [0, 0.6],
  [15, 1.1],
];
// One unclear letter in each half, at a time drawn from this window of seconds into the half.
const UNCLEAR_WINDOW = [12, 40];
const CONSEQUENCE_GAP = 45;
// Waiting decisions take their turn in this order; unclear letters come last.
const CASE_ORDER = { source: 0, aboard: 1 };
// A decision's name in a few words, by step for the incident and by kind for the others.
const CASE_TITLES = {
  source: "Faulty update",
  aboard: "Santa's reputation at risk",
  unclear: "Unclear wish",
};

// child | words | wanted toy | wrong toy the AI might make | flags
const WISHES = [
  "Timmy | A little train for my toy track. | 🚃 model train | 🚂 full-sized locomotive | unclear",
  "Mia | A red bike for the park. | 🚲 red bike | 🚲 blue bike | big subtle",
  "Noah | A teddy bear to cuddle. | 🧸 teddy bear | 🐻 live bear cub",
  "Ava | Something to paint pictures with. | 🎨 box of watercolours | 🪣 tin of wall paint | unclear",
  "Leo | A mouse for my desk. My old one stopped clicking. | 🖱️ computer mouse | 🐭 pet mouse | unclear",
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
  "Sam | Some cool shades for the beach. | 🕶️ pair of sunglasses | 💡 lampshade | unclear",
  "Maya | A crown like a real queen. | 👑 toy crown | 💎 set of crown jewels",
  "Ben | A dragon that breathes fire! | 🐉 toy dragon | 🔥 garden bonfire",
  "Chloe | A green dinosaur. | 🦕 green dinosaur | 🦕 purple dinosaur | subtle",
  "Ethan | Something to ride down the snowy hill. | 🛷 sledge | 🧂 bag of road salt | unclear big",
  "Hannah | A horse with a horn! | 🦄 toy unicorn | 🐴 horse in a party hat",
  "Lucas | A robot that helps me tidy up. | 🤖 toy robot | 🧹 broom",
  "Poppy | Something sweet. Mum says they are bad for my teeth. | 🍬 bag of sweets | 🍠 sweet potato | unclear",
  "Theo | A big red fire engine. | 🚒 red fire engine | 🚒 blue fire engine | big subtle",
  "Nina | I want to rock! I know three chords. | 🎸 toy guitar | 🪨 big rock | unclear big",
  "Omar | A space helmet. | 👩‍🚀 space helmet | 🐠 fishbowl",
  "Rosa | A chess set, please. | ♟️ chess set | 🗄️ chest of drawers | big",
  "Lena | A car like my mum's, but my size. | 🚗 pedal car | 🚙 full-sized car | unclear big",
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
// Unclear wishes come only as the decision letters; every other letter is clear.
const UNCLEAR_WISHES = WISHES.filter((w) => w.unclear);
const CLEAR_WISHES = WISHES.filter((w) => !w.unclear);
const BIG_WISHES = CLEAR_WISHES.filter((w) => w.big);
const PLAIN_WISHES = CLEAR_WISHES.filter((w) => !w.big);
const slug = (name) => name.toLowerCase().replace(/[^a-z]+/g, "-");
// A well-mixed 32-bit number from two, for draws kept apart from the game's random sequence.
const mix = (a, b) => {
  let h = (Math.imul(a, 0x9e3779b1) ^ b) >>> 0;
  h = Math.imul(h ^ (h >>> 16), 0x45d9f3b);
  h = Math.imul(h ^ (h >>> 16), 0x45d9f3b);
  return (h ^ (h >>> 16)) >>> 0;
};
const LOCOMOTIVE = { name: "full-sized locomotive", icon: "🚂" };

const a = (name) => (/^[aeio]/.test(name) ? "an " : "a ") + name;
const money = (n) => "£" + Math.round(n).toLocaleString("en-GB");
const sum = (list) => list.reduce((total, n) => total + n, 0);
const countDown = (n, dt) => (n - dt < 1e-9 ? 0 : n - dt);
// "twice", "3 times": how many times as fast.
const times = (n) => (n === 2 ? "twice" : `${n} times`);
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
// "about 1 in 200" for a small chance: one in a round number a player reads at a glance.
const oneIn = (p) => {
  const n = 1 / p;
  const step = n >= 100 ? 50 : n >= 20 ? 5 : 1;
  return `about 1 in ${Math.max(2, Math.round(n / step) * step)}`;
};
// The absurd wrong toys the AI can make, for the page's collection.
const BLUNDERS = new Map(
  [...WISHES.filter((w) => !w.subtle).map((w) => w.wrong), LOCOMOTIVE].map(
    (toy) => [slug(toy.name), toy],
  ),
);
const BLUNDER_TOTAL = BLUNDERS.size;

const DOING = {
  letters: ["reading letters", "confirming the AI's readings"],
  orders: ["making toys", "confirming the AI's toys"],
  check: ["checking gifts"],
  pass: ["loading"],
  rework: ["remaking"],
};

class Workshop {
  constructor({ seed = 1 } = {}) {
    this.seed = seed >>> 0;
    this.firstSeed = this.seed; // kept for draws that must not move the game's own random sequence
    this.duration = DURATION;
    this.target = TARGET;
    this.t = 0;
    this.half = 1;
    this.elves = ELF_NAMES.map((name, i) => ({
      name,
      station: i < 3 ? 0 : i < 6 ? 1 : 2,
      home: 0,
      tired: Math.round(2 + 18 * this.rng()), // elves start a little apart, so they do not all tire at once
      // How far this elf has come to trust the AI's work, in clean AI gifts it has seen at its
      // station. A cocoa break or a move to another station starts it afresh.
      trust: 0,
      breakAt: 0,
      rest: 0,
      doing: "",
    }));
    this.q = Object.fromEntries(Object.keys(QUEUES).map((id) => [id, []]));
    this.work = {};
    this.last = {};
    this.aboard = [];
    this.ai = [0, 0];
    this.checking = 0;
    // Checks skipped by relaxed checkers, and whether training at half-time keeps every elf sharp for
    // good. How far each elf trusts the AI is its own (`trust`).
    this.vig = { skipped: 0, trained: false };
    this.swapNow = null; // the drift prompt: the elf to send for cocoa, and its station
    this.driftSaid = null; // the prompt the last drift line named
    this.machineSpeed = 1;
    this.update = this.planUpdate();
    // One unclear letter in each half: two different children, each at a time drawn in its half. The
    // first half carries everyday gifts only, so its unclear letter is never a big gift.
    const pool = [...UNCLEAR_WISHES];
    this.unclear = [0, 1].map((half) => {
      const at =
        half * HALF_SECONDS +
        UNCLEAR_WINDOW[0] +
        this.rng() * (UNCLEAR_WINDOW[1] - UNCLEAR_WINDOW[0]);
      const fits = pool.filter((w) => half === 1 || !w.big);
      const w = fits[Math.floor(this.rng() * fits.length)];
      pool.splice(pool.indexOf(w), 1);
      return { at, w, sent: false };
    });
    this.choice = null;
    this.pendingTest = null;
    this.blunders = new Map();
    this.lastInstallAt = null;
    this.incident = null;
    this.cases = [];
    this.lastCaseId = 0;
    this.recallsRaised = 0; // recall decisions raised so far
    this.recallWrongAtAnswer = 0;
    this.firstRecallOffered = false; // the first wrong gift aboard has had its recall decision
    this.claimed = {}; // when a rested elf last went to answer each station's need
    this.recalled = { count: 0, cost: 0 }; // wrong gifts brought back off the sleigh, and what it cost
    this.lowSaid = false; // whether the line about the budget running low has gone out
    this.undecided = 0; // unclear letters still waiting for a decision when the sleigh left
    this.answered = []; // unclear letters the player has read, waiting for room in the toy pile
    this.testResult = null; // "passed" or "failed" once a tested update has been tried
    this.recent = [];
    this.report = { checking: this.fresh() };
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
    this.milestones = [25, 50, 75].filter((n) => n < TARGET).concat(TARGET);
    this.secondAt = 0;
    this.unreportedLost = 0;
    this.behindNoted = false;
    this.lastId = 0;
    this.inflow = 0;
    // Cost so far, by what it went on; wrong gifts aboard are added when the cost is shown.
    this.spent = { ai: 0, checking: 0, halfTime: 0, fixing: 0 };
    // What checking did, by kind of parcel, for the summaries.
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
      held: 0,
      // Gifts the checking pile held back: held at departure, or letters lost while checking was
      // the station holding the line. "all" while every parcel was checked, "some" otherwise.
      heldBy: { all: 0, some: 0 },
      lostAtCheck: 0,
      recallCost: 0,
      // What the checks waved through by trusting checkers cost, by kind of gift: paid, not done.
      wavedCost: Object.fromEntries(GROUPS.map((g) => [g.id, 0])),
      trainCost: 0,
    };
    // What the player has done, for the practices on the end screen.
    this.used = {
      tested: false,
      rolledBack: false,
      trained: false,
      restAll: false,
      cocoa: 0, // elves the player sent for cocoa
      picked: 0, // unclear wishes the player read
      pickedRight: 0,
    };
    this.stats = {
      ai: [0, 0, 0],
      assist: 0, // seconds with at least one station on Assist
      checking: [0, 0, 0],
      passed: 0,
      checked: 0,
      caught: 0,
      prevented: 0,
      waved: 0,
      wavedCost: 0,
      burnouts: 0,
      checkerBurnouts: 0,
      // Elf-seconds of work at each station, and the part of them tiredness took (slower work, and
      // whole seconds while burnt out), for the end lesson.
      tiredWork: [0, 0, 0],
      tiredLost: [0, 0, 0],
      jammed: 0,
      holding: [0, 0, 0], // seconds each station was the one holding gifts back
      faulty: 0,
      toys: 0,
      toyMistakes: 0,
    };
    // Jobs done and done wrongly, by kind of gift and by who did them (see job()).
    const tally = () => ({
      ai: { made: 0, wrong: 0 },
      elves: { made: 0, wrong: 0 },
    });
    this.reliability = { everyday: tally(), big: tally() };
    this.end = null;
    for (let i = 0; i < 6; i++) this.arrive();
    this.assignWork();
    ({ projected: this.projected, slowest: this.slowest } = this.estimate());
  }

  rng() {
    this.seed = (Math.imul(1664525, this.seed) + 1013904223) >>> 0;
    return this.seed / 4294967296;
  }

  // The update offered at half-time: good or faulty by an even draw, with two signs that lean the
  // right way and a promise of its own.
  planUpdate() {
    const bad = this.rng() < 0.5;
    const sign = () => this.rng() < (bad ? SIGN_IF_FAULTY : SIGN_IF_GOOD);
    return {
      faulty: bad,
      bigChange: sign(),
      briefTesting: sign(),
      promise: PROMISES[Math.floor(this.rng() * PROMISES.length)],
      testRolls: Array.from({ length: TEST_TOYS }, () => this.rng()),
    };
  }

  // A clear wish from the mix of the half under way.
  pickWish() {
    const c = CARGO[this.half - 1];
    const from = (list) => list[Math.floor(this.rng() * list.length)];
    const big = this.t >= HALF_SECONDS + BIG_FROM ? c.big : 0;
    return from(this.rng() < big ? BIG_WISHES : PLAIN_WISHES);
  }

  // The share of letters in the half under way that are big gifts.
  bigShare() {
    return CARGO[this.half - 1].big;
  }

  // A half's cargo as the page sees it, with a few plain words a player can act on, short enough to
  // sit in a heading after the cargo's name.
  cargoView(half = this.half) {
    const c = CARGO[half - 1];
    const text = {
      everyday: `The AI matches a fresh elf here. A wrong one costs ${money(WRONG_PRICE.everyday)}.`,
      big: `The AI gets many of these wrong, and each costs ${money(WRONG_PRICE.big)}.`,
    }[c.id];
    return { id: c.id, name: c.name, icon: c.icon, text };
  }

  inflowAt(t) {
    return RAMP.findLast(([from]) => t >= from)[1];
  }

  // Letters expected between two times, following the ramp.
  lettersBetween(from, to) {
    return sum(
      RAMP.map(
        ([start, rate], i) =>
          rate *
          Math.max(
            0,
            Math.min(to, RAMP[i + 1]?.[0] ?? CLOSE, CLOSE) -
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

  // Adds to a kind of parcel's tally.
  assured(x, field, amount = 1) {
    this.assure.groups[groupOf(x.w)][field] += amount;
  }

  fresh() {
    return {
      since: this.t ?? 0,
      checked: 0,
      caught: 0,
      avoided: 0,
      money: 0,
    };
  }

  // After a player action the pace is worked out afresh, so the page sees its effect at once.
  did() {
    ({ projected: this.projected, slowest: this.slowest } = this.estimate());
  }

  // A letter joins the letter pile, or is lost when the pile is full. An unclear one is set aside at
  // once as a decision for the player and is never lost to a full pile.
  arrive(unclear = null) {
    const roll = {};
    for (const k of "read make unsure sample catch confirm skip".split(" "))
      roll[k] = this.rng();
    if (!unclear && this.q.letters.length >= QUEUES.letters.limit) {
      this.lost++;
      this.unreportedLost++;
      if (this.slowest === 2) {
        this.assure.lostAtCheck++;
        this.heldByChecking(1);
      }
      return;
    }
    const x = {
      id: ++this.lastId,
      w: unclear ?? this.pickWish(),
      roll,
      made: null,
      wrong: false,
      byAi: false,
      unsure: false,
      batch: false,
      result: null,
      remake: 0,
      job: null,
      exit: null,
      wrongAt: null, // the station whose work made it wrong
      wrongLevel: null, // that station's AI level then
    };
    if (unclear) this.openCase({ kind: "unclear", parcels: [x] });
    else this.q.letters.push(x);
  }

  // Elves at a station; station 3 is the cocoa break.
  staff(s) {
    return this.elves.filter((e) => e.station === s);
  }

  slipAt(s) {
    const team = this.staff(s);
    return sum(team.map((e) => slipping(e.tired))) / Math.max(1, team.length);
  }

  // Why an elf working by hand at station s slipped: tiredness, or an ordinary slip while fresh.
  slipCause(s) {
    return this.slipAt(s) > 0 ? "a tired elf" : "an elf's slip";
  }

  // What an elf gets wrong: a mix-up, not something absurd. The child gets another child's toy of
  // the same kind (everyday for everyday, big for big), drawn per parcel from the seed and kept
  // apart from the game's random sequence, and never the toy the child asked for.
  slipToy(x) {
    const others = WISHES.filter(
      (w) => w.big === x.w.big && w.wanted.name !== x.w.wanted.name,
    );
    return { ...others[mix(this.firstSeed, x.id) % others.length].wanted };
  }

  // Elf-seconds of work a station's elves do each second.
  power(s) {
    return sum(this.staff(s).map((e) => 1 - strain(e.tired) * TIRED_SLOWS));
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
    return STATION_QUEUES[s].filter((id) => this.poolFor(id) === pool);
  }

  seconds(id, x) {
    if (id === "letters")
      return this.ai[0] === 2 ? AI_SECONDS.read : ELF_SECONDS.read[this.ai[0]];
    if (id === "orders") return this.makeSeconds(this.ai[1]);
    if (id === "check") return this.secondsPerCheck();
    if (id === "rework") return x.remake;
    return ELF_SECONDS.pass;
  }

  full(id) {
    return this.q[id].length >= QUEUES[id].limit;
  }

  // Why a queue cannot move its next parcel now, or null.
  queueBlocked(id) {
    const nobody =
      this.poolFor(id) === "elf" && !this.staff(QUEUES[id].station).length;
    switch (id) {
      case "letters":
        if (nobody) return "nobody reading";
        return this.full("orders") ? "the toy pile is full" : null;
      case "orders":
        if (this.incident?.rollingBack) return "rolling back the update";
        if (nobody) return "nobody making toys";
        if (this.full("check")) return "the checking pile is full";
        return this.full("pass") ? "the waiting-to-load pile is full" : null;
      default:
        if (nobody) return "no checkers here";
        // A caught gift goes to the remake pile, so checking waits while that pile is full.
        return id === "check" && this.full("rework")
          ? "the remake pile is full"
          : null;
    }
  }

  stationBlocked(s) {
    if (s === 0) return this.full("orders") ? "the toy pile is full" : null;
    if (s === 1)
      return this.full("check")
        ? "the checking pile is full"
        : this.full("pass")
          ? "the waiting-to-load pile is full"
          : null;
    return null;
  }

  // The trust of the elves at a station, on average: one fresh elf among drifting ones pulls the
  // station some way back towards looking properly.
  trustAt(s) {
    const team = this.staff(s);
    return team.length ? sum(team.map((e) => e.trust)) / team.length : 0;
  }

  // The station on Assist whose confirmers trust the AI most, as a run of clean drafts.
  confirmRun() {
    return Math.max(
      0,
      ...[0, 1].filter((s) => this.ai[s] === 1).map((s) => this.trustAt(s)),
    );
  }

  vigilance(run = this.trustAt(2)) {
    if (this.vig.trained) return VIGILANCE[0];
    return VIGILANCE.findLast((v) => run >= v.from);
  }

  secondsPerCheck() {
    return ELF_SECONDS.check * this.vigilance().speed;
  }

  confirmCatch(s) {
    return (
      Math.max(0, CONFIRM_CATCH - this.slipAt(s) * TIRED_MISSES) *
      (1 - this.vigilance(this.trustAt(s)).trust)
    );
  }

  checkCatch() {
    return Math.max(0.35, CHECK_CATCH - this.slipAt(2) * TIRED_MISSES);
  }

  suspect(x) {
    if (x.batch && this.incident?.known) return "batch";
    return x.unsure ? "unsure" : false;
  }

  // Risky: a big gift, or one the AI flagged or a known faulty update made. An unclear wish the
  // player has read is not flagged: a person decided it, so nobody doubts it further down the line.
  needsCheck(x, level = this.checking) {
    const sample = x.roll.sample < SAMPLE;
    const risky = x.w.big || this.suspect(x);
    return [sample, sample || Boolean(risky), true][level];
  }

  // Parcels from a known faulty update still in the workshop.
  marked() {
    return this.incident?.known
      ? [...this.q.check, ...this.q.pass].filter((x) => x.batch)
      : [];
  }

  pay(kind, amount) {
    this.spent[kind] += amount;
  }

  // Cost so far: everything spent, and the wrong gifts aboard at what they will cost.
  costSoFar() {
    return (
      sum(Object.values(this.spent)) +
      sum(this.aboard.filter((x) => x.wrong).map((x) => this.price(x)))
    );
  }

  // Whether the budget is gone: the cost so far has reached it.
  spentOut() {
    return this.costSoFar() >= COST_LIMIT;
  }

  // What is left of the budget, never below nothing.
  budgetLeft() {
    return Math.max(0, COST_LIMIT - this.costSoFar());
  }

  // The budget as the page shows it: what has gone, what is left, and whether it is running low.
  // Whole pounds, rounded down, so while the game runs there is always at least a pound left.
  budget() {
    const spent = Math.floor(this.costSoFar() + 1e-9);
    const left = Math.max(0, COST_LIMIT - spent);
    return {
      spent,
      limit: COST_LIMIT,
      left,
      low: left <= BUDGET_LOW * COST_LIMIT,
    };
  }

  price(x) {
    return x.w.big ? WRONG_PRICE.big : WRONG_PRICE.everyday;
  }

  // Seconds of play, said plainly, or "longer than the game" when they outlast it.
  span(seconds) {
    return seconds > this.duration - this.t
      ? "longer than the game"
      : `about ${Math.round(seconds)} s`;
  }

  timeLeft() {
    return Math.round(this.duration - this.t);
  }

  // Advances the game; nothing moves while the half-time choice is open.
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
    if (this.t < CLOSE) {
      this.inflow += dt * this.inflowAt(this.t);
      for (; this.inflow >= 1; this.inflow--) this.arrive();
    }
    this.timers(dt);
    // The game ends on the event that takes the last of the budget: nothing more is made, checked
    // or loaded after it, so the cost never passes the budget by more than that one event.
    for (const s of [0, 1, 2])
      for (const pool of ["elf", "ai"]) {
        this.run(s, pool, dt);
        if (this.spentOut()) return this.depart("budget");
      }
    this.assignWork();
    this.elvesTick(dt);
    this.noteDrift();
    this.watchPiles(dt);
    this.track(dt);
    // The budget comes first: a game out of money ends there, whatever the clock says.
    if (this.spentOut()) this.depart("budget");
    else if (this.t >= this.duration - 1e-9) this.depart();
    else if (this.half === 1 && this.t >= HALF_SECONDS - 1e-9) this.halfTime();
  }

  events() {
    for (const u of this.unclear)
      if (!u.sent && this.t >= u.at) {
        u.sent = true;
        this.arrive(u.w);
      }
    if (this.pendingTest && this.t >= this.pendingTest.at) this.finishTest();
    this.raiseIncident();
    this.passAnswered();
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
      if (this.spentOut()) return;
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
    else if (id === "orders") this.make(x);
    else if (id === "check" || id === "pass") {
      this.stats.passed++;
      if (id === "check") this.checkParcel(x);
      else this.load(x);
    } else this.remade(x);
  }

  // Remembers where a parcel went wrong, for the advice on the news line when it reaches the sleigh.
  wentWrong(x, station, cause, toy) {
    Object.assign(x, {
      wrong: true,
      wrongAt: station,
      wrongLevel: this.ai[station],
      cause,
      wrongToy: toy,
    });
  }

  // Counts one job, a letter read or a toy made, for the end screen's reliability figures: who did
  // it (the AI on Assist or Automate, since on Assist the draft is the AI's job and the elf's look
  // at it is a check) and whether it was done wrongly, before any confirmation or check.
  job(x, level, wrong) {
    const tally =
      this.reliability[x.w.big ? "big" : "everyday"][level ? "ai" : "elves"];
    tally.made++;
    if (wrong) tally.wrong++;
  }

  read(x) {
    const level = this.ai[0];
    if (level === 0) {
      const slip = x.roll.read < RISK.elfRead + this.slipAt(0) * RISK.perStrain;
      this.job(x, level, slip);
      if (slip) this.wentWrong(x, 0, this.slipCause(0), this.slipToy(x));
    } else {
      x.byAi = true;
      const draftWrong = x.roll.read < (x.w.big ? RISK.aiReadBig : RISK.aiRead);
      this.job(x, level, draftWrong);
      const confirmed =
        level === 1 && draftWrong && x.roll.confirm < this.confirmCatch(0);
      if (level === 1) this.confirmed(draftWrong, confirmed, 0);
      if (draftWrong && !confirmed)
        this.wentWrong(
          x,
          0,
          x.w.big ? "the AI on a big gift" : "the AI misread a letter",
          x.w.wrong,
        );
    }
    this.q.orders.push(x);
  }

  make(x) {
    const level = this.ai[1];
    const before = x.wrong;
    x.madeAt = this.t;
    x.batch = Boolean(this.incident?.fault) && level > 0;
    let faulty = false;
    let slip;
    if (level === 0) {
      slip = x.roll.make < RISK.elfMake + this.slipAt(1) * RISK.perStrain;
      this.job(x, level, slip);
      if (slip && !before)
        this.wentWrong(x, 1, this.slipCause(1), this.slipToy(x));
    } else {
      x.byAi = true;
      faulty = x.batch && x.roll.make < RISK.fault;
      const draftWrong =
        faulty || x.roll.make < (x.w.big ? RISK.aiMakeBig : RISK.aiMake);
      this.job(x, level, draftWrong);
      const confirmed =
        level === 1 && draftWrong && x.roll.confirm < this.confirmCatch(1);
      if (level === 1) this.confirmed(draftWrong, confirmed, 1);
      if (faulty) this.incident.trains++;
      if (confirmed && faulty) this.notice("watcher");
      if (confirmed) faulty = false;
      slip = draftWrong && !confirmed;
      if (slip && !before)
        this.wentWrong(
          x,
          1,
          x.w.big ? "the AI on a big gift" : "the AI made the wrong toy",
          x.w.wrong,
        );
      if (faulty) this.wentWrong(x, 1, "made by the faulty update", LOCOMOTIVE);
    }
    this.assured(x, "parcels");
    if (x.wrong) {
      this.assured(x, "wrongMade");
      this.assured(x, "wrongMadeCost", this.price(x));
    }
    this.stats.toys++;
    if (slip) this.stats.toyMistakes++;
    x.made = x.wrong ? x.wrongToy : x.w.wanted;
    // An absurd wrong toy joins the game's collection of blunders, caught or not.
    const absurd =
      x.wrong && !this.mixedUp(x) && BLUNDERS.get(slug(x.made.name));
    if (absurd)
      this.blunders.set(slug(x.made.name), {
        id: slug(x.made.name),
        name: absurd.name,
        icon: absurd.icon,
      });
    x.unsure =
      x.byAi &&
      x.roll.unsure <
        (x.wrong && !faulty && x.cause !== PICKED_WRONG
          ? UNSURE_IF_WRONG
          : UNSURE_IF_RIGHT);
    this.recent = [...this.recent.slice(-49), x];
    x.route = this.needsCheck(x) ? "check" : "pass";
    this.q[x.route].push(x);
    // A gift sent for a check is paid for as it joins the pile, whether or not a checker then looks
    // at it properly: the price of checking is the line, not the attention.
    if (x.route === "check") {
      this.pay("checking", PRICE.check);
      this.assured(x, "checkCost", PRICE.check);
      this.report.checking.money += PRICE.check;
    }
  }

  checkParcel(x) {
    const v = this.vigilance();
    if (x.byAi && x.roll.skip < v.skip) {
      this.vig.skipped++;
      this.assure.wavedCost[groupOf(x.w)] += PRICE.check;
      x.exit = "skipped";
      if (x.wrong) {
        this.stats.waved++;
        this.stats.wavedCost += this.price(x);
      }
      return this.load(x);
    }
    this.stats.checked++;
    this.assured(x, "checked");
    this.report.checking.checked++;
    x.exit = "checked";
    if (x.wrong && x.roll.catch >= this.checkCatch(x)) {
      x.slipped = true;
      x.slippedTired = this.slipAt(2) > 0;
      return this.load(x);
    }
    this.reveal(x);
    const text = x.wrong
      ? `Caught: ${this.madeAs(x)}. It goes back to be remade.`
      : `Checked: ${x.w.child}'s ${x.w.wanted.name} is right.`;
    this.say("checked", text, {
      check: this.copy(x, Math.round(this.secondsPerCheck() * 10) / 10, "elf"),
    });
    if (!x.wrong) {
      if (x.byAi) this.cleanParcel();
      return this.load(x);
    }
    this.caught(x);
    this.sharpen();
    this.sighting(x, "checker");
    this.toRework(x, ELF_SECONDS.remake);
  }

  // Whether a wrong gift is an elf's mix-up: another child's toy, not something the AI made up.
  mixedUp(x) {
    return x.cause === "a tired elf" || x.cause === "an elf's slip";
  }

  // What a wrong gift came out as, before anyone received it: "Rosa's chess set came out as a chest
  // of drawers", or for an elf's mix-up "Zara's doll in a pink dress was mixed up with a kite".
  madeAs(x) {
    return this.mixedUp(x)
      ? `${x.w.child}'s ${x.w.wanted.name} was mixed up with ${a(x.made.name)}`
      : `${x.w.child}'s ${x.w.wanted.name} came out as ${a(x.made.name)}`;
  }

  // A wrong gift on the sleigh in a few words: "Nina got a big rock, not a toy guitar".
  mixUp(x) {
    return `${x.w.child} got ${a(x.made.name)}, not ${a(x.w.wanted.name)}`;
  }

  // Checkers who keep finding the AI's gifts right start to trust it.
  cleanParcel() {
    for (const e of this.staff(2)) e.trust++;
  }

  // A caught mistake sharpens the checkers for a while; it does not wipe out a long clean stretch.
  sharpen() {
    for (const e of this.staff(2))
      e.trust = Math.max(0, e.trust - CATCH_SHARPENS);
  }

  // An elf on Assist at station s looked at an AI draft. Clean drafts build the same trust in the
  // elves who confirm them; a caught one sharpens them.
  confirmed(draftWrong, caught, s) {
    for (const e of this.staff(s))
      e.trust = draftWrong
        ? caught
          ? Math.max(0, e.trust - CATCH_SHARPENS)
          : e.trust
        : e.trust + CONFIRM_TRUST;
  }

  // The elf at station s who trusts the AI most, or null when the station is empty.
  mostTrusting(s) {
    return this.staff(s).sort((x, y) => y.trust - x.trust)[0] ?? null;
  }

  // Whether a drift prompt still holds: its elf is at that station and the station still drifts.
  driftHolds(d) {
    return Boolean(
      d &&
      this.elves[d.elf].station === d.station &&
      (d.station === 2 || this.ai[d.station] === 1) &&
      this.vigilance(this.trustAt(d.station)).state !== "careful",
    );
  }

  // The one drift prompt now, as the page shows it: the elf named stays named while it holds;
  // otherwise null. Null in the first DRIFT_QUIET seconds.
  drift() {
    return this.t >= DRIFT_QUIET && this.driftHolds(this.swapNow)
      ? { ...this.swapNow }
      : null;
  }

  // Keeps the drift prompt: the elf named stays while it holds, else the checkers first, then the
  // Assist station that trusts the AI most, and the elf there who trusts the AI most. A line names
  // that same elf when the prompt first names it, at most one line every DRIFT_GAP seconds.
  noteDrift() {
    if (this.t < DRIFT_QUIET) return;
    if (!this.driftHolds(this.swapNow)) {
      const stations = [2, ...[0, 1].filter((s) => this.ai[s] === 1)];
      const s = stations.find(
        (s) => this.vigilance(this.trustAt(s)).state !== "careful",
      );
      const e = s === undefined ? null : this.mostTrusting(s);
      this.swapNow = e && {
        elf: this.elves.indexOf(e),
        station: s,
        name: e.name,
      };
    }
    const d = this.swapNow;
    const id = d && `${d.elf}@${d.station}`;
    if (!d) this.driftSaid = null;
    if (!d || id === this.driftSaid) return;
    if (this.t - (this.newsAt.relaxed ?? -99) < DRIFT_GAP) return;
    this.driftSaid = id;
    const what =
      d.station === 2
        ? "trusting the AI and skipping checks"
        : "trusting the AI's drafts and missing mistakes";
    this.sayEvery(
      DRIFT_GAP,
      "relaxed",
      "relaxed",
      `${d.name} is ${what}. Send ${d.name} for cocoa or swap in another elf.`,
      { elf: d.elf, station: d.station },
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
            this.assure.recallCost += remakePrice([x]);
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
    this.pay("fixing", remakePrice([x]));
    this.load(x);
    if (job && !job.left) this.finishJob(job);
  }

  finishJob(job) {
    const seconds = this.t - job.since;
    const spent = job.money + job.remakes;
    const text = `${job.what}: ${job.caught} of ${job.count} were wrong, about ${money(job.avoided)} saved for ${money(spent)}.`;
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
    x.loadedAt = this.t;
    const { control, text, action } = this.advice(x);
    const cause = this.causeId(x);
    const waiting = this.waitingCause(x);
    // Remembered for the end lesson: this gift went aboard while its decision waited.
    if (waiting) x.waitedOn = waiting.id;
    // The same advice is not repeated within WRONG_LINE_GAP seconds: the gift still shows on the
    // sleigh, and the player is not asked again for what they were just asked.
    this.sayEvery(
      WRONG_LINE_GAP,
      `loaded:${action}`,
      "loaded",
      `Wrong gift: ${this.mixUp(x)}. ${text}`,
      {
        check: this.copy(x),
        cause,
        control,
        action,
        ...(waiting ? { caseId: waiting.id } : {}),
      },
    );
    this.sighting(x, "sleigh");
  }

  // The one thing the player can do now that would have stopped a wrong gift like this one: the
  // control to highlight, a line naming it and a short tag for the control. It names the true
  // cause: tiredness only when an elf at that station is tired, drift with the elf who trusts the
  // AI most. It never sends a station back to working by hand: that costs more right gifts than
  // the mistakes it saves. It asks for Assist only for a big gift, where the AI is poor: on
  // everyday gifts the AI is as reliable as a fresh elf, so a rare slip there asks for nothing.
  advice(x) {
    const checked = ["checked", "skipped"].includes(x.exit);
    const s = x.wrongAt;
    const tiredAt = (st) => this.staff(st).some((e) => e.tired > SLIPS_FROM);
    const say = (control, text, action) => ({ control, text, action });
    // The player read the wish wrongly: no setting at Letters made this mistake.
    const picked = x.cause === PICKED_WRONG;
    const swap = (st, crew, what) => {
      const e = this.mostTrusting(st);
      return e
        ? say(
            "cocoa",
            `Swap the ${crew}: ${e.name} had stopped ${what}.`,
            `Swap ${e.name}`,
          )
        : say(
            "cocoa",
            `Swap the ${crew}: they had stopped ${what}.`,
            "Swap an elf",
          );
    };
    const faulty = x.made === LOCOMOTIVE;
    // A slip as rare as a fresh elf's, on an everyday gift: nothing to change.
    const rare =
      !x.w.big &&
      !faulty &&
      !picked &&
      !this.suspect(x) &&
      x.cause !== "a tired elf";
    if (!checked && this.checking === 0 && this.needsCheck(x, 1))
      return say(
        "checking",
        x.w.big
          ? "Check the risky ones: big gifts need a person."
          : "Check the risky ones.",
        "Check more",
      );
    if (x.cause === "a tired elf")
      return say(
        "cocoa",
        "Tired elves mix gifts up: send them for cocoa.",
        "Rest tired elves",
      );
    if (x.w.big && !faulty && s !== null && this.ai[s] === 2 && !picked)
      return say(
        `ai:${s}`,
        `Big gifts need a person: put ${STATION_NAMES[s]} on Assist.`,
        "Assist for big gifts",
      );
    if (!checked) {
      // An elf on Assist let a wrong draft through: it trusted the AI, or it was tired.
      if (s !== null && this.ai[s] === 1 && !picked) {
        if (this.vigilance(this.trustAt(s)).state !== "careful")
          return swap(
            s,
            `elves at ${STATION_NAMES[s]}`,
            "checking the AI's drafts",
          );
        if (tiredAt(s))
          return say(
            "cocoa",
            "Tired elves miss the AI's slips: send them for cocoa.",
            "Rest tired elves",
          );
      }
      if (rare)
        return say(
          "checking",
          x.byAi
            ? "Keep going: on everyday gifts the AI slips as rarely as a fresh elf."
            : "Keep going: even a fresh elf mixes up 1 gift in 200.",
          "Keep going",
        );
      // A wish the player read wrongly: no check setting made this mistake.
      if (picked)
        return say(
          "decide",
          "Read the child's clue before you pick.",
          "Read the clue",
        );
      if (this.checking < 2)
        return say("checking", "Check all for a while.", "Check all for now");
    }
    if (x.exit === "skipped") return swap(2, "checkers", "checking properly");
    if (tiredAt(2))
      return say(
        "cocoa",
        "Rest the checkers: tired ones miss more.",
        "Rest the checkers",
      );
    if (picked)
      return say(
        "decide",
        "Read the child's clue before you pick.",
        "Read the clue",
      );
    return say(
      "checking",
      "Keep checking the risky ones: even sharp checkers miss 1 in 10.",
      "Keep checking",
    );
  }

  // The waiting decision whose answer would have stopped this wrong gift, or null: the faulty update
  // still running. A decision being carried out is no longer waiting.
  waitingCause(x) {
    return (
      this.cases.find(
        (c) =>
          c.kind === "incident" &&
          c.step === "source" &&
          this.causeId(x) === "faulty",
      ) ?? null
    );
  }

  reveal(x) {
    x.result ??= x.wrong ? "wrong" : "right";
  }

  heldByChecking(n) {
    this.assure.heldBy[this.checking === 2 ? "all" : "some"] += n;
  }

  // A wrong toy someone has now seen. Trains from a faulty update add up until someone says so.
  sighting(x, by) {
    if (x.made === LOCOMOTIVE && ++this.incident.seen >= NOTICE_AFTER)
      this.notice(by);
  }

  notice(by) {
    if (!this.incident || this.incident.known) return;
    this.incident.known = true;
    const who = {
      watcher: "an elf confirming toys",
      checker: "the checkers",
      sleigh: "the sleigh crew",
    }[by];
    this.say("noticed", `Faulty update: ${who} spotted full-sized trains.`, {
      by,
    });
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

  // Decisions: the unclear letters, the faulty update once it is known, and recalls when wrong
  // gifts pile up on the sleigh. One is open at a time; the others wait their turn.
  openCase(spec) {
    const c = {
      id: ++this.lastCaseId,
      step: null,
      parcels: [],
      opened: this.t,
      ...spec,
    };
    // Which reading of an unclear wish the card shows first, drawn per case from the seed and kept
    // apart from the game's random sequence, so the order never tells which is right.
    if (c.kind === "unclear")
      c.rightFirst = mix(this.firstSeed, c.parcels[0].id) % 2 === 0;
    this.cases.push(c);
    const order = (c) => CASE_ORDER[c.step] ?? 2;
    const [open, ...waiting] = this.cases;
    this.cases = [
      open,
      ...waiting.sort((x, y) => order(x) - order(y) || x.id - y.id),
    ];
    this.say("case", this.caseText(c), { caseId: c.id });
    return c;
  }

  // Raises the faulty update's decision once it is known.
  raiseIncident() {
    const inc = this.incident;
    if (!inc?.known || !inc.fault || inc.sourceRaised) return;
    inc.sourceRaised = true;
    this.openCase({ kind: "incident", step: "source" });
  }

  // Raises a recall decision, at most RECALLS a game and one at a time: when wrong gifts aboard pass
  // what the Few mistakes goal allows, for the excess; and the first time a wrong gift is aboard,
  // everyday or big, for that one gift, so most players meet the choice. The single gift's card
  // waits until it can be brought back: room on the remake pile, time before the sleigh leaves and
  // budget for it.
  raiseAboard() {
    if (
      this.end ||
      this.recallsRaised >= RECALLS ||
      this.cases.some((c) => c.step === "aboard")
    )
      return;
    const wrong = this.aboard.filter((x) => x.wrong);
    if (wrong.length > this.recallWrongAtAnswer && this.toRecall().length) {
      this.recallsRaised++;
      this.firstRecallOffered = true;
      this.openCase({ kind: "incident", step: "aboard" });
      return;
    }
    const first = !this.firstRecallOffered && wrong[0];
    if (
      !first ||
      this.full("rework") ||
      !this.recallFits([first]) ||
      recallPrice([first]) - countedPrice([first]) >= this.budgetLeft()
    )
      return;
    this.recallsRaised++;
    this.firstRecallOffered = true;
    this.openCase({ kind: "incident", step: "aboard", parcels: [first] });
  }

  // Whether more wrong gifts are aboard than the Few mistakes goal allows.
  overAllowed() {
    const right = this.goals().find((g) => g.id === "right");
    return right.now > right.need;
  }

  // The wrong gifts aboard beyond what the Few mistakes goal allows, the big ones first: the fewest
  // that bring the count back within the goal, and the dearest to leave aboard. Never more than the
  // remake pile has room for.
  toRecall() {
    const allowed = this.goals().find((g) => g.id === "right").need;
    const room = QUEUES.rework.limit - this.q.rework.length;
    const wrong = this.aboard
      .filter((x) => x.wrong)
      .sort((x, y) => y.w.big - x.w.big);
    return wrong.slice(0, Math.max(0, Math.min(wrong.length - allowed, room)));
  }

  // Whether the checkers can bring these gifts back and remake them before the sleigh leaves.
  recallFits(list) {
    return list.length * recallSeconds(list.length) <= this.timeLeft();
  }

  // The gifts a recall decision covers: the excess over the Few mistakes goal, or, for the card the
  // first wrong gift raised while the count is still within the goal, that one gift.
  recallList(c) {
    const x = c.parcels[0];
    if (!x || this.overAllowed()) return this.toRecall();
    return this.aboard.includes(x) && !this.full("rework") ? [x] : [];
  }

  // "4 wrong gifts are aboard: one more than Santa's name can take."
  reputationText() {
    const wrong = this.aboard.filter((x) => x.wrong).length;
    const over = wrong - this.goals().find((g) => g.id === "right").need;
    return `${plural(wrong, "wrong gift")} ${wrong === 1 ? "is" : "are"} aboard: ${over === 1 ? "one" : over} more than Santa's name can take.`;
  }

  // What happened, in one short sentence; the choices are the options' own labels.
  caseText(c) {
    const x = c.parcels[0];
    if (c.kind === "unclear")
      return `${x.w.child} writes: '${x.w.wish}' It could mean two things.`;
    if (c.step === "source")
      return "The faulty update is making full-sized trains.";
    // One wrong gift, the count still within the goal: "Jack got a full-sized galleon, not a toy pirate ship."
    return x && !this.overAllowed()
      ? `${this.mixUp(x)}.`
      : this.reputationText();
  }

  // Parcels an option could cover.
  affected(c) {
    if (c.step === "aboard") return this.recallList(c);
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
    const time = f("Time left", `${this.timeLeft()} s`);
    if (c.kind === "unclear")
      return [
        f(
          "Gift",
          x.w.big
            ? `${money(WRONG_PRICE.big)} if wrong, big gift`
            : `${money(WRONG_PRICE.everyday)} if wrong`,
          true,
        ),
        time,
      ];
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
    return [
      f("Wrong gifts aboard", this.aboard.filter((x) => x.wrong).length, true),
      f(
        "To bring back",
        `${list.length}${list.some((x) => x.w.big) ? `, ${list.filter((x) => x.w.big).length} big` : ""}`,
        true,
      ),
      f("In your cost now", money(countedPrice(list)), true),
      time,
    ];
  }

  options(c) {
    const list = this.affected(c);
    const n = list.length;
    const o = (id, label, seconds, money, risk, scope, why = null) => ({
      id,
      label,
      seconds: Math.round(seconds),
      money: Math.round(money),
      risk,
      scope,
      why,
    });
    // A recall's payment, what its gifts count in the cost now, and how much more the recall costs.
    const counted = countedPrice(list);
    const extra = recallPrice(list) - counted;
    let options;
    if (c.kind === "unclear")
      // The player reads the wish: one option for each reading, in the card's order.
      options = this.readings(c).map((r, i) =>
        o(`pick:${i}`, r.name, 0, 0, null, ""),
      );
    else if (c.step === "source")
      options = [
        o(
          "rollback",
          "Roll it back",
          ROLLBACK_SECONDS,
          PRICE.rollback,
          null,
          `back to ${this.toyRate(this.incident?.speedBefore)} toys a minute`,
        ),
        o(
          "keep",
          "Keep it running",
          0,
          0,
          RISK.fault,
          `about ${Math.round(this.toyRate() * RISK.fault)} trains a minute until the sleigh leaves`,
        ),
      ];
    else
      options = [
        {
          ...o(
            "bringBack",
            n === 1 ? "Bring it back" : `Bring ${n} back`,
            n * recallSeconds(n),
            recallPrice(list),
            null,
            `${money(extra)} more, checkers busy ${this.span(n * recallSeconds(n))}`,
            !n
              ? "the remake pile is full"
              : !this.staff(2).length
                ? "no elf at Checking"
                : !this.recallFits(list)
                  ? "no time before the sleigh leaves"
                  : null,
          ),
          instead: counted,
          extra,
        },
        {
          ...o(
            "leave",
            n === 1 ? "Leave it" : "Leave them",
            0,
            0,
            null,
            "nothing more",
          ),
          instead: 0,
          extra: 0,
        },
      ];
    const goal = c.step === "aboard" ? this.aboardGoals(list) : {};
    // Nothing the player chooses may end the game by itself: an option that would take the last of
    // the budget cannot be chosen. A recall adds only what it costs beyond the gifts' count aboard.
    const left = this.budgetLeft();
    return options.map((o) => {
      const adds = o.extra ?? o.money;
      const why = o.why ?? (adds > 0 && adds >= left ? NO_BUDGET : null);
      return { ...o, why, goal: goal[o.id] ?? null, available: !why };
    });
  }

  // What bringing the wrong gifts back or leaving them does to the goals, in a few words, so the
  // dearer recall shows what it buys: leaving keeps too many wrong gifts aboard for the mistakes
  // goal. A recall the budget cannot cover is not on offer, so it never costs the budget star.
  aboardGoals(list) {
    const [, right] = this.goals();
    const over = right.now > right.need;
    // Within the goal no star is at stake: the choice is whether this gift counts as a mistake.
    if (!over)
      return {
        bringBack: "No mistake counted",
        leave: `Counts as ${right.now} of ${right.need} mistakes`,
      };
    return {
      bringBack:
        over && right.now - list.length <= right.need
          ? `${right.name} star saved`
          : null,
      leave: over ? `${right.name} star lost` : null,
    };
  }

  // A letter the player has read joins the toy pile as soon as the pile has room, ahead of the
  // letters being read, and never above its limit.
  passAnswered() {
    while (this.answered.length && !this.full("orders"))
      this.q.orders.push(this.answered.shift());
  }

  resolve(caseId, optionId) {
    const c = this.cases[0];
    if (this.end || !c || c.id !== caseId) return false;
    const option = this.options(c).find((o) => o.id === optionId);
    if (!option?.available) return false;
    this.did();
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
    if (c.step === "aboard")
      this.recallWrongAtAnswer =
        optionId === "bringBack"
          ? this.aboard.filter((p) => p.wrong).length - this.affected(c).length
          : this.aboard.filter((p) => p.wrong).length;
    if (c.kind === "unclear") {
      // The player has read the wish: the letter goes on to be made as the reading they picked. The
      // line does not say whether the pick was right; a check or the sleigh shows that.
      const reading = this.readings(c)[Number(optionId.slice(5))];
      const right = reading.name === x.w.wanted.name;
      this.used.picked++;
      if (right) this.used.pickedRight++;
      else this.wentWrong(x, 0, PICKED_WRONG, x.w.wrong);
      this.answered.push(x);
      this.passAnswered();
      text = `${x.w.child}'s letter goes on: ${a(reading.name)}.`;
      outcome = { parcels: 1 };
    } else
      this.closeIncident(c, optionId, (t, o) => ((text = t), (outcome = o)));
    const kept = Object.fromEntries(
      Object.entries(outcome).map(([k, n]) => [k, Math.round(n)]),
    );
    this.say("resolved", text, { ...extra, outcome: kept });
    this.consequence("case", text, {
      seconds: outcome.seconds,
      money: outcome.money,
      waiting: optionId === "leave" ? outcome.parcels : undefined,
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
      };
    this.say("update", "Update installed on the toy machine.");
  }

  closeIncident(c, optionId, tell) {
    const inc = this.incident;
    const list = this.affected(c);
    const n = list.length;
    switch (optionId) {
      case "rollback":
        inc.rollingBack = ROLLBACK_SECONDS;
        this.used.rolledBack = true;
        this.pay("fixing", PRICE.rollback);
        tell(
          `Rolling back for ${money(PRICE.rollback)}: the toy machine stops ${ROLLBACK_SECONDS} s.`,
          { seconds: ROLLBACK_SECONDS, money: PRICE.rollback },
        );
        break;
      case "keep":
        tell(
          `Kept running: about ${Math.round(this.toyRate() * RISK.fault)} trains a minute.`,
          {},
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
          money: recallPrice(list) - remakePrice(list),
          remakes: remakePrice(list),
          since: this.t,
        };
        list.forEach((x) => {
          // The summary counts a recall against too little checking only for a gift that went out unchecked.
          x.recalled = ["checked", "skipped"].includes(x.exit)
            ? "checked"
            : "unchecked";
          if (x.recalled === "unchecked")
            this.assure.recallCost +=
              ((recallPrice(list) - remakePrice(list)) * this.price(x)) /
              countedPrice(list);
          this.toRework(x, recallSeconds(n), job);
        });
        this.pay("fixing", recallPrice(list) - remakePrice(list));
        this.recalled.count += n;
        this.recalled.cost += recallPrice(list);
        this.say(
          "recalled",
          `${plural(n, "wrong gift")} brought back to be remade.`,
          { count: n },
        );
        tell(
          `${does(n, "wrong gift", "comes", "come")} back to be remade for ${money(recallPrice(list))}, ${money(recallPrice(list) - countedPrice(list))} more than leaving: checkers busy ${this.span(n * recallSeconds(n))}.`,
          {
            seconds: n * recallSeconds(n),
            money: recallPrice(list),
            parcels: n,
          },
        );
        break;
      }
      default:
        tell(
          `${does(n, "wrong gift", "stays", "stay")} aboard: ${n === 1 ? "its" : "their"} ${money(countedPrice(list))} stays in your cost.`,
          { money: countedPrice(list), parcels: n },
        );
    }
  }

  timers(dt) {
    const inc = this.incident;
    if (
      inc?.rollingBack > 0 &&
      (inc.rollingBack = countDown(inc.rollingBack, dt)) === 0
    ) {
      inc.fault = false;
      this.machineSpeed = inc.speedBefore;
      this.say("rolledBack", "Rollback done: proper toys again.");
    }
  }

  // What each elf is doing now: elves at a station take turns over the queues that have work.
  assignWork() {
    for (const s of [0, 1, 2]) {
      const team = this.staff(s);
      const open = this.poolQueues(s, "elf").filter(
        (id) => this.q[id].length && !this.queueBlocked(id),
      );
      team.forEach((e, i) => {
        if (!open.length) e.doing = "nothing to do";
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

  // Counts an elf's time at a station towards the game's tiredness figures.
  tiredTally(s, dt, lost) {
    this.stats.tiredWork[s] += dt;
    this.stats.tiredLost[s] += dt * lost;
  }

  elvesTick(dt) {
    this.elves.forEach((e, i) => {
      if (e.station === BREAK && e.rest > 0) this.tiredTally(e.home, dt, 1);
      else if (e.station < BREAK && e.doing !== "nothing to do")
        this.tiredTally(
          e.station,
          dt,
          Math.min(1, strain(e.tired) * TIRED_SLOWS),
        );
      if (e.station === BREAK) {
        e.tired = Math.max(
          0,
          e.tired - dt * (e.rest > 0 ? BURNOUT_RECOVERY : COCOA_RECOVERY),
        );
        if (e.rest > 0 && (e.rest = countDown(e.rest, dt)) === 0)
          e.station = e.home;
        // A cocoa break ends by itself once the elf is fully rested, so nobody is left on a break.
        else if (!e.rest && !e.tired && this.t - e.breakAt >= COCOA_LEAST)
          this.backFromCocoa(i);
        return;
      }
      const s = e.station;
      const ids = STATION_QUEUES[s].filter((id) => id !== "rework");
      const pressure =
        sum(ids.map((id) => this.q[id].length)) /
        sum(ids.map((id) => QUEUES[id].limit));
      const effort =
        WORK_STRAIN +
        Math.max(0, pressure - 0.25) * PRESSURE_STRAIN +
        (s === 2 ? CHECKER_STRAIN + 0.1 * this.checking : 0);
      const gain = e.doing === "nothing to do" ? -0.12 : effort;
      e.tired = Math.min(100, Math.max(0, e.tired + dt * gain));
      if (e.tired < BURNOUT_AT) return;
      Object.assign(e, {
        home: s,
        station: BREAK,
        rest: BURNOUT_SECONDS,
        trust: 0,
        breakAt: this.t,
      });
      this.stats.burnouts++;
      if (s === 2) this.stats.checkerBurnouts++;
      this.say("tired", `${e.name} burnt out: off for a long cocoa break.`, {
        elf: i,
      });
    });
  }

  track(dt) {
    this.pay("ai", dt * (AI_PRICE[this.ai[0]] + AI_PRICE[this.ai[1]]));
    this.stats.ai[this.ai[0]] += dt;
    this.stats.ai[this.ai[1]] += dt;
    if (this.ai.includes(1)) this.stats.assist += dt;
    this.stats.checking[this.checking] += dt;
    if (this.full("check")) this.stats.jammed += dt;
    const inc = this.incident;
    if (inc?.fault && inc.known && !inc.rollingBack && this.ai[1] > 0)
      this.stats.faulty += dt;
    this.raiseAboard();
    if (!this.lowSaid && this.budget().low) {
      this.lowSaid = true;
      this.say("budgetLow", "Budget running low.", {
        left: this.budget().left,
      });
    }
    if (this.stationBlocked(0))
      this.sayEvery(
        10,
        "blocked0",
        "blocked",
        "Letters has stopped: the toy pile is full. Move an elf to Toys.",
        { station: 0 },
      );
    if (this.stationBlocked(1))
      this.sayEvery(
        10,
        "blocked1",
        "blocked",
        `Toys has stopped: the ${this.full("check") ? "checking" : "waiting-to-load"} pile is full. Move an elf to Checking.`,
        { station: 1 },
      );
    const count = this.unreportedLost;
    if (
      count &&
      this.sayEvery(
        5,
        "lost",
        "lost",
        `Letter pile full: ${plural(count, "letter")} lost.`,
        { count },
      )
    )
      this.unreportedLost = 0;
    if (this.t - this.report.checking.since >= CONSEQUENCE_GAP)
      this.reportChecking();
    // Averaged over about 15 seconds; too early to judge in the first seconds; re-armed once comfortably back.
    const now = this.estimate();
    this.projected += (now.projected - this.projected) * Math.min(1, dt / 15);
    this.slowest = now.slowest;
    if (this.slowest !== null) this.stats.holding[this.slowest] += dt;
    const pace = this.pace();
    // Said only when a station whose elves do the work is holding things up, so the line always
    // names a move to make: an elf adds nothing at a station on Automate.
    if (
      this.t >= 20 &&
      pace.behind &&
      pace.slowest !== null &&
      !(pace.slowest < 2 && this.ai[pace.slowest] === 2) &&
      !this.behindNoted
    ) {
      this.behindNoted = true;
      this.say(
        "behind",
        `${STATION_NAMES[pace.slowest]} is holding things up. Move an elf there.`,
        { station: pace.slowest },
      );
    }
    if (pace.projected >= this.target + 5) this.behindNoted = false;
  }

  reportChecking() {
    const r = this.report.checking;
    const seconds = this.t - r.since;
    if (r.checked && seconds >= 5) {
      const text = `Checking ${["a few", "the risky ones", "all"][this.checking]}, last ${Math.round(seconds)} s: ${r.caught} of ${r.checked} wrong, about ${money(r.avoided)} saved for ${money(r.money)}.`;
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
        this.say("cleared", `${PILE_NAMES[id]} clear.`, { queue: id });
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
          : `${n} right gifts so far this Christmas.`,
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

  // More hands or more AI at a station whose elves do the work: the AI while they work by hand, else
  // another elf. Never asked of a station on Automate, where the machine sets the pace.
  helpAt(s) {
    return s < 2 && this.ai[s] === 0 && this.staff(s).length >= 3
      ? { station: s, control: `ai${s}`, text: "try the AI" }
      : { station: s, control: "elves", text: "needs another elf" };
  }

  // When the line has stopped or a pile is full, the one control that would get it moving: the
  // station furthest along that holds the rest up. Null while a rollback holds the toys.
  unblock() {
    const waiting = (s) =>
      STATION_QUEUES[s].some((id) => id !== "rework" && this.q[id].length);
    if (
      this.full("check") ||
      this.full("pass") ||
      (!this.staff(2).length && waiting(2))
    )
      return this.checking === 2 && this.staff(2).length >= 3
        ? { station: 2, control: "checking", text: "check fewer" }
        : this.helpAt(2);
    if (this.incident?.rollingBack) return null;
    for (const s of [1, 0]) {
      const full = this.full(STATION_QUEUES[s][0]);
      // On Automate the machine works alone at its own speed: another elf adds nothing, and its
      // full pile is what holds the station before it, so there is no control to name.
      if (this.ai[s] === 2) {
        if (full) return null;
        continue;
      }
      if (full || (!this.staff(s).length && waiting(s))) return this.helpAt(s);
    }
    return null;
  }

  // More hands or AI for the station whose pile is growing fastest towards full, or null. A pile
  // at a station on Automate, or one held up by a full pile further along, is left out: another elf
  // would not shrink it.
  growingPile() {
    const helped = (s) =>
      !(s < 2 && this.ai[s] === 2) && !this.stationBlocked(s);
    const piles = ["letters", "orders", "check"].filter(
      (id) =>
        this.trend(id) === "growing" &&
        this.q[id].length >= QUEUES[id].limit * 0.3 &&
        helped(QUEUES[id].station),
    );
    piles.sort(
      (x, y) =>
        this.q[y].length / QUEUES[y].limit - this.q[x].length / QUEUES[x].limit,
    );
    return piles.length ? this.helpAt(QUEUES[piles[0]].station) : null;
  }

  // The station another elf would help now, as focus() would name it, or null. A need one returning
  // elf has just gone to is left alone for NEED_CLAIM seconds, so two elves rested together do not
  // both answer it.
  elfNeed() {
    const need = this.unblock() ?? this.growingPile();
    if (need?.control !== "elves") return null;
    const s = need.station;
    return this.t - (this.claimed[s] ?? -99) < NEED_CLAIM ? null : s;
  }

  // A fully rested elf goes back to the station it came from, unless that station clearly does not
  // need it and another one does; it says where it went.
  backFromCocoa(i) {
    const e = this.elves[i];
    const need = this.elfNeed();
    const away = need !== null && need !== e.home && this.homeSpares(e.home);
    e.station = away ? need : e.home;
    if (away) this.claimed[need] = this.t;
    const where = STATION_NAMES[e.station];
    this.say(
      "rested",
      away
        ? `${e.name} is rested and goes to ${where}, which needs an elf.`
        : `${e.name} is rested and back at ${where}.`,
      { elf: i, station: e.station },
    );
  }

  // Whether station h clearly does not need an elf back: it works on Automate, or it keeps two
  // elves or more and its piles are under half full; checking never while its pile is growing.
  homeSpares(h) {
    if (h < 2 && this.ai[h] === 2) return true;
    const calm = STATION_QUEUES[h]
      .filter((id) => id !== "rework")
      .every((id) => this.q[id].length < QUEUES[id].limit / 2);
    return (
      this.staff(h).length >= 2 &&
      calm &&
      (h !== 2 || this.trend("check") !== "growing")
    );
  }

  // The one thing that most needs the player now, in four words at most, or null. A stopped line
  // comes first, since nothing else counts while it stands.
  focus() {
    const stuck = this.unblock();
    if (stuck) return stuck;
    const tired = this.elves
      .filter((e) => e.station < BREAK && e.tired >= 70)
      .sort((x, y) => y.tired - x.tired)[0];
    if (tired)
      return { station: BREAK, control: "cocoa", text: `rest ${tired.name}` };
    const growing = this.growingPile();
    if (growing) return growing;
    const recentWrong = this.aboard.filter(
      (x) => x.wrong && this.t - x.loadedAt <= 30,
    ).length;
    // Never "check more" while checking is the bottleneck: more checks would slow the line further.
    if (recentWrong >= 2 && this.checking === 0 && this.slowest !== 2)
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
      return [SAMPLE, SAMPLE + this.bigShare(), 1][level];
    return (
      this.recent.filter((x) => this.needsCheck(x, level)).length /
      this.recent.length
    );
  }

  // Parcels a second each station manages at its steady speed now.
  rates() {
    const reading =
      this.ai[0] === 2
        ? 1 / AI_SECONDS.read
        : this.power(0) / ELF_SECONDS.read[this.ai[0]];
    const making =
      (this.ai[1] === 2 ? 1 : this.power(1)) / this.makeSeconds(this.ai[1]);
    const checked = this.checkShare();
    const dispatch =
      this.power(2) /
      (checked * this.secondsPerCheck() +
        (1 - checked) * ELF_SECONDS.pass +
        0.05 * ELF_SECONDS.remake);
    return [reading, making, dispatch];
  }

  // The station holding gifts back: the furthest along the line whose own pile is filling up. A pile
  // also fills when the station after it is stopped, so the furthest one is where the line is stuck.
  // null when no pile is filling, because letters are not arriving faster than the workshop works.
  holdingUp() {
    const filling = (id) =>
      this.q[id].length >= QUEUES[id].limit / 2 ||
      (this.trend(id) === "growing" &&
        this.q[id].length >= QUEUES[id].limit / 4);
    const s = [2, 1, 0].find((s) =>
      STATION_QUEUES[s].some((id) => id !== "rework" && filling(id)),
    );
    return s ?? null;
  }

  // Right gifts expected at departure if every station keeps its current speed.
  estimate() {
    const rates = this.rates();
    const slowest = this.holdingUp();
    const letters = this.lettersBetween(this.t, CLOSE);
    const supply =
      sum(Object.values(this.q).map((q) => q.length)) +
      this.answered.length +
      letters;
    const right = this.rightSoFar();
    const rightShare =
      this.aboard.length >= 10 ? right / this.aboard.length : 0.95;
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
    const fault = this.incident?.known && this.incident.fault;
    const ai = (s) => {
      const kind = s === 0 ? "read" : "make";
      const perMinute = [0, 1, 2].map((level) =>
        level === 2
          ? (60 / AI_SECONDS[kind]) * (s === 1 ? this.machineSpeed : 1)
          : (this.power(s) * 60) /
            (s === 0 ? ELF_SECONDS.read[level] : this.makeSeconds(level)),
      );
      return LEVELS.map((name, level) => {
        const who = [
          "Elves do it",
          "AI drafts, an elf confirms each",
          "AI works alone",
        ][level];
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
                ? `big gifts: ${oneIn(RISK.aiReadBig).replace("about ", "")} misread`
                : fault
                  ? "faulty update: same wrong toy"
                  : `big gifts: ${oneIn(RISK.aiMakeBig).replace("about ", "")} wrong`;
        // How often a job goes wrong at this level, by kind of gift, figures first: the same for an
        // elf by hand on both kinds, and for the AI as good as a fresh elf on everyday gifts and poor
        // on big ones. On Assist a fresh elf catches most of the AI's wrong drafts.
        const elf = s === 0 ? RISK.elfRead : RISK.elfMake;
        const aiBig = s === 0 ? RISK.aiReadBig : RISK.aiMakeBig;
        const word = s === 0 ? "misread" : "wrong";
        const everyday =
          level === 0
            ? `${oneIn(elf)} ${word} while fresh`
            : `${oneIn(s === 0 ? RISK.aiRead : RISK.aiMake)} ${word}, same as a fresh elf`;
        const big =
          level === 0
            ? `${oneIn(elf)} ${word} while fresh`
            : level === 1
              ? `${oneIn(aiBig)} drafts ${word}, an elf catches most`
              : `${oneIn(aiBig)} ${word}`;
        return {
          name,
          who,
          speed,
          risk,
          everyday,
          big,
          perMinute: Math.round(perMinute[level]),
          costPerMinute: Math.round(AI_PRICE[level] * 60),
        };
      });
    };
    const checking = [
      ["A few", "elves check a few at random"],
      ["The risky ones", "elves check big gifts and the ones the AI flagged"],
      ["All", "elves check every gift"],
    ].map(([name, sends], level) => ({
      name,
      sends,
      per100: Math.round(this.checkShare(level) * 100),
    }));
    return { ai0: ai(0), ai1: ai(1), checking };
  }

  // The sleigh leaves at the end of the game, or the moment the budget runs out: its gifts are
  // delivered and cannot come back. When the clock ends the game, gifts still in the checking pile
  // are held back by checking. When the budget ends it, what was paid stays paid, work not finished
  // is not charged, and gifts still in the workshop (those being remade after a recall among them)
  // miss the sleigh without counting against the checkers. An unclear letter still waiting for its
  // decision is lost either way.
  depart(reason = "time") {
    const wrongGifts = this.aboard.filter((x) => x.wrong);
    for (const x of wrongGifts) {
      this.assured(x, "shipped");
      this.assured(x, "shippedCost", this.price(x));
      // Unchecked: never sent for a check. One sent for a check that
      // relaxed checkers waved through counts against the checkers, not against how much was checked.
      if (!["checked", "skipped"].includes(x.exit)) {
        this.assured(x, "shippedUnchecked");
        this.assured(x, "shippedUncheckedCost", this.price(x));
      }
    }
    // Gifts held up by checking: waiting in the checking pile, or toy orders stuck behind it while it is full.
    const held =
      reason === "budget"
        ? 0
        : this.q.check.length + (this.full("check") ? this.q.orders.length : 0);
    this.assure.held += held;
    this.heldByChecking(held);
    this.undecided = this.cases.filter((c) => c.kind === "unclear").length;
    this.lost += this.undecided;
    this.finish(reason);
    const tally = `${this.end.right} right, ${this.end.wrong} wrong, ${plural(this.end.stars, "star")}`;
    this.say(
      "departed",
      reason === "budget"
        ? `Out of money. The sleigh leaves now: ${tally}.`
        : `The sleigh is away: ${tally}.`,
      {
        right: this.end.right,
        wrong: this.end.wrong,
        target: TARGET,
        stars: this.end.stars,
        reason,
      },
    );
  }

  // Where most of the budget went, in one sentence, for a game the budget ended. Wrong gifts and
  // putting them right (recalls, remakes, a rollback) are weighed together against the checks and
  // against running the AI and the half-time change. When wrong gifts win, the sentence names the
  // part that made up half of them or more: the wrong big gifts aboard, or the faulty update's trains.
  whereMoneyWent(costs) {
    const wrong = this.aboard.filter((x) => x.wrong);
    const part = (test) => sum(wrong.filter(test).map((x) => this.price(x)));
    const trains = part((x) => x.made === LOCOMOTIVE);
    const big = part((x) => x.made !== LOCOMOTIVE && x.w.big);
    const mistakes = costs.mistakes + costs.fixing;
    const [what, amount] = [
      [
        big * 2 >= mistakes
          ? ["Wrong big gifts", big]
          : trains * 2 >= mistakes
            ? ["The faulty update's trains", trains]
            : ["Wrong gifts and putting them right", mistakes],
        mistakes,
      ],
      [["Checks", costs.checking], costs.checking],
      [["Running the AI", costs.ai], costs.ai],
      [["The half-time change", costs.halfTime], costs.halfTime],
    ].sort((p, q) => q[1] - p[1])[0][0];
    return `${what} took ${money(amount)} of your ${money(COST_LIMIT)} budget.`;
  }

  finish(reason = "time") {
    this.reportChecking();
    const right = this.rightSoFar();
    const wrongGifts = this.aboard.filter((x) => x.wrong);
    const mistakes = sum(wrongGifts.map((x) => this.price(x)));
    const total = sum(Object.values(this.spent)) + mistakes;
    const costs = {
      ...this.spent,
      mistakes,
      prevented: this.stats.prevented,
      total,
    };
    for (const k in costs) costs[k] = Math.round(costs[k]);
    // The total in whole pounds, rounded down as the budget shows it.
    costs.total = Math.floor(total + 1e-9);
    costs.limit = COST_LIMIT;
    const goals = this.goals();
    const stars = goals.filter((g) => g.met).length;
    // The dial measures checking by its own figures. The lesson names the loss that cost a goal and
    // never contradicts the dial; the headline names the same loss.
    // A game the budget ended is cut short: gifts it did not reach are not blamed on checking or on
    // full piles, and its one lesson is where the money went.
    const broke = reason === "budget";
    const biggest = broke
      ? mistakes > 0
        ? "wrong"
        : null
      : this.biggestLoss(right, mistakes, true);
    const assurance = this.assurance(biggest, stars);
    const { loss, ...lesson } = broke
      ? {
          title: "Out of money",
          text: this.whereMoneyWent(costs),
          loss: "cost",
        }
      : this.lesson(
          stars,
          right,
          costs,
          biggest ?? this.biggestLoss(right, mistakes),
          assurance.verdict,
        );
    // A checking lesson without words of its own takes the advice for its verdict.
    const verdictOf = {
      "Too little checking": "too little",
      "Too much checking": "too much",
      "Checking was the bottleneck": "bottleneck",
    };
    if (!lesson.text && verdictOf[lesson.title])
      lesson.text = CHECKING_ADVICE[verdictOf[lesson.title]];
    this.end = {
      stars,
      goals,
      right,
      wrong: wrongGifts.length,
      lost: this.lost,
      costs,
      headline: this.headline(stars, loss, goals, assurance.verdict),
      lesson,
      assurance,
      checkingAnswer: this.checkingAnswer(assurance, stars),
      practices: this.practices(assurance),
      causes: this.causes(wrongGifts, assurance.verdict),
      blunders: [...this.blunders.values()].map((b) => ({ ...b })),
      blunderTotal: BLUNDER_TOTAL,
      blunderIds: [...BLUNDERS.keys()],
      // Why the game ended, "time" or "budget", and the seconds that were left when it did.
      reason,
      leftAt: Math.max(0, Math.round(this.duration - this.t)),
      reliability: JSON.parse(JSON.stringify(this.reliability)),
    };
  }

  // A few words for the end, naming the same loss as the lesson.
  // It praises care only when care showed: not with too many wrong gifts or too few checks.
  headline(stars, loss, goals, verdict) {
    if (stars === 3) return "Christmas, carefully delivered.";
    const met = (id) => goals.find((g) => g.id === id).met;
    const tooMany = this.aboard.filter((x) => x.wrong).length > WRONG_ALLOWED;
    return {
      slow: tooMany
        ? "Slow, and wrong."
        : verdict === "too little"
          ? "Slow, with too few checks."
          : "Careful, but slow.",
      tired: "Too tired to keep up.",
      wrong: met("full")
        ? "Fast, but wrong."
        : met("right")
          ? "Wrong gifts cost too much."
          : "Too many wrong gifts.",
      cost: "Out of money.",
      none: "Nearly there.",
    }[loss];
  }

  // Whether tiredness took TIRED_SHARE or more of station s's working time this game.
  tiredAt(s) {
    return this.stats.tiredLost[s] >= TIRED_SHARE * this.stats.tiredWork[s];
  }

  // The station that held gifts back for longest.
  longestHolding() {
    return this.stats.holding.indexOf(Math.max(...this.stats.holding));
  }

  // The largest of the game's losses, in its own money, or null when there were none.
  //   wrong: what the wrong gifts delivered cost.
  //   over: LATE_PRICE for each gift the checking pile held back while every parcel was checked.
  //   held: the same while only some parcels were checked, so too few or too tired checkers.
  //   lost: LATE_PRICE for each other letter lost to a full pile.
  // Held and lost gifts count only when the sleigh fell short of the target, because only then did
  // they cost a gift. With mattered, only the losses that mattered: held gifts and lost letters
  // when the gifts they could have cost (no more than the shortfall) reach LATE_SHARE of the
  // target, and wrong gifts when the mistakes goal was missed or they cost WRONG_SHARE of the limit.
  // The headline, the lesson and the assurance dial all follow this one comparison.
  biggestLoss(right, mistakes, mattered = false) {
    const a = this.assure;
    const short = Math.max(0, TARGET - right);
    const late = (n) => n * LATE_PRICE * (short > 0);
    const enough = (n) => Math.min(n, short) >= LATE_SHARE * TARGET;
    const lost = this.lost - a.lostAtCheck;
    const wrongMattered =
      !this.goals().find((g) => g.id === "right").met ||
      mistakes >= WRONG_SHARE * COST_LIMIT;
    const loss = {
      wrong: !mattered || wrongMattered ? mistakes : 0,
      over: late(a.heldBy.all),
      held: enough(a.heldBy.some) ? late(a.heldBy.some) : 0,
      lost: !mattered || enough(lost) ? late(lost) : 0,
    };
    const [id, amount] = Object.entries(loss).sort((p, q) => q[1] - p[1])[0];
    return amount > 0 ? id : null;
  }

  // The real-world practices the game's actions stand for, each with what this player did. The page
  // draws one tile per practice and one line per action under it.
  practices(assurance) {
    const st = this.stats;
    const u = this.used;
    const inc = this.incident;
    const letters = u.picked + this.undecided;
    const p = (id, name, actions, note = null) => ({
      id,
      name,
      used: actions.some((x) => x.used),
      actions,
      note,
    });
    const act = (id, label, used, figure) => ({ id, label, used, figure });
    return [
      p("human-in-loop", "Human in the loop", [
        act(
          "assist",
          "Elves confirmed the AI's drafts",
          st.assist >= USED_FOR,
          `Assist for ${Math.round(st.assist)} of ${Math.round(this.t)} s`,
        ),
      ]),
      p(
        "risk-check",
        "Risk-based checking",
        [
          act(
            "risky",
            "Checked the risky ones",
            st.checking[1] >= USED_FOR,
            `${Math.round(st.checking[1])} s, ${assurance.caught} of ${plural(assurance.wrongMade, "mistake")} caught`,
          ),
        ],
        this.recalled.count
          ? `Wrong gifts cost Santa trust: ${assurance.shipped} reached children, and ${this.recalled.count} more were brought back in time.`
          : `Wrong gifts cost Santa trust: ${assurance.shipped} reached children.`,
      ),
      p("escalate", "Ask a person when unsure", [
        act(
          "decided",
          "Read the unclear wishes yourself",
          u.picked > 0,
          `decided ${u.picked} of ${letters}, ${u.pickedRight} right${this.undecided ? `, ${this.undecided} left unanswered` : ""}`,
        ),
      ]),
      p("test-release", "Test before release, keep a way back", [
        act(
          "tested",
          "Tested the update first",
          u.tested,
          u.tested
            ? `the test ${this.testResult}`
            : this.lastInstallAt === null
              ? "no update installed"
              : "not tested: installed straight away",
        ),
        act(
          "rolledBack",
          "Rolled back a faulty update",
          u.rolledBack,
          u.rolledBack
            ? `rolled back after ${plural(inc.trains, "train")}`
            : inc
              ? `ran to the end: ${plural(inc.trains, "train")}`
              : "no faulty update",
        ),
        act(
          "recalled",
          "Brought wrong gifts back off the sleigh",
          this.recalled.count > 0,
          this.recalled.count
            ? `${plural(this.recalled.count, "wrong gift")} brought back for ${money(this.recalled.cost)}`
            : this.recallsRaised
              ? "left aboard"
              : "not needed",
        ),
      ]),
      p("oversight", "Keep human oversight sharp", [
        act(
          "trained",
          "Trained the checkers not to just defer to AI",
          u.trained,
          `${plural(this.vig.skipped, "check")} skipped`,
        ),
        act(
          "rested",
          "Gave the elves a cocoa break",
          u.cocoa > 0 || u.restAll,
          `${plural(u.cocoa, "cocoa break")}${u.restAll ? " and cocoa for everyone" : ""}, ${plural(st.burnouts, "burnout")}`,
        ),
      ]),
    ];
  }

  // One sentence answering "Was checking worth it?" from the assurance figures. Its second half
  // follows the dial's verdict, so the two never disagree: only "too little" asks for more checks,
  // only "too much" names checks that did not pay, and a bottleneck names the gifts the pile held back.
  checkingAnswer(a, stars) {
    const checked = sum(a.groups.map((g) => g.checked));
    const checkCost = sum(a.groups.map((g) => g.checkCost));
    const unchecked = sum(a.groups.map((g) => g.shippedUncheckedCost));
    const wrong = this.aboard.filter((x) => x.wrong).length;
    const paid = a.prevented >= checkCost;
    const exposed = a.groups
      .filter((g) => g.verdict === "left exposed")
      .sort((p, q) => q.shippedUncheckedCost - p.shippedUncheckedCost)[0];
    const wasted = a.groups.find(
      (g) => g.verdict === "cost more than it saved" && g.checkCost >= 20,
    );
    const on = (g) => (g ? ` on ${g.name.toLowerCase()}` : "");
    const stopped = `${money(checkCost)} of checks stopped ${paid ? "" : "only "}about ${money(a.prevented)} of wrong gifts`;
    if (a.verdict === "bottleneck")
      return `Not as run: ${money(checkCost)} of checks stopped about ${money(a.prevented)} of wrong gifts, but the pile held back ${plural(a.held, "gift")}.`;
    if (a.verdict === "too little")
      return !checked
        ? `Too few: nothing was checked, and the wrong gifts that went out unchecked cost ${money(unchecked)}.`
        : paid
          ? `Yes, but too few: ${stopped}, and more checks${on(exposed)} would have paid too.`
          : `Too few: ${stopped}. More checks${on(exposed)} would have paid.`;
    // Wrong gifts that went past trusting or tired checkers: the checks were not done properly.
    const waved = this.aboard.filter(
      (x) => x.wrong && x.exit === "skipped",
    ).length;
    const missed = this.aboard.filter((x) => x.wrong && x.slippedTired).length;
    if (wrong > WRONG_ALLOWED && waved + missed > 0) {
      const how = [
        waved &&
          `trusting checkers waved ${plural(waved, "wrong gift")} through`,
        missed && `tired ones missed ${plural(missed, "wrong gift")}`,
      ]
        .filter(Boolean)
        .join(" and ")
        .replace(/^tired ones/, "tired checkers");
      return `Not as run: ${money(checkCost)} of checks stopped about ${money(a.prevented)} of wrong gifts, because ${how}.`;
    }
    if (a.verdict === "too much")
      return paid
        ? `Mostly: ${stopped}, but the checks${on(wasted) || " on the rest"} cost more than they saved.`
        : `No: ${stopped}. Fewer checks would have done.`;
    if (!checked)
      return "Nothing was checked, and no wrong gift went out unchecked.";
    return paid
      ? `Yes: ${stopped}.`
      : stars === 3
        ? `Yes: checks kept the wrong gifts aboard to ${wrong}, though they stopped only about ${money(a.prevented)} this time.`
        : `Mostly: ${stopped}.`;
  }

  // Whether checking was too little, about right or too much, in the game's own money.
  //   underCost: what under-checking lost: for each kind of gift, what its wrong gifts that reached
  //     children without a check (never sent for one) cost beyond
  //     what checking every unchecked parcel of that kind would have cost, plus the recalls and
  //     remakes of unchecked gifts brought back off the sleigh. Leaving cheap mistakes unchecked when
  //     checking them all would cost more is not under-checking, and a mistake that slipped past a
  //     checker who did look is the price of checks being imperfect.
  //   overCost: what over-checking lost: the checking money spent on kinds of parcel where the checks
  //     cost more than the mistakes they stopped.
  //   position = 0.5 + (overCost / (underCost + overCost) - 0.5) * weight, where
  //     weight = lost / (lost + ASSURANCE.settle * all money spent) and lost = underCost + overCost.
  //   So 0 is all under-checking, 1 all over-checking, and losses that are small against the whole
  //   bill keep the dial near the middle. Below ASSURANCE.little it reads "too little", above
  //   ASSURANCE.much "too much", and "about right" between, all read from the rounded position the
  //   page draws, so the needle and the verdict agree.
  //   Gifts that missed a sleigh while they waited for a check are not over-checking: too few or
  //   too tired checkers held them up. When they were the game's largest loss (biggestLoss) the
  //   verdict is "bottleneck" instead, whatever the position.
  // The texts tell how this game turned out, not whether a choice was wise beforehand: a risky batch
  // can happen to come out clean. Estimated amounts (what checks prevented) read "about".
  assurance(biggest = null, stars = 0) {
    const a = this.assure;
    const letters = this.used.picked + this.undecided;
    const pickedWrong = this.aboard.filter(
      (x) => x.wrong && x.cause === PICKED_WRONG,
    );
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
      const text =
        g.id === "unclear"
          ? `${this.used.picked} of ${letters} decided, ${pickedWrong.length ? `${plural(pickedWrong.length, "wrong one")} cost ${money(sum(pickedWrong.map((x) => this.price(x))))}` : "no wrong ones"}.`
          : {
              paid: t.checked
                ? `Checking ${count(t.checked)} cost ${money(t.checkCost)} and stopped ${stopped}.`
                : `No ${kind} were checked. Their wrong ones cost ${money(t.shippedUncheckedCost)}.`,
              "cost more than it saved": `Checking ${count(t.checked)} cost ${money(t.checkCost)} and stopped ${t.prevented ? "only " : ""}${stopped}.`,
              "left exposed": `Wrong ${kind} that skipped a check cost ${money(t.shippedUncheckedCost)}, more than the ${money(unchecked * PRICE.check)} that checking the other ${unchecked} would have cost.`,
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
    // Checks waved through by trusting checkers were paid for but not done: checking not done
    // properly, not too much of it.
    const doneCost = (id) => a.groups[id].checkCost - a.wavedCost[id];
    // Lost to too many checks, in two parts: checks that cost more than they stopped, and gifts held
    // back while every gift was checked.
    const overChecks = sum(
      Object.keys(a.groups)
        .filter((id) => doneCost(id) > a.groups[id].prevented)
        .map(doneCost),
    );
    const overHeld = a.heldBy.all * LATE_PRICE;
    const overCost = overChecks + overHeld;
    const lost = underCost + overCost;
    const weight =
      lost /
      Math.max(1, lost + ASSURANCE.settle * sum(Object.values(this.spent)));
    const at = lost ? 0.5 + (overCost / lost - 0.5) * weight : 0.5;
    // When gifts held back by checking every parcel were the game's largest loss the verdict is too
    // much, and the needle moves into that zone if the money alone left it short of it.
    const lowest = !this.stats.checking[1] && !this.stats.checking[2];
    let to = biggest === "over" ? Math.max(at, ASSURANCE.much + 0.05) : at;
    // One figure far above the other, and large, decides the side whatever the rest of the bill.
    const clear = (x, y) => x >= ASSURANCE.clear * y && x >= ASSURANCE.floor;
    if (clear(underCost, overCost)) to = Math.min(to, ASSURANCE.little - 0.05);
    if (clear(overCost, underCost)) to = Math.max(to, ASSURANCE.much + 0.05);
    // On a few checks all game the player checked as little as the game allows; on three stars
    // neither too much nor too little checking cost a star.
    if (lowest) to = Math.min(to, ASSURANCE.much);
    // A game that lost the mistakes star did not check too much, whatever the checks cost.
    if (this.aboard.filter((x) => x.wrong).length > WRONG_ALLOWED)
      to = Math.min(to, ASSURANCE.much);
    if (stars === 3)
      to = Math.min(Math.max(to, ASSURANCE.little), ASSURANCE.much);
    const position = Math.round(to * 100) / 100;
    const verdict =
      biggest === "held"
        ? "bottleneck"
        : position < ASSURANCE.little
          ? "too little"
          : position > ASSURANCE.much
            ? "too much"
            : "about right";
    const under = `about ${money(underCost)} lost to too few checks`;
    const over = `about ${money(overCost)} lost to too many checks`;
    const held = a.heldBy.all + a.heldBy.some;
    const tired = verdict === "bottleneck" && this.tiredAt(2);
    const text = {
      "too little": `Too little checking: ${under}, against ${over}.`,
      "about right": `Checking was about right: ${under}, and ${over}.`,
      "too much": `Too much checking: ${over}, against ${under}.`,
      bottleneck: tired
        ? `Tired checkers held back ${plural(held, "gift")} that missed ${held === 1 ? "its" : "their"} sleigh: rest them with cocoa before they burn out.`
        : `Checking held back ${plural(held, "gift")} that missed ${held === 1 ? "its" : "their"} sleigh: move an elf to Checking when its pile fills.`,
    }[verdict];
    return {
      verdict,
      position,
      thresholds: { little: ASSURANCE.little, much: ASSURANCE.much },
      underCost: Math.round(underCost),
      overCost: Math.round(overCost),
      overChecks: Math.round(overChecks),
      overHeld: Math.round(overHeld),
      wrongMade: total("wrongMade"),
      caught: total("caught"),
      prevented: Math.round(total("prevented")),
      shipped: total("shipped"),
      shippedCost: Math.round(total("shippedCost")),
      // Every gift checking held back, the figure the bottleneck text names.
      held,
      // A bottleneck where tiredness took TIRED_SHARE or more of the checkers' time.
      tired,
      spent: Math.round(this.spent.checking + a.trainCost),
      groups,
      noChecks: {
        wrong: total("wrongMade"),
        cost: Math.round(total("wrongMadeCost")),
      },
      text,
    };
  }

  rightSoFar() {
    return this.aboard.filter((x) => !x.wrong).length;
  }

  // The three goals of the game, as they stand for the gifts aboard now.
  goals() {
    const right = this.rightSoFar();
    const wrong = this.aboard.filter((x) => x.wrong).length;
    const allowed = WRONG_ALLOWED;
    const cost = this.budget().spent;
    const loaded = right >= this.goalsCountFrom();
    // A goal whose figures are within its limit waits, unlit, until the sleigh holds enough gifts.
    const counted = (within) => ({
      met: loaded && within,
      waiting: !loaded && within,
    });
    return [
      {
        id: "full",
        name: "Full sleigh",
        now: right,
        need: TARGET,
        text: `${TARGET} right gifts`,
        met: right >= TARGET,
        waiting: false,
      },
      {
        id: "right",
        name: "Few mistakes",
        now: wrong,
        need: allowed,
        text: `at most ${plural(allowed, "wrong gift")}`,
        ...counted(wrong <= allowed),
      },
      {
        id: "cost",
        name: "Within budget",
        now: cost,
        need: COST_LIMIT,
        text: `some of the ${money(COST_LIMIT)} budget left, wrong gifts count`,
        ...counted(cost < COST_LIMIT),
      },
    ];
  }

  // Right gifts aboard from which the mistakes and cost goals count.
  goalsCountFrom() {
    return Math.ceil(TARGET * GOALS_FROM);
  }

  // Which cause a wrong gift on the sleigh comes under: what let it through a check, else what made it wrong.
  causeId(x) {
    if (x.made === LOCOMOTIVE) return "faulty";
    if (x.slipped || x.exit === "skipped") return "waved";
    if (x.cause === "a tired elf") return "tired";
    if (x.cause === "an elf's slip") return "slip";
    if (x.cause === PICKED_WRONG) return "picked";
    if (x.w.big) return "big";
    return x.cause === "the AI made the wrong toy" ? "misMade" : "misread";
  }

  // A cause's advice without the parts the settings already follow, or "" when they follow it all.
  // While the dial reads too much checking it never asks for more checks.
  causeFix(id, verdict = null) {
    const left = WRONG_CAUSES[id].fix
      .filter(([, done]) => !done(this))
      .filter(([text]) => verdict !== "too much" || !/^check\b/.test(text))
      .map(([text]) => text)
      .join(", or ");
    return left ? left[0].toUpperCase() + left.slice(1) + "." : "";
  }

  // Up to three causes of the wrong gifts given, dearest first. Wrong gifts brought back off the
  // sleigh are a cause of their own, at what fetching them back cost.
  causes(list, verdict = null) {
    const cause = (id, wrong, cost) => ({
      id,
      name: WRONG_CAUSES[id].name,
      wrong,
      cost,
      control: WRONG_CAUSES[id].control,
      fix: this.causeFix(id, verdict),
    });
    const recalled = this.recalled.count
      ? [cause("recalled", this.recalled.count, this.recalled.cost)]
      : [];
    const top = Object.entries(Object.groupBy(list, (x) => this.causeId(x)))
      .map(([id, xs]) =>
        cause(id, xs.length, sum(xs.map((x) => this.price(x)))),
      )
      .concat(recalled)
      .sort((p, q) => q.cost - p.cost || q.wrong - p.wrong)
      .slice(0, 3);
    // A recall always shows: it is what fixing the mistakes cost.
    if (recalled.length && !top.includes(recalled[0])) top[2] = recalled[0];
    return top;
  }

  // What let a wrong gift reach a child: how it went past dispatch, or else how it was made wrong.
  causeOf(x) {
    if (x.exit === "skipped") return "waved through by relaxed checkers";
    return x.cause;
  }

  // Half-time: the clock stops while the player sees how the sleigh stands and picks one change for
  // the second half, or none. The second half carries mostly big gifts.
  halfTime() {
    this.half = 2;
    const wrongGifts = this.aboard.filter((x) => x.wrong);
    const report = {
      aboard: this.rightSoFar(),
      wrong: wrongGifts.length,
      target: TARGET,
      cost: this.budget().spent,
      limit: COST_LIMIT,
      // The share of the working elves' time that tiredness took, 0 to 100: slower work while
      // tired, and all of it while burnt out. Idle elves do not count.
      tired: Math.round(
        (100 * sum(this.stats.tiredLost)) /
          Math.max(1, sum(this.stats.tiredWork)),
      ),
      burnouts: this.stats.burnouts,
      goals: this.goals(),
      causes: this.causes(wrongGifts),
    };
    this.choice = {
      title: "Half-time",
      text: "Pick one change before you carry on, or none.",
      report,
      next: {
        cargo: this.cargoView(2),
        text: `Big gifts come next. The AI gets many of these wrong, and each costs ${money(WRONG_PRICE.big)}.`,
      },
      options: this.halfTimeOptions(),
    };
    this.say(
      "halftime",
      `Half-time: ${report.aboard} right gifts aboard, ${report.wrong} wrong.`,
      { right: report.aboard, wrong: report.wrong },
    );
  }

  // The governance changes on offer at half-time, each saying what it gives, risks and costs.
  halfTimeOptions() {
    const u = this.update;
    const fact = (label, value) => ({ label, value: String(value) });
    const costs = (id) => fact("Costs", money(HALF_TIME_PRICE[id]));
    const pct = Math.round(u.promise * 100);
    const signs = `It is a ${u.bigChange ? "big" : "small"} change that was tested ${u.briefTesting ? "briefly" : "thoroughly"}.`;
    const state = this.vigilance().name;
    const tired = this.elves.map((e) => e.tired);
    const average = Math.round(sum(tired) / tired.length);
    // An option the budget cannot cover is not on offer: paying for it would end the game.
    const left = this.budgetLeft();
    const offer = (o) => {
      const price = HALF_TIME_PRICE[o.id];
      const why = price > 0 && price >= left ? NO_BUDGET : null;
      return { ...o, available: !why, why };
    };
    return [
      {
        id: "update",
        label: "Install the update",
        text: `The AI makes toys ${pct}% faster. ${signs}`,
        facts: [
          fact("Gives", `AI toys ${pct}% faster`),
          fact("Risk", `may be faulty, ${chance(this.failChance(u))}`),
          costs("update"),
        ],
      },
      {
        id: "tested",
        label: "Test the update first",
        text: `The update is tried on ${TEST_TOYS} toys first. It goes in only if they pass.`,
        facts: [
          fact("Gives", `installs at ${TEST_DELAY} s if it passes`),
          fact("Stops", "a bad update"),
          costs("tested"),
        ],
      },
      {
        id: "train",
        label: "Train the checkers",
        text:
          this.vigilance().state === "careful"
            ? "Your checkers still look closely at AI gifts. Training keeps them looking all night."
            : `Your checkers have waved ${plural(this.vig.skipped, "AI gift")} through without looking. Training makes them look closely all night.`,
        facts: [
          fact("Gives", "Checkers stop trusting the AI blindly"),
          fact("Checkers now", state),
          costs("train"),
        ],
      },
      {
        id: "rest",
        label: "Cocoa for everyone",
        text: `${tired.filter((t) => t > SLIPS_FROM).length} of ${tired.length} elves are tired. Cocoa halves every elf's tiredness.`,
        facts: [
          fact("Gives", "every elf half as tired"),
          fact("Energy now", `${energy(average)} on average`),
          costs("rest"),
        ],
      },
      {
        id: "none",
        label: "Carry on",
        text: "No change, nothing spent.",
        facts: [costs("none")],
      },
    ].map(offer);
  }

  failChance(u) {
    const signs = Number(u.bigChange) + Number(u.briefTesting);
    const lean = (p) => p ** signs * (1 - p) ** (2 - signs);
    const prior = 0.5; // the update is faulty on half of all games
    return (
      (prior * lean(SIGN_IF_FAULTY)) /
      (prior * lean(SIGN_IF_FAULTY) + (1 - prior) * lean(SIGN_IF_GOOD))
    );
  }

  choose(optionId) {
    const option = this.choice?.options.find((o) => o.id === optionId);
    if (!option?.available) return false;
    const u = this.update;
    const machine = (speed) => Math.round((60 / AI_SECONDS.make) * speed);
    const before = machine(this.machineSpeed);
    const price = HALF_TIME_PRICE[optionId];
    this.pay("halfTime", price);
    let text;
    let outcome = { money: price };
    if (optionId === "update") {
      this.install(u);
      text = `Installed: the toy machine makes ${machine(this.machineSpeed)} toys a minute, up from ${before}.`;
      outcome.gained = machine(this.machineSpeed) - before;
    } else if (optionId === "tested") {
      this.used.tested = true;
      this.pendingTest = { u, at: this.t + TEST_DELAY };
      text = `Testing the update: it goes in after ${TEST_DELAY} s if it passes.`;
      outcome.seconds = TEST_DELAY;
    } else if (optionId === "train") {
      this.assure.trainCost += price;
      this.used.trained = true;
      this.vig.trained = true;
      this.say("trained", "Checkers trained: they stay sharp.");
      text = `Trained the checkers for ${money(price)}: they stay sharp however clean the AI looks.`;
    } else if (optionId === "rest") {
      this.used.restAll = true;
      for (const e of this.elves)
        Object.assign(e, {
          tired: Math.round(e.tired / 2),
          rest: 0,
          station: e.station === BREAK && e.rest > 0 ? e.home : e.station,
        });
      text = `Cocoa for everyone for ${money(price)}: every elf half as tired.`;
    } else text = "Carried on with no change.";
    this.say("chose", text, { option: optionId, outcome });
    this.choice = null;
    this.did();
    return true;
  }

  // A tested update: trial toys on the new version; it goes in only if they all come out right.
  finishTest() {
    const { u } = this.pendingTest;
    this.pendingTest = null;
    const found = u.testRolls.filter(
      (r) => r < (u.faulty ? RISK.fault : RISK.aiMake),
    ).length;
    this.testResult = found ? "failed" : "passed";
    if (!found) return this.install(u);
    this.consequence(
      "tested",
      `Test failed: ${found} of ${TEST_TOYS} test toys wrong, so the update was not installed.`,
      { money: HALF_TIME_PRICE.tested },
    );
  }

  // One lesson from what the player did, biggest cause first, in the terms of the end account.
  // biggest is the game's largest loss (biggestLoss): lost letters or gifts held at checking come
  // before any lesson about wrong gifts, so the lesson names what decided the game.
  // The one lesson under the headline, with the loss it names (LOSSES): a lesson about a loss shows
  // only when that loss cost a goal, so it never blames what went well. With three stars it is a tip.
  lesson(stars, right, costs, biggest = "wrong", verdict = "about right") {
    const st = this.stats;
    const d = this.duration;
    const missed = stars < 3;
    const short = missed && right < TARGET;
    const wrongCount = this.aboard.filter((x) => x.wrong).length;
    // Wrong gifts cost a goal: too many of them. A game that ran out of budget never comes here: its
    // lesson is where the money went (finish()).
    const wrongHurt = missed && wrongCount > WRONG_ALLOWED;
    const checkedShare = st.checked / Math.max(1, st.passed);
    const wrongGifts = this.aboard.filter((x) => x.wrong);
    const bigWrong = sum(
      wrongGifts.filter((x) => x.w.big).map((x) => this.price(x)),
    );
    const dear = costs.checking > costs.prevented;
    const L = (title, text, loss = LOSSES[title]) => ({ title, text, loss });
    if (short && st.ai[0] / (2 * d) >= 0.6)
      return L(
        "By hand is too slow",
        `Only ${right} right gifts from ${this.lastId} letters. On everyday gifts the AI is as reliable as a fresh elf, and far faster.`,
      );
    // Their words come from the assurance verdict, which follows the same loss.
    if (short && biggest === "held")
      return this.tiredAt(2)
        ? L(
            "Tired checkers held up the line",
            "Tired checkers slow down, then burn out for a long break.",
          )
        : L("Checking was the bottleneck", "");
    if (short && biggest === "over" && verdict === "too much")
      return L("Too much checking", "");
    if (short && biggest === "lost") {
      const longest = this.longestHolding();
      const where = STATION_NAMES[longest];
      return this.tiredAt(longest)
        ? L(
            "Tired elves let letters pile up",
            `${this.lost} letters lost. Tired elves at ${where} held things up longest. Rest them with cocoa.`,
          )
        : L(
            "Letters piled up",
            `${this.lost} letters lost in full piles. ${where} held things up longest.${longest < 2 && this.ai[longest] === 2 ? "" : " Move free elves there."}`,
          );
    }
    // Wrong gifts that went aboard while the decision that would have stopped them waited.
    const waited = sum(
      wrongGifts
        .filter((x) => x.waitedOn && this.causeId(x) === "faulty")
        .map((x) => this.price(x)),
    );
    if (wrongHurt && waited > 0 && waited * 2 >= costs.mistakes)
      return L(
        "A decision waited too long",
        `While its decision waited, the faulty update's trains cost ${money(waited)} of the ${money(costs.mistakes)} in wrong gifts. Open a waiting decision as soon as it shows.`,
      );
    // Where most of what the delivered mistakes cost came from, when one cause stands out. Weighed by
    // cost, so a few wrong big gifts outweigh many cheap slips.
    const slips = wrongGifts.map((x) => ({
      cause: this.causeOf(x),
      cost: this.price(x),
    }));
    const costOf = (list) => sum(list.map((x) => x.cost));
    const top = Object.entries(Object.groupBy(slips, (x) => x.cause)).sort(
      (p, q) => costOf(q[1]) - costOf(p[1]),
    )[0];
    const byCause = {
      [PICKED_WRONG]: [
        "Unclear wishes read wrongly",
        "Most of the wrong-gift cost came from unclear wishes you read wrongly. The child's line holds the clue.",
      ],
      "the AI on a big gift": [
        "Big gifts need a person",
        "Most of the wrong-gift cost came from big gifts, where the AI is weak. Put a person on them: use Assist, or check the risky ones.",
      ],
      "made by the faulty update": [
        "A faulty update ran unchecked",
        "Most of the wrong-gift cost came from the faulty update. Roll it back as soon as it shows.",
      ],
      "waved through by relaxed checkers": [
        "Checkers stopped looking",
        "Most of the wrong-gift cost came from gifts the checkers waved through. Training them at half-time keeps them sharp.",
      ],
      "a tired elf": [
        "Tired elves mixed gifts up",
        "Most of the wrong-gift cost came from gifts tired elves mixed up. A short cocoa break keeps them sharp.",
      ],
    };
    if (
      wrongHurt &&
      top &&
      slips.length >= 4 &&
      costOf(top[1]) * 2 >= costOf(slips) &&
      byCause[top[0]]
    )
      return L(...byCause[top[0]]);
    if (
      short &&
      st.jammed >= 30 &&
      verdict === "too much" &&
      st.checking[2] / d >= 0.3
    )
      return L(
        "Too much checking",
        `Checking every parcel kept the line waiting on the checking pile for ${Math.round(st.jammed)} seconds, so only ${right} right gifts made the sleigh. Check where a mistake is likely or dear, and let the rest through.`,
      );
    if (
      wrongHurt &&
      verdict === "too little" &&
      checkedShare < 0.2 &&
      costs.mistakes > costs.checking
    )
      return L(
        "Too little checking",
        `Wrong gifts cost ${money(costs.mistakes)}, far more than the ${money(costs.checking)} spent on checking. Wrong big gifts alone cost ${money(bigWrong)}. The AI is reliable on everyday gifts and weak on big ones, so check the big ones.`,
      );
    if ((wrongHurt || !missed) && st.faulty >= 15)
      return L(
        "The faulty update ran too long",
        `The faulty update kept making full-sized trains for ${Math.round(st.faulty)} s after they were spotted. Roll it back as soon as it shows.`,
      );
    if (wrongHurt && st.checkerBurnouts >= 2)
      return L(
        "Tired checkers miss mistakes",
        `${st.checkerBurnouts} checkers burnt out, and tired ones let wrong gifts through. Send elves for cocoa before they are worn out.`,
      );
    // Fires even with three stars when the checkers were never trained: those mistakes are in the bill.
    if ((wrongHurt || !missed) && !this.vig.trained && st.waved >= 2)
      return L(
        "Checkers stopped looking",
        `After long clean stretches the checkers skipped ${this.vig.skipped} checks and waved ${st.waved} wrong gifts through, costing ${money(st.wavedCost)}. Training keeps them sharp.`,
      );
    if (!missed && st.checking[1] / d >= 0.5)
      return L(
        "Checking in the right places",
        `Checking cost ${money(costs.checking)} and stopped mistakes worth about ${money(costs.prevented)}. It went where a mistake was likeliest and dearest, which let the AI run faster.`,
      );
    if (!missed && this.used.rolledBack)
      return L(
        "The faulty update, handled",
        `You spotted the faulty update and rolled it back. Checking cost ${money(costs.checking)} and stopped about ${money(costs.prevented)} of wrong gifts.`,
      );
    if (!missed)
      return L(
        "Santa leaves happy",
        `${right} right gifts on time, with ${money(COST_LIMIT - costs.total)} of the budget left. Checking cost ${money(costs.checking)} and stopped about ${money(costs.prevented)} of wrong gifts.`,
      );
    if (short && st.burnouts >= 3)
      return L(
        "Burnouts slowed the line",
        `Elves burnt out ${times(st.burnouts)}, and each was off for ${BURNOUT_SECONDS} seconds. Send elves for cocoa when they turn red.`,
      );
    if (short && this.lost >= 15)
      return L(
        "Piles grew where nobody was working",
        `${this.lost} letters were lost when the letter pile overflowed. Move elves and AI help to whichever station has the biggest pile.`,
      );
    if (short)
      return L(
        "Almost there",
        "The workshop ran well but fell short. Let the AI take the everyday gifts, and keep your elves for the big ones.",
      );
    return L(
      "Too many wrong gifts",
      `${plural(wrongCount, "wrong gift")} went aboard, more than the ${WRONG_ALLOWED} allowed. Check the risky ones, and rest the checkers before they tire.`,
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
    // A rested elf, or one new to a station, looks at the AI's work properly again.
    e.trust = 0;
    if (station === BREAK) {
      if (e.station < BREAK) e.home = e.station;
      e.breakAt = this.t;
      this.used.cocoa++;
    }
    e.station = station;
    this.assignWork();
    this.did();
    return true;
  }

  setAi(station, level) {
    if (![0, 1].includes(station) || ![0, 1, 2].includes(level) || this.why())
      return false;
    this.ai[station] = level;
    this.did();
    return true;
  }

  setChecking(level) {
    if (![0, 1, 2].includes(level) || this.why()) return false;
    if (level !== this.checking) this.reportChecking();
    this.checking = level;
    this.did();
    return true;
  }

  // Why a control cannot be used now, or null when it can.
  why() {
    return this.end ? "The sleigh has left" : null;
  }

  costText(name) {
    const perMinute = (level) => money(AI_PRICE[level] * 60);
    return {
      ai0: `${perMinute(1)} a minute on Assist, ${perMinute(2)} on Automate`,
      ai1: `${perMinute(1)} a minute on Assist, ${perMinute(2)} on Automate`,
      checking: `each check takes a checker about ${Math.round(this.secondsPerCheck())} seconds and costs ${money(PRICE.check)}`,
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
      held: id === "orders" ? this.answered.length : 0,
    };
  }

  caseView(c) {
    const affected = this.affected(c);
    return {
      id: c.id,
      kind: c.kind,
      step: c.step,
      title: CASE_TITLES[c.step ?? c.kind],
      text: this.caseText(c),
      facts: this.facts(c),
      evidence: c.parcels.map((x) => ({
        parcelId: x.id,
        child: x.w.child,
        wish: x.w.wish,
        made: x.made && { ...x.made },
      })),
      affected: { count: affected.length, ids: affected.map((x) => x.id) },
      options: this.options(c),
      // A recall of one gift names it, so the card can draw what the child got and what they wanted.
      ...(c.step === "aboard"
        ? {
            gift:
              affected.length === 1
                ? {
                    child: affected[0].w.child,
                    wanted: { name: affected[0].w.wanted.name },
                    made: { name: affected[0].made.name },
                  }
                : null,
          }
        : {}),
      // An unclear letter: what a wrong pick costs once aboard, in pounds, and the two things the
      // wish could mean, as toy names and drawing keys, in an order that does not tell which is right.
      ...(c.kind === "unclear"
        ? { stake: this.price(c.parcels[0]), readings: this.readings(c) }
        : {}),
    };
  }

  // The two things an unclear wish could mean, each { name, art }: art is the key the page draws the
  // toy by (its name in lower case with dashes, as in the blunders).
  readings(c) {
    const w = c.parcels[0].w;
    const both = [w.wanted, w.wrong].map((t) => ({
      name: t.name,
      art: slug(t.name),
    }));
    return c.rightFirst ? both : both.reverse();
  }

  // The first decision still waiting for an answer, by id and name, or null.
  openCaseView() {
    const c = this.cases[0];
    return c ? { id: c.id, title: CASE_TITLES[c.step ?? c.kind] } : null;
  }

  view() {
    const inc = this.incident;
    const v = this.vigilance();
    const ch = this.choice;
    const shownHalf = ch ? 1 : this.half;
    const copyGoals = (goals) => goals.map((g) => ({ ...g }));
    const copyCauses = (causes) => causes.map((c) => ({ ...c }));
    return {
      t: this.t,
      duration: this.duration,
      target: TARGET,
      elves: this.elves.map((e) => ({
        name: e.name,
        station: e.station,
        tired: Math.round(e.tired),
        energy: energy(e.tired),
        mood: mood(e),
        resting: e.rest > 0,
        doing: e.doing,
      })),
      ai: [...this.ai],
      checking: this.checking,
      levers: this.levers(),
      stations: this.rates().map((rate, s) => {
        const working = this.staff(s).filter(
          (e) => e.doing !== "nothing to do",
        ).length;
        return {
          name: STATION_NAMES[s],
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
      vigilance: {
        state: v.state,
        name: v.name,
        cleanRun: Math.round(this.trustAt(2)),
        confirming: this.vigilance(this.confirmRun()).name,
        secondsPerCheck: Math.round(this.secondsPerCheck() * 10) / 10,
        skipped: this.vig.skipped,
        trained: this.vig.trained,
        swap: this.drift(),
      },
      case: this.cases[0] ? this.caseView(this.cases[0]) : null,
      casesWaiting: Math.max(0, this.cases.length - 1),
      choice: ch && {
        title: ch.title,
        text: ch.text,
        report: {
          ...ch.report,
          goals: copyGoals(ch.report.goals),
          causes: copyCauses(ch.report.causes),
        },
        next: { cargo: { ...ch.next.cargo }, text: ch.next.text },
        options: ch.options.map((o) => ({
          ...o,
          facts: o.facts.map((f) => ({ ...f })),
        })),
        openCase: this.openCaseView(),
      },
      // While the half-time card is up the first half is over but the second has not started.
      run: {
        half: shownHalf,
        halves: 2,
        halfLeft: ch
          ? 0
          : Math.max(0, Math.round(this.half * HALF_SECONDS - this.t)),
        leavesIn: Math.max(0, Math.round(this.duration - this.t)),
        aboard: this.rightSoFar(),
        target: TARGET,
        cargo: this.cargoView(shownHalf),
        goals: this.goals(),
        goalsCountFrom: this.goalsCountFrom(),
      },
      cost: this.budget(),
      focus: this.focus(),
      sleigh: {
        right: this.rightSoFar(),
        wrong: this.aboard.filter((x) => x.wrong).length,
        parcels: this.aboard.map((x) => this.parcel(x)),
      },
      lost: this.lost,
      prices: {
        wrongEveryday: WRONG_PRICE.everyday,
        wrongBig: WRONG_PRICE.big,
      },
      pace: this.pace(),
      incident: inc && {
        known: inc.known,
        rollingBack: inc.rollingBack,
        suspectWaiting: this.marked().length,
      },
      actions: Object.fromEntries(
        CONTROLS.map((name) => {
          const why = this.why();
          return [name, { available: !why, why, cost: this.costText(name) }];
        }),
      ),
      news: this.news.slice(),
      end: this.end && {
        ...this.end,
        goals: copyGoals(this.end.goals),
        costs: { ...this.end.costs },
        lesson: { ...this.end.lesson },
        assurance: {
          ...this.end.assurance,
          groups: this.end.assurance.groups.map((g) => ({ ...g })),
          noChecks: { ...this.end.assurance.noChecks },
          thresholds: { ...this.end.assurance.thresholds },
        },
        practices: this.end.practices.map((p) => ({
          ...p,
          actions: p.actions.map((x) => ({ ...x })),
        })),
        causes: copyCauses(this.end.causes),
        blunders: this.end.blunders.map((b) => ({ ...b })),
      },
    };
  }
}
