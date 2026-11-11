// Plays fixed strategies over many seeds: node balance-check.js
const fs = require("fs");
const vm = require("vm");
const CheckerRota = vm.runInThisContext(
  fs.readFileSync(__dirname + "/rules.js", "utf8") + "\nCheckerRota",
);

// Each strategy gives, per night, checkers per line and which lines run by hand.
const strategies = {
  "No checkers": () => [[0, 0, 0]],
  "Even spread": (n) => [n === 3 ? [1, 1, 1] : [1, 1, 2]],
  "All on bikes": (n) => [n === 3 ? [0, 0, 3] : [0, 0, 4]],
  "Everything by hand": (n) => [n === 0 ? [1, 1, 2] : [0, 0, 0], [0, 1, 2]],
  "Adaptive, checkers only": (n) =>
    [[[0, 2, 2]], [[0, 3, 1]], [[3, 0, 1]], [[0, 1, 2]], [[0, 0, 4]]][n],
  "Adaptive, with switches": (n) =>
    [[[0, 2, 2]], [[0, 3, 1]], [[0, 2, 2], [0]], [[0, 1, 2]], [[0, 0, 4]]][n],
};

function play(strategy, seed) {
  const game = new CheckerRota(seed);
  while (game.phase !== "end") {
    const [checkers, byHand = []] = strategy(game.night);
    game.checkers = [0, 0, 0];
    checkers.forEach((n, line) => {
      for (let i = 0; i < n; i++) game.addChecker(line);
    });
    byHand.forEach((line) => game.ai[line] && game.toggleAI(line));
    game.ai.forEach(
      (on, line) => !on && !byHand.includes(line) && game.toggleAI(line),
    );
    game.go();
    while (game.phase === "night") game.tick(0.1);
    game.nextNight();
  }
  return game;
}

const seeds = Array.from({ length: 200 }, (_, i) => i + 1);
const rows = Object.entries(strategies).map(([name, strategy]) => {
  const games = seeds.map((seed) => play(strategy, seed)),
    scores = games.map((g) => g.score).sort((a, b) => a - b),
    nights = [0, 1, 2, 3, 4].map((n) =>
      Math.round(
        games.reduce((a, g) => a + g.history[n].points, 0) / games.length,
      ),
    );
  return {
    strategy: name,
    "seed 2512": play(strategy, 2512).score,
    mean: Math.round(scores.reduce((a, b) => a + b) / scores.length),
    min: scores[0],
    max: scores[scores.length - 1],
    "reach target":
      Math.round(
        (100 * scores.filter((s) => s >= CheckerRota.TARGET).length) /
          scores.length,
      ) + "%",
    "per night": nights.join(" / "),
    lesson: play(strategy, 2512).lesson().slice(0, 40),
  };
});
console.log(`Target ${CheckerRota.TARGET}, ${seeds.length} seeds`);
console.table(rows);
