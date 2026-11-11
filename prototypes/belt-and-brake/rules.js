// Rules and state for one run of Belt and Brake; never touches the page.
class BeltGame {
  static LEVELS = [
    { name: "By hand", icon: "✋", rate: 0.5, wrong: 0, travel: 8 },
    { name: "AI assist", icon: "🤖", rate: 1, wrong: 0.15, travel: 6 },
    { name: "Full auto", icon: "⚡", rate: 2.2, wrong: 0.3, travel: 4.5 },
  ];
  static WAVE_ENDS = [15, 55, 95];
  static FAULT_DELAY = 3;
  static FAULT_SHARE = 0.85;
  static BRAKE_SECONDS = 4;
  static TARGET = 60;
  static WRONG_COST = 2;
  static COAL = ["🪨", "lump of coal", "Coal?! I was good all year!"];
  // [child, wish, right toy, right label, wrong toy, wrong label, reaction]
  static WISHES = [
    [
      "Noah",
      "a teddy to cuddle",
      "🧸",
      "teddy bear",
      "🐻",
      "real bear cub",
      "It's growling at me!",
    ],
    [
      "Timmy",
      "a little train",
      "🚂",
      "toy train",
      "🚆",
      "full-size train",
      "It won't fit in my room!",
    ],
    [
      "Leo",
      "a computer mouse",
      "🖱️",
      "computer mouse",
      "🐭",
      "pet mouse",
      "It ran under the sofa!",
    ],
    [
      "Oliver",
      "a toy rocket",
      "🚀",
      "toy rocket",
      "🎆",
      "box of fireworks",
      "Dad says it lives outside now.",
    ],
    [
      "Ella",
      "bricks, no screens",
      "🧱",
      "toy bricks",
      "📱",
      "tablet game",
      "I said NO screens!",
    ],
    [
      "Finn",
      "a dinosaur book",
      "📕",
      "dinosaur book",
      "🦖",
      "real T. rex",
      "It ate the garden!",
    ],
    [
      "Grace",
      "a little drum",
      "🥁",
      "toy drum",
      "🛢️",
      "oil drum",
      "It's full of oil!",
    ],
    [
      "Isla",
      "a snowman kit",
      "⛄",
      "snowman kit",
      "💧",
      "puddle",
      "It's just... wet.",
    ],
    [
      "Amir",
      "a cosy jumper",
      "🧥",
      "woolly jumper",
      "🦘",
      "kangaroo",
      "It keeps hopping away!",
    ],
    [
      "Ava",
      "a cricket bat",
      "🏏",
      "cricket bat",
      "🦗",
      "real cricket",
      "It chirps all night!",
    ],
    [
      "Mia",
      "a rocking horse",
      "🎠",
      "rocking horse",
      "🐎",
      "racehorse",
      "It galloped off!",
    ],
    [
      "Sofia",
      "a painting set",
      "🎨",
      "painting set",
      "🪣",
      "tin of wall paint",
      "That's for walls!",
    ],
    ["Max", "a red bike", "🚲", "red bike", "🏍️", "motorbike", "I'm seven!"],
  ];

  constructor(seed) {
    this.seed = seed >>> 0;
    this.t = 0;
    this.level = 0;
    this.gifts = [];
    this.nextId = 1;
    this.lastWish = 0;
    this.spawnDue = 0.7; // the first gift appears straight away
    this.fault = false;
    this.faultAt = null;
    this.brakeLeft = 0;
    this.brakedAt = null;
    this.good = 0;
    this.bad = 0;
    this.caught = 0;
    this.pulledGood = 0;
    this.coalMade = 0;
    this.coalAfterBrake = 0;
    this.events = [];
    this.done = false;
  }

  random() {
    this.seed = (Math.imul(1664525, this.seed) + 1013904223) >>> 0;
    return this.seed / 4294967296;
  }

  get duration() {
    return BeltGame.WAVE_ENDS[2];
  }

  get wave() {
    const i = BeltGame.WAVE_ENDS.findIndex((end) => this.t < end);
    return i < 0 ? 2 : i;
  }

  get score() {
    return this.good - BeltGame.WRONG_COST * this.bad;
  }

  setLevel(level) {
    if (this.wave > 0 && !this.done) this.level = level;
  }

  brake() {
    if (this.wave < 2 || this.brakeLeft > 0 || this.done) return;
    this.brakeLeft = BeltGame.BRAKE_SECONDS;
    if (this.fault) {
      this.fault = false;
      this.brakedAt = this.t;
    }
    this.events.push({ type: "brake" });
  }

  pull(id) {
    const gift = this.gifts.find((g) => g.id === id);
    if (!gift || this.done) return;
    this.gifts = this.gifts.filter((g) => g !== gift);
    if (gift.wrong) this.caught++;
    else this.pulledGood++;
    this.events.push({ type: "pulled", gift });
  }

  tick(dt) {
    if (this.done) return;
    const waveBefore = this.wave;
    const level = BeltGame.LEVELS[this.level];
    this.t = Math.min(this.t + dt, this.duration);
    if (
      this.faultAt === null &&
      this.t >= BeltGame.WAVE_ENDS[1] + BeltGame.FAULT_DELAY
    ) {
      this.fault = true;
      this.faultAt = this.t;
    }
    if (this.brakeLeft > 0) {
      this.brakeLeft = Math.max(0, this.brakeLeft - dt);
    } else {
      this.spawnDue += dt * level.rate;
      for (; this.spawnDue >= 1; this.spawnDue--) this.spawn();
    }
    for (const gift of this.gifts) gift.pos += dt / level.travel;
    for (const gift of this.gifts.filter((g) => g.pos >= 1)) this.deliver(gift);
    this.gifts = this.gifts.filter((g) => g.pos < 1);
    if (this.wave !== waveBefore)
      this.events.push({ type: "wave", wave: this.wave });
    if (this.t >= this.duration) {
      this.done = true;
      this.events.push({ type: "end" });
    }
  }

  spawn() {
    // Every spawn draws the same three numbers, so a seed fixes the order of wishes and rolls.
    const n = BeltGame.WISHES.length;
    const wish = (this.lastWish + 1 + Math.floor(this.random() * (n - 1))) % n;
    const wrongRoll = this.random();
    const faultRoll = this.random();
    const faulty =
      this.fault && this.level > 0 && faultRoll < BeltGame.FAULT_SHARE;
    const wrong = faulty || wrongRoll < BeltGame.LEVELS[this.level].wrong;
    this.lastWish = wish;
    if (faulty) this.coalMade++;
    this.gifts.push({
      id: this.nextId,
      wish,
      wrong,
      faulty,
      lane: this.nextId % 2,
      pos: 0,
    });
    this.nextId++;
  }

  deliver(gift) {
    if (gift.wrong) this.bad++;
    else this.good++;
    if (gift.faulty && this.brakedAt !== null) this.coalAfterBrake++;
    this.events.push({ type: "delivered", gift });
  }

  takeEvents() {
    const events = this.events;
    this.events = [];
    return events;
  }

  // The end-screen lesson, picked from what the player did rather than from luck.
  lesson() {
    const lateBrake =
      this.brakedAt === null || this.brakedAt - this.faultAt > 10;
    if (lateBrake && this.coalMade >= 5) return "noBrake";
    if (this.pulledGood >= 5 && this.pulledGood * 2 >= this.caught)
      return "overChecked";
    if (this.coalAfterBrake >= 3) return "leftovers";
    if (this.bad >= 6) return "flatOut";
    if (this.score >= BeltGame.TARGET) return "balanced";
    return "tooSlow";
  }
}
