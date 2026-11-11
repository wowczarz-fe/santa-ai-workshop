// Plays scripted strategies against rules.js over several seeds: node balance-check.js
const fs = require("fs");
const vm = require("vm");
vm.runInThisContext(
  fs.readFileSync(`${__dirname}/rules.js`, "utf8") +
    "\nglobalThis.BeltGame = BeltGame;",
);

// A player who can look at `attention` gifts per second, nearest the sleigh first,
// pulls the wrong ones (and a share `jumpy` of the right ones), and brakes `brakeAfter`
// seconds after first seeing coal.
function play(seed, { lever, attention = 0, brakeAfter = null, jumpy = 0 }) {
  const game = new BeltGame(seed);
  const seen = new Set();
  let focus = 0;
  let coalSeenAt = null;
  let jumps = 0;
  while (!game.done) {
    const unseen = game.gifts.filter((g) => !seen.has(g.id) && g.pos < 0.97);
    game.setLevel(lever(unseen.length, game));
    focus = Math.min(focus + 0.05 * attention, 1.5);
    for (const gift of unseen.sort((a, b) => b.pos - a.pos)) {
      if (focus < 1) break;
      focus--;
      seen.add(gift.id);
      if (gift.faulty && coalSeenAt === null) coalSeenAt = game.t;
      if (gift.wrong || (jumps += jumpy) >= 1) {
        if (!gift.wrong) jumps--;
        game.pull(gift.id);
      }
    }
    if (
      brakeAfter !== null &&
      coalSeenAt !== null &&
      game.brakedAt === null &&
      game.t >= coalSeenAt + brakeAfter
    )
      game.brake();
    game.tick(0.05);
  }
  return game;
}

// Slow down while the update is unproven or the belt is backed up; speed up when it is clear.
const adaptive = (unseen, game) =>
  game.wave === 2 && game.brakedAt === null
    ? 1
    : unseen <= 1
      ? 2
      : unseen >= 5
        ? 0
        : 1;
const strategies = {
  "Always by hand": { lever: () => 0 },
  "Full auto, never pulls or brakes": { lever: () => 2 },
  "AI assist, never pulls or brakes": { lever: () => 1 },
};
for (const attention of [1, 1.4, 2]) {
  const player = { attention, brakeAfter: 1 };
  strategies[`Assist, checks ${attention}/s, brakes`] = {
    ...player,
    lever: () => 1,
  };
  strategies[`Full auto, checks ${attention}/s, brakes`] = {
    ...player,
    lever: () => 2,
  };
  strategies[`Adaptive, checks ${attention}/s, brakes`] = {
    ...player,
    lever: adaptive,
  };
}
strategies["Assist, checks 1.4/s, never brakes"] = {
  attention: 1.4,
  lever: () => 1,
};
strategies["Assist, checks 1.4/s, pulls 1 in 4 good"] = {
  attention: 1.4,
  brakeAfter: 1,
  jumpy: 0.25,
  lever: () => 1,
};

const seeds = [1225, 1, 2, 3, 4, 5, 6, 7, 8, 9];
console.log(
  `Target ${BeltGame.TARGET}. Score = good - ${BeltGame.WRONG_COST} x wrong. Seeds: ${seeds.join(", ")}\n`,
);
console.log(
  "strategy".padEnd(42) +
    "min   mean  max   good  wrong caught pulledGood  lesson",
);
for (const [name, strategy] of Object.entries(strategies)) {
  const runs = seeds.map((seed) => play(seed, strategy));
  const mean = (key) =>
    (runs.reduce((sum, g) => sum + g[key], 0) / runs.length)
      .toFixed(1)
      .padEnd(6);
  const scores = runs.map((g) => g.score);
  const lessons = [...new Set(runs.map((g) => g.lesson()))].join("/");
  console.log(
    name.padEnd(42) +
      String(Math.min(...scores)).padEnd(6) +
      mean("score") +
      String(Math.max(...scores)).padEnd(6) +
      mean("good") +
      mean("bad") +
      mean("caught") +
      mean("pulledGood").padEnd(12) +
      lessons,
  );
}
