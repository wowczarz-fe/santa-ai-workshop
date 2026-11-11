// Draws a CheckerRota run and turns taps into calls on it.
(() => {
  "use strict";
  const R = CheckerRota,
    app = document.getElementById("app"),
    seed = Number(new URLSearchParams(location.search).get("seed")) || 2512,
    WRONG = ["Wrong pair", "Wrong toy", "Wrong bike"],
    NOUNS = {
      Socks: ["pair of socks", "pairs of socks"],
      Toys: ["toy", "toys"],
      Bikes: ["bike", "bikes"],
    },
    PAD = 34; // space for the machine and the sleigh at each end of a belt
  let game = null,
    last = 0,
    giftEls = [];

  function startScreen() {
    app.innerHTML = `<section class="card start">
      <div class="hero" aria-hidden="true">🎅🤖🎁</div>
      <h1>Checker Rota</h1>
      <p>Santa's elves can't make two billion presents by hand any more, so this year an AI runs the workshop. It is fast, and when it gets a gift wrong, it gets lots wrong just as fast.</p>
      <p><b>You have four checker elves and five nights.</b> Put them where a wrong gift would hurt most.</p>
      <button class="big" data-act="start">Start</button>
    </section>`;
  }

  function header() {
    const share = Math.max(0, Math.min(1, game.score / R.TARGET));
    return `<header class="top">
      <div class="night">Night <b>${Math.min(game.night + 1, 5)}</b> of 5</div>
      <div class="goal"><span aria-hidden="true">😊</span> <b>${game.score}</b> <small>/ ${R.TARGET} happy children</small></div>
    </header>
    <div class="meter" aria-hidden="true"><i style="width:${share * 100}%"></i></div>`;
  }

  function line(spec, i) {
    const flag = game.tonight.flag?.[i],
      ai = game.ai[i],
      plan = game.phase === "plan",
      elves = Array.from(
        { length: game.checkers[i] },
        () =>
          `<button class="elf" data-remove="${i}" aria-label="Send a checker back from ${spec.name}" ${plan ? "" : "disabled"}>🧝</button>`,
      ).join("");
    return `<section class="line sev${i} ${plan && game.free > 0 ? "open" : ""}" data-add="${i}">
      <div class="line-head">
        <span class="line-item" aria-hidden="true">${spec.item}</span>
        <span class="line-name">${spec.name}</span>
        <span class="stake">${WRONG[i]}: <b>-${spec.stakes}</b> ${spec.face}</span>
        ${flag ? `<span class="flag">${flag}</span>` : ""}
      </div>
      <div class="belt" id="belt${i}">
        ${game.leversOn ? `<button class="lever ${ai ? "ai" : "hand"}" data-lever="${i}" aria-label="Switch ${spec.name} between AI and by hand" ${plan ? "" : "disabled"}>${ai ? "🤖 AI<small>fast</small>" : "✋ Hand<small>slow</small>"}</button>` : ""}
        ${plan ? `<span class="preview">about ${game.plan(i).count} ${spec.name.toLowerCase()} tonight</span>` : ""}
        ${game.leversOn ? "" : `<span class="machine" aria-hidden="true">🤖</span>`}
        <div class="crew" id="crew${i}">${elves}${plan && game.free > 0 ? `<button class="add" data-add="${i}" aria-label="Add a checker to ${spec.name}">+🧝</button>` : ""}</div>
        <span class="sleigh" aria-hidden="true">🛷</span>
      </div>
    </section>`;
  }

  function planHint() {
    const pool =
      "🧝".repeat(game.free) +
      `<span class="used">${"🧝".repeat(game.available - game.free)}</span>`;
    const how =
      game.night === 0
        ? "Tap a line to put a checker on it. Each one catches about half the wrong gifts still getting past, and slows that line a little."
        : "Tap a line to add a checker, tap a checker to send it back.";
    return `<p class="hint"><span class="pool">${pool}</span> ${how}</p>`;
  }

  function render() {
    if (game.phase === "end") return endScreen();
    const tip =
      game.tonight.tip && game.phase === "plan"
        ? `<div class="tip">${game.tonight.tip}</div>`
        : "";
    let body;
    if (game.phase === "morning") body = morning();
    else
      body = `${game.phase === "plan" ? planHint() : `<p class="hint status" id="status">Loading the sleigh...</p><div class="timer"><i id="timer"></i></div>`}
        <div class="lines">${R.LINES.map(line).join("")}</div>
        ${game.phase === "plan" ? `<button class="big go" data-act="go">Go! 🛷</button>` : ""}`;
    app.innerHTML = `${header()}
      <section class="tonight"><b>${game.phase === "morning" ? "Last night" : "Tonight"}:</b> ${game.tonight.card}${tip}</section>
      ${body}`;
  }

  function morning() {
    const { lines, points } = game.result,
      slipped = lines.flatMap((l) => l.slipped).sort((a, b) => b.line - a.line),
      shown = slipped.slice(0, 3),
      rest = R.LINES.map((spec, i) => [
        spec,
        slipped.slice(3).filter((g) => g.line === i).length,
      ])
        .filter(([, n]) => n > 0)
        .map(
          ([spec, n]) =>
            `${n} more wrong ${NOUNS[spec.name][n === 1 ? 0 : 1]} ${spec.face}`,
        );
    const reactions = shown.length
      ? shown
          .map((g) => {
            const spec = R.LINES[g.line];
            return `<li class="sev${g.line}"><span class="r-icon" aria-hidden="true">${g.joke[0]}</span><span><b>${g.child}</b> got ${g.joke[1]}.</span><span class="r-pts">${spec.face} -${spec.stakes}</span></li>`;
          })
          .join("")
      : `<li class="none"><span class="r-icon" aria-hidden="true">🎉</span><span>Every child got what they asked for.</span></li>`;
    const tally = lines
      .map(
        (l, i) =>
          `<tr><td>${R.LINES[i].item}</td><td>${l.right}</td><td>${l.caught}</td><td class="${l.slipped.length ? "bad" : ""}">${l.slipped.length}</td><td><b>${sign(l.points)}</b></td></tr>`,
      )
      .join("");
    return `<section class="card morning">
      <h2>☀️ Christmas morning</h2>
      <ul class="reactions">${reactions}</ul>
      ${rest.length ? `<p class="more">...and ${rest.join(", ")}.</p>` : ""}
      <table class="tally">
        <tr><th></th><th>✅ right</th><th>🧝 caught</th><th>💔 wrong</th><th>points</th></tr>
        ${tally}
      </table>
      <p class="night-total">Tonight: <b class="${points < 0 ? "bad" : ""}">${sign(points)}</b> happy children</p>
      <button class="big" data-act="next">${game.night === 4 ? "See how Christmas went" : "Next night"}</button>
    </section>`;
  }

  function endScreen() {
    const won = game.score >= R.TARGET;
    app.innerHTML = `<section class="card end">
      <div class="hero" aria-hidden="true">${won ? "🎄🎅✨" : "🎄😬"}</div>
      <h1>${won ? "Christmas is saved!" : "Not enough happy children"}</h1>
      <div class="big-score"><b>${game.score}</b> <small>/ ${R.TARGET} happy children</small></div>
      <ol class="nights">${game.history.map((h, i) => `<li><small>Night ${i + 1}</small><b class="${h.points < 0 ? "bad" : ""}">${sign(h.points)}</b></li>`).join("")}</ol>
      <div class="lesson"><b>What happened</b><p>${game.lesson()}</p></div>
      <button class="big" data-act="again">Play again</button>
    </section>`;
  }

  function sign(n) {
    return n > 0 ? "+" + n : String(n);
  }

  function startNight() {
    game.go();
    render();
    giftEls = game.gifts.map((g) => {
      const el = document.createElement("span");
      el.className = "gift";
      el.innerHTML = `<i>${R.LINES[g.line].item}</i>`;
      el.hidden = true;
      document.getElementById("belt" + g.line).append(el);
      return el;
    });
    last = performance.now();
    requestAnimationFrame(frame);
  }

  function frame(now) {
    if (game.phase !== "night") return;
    game.tick(Math.min(0.1, (now - last) / 1000));
    last = now;
    if (game.phase !== "night") return render();
    const widths = R.LINES.map(
      (_, i) => document.getElementById("belt" + i).clientWidth - 2 * PAD,
    );
    game.gifts.forEach((g, k) => {
      const el = giftEls[k],
        age = (game.clock - g.t) / R.TRAVEL;
      if (age < 0 || el.done) return;
      if (g.caught && age >= R.CHECK_AT) return snatch(g, el);
      if (age >= 1) {
        el.done = true;
        el.hidden = true;
        return;
      }
      el.hidden = false;
      el.style.transform = `translateX(${PAD + age * widths[g.line]}px)`;
    });
    const { loaded, caught } = game.progress();
    document.getElementById("status").innerHTML =
      `🛷 <b>${loaded}</b> loaded &nbsp; 🧝 <b>${caught}</b> wrong ones caught`;
    document.getElementById("timer").style.width =
      (game.clock / R.NIGHT_LENGTH) * 100 + "%";
    requestAnimationFrame(frame);
  }

  // A checker grabs a wrong gift: it shows what it really was and is lifted off the belt.
  function snatch(g, el) {
    el.done = true;
    el.classList.add("caught");
    el.firstChild.textContent = g.joke[0];
    const crew = document.getElementById("crew" + g.line);
    crew.classList.remove("grab");
    void crew.offsetWidth; // restart the hop animation
    crew.classList.add("grab");
    setTimeout(() => (el.hidden = true), 900);
  }

  app.addEventListener("click", (e) => {
    const t = e.target.closest(
      "[data-act],[data-remove],[data-lever],[data-add]",
    );
    if (!t || t.disabled) return;
    const act = t.dataset.act;
    if (act === "start" || act === "again") {
      game = new R(seed);
      return render();
    }
    if (act === "go") return startNight();
    if (act === "next") {
      game.nextNight();
      return render();
    }
    if (t.dataset.remove) game.removeChecker(+t.dataset.remove);
    else if (t.dataset.lever) game.toggleAI(+t.dataset.lever);
    else if (t.dataset.add) game.addChecker(+t.dataset.add);
    if (game.phase === "plan") render();
  });

  startScreen();
})();
