// Every text the page can show is complete, plain British English (ADR 0021): no semicolons, no
// "s" standing for seconds inside a sentence, and none of the clipped fragments the copyedit of
// November 2026 replaced. None says or implies that more AI means more mistakes in general
// (ADR 0019): the AI is as reliable as a fresh elf on everyday gifts and poor on big ones, and the
// words say where. Seeded games are played with different habits, through half-time and to the
// end screen, and every string anywhere in view() is read at each step.
const assert = require("assert");
const fs = require("fs");
const vm = require("vm");
const path = require("path");
vm.runInThisContext(
  fs.readFileSync(path.join(__dirname, "../game/workshop.js"), "utf8"),
);

// The old framing, and words that are gone: more AI as more mistakes, the AI as careless, Assist
// asked for as a general remedy, and a slip shown as the right toy in the wrong size.
const BANNED = [
  /Tiredness here is/,
  /;/,
  /\bAI\b[^.]*\bmakes? more mistakes/i,
  /more AI\b[^.]*\bmistakes/i,
  /the more the AI/i,
  /AI slips more/i,
  /AI (is|was) (stupid|dumb|careless|sloppy)/i,
  /check what it makes/i,
  /Drop to Assist/,
  /an elf confirms each\.$/,
  /wrong size/i,
  /cost limit/i,
];
// The clipped wordings the copyedit replaced. Each is distinctive enough that no approved text
// contains it, so any of them coming back is a regression.
const OLD_WORDING = [
  /^Budget running low/,
  /needs another elf/,
  /^Assist for big gifts$/,
  /matches a fresh elf here/,
  /and each costs £/,
  /^nobody (reading|making toys)$/,
  /^no checkers here$/,
  /^the [a-z-]+ pile is full$/,
  /^rolling back the update$/,
  /while fresh$/,
  /[^e] same as a fresh elf/,
  /an elf catches most/,
  /^Elves do it$/,
  /^AI drafts, an elf confirms each$/,
  /^AI works alone$/,
  /the slow, steady way/,
  /needs elves to confirm/,
  /works without any elves/,
  /no elves here to (work|confirm)$/,
  /tired elves slip:/,
  /confirmers at/,
  /faulty update: same wrong toy/,
  /The risky ones/,
  /the risky ones/,
  /elves check /,
  /a minute on Assist/,
  /Santa's name/,
  /^To bring back$/,
  /In your cost now/,
  /^Trains so far$/,
  /£[\d,]+ if wrong/,
  /No mistake counted/,
  /Counts as \d+ of \d+ mistakes/,
  /star (saved|lost)/,
  /^not enough budget left$/,
  /^no elf at Checking$/,
  /^no time before/,
  /more, checkers busy/,
  /^nothing more$/,
  /^back to \d+ toys a minute$/,
  /^about \d+ trains a minute/,
  /^AI toys /,
  /installs at \d+ s/,
  /Checkers stop trusting the AI blindly/,
  /every elf half as tired/,
  /No change, nothing spent/,
  /\d+ AI gifts through/,
  /look closely at AI gifts/,
  /Slow, and wrong/,
  /^Checks took /,
  /half-time change/,
  /then burn out for a long break/,
  /costs most: the big gifts/,
  /likely or dear,/,
  /however good the checks\.$/,
  /letters? lost(\.| in full piles)/,
  /held things up longest/,
  /While its decision waited/,
  /wrong-gift cost/,
  /made the sleigh\b/,
  /after they were spotted/,
  /as soon as it shows/,
  /tired ones let /,
  /before they are worn out/,
  /long clean stretches/,
  /It went where a mistake/,
  /right gifts on time/,
  /each was off for/,
  /fell short\. Let/,
  /rest the checkers before they tire/,
  /Test before release, keep/,
  /defer to AI/,
  /^Assist for \d/,
  /^decided \d/,
  /^the test /,
  /^no update installed$/,
  /^not tested:/,
  /^rolled back after/,
  /^ran to the end:/,
  /^left aboard$/,
  /^not needed$/,
  /cost Santa trust/,
  /missed (its|their) sleigh/,
  /Rare AI slips/,
  /Wrong gift: /,
  /send them for cocoa\./,
  /Keep going: /,
  /Check all for a while/,
  /Rest the checkers: /,
  /Swap the /,
  /^Caught: /,
  /^Checked: /,
  /letter goes on: /,
  /has stopped: /,
  /Letter pile full/,
  /pile clear\.$/,
  /right gifts: the target/,
  /^\d+ right gifts so far/,
  /Faulty update: /,
  /^Installed: /,
  /^Update installed on/,
  /Testing the update: /,
  /Test failed: /,
  /Rolling back for £/,
  /Rollback done/,
  /Kept running: /,
  /more than leaving: /,
  /gifts? brought back to be remade/,
  /stays in your cost/,
  /^Brought back: /,
  /last \d+ s: /,
  /burnt out: off/,
  /for cocoa or swap/,
  /^Half-time: /,
  /Trained the checkers for £[\d,]+: /,
  /Checkers trained: /,
  /Cocoa for everyone for £/,
  /^Carried on with/,
  /The sleigh is away: /,
  /The sleigh leaves now: /,
  /^(Too little|Too much) checking: /,
  /Checking was about right: /,
  /puppy toy/,
  /real queen\.$/,
  /budget left, wrong gifts count/,
  /^(loading|remaking)$/,
  // The wordings an outside reviewer's round of November 2026 replaced, and the names it changed:
  // "correct gifts", Minimal mistakes, the Random and Riskiest checking levels, the elf Candy.
  /\bright gifts?\b/i,
  /Few mistakes/,
  /^A few$/,
  /\bRisky\b/,
  /\brisky gifts\b/i,
  /checking a few,/,
  /\bCoco\b/,
  /needs? a person/i,
  /no person looking/,
  /Put a person on/,
  /It goes back to be remade/,
  /^A wrong gift is aboard\./,
  /On everyday gifts, the AI slips/,
  /^The faulty update is making/,
  /^Bring \d+ back$/,
  /makes proper toys again/,
  /^(Letters|Toys) has stopped/,
  /^try the AI$/,
  /the ones the AI flagged/,
  /putting them right/,
  /keep some of the £/,
  /counting the cost of wrong gifts/,
  /^Install the update$/,
  /^Test the update first$/,
  /confirming the AI's readings/,
  /fresh elf on these gifts/,
  /of these wrong, and each wrong one/,
  /(checked and is|brought back was|checked gift was) right\b/,
  // The practice names the same round replaced.
  /^Human in the loop$/,
  /^Risk-based checking$/,
  /^Ask a person when unsure$/,
  /^Test before release and keep a way back$/,
  /^Keep human oversight sharp$/,
  // Wordings the user settled after the round: "wrong", not "incorrect", and the hot-fix update's
  // signs as its makers' word.
  /\bincorrect\b/i,
  /Each one costs/,
  /of them wrong, and each wrong one/,
  /change that was tested/,
];
// Page texts the same round replaced. The page builds them in game.js and index.html, outside
// view(), so the two files are read as they stand, with line breaks folded to single spaces.
const PAGE_OLD_WORDING = [
  /Find the balance\./,
  /checks keep it right/,
  /Show the walkthrough/,
  /Open the workshop/,
  /Christmas Eve at the workshop/,
  /Start this Christmas again\?/,
  /"AI switch"/,
  /"Checking",\s+text:/,
  /"Sleigh",\s+text:/,
  /big gifts need a person/i,
  /Tired checkers miss more\./,
  /right gifts? aboard/,
  /: "Decide"/,
  /"The AI works alone"/,
  /"The clock"/,
  /It shows the time left before the sleigh leaves/,
  /The sleigh may carry/,
  /and now lets some wrong ones through/,
  /Right gifts count towards/,
  /makes them fresh again/,
  /They wait here for an elf/,
  /Elves here check gifts/,
  /The pile here is growing/,
  /Checking a few gifts/,
  /"risky gifts"/,
  /\["A few", "Risky"/,
  /\bright gifts?\b/i,
  /Few mistakes/,
  /\^keep\\b/,
  /<span class="eyebrow">Christmas morning</,
  /\bincorrect\b/i,
  /Check your progress and pick an upgrade/,
  /\["by hand", "Assist", "Automate"\]/,
];
// "4 s" for four seconds is a counter's shorthand. It stays on the end screen's practice figures,
// which are counters, and nowhere else: a sentence says "seconds".
const SECONDS_SHORT = /\d s\b/;
const COUNTER = /^view\.end\.practices\.\d+\.actions\.\d+\.figure$/;
for (const file of ["game.js", "index.html"]) {
  const source = fs
    .readFileSync(path.join(__dirname, "../game", file), "utf8")
    .replace(/\s+/g, " ");
  for (const old of PAGE_OLD_WORDING)
    assert(
      !old.test(source),
      `game/${file} still has a replaced text (${old})`,
    );
}
let read = 0;
// Every level tooltip text met in play, to show the check reached them.
const levelTips = new Set();
// A text already read in the same kind of place is not read again: the games repeat most of them.
const passed = new Set();
const ALL_BANNED = [...BANNED, ...OLD_WORDING];
function strings(value, where, name) {
  if (typeof value === "string") {
    read++;
    const counter = COUNTER.test(where.replace(/^[a-z ]+\./, "view."));
    const key = `${counter}${value}`;
    if (passed.has(key)) return;
    for (const banned of ALL_BANNED)
      assert(!banned.test(value), `${name}, ${where}: ${value} (${banned})`);
    assert(
      !SECONDS_SHORT.test(value) || counter,
      `${name}, ${where}: "s" for seconds in: ${value}`,
    );
    // A level button's tooltip is two short sentences, read while the clock runs.
    if (/\.levers\.ai[01]\.\d+\.summary$/.test(where)) {
      assert(
        value.split(/(?<=[.!?])\s+/).length <= 2 &&
          value.split(/\s+/).length <= 25 &&
          !/Tiredness here/.test(value),
        `${name}, ${where}: a level tooltip of two sentences and about twenty words: ${value}`,
      );
      levelTips.add(value);
    }
    passed.add(key);
  } else if (value && typeof value === "object")
    for (const [key, inner] of Object.entries(value))
      strings(inner, `${where}.${key}`, name);
}

// How each player answers what comes up. Half-time picks go round all five options over the seeds.
const HALF_TIME = ["update", "tested", "train", "rest", "none"];
const players = [
  { name: "by hand, few checks", ai: [0, 0], checking: 0, pick: 1 },
  {
    name: "assist, risky checks",
    ai: [1, 1],
    checking: 1,
    pick: 0,
    rests: true,
  },
  { name: "automate, few checks, recalls", ai: [2, 2], checking: 0, pick: 0 },
  {
    name: "automate, all checks",
    ai: [2, 2],
    checking: 2,
    pick: 1,
    rests: true,
  },
  { name: "automate, leaves cards", ai: [2, 1], checking: 0, pick: null },
  {
    name: "automate, then assist and risky checks",
    ai: [2, 2],
    checking: 0,
    pick: 0,
    rests: true,
    second: { ai: [1, 1], checking: 1 },
  },
];

const seen = {
  halfTime: 0,
  unclear: 0,
  recall: 0,
  incident: 0,
  end: 0,
  budget: 0,
};
for (let seed = 1; seed <= 10; seed++)
  for (const [n, p] of players.entries()) {
    const w = new Workshop({ seed });
    const name = `seed ${seed}, ${p.name}`;
    w.setAi(0, p.ai[0]);
    w.setAi(1, p.ai[1]);
    w.setChecking(p.checking);
    if (p.ai[0] === 2)
      w.elves.forEach((e, i) => e.station === 0 && w.move(i, 2));
    while (!w.end) {
      w.step(0.5);
      const v = w.view();
      strings(v, "view", name);
      if (v.choice) {
        seen.halfTime++;
        w.choose(HALF_TIME[(seed + n) % HALF_TIME.length]) || w.choose("none");
        if (p.second) {
          w.setAi(0, p.second.ai[0]);
          w.setAi(1, p.second.ai[1]);
          w.setChecking(p.second.checking);
          w.elves.forEach((e, i) => i < 6 && w.move(i, i < 3 ? 0 : 1));
        }
        strings(w.view(), "after half-time", name);
      }
      if (v.case && p.pick !== null) {
        const kind = v.case.kind === "unclear" ? "unclear" : v.case.step;
        seen[
          kind === "aboard"
            ? "recall"
            : kind === "unclear"
              ? "unclear"
              : "incident"
        ]++;
        const open = v.case.options.filter((o) => o.available);
        const option = open[Math.min(p.pick, open.length - 1)];
        if (option) w.resolve(v.case.id, option.id);
        strings(w.view(), "after a decision", name);
      }
      if (p.rests)
        w.elves.forEach(
          (e, i) => e.station < 3 && e.tired >= 80 && w.move(i, 3),
        );
    }
    seen.end++;
    if (w.view().end.reason === "budget") seen.budget++;
    strings(w.view(), "end", name);
  }

assert(
  levelTips.size >= 5,
  `only ${levelTips.size} level tooltip texts were read`,
);
for (const [what, count] of Object.entries(seen))
  assert(count > 0, `the games reached no ${what}`);
console.log(
  `wording check passed: ${read} strings read, ${Object.entries(seen)
    .map(([what, count]) => `${count} ${what}`)
    .join(", ")}`,
);
