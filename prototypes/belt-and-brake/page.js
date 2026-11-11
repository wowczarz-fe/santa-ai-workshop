// Draws a BeltGame on the page and turns taps into BeltGame calls.
(() => {
  "use strict";
  const $ = (id) => document.getElementById(id);
  const seed = Number(new URLSearchParams(location.search).get("seed")) || 1225;
  const target = BeltGame.TARGET;
  const waves = [
    "The elves make every gift right, but far too slowly for Christmas. The lever unlocks soon.",
    "Push the lever up for speed, and tap any gift that doesn't match its wish.",
    "A new AI update just landed. If the machine starts making the same wrong toy, hit the brake.",
  ];
  const waveTitles = ["Wave 1: By hand", "Wave 2: AI on", "Wave 3: New update"];
  const lessons = {
    noBrake: () =>
      "When the bad update hit, the machine kept making coal. If an AI starts making the same mistake over and over, stop it first, then clear what it already made.",
    overChecked: (g) =>
      `You pulled ${g.pulledGood} good gifts off the belt. Checking costs something too: pull gifts you have actually looked at, not everything that moves.`,
    leftovers: (g) =>
      `You stopped the bad update, but ${g.coalAfterBrake} lumps of coal already on the belt still reached children. Braking stops new mistakes; the ones already made still need clearing.`,
    flatOut: (g) =>
      `Speed made more gifts, and more mistakes: ${g.bad} wrong gifts reached children. The AI's speed only pays when your checking can keep up with it.`,
    balanced: () =>
      "You used the AI's speed, kept your eyes on the belt, and stopped the machine when the update went bad. That is the skill: match the checking to the risk.",
    tooSlow: () =>
      "You kept mistakes low, but too few gifts were ready when the sleigh left. Holding the AI back has a cost too: use its speed where you can still check.",
  };
  const cards = new Map();
  let game = new BeltGame(seed);
  let running = false;
  let last = 0;
  let stripe = "";

  $("target").textContent = target;
  $("lever").insertAdjacentHTML(
    "beforeend",
    BeltGame.LEVELS.map(
      (l, i) => `<button data-level="${i}"><b>${l.icon}</b>${l.name}</button>`,
    ).join(""),
  );

  const article = (label) => (/^[aeiou]/.test(label) ? "an " : "a ") + label;
  function toyOf(gift) {
    const wish = BeltGame.WISHES[gift.wish];
    if (gift.faulty) return BeltGame.COAL;
    return gift.wrong ? [wish[4], wish[5], wish[6]] : [wish[2], wish[3], ""];
  }

  function cardFor(gift) {
    if (cards.has(gift.id)) return cards.get(gift.id);
    const [toy, label] = toyOf(gift);
    const card = document.createElement("button");
    card.className = `gift lane${gift.lane}`;
    card.dataset.id = gift.id;
    card.innerHTML = `<span class="wish">${BeltGame.WISHES[gift.wish][1]}</span><span class="toy"><b>${toy}</b>${label}</span>`;
    $("track").append(card);
    cards.set(gift.id, card);
    restart($("machine"), "bump");
    return card;
  }

  // Re-adding a class replays its CSS animation.
  function restart(el, cls) {
    el.classList.remove(cls);
    void el.offsetWidth;
    el.classList.add(cls);
  }

  function float(parent, text, cls, top, left) {
    const el = document.createElement("span");
    el.className = `float ${cls}`;
    el.textContent = text;
    el.style.top = top;
    el.style.left = left;
    parent.append(el);
    el.addEventListener("animationend", () => el.remove());
  }

  function drop(card, cls, ms) {
    cards.delete(+card.dataset.id);
    card.classList.add(cls);
    setTimeout(() => card.remove(), ms);
  }

  function react(gift) {
    const [toy, label, says] = toyOf(gift);
    const el = document.createElement("div");
    el.className = "reaction";
    el.innerHTML = `<b>${toy}</b><span><strong>${BeltGame.WISHES[gift.wish][0]} got ${article(label)}.</strong> "${says}"</span><em>-${BeltGame.WRONG_COST}</em>`;
    $("reactions").append(el);
    while ($("reactions").children.length > 2)
      $("reactions").firstElementChild.remove();
    setTimeout(() => el.remove(), 2800);
    restart($("score"), "hurt");
  }

  function handle(event) {
    const { type, gift } = event;
    if (type === "pulled") {
      const card = cards.get(gift.id);
      if (!card) return;
      float(
        $("track"),
        gift.wrong ? "Caught! 🎉" : "That one was fine 😬",
        gift.wrong ? "good" : "oops",
        card.style.top,
        card.offsetLeft + "px",
      );
      drop(card, gift.wrong ? "caught" : "oops", 450);
    } else if (type === "delivered") {
      const card = cards.get(gift.id);
      if (card) drop(card, "shipped", 250);
      if (gift.wrong) react(gift);
      else {
        float($("sleigh"), "+1", "good", "0", 30 + 40 * gift.lane + "%");
        restart($("sleigh"), "bounce");
        restart($("score"), "pop");
      }
    } else if (type === "brake") {
      restart($("belt"), "shake");
    } else if (type === "wave") {
      running = false;
      show(
        `<h2>${waveTitles[event.wave]}</h2><p>${waves[event.wave]}</p><button class="go" data-go>Go</button>`,
      );
    } else if (type === "end") {
      running = false;
      showEnd();
    }
  }

  function draw() {
    const level = BeltGame.LEVELS[game.level];
    const remaining = Math.ceil(game.duration - game.t);
    $("score").textContent = game.score;
    $("fill").style.width =
      Math.max(0, Math.min(100, (game.score / target) * 100)) + "%";
    $("fill").classList.toggle(
      "ahead",
      game.score >= (target * game.t) / game.duration,
    );
    $("pace").style.left = (game.t / game.duration) * 100 + "%";
    $("clock").textContent =
      `${Math.floor(remaining / 60)}:${String(remaining % 60).padStart(2, "0")}`;
    $("instruction").innerHTML =
      `<b>${waveTitles[game.wave]}.</b> ${waves[game.wave]}`;
    $("lever").style.setProperty("--level", game.level);
    $("lever").classList.toggle("locked", game.wave === 0);
    for (const b of $("lever").querySelectorAll("button"))
      b.setAttribute("aria-pressed", +b.dataset.level === game.level);
    $("brake").hidden = game.wave < 2;
    $("brake").disabled = game.brakeLeft > 0;
    $("brake").lastChild.textContent =
      game.brakeLeft > 0 ? `Stopped ${Math.ceil(game.brakeLeft)}` : "Brake";
    $("status").textContent =
      game.brakeLeft > 0 ? "stopped" : `${level.icon} ${level.name}`;
    document.body.dataset.speed = game.brakeLeft > 0 ? "stopped" : game.level;

    const room = $("track").clientHeight;
    for (const gift of game.gifts) {
      const card = cardFor(gift);
      card.style.top = gift.pos * (room - card.offsetHeight) + "px";
    }
    const stripeNow = (48 * level.travel) / Math.max(room - 90, 100) + "s";
    if (stripeNow !== stripe)
      $("track").style.setProperty("--stripe", (stripe = stripeNow));
  }

  function frame(now) {
    if (running) game.tick(Math.min(0.1, (now - last) / 1000));
    last = now;
    draw();
    for (const event of game.takeEvents()) handle(event);
    requestAnimationFrame(frame);
  }

  function show(html) {
    $("card").innerHTML = html;
    $("overlay").hidden = false;
    $("card").querySelector("button")?.focus();
  }

  function showStart() {
    show(`<h1><span aria-hidden="true">🎁</span> Belt &amp; Brake</h1>
      <p>Christmas is in a rush this year, so Santa bought an AI toy machine. It works far faster than the elves, but it doesn't always listen.</p>
      <p><b>Get ${target} good gifts into the sleigh in ${game.duration} seconds.</b> Tap any gift that doesn't match the wish on its tag to pull it off the belt.</p>
      <div class="example"><span class="gift demo"><span class="wish">a teddy to cuddle</span><span class="toy"><b>🐻</b>real bear cub</span></span><span class="hint">👆 Wrong! Tap it.</span></div>
      <p class="small">A wrong gift that reaches a child cancels ${BeltGame.WRONG_COST} good ones.</p>
      <button class="go" data-go>Start</button>`);
  }

  function showEnd() {
    const won = game.score >= target;
    show(`<h2>${won ? "Christmas delivered! 🎄" : "The sleigh left short. 🌧️"}</h2>
      <div class="final"><b>${game.score}</b> / ${target} good gifts</div>
      <p class="lesson">${lessons[game.lesson()](game)}</p>
      <p class="small">Caught ${game.caught} wrong gifts · ${game.bad} reached children · ${game.pulledGood} good gifts pulled by mistake · run ${seed}</p>
      <button class="go" data-again>Play again</button>`);
  }

  $("card").addEventListener("click", (e) => {
    if (e.target.closest("[data-again]")) {
      game = new BeltGame(seed);
      for (const card of cards.values()) card.remove();
      cards.clear();
      $("reactions").replaceChildren();
    }
    if (!e.target.closest("[data-go], [data-again]")) return;
    $("overlay").hidden = true;
    running = true;
  });
  $("track").addEventListener("pointerdown", (e) => {
    const card = e.target.closest(".gift");
    if (card && running) game.pull(+card.dataset.id);
  });
  $("lever").addEventListener("click", (e) => {
    const button = e.target.closest("[data-level]");
    if (button && running) game.setLevel(+button.dataset.level);
  });
  $("brake").addEventListener("click", () => running && game.brake());

  showStart();
  requestAnimationFrame(frame);
})();
