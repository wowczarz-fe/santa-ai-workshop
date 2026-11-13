(() => {
  "use strict";
  const look =
    new URLSearchParams(location.search).get("look") === "paper"
      ? "paper"
      : "polish";
  document.body.dataset.look = look;
  const Art =
    look === "polish" && typeof PolishArt !== "undefined"
      ? PolishArt
      : PaperArt;
  document.body.insertAdjacentHTML(
    "afterbegin",
    PaperArt.defs + (Art === PaperArt ? "" : Art.defs) + SharedArt.defs,
  );
  const elfSVG = Art.elf;
  const artSymbol = (id) => Art.symbol?.(id) || id;

  const $ = (id) => document.getElementById(id);
  const text = (id, value) => {
    $(id).textContent = value;
  };
  const money = (n) => `£${Math.round(n).toLocaleString()}`;
  const params = new URLSearchParams(location.search);
  const requestedSeed = params.get("seed");
  const fixedSeed =
    requestedSeed !== null && Number.isFinite(Number(requestedSeed))
      ? Number(requestedSeed)
      : null;
  let seed;
  function nextSeed() {
    return (
      fixedSeed ??
      (globalThis.crypto?.getRandomValues
        ? crypto.getRandomValues(new Uint32Array(1))[0]
        : Math.floor(Math.random() * 4294967296))
    );
  }
  const queueIds = [["letters"], ["orders"], ["check", "pass", "rework"]];
  const miniPiles = { pass: "let-through", rework: "fixing" };
  let game,
    view,
    started = false,
    manualPaused = false,
    restartOpen = false,
    selected = null,
    caseOpen = false,
    lastCase = null,
    ended = false,
    tourStep = null;
  // The tour is ticked until the player has finished one game.
  let showTour = true;
  try {
    showTour = localStorage.getItem("workshop-walkthrough-finished") !== "yes";
  } catch {}
  let lastWrong = null,
    notice = null,
    newsSeen = new Set();
  let infoAnchor = null,
    infoKey = null,
    infoPinned = false,
    drag = null,
    suppressClick = { elf: null, until: 0 },
    nativeDragElf = null;
  let openedCases = new Set(),
    // Where and until when the second click of a double-click on a decision's answer is held back.
    answered = null;
  let lastChoice = null,
    observedRight = 0,
    caughtSnapshot = null,
    caughtUntil = 0,
    toastUntil = 0;
  // The best stars out of 3. The old best, in points and stars out of 12, is dropped.
  let bestStars = null,
    collectedBlunders = [];
  try {
    localStorage.removeItem("workshop-personal-best");
    const saved = Number(localStorage.getItem("workshop-best-stars"));
    if (localStorage.getItem("workshop-best-stars") !== null && saved >= 0)
      bestStars = saved;
    const collection = JSON.parse(localStorage.getItem("workshop-blunders"));
    if (Array.isArray(collection))
      collectedBlunders = collection.filter(
        (item) => item && item.id !== undefined && item.name,
      );
  } catch {}
  const make = (tag, cls, content) => {
    const node = document.createElement(tag);
    if (cls) node.className = cls;
    if (content !== undefined) node.textContent = content;
    return node;
  };
  // Interface icons and toys are drawings; the rules' emoji icon fields are never printed.
  const icon = (name, cls) => SharedArt.icon(name, cls) || "";
  const toyArt = (name) =>
    SharedArt.toy(name) || PaperArt.toy(name) || icon("gift");
  const iconText = (node, name, value) => {
    node.innerHTML = icon(name);
    node.append(make("span", "", value));
  };
  // Free: nothing to do at its station, often because the AI runs it alone.
  const isIdle = (elf) =>
    elf.station < 3 &&
    !elf.resting &&
    /^(nothing to do|idle|free)/.test(elf.doing);
  // Free to move: idle at a reading or toy station the AI runs alone. Anywhere else an idle elf
  // is waiting for work, so the player is not invited to pull checkers away.
  const isFree = (elf) =>
    isIdle(elf) && elf.station < 2 && view.ai[elf.station] === 2;
  const trendArrow =
    '<svg viewBox="0 0 12 12" aria-hidden="true"><path d="M6 10.5V2M2.5 5.5 6 2l3.5 3.5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  // A small "i" button that shows or hides longer words in place: works with touch and keyboard.
  // buttonHost gets the button, textHost the words (hidden until asked for).
  function addMore(buttonHost, words, label, textHost = buttonHost) {
    if (!words) return;
    const more = make("p", "more-text", words);
    more.hidden = true;
    const button = make("button", "info-button more-toggle", "i");
    button.type = "button";
    button.setAttribute("aria-label", label);
    button.setAttribute("aria-expanded", "false");
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      more.hidden = !more.hidden;
      button.setAttribute("aria-expanded", String(!more.hidden));
    });
    buttonHost.classList.add("more-host");
    buttonHost.append(button);
    textHost.append(more);
  }
  const infoButton = (key, label = "More information") => {
    const b = make("button", "info-button", "i");
    b.dataset.help = key;
    b.setAttribute("aria-label", label);
    return b;
  };
  document.querySelectorAll("[name=look]").forEach((radio) => {
    radio.checked = radio.value === look;
    radio.disabled =
      radio.value === "polish" && typeof PolishArt === "undefined";
    radio.addEventListener("change", () => {
      const url = new URL(location.href);
      url.searchParams.set("look", radio.value);
      location.replace(url);
    });
  });
  const actionGroups = new Map();
  for (let s = 0; s < 3; s++) {
    const station = make("section", "station");
    station.id = `station${s}`;
    station.dataset.destination = s;
    station.innerHTML = `<div class="column-heading"><span class="station-number">0${s + 1}</span><h2></h2></div><div class="machine">${Art.scene(s)}<span class="station-bottleneck" id="bottleneck${s}"></span><span class="focus-note" id="focus${s}"></span></div><div class="queue-piles" id="piles${s}"></div><div class="crew-heading"><span>Elves</span><span id="staff${s}" data-info="staff:${s}" tabindex="0"></span></div><div class="crew" id="elves${s}"></div><span class="crew-hint" id="spare${s}"></span><button class="move-target" data-move="${s}" hidden>Move here</button><div class="controls" id="controls${s}"></div><div class="feedback-slot" id="feedback${s}"></div>`;
    station.querySelector(".column-heading").append(infoButton(`station:${s}`));
    $("board").insertBefore(station, $("sleigh"));
    // One pile per station; at checking the straight-through and remake piles are two small
    // counters under it.
    for (const id of queueIds[s]) {
      const mini = miniPiles[id];
      const q = make("button", mini ? "queue queue-mini" : "queue");
      q.id = `queue-${id}`;
      q.dataset.info = `queue:${id}`;
      q.dataset.help = `queue:${id}`;
      q.innerHTML = mini
        ? `${icon(mini)}<span class="queue-name"></span><strong class="queue-count"><span class="queue-amount"></span></strong>`
        : '<span class="queue-tag"><span class="queue-name"></span><strong class="queue-count"><span class="queue-amount"></span><span class="queue-trend" role="img"></span></strong></span><span class="queue-picture"><span class="stack"></span></span><progress max="1" value="0"></progress>';
      if (!mini) $(`piles${s}`).append(q);
      else {
        if (!$(`minis${s}`)) {
          const row = make("div", "mini-piles");
          row.id = `minis${s}`;
          $(`piles${s}`).append(row);
        }
        $(`minis${s}`).append(q);
      }
    }
    const addGroup = (key, node) => {
      const wrap = make("div", "control-row");
      wrap.dataset.control = key;
      wrap.append(node, infoButton(`action:${key}`));
      $(`controls${s}`).append(wrap);
      actionGroups.set(key, wrap);
      return wrap;
    };
    if (s < 2) {
      const sw = make("div", "switch");
      for (let level = 0; level < 3; level++) {
        const position = make("div", "switch-choice");
        const b = make("button", "switch-button");
        b.dataset.ai = `${s},${level}`;
        b.dataset.info = `ai:${s}:${level}`;
        b.innerHTML = `<span class="switch-art" aria-hidden="true">${Art.icon(["ic-hand", "ic-assist", "ic-cog"][level])}</span><span class="switch-label">${["By hand", "Assist", "Automate"][level]}</span>`;
        position.append(
          b,
          infoButton(
            `ai:${s}:${level}`,
            `Explain ${["by hand", "assist", "automate"][level]}`,
          ),
        );
        sw.append(position);
      }
      sw.dataset.kind = "ai";
      addGroup(`ai${s}`, sw);
      const caption = make("span", "mode-caption");
      caption.id = `mode${s}`;
      $(`controls${s}`).append(caption);
    }
    if (s === 2) {
      const sw = make("div", "switch");
      for (let level = 0; level < 3; level++) {
        const position = make("div", "switch-choice");
        const b = make("button", "switch-button");
        b.dataset.checking = level;
        b.dataset.info = `checking:${level}`;
        b.innerHTML = `<span class="switch-art" aria-hidden="true">${Art.icon(["ic-few", "ic-risky", "ic-all"][level])}</span><span class="switch-label">${["A few", "Risky", "All"][level]}</span>`;
        position.append(b, infoButton(`checking:${level}`));
        sw.append(position);
      }
      sw.dataset.kind = "checking";
      addGroup("checking", sw);
      const vigilance = make("button", "vigilance");
      vigilance.id = "vigilance";
      vigilance.dataset.help = "vigilance";
      vigilance.dataset.info = "vigilance";
      $(`controls${s}`).append(vigilance);
    }
  }
  for (let s = 0; s < 3; s++) {
    const station = $(`station${s}`),
      heading = station.querySelector(".column-heading");
    const rate = make("div", "paper-rate");
    rate.append($(`bottleneck${s}`));
    heading.append(rate);
    const scene = make("div", "paper-scene");
    scene.append(station.querySelector(".machine"), $(`piles${s}`));
    const belt = make("div", "paper-belt");
    belt.setAttribute("aria-hidden", "true");
    const floor = make("div", "paper-floor");
    floor.append(
      station.querySelector(".crew-heading"),
      $(`elves${s}`),
      $(`spare${s}`),
      station.querySelector(".move-target"),
    );
    station.append(heading, scene, belt, floor, $(`controls${s}`));
  }
  const cargoBadge = make("button", "cargo-badge");
  cargoBadge.id = "cargoBadge";
  cargoBadge.dataset.help = "cargo";
  cargoBadge.dataset.info = "cargo";
  const sleigh = $("sleigh"),
    sleighScene = make("div", "paper-scene paper-sleigh-scene");
  // Keep the cargo and the target together in the sleigh card.
  $("sleighTotal").append(cargoBadge);
  sleigh.querySelector(".sleigh-art").innerHTML = Art.scene(3);
  sleighScene.append(
    sleigh.querySelector(".sleigh-art"),
    sleigh.querySelector(".sleigh-total"),
  );
  const sleighBelt = make("div", "paper-belt");
  sleighBelt.setAttribute("aria-hidden", "true");
  const sleighControls = make("div", "controls paper-sleigh-controls");
  sleighControls.append($("wrongDelivery"), $("sleighNote"));
  sleigh.append(sleighScene, sleighBelt, $("cocoa"), sleighControls);
  $("cocoa").classList.add("paper-floor");
  $("cocoa").querySelector(".cocoa-label > span").innerHTML =
    Art !== PaperArt
      ? Art.icon("mug")
      : '<svg viewBox="0 0 80 80" aria-hidden="true"><use href="#mug"/></svg>';
  $("stationPicker").addEventListener("click", (event) => {
    const button = event.target.closest("[data-station-page]");
    if (!button) return;
    const station =
      Number(button.dataset.stationPage) === 3
        ? $("sleigh")
        : $(`station${button.dataset.stationPage}`);
    $("board").scrollTo({
      left: station.offsetLeft - $("board").offsetLeft,
      behavior: "instant",
    });
  });
  $("board").addEventListener(
    "scroll",
    () => {
      const columns = [...$("board").children];
      const current = columns.reduce(
        (best, node, i) =>
          Math.abs(
            node.getBoundingClientRect().left -
              $("board").getBoundingClientRect().left,
          ) <
          Math.abs(
            columns[best].getBoundingClientRect().left -
              $("board").getBoundingClientRect().left,
          )
            ? i
            : best,
        0,
      );
      $("stationPicker")
        .querySelectorAll("button")
        .forEach((button, i) =>
          button.setAttribute("aria-pressed", i === current),
        );
    },
    { passive: true },
  );
  // The mistakes and cost goals, one star each; on a desktop the full-sleigh goal is on the sleigh
  // itself, and a phone or tablet shows it here too, as the sleigh is a tab away. The cost goal is
  // the game's one money figure, the cost so far against its limit. Each has a short word for
  // narrow screens.
  const goalSlots = {};
  for (const [id, art, short] of [
    ["full", "gift", "Gifts"],
    ["right", "wrong-gift", "Mistakes"],
    ["cost", "budget", "Cost"],
  ]) {
    const slot = make("button", "hud-slot");
    slot.dataset.goal = id;
    slot.dataset.short = short;
    slot.dataset.help = `goal:${id}`;
    slot.dataset.info = `goal:${id}`;
    slot.innerHTML = `<span class="hud-star">${icon("star")}</span><span class="hud-name">${icon(art)}<span></span></span><span class="hud-figures"><b></b><small><span class="hud-need"></span><span class="hud-unit"></span></small><span class="hud-preview"></span></span><span class="hud-bar" aria-hidden="true"><i></i></span>`;
    $("goals").append(slot);
    slot.querySelector(".hud-name > span").dataset.short = short;
    goalSlots[id] = slot;
  }
  // Marks on the phone's station tabs: the outlined control or the rules' focus, a tired elf,
  // and on the sleigh tab a cup with the elves on cocoa.
  $("stationPicker")
    .querySelectorAll("[data-station-page]")
    .forEach((tab) =>
      tab.insertAdjacentHTML(
        "beforeend",
        `<span class="tab-marks" aria-hidden="true"><i class="tab-focus" hidden></i><i class="tab-tired" hidden></i><span class="tab-cocoa" hidden>${icon("cocoa")}<b></b></span></span>`,
      ),
    );
  function paintGoals() {
    // While a recall card is open, the wrong-gift goal previews the count after the recall.
    const c = view.case;
    const recall =
      c && caseOpen && !c.resolving
        ? recallCount(
            c,
            c.options.find((o) => o.id === "bringBack" && o.available),
          )
        : null;
    const wrongGoal = (view.run.goals || []).find((g) => g.id === "right");
    const after =
      recall !== null && wrongGoal ? Math.max(0, wrongGoal.now - recall) : null;
    goalSlots.right.classList.toggle("hud-previewing", after !== null);
    goalSlots.right.querySelector(".hud-preview").textContent =
      after !== null ? `${after} after recall` : "";
    for (const goal of view.run.goals) {
      const slot = goalSlots[goal.id];
      if (!slot) continue;
      const cost = goal.id === "cost";
      const figure = (n) => (cost ? money(n) : String(n));
      const now = cost
          ? (view.cost?.spent ?? goal.now)
          : goal.id === "full"
            ? (view.run.aboard ?? goal.now)
            : goal.now,
        need = cost ? (view.cost?.limit ?? goal.need) : goal.need;
      const name = cost ? "Cost so far" : goal.name;
      slot.querySelector(".hud-name > span").textContent = name;
      slot.querySelector(".hud-figures b").textContent = figure(now);
      slot.querySelector(".hud-need").textContent = ` / ${figure(need)}`;
      slot.querySelector(".hud-unit").textContent =
        goal.id === "right" ? " wrong" : "";
      // met: lit star; waiting: inside the limit but the sleigh is not full enough yet;
      // failed: a limit goal not met; open: the full-sleigh goal still filling.
      const state = goal.met
        ? "met"
        : goal.waiting
          ? "waiting"
          : goal.id === "full"
            ? "open"
            : "failed";
      if (slot.dataset.state !== state) {
        slot.dataset.state = state;
        slot.querySelector(".hud-star").innerHTML = icon(
          state === "waiting" ? "star-empty" : "star",
        );
      }
      slot
        .querySelector(".hud-bar i")
        .style.setProperty("--fill", Math.min(1, now / Math.max(1, need)));
      slot.setAttribute(
        "aria-label",
        `${name}: ${figure(now)} of ${figure(need)}, ${{ met: "star earned so far", waiting: "not counted yet", failed: "no star", open: "no star yet" }[state]}. ${goal.text}.`,
      );
    }
  }
  // A wrong gift lights up, for a few seconds, the control its news line names, with the rules'
  // words for what to do as its tag.
  const hintTargets = {
    checking: () => actionGroups.get("checking"),
    "ai:0": () => actionGroups.get("ai0"),
    "ai:1": () => actionGroups.get("ai1"),
    cocoa: () => $("cocoa"),
  };
  let mistakeHint = null;
  const hintLabel = make("span", "mistake-hint-label");
  const mistakeHintOn = () =>
    !!mistakeHint &&
    mistakeHint.until > performance.now() &&
    !view.end &&
    tourStep === null;
  function showMistakeHint(news) {
    // The rules' short tag when they send one, else the line's last sentence up to any colon.
    const action =
      news.action ??
      (/([^.]+)\.\s*$/.exec(news.text)?.[1] ?? "").split(":")[0].trim();
    // A tag that names an elf ("Swap Pip") outlines that elf's card; "Swap an elf" outlines the
    // crew of the station its line names.
    const elf = view.elves.findIndex((e) =>
      new RegExp(`\\b${e.name}\\b`).test(action),
    );
    const crew =
      /^Swap an elf/.test(action) && elf < 0
        ? /checkers/.test(news.text)
          ? 2
          : view.stations.findIndex((st) => news.text.includes(`at ${st.name}`))
        : -1;
    if (elf < 0 && crew < 0 && !hintTargets[news.control]) return;
    mistakeHint = {
      control: news.control,
      elf,
      crew,
      words: /^Wrong gift/.test(action) ? "" : action,
      until: performance.now() + 5000,
    };
    setTimeout(paintMistakeHint, 5100);
  }
  function paintMistakeHint() {
    // The tour's outline is the only one while the tour is up.
    let target = !mistakeHintOn()
      ? null
      : mistakeHint.elf >= 0
        ? elfNodes[mistakeHint.elf]
        : mistakeHint.crew >= 0
          ? $(`elves${mistakeHint.crew}`)
          : hintTargets[mistakeHint.control]();
    if (!target?.getClientRects().length) target = null;
    document
      .querySelectorAll(".mistake-hint")
      .forEach(
        (node) => node !== target && node.classList.remove("mistake-hint"),
      );
    const column = target?.closest(".station");
    $("stationPicker")
      .querySelectorAll("[data-station-page]")
      .forEach((tab) =>
        tab.classList.toggle(
          "mistake-hint-tab",
          !!column &&
            Number(tab.dataset.stationPage) ===
              (column.id === "sleigh" ? 3 : Number(column.id.slice(7))),
        ),
      );
    if (!target) {
      hintLabel.remove();
      return;
    }
    target.classList.add("mistake-hint");
    hintLabel.textContent = mistakeHint.words;
    if (!mistakeHint.words) hintLabel.remove();
    else if (hintLabel.parentNode !== target) target.append(hintLabel);
  }
  // The phone's station tabs say what is happening a page away: a dot where the game points, a
  // red dot where an elf at work is tired, and a cup with the number of elves on cocoa.
  function paintTabMarks() {
    $("stationPicker")
      .querySelectorAll("[data-station-page]")
      .forEach((tab) => {
        const page = Number(tab.dataset.stationPage);
        tab.querySelector(".tab-focus").hidden = !(
          tab.classList.contains("focus-tab") ||
          tab.classList.contains("mistake-hint-tab") ||
          view.vigilance.swap?.station === page
        );
        tab.querySelector(".tab-tired").hidden = !view.elves.some(
          (elf) =>
            elf.station === page && page < 3 && /tired|spent/.test(elf.mood),
        );
        const resting = page === 3 ? crewSize(3) : 0;
        const cup = tab.querySelector(".tab-cocoa");
        cup.hidden = !resting;
        cup.querySelector("b").textContent = resting || "";
        tab.setAttribute(
          "aria-label",
          [
            tab.firstChild.textContent.trim(),
            tab.querySelector(".tab-focus").hidden ? "" : "needs you",
            tab.querySelector(".tab-tired").hidden ? "" : "a tired elf",
            resting ? `${resting} on cocoa` : "",
          ]
            .filter(Boolean)
            .join(", "),
        );
      });
  }
  const crewSize = (station) =>
    view.elves.filter((elf) => elf.station === station).length;
  // How sharp the checkers are, from the rules' vigilance state value.
  const attentionOf = (state) =>
    /wav|not look|asleep/.test(state)
      ? "closed"
      : /relax|drift/.test(state)
        ? "drifting"
        : "sharp";
  const eyes = {
    sharp:
      '<svg class="ui-icon attention-eye" viewBox="0 0 24 24" aria-hidden="true"><path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><circle cx="12" cy="12" r="3.6" fill="currentColor"/></svg>',
    drifting:
      '<svg class="ui-icon attention-eye" viewBox="0 0 24 24" aria-hidden="true"><path d="M2.5 12S6 18.5 12 18.5 21.5 12 21.5 12" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><path d="M2.5 12Q12 7.5 21.5 12" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/><path d="M8.4 11.2a3.6 3.6 0 0 0 7.2 0z" fill="currentColor"/></svg>',
    closed:
      '<svg class="ui-icon attention-eye" viewBox="0 0 24 24" aria-hidden="true"><g fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M3 10Q12 17.5 21 10"/><path d="M6.2 13.2 4.6 15.6M10 14.9l-.6 2.7M14 14.9l.6 2.7M17.8 13.2l1.6 2.4"/></g></svg>',
  };
  const elfNodes = [];
  function buildElves() {
    for (const node of elfNodes) node.remove();
    elfNodes.length = 0;
    view.elves.forEach((elf, i) => {
      const wrap = make("div", "elf-card");
      const b = make("button", "elf");
      b.draggable = true;
      b.dataset.elf = i;
      b.dataset.info = `elf:${i}`;
      b.innerHTML = `${elfSVG(i)}<span class="elf-name"></span><span class="elf-task"></span><span class="energy" aria-hidden="true"><i></i></span>`;
      // On a phone the cocoa strip is a page away, so a selected elf can be sent from its card.
      const rest = make("button", "rest-button");
      rest.dataset.rest = i;
      rest.hidden = true;
      rest.innerHTML = `${icon("cocoa")}<span>Rest</span>`;
      const cue = make("span", "rest-cue");
      cue.innerHTML = icon("cocoa");
      cue.setAttribute("aria-hidden", "true");
      wrap.append(b, rest, cue);
      elfNodes.push(wrap);
    });
  }
  // The station names come from the rules, so headings, tabs and the rules' lines use one word.
  function nameStations() {
    for (let s = 0; s < 3; s++) {
      const name = view.stations[s].name ?? "";
      const station = $(`station${s}`);
      station.querySelector("h2").textContent = name.toUpperCase();
      station
        .querySelector(".column-heading .info-button")
        .setAttribute("aria-label", `About ${name}`);
      const tab = $("stationPicker").querySelector(
        `[data-station-page="${s}"]`,
      );
      if (tab.firstChild?.nodeType === Node.TEXT_NODE)
        tab.firstChild.textContent = name;
      else tab.prepend(name);
    }
  }
  function reset(showIntro = true, freshSeed = true) {
    if (freshSeed) seed = nextSeed();
    game = new Workshop({ seed });
    view = game.view();
    nameStations();
    started = false;
    manualPaused = false;
    restartOpen = false;
    selected = null;
    caseOpen = false;
    tourStep = null;
    lastCase = null;
    openedCases.clear();
    ended = false;
    lastWrong = null;
    newsSeen = new Set();
    notice = null;
    mistakeHint = null;
    closeInfo();
    buildElves();
    $("walkthrough").checked = showTour;
    $("report").close();
    $("breakDialog").close();
    lastChoice = null;
    breakAnimated = false;
    observedRight = 0;
    caughtSnapshot = null;
    $("celebration").replaceChildren();
    hideToast();
    $("restartDialog").close();
    const url = new URL(location.href);
    if (fixedSeed !== null) url.searchParams.set("seed", fixedSeed);
    else url.searchParams.delete("seed");
    history.replaceState(null, "", url);
    paint();
    $("board").scrollLeft = 0;
    if (showIntro && !$("intro").open) $("intro").showModal();
  }
  function perform(action) {
    action();
    view = game.view();
    paint();
  }
  function moveElf(destination) {
    if (selected === null || !started || view.end) return;
    if (game.move(selected, destination)) {
      view = game.view();
      const moved = selected,
        elf = view.elves[moved];
      selected = null;
      sayResult(
        destination === 3
          ? `${elf.name} is having cocoa.`
          : `${elf.name} moved. ${perMinute(destination)}.`,
      );
      // The keyboard stays with the elf rather than with the Move here button that just hid.
      if (!document.activeElement?.offsetParent)
        elfNodes[moved].querySelector(".elf").focus({ preventScroll: true });
    }
  }
  const focusTag = make("span", "focus-tag");
  // A line stays up at least 4 seconds unless something more important comes; 9 at most.
  function say(words, priority) {
    const now = performance.now();
    if (
      priority > 0 &&
      (!notice ||
        now > notice.until ||
        priority > notice.priority ||
        now - notice.since >= 4000)
    )
      notice = { text: words, priority, since: now, until: now + 9000 };
  }
  // What the player's last move did, from the view's own figures.
  function sayResult(words) {
    const now = performance.now();
    // A wrong gift's line, or an elf back from cocoa, keeps its 4 seconds against the player's move.
    if (notice?.priority > 5 && now - notice.since < 4000) return paint();
    notice = { text: words, priority: 5, since: now, until: now + 4000 };
    paint();
  }
  const clockText = (seconds) =>
    `${Math.floor(seconds / 60)}:${String(Math.round(seconds) % 60).padStart(2, "0")}`;
  const perMinute = (s) =>
    `${view.stations[s].name}: ${Math.round(view.stations[s].rate)} a minute`;
  function paint() {
    view = game.view();
    paintGoals();
    const cargo = view.run.cargo;
    if (cargo && $("cargoBadge").dataset.cargo !== cargo.id) {
      $("cargoBadge").dataset.cargo = cargo.id;
      iconText($("cargoBadge"), `cargo-${cargo.id}`, cargo.name);
      $("cargoBadge").setAttribute(
        "aria-label",
        `${cargo.name}. About this cargo.`,
      );
    }
    // One clock for the whole game: the time until the sleigh leaves.
    const left = Math.ceil(view.run.leavesIn ?? view.duration - view.t);
    $("countdownRing").style.setProperty(
      "--remaining",
      Math.max(0, Math.min(1, left / view.duration)),
    );
    text("clock", clockText(left));
    $("pause").disabled = !started || !!view.end || tourStep !== null;
    document.querySelector("main > footer").hidden = started && !view.end;
    text("pause", manualPaused ? "Resume" : "Pause");
    text(
      "pauseState",
      // One word: the Pause button, the card or half-time already says why.
      started &&
        !view.end &&
        (manualPaused ||
          view.choice ||
          tourStep !== null ||
          caseStopsClock() ||
          document.hidden)
        ? "Paused"
        : "",
    );
    for (let s = 0; s < 3; s++) {
      const station = view.stations[s];
      text(`staff${s}`, `${station.working} working · ${station.idle} idle`);
      const bottleneck = $(`bottleneck${s}`),
        isSlowest = view.pace.slowest === s;
      if (bottleneck.childNodes.length !== (isSlowest ? 2 : 0)) {
        if (isSlowest) iconText(bottleneck, "bottleneck", "Bottleneck");
        else bottleneck.replaceChildren();
      }
      $(`station${s}`).classList.toggle(
        "faulty",
        s === 1 && !!view.incident?.known,
      );
      $(`station${s}`).classList.toggle(
        "behind",
        started && view.pace.behind && view.pace.slowest === s,
      );
      for (const id of queueIds[s]) {
        const q = view.queues[id],
          node = $(`queue-${id}`);
        node.querySelector(".queue-name").textContent = q.name;
        const count = q.parcels.length;
        const full = count >= q.limit;
        const nearFull = !full && count >= q.limit * 0.8;
        node.querySelector(".queue-amount").textContent = `${count}/${q.limit}`;
        node.setAttribute(
          "aria-label",
          `${q.name}: ${count} of ${q.limit} places filled${full ? ", full" : nearFull ? ", nearly full" : ""}`,
        );
        node.classList.toggle("blocked", !!q.blocked);
        node.classList.toggle("full", full);
        node.classList.toggle("near-full", nearFull);
        // The two small counters at checking carry only their name and count.
        if (miniPiles[id]) continue;
        const trend = node.querySelector(".queue-trend");
        if (!trend.firstChild) trend.innerHTML = trendArrow;
        trend.hidden = !q.trend;
        trend.dataset.trend = q.trend || "";
        trend.setAttribute("aria-label", q.trend ? `Pile ${q.trend}` : "");
        node.querySelector("progress").value = q.progress;
        const stack = node.querySelector(".stack");
        const signature = q.parcels
          .slice(-18)
          .map((p) => `${p.id}:${p.big}:${p.suspect}`)
          .join();
        if (stack.dataset.signature !== signature) {
          stack.dataset.signature = signature;
          stack.replaceChildren();
          for (const [index, p] of q.parcels.slice(-18).entries()) {
            const item = make(
              "i",
              `${p.big ? "big " : ""}${p.suspect ? "suspect " : ""}${p.suspect === "batch" ? "batch" : ""}`,
            );
            // Parcels: a big gift is the gold parcel with a "big" tag; others red or green.
            item.innerHTML = ["letters", "orders"].includes(id)
              ? Art.pile?.(id, index) ||
                Art.icon(id === "orders" ? "parcel-r" : "env")
              : Art.icon(
                  p.big ? "parcel-k" : index % 2 ? "parcel-g" : "parcel-r",
                );
            item.setAttribute("aria-hidden", "true");
            const count = Math.min(q.parcels.length, 18);
            item.style.setProperty(
              "--layer",
              count > 1 ? index / (count - 1) : 0,
            );
            item.style.left = `${(index % 3) * 11}px`;
            stack.append(item);
          }
        }
        stack.style.setProperty(
          "--fill",
          Math.min(1, q.parcels.length / q.limit),
        );
      }
    }
    view.elves.forEach((elf, i) => {
      const wrap = elfNodes[i],
        b = wrap.querySelector(".elf");
      if (wrap.parentNode !== $(`elves${elf.station}`))
        $(`elves${elf.station}`).append(wrap);
      const { energy, mood } = elf;
      b.querySelector(".elf-name").textContent = elf.name;
      b.querySelector(".energy").style.setProperty("--energy", energy);
      b.dataset.mood = mood;
      b.classList.toggle("selected", selected === i);
      wrap.querySelector(".rest-button").hidden =
        selected !== i || elf.station === 3 || innerWidth >= 1000;
      b.classList.toggle("exhausted", elf.resting);
      b.disabled = !started || !!view.end || elf.resting;
      b.setAttribute(
        "aria-label",
        `${elf.name}, ${isFree(elf) ? "free to move" : isIdle(elf) ? "waiting for work" : elf.doing}, energy ${energy} of 100. Select to move.`,
      );
      // The task word under the name is the first word of what the rules say the elf is doing
      // ("reading", "loading", "remaking"); free, waiting and resting elves get their own word.
      const [task, role = task] = isFree(elf)
        ? ["free to move", "free"]
        : isIdle(elf)
          ? ["waiting"]
          : elf.resting
            ? ["burnt out", "resting"]
            : elf.station === 3
              ? ["resting"]
              : [elf.doing.split(" ")[0] || "working"];
      b.querySelector(".elf-task").textContent = task;
      b.dataset.role = role;
      b.querySelector(".elf-eyes").setAttribute(
        "href",
        "#" +
          artSymbol(
            { fresh: "eyes", tiring: "eyes-drowsy" }[mood] || "eyes-tired",
          ),
      );
      b.querySelector(".elf-prop").setAttribute(
        "href",
        "#" +
          artSymbol(
            {
              reading: "p-letter",
              making: "p-hammer",
              remaking: "p-hammer",
              checking: "p-glass",
              confirming: "p-confirming",
              resting: "p-resting",
            }[role] || "",
          ),
      );
    });
    // Four to six elves in one place stand in two rows of full cards, so the floor grows.
    const crews = [0, 1, 2, 3].map(
      (station) => view.elves.filter((elf) => elf.station === station).length,
    );
    crews.forEach((count, station) =>
      $(`elves${station}`).style.setProperty(
        "--crew-count",
        Math.max(1, Math.min(4, count)),
      ),
    );
    $("board").dataset.crowd = String(crews.some((n) => n >= 4 && n <= 6));
    for (let station = 0; station < 2; station++) {
      // Under the AI switch: what the setting means, or, once the machine works alone and
      // elves stand free, the move that helps.
      const spare = view.elves.filter(
        (elf) => elf.station === station && isFree(elf),
      ).length;
      text(
        `mode${station}`,
        spare
          ? `${spare} ${spare === 1 ? "elf" : "elves"} free: move one to checks`
          : ["Elves do the work", "Elves confirm each", "Machine works alone"][
              view.ai[station]
            ],
      );
      $(`mode${station}`).classList.toggle("spare", spare > 0);
      // A station the machine runs with no elf left says so on its empty floor.
      $(`elves${station}`).dataset.alone =
        view.ai[station] === 2 && !crews[station] ? "Machine works alone" : "";
      if ($(`elves${station}`).dataset.alone) text(`mode${station}`, "");
    }
    document
      .querySelectorAll("[data-destination]")
      .forEach((node) =>
        node.classList.toggle(
          "destination",
          selected !== null &&
            view.elves[selected].station !== Number(node.dataset.destination),
        ),
      );
    $("stationPicker")
      .querySelectorAll("[data-station-page]")
      .forEach((tab) =>
        tab.classList.toggle(
          "destination-tab",
          selected !== null &&
            view.elves[selected].station !== Number(tab.dataset.stationPage),
        ),
      );
    document.querySelectorAll("[data-move]").forEach((b) => {
      b.hidden =
        selected === null ||
        view.elves[selected].station === Number(b.dataset.move);
    });
    for (const [key, group] of actionGroups) {
      const action = view.actions[key];
      group
        .querySelectorAll("button:not(.info-button)")
        .forEach((b) => (b.disabled = !action.available || !!view.end));
    }
    document.querySelectorAll("[data-ai]").forEach((b) => {
      const [s, l] = b.dataset.ai.split(",").map(Number);
      b.setAttribute("aria-pressed", String(view.ai[s] === l));
    });
    for (let station = 0; station < 2; station++)
      actionGroups
        .get(`ai${station}`)
        .querySelector(".switch")
        .style.setProperty("--selected", view.ai[station]);
    actionGroups
      .get("checking")
      .querySelector(".switch")
      .style.setProperty("--selected", view.checking);
    document
      .querySelectorAll("[data-checking]")
      .forEach((b) =>
        b.setAttribute(
          "aria-pressed",
          String(view.checking === Number(b.dataset.checking)),
        ),
      );
    // The elf to swap out, while the rules name one: a banner with its name and an outline on
    // its card, both gone once the station looks properly again.
    const swap = view.vigilance.swap ?? null;
    const attention = !swap
      ? "sharp"
      : swap.station === 2
        ? attentionOf(view.vigilance.state)
        : "drifting";
    const banner = `${attention}:${swap?.name ?? ""}`;
    if ($("vigilance").dataset.banner !== banner) {
      $("vigilance").dataset.banner = banner;
      $("vigilance").dataset.attention = attention;
      $("vigilance").innerHTML = eyes[attention];
      if (swap)
        $("vigilance").append(
          make(
            "span",
            "attention-label",
            `${swap.name} ${attention === "closed" ? "not looking" : "trusting the AI"}`,
          ),
        );
    }
    // The banner belongs to Checking; at Letters or Toys the same words sit on the elf's card.
    $("vigilance").hidden = !swap || swap.station !== 2;
    $("vigilance").dataset.state = view.vigilance.state;
    elfNodes.forEach((wrap, i) => {
      wrap.classList.toggle("swap-elf", swap?.elf === i);
      const words =
        swap?.elf === i && swap.station !== 2
          ? `${swap.name} trusting the AI`
          : "";
      let tag = wrap.querySelector(".swap-tag");
      if (!words) return tag?.remove();
      if (!tag) {
        tag = make("span", "swap-tag");
        wrap.append(tag);
      }
      if (tag.textContent !== words) tag.textContent = words;
    });
    // One outlined thing at a time: the control the tour points at, else the rules' focus, with
    // its reason as a tag on the outlined box. A tired elf gets its own card outlined.
    const walkTarget = tourStep === null ? null : tourSteps[tourStep].target();
    // A wrong gift's highlight takes the place of the focus outline while it shows.
    const focus =
      started && !view.end && !walkTarget && !mistakeHintOn()
        ? view.focus
        : null;
    const tiredElf =
      focus?.control === "cocoa"
        ? view.elves.findIndex((elf) => focus.text.includes(elf.name))
        : -1;
    text("cocoaFocus", focus?.station === 3 ? focus.text : "");
    const focusTarget =
      tiredElf >= 0
        ? elfNodes[tiredElf]
        : focus?.control === "elves"
          ? $(`elves${focus.station}`)
          : actionGroups.get(focus?.control) || null;
    document
      .querySelectorAll(".needs-attention, .walk-target")
      .forEach((node) => {
        if (node !== focusTarget) node.classList.remove("needs-attention");
        if (node !== walkTarget) node.classList.remove("walk-target");
      });
    focusTarget?.classList.add("needs-attention");
    walkTarget?.classList.add("walk-target");
    // While an elf is being moved, Move here takes the floor's corner and the tag waits.
    focusTag.textContent =
      focus && tiredElf < 0 && selected === null ? focus.text : "";
    if (focusTarget && tiredElf < 0) {
      if (focusTag.parentNode !== focusTarget) focusTarget.append(focusTag);
    } else focusTag.remove();
    elfNodes.forEach((wrap, i) =>
      wrap.classList.toggle("needs-rest", i === tiredElf),
    );
    // On a phone the station tab of the outlined thing is marked too, as it may be a page away.
    const focusColumn = (walkTarget || focusTarget)?.closest(".station");
    $("stationPicker")
      .querySelectorAll("[data-station-page]")
      .forEach((tab, page) =>
        tab.classList.toggle(
          "focus-tab",
          !!focusColumn &&
            focusColumn === (page === 3 ? $("sleigh") : $(`station${page}`)),
        ),
      );

    const wrong = view.sleigh.parcels
      .filter((p) => p.result === "wrong")
      .at(-1);
    if (wrong) lastWrong = wrong;
    // The wrong-gift card shows once there is a wrong gift aboard.
    $("wrongDelivery").hidden = !lastWrong;
    if (lastWrong) {
      if ($("wrongToy").dataset.toy !== lastWrong.made.name) {
        $("wrongToy").dataset.toy = lastWrong.made.name;
        $("wrongToy").innerHTML = toyArt(lastWrong.made.name);
      }
      $("wrongBig").hidden = !lastWrong.big;
      text("wrongName", lastWrong.made.name);
      $("wrongDelivery").dataset.help = "lastWrong";
      $("wrongDelivery").dataset.info = "lastWrong";
    }
    text(
      "sleighNote",
      view.lost ? `${view.lost} letters lost from full piles` : "",
    );
    for (const n of [...view.news].reverse()) {
      if (newsSeen.has(n.id)) continue;
      newsSeen.add(n.id);
      handleNews(n);
      // Routine lines never show: a card title repeated, or a check that found nothing wrong.
      const priority =
        n.kind === "checked" && n.check?.result !== "wrong"
          ? 0
          : n.kind === "loaded" && n.check?.result === "wrong"
            ? 7
            : // An elf walking back from cocoa by itself, or an elf starting to trust the AI, is
              // news the player's own last move must not hide.
              /rested|relaxed/.test(n.kind)
              ? 6
              : n.kind === "resolved"
                ? 3
                : n.kind === "noticed"
                  ? 4
                  : 1;
      say(n.text, priority);
    }
    const narrow = innerWidth < 1000;
    text(
      "status",
      selected !== null
        ? `${view.elves[selected].name}: ${!narrow ? "drag or tap to a lit station" : view.elves[selected].station < 3 ? "tap Rest, or a lit station tab then Move here" : "tap a lit station tab, then Move here"}.`
        : tourStep !== null
          ? ""
          : notice && notice.until > performance.now()
            ? notice.text
            : narrow
              ? "Tap an elf, then its new station."
              : "Drag an elf to a new station.",
    );
    paintCase();
    paintTour();
    paintChoice();
    paintEffects();
    StationFlow.update(
      view,
      started &&
        !manualPaused &&
        !restartOpen &&
        !document.hidden &&
        tourStep === null &&
        !view.choice &&
        !view.end &&
        !caseStopsClock(),
    );
    paintMistakeHint();
    paintTabMarks();
    if (infoKey && infoAnchor?.isConnected) renderInfo();
    if (view.end && !ended) {
      ended = true;
      showTour = false;
      try {
        localStorage.setItem("workshop-walkthrough-finished", "yes");
      } catch {}
      showReport();
    }
  }
  // Half-time card and end screen: drawings and small builders shared by both.
  const uiIcon = (name) => SharedArt.icon(name) || "";
  const iconNode = (name, cls) => {
    const node = make("span", cls);
    node.innerHTML = uiIcon(name);
    node.setAttribute("aria-hidden", "true");
    return node;
  };
  const goalIcons = { full: "gift", right: "wrong-gift", cost: "budget" };
  const goalFigure = (goal) =>
    goal.id === "cost"
      ? `${money(goal.now)} / ${money(goal.need)}`
      : `${goal.now} / ${goal.need}${goal.id === "right" ? " wrong" : ""}`;
  const causeIcons = {
    guessed: "gift-unclear",
    big: "gift-big",
    misread: "letter",
    misMade: "toy",
    waved: "checks",
    faulty: "update",
    tired: "role-tired",
    recalled: "rollback",
    slip: "hand",
  };
  const optionIcons = {
    update: "update",
    tested: "test",
    train: "train",
    rest: "rest",
    none: "play",
  };
  // A toy drawn: the one a child wanted, or the wrong one the workshop made.
  const drawnToy = (name, wanted, cls) => {
    const node = make("span", cls);
    node.innerHTML =
      (wanted ? SharedArt.toy(name) : PaperArt.toy(name)) ||
      uiIcon(wanted ? "gift" : "wrong-gift");
    node.setAttribute("aria-hidden", "true");
    return node;
  };
  const sleighArt = () =>
    look === "polish"
      ? '<svg viewBox="0 0 280 150" aria-hidden="true"><use href="#polish-sleigh"/></svg>'
      : uiIcon("sleigh");
  const breakScene =
    '<svg viewBox="0 0 940 120" preserveAspectRatio="xMidYMax slice" aria-hidden="true">' +
    '<circle class="scene-moon" cx="760" cy="44" r="20"/><circle class="scene-moon-shade" cx="769" cy="38" r="17"/>' +
    '<g class="scene-stars"><circle cx="420" cy="24" r="1.4"/><circle cx="520" cy="48" r="1.2"/><circle cx="700" cy="22" r="1.6"/><circle cx="740" cy="70" r="1.2"/><circle cx="890" cy="66" r="1.4"/><circle cx="350" cy="56" r="1.1"/><circle cx="600" cy="74" r="1"/><circle cx="910" cy="28" r="1.2"/><circle cx="300" cy="30" r="1"/></g>' +
    '<path class="scene-trail" d="M420 84 C500 72 560 66 610 44"/>' +
    '<path class="scene-roofs" d="M0 104 L40 96 L80 104 V100 L120 92 L160 100 V108 L200 108 V100 L250 90 L300 100 V104 L360 94 L420 104 V105.6 L470 93.6 L520 105.6 V97.2 L580 80.4 L640 97.2 V102 L700 87.6 L760 102 V94.8 L820 79.2 L880 94.8 V104.4 L940 90 V120 H0Z"/>' +
    '<g class="scene-windows"><rect x="96" y="106" width="8" height="8"/><rect x="220" y="104" width="8" height="8"/><rect x="236" y="104" width="8" height="8"/><rect x="566" y="102" width="8" height="8"/><rect x="806" y="99.6" width="8" height="8"/><rect x="460" y="109.2" width="8" height="8"/><rect x="690" y="104.4" width="8" height="8"/></g>' +
    '<path class="scene-roof-line" d="M0 104 L40 96 L80 104 V100 L120 92 L160 100 V108 L200 108 V100 L250 90 L300 100 V104 L360 94 L420 104 V105.6 L470 93.6 L520 105.6 V97.2 L580 80.4 L640 97.2 V102 L700 87.6 L760 102 V94.8 L820 79.2 L880 94.8 V104.4 L940 90"/>' +
    "</svg>";
  $("breakScene").innerHTML = breakScene;
  $("breakDeparture").innerHTML = sleighArt();
  // The end hero keeps its sleigh but no snow: dots there read as smudges on the figures.
  $("endScene").innerHTML = `<span class="end-sleigh">${sleighArt()}</span>`;
  $("replay").innerHTML = `${uiIcon("restart")}<span>Play again</span>`;
  // Header buttons carry an icon too: a phone shows the icon alone, at a full-sized tap target.
  for (const [id, icon] of [
    ["guidanceToggle", "walkthrough"],
    ["restart", "restart"],
  ]) {
    const words = $(id).textContent.trim();
    $(id).innerHTML =
      `<span class="header-icon">${uiIcon(icon)}</span><span class="header-word">${words}</span>`;
    $(id).title = words;
  }
  // The end screen shows the counts-from line under a goal that never counted; the half-time card
  // keeps only the dashed star and the hover text.
  function goalSlot(goal, countsFrom, withNote = true) {
    const slot = make("div", "goal-slot");
    slot.dataset.goal = goal.id;
    slot.dataset.met = String(goal.met);
    slot.dataset.waiting = String(Boolean(goal.waiting));
    const marks = make("span", "goal-marks");
    marks.append(
      iconNode(goal.met ? "star" : "star-empty", "goal-star"),
      iconNode(goalIcons[goal.id] || "star", "goal-icon"),
    );
    // The figure carries the goal; its longer wording stays in the label and the hover text.
    slot.append(
      marks,
      make("b", "goal-name", goal.name),
      make("strong", "goal-figure", goalFigure(goal)),
    );
    // Inside its limit but not counted: the sleigh holds fewer gifts than the goal counts from.
    if (goal.waiting && countsFrom && withNote)
      slot.append(
        make("small", "goal-note", `Counts from ${countsFrom} gifts aboard`),
      );
    // Within its limit but never counted: the sleigh stayed under the share where this goal starts.
    const why =
      goal.waiting && countsFrom && withNote
        ? `, counts from ${countsFrom} right gifts`
        : "";
    slot.title = goal.text + why;
    slot.setAttribute(
      "aria-label",
      `${goal.name}: ${goalFigure(goal)}, ${goal.text}${why}. ${goal.met ? "Star earned" : "No star"}.`,
    );
    slot.setAttribute("role", "group");
    return slot;
  }
  function paintCauses(list, causes, none) {
    list.replaceChildren(
      ...causes.map((cause) => {
        const item = make("li", "cause");
        item.dataset.cause = cause.id;
        const body = make("div", "cause-body");
        const head = make("div", "cause-head");
        head.append(
          make("b", "", cause.name),
          make(
            "span",
            "cause-figure",
            `${cause.wrong} wrong · ${money(cause.cost)}`,
          ),
        );
        body.append(head, make("p", "cause-fix", cause.fix));
        item.append(
          iconNode(causeIcons[cause.id] || "mistakes", "cause-icon"),
          body,
        );
        return item;
      }),
    );
    if (!causes.length) list.append(make("li", "cause-none", none));
  }
  // The half-time card: how the sleigh stands, at most two lines, what changes, then the choice.
  // A decision still waiting can be opened from here; the card steps aside until it is answered.
  let breakAside = false,
    breakAnimated = false;
  function breakLine(cls, iconName, ...parts) {
    const line = make("p", `break-line ${cls}`);
    if (iconName) line.append(iconNode(iconName, "break-line-icon"));
    const words = make("span", "break-line-text");
    words.append(...parts);
    line.append(words);
    return line;
  }
  function paintBreakLines(choice) {
    const report = choice.report;
    const lines = [];
    if (choice.openCase) {
      const line = breakLine(
        "break-line-case",
        "ask",
        "Decision waiting: ",
        make("b", "", choice.openCase.title),
      );
      if (view.case) {
        const open = make("button", "break-open-case", "Open it");
        open.type = "button";
        open.dataset.openCase = choice.openCase.id;
        line.append(open);
      }
      lines.push(line);
    }
    // Tiredness shows only when it cost a quarter of the work or burnt an elf out; else the
    // biggest cause of the wrong gifts, as the goal above already counts them.
    const top = report.causes?.[0];
    if ((report.tired ?? 0) >= 25 || report.burnouts)
      lines.push(
        breakLine(
          "break-line-tired",
          "role-tired",
          make(
            "b",
            "break-line-figure",
            `Tired elves lost ${report.tired}% of their work${report.burnouts ? ` · ${plural(report.burnouts, "burnout")}` : ""}`,
          ),
        ),
      );
    else if (report.wrong && top)
      lines.push(
        breakLine(
          "break-line-cause",
          causeIcons[top.id] || "mistakes",
          report.wrong === 1 ? "The wrong gift: " : "Most wrong gifts: ",
          make("b", "", top.name),
        ),
      );
    $("breakLines").replaceChildren(...lines);
  }
  function paintBreakOptions(choice) {
    $("breakOptions").replaceChildren();
    $("breakOptions").style.setProperty("--choices", choice.options.length);
    for (const option of choice.options) {
      const card = make("button", "upgrade-card");
      card.dataset.choose = option.id;
      card.dataset.kind = option.id;
      const fact = (label) => option.facts.find((f) => f.label === label);
      const gives = fact("Gives");
      const costs = fact("Costs");
      const risk = fact("Risk");
      const stops = fact("Stops");
      const others = option.facts.filter(
        (f) => f !== gives && f !== costs && f !== risk && f !== stops,
      );
      const more = [
        option.text,
        ...others.map((f) => `${f.label}: ${f.value}.`),
      ].join(" ");
      card.append(
        iconNode(optionIcons[option.id] || "gift", "upgrade-icon"),
        make("strong", "", option.label),
        make("span", "upgrade-gives", gives?.value ?? option.text),
      );
      const chips = make("span", "upgrade-chips");
      if (costs) {
        const chip = make("span", "upgrade-cost");
        chip.append(iconNode("budget", ""), costs.value);
        chips.append(chip);
      }
      // The install risk is how likely the update is faulty; testing is what stops a bad one.
      if (risk) {
        const odds = risk.value.match(/\d+ in \d+/);
        chips.append(
          make(
            "span",
            "upgrade-risk",
            odds ? `may be faulty: ${odds[0]}` : risk.value,
          ),
        );
      }
      if (stops)
        chips.append(make("span", "upgrade-stops", `stops ${stops.value}`));
      card.append(chips);
      const wrap = make("div", "upgrade-wrap");
      wrap.append(card);
      if (gives) {
        card.title = more;
        addMore(wrap, more, `More about ${option.label}`);
      }
      $("breakOptions").append(wrap);
    }
  }
  function paintChoice() {
    const choice = started ? view.choice : null;
    if (!choice) {
      breakAside = false;
      $("breakDialog").close();
      lastChoice = null;
      return;
    }
    if (breakAside) {
      if (caseOpen && view.case && !view.case.resolving) return;
      breakAside = false;
      lastChoice = null;
    }
    const caseKey = String(choice.openCase?.id ?? "");
    if (lastChoice !== caseKey) {
      lastChoice = caseKey;
      text("breakTitle", choice.title);
      $("nextCargoIcon").innerHTML = uiIcon(`cargo-${choice.next.cargo.id}`);
      text("breakText", choice.next.text);
      text("nextCargoText", choice.text);
      $("breakGoals").replaceChildren(
        ...choice.report.goals.map((g) =>
          goalSlot(g, view.run.goalsCountFrom, false),
        ),
      );
      paintBreakLines(choice);
      paintBreakOptions(choice);
    }
    closeInfo();
    if (!$("breakDialog").open) {
      hideToast();
      $("breakDialog").showModal();
      $("breakText").focus({ preventScroll: true });
      $("breakDialog").scrollTop = 0;
      if (breakAnimated) return;
      breakAnimated = true;
      $("breakDeparture").classList.remove("break-arrival");
      void $("breakDeparture").offsetWidth;
      $("breakDeparture").classList.add("break-arrival");
    }
  }
  // The milestone note goes when the half-time card or the end screen opens, so it never pokes out above them.
  function hideToast() {
    toastUntil = 0;
    $("milestoneToast").hidden = true;
  }
  function handleNews(news) {
    if (!started) return;
    if (news.kind === "loaded" && news.control) showMistakeHint(news);
    if (news.kind === "loaded" && news.caseId != null)
      openedCases.delete(news.caseId);
    if (
      news.kind === "milestone" &&
      !$("breakDialog").open &&
      !$("report").open
    ) {
      iconText($("milestoneToast"), "gift", news.text);
      toastUntil = performance.now() + 3500;
      $("milestoneToast").hidden = false;
    }
    if (news.kind === "cleared" && view.queues[news.queue]) {
      const node = $(`queue-${news.queue}`);
      node.dataset.clearedEvent = news.id;
      node.classList.add("pile-cleared");
      setTimeout(() => {
        if (node.dataset.clearedEvent === String(news.id))
          node.classList.remove("pile-cleared");
      }, 1800);
    }
    if (news.kind === "checked" && news.check?.result === "wrong") {
      caughtSnapshot = news.check;
      caughtUntil = performance.now() + 5000;
    }
    if (news.kind === "departed") {
      const sleigh = document.querySelector(".sleigh-art");
      sleigh.classList.remove("departing");
      void sleigh.offsetWidth;
      sleigh.classList.add("departing");
      setTimeout(() => sleigh.classList.remove("departing"), 1600);
    }
  }
  // The sleigh count and progress towards its target.
  function paintSleighCount() {
    const full = view.run.goals?.find((g) => g.id === "full"),
      target = Math.max(1, view.run.target);
    const aboard = view.run.aboard ?? view.sleigh.right;
    text("sleighRight", aboard);
    text("sleighTarget", `of ${view.run.target}`);
    const count = $("sleighTotal").querySelector(".sleigh-count");
    count.setAttribute("role", "img");
    count.setAttribute(
      "aria-label",
      `${aboard} right gifts aboard out of ${view.run.target} needed`,
    );
    $("sleighTotal").style.setProperty("--fill", Math.min(1, aboard / target));
    const met = String(!!full?.met);
    if ($("sleighTotal").dataset.met !== met) {
      $("sleighTotal").dataset.met = met;
      $("sleighStar").innerHTML = icon(full?.met ? "star" : "star-empty");
    }
    $("sleighTotal").title = full
      ? `${full.name}: ${full.met ? "star earned" : "no star yet"}`
      : "";
  }
  let giftBubble = null,
    giftBubbleCount = 0,
    giftBubbleTimer = 0;
  function paintEffects() {
    paintSleighCount();
    const aboard = view.run.aboard ?? view.sleigh.right;
    const gained = aboard - observedRight;
    observedRight = aboard;
    if (started && gained > 0 && !view.end) {
      // One bubble beside the sleigh count (or on the sleigh tab when the sleigh is a page away)
      // with a running count: gifts that land while it shows add to it and restart it.
      const to = $("sleighRight").getBoundingClientRect(),
        column = $("sleigh").getBoundingClientRect();
      const visible = to.left >= 0 && to.right <= innerWidth;
      const target = visible
        ? to
        : document
            .querySelector('[data-station-page="3"]')
            .getBoundingClientRect();
      let effect = giftBubble;
      if (
        effect?.isConnected &&
        effect.classList.contains("in-slot") === !visible
      ) {
        giftBubbleCount += gained;
        effect.style.animation = "none";
        void effect.offsetWidth;
        effect.style.animation = "";
        clearTimeout(giftBubbleTimer);
      } else {
        effect?.remove();
        effect = giftBubble = make("span", "gift-flight");
        giftBubbleCount = gained;
        $("celebration").append(effect);
      }
      iconText(effect, "gift", `+${giftBubbleCount}`);
      effect.classList.toggle("in-slot", !visible);
      effect.style.left = `${Math.max(12, Math.min(innerWidth - 100, visible ? column.left + 12 : target.left + 4))}px`;
      effect.style.top = `${Math.max(4, Math.min(innerHeight - 40, visible ? to.top - 6 : target.top - 14))}px`;
      effect.style.setProperty("--fly-x", "0px");
      effect.style.setProperty("--fly-y", visible ? "-14px" : "0px");
      giftBubbleTimer = setTimeout(() => effect.remove(), 1500);
    }
    if (toastUntil < performance.now()) $("milestoneToast").hidden = true;
    let caught = $("caughtToy");
    if (!caught) {
      caught = make("button", "caught-toy");
      caught.id = "caughtToy";
      caught.dataset.help = "caughtToy";
      caught.dataset.info = "caughtToy";
      $("feedback2").append(caught);
    }
    caught.hidden = !caughtSnapshot || performance.now() > caughtUntil;
    // The caught toy shows inside the foot of the pile it was caught from, above the pile below it
    // and clear of the checking dial.
    if (!caught.hidden)
      $("feedback2").style.top =
        `${$("queue-check").getBoundingClientRect().bottom - ($("feedback2").offsetParent?.getBoundingClientRect().top ?? 0) - caught.offsetHeight - 4}px`;
    if (caughtSnapshot && caught.dataset.toy !== caughtSnapshot.made.name) {
      caught.dataset.toy = caughtSnapshot.made.name;
      caught.replaceChildren(make("b", "", "Caught!"));
      caught.insertAdjacentHTML("beforeend", toyArt(caughtSnapshot.made.name));
      caught.append(make("span", "", caughtSnapshot.made.name));
    }
  }
  function positionPanel(panel, anchor, protectedNodes = []) {
    const anchorBounds = anchor.getBoundingClientRect();
    if (panel === $("infoPopover") || innerWidth < 1000) {
      const roomBeside = Math.max(
        anchorBounds.left - 24,
        innerWidth - anchorBounds.right - 24,
      );
      panel.style.maxHeight = `${roomBeside >= panel.offsetWidth ? innerHeight - 24 : Math.max(80, anchorBounds.top - 24, innerHeight - anchorBounds.bottom - 24)}px`;
    } else panel.style.maxHeight = "";
    const r = anchorBounds,
      p = panel.getBoundingClientRect(),
      gap = 12,
      w = innerWidth,
      h = innerHeight;
    let horizontal = Math.max(12, Math.min(r.left, w - p.width - 12));
    const vertical = Math.max(12, Math.min(r.top, h - p.height - 12));
    const protectedBounds = protectedNodes
      .map((node) => node.getBoundingClientRect())
      .filter((rect) => rect.width && rect.height);
    const places = [
      { x: horizontal, y: r.bottom + gap },
      { x: horizontal, y: r.top - p.height - gap },
      { x: r.right + gap, y: vertical },
      { x: r.left - p.width - gap, y: vertical },
      ...[...document.querySelectorAll(".paper-scene")].map((scene) => {
        const bounds = scene.getBoundingClientRect();
        return { x: Math.max(12, bounds.left + 4), y: bounds.top + 3 };
      }),
      ...protectedBounds.flatMap((rect) => [
        { x: horizontal, y: rect.top - p.height - gap },
        { x: horizontal, y: rect.bottom + gap },
        { x: rect.right + gap, y: vertical },
        { x: rect.left - p.width - gap, y: vertical },
      ]),
    ];
    places.sort((a, b) => {
      const distance = (point) =>
        Math.hypot(
          Math.max(r.left - point.x - p.width, point.x - r.right, 0),
          Math.max(r.top - point.y - p.height, point.y - r.bottom, 0),
        );
      return distance(a) - distance(b);
    });
    const fit = places.find(
      (a) =>
        a.x >= 12 &&
        a.y >= 12 &&
        a.x + p.width <= w - 12 &&
        a.y + p.height <= h - 12 &&
        protectedBounds.every(
          (rect) =>
            a.x + p.width <= rect.left ||
            a.x >= rect.right ||
            a.y + p.height <= rect.top ||
            a.y >= rect.bottom,
        ),
    ) || {
      x: horizontal,
      y: Math.max(12, Math.min(r.bottom + gap, h - p.height - 12)),
    };
    // On a phone a card is as wide as the screen allows, so it sits centred.
    panel.style.left =
      w < 600 && panel !== $("infoPopover")
        ? `${(w - p.width) / 2}px`
        : `${Math.max(12, Math.min(fit.x, w - p.width - 12))}px`;
    panel.style.top = `${Math.max(12, Math.min(fit.y, h - p.height - 12))}px`;
    drawPopupPointer(panel, anchor);
  }
  const popupPointers = new Map();
  function hidePopupPointer(id) {
    const pointer = popupPointers.get(id);
    if (pointer) pointer.setAttribute("hidden", "");
  }
  function drawPopupPointer(panel, anchor) {
    let pointer = popupPointers.get(panel.id);
    if (!pointer) {
      pointer = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      pointer.classList.add("popup-pointer");
      pointer.dataset.popup = panel.id;
      pointer.setAttribute("aria-hidden", "true");
      pointer.append(
        document.createElementNS("http://www.w3.org/2000/svg", "path"),
      );
      document.body.append(pointer);
      popupPointers.set(panel.id, pointer);
    }
    pointer.toggleAttribute("hidden", panel.hidden);
    pointer.setAttribute("width", innerWidth);
    pointer.setAttribute("height", innerHeight);
    pointer.style.zIndex = String(Number(getComputedStyle(panel).zIndex) - 1);
    const p = panel.getBoundingClientRect(),
      a = anchor.getBoundingClientRect();
    const cx = Math.max(
      p.left + 14,
      Math.min(a.left + a.width / 2, p.right - 14),
    );
    const cy = Math.max(
      p.top + 14,
      Math.min(a.top + a.height / 2, p.bottom - 14),
    );
    let points;
    if (p.top >= a.bottom)
      points = [
        [cx - 8, p.top + 1],
        [Math.max(a.left, Math.min(cx, a.right)), a.bottom + 2],
        [cx + 8, p.top + 1],
      ];
    else if (p.bottom <= a.top)
      points = [
        [cx - 8, p.bottom - 1],
        [Math.max(a.left, Math.min(cx, a.right)), a.top - 2],
        [cx + 8, p.bottom - 1],
      ];
    else if (p.left >= a.right)
      points = [
        [p.left + 1, cy - 8],
        [a.right + 2, Math.max(a.top, Math.min(cy, a.bottom))],
        [p.left + 1, cy + 8],
      ];
    else
      points = [
        [p.right - 1, cy - 8],
        [a.left - 2, Math.max(a.top, Math.min(cy, a.bottom))],
        [p.right - 1, cy + 8],
      ];
    pointer
      .querySelector("path")
      .setAttribute(
        "d",
        `M${points.map((point) => point.join(",")).join(" L")} Z`,
      );
    pointer
      .querySelector("path")
      .setAttribute("fill", getComputedStyle(panel).backgroundColor);
    pointer
      .querySelector("path")
      .setAttribute(
        "stroke",
        panel.id === "infoPopover" ? "#193b35" : "#b6c5ba",
      );
  }
  function showAnchorOnce(panel, anchor, key) {
    const visit = `${key}:${innerWidth < 1000 ? "narrow" : "wide"}`;
    if (panel.dataset.anchorVisit === visit) return;
    panel.dataset.anchorVisit = visit;
    if (innerWidth < 1000)
      anchor.scrollIntoView({ block: "nearest", inline: "nearest" });
  }
  // The tour before the clock: one step per control, each beside the real control. The clock
  // starts when the last step or Skip ends it.
  const tourSteps = [
    {
      title: "Elves",
      text: () =>
        "Move elves to where work piles up. Send tired elves for a cocoa break.",
      target: () => $("elves0"),
    },
    {
      title: "AI switch",
      text: () =>
        "By hand, Assist, Automate: more AI is faster, but makes more mistakes.",
      target: () => actionGroups.get("ai0"),
    },
    {
      title: "Checking",
      text: () =>
        "Checks catch most mistakes, but cost time and money. Tired checkers miss more.",
      target: () => actionGroups.get("checking"),
    },
    {
      title: "Sleigh",
      text: () =>
        `Get ${view.run.target} right gifts aboard. Keep mistakes and costs low for the other two stars.`,
      target: () => $("sleighTotal"),
    },
  ];
  function showTourStep(step) {
    tourStep = step;
    caseOpen = false;
    const { title, text: words, target } = tourSteps[step];
    text("tourCount", `Walkthrough ${step + 1} of ${tourSteps.length}`);
    text("tourTitle", title);
    text("tourText", words());
    text("tourNext", step === tourSteps.length - 1 ? "Start" : "Next");
    // On a phone the control may be a page or a scroll away: bring it into view first.
    const anchor = target(),
      column = anchor.closest(".station");
    if (column)
      $("board").scrollTo({
        left: column.offsetLeft - $("board").offsetLeft,
        behavior: "instant",
      });
    anchor.scrollIntoView({
      block: "center",
      inline: "nearest",
      behavior: "instant",
    });
    paint();
    $("tour").focus({ preventScroll: true });
  }
  // The clock starts and the keyboard lands on Pause.
  function endTour() {
    tourStep = null;
    $("board").scrollLeft = 0;
    paint();
    $("pause").focus({ preventScroll: true });
  }
  function nextTourStep() {
    if (tourStep === tourSteps.length - 1) endTour();
    else showTourStep(tourStep + 1);
  }
  function paintTour() {
    const anchor = tourStep === null ? null : tourSteps[tourStep].target();
    $("tour").hidden = !anchor;
    if (!anchor) {
      hidePopupPointer("tour");
      return;
    }
    positionPanel($("tour"), anchor, [anchor]);
  }
  // How many wrong gifts an option brings off the sleigh, from its scope words.
  function recallCount(c, o) {
    if (!o || o.id !== "bringBack") return null;
    const said = /(\d+) wrong gift/.exec(o.scope || "");
    return said ? Number(said[1]) : c.affected.count;
  }
  // Chips for an option: what it does (the first part of its scope without a figure, as the figures
  // get chips of their own), what it does to the goals, money, time, risk, or why it is shut.
  function optionChips(c, o) {
    const parts = (o.scope || "")
      .split(/;\s*/)
      .filter((part) => part && part !== o.goal)
      .filter(
        (part) =>
          !(Number.isFinite(o.extra) && /£|costs?|nothing more/i.test(part)) &&
          !(o.seconds && /^checkers busy /i.test(part)),
      );
    const does = parts.find((part) => !/\d/.test(part)) ?? parts[0] ?? "";
    const chips = [];
    if (!o.available && o.why && !c.resolving)
      chips.push(["chip-why", "", o.why]);
    if (does) chips.push(["chip-does", "", does]);
    if (o.goal)
      for (const part of o.goal.split(/,\s*/))
        chips.push([
          `chip-goal ${/lost/.test(part) ? "chip-goal-lost" : "chip-goal-saved"}`,
          /lost/.test(part) ? "star-empty" : "star",
          part,
        ]);
    // A price the rules' words already give (a recall's "costs £395 instead of ...") is not repeated.
    if (Number.isFinite(o.extra))
      chips.push([
        "chip-money",
        "budget",
        o.extra === 0 ? "Nothing more" : `${money(o.extra)} more`,
      ]);
    else if (o.trade) chips.push(["chip-money", "budget", o.trade]);
    else if (o.money && !does.includes(money(o.money)))
      chips.push(["chip-money", "budget", money(o.money)]);
    if (o.seconds)
      chips.push([
        "chip-time",
        "clock",
        o.seconds > view.run.leavesIn
          ? "longer than the time left"
          : `${/checkers busy/i.test(o.scope || "") ? "Checkers " : ""}${o.seconds} s`,
      ]);
    if (o.risk)
      chips.push([
        "chip-risk",
        "wrong-gift",
        `${Math.round(o.risk * 100)}% wrong`,
      ]);
    return chips;
  }
  const caseHeading = (c) => c.title || "Decision";
  // The decision cue is gold and pulses until its case is opened; a wrong gift caused by that
  // case going aboard makes it pulse again. Built once, so later frames change only its words.
  $("caseCue").innerHTML =
    '<span class="cue-icon" aria-hidden="true"></span><span class="cue-verb"></span><span class="cue-name"></span><b class="cue-count" hidden></b>';
  function paintCue(c) {
    const cue = $("caseCue"),
      resolving = !!c.resolving,
      art = resolving ? "clock" : "ask",
      waiting = view.casesWaiting + 1;
    if (cue.dataset.icon !== art) {
      cue.dataset.icon = art;
      cue.querySelector(".cue-icon").innerHTML = icon(art);
    }
    const verb = resolving ? `${Math.ceil(c.resolving.remaining)} s` : "Decide";
    const name = resolving ? "\u00a0in progress" : `: ${caseHeading(c)}`;
    if (cue.querySelector(".cue-verb").textContent !== verb)
      cue.querySelector(".cue-verb").textContent = verb;
    if (cue.querySelector(".cue-name").textContent !== name)
      cue.querySelector(".cue-name").textContent = name;
    cue.querySelector(".cue-count").hidden = waiting < 2;
    cue.querySelector(".cue-count").textContent = waiting;
    cue.dataset.resolving = String(resolving);
    cue.dataset.pulse = String(!resolving && !openedCases.has(c.id));
    cue.setAttribute(
      "aria-label",
      resolving
        ? `Decision in progress, ${verb} left`
        : `Decision waiting: ${caseHeading(c)}${waiting > 1 ? `, ${waiting} in all` : ""}`,
    );
  }
  function focusCase() {
    (
      $("casePanel").querySelector("[data-resolve]:not(:disabled)") ||
      $("closeCase")
    ).focus({ preventScroll: true });
  }
  // After a decision closes, the keyboard goes back to the cue, or to Pause when none waits.
  function returnFocus() {
    if (!$("casePanel").hidden) return focusCase();
    ($("caseCue").hidden ? $("pause") : $("caseCue")).focus({
      preventScroll: true,
    });
  }
  function paintCase() {
    const c = view.case;
    $("caseCue").hidden = !started || !c || !!view.end;
    if (!c) {
      caseOpen = false;
      lastCase = null;
      $("casePanel").hidden = true;
      hidePopupPointer("casePanel");
      delete $("casePanel").dataset.anchorVisit;
      return;
    }
    // A new decision waits behind the gold cue until the player opens it.
    if (lastCase !== c.id) {
      lastCase = c.id;
      caseOpen = false;
    }
    if (caseOpen) openedCases.add(c.id);
    paintCue(c);
    $("casePanel").hidden = !started || !caseOpen || !!view.end;
    if ($("casePanel").hidden) {
      hidePopupPointer("casePanel");
      delete $("casePanel").dataset.anchorVisit;
      return;
    }
    $("casePanel").dataset.kind = c.kind;
    // An unclear wish is a picture: the child and the wish as the heading, then the two things it
    // could mean, drawn side by side in the rules' order. Other decisions keep their sentence.
    const letter = c.kind === "unclear" ? c.evidence?.[0] : null;
    const readings = letter ? (c.readings ?? []) : [];
    text(
      "caseTitle",
      letter ? `${letter.child}: "${letter.wish}"` : caseHeading(c),
    );
    text("caseText", readings.length === 2 ? "" : c.text);
    $("caseText").hidden = readings.length === 2;
    const readingsKey = `${c.id}:${readings.map((r) => r.art).join("|")}`;
    if ($("caseReadings").dataset.key !== readingsKey) {
      $("caseReadings").dataset.key = readingsKey;
      const drawn = readings.map((r, index) => {
        const button = make("button", "case-reading");
        button.type = "button";
        button.dataset.resolve = `pick:${index}`;
        button.innerHTML = toyArt(r.name);
        button.append(make("span", "reading-name", r.name));
        button.setAttribute("aria-label", `Choose ${r.name}`);
        return button;
      });
      $("caseReadings").replaceChildren(
        ...(drawn.length === 2
          ? [drawn[0], make("span", "case-or", "or"), drawn[1]]
          : []),
      );
      $("caseReadings").setAttribute(
        "aria-label",
        readings.length === 2
          ? `It could mean ${readings[0].name} or ${readings[1].name}`
          : "",
      );
    }
    $("caseReadings").hidden = readings.length !== 2;
    for (const button of $("caseReadings").querySelectorAll("[data-resolve]")) {
      const option = c.options.find((o) => o.id === button.dataset.resolve);
      button.disabled = !option || option.available === false || !!c.resolving;
      button.title = option?.why || "";
    }
    // The figure the decision turns on most: for an unclear wish what the gift costs if it comes
    // out wrong (the rules' stake, in pounds), else the first primary fact. The rest are behind
    // the info button.
    const fact = c.facts?.find((f) => f.primary);
    const stake = Number.isFinite(c.stake)
      ? `${money(c.stake)} if wrong`
      : fact
        ? `${fact.label}: ${fact.value}`
        : "";
    text("caseFact", stake);
    $("caseFact").hidden = !stake;
    // Options: large buttons with an icon, the label and chips for what each costs and does.
    const options = $("caseOptions");
    options.hidden = readings.length === 2;
    const ids = new Set(c.options.map((o) => o.id));
    for (const child of [...options.children])
      if (!ids.has(child.dataset.option)) child.remove();
    for (const o of readings.length === 2 ? [] : c.options) {
      let b = [...options.children].find((n) => n.dataset.option === o.id);
      if (!b) {
        b = make("button", "case-choice");
        b.dataset.option = o.id;
        b.dataset.resolve = o.id;
        b.innerHTML =
          '<span class="option-icon" aria-hidden="true"></span><span class="option-label"></span><span class="option-chips"></span>';
        options.append(b);
      }
      const icons = {
        rollback: "rollback",
        keep: "automate",
        bringBack: "rollback",
        leave: "sleigh",
      };
      const optionIcon = b.querySelector(".option-icon");
      if (optionIcon.dataset.icon !== o.id) {
        optionIcon.dataset.icon = o.id;
        optionIcon.innerHTML = icon(icons[o.id] || "info");
      }
      b.querySelector(".option-label").textContent = o.label;
      const chips = optionChips(c, o);
      const chipsNode = b.querySelector(".option-chips");
      const chipsSignature = JSON.stringify(chips);
      if (chipsNode.dataset.value !== chipsSignature) {
        chipsNode.dataset.value = chipsSignature;
        chipsNode.replaceChildren(
          ...chips.map(([cls, art, words]) => {
            const chip = make("span", `opt-chip ${cls}`);
            if (art) chip.innerHTML = icon(art);
            chip.append(words);
            return chip;
          }),
        );
      }
      b.disabled = o.available === false || !!c.resolving;
      b.classList.toggle("unavailable", o.available === false);
      b.classList.toggle("chosen", c.resolving?.optionId === o.id);
    }
    $("caseResolving").hidden = !c.resolving;
    if (c.resolving) {
      text("caseProgressText", `${Math.ceil(c.resolving.remaining)} s left`);
      $("caseProgress").value =
        1 - c.resolving.remaining / c.resolving.duration;
    }
    const anchor = caseAnchor(c);
    showAnchorOnce($("casePanel"), anchor, `${c.id}:${c.step}`);
    positionPanel($("casePanel"), anchor, [anchor]);
  }
  function caseAnchor(c) {
    if (c.step === "source") return $("station1").querySelector(".machine");
    if (c.step === "aboard")
      return $("wrongDelivery").hidden ? $("sleighRight") : $("wrongDelivery");
    if (c.kind === "unclear") return $("queue-letters");
    return $("queue-check");
  }
  // What a wrong big gift costs against a wrong everyday one, from the rules' prices.
  function bigGiftSentence() {
    const prices = view.prices;
    return prices
      ? `A wrong big gift (gold) costs ${money(prices.wrongBig)}, an everyday one ${money(prices.wrongEveryday)}.`
      : "A wrong big gift (gold) costs far more than an everyday one.";
  }
  // Info pop-ups: a title and one short plain sentence, two at most.
  function getInfo(key) {
    const cap = (s) => (s ? s[0].toUpperCase() + s.slice(1) : "");
    if (key === "cargo")
      return [
        view.run.cargo.name,
        [
          view.run.cargo.text,
          `The sleigh needs ${view.run.target} right gifts.`,
        ],
      ];
    if (key === "caughtToy" && caughtSnapshot)
      return [
        "A checker caught this",
        [
          `"${caughtSnapshot.wish}" Wanted ${caughtSnapshot.wanted.name}, made ${caughtSnapshot.made.name}.`,
        ],
      ];
    if (key === "caseFacts")
      return [
        "All evidence",
        [
          ...(view.case?.facts || []).map((f) => `${f.label}: ${f.value}.`),
          ...(view.case?.options || []).map(
            (o) => `${o.label}: ${o.scope}${o.why ? ` (${o.why})` : ""}.`,
          ),
        ],
      ];
    const parts = key.split(":"),
      type = parts[0];
    if (type === "goal") {
      const goal = view.run.goals.find((g) => g.id === parts[1]);
      const cost = goal.id === "cost";
      if (goal.id === "full")
        return [
          goal.name,
          [`${cap(goal.text)} aboard when the sleigh leaves.`],
        ];
      return [
        cost ? "Cost so far" : goal.name,
        [
          cost
            ? "AI, checks, fixes, any change you buy and wrong gifts aboard all add to it."
            : "",
          `${cap(goal.text)}.`,
        ].filter(Boolean),
      ];
    }
    if (type === "ai") {
      const l = view.levers[`ai${parts[1]}`][Number(parts[2])];
      return [l.name, [`${cap(l.who)}, ${l.speed}.`, `Watch for: ${l.risk}.`]];
    }
    if (type === "checking") {
      const l = view.levers.checking[Number(parts[1])];
      return [l.name, [`${cap(l.sends)}: ${l.per100} in 100 gifts.`]];
    }
    if (type === "action") {
      const a = view.actions[parts[1]];
      return [
        {
          ai0: `AI at ${view.stations[0].name}`,
          ai1: `AI at ${view.stations[1].name}`,
          checking: "How much to check",
        }[parts[1]],
        [a.why ? `${cap(a.why)}.` : "", `${cap(a.cost)}.`].filter(Boolean),
      ];
    }
    if (type === "queue") {
      const q = view.queues[parts[1]];
      return [
        q.name,
        [
          parts[1] === "pass"
            ? "Gifts not sent for a check, waiting for an elf here to load them onto the sleigh."
            : `${q.parcels.length} of ${q.limit} waiting, ${Math.round(q.rate)} a minute going out.`,
          q.blocked
            ? `${cap(q.blocked)}.`
            : parts[1] === "letters"
              ? ""
              : bigGiftSentence(),
        ].filter(Boolean),
      ];
    }
    if (type === "elf") {
      const e = view.elves[Number(parts[1])];
      return [
        e.name,
        [
          `${cap(e.doing)}, energy ${e.energy} of 100.`,
          e.resting ? "Back after this cocoa break." : "Drag to move.",
        ],
      ];
    }
    if (type === "staff" || type === "station") {
      const s = Number(parts[1]),
        v = view.stations[s];
      return [
        v.name,
        [
          [
            "Elves read the letters, with or without AI.",
            "Elves or the toy machine make the toys.",
            "Elves here check gifts, remake the caught ones and load the sleigh.",
          ][s],
          `${Math.round(v.rate)} ${["read", "made", "checked"][s]} a minute now.`,
          v.blocked
            ? `${cap(v.blocked)}.`
            : view.pace.slowest === s
              ? "This station's pile is filling: it holds the line up."
              : "",
        ].filter(Boolean),
      ];
    }
    if (type === "option") {
      const o = view.case?.options.find((o) => o.id === parts[1]);
      return [
        o?.label || "Decision",
        [
          o?.scope ? `${cap(o.scope)}.` : "",
          o?.why ? `${cap(o.why)}.` : "",
        ].filter(Boolean),
      ];
    }
    if (type === "fact") {
      const f = view.case?.facts[Number(parts[1])];
      return [f?.label || "Evidence", [f?.value || ""]];
    }
    if (type === "lastWrong") {
      return [
        "Last wrong gift",
        [
          `"${lastWrong.wish}" Wanted ${lastWrong.wanted.name}, got ${lastWrong.made.name}.`,
          lastWrong.big ? "A big gift, so a costly mistake." : "",
        ].filter(Boolean),
      ];
    }
    const fixed = {
      clock: [
        "The clock",
        [
          "Time until the sleigh leaves.",
          "Pause, an open decision card and the walkthrough stop it.",
        ],
      ],
      movement: [
        "Moving elves",
        [
          "Drag an elf to a station or to cocoa, or tap the elf, then the place.",
        ],
      ],
      cocoa: [
        "Cocoa break",
        ["Tired elves miss mistakes. A short break here makes them fresh."],
      ],
      sleigh: [
        "The sleigh",
        ["Right gifts count towards the target; wrong ones cost money."],
      ],
      vigilance: [
        "Trusting the AI",
        [
          view.vigilance.swap
            ? `${view.vigilance.swap.name} has trusted a long run of clean AI gifts and now lets some through. Send ${view.vigilance.swap.name} for cocoa or swap in another elf.`
            : "After a long run of clean AI gifts, elves stop looking properly.",
          view.vigilance.skipped
            ? `${view.vigilance.skipped} checks skipped so far.`
            : "",
        ],
      ],
    };
    return fixed[key] || ["Workshop", ["Tap an elf or a control."]];
  }
  function infoPositionAnchor() {
    return infoKey?.startsWith("elf:")
      ? document.querySelector(`[data-elf="${infoKey.split(":")[1]}"]`) ||
          infoAnchor
      : infoAnchor;
  }
  function renderInfo() {
    const [title, lines] = getInfo(infoKey);
    text("infoTitle", title);
    $("infoContent").replaceChildren(
      ...lines.filter(Boolean).map((line) => make("p", "", line)),
    );
    positionPanel($("infoPopover"), infoPositionAnchor(), [
      infoPositionAnchor(),
    ]);
  }
  function openInfo(anchor, key, pinned = false) {
    closeInfo();
    infoAnchor = anchor;
    infoKey = key;
    infoPinned = pinned;
    anchor.setAttribute("aria-describedby", "infoPopover");
    $("infoPopover").hidden = false;
    renderInfo();
  }
  function closeInfo() {
    infoAnchor?.removeAttribute("aria-describedby");
    infoAnchor = null;
    infoKey = null;
    infoPinned = false;
    $("infoPopover").hidden = true;
    hidePopupPointer("infoPopover");
  }
  let hoverArmed = false;
  let pointerFocus = false,
    recentTouchUntil = 0;
  document.addEventListener(
    "pointerdown",
    (e) => {
      pointerFocus = true;
      hoverArmed = false;
      if (
        infoPinned &&
        !$("infoPopover").contains(e.target) &&
        !e.target.closest("[data-help]")
      )
        closeInfo();
      if (e.pointerType === "touch")
        recentTouchUntil = performance.now() + 1000;
    },
    true,
  );
  document.addEventListener(
    "keydown",
    () => {
      pointerFocus = false;
    },
    true,
  );
  document.addEventListener("pointerover", (e) => {
    const target = e.target.closest("[data-info]");
    if (
      target &&
      hoverArmed &&
      e.pointerType === "mouse" &&
      matchMedia("(hover: hover)").matches &&
      performance.now() > recentTouchUntil &&
      !infoPinned &&
      !drag
    )
      openInfo(target, target.dataset.info);
  });
  document.addEventListener("pointermove", (e) => {
    if (
      e.pointerType !== "mouse" ||
      !(e.movementX || e.movementY) ||
      !matchMedia("(hover: hover) and (pointer: fine)").matches
    )
      return;
    hoverArmed = true;
    const target = e.target.closest("[data-info]");
    if (target && target !== infoAnchor && !infoPinned && !drag)
      openInfo(target, target.dataset.info);
  });
  document.addEventListener("pointerout", (e) => {
    if (!infoPinned && infoAnchor && !infoAnchor.contains(e.relatedTarget))
      closeInfo();
  });
  document.addEventListener("focusin", (e) => {
    const target = e.target.closest("[data-info]");
    if (target && !pointerFocus) openInfo(target, target.dataset.info);
  });
  document.addEventListener("focusout", (e) => {
    if (!infoPinned && infoAnchor && !infoAnchor.contains(e.relatedTarget))
      closeInfo();
  });
  document.addEventListener("pointercancel", () => {
    drag = null;
    if (nativeDragElf === null) selected = null;
    paint();
    $("dragGhost").hidden = true;
    document
      .querySelectorAll(".drop")
      .forEach((node) => node.classList.remove("drop"));
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      closeInfo();
      const wasOpen = !$("casePanel").hidden;
      caseOpen = false;
      $("casePanel").hidden = true;
      hidePopupPointer("casePanel");
      if (wasOpen) returnFocus();
      if (selected !== null) {
        selected = null;
        paint();
      }
    }
  });
  document.addEventListener("click", (e) => {
    const target = e.target.closest("button");
    if (
      performance.now() < suppressClick.until &&
      target?.dataset.elf === String(suppressClick.elf)
    )
      return;
    if (!e.target.closest("#infoPopover") && !target?.dataset.help) closeInfo();
    if (!target) return;
    if (target.dataset.help) {
      openInfo(target, target.dataset.help, true);
      return;
    }
    if (target.dataset.elf !== undefined) {
      selected = Number(target.dataset.elf);
      paint();
      return;
    }
    if (target.dataset.move !== undefined) {
      moveElf(Number(target.dataset.move));
      return;
    }
    if (target.dataset.rest !== undefined) {
      moveElf(3);
      return;
    }
    if (target.dataset.ai) {
      const [s, l] = target.dataset.ai.split(",").map(Number);
      perform(() => game.setAi(s, l));
      if (view.ai[s] === l)
        sayResult(
          `${view.stations[s].name} on ${["By hand", "Assist", "Automate"][l]}: ${Math.round(view.stations[s].rate)} a minute.`,
        );
      return;
    }
    if (target.dataset.checking !== undefined) {
      perform(() => game.setChecking(Number(target.dataset.checking)));
      const lever = view.levers.checking[view.checking];
      sayResult(`Checking ${lever.per100} in 100 gifts.`);
      return;
    }
    if (target.dataset.choose && view.choice) {
      perform(() => game.choose(target.dataset.choose));
      return;
    }
    if (target.dataset.resolve) {
      // A double-click must not land on whatever sits under the closed panel.
      answered = { x: e.clientX, y: e.clientY, until: performance.now() + 300 };
      const c = view.case,
        option = c?.options.find((o) => o.id === target.dataset.resolve);
      // The card closes on an answer; the cue counts down an answer that takes time.
      caseOpen = false;
      // The decision may have gone while its card was still drawn (half-time came up over it).
      if (!option) return paint();
      perform(() => game.resolve(c.id, option.id));
      if (!document.activeElement?.offsetParent || target.disabled)
        returnFocus();
      return;
    }
  });
  document.addEventListener(
    "click",
    (e) => {
      // Only the second click of a double-click (or double tap) on the same spot as an answer is
      // held back; any other click right after an answer acts at once.
      if (
        answered &&
        e.detail >= 2 &&
        performance.now() < answered.until &&
        Math.hypot(e.clientX - answered.x, e.clientY - answered.y) < 24
      ) {
        e.stopPropagation();
        e.preventDefault();
      }
    },
    true,
  );
  document.querySelectorAll("[data-destination]").forEach((node) => {
    node.addEventListener("click", (e) => {
      if (selected !== null && !e.target.closest("button"))
        moveElf(Number(node.dataset.destination));
    });
    node.addEventListener("dragover", (e) => {
      e.preventDefault();
      node.classList.add("drop");
    });
    node.addEventListener("dragleave", () => node.classList.remove("drop"));
    node.addEventListener("drop", (e) => {
      e.preventDefault();
      node.classList.remove("drop");
      if (nativeDragElf !== null) selected = nativeDragElf;
      moveElf(Number(node.dataset.destination));
    });
  });
  document.addEventListener("dragstart", (e) => {
    const elf = e.target.closest("[data-elf]");
    if (!elf) return;
    closeInfo();
    nativeDragElf = Number(elf.dataset.elf);
    selected = nativeDragElf;
    e.dataTransfer.setData("text/plain", String(selected));
    e.dataTransfer.effectAllowed = "move";
    paint();
  });
  document.addEventListener("dragend", () => {
    nativeDragElf = null;
    selected = null;
    document
      .querySelectorAll(".drop")
      .forEach((node) => node.classList.remove("drop"));
    paint();
  });
  document.addEventListener("pointerdown", (e) => {
    const elf = e.target.closest("[data-elf]");
    if (!elf || elf.disabled || e.pointerType === "mouse") return;
    drag = {
      id: Number(elf.dataset.elf),
      x: e.clientX,
      y: e.clientY,
      active: false,
    };
    elf.setPointerCapture(e.pointerId);
  });
  document.addEventListener("pointermove", (e) => {
    if (!drag) return;
    if (
      !drag.active &&
      Math.hypot(e.clientX - drag.x, e.clientY - drag.y) > 8
    ) {
      drag.active = true;
      closeInfo();
      selected = drag.id;
      $("dragGhost").innerHTML = elfSVG(drag.id);
      $("dragGhost").hidden = false;
      paint();
    }
    if (drag.active) {
      e.preventDefault();
      $("dragGhost").style.left = `${e.clientX - 20}px`;
      $("dragGhost").style.top = `${e.clientY - 24}px`;
    }
  });
  document.addEventListener("pointerup", (e) => {
    if (!drag) return;
    if (drag.active) {
      const destination = document
        .elementFromPoint(e.clientX, e.clientY)
        ?.closest("[data-destination]");
      if (destination) moveElf(Number(destination.dataset.destination));
      // A drop that moved nothing lets go of the elf.
      if (selected !== null) {
        selected = null;
        paint();
      }
      suppressClick = { elf: drag.id, until: performance.now() + 500 };
    }
    $("dragGhost").hidden = true;
    drag = null;
  });
  document.addEventListener("pointerup", (e) => {
    const help = e.target.closest("[data-help]");
    if (e.pointerType === "touch" && help)
      openInfo(help, help.dataset.help, true);
  });
  $("breakDialog").addEventListener("cancel", (event) =>
    event.preventDefault(),
  );
  // Escape can still close a modal dialog after two cancels; while the choice is open the card
  // comes back, or the clock would stay stopped with nothing to pick.
  $("breakDialog").addEventListener("close", () =>
    queueMicrotask(() => {
      if (started && view.choice && !view.end && !breakAside) paintChoice();
    }),
  );
  $("breakDialog").addEventListener("click", (event) => {
    const open = event.target.closest("[data-open-case]");
    if (!open || !view.case) return;
    breakAside = true;
    caseOpen = true;
    $("breakDialog").close();
    paint();
  });
  // Escape closes the decision card; the half-time card then comes back.
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && breakAside) queueMicrotask(paint);
  });
  $("copyResult").onclick = async () => {
    const end = view.end;
    const link = new URL(location.href);
    link.searchParams.set("seed", seed);
    const verdict = end.assurance?.verdict;
    const result = `Santa's AI Workshop: ${end.stars}/3 stars. ${end.right} right gifts, ${end.wrong} wrong.${verdict ? ` Checking: ${verdict}.` : ""} ${link.href}`;
    try {
      await navigator.clipboard.writeText(result);
      text("copyStatus", "Result copied.");
      $("copyFallback").hidden = true;
    } catch {
      $("copyFallback").value = result;
      $("copyFallback").hidden = false;
      $("copyFallback").focus();
      $("copyFallback").select();
      text("copyStatus", "Select and copy your result below.");
    }
  };
  $("start").onclick = () => {
    showTour = $("walkthrough").checked;
    started = true;
    $("intro").close();
    $("board").scrollLeft = 0;
    if (showTour) showTourStep(0);
    else paint();
  };
  $("pause").onclick = () => {
    manualPaused = !manualPaused;
    paint();
  };
  $("tourNext").onclick = nextTourStep;
  $("tourSkip").onclick = endTour;
  // In the tour Enter goes on (buttons keep their own Enter) and Escape skips.
  document.addEventListener("keydown", (event) => {
    if (tourStep === null) return;
    if (event.key === "Escape") {
      event.preventDefault();
      endTour();
    } else if (
      event.key === "Enter" &&
      !event.target.closest("button, a, input")
    ) {
      event.preventDefault();
      nextTourStep();
    }
  });
  $("caseCue").onclick = () => {
    caseOpen = !caseOpen;
    if (caseOpen && view.case && innerWidth < 1000) {
      const anchor = caseAnchor(view.case),
        rect = anchor.getBoundingClientRect();
      if (
        rect.left < 0 ||
        rect.right > innerWidth ||
        rect.top < 0 ||
        rect.bottom > innerHeight
      )
        anchor.scrollIntoView({ block: "nearest", inline: "nearest" });
    }
    paint();
    if (caseOpen) focusCase();
  };
  $("closeCase").onclick = () => {
    caseOpen = false;
    paint();
    returnFocus();
  };
  // In play the Walkthrough button shows the tour again, with the clock stopped.
  $("guidanceToggle").onclick = () => {
    if (!started) $("walkthrough").checked = !$("walkthrough").checked;
    else if (!view.end && !view.choice && tourStep === null) showTourStep(0);
  };
  $("restart").onclick = () => {
    if (!started || view.end) {
      reset();
      return;
    }
    restartOpen = true;
    $("restartDialog").showModal();
    paint();
  };
  $("confirmRestart").onclick = () => reset();
  $("cancelRestart").onclick = () => {
    restartOpen = false;
    $("restartDialog").close();
    paint();
  };
  $("restartDialog").addEventListener("cancel", () => {
    restartOpen = false;
    paint();
  });
  // The opening card is the only way in, so Escape cannot close it before the run starts.
  $("intro").addEventListener("cancel", (event) => event.preventDefault());
  $("intro").addEventListener("close", () => {
    if (!started) $("intro").showModal();
  });
  $("replay").onclick = () => {
    showTour = false;
    reset(false);
    $("start").click();
  };
  $("closeReport").onclick = () => $("report").close();
  // Reduced motion starts from the player's saved choice, else from the system setting.
  function setMotion(reduced) {
    if (reduced) StationFlow.stop();
    document.body.classList.toggle("reduce-motion", reduced);
    $("motion").setAttribute("aria-pressed", String(reduced));
  }
  let savedMotion = null;
  try {
    savedMotion = localStorage.getItem("workshop-reduce-motion");
  } catch {}
  setMotion(
    savedMotion
      ? savedMotion === "yes"
      : matchMedia("(prefers-reduced-motion: reduce)").matches,
  );
  $("motion").onclick = () => {
    const reduced = !document.body.classList.contains("reduce-motion");
    setMotion(reduced);
    try {
      localStorage.setItem("workshop-reduce-motion", reduced ? "yes" : "no");
    } catch {}
  };
  let lastTime = performance.now(),
    accumulated = 0;
  // An open decision card stops the clock while the player reads it; the gold cue alone does not.
  function caseStopsClock() {
    return caseOpen && !!view.case && started && !view.end;
  }
  function frame(now) {
    const dt = Math.min(0.25, (now - lastTime) / 1000);
    lastTime = now;
    if (
      started &&
      !manualPaused &&
      !restartOpen &&
      !document.hidden &&
      tourStep === null &&
      !caseStopsClock() &&
      !view.choice &&
      !view.end
    ) {
      game.step(dt);
      accumulated += dt;
      if (accumulated > 0.12) {
        accumulated = 0;
        paint();
      }
    }
    requestAnimationFrame(frame);
  }
  document.addEventListener("visibilitychange", () => {
    lastTime = performance.now();
    paint();
  });
  function repositionPopups() {
    paintTour();
    paintCase();
    if (infoAnchor)
      positionPanel($("infoPopover"), infoPositionAnchor(), [
        infoPositionAnchor(),
      ]);
  }
  window.addEventListener("resize", repositionPopups);
  document.addEventListener("scroll", repositionPopups, true);
  // The checking gauge: a half circle from too little (0) to too much (1). The zones come from the
  // rules' thresholds, so the needle always sits in the zone the verdict names. A bottleneck is
  // not an amount of checking: the dial greys out and names the full pile instead of pointing.
  const dialHeadings = {
    "too little": "Too little checking",
    "about right": "About right",
    "too much": "Too much checking",
    bottleneck: "Checking was the bottleneck",
  };
  function dialSVG(position, verdict, thresholds) {
    const { little, much } = thresholds;
    const stuck = verdict === "bottleneck";
    const cx = 180,
      cy = 166,
      r = 118;
    const at = (p, radius) => {
      const angle = Math.PI * (1 - p);
      return [cx + radius * Math.cos(angle), cy - radius * Math.sin(angle)].map(
        (n) => Math.round(n * 10) / 10,
      );
    };
    const arc = (from, to, radius = r) => {
      const [x1, y1] = at(from, radius),
        [x2, y2] = at(to, radius);
      return `M${x1} ${y1} A${radius} ${radius} 0 0 1 ${x2} ${y2}`;
    };
    const p = Math.max(0, Math.min(1, position));
    const zone = (cls, from, to, word) =>
      `<path class="dial-zone ${cls}${verdict === word ? " on" : ""}" d="${arc(from, to)}"/>`;
    const [px, py] = at(p, r),
      [nx, ny] = at(p, r - 20),
      [lx, ly] = at(p, r + 37);
    const pointer = stuck
      ? `<g class="dial-stuck-mark"><circle cx="${cx}" cy="${cy - 46}" r="30"/>` +
        `<svg x="${cx - 18}" y="${cy - 64}" width="36" height="36" viewBox="0 0 24 24"><use href="#ui-bottleneck"/></svg></g>`
      : `<line class="dial-needle" x1="${cx}" y1="${cy}" x2="${nx}" y2="${ny}"/>` +
        `<circle class="dial-hub" cx="${cx}" cy="${cy}" r="11"/><circle class="dial-hub-dot" cx="${cx}" cy="${cy}" r="4"/>` +
        `<circle class="dial-pin" cx="${px}" cy="${py}" r="11"/>` +
        `<g class="dial-you" transform="translate(${lx} ${ly})"><rect x="-23" y="-12" width="46" height="24" rx="12"/><text y="4.5" text-anchor="middle">You</text></g>`;
    return (
      `<svg viewBox="0 0 360 212" aria-hidden="true"${stuck ? ' class="dial-stuck"' : ""}>` +
      `<path id="dialMiddle" class="dial-guide" d="${arc(little, much, r - 6)}"/>` +
      zone("zone-little", 0, little, "too little") +
      zone("zone-much", much, 1, "too much") +
      zone("zone-right", little, much, "about right") +
      [little, much]
        .map((b) => {
          const [x1, y1] = at(b, r - 17),
            [x2, y2] = at(b, r + 17);
          return `<line class="dial-split" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"/>`;
        })
        .join("") +
      `<text class="dial-word${verdict === "about right" ? " on" : ""}"><textPath href="#dialMiddle" startOffset="${stuck || p >= (little + much) / 2 ? 25 : 75}%" text-anchor="middle">About right</textPath></text>` +
      `<text class="dial-end${verdict === "too little" ? " on" : ""}" x="${cx - r}" y="${cy + 38}" text-anchor="middle">Too little</text>` +
      `<text class="dial-end${verdict === "too much" ? " on" : ""}" x="${cx + r}" y="${cy + 38}" text-anchor="middle">Too much</text>` +
      pointer +
      `</svg>`
    );
  }
  const groupVerdicts = {
    paid: "Worth it",
    "cost more than it saved": "Cost more than it saved",
    "left exposed": "Left exposed",
  };
  function paintGroups(a) {
    $("assuranceGroups").replaceChildren();
    // One shared scale, so a long bar means the same money on every card.
    const scale = Math.max(
      1,
      ...a.groups.flatMap((g) => [
        g.checkCost,
        g.prevented,
        g.shippedUnchecked ? g.shippedUncheckedCost : 0,
      ]),
    );
    for (const group of a.groups) {
      const row = make("article", "assurance-group");
      row.dataset.group = group.id;
      row.dataset.verdict = group.verdict;
      row.title = group.text;
      const none = !group.parcels;
      row.dataset.none = String(none);
      const head = make("div", "group-head");
      head.append(
        iconNode(`gift-${group.id}`, "group-icon"),
        make("b", "", group.name),
      );
      // A verdict on a few pounds of checks says little: those groups show only their bars.
      if (none) head.append(make("span", "group-verdict", "none this game"));
      else if (
        group.verdict !== "cost more than it saved" ||
        group.checkCost >= 20
      )
        head.append(
          make(
            "span",
            "group-verdict",
            groupVerdicts[group.verdict] || group.verdict,
          ),
        );
      row.append(head, make("p", "group-text", group.text));
      if (!none) {
        const bars = make("div", "group-bars");
        for (const [cls, label, amount, value] of [
          ["spent", "Spent on checks", group.checkCost, money(group.checkCost)],
          [
            "stopped",
            "Mistakes stopped",
            group.prevented,
            `${money(group.prevented)} (estimate)`,
          ],
          ...(group.shippedUnchecked
            ? [
                [
                  "through",
                  "Wrong gifts that skipped a check",
                  group.shippedUncheckedCost,
                  money(group.shippedUncheckedCost),
                ],
              ]
            : []),
        ]) {
          const bar = make("div", `group-bar bar-${cls}`);
          const track = make("span", "bar-track");
          const fill = make("span", "bar-fill");
          fill.style.width = `${amount > 0 ? Math.max(2, (amount / scale) * 100) : 0}%`;
          track.append(fill);
          bar.append(
            make("span", "bar-label", label),
            make("b", "bar-value", value),
            track,
          );
          bars.append(bar);
        }
        row.append(bars);
      }
      $("assuranceGroups").append(row);
    }
  }
  function paintAssurance(end) {
    const a = end.assurance;
    $("assurance").hidden = !a;
    $("checkingPaid").hidden = !a;
    if (a) {
      const heading = dialHeadings[a.verdict] || a.verdict;
      $("assuranceDial").setAttribute("aria-label", `${heading}. ${a.text}`);
      $("assuranceDial").innerHTML = dialSVG(
        a.position,
        a.verdict,
        a.thresholds,
      );
      $("assurance").dataset.verdict = a.verdict;
      text("assuranceVerdict", heading);
      text("underCost", money(a.underCost));
      text("overCost", money(a.overCost));
      // How the loss to too many checks splits, only when gifts were held up as well.
      text(
        "overSplit",
        a.overHeld > 0
          ? `${money(a.overChecks ?? 0)} extra checks, ${money(a.overHeld)} gifts held up`
          : "",
      );
      $("overSplit").hidden = !(a.overHeld > 0);
      // The two figures above already say how much each side cost; only a bottleneck needs words.
      text("assuranceText", a.verdict === "bottleneck" ? a.text : "");
      $("assuranceText").hidden = a.verdict !== "bottleneck";
      text("checkingAnswer", end.checkingAnswer);
      $("checkingPaid").querySelector("details").open = false;
      paintGroups(a);
    }
    // One tile per practice, each line with the player's own figure so it ties back to the game.
    const practices = end.practices || [];
    $("practices").hidden = !practices.length;
    $("practiceTiles").replaceChildren(
      ...practices.map((practice) => {
        const tile = make("article", "practice-tile");
        tile.dataset.used = String(practice.used);
        const top = make("div", "practice-top");
        const badge = make("span", "practice-badge");
        badge.innerHTML = practice.used ? tickSVG : "";
        badge.append(practice.used ? "Used" : "Not used");
        top.append(iconNode(practice.id, "practice-icon"), badge);
        tile.append(top, make("h4", "practice-name", practice.name));
        for (const action of practice.actions) {
          const line = make("p", "practice-action", action.label);
          line.dataset.used = String(action.used);
          line.append(make("span", "practice-figure", action.figure));
          tile.append(line);
        }
        if (practice.note)
          tile.append(make("p", "practice-note", practice.note));
        tile.setAttribute(
          "aria-label",
          `${practice.name}: ${practice.actions.map((a) => `${a.label}, ${a.used ? "used" : "not used"}, ${a.figure}`).join("; ")}${practice.note ? `. ${practice.note}` : ""}`,
        );
        return tile;
      }),
    );
  }
  const tickSVG =
    '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  function paintBlunders(e) {
    text(
      "collectionTitle",
      e.blunderTotal !== undefined
        ? `Christmas blunders · ${collectedBlunders.length}/${e.blunderTotal} found`
        : "Christmas blunders",
    );
    $("blunderCollection").replaceChildren(
      ...collectedBlunders.map((item) => {
        const card = make("div", "blunder");
        card.append(
          drawnToy(item.name, false, "blunder-art"),
          make("b", "", item.name),
        );
        return card;
      }),
    );
    const missing =
      e.blunderTotal !== undefined
        ? e.blunderTotal - collectedBlunders.length
        : 0;
    if (missing > 0) {
      const locked = make("div", "blunder blunder-locked");
      locked.append(
        make("span", "blunder-art", "?"),
        make("b", "", `${missing} more to find`),
      );
      $("blunderCollection").append(locked);
    }
  }
  // The money as one row of figures: what each part cost, adding up to the cost so far against its
  // limit, then what checking stopped, under the same names as the dial and the bars.
  function paintAccount(e) {
    const c = e.costs;
    $("account").replaceChildren();
    for (const [icon, label, value, cls] of [
      ["ai", "AI", money(c.ai), ""],
      ["checks", "Spent on checks", money(c.checking), ""],
      ["pause", "Half-time", money(c.halfTime ?? 0), ""],
      ["fixing", "Fixing", money(c.fixing), ""],
      ["mistakes", "Wrong gifts", money(c.mistakes), "account-loss"],
      [
        "budget",
        "Cost",
        `${money(c.total)} of ${money(c.limit)}`,
        "account-total",
      ],
      [
        "prevented",
        "Mistakes stopped (estimate)",
        money(c.prevented),
        "account-saved",
      ],
    ]) {
      const item = make("div", `account-item ${cls}`);
      const name = make("dt", "");
      name.append(iconNode(icon, "account-icon"), label);
      item.append(name, make("dd", "", value));
      $("account").append(item);
    }
  }
  // Lessons that tell the story of one cause, by the rules' lesson titles.
  const lessonCauses = {
    "A decision waited too long": "faulty",
    "A faulty update ran unchecked": "faulty",
    "The faulty update ran too long": "faulty",
    "Guesses went wrong": "guessed",
    "Big gifts the AI got wrong": "big",
    "Checkers stopped looking": "waved",
    "Tired elves slipped": "tired",
  };
  function showReport() {
    const e = view.end;
    paintAssurance(e);
    const hadPreviousGame = bestStars !== null;
    const newBest = hadPreviousGame && e.stars > bestStars;
    bestStars = Math.max(bestStars ?? 0, e.stars);
    const collection = new Map(
      collectedBlunders.map((item) => [item.id, item]),
    );
    for (const item of e.blunders || []) collection.set(item.id, item);
    collectedBlunders = [...collection.values()];
    try {
      localStorage.setItem("workshop-best-stars", String(bestStars));
      localStorage.setItem(
        "workshop-blunders",
        JSON.stringify(collectedBlunders),
      );
    } catch {}
    $("endStars").replaceChildren(
      make("span", "end-stars-number", e.stars),
      make("small", "", " / 3"),
      make("span", "end-stars-label", "stars"),
    );
    $("endGoals").replaceChildren(
      ...(e.goals || []).map((g) => goalSlot(g, view.run.goalsCountFrom)),
    );
    text(
      "personalBest",
      hadPreviousGame
        ? `${newBest ? "New best! " : ""}Best: ${bestStars} of 3 stars`
        : "",
    );
    text("resultTitle", e.headline);
    // One lesson line under the headline; its title names it for screen readers and on hover.
    text("lessonText", e.lesson.text || e.lesson.title);
    $("lessonText").title = e.lesson.title;
    $("lessonText").setAttribute(
      "aria-label",
      `${e.lesson.title}. ${e.lesson.text}`,
    );
    // A cause the lesson already explains keeps its figures here but not its advice again.
    paintCauses(
      $("endCauses"),
      e.causes || [],
      "No wrong gifts this Christmas.",
    );
    const toldCause = lessonCauses[e.lesson.title];
    const told = [...$("endCauses").children].find(
      (item) =>
        item.dataset.cause === toldCause ||
        item.querySelector("b")?.textContent === e.lesson.title,
    );
    told?.querySelector(".cause-fix")?.remove();
    paintAccount(e);
    paintBlunders(e);
    text("copyStatus", "");
    $("copyFallback").hidden = true;
    hideToast();
    $("report").showModal();
    $("report").scrollTop = 0;
  }
  reset();
  requestAnimationFrame(frame);
})();
