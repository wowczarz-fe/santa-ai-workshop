// The rules of one run. It never touches the page, so it also runs in Node for balance checks.

const ELF_NAMES = "Pip Holly Jingle Noel Ivy Fig Tinsel Coco".split(" ");
const CONTROLS =
  "ai0 ai1 checking ask inspect train rollback quarantine recall".split(" ");
const PAID = "inspect train rollback quarantine recall".split(" ");
const STATION_NAMES = [
  "Reading letters",
  "Making toys",
  "Checking and dispatch",
];
const BREAK = 3;

// Work is counted in units; one fresh elf at dispatch does CHECKER_SPEED units a second.
const CHECKER_SPEED = 0.75;
const PASS = 0.12;
const CHECK = 2.2; // about eighteen times a pass
const REMAKE = 4;
const RECALL = 8; // fetching it back off the sleigh, then remaking it
const ASKING = 1.6; // an unclear letter while the child answers
const INSPECT_SECONDS = 3;
const ROLLBACK_SECONDS = 8;
const TRAINING_SECONDS = 10;
const BURNOUT_SECONDS = 30;
const SAMPLE = 0.08; // share of parcels a spot-check opens

// Indexed by AI level: by hand, assist, automate.
const LEVELS = ["By hand", "Assist", "Automate"];
const READ_RISK = [0.02, 0.05, 0.12];
const UNCLEAR_RISK = [0.05, 0.15, 0.4];
const MAKE_RISK = [0.02, 0.05, 0.1];
const FAULT_RISK = [0, 0.35, 0.65]; // the faulty update hurts more the more the AI does
const UNSURE_IF_WRONG = 0.7;
const UNSURE_IF_RIGHT = 0.06;

const BUDGET = 1300;
const WAGE = 0.15; // a working elf, per second
const COCOA_WAGE = 0.08;
const AI_PRICE = [0, 0.22, 0.72]; // per station, per second
const PRICE = {
  check: 3,
  inspect: 8,
  train: 70,
  remake: 3,
  rollback: 65,
  quarantine: 15,
  recall: 40,
};
const WRONG_PRICE = { everyday: 12, big: 60 };

const AT = {
  ai0: 15,
  ai1: 25,
  timmy: 32,
  checking: 48,
  update: 75,
  train: 100,
  rush: 110,
  overtrust: 130,
  calm: 150,
  close: 211,
};
const INFLOW = 0.88;
const RUSH_INFLOW = 1.65;

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
  "Rosa | A chess set, please. | ♟️ chess set | 🗄️ chest of drawers | unclear",
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

class Workshop {
  constructor({ seed = 1, guided = false } = {}) {
    this.seed = seed >>> 0;
    this.guided = guided;
    this.duration = 240;
    this.target = 155;
    this.t = 0;
    this.elves = ELF_NAMES.map((name, i) => ({
      name,
      station: i < 3 ? 0 : i < 6 ? 1 : 2,
      home: 0,
      tired: 8,
      rest: 0,
    }));
    this.queues = [[], [], []];
    this.limits = [24, 20, 18];
    this.work = [0, 0, 0];
    this.rework = [];
    this.aboard = [];
    this.ai = [0, 0];
    this.checking = 0;
    this.ask = false;
    this.inspection = null;
    this.incident = null;
    this.training = 0;
    this.trained = false;
    this.unlocked = new Set(guided ? [] : CONTROLS);
    this.happened = new Set();
    this.hint = null;
    this.news = [];
    this.lastNews = 0;
    this.lost = 0;
    this.unreportedLost = 0;
    this.newsAt = {};
    this.behindNoted = false;
    this.reworkTurn = false;
    this.lastId = 0;
    this.inflow = 0;
    this.spent = { people: 0, ai: 0, checking: 0, fixing: 0 };
    this.stats = {
      ai: [0, 0, 0],
      checking: [0, 0, 0],
      passed: 0,
      checked: 0,
      prevented: 0,
      waved: 0,
      burnouts: 0,
      checkerBurnouts: 0,
      jammed: 0,
      faulty: 0,
      rolledBack: false,
      brokeAt: null,
    };
    this.end = null;
    if (guided)
      this.unlock(
        "elves",
        "Letters are piling up. Move elves to the station with the biggest pile.",
      );
    for (let i = 0; i < 6; i++) this.arrive();
    ({ projected: this.projected, slowest: this.slowest } = this.estimate());
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

  // Says it unless the same kind of news for the same key went out in the last few seconds.
  sayEvery(seconds, key, kind, text, extra) {
    if (this.t - (this.newsAt[key] ?? -99) < seconds) return false;
    this.newsAt[key] = this.t;
    this.say(kind, text, extra);
    return true;
  }

  unlock(control, text) {
    if (this.unlocked.has(control)) return;
    this.unlocked.add(control);
    this.hint = { text, control };
    this.say("unlock", text, { control });
  }

  used(control) {
    if (this.hint?.control === control) this.hint = null;
  }

  arrive(timmy = false) {
    const w = timmy
      ? TIMMY
      : EVERYDAY_WISHES[Math.floor(this.rng() * EVERYDAY_WISHES.length)];
    const roll = {
      read: this.rng(),
      make: this.rng(),
      unsure: this.rng(),
      sample: this.rng(),
      catch: this.rng(),
    };
    if (timmy) roll.make = 1;
    if (!timmy && this.queues[0].length >= this.limits[0]) {
      this.lost++;
      this.unreportedLost++;
      return;
    }
    this.queues[0].push({
      id: ++this.lastId,
      w,
      roll,
      made: null,
      wrong: false,
      asked: false,
      unsure: false,
      batch: false,
      byAi: false,
      result: null,
      remake: 0,
      held: false,
    });
  }

  // Elves working at a station; station 3 is the cocoa break.
  staff(s) {
    return this.elves.filter((e) => e.station === s);
  }

  power(s) {
    return sum(this.staff(s).map((e) => 1 - e.tired * 0.005));
  }

  cap(s, level = this.ai[s]) {
    const p = this.power(s);
    if (s < 2) return [p * 0.18, p ? p * 0.38 + 0.1 : 0, 1.5 + p * 0.15][level];
    const inspecting = this.inspection?.remaining > 0 ? CHECKER_SPEED : 0;
    return (
      Math.max(0, p * CHECKER_SPEED - inspecting) * (this.training ? 0.5 : 1)
    );
  }

  cost(s, x) {
    if (s === 0) return this.ask && x.w.unclear ? ASKING : 1;
    if (s === 1) return 1;
    return x.remake || (this.needsCheck(x) ? CHECK : PASS);
  }

  suspect(x) {
    return x.unsure || (x.batch && Boolean(this.incident?.known));
  }

  // An unclear wish stops being risky once the child has been asked.
  risky(x) {
    return x.w.big || (x.w.unclear && !x.asked) || this.suspect(x);
  }

  needsCheck(x, level = this.checking) {
    const sample = x.roll.sample < SAMPLE;
    return [sample, sample || this.risky(x), true][level];
  }

  // Parcels waiting at dispatch that the faulty update made, once it is known: what quarantine takes.
  marked() {
    return this.incident?.known ? this.queues[2].filter((x) => x.batch) : [];
  }

  blocked(s) {
    return s < 2 && this.queues[s + 1].length >= this.limits[s + 1];
  }

  busy(s) {
    if (s === 2)
      return (
        this.queues[2].length > 0 ||
        this.rework.length > 0 ||
        this.inspection?.remaining > 0
      );
    return (
      this.queues[s].length > 0 &&
      !this.blocked(s) &&
      !(s === 1 && this.incident?.rollingBack)
    );
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

  overtrusting() {
    return this.t >= AT.overtrust && !this.trained;
  }

  catchChance(byAi) {
    const team = this.staff(2);
    const tired = sum(team.map((e) => e.tired)) / Math.max(1, team.length);
    return Math.max(
      0.35,
      0.87 - tired * 0.004 - (byAi && this.overtrusting() ? 0.3 : 0),
    );
  }

  price(x) {
    return x.w.big ? WRONG_PRICE.big : WRONG_PRICE.everyday;
  }

  // The same odds the simulation rolls against, averaged over the wishes, for the levers and the pace.
  odds(levels = this.ai, checking = this.checking) {
    const unclear = share((w) => w.unclear);
    const readWrong =
      READ_RISK[levels[0]] +
      unclear * UNCLEAR_RISK[levels[0]] * (this.ask ? 0.15 : 1);
    const inc = this.incident;
    const fault = inc?.fault && inc.known && !inc.rollingBack && levels[1] > 0;
    const makeWrong = fault ? FAULT_RISK[levels[1]] : MAKE_RISK[levels[1]];
    const wrong = 1 - (1 - readWrong) * (1 - makeWrong);
    const flagged = fault ? 1 : share((w) => w.big || (w.unclear && !this.ask));
    const unsure = wrong * UNSURE_IF_WRONG + (1 - wrong) * UNSURE_IF_RIGHT;
    const notRisky = (1 - flagged) * (1 - SAMPLE);
    const checked = [SAMPLE, 1 - notRisky * (1 - unsure), 1][checking];
    const wrongChecked = [SAMPLE, 1 - notRisky * (1 - UNSURE_IF_WRONG), 1][
      checking
    ];
    const caught =
      wrong * wrongChecked * this.catchChance(levels.some((l) => l > 0));
    const dispatchCost = PASS + checked * (CHECK - PASS) + caught * REMAKE;
    return { readWrong, makeWrong, wrong, checked, caught, dispatchCost };
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
      this.inflow +=
        dt * (this.t >= AT.rush && this.t < AT.calm ? RUSH_INFLOW : INFLOW);
      for (; this.inflow >= 1; this.inflow--) this.arrive();
    }
    this.elvesTick(dt);
    this.timersTick(dt);
    for (let s = 0; s < 3; s++) this.run(s, dt);
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
    at(AT.ai0, "ai0", () =>
      this.unlock(
        "ai0",
        "Reading by hand is slow. Let the AI help read the letters.",
      ),
    );
    at(AT.ai1, "ai1", () =>
      this.unlock("ai1", "Now toys pile up. Let the AI help make them too."),
    );
    at(AT.timmy, "timmy", () => {
      this.arrive(true);
      this.say(
        "timmy",
        "Timmy writes: 'A little train, please.' How little is little?",
      );
      this.unlock(
        "ask",
        "Timmy's wish is unclear. Turn on asking so the AI checks with him first.",
      );
    });
    at(AT.checking, "checking", () => this.unlockChecking());
    at((this.checkingAt ?? Infinity) + 8, "inspect", () =>
      this.unlock(
        "inspect",
        "Open a waiting parcel yourself and judge the toy against the wish.",
      ),
    );
    at(AT.update, "update", () => {
      this.incident = { fault: true, known: false, rollingBack: 0 };
      this.say("update", "A shiny new AI update just reached the toy line.");
      this.unlock(
        "rollback",
        "If the new update makes odd toys, roll it back.",
      );
    });
    at(AT.train, "train", () =>
      this.unlock(
        "train",
        "Long shifts make checkers trust the AI too much. Training keeps them sharp.",
      ),
    );
    at(AT.rush, "rush", () =>
      this.say("rush", "Last-minute rush! Letters now arrive twice as fast."),
    );
    at(AT.overtrust, "overtrust", () => {
      if (!this.trained)
        this.say(
          "overtrust",
          "Long shift: the checkers have started waving AI gifts through.",
        );
    });
  }

  unlockChecking() {
    this.checkingAt ??= this.t;
    this.unlock(
      "checking",
      "Some gifts come out wrong. Choose how much the elves check before parcels leave.",
    );
  }

  elvesTick(dt) {
    this.elves.forEach((e, i) => {
      this.pay("people", dt * (e.station === BREAK ? COCOA_WAGE : WAGE));
      if (e.station === BREAK) {
        e.tired = Math.max(0, e.tired - dt * 3);
        if (e.rest > 0 && (e.rest = countDown(e.rest, dt)) === 0)
          e.station = e.home;
        return;
      }
      const s = e.station;
      const pressure = this.queues[s].length / this.limits[s];
      const effort =
        0.3 +
        Math.max(0, pressure - 0.25) * 0.75 +
        (s === 2 ? 0.1 * this.checking : 0);
      e.tired = Math.min(
        100,
        Math.max(0, e.tired + dt * (this.busy(s) ? effort : -0.12)),
      );
      if (this.guided && e.tired >= 60 && !this.happened.has("cocoaHint")) {
        this.happened.add("cocoaHint");
        this.hint = {
          text: `${e.name} is getting tired. Send tired elves for cocoa before they burn out.`,
          control: "elves",
        };
      }
      if (e.tired < 88) return;
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

  timersTick(dt) {
    const ins = this.inspection;
    if (ins?.remaining > 0 && this.staff(2).length)
      ins.remaining = countDown(ins.remaining, dt);
    const inc = this.incident;
    if (
      inc?.rollingBack > 0 &&
      (inc.rollingBack = countDown(inc.rollingBack, dt)) === 0
    ) {
      inc.fault = false;
      this.say(
        "rolledBack",
        "Rollback done. The toy line makes proper toys again.",
      );
    }
    if (
      this.training > 0 &&
      (this.training = countDown(this.training, dt)) === 0
    ) {
      this.trained = true;
      this.say(
        "trained",
        "Training done. The checkers look at every gift properly again.",
      );
    }
  }

  run(s, dt) {
    if (s === 1 && this.incident?.rollingBack) return;
    if (!this.next(s)) return void (this.work[s] = 0);
    if (this.blocked(s)) return;
    this.work[s] += this.cap(s) * dt;
    for (
      let line = this.next(s);
      line && !this.blocked(s) && this.work[s] >= this.cost(s, line[0]);
      line = this.next(s)
    ) {
      this.work[s] -= this.cost(s, line[0]);
      if (s === 2) this.reworkTurn = line !== this.rework;
      this.finishWork(s, line.shift());
    }
  }

  // The line a station takes its next parcel from, or null. Dispatch alternates remakes with new
  // parcels, and does only remakes while quarantined parcels hold it.
  next(s) {
    const q = this.queues[s];
    if (s < 2 || !this.rework.length) return q.length ? q : null;
    return this.reworkTurn || !q.length || this.rework.some((x) => x.held)
      ? this.rework
      : q;
  }

  finishWork(s, x) {
    if (s === 0) {
      const level = this.ai[0];
      x.asked = this.ask && x.w.unclear;
      x.byAi = level > 0;
      const risk =
        READ_RISK[level] +
        (x.w.unclear ? UNCLEAR_RISK[level] * (x.asked ? 0.15 : 1) : 0);
      x.wrong = x.w === TIMMY ? !x.asked : x.roll.read < risk;
      this.queues[1].push(x);
    } else if (s === 1) {
      x.batch = Boolean(this.incident?.fault) && this.ai[1] > 0;
      x.byAi ||= this.ai[1] > 0;
      const faulty = x.batch && x.roll.make < FAULT_RISK[this.ai[1]];
      x.wrong = faulty || x.wrong || x.roll.make < MAKE_RISK[this.ai[1]];
      x.made = faulty ? LOCOMOTIVE : x.wrong ? x.w.wrong : x.w.wanted;
      x.unsure =
        x.roll.unsure <
        (x.wrong && !faulty ? UNSURE_IF_WRONG : UNSURE_IF_RIGHT);
      this.queues[2].push(x);
    } else if (x.remake) {
      Object.assign(x, {
        remake: 0,
        held: false,
        wrong: false,
        batch: false,
        unsure: false,
        made: x.w.wanted,
        result: "right",
      });
      this.pay("fixing", PRICE.remake);
      this.load(x);
    } else {
      this.stats.passed++;
      if (this.needsCheck(x)) this.elfCheck(x);
      else this.load(x);
    }
  }

  elfCheck(x) {
    this.stats.checked++;
    this.pay("checking", PRICE.check);
    if (x.wrong && x.roll.catch >= this.catchChance(x.byAi)) {
      x.slipped = true;
      if (x.byAi && this.overtrusting()) this.stats.waved++;
      return this.load(x);
    }
    this.reveal(x);
    const text = x.wrong
      ? `An elf caught a mistake: ${x.w.child} wished for ${a(x.w.wanted.name)} and got ${a(x.made.name)}.`
      : `An elf checked ${x.w.child}'s ${x.w.wanted.name}: just right.`;
    this.say("checked", text, {
      check: this.copy(x, Math.round((CHECK / CHECKER_SPEED) * 10) / 10, "elf"),
    });
    if (x.wrong) this.caught(x);
    else this.load(x);
  }

  caught(x) {
    this.stats.prevented += this.price(x);
    this.toRework(x, REMAKE);
  }

  load(x) {
    this.reveal(x);
    this.aboard.push(x);
    if (!x.wrong) return;
    const slipped = x.slipped ? " It slipped past a checker." : "";
    const text = `Wrong gift aboard! ${x.w.child} wished for ${a(x.w.wanted.name)} and got ${a(x.made.name)}.${slipped}`;
    this.say("loaded", text, { check: this.copy(x) });
    if (this.t >= AT.timmy) this.unlockChecking();
    if (this.incident)
      this.unlock(
        "recall",
        "A wrong gift is on the sleigh. Recall brings wrong gifts back to be remade.",
      );
  }

  reveal(x) {
    if (x.result) return;
    x.result = x.wrong ? "wrong" : "right";
    if (x.made === LOCOMOTIVE && !this.incident.known) {
      this.incident.known = true;
      this.unlock(
        "quarantine",
        "Full-sized trains! Roll back the update and quarantine the marked parcels.",
      );
    }
  }

  // A copy taken now, so news keeps showing the toy as the AI made it.
  copy(x, seconds, by) {
    const check = {
      wish: x.w.wish,
      wanted: { ...x.w.wanted },
      made: { ...x.made },
      result: x.wrong ? "wrong" : "right",
    };
    return by ? { ...check, seconds, by } : check;
  }

  toRework(x, cost) {
    x.remake = cost;
    this.rework.push(x);
  }

  track(dt) {
    this.pay("ai", dt * (AI_PRICE[this.ai[0]] + AI_PRICE[this.ai[1]]));
    this.stats.ai[this.ai[0]] += dt;
    this.stats.ai[this.ai[1]] += dt;
    this.stats.checking[this.checking] += dt;
    if (
      this.queues[2].length >= this.limits[2] ||
      this.rework.some((x) => x.held)
    )
      this.stats.jammed += dt;
    const inc = this.incident;
    if (inc?.fault && inc.known && !inc.rollingBack && this.ai[1] > 0)
      this.stats.faulty += dt;
    if (this.blocked(0))
      this.sayEvery(
        10,
        "blocked0",
        "blocked",
        "Reading stopped: the toy pile is full.",
        { station: 0 },
      );
    if (this.blocked(1))
      this.sayEvery(
        10,
        "blocked1",
        "blocked",
        "The toy line stopped: dispatch is full.",
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
    // Averaged over about 15 seconds, so an inspection or a break does not set off the warning.
    const now = this.estimate();
    this.projected += (now.projected - this.projected) * Math.min(1, dt / 15);
    this.slowest = now.slowest;
    const pace = this.pace();
    // Too early to judge a pace in the first seconds; re-arm only once the pace is comfortably back.
    if (this.t >= 20 && pace.behind && !this.behindNoted) {
      this.behindNoted = true;
      const text = `At this pace Santa leaves with about ${pace.projected} right gifts. ${STATION_NAMES[pace.slowest]} is holding things up.`;
      this.say("behind", text, { station: pace.slowest });
    }
    if (pace.projected >= this.target + 5) this.behindNoted = false;
  }

  pace() {
    return {
      projected: Math.round(this.projected),
      behind: this.projected < this.target,
      slowest: this.slowest,
    };
  }

  readCost() {
    return 1 + (this.ask ? share((w) => w.unclear) * (ASKING - 1) : 0);
  }

  // Parcels a second at the current settings, from the same odds the levers show. Steady leaves out
  // what passes in seconds: training, an open parcel and a rollback.
  rates(steady = false) {
    const dispatch = steady ? this.power(2) * CHECKER_SPEED : this.cap(2);
    const stopped = !steady && this.incident?.rollingBack;
    return [
      this.cap(0) / this.readCost(),
      stopped ? 0 : this.cap(1),
      dispatch / this.odds().dispatchCost,
    ];
  }

  // Right gifts expected at departure if every station keeps its current speed.
  estimate() {
    const o = this.odds();
    const rates = this.rates(true);
    const slowest = rates.indexOf(Math.min(...rates));
    const later = (from, to) =>
      Math.max(0, Math.min(to, AT.close) - Math.max(from, this.t));
    const letters =
      INFLOW * (later(0, AT.rush) + later(AT.calm, AT.close)) +
      RUSH_INFLOW * later(AT.rush, AT.calm);
    const supply =
      sum(this.queues.map((q) => q.length)) +
      this.rework.length +
      (this.inspection ? 1 : 0) +
      letters;
    const right = this.aboard.filter((x) => !x.wrong).length;
    const projected =
      right +
      Math.min(rates[slowest] * (this.duration - this.t), supply) *
        (1 - o.wrong + o.caught);
    return { projected, slowest };
  }

  levers() {
    const ai = (s) =>
      LEVELS.map((name, level) => {
        const levels = s === 0 ? [level, this.ai[1]] : [this.ai[0], level];
        const o = this.odds(levels);
        return {
          name,
          perMinute: Math.round(
            (this.cap(s, level) * 60) / (s === 0 ? this.readCost() : 1),
          ),
          wrongPer100: Math.round((s === 0 ? o.readWrong : o.makeWrong) * 100),
          costPerMinute: Math.round(AI_PRICE[level] * 60),
        };
      });
    const checking = [
      "Spot-check",
      "Check the risky ones",
      "Check everything",
    ].map((name, level) => {
      const o = this.odds(this.ai, level);
      return {
        name,
        checkedPer100: Math.round(o.checked * 100),
        perMinute: Math.round((this.cap(2) * 60) / o.dispatchCost),
      };
    });
    return { ai0: ai(0), ai1: ai(1), checking };
  }

  finish() {
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
    const lesson = this.lesson(rating, right, costs);
    this.end = {
      right,
      wrong: wrongGifts.length,
      lost: this.lost,
      rating,
      costs,
      lesson,
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
    const letters = this.lastId + this.lost;
    if (missed && st.ai[0] / (2 * d) >= 0.6 && right < this.target)
      return {
        title: "By hand is careful but slow",
        text: `Your elves made few mistakes but delivered only ${right} right gifts from ${letters} letters. With AI help and some checking, the same elves could have delivered far more.`,
      };
    if (missed && st.brokeAt !== null)
      return {
        title: "The money ran out",
        text: `The money ran out after ${Math.round(st.brokeAt)} seconds: checking cost ${money(costs.checking)} and fixing ${money(costs.fixing)}. Spend on the checks that stop the dearest mistakes.`,
      };
    if (missed && st.checking[2] / d >= 0.3 && costs.checking > costs.prevented)
      return {
        title: "Too much checking",
        text: `Checking cost ${money(costs.checking)} but stopped mistakes worth only ${money(costs.prevented)}, and parcels sat stuck at dispatch for ${Math.round(st.jammed)} seconds. Check where a mistake is likely or dear, and let the rest through.`,
      };
    if (missed && checkedShare < 0.2 && costs.mistakes > costs.checking)
      return {
        title: "Too little checking",
        text: `Wrong gifts cost ${money(costs.mistakes)}, far more than the ${money(costs.checking)} spent on checking. The more the AI does, the more its work needs checking.`,
      };
    if (st.faulty >= 15)
      return {
        title: "The faulty update ran too long",
        text: `The broken update kept making full-sized trains for ${Math.round(st.faulty)} seconds after they were spotted. When the AI suddenly goes wrong, roll back first, then quarantine and recall what it made.`,
      };
    if (missed && st.checkerBurnouts >= 2)
      return {
        title: "Tired checkers miss mistakes",
        text: `${st.checkerBurnouts} checkers burnt out, and tired ones let mistakes slip. Send elves for cocoa before they are worn out.`,
      };
    if (missed && st.waved >= 3)
      return {
        title: "The checkers trusted the AI too much",
        text: `Late in the shift, untrained checkers waved ${st.waved} wrong AI gifts through. Training them early keeps them sharp.`,
      };
    if (missed && st.checking[1] / d < 0.4)
      return {
        title: "Every parcel checked the same",
        text: `Big gifts and parcels the AI was unsure about were where mistakes were likeliest and dearest; wrong big gifts alone cost ${money(bigWrong)}. Checking the risky ones puts the effort where it pays.`,
      };
    if (!missed && st.checking[1] / d >= 0.5)
      return {
        title: "Checking in the right places",
        text: `Checking cost ${money(costs.checking)} and stopped mistakes worth ${money(costs.prevented)}. It went where a mistake was likeliest and dearest, which let the AI run faster.`,
      };
    if (!missed && st.rolledBack)
      return {
        title: "The faulty update, handled",
        text: `You spotted the broken update, rolled it back and cleared up what it made. Checking cost ${money(costs.checking)} and stopped mistakes worth ${money(costs.prevented)}.`,
      };
    if (!missed)
      return {
        title: "Santa leaves happy",
        text: `${right} right gifts on time and within budget. Checking cost ${money(costs.checking)} and stopped mistakes worth ${money(costs.prevented)}.`,
      };
    if (costs.total > BUDGET)
      return {
        title: "Over budget",
        text: `The workshop cost ${money(costs.total)} against a budget of ${money(BUDGET)}, wrong gifts included. Look at which line of the bill grew most.`,
      };
    if (this.lost >= 15)
      return {
        title: "Piles grew where nobody was working",
        text: `${this.lost} letters were lost when the letter pile overflowed. Move elves and AI help to whichever station has the biggest pile.`,
      };
    return {
      title: "Almost there",
      text: "The workshop ran well but fell short. Use a little more AI where piles grow, and keep checks on the risky parcels.",
    };
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
    this.used("elves");
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
    this.used(`ai${station}`);
    return true;
  }

  setChecking(level) {
    if (![0, 1, 2].includes(level) || this.why("checking")) return false;
    this.checking = level;
    this.used("checking");
    return true;
  }

  setAsk(on) {
    if (this.why("ask")) return false;
    this.ask = Boolean(on);
    this.used("ask");
    return true;
  }

  inspect(parcelId) {
    const i = this.queues[2].findIndex((x) => x.id === parcelId);
    if (this.why("inspect") || i < 0) return false;
    this.inspection = {
      parcel: this.queues[2].splice(i, 1)[0],
      remaining: INSPECT_SECONDS,
    };
    this.pay("checking", PRICE.inspect);
    this.used("inspect");
    return true;
  }

  decide(parcelId, choice) {
    const ins = this.inspection;
    if (
      this.end ||
      !ins ||
      ins.remaining > 0 ||
      ins.parcel.id !== parcelId ||
      !["ship", "remake"].includes(choice)
    )
      return false;
    const x = ins.parcel;
    this.inspection = null;
    this.reveal(x);
    // Sent only now, because the check copy carries the answer the player was judging.
    const verdicts = {
      shipright: `${x.w.child}'s ${x.w.wanted.name} was just right. Shipped.`,
      shipwrong: `Oops: ${x.w.child} wanted ${a(x.w.wanted.name)}, not ${a(x.made.name)}.`,
      remakewrong: `Good catch: ${x.w.child} wanted ${a(x.w.wanted.name)}, not ${a(x.made.name)}.`,
      remakeright: `${x.w.child}'s ${x.w.wanted.name} was fine, but it goes back to be remade.`,
    };
    this.say("checked", verdicts[choice + x.result], {
      check: this.copy(x, INSPECT_SECONDS, "player"),
    });
    if (choice === "ship") this.load(x);
    else if (x.wrong) this.caught(x);
    else this.toRework(x, REMAKE);
    return true;
  }

  train() {
    if (this.why("train")) return false;
    this.training = TRAINING_SECONDS;
    this.pay("people", PRICE.train);
    this.used("train");
    return true;
  }

  rollback() {
    if (this.why("rollback")) return false;
    this.incident.rollingBack = ROLLBACK_SECONDS;
    this.stats.rolledBack = true;
    this.pay("fixing", PRICE.rollback);
    this.used("rollback");
    return true;
  }

  quarantine() {
    if (this.why("quarantine")) return false;
    const marked = this.marked();
    this.queues[2] = this.queues[2].filter((x) => !marked.includes(x));
    marked.forEach((x) => {
      x.held = true;
      this.toRework(x, REMAKE);
    });
    this.pay("fixing", PRICE.quarantine);
    this.say(
      "quarantined",
      `${marked.length} marked parcels went back to be remade. Dispatch waits for them.`,
      { count: marked.length },
    );
    this.used("quarantine");
    return true;
  }

  recall() {
    if (this.why("recall")) return false;
    const wrong = this.aboard.filter((x) => x.wrong);
    this.aboard = this.aboard.filter((x) => !x.wrong);
    wrong.forEach((x) => this.toRework(x, RECALL));
    this.pay("fixing", PRICE.recall);
    this.say(
      "recalled",
      `${wrong.length} wrong gifts came back off the sleigh to be remade.`,
      { count: wrong.length },
    );
    this.used("recall");
    return true;
  }

  // Why a control cannot be used now, or null when it can.
  why(name) {
    if (!this.unlocked.has(name)) return "Unlocks later in this run";
    if (this.end) return "The sleigh has left";
    if (PAID.includes(name) && this.left() <= 0) return "Out of money";
    const inc = this.incident;
    switch (name) {
      case "inspect":
        if (this.inspection) return "Decide on the open parcel first";
        if (!this.staff(2).length) return "No checker at dispatch";
        return this.queues[2].length ? null : "No parcels waiting";
      case "train":
        return this.trained
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
    const each = (work) =>
      `about ${Math.round(work / CHECKER_SPEED)} seconds and ${money(PRICE.remake)} each`;
    const marked = this.marked().length;
    const wrong = this.aboard.filter((x) => x.wrong).length;
    return {
      ai0: `faster reading but more misread wishes; ${perMinute(1)} a minute on assist, ${perMinute(2)} on automate`,
      ai1: `faster toys but more wrong ones; ${perMinute(1)} a minute on assist, ${perMinute(2)} on automate`,
      checking: `each check takes an elf about ${Math.round(CHECK / CHECKER_SPEED)} seconds and costs ${money(PRICE.check)}`,
      ask: "unclear letters take longer to read",
      inspect: `takes a checker for ${INSPECT_SECONDS} seconds, costs ${money(PRICE.inspect)}`,
      train: `halves checking speed for ${TRAINING_SECONDS} seconds, costs ${money(PRICE.train)}`,
      rollback: `stops the toy line for ${ROLLBACK_SECONDS} seconds, costs ${money(PRICE.rollback)}`,
      quarantine: `remakes ${marked || "the"} marked parcels, ${each(REMAKE)}, plus ${money(PRICE.quarantine)}`,
      recall: `remakes ${wrong || "the"} wrong gifts, ${each(RECALL)}, plus ${money(PRICE.recall)}`,
    }[name];
  }

  // A parcel as the page may see it: the answer stays hidden until a check or loading reveals it.
  parcel(x) {
    const opened =
      this.inspection?.parcel === x && this.inspection.remaining === 0;
    return {
      id: x.id,
      wish: x.w.wish,
      big: x.w.big,
      wanted: x.result ? { ...x.w.wanted } : null,
      made: x.result || opened ? { ...x.made } : null,
      suspect: this.suspect(x),
      result: x.result,
    };
  }

  station(s) {
    const line = this.next(s);
    return {
      waiting: this.queues[s].map((x) => this.parcel(x)),
      limit: this.limits[s],
      staff: this.staff(s).length,
      rate: Math.round(this.rates()[s] * 100) / 100,
      progress: line ? Math.min(1, this.work[s] / this.cost(s, line[0])) : 0,
      blocked: this.blocked(s),
    };
  }

  view() {
    const inc = this.incident;
    const ins = this.inspection;
    return {
      t: this.t,
      duration: this.duration,
      target: this.target,
      hint: this.hint && { ...this.hint },
      elves: this.elves.map((e) => ({
        name: e.name,
        station: e.station,
        tired: Math.round(e.tired),
        resting: e.rest > 0,
      })),
      ai: [...this.ai],
      checking: this.checking,
      ask: this.ask,
      levers: this.levers(),
      stations: [0, 1, 2].map((s) => this.station(s)),
      rework: this.rework.length,
      dispatchHeld: this.rework.some((x) => x.held),
      inspection: ins && {
        parcel: this.parcel(ins.parcel),
        remaining: ins.remaining,
        duration: INSPECT_SECONDS,
        ready: ins.remaining === 0,
      },
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
