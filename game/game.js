(() => {
  "use strict";
  const look =
    new URLSearchParams(location.search).get("look") === "polish"
      ? "polish"
      : "paper";
  document.body.dataset.look = look;
  const Art =
    look === "polish" && typeof PolishArt !== "undefined"
      ? PolishArt
      : PaperArt;
  document.body.insertAdjacentHTML(
    "afterbegin",
    PaperArt.defs + (Art === PaperArt ? "" : Art.defs),
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
  const queueIds = [
    ["letters", "clarify"],
    ["orders"],
    ["check", "pass", "rework"],
  ];
  const stationNames = ["LETTERS", "TOYS", "ELVES CHECK"];
  let game,
    view,
    started = false,
    manualPaused = false,
    restartOpen = false,
    restartGuided = null,
    selected = null,
    caseOpen = false,
    lastMoment = null,
    lastCase = null,
    ended = false;
  let remembered = false;
  try {
    remembered =
      localStorage.getItem("workshop-walkthrough-finished") === "yes";
  } catch {}
  let guided = !remembered,
    lastWrong = null,
    lastArrival = null,
    notice = null,
    newsSeen = new Set(),
    rateChanges = new Map(),
    spareHints = new Map();
  let infoAnchor = null,
    infoKey = null,
    infoPinned = false,
    drag = null,
    suppressClick = 0,
    nativeDragElf = null;
  let lastChoice = null,
    observedRight = 0,
    observedRun = null,
    caughtSnapshot = null,
    caughtUntil = 0,
    toastUntil = 0;
  let personalBest = null,
    collectedBlunders = [];
  try {
    const saved = JSON.parse(localStorage.getItem("workshop-personal-best"));
    if (saved && Number.isFinite(saved.points)) personalBest = saved;
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
  const revealedToy = (toy, cls) => {
    const node = make("span", cls);
    const art = PaperArt.toy(toy.name);
    if (art) node.innerHTML = art;
    else node.append(make("span", "", toy.icon || "🎁"));
    node.append(make("span", "", toy.name));
    return node;
  };
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
    station.innerHTML = `<div class="column-heading"><span class="station-number">0${s + 1}</span><h2>${stationNames[s]}</h2></div><div class="machine">${Art.scene(s)}<strong class="station-rate" id="rate${s}"></strong><span class="station-bottleneck" id="bottleneck${s}"></span><span class="capacity-label">${["Reading", "Toy making", "Dispatch at current checking"][s]}</span><span class="focus-note" id="focus${s}"></span></div><div class="queue-piles" id="piles${s}"></div><div class="crew-heading"><span>Elves</span><span id="staff${s}" data-info="staff:${s}" tabindex="0"></span></div><div class="crew" id="elves${s}"></div><span class="crew-hint" id="spare${s}"></span><button class="move-target" data-move="${s}" hidden>Move here</button><div class="controls" id="controls${s}"></div><div class="feedback-slot" id="feedback${s}"></div>`;
    station
      .querySelector(".column-heading")
      .append(
        infoButton(`station:${s}`, `About ${stationNames[s].toLowerCase()}`),
      );
    $("board").insertBefore(station, $("sleigh"));
    for (const id of queueIds[s]) {
      const q = make("button", "queue");
      q.id = `queue-${id}`;
      q.dataset.info = `queue:${id}`;
      q.dataset.help = `queue:${id}`;
      q.innerHTML =
        '<span class="queue-tag"><span class="queue-name"></span><strong class="queue-count"><span class="queue-amount"></span><span class="queue-trend" role="img"></span></strong></span><span class="queue-picture"><span class="stack"></span></span><span class="queue-rate"></span><progress max="1" value="0"></progress>';
      $(`piles${s}`).append(q);
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
    if (s === 0) {
      const b = make("button", "small-action", "💬 Ask the child");
      b.dataset.action = "ask";
      b.dataset.info = "action:ask";
      addGroup("ask", b);
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
      for (const [key, label] of [["bypass", "↗ Let through"]]) {
        const b = make("button", "small-action", label);
        b.dataset.action = key;
        b.dataset.info = `action:${key}`;
        addGroup(key, b);
      }
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
    rate.append(
      $(`rate${s}`),
      $(`bottleneck${s}`),
      station.querySelector(".capacity-label"),
    );
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
  $("sleigh").querySelector(".column-heading").append(cargoBadge);
  const sleigh = $("sleigh"),
    sleighScene = make("div", "paper-scene paper-sleigh-scene");
  sleigh.querySelector(".sleigh-art").innerHTML = Art.scene(3);
  sleighScene.append(
    sleigh.querySelector(".sleigh-art"),
    sleigh.querySelector(".sleigh-total"),
    $("runStars"),
    $("arrival"),
  );
  const sleighBelt = make("div", "paper-belt");
  sleighBelt.setAttribute("aria-hidden", "true");
  const sleighControls = make("div", "controls paper-sleigh-controls");
  sleighControls.append($("wrongDelivery"), $("recentGifts"), $("sleighNote"));
  sleigh.append(sleighScene, sleighBelt, $("cocoa"), sleighControls);
  $("cocoa").classList.add("paper-floor");
  $("cocoa").querySelector(".cocoa-label > span").innerHTML =
    '<svg viewBox="0 0 80 80" aria-hidden="true"><use href="#mug"/></svg>';
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
      b.innerHTML = `${elfSVG(i)}<span class="elf-name"></span><span class="elf-task"></span><progress class="fatigue" max="100" value="0"></progress><span class="elf-doing" aria-hidden="true"></span>`;
      const more = infoButton(`elf:${i}`, `About ${elf.name}`);
      more.classList.add("elf-info");
      wrap.append(b, more);
      elfNodes.push(wrap);
    });
  }
  function reset(showIntro = true, freshSeed = true) {
    if (freshSeed) seed = nextSeed();
    game = new Workshop({ seed, guided });
    view = game.view();
    started = false;
    manualPaused = false;
    restartOpen = false;
    selected = null;
    caseOpen = false;
    lastMoment = null;
    lastCase = null;
    ended = false;
    lastWrong = null;
    lastArrival = null;
    newsSeen = new Set();
    notice = null;
    rateChanges.clear();
    spareHints.clear();
    closeInfo();
    buildElves();
    $("walkthrough").checked = guided;
    $("report").close();
    $("breakDialog").close();
    lastChoice = null;
    observedRight = 0;
    observedRun = null;
    caughtSnapshot = null;
    $("celebration").replaceChildren();
    $("milestoneToast").hidden = true;
    $("restartDialog").close();
    const url = new URL(location.href);
    if (fixedSeed !== null) url.searchParams.set("seed", fixedSeed);
    else url.searchParams.delete("seed");
    url.searchParams.delete("version");
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
    const before = game.view();
    if (game.move(selected, destination)) {
      view = game.view();
      for (const id of Object.keys(view.queues)) {
        if (
          queueIds[before.elves[selected].station]?.includes(id) ||
          queueIds[destination]?.includes(id)
        )
          rateChanges.set(id, {
            before: before.queues[id].rate,
            after: view.queues[id].rate,
            until: performance.now() + 5000,
          });
      }
      selected = null;
      paint();
    }
  }
  function acknowledge() {
    if (view.moment) perform(() => game.acknowledge(view.moment.id));
  }
  function skip() {
    perform(() => game.skipGuidance());
    guided = false;
  }
  function paint() {
    view = game.view();
    text("right", `${view.sleigh.right} / ${view.run?.target ?? view.target}`);
    $("goal").max = view.run?.target ?? view.target;
    $("goal").value = view.sleigh.right;
    text("wrong", view.sleigh.wrong);
    text("budget", money(view.budget.left));
    text("scoreValue", view.score?.points ?? 0);
    text(
      "scoreStars",
      view.score ? `${view.score.stars} ★ / ${view.score.best}` : "",
    );
    text("runLabel", view.run ? `${view.run.number}/${view.run.of}` : "");
    text("cargoBadge", `${view.run.cargo.icon} ${view.run.cargo.name}`);
    $("cargoBadge").setAttribute(
      "aria-label",
      `${view.run.cargo.name}. About this cargo.`,
    );
    text(
      "runStars",
      (view.run?.stars || [])
        .map((stars, i) => `${i + 1}: ${"★".repeat(stars)}`)
        .join("   "),
    );
    const doors = $("adventRuns");
    if (doors.children.length !== view.run.of) {
      doors.replaceChildren(
        ...Array.from({ length: view.run.of }, (_, i) => {
          const door = make("div", "run-door");
          door.append(
            make("span", "door-number", i + 1),
            make("span", "door-stars"),
          );
          return door;
        }),
      );
    }
    [...doors.children].forEach((door, i) => {
      const stars = view.run.stars[i];
      door.dataset.state =
        stars !== undefined
          ? "done"
          : i + 1 === view.run.number
            ? "current"
            : "later";
      door.querySelector(".door-stars").textContent =
        stars === undefined ? "" : "★".repeat(stars) || "☆";
      door.setAttribute(
        "aria-label",
        `Sleigh ${i + 1}${stars === undefined ? (i + 1 === view.run.number ? ", current" : ", upcoming") : `, ${stars} stars`}`,
      );
    });
    $("paceFill").max = view.target;
    $("paceFill").value = view.pace.projected;
    $("paceFill").setAttribute(
      "aria-label",
      `Projected ${Math.round(view.pace.projected)} of ${view.target} correct gifts`,
    );
    $("countdownRing").style.setProperty(
      "--remaining",
      Math.max(0, view.run.leavesIn / (view.duration / view.run.of)),
    );
    $("wrongBadge").classList.toggle("has-wrong", view.sleigh.wrong > 0);
    const left = Math.ceil(view.run?.leavesIn ?? view.duration - view.t);
    text(
      "clock",
      `${Math.floor(left / 60)}:${String(left % 60).padStart(2, "0")}`,
    );
    text(
      "mission",
      `Deliver ${view.target} correct gifts${view.run ? ` across ${view.run.of} sleighs` : ""} in ${Math.round(view.duration / 60)} minutes.`,
    );
    text(
      "paceLabel",
      `Projected ${Math.round(view.pace.projected)} / ${view.target} overall`,
    );
    $("pause").disabled = !started || !!view.end;
    text("pause", manualPaused ? "Resume" : "Pause");
    text(
      "pauseState",
      !started
        ? "Ready to start"
        : view.end
          ? "Departure"
          : manualPaused
            ? "Paused by you"
            : view.choice
              ? "Paused for your choice"
              : view.moment
                ? "Paused for guidance"
                : document.hidden
                  ? "Paused while away"
                  : "",
    );
    for (let s = 0; s < 3; s++) {
      const station = view.stations[s];
      text(`staff${s}`, `${station.working} working · ${station.idle} idle`);
      const capacity = station.rate;
      text(`rate${s}`, `${Math.round(capacity)} a minute`);
      text(`bottleneck${s}`, view.pace.slowest === s ? "Bottleneck" : "");
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
        node.querySelector(".queue-amount").textContent =
          `${q.parcels.length}/${q.limit}`;
        const trend = node.querySelector(".queue-trend");
        trend.textContent =
          { growing: "↑", shrinking: "↓", steady: "→" }[q.trend] || "";
        trend.dataset.trend = q.trend || "";
        trend.setAttribute("aria-label", q.trend ? `Pile ${q.trend}` : "");
        node.classList.toggle("blocked", !!q.blocked);
        node.classList.toggle("full", q.parcels.length >= q.limit);
        node.querySelector("progress").value = q.progress;
        const change = rateChanges.get(id);
        node.querySelector(".queue-rate").hidden = id === "pass";
        node.querySelector(".queue-rate").textContent =
          change && change.until > performance.now()
            ? `${Math.round(change.after - change.before) > 0 ? "+" : ""}${Math.round(change.after - change.before)} a minute${Math.round(change.after - change.before) === 0 ? " unchanged" : ""}`
            : `${Math.round(q.rate)} a minute`;
        node.dataset.delta =
          change && change.after < change.before ? "down" : "up";
        node.classList.toggle(
          "rate-changed",
          !!change && change.until > performance.now(),
        );
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
              id === "letters" || id === "clarify" ? "✉" : "🎁",
            );
            item.innerHTML =
              Art.pile?.(id, index) ||
              Art.icon(
                id === "letters" || id === "clarify"
                  ? "env"
                  : p.big
                    ? "parcel-k"
                    : "parcel-r",
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
      b.querySelector(".elf-name").textContent = elf.name;
      b.querySelector("progress").value = elf.tired;
      b.classList.toggle("selected", selected === i);
      b.classList.toggle("tired", elf.tired >= 60);
      b.classList.toggle("exhausted", elf.resting);
      b.disabled = !started || !!view.end || elf.resting;
      b.setAttribute(
        "aria-label",
        `${elf.name}, ${elf.doing}, tiredness ${Math.round(elf.tired)} out of 100. Select to move.`,
      );
      const role = elf.doing.includes("asking")
        ? ["💬", "asking"]
        : elf.doing.includes("watch")
          ? ["👁", "watching"]
          : elf.doing.includes("confirm")
            ? ["✓", "confirm"]
            : elf.doing === "nothing to do"
              ? ["◌", "idle"]
              : elf.station === 3 || elf.resting
                ? ["☕", "resting"]
                : elf.doing.includes("reading")
                  ? ["✉", "reading"]
                  : elf.doing.includes("making")
                    ? ["🛠", "making"]
                    : elf.doing.includes("checking")
                      ? ["🔎", "checking"]
                      : ["⚙", "working"];
      b.querySelector(".elf-doing").textContent = role[0];
      b.querySelector(".elf-task").textContent = role[1];
      b.dataset.role = role[1];
      b.querySelector(".elf-eyes").setAttribute(
        "href",
        "#" + artSymbol(elf.tired >= 55 ? "eyes-tired" : "eyes"),
      );
      b.querySelector(".elf-prop").setAttribute(
        "href",
        "#" +
          artSymbol(
            {
              reading: "p-letter",
              making: "p-hammer",
              checking: "p-glass",
              confirm: "p-confirming",
              watching: "p-watching",
              asking: "p-asking",
              resting: "p-resting",
            }[role[1]] || "",
          ),
      );
    });
    for (let station = 0; station < 4; station++)
      $(`elves${station}`).style.setProperty(
        "--crew-count",
        Math.max(
          1,
          Math.min(
            4,
            view.elves.filter((elf) => elf.station === station).length,
          ),
        ),
      );
    for (let station = 0; station < 2; station++) {
      text(
        `mode${station}`,
        ["Elves do the work", "Elves confirm each", "Machine works alone"][
          view.ai[station]
        ],
      );
      $(`mode${station}`).hidden =
        !started || !view.actions[`ai${station}`].unlocked;
      const spare = view.elves.filter(
        (elf) =>
          elf.station === station &&
          (elf.doing === "nothing to do" || elf.doing.includes("watch")),
      );
      text(
        `spare${station}`,
        spare.length && (spareHints.get(station) || 0) > performance.now()
          ? `${spare.length} free to move · help with checks`
          : "",
      );
      $(`spare${station}`).style.top =
        `${$(`elves${station}`).offsetTop + $(`elves${station}`).offsetHeight + 3}px`;
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
    document.querySelectorAll("[data-move]").forEach((b) => {
      b.hidden =
        selected === null ||
        view.elves[selected].station === Number(b.dataset.move);
    });
    for (const [key, group] of actionGroups) {
      const action = view.actions[key];
      group.hidden = !started || !action.unlocked;
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
    document
      .querySelector('[data-action="ask"]')
      .setAttribute("aria-pressed", String(view.ask));
    document.querySelector('[data-action="bypass"]').textContent =
      `↗ Let through ${view.queues.check.parcels.length}`;
    text("vigilance", `● ${view.vigilance.state}`);
    $("vigilance").hidden = !started || !view.actions.checking.unlocked;
    $("vigilance").dataset.state = view.vigilance.state;
    const focus = started && !view.end ? view.focus : null;
    for (let station = 0; station < 3; station++)
      text(`focus${station}`, focus?.station === station ? focus.text : "");
    text("cocoaFocus", focus?.station === 3 ? focus.text : "");
    const focusTarget =
      focus?.control === "cocoa"
        ? $("cocoa")
        : focus?.control === "elves"
          ? $(`elves${focus.station}`)
          : actionGroups.get(focus?.control);
    for (const node of [
      ...actionGroups.values(),
      $("elves0"),
      $("elves1"),
      $("elves2"),
      $("cocoa"),
    ])
      node.classList.toggle("needs-attention", node === focusTarget);
    text("sleighRight", view.sleigh.right);
    const arrivals = view.sleigh.parcels;
    const newest = arrivals.at(-1);
    if (newest && newest.id !== lastArrival) {
      lastArrival = newest.id;
      text("arrivalIcon", newest.made?.icon || "🎁");
      if (newest.made && PaperArt.toy(newest.made.name))
        $("arrivalIcon").innerHTML = PaperArt.toy(newest.made.name);
      text(
        "arrivalLabel",
        newest.result === "wrong" ? "Wrong gift aboard" : "Gift loaded",
      );
      $("arrival").classList.toggle("wrong", newest.result === "wrong");
    }
    const wrong = arrivals.filter((p) => p.result === "wrong").at(-1);
    if (wrong) lastWrong = wrong;
    $("wrongDelivery").hidden = !lastWrong;
    if (lastWrong) {
      text("wrongToy", lastWrong.made.icon);
      if (PaperArt.toy(lastWrong.made.name))
        $("wrongToy").innerHTML = PaperArt.toy(lastWrong.made.name);
      text("wrongName", lastWrong.made.name);
      $("wrongDelivery").dataset.help = "lastWrong";
      $("wrongDelivery").dataset.info = "lastWrong";
    }
    text(
      "sleighNote",
      view.lost
        ? `${view.lost} letters lost from full piles`
        : "Departure waits for nobody.",
    );
    for (const n of [...view.news].reverse()) {
      if (newsSeen.has(n.id)) continue;
      newsSeen.add(n.id);
      handleNews(n);
      const priority =
        n.kind === "loaded" && n.check?.result === "wrong"
          ? 4
          : n.kind === "resolved"
            ? 3
            : /wrong|fault|incident/.test(n.kind)
              ? 4
              : 1;
      if (
        !notice ||
        performance.now() > notice.until ||
        priority >= notice.priority
      )
        notice = { text: n.text, priority, until: performance.now() + 9000 };
    }
    text(
      "status",
      selected !== null
        ? `${view.elves[selected].name} selected. Tap a glowing destination.`
        : started && view.moment
          ? "Workshop started · clock paused for guidance"
          : notice && notice.until > performance.now()
            ? notice.text
            : "Drag an elf, or tap one then its destination.",
    );
    paintCase();
    paintGuidance();
    paintChoice();
    paintEffects();
    if (infoKey && infoAnchor?.isConnected) renderInfo();
    if (view.end && !ended) {
      ended = true;
      remembered = true;
      guided = false;
      try {
        localStorage.setItem("workshop-walkthrough-finished", "yes");
      } catch {}
      showReport();
    }
  }
  function paintChoice() {
    const choice = started ? view.choice : null;
    if (!choice) {
      $("breakDialog").close();
      lastChoice = null;
      return;
    }
    if (lastChoice !== choice.id) {
      lastChoice = choice.id;
      const report = choice.report;
      text(
        "nextCargoTitle",
        `Next sleigh · ${choice.next.cargo.icon} ${choice.next.cargo.name}`,
      );
      text("nextCargoText", choice.next.cargo.text);
      text("nextCargoTarget", `${choice.next.target} correct gifts needed`);
      text("breakRun", `Sleigh ${report.run} has left`);
      text("breakTitle", choice.title);
      text("breakText", choice.text);
      text("breakStars", "★".repeat(report.stars));
      text(
        "breakCounts",
        `${report.right} / ${report.target} correct · ${report.wrong} wrong`,
      );
      text("breakMissed", report.missedBy || "");
      $("breakSpend").hidden = !report.spent && !report.assurance;
      text(
        "breakSpend",
        [
          ...(report.spent
            ? [
                ["🧑 People", report.spent.people],
                ["🤖 AI", report.spent.ai],
                ["🔎 Checks", report.spent.checking],
                ["🔧 Fixing", report.spent.fixing],
              ].map(([label, value]) => `${label} ${money(value)}`)
            : []),
          ...(report.assurance
            ? [
                `${report.assurance.caught} caught · ${money(report.assurance.prevented)} estimated losses prevented`,
              ]
            : []),
        ].join(" · "),
      );

      text(
        "breakBonus",
        report.bonus ? `+${report.bonus} clean-run bonus` : "",
      );
      text(
        "breakMore",
        report.more ? `${report.more} more wrong gifts were delivered.` : "",
      );
      $("breakSlips").replaceChildren();
      for (const slip of report.slips) {
        const card = make("article", "delivery-slip");
        card.append(
          revealedToy(slip.made, "slip-toy"),
          make("p", "", `Wanted: ${slip.wanted.icon} ${slip.wanted.name}`),
          make("p", "", `“${slip.wish}”`),
          make("p", "slip-cause", `${slip.cause} · ${money(slip.cost)}`),
        );
        $("breakSlips").append(card);
      }
      $("breakOptions").replaceChildren();
      $("breakOptions").style.setProperty("--choices", choice.options.length);
      for (const option of choice.options) {
        const card = make("button", "upgrade-card");
        card.dataset.choose = option.id;
        card.dataset.choiceId = choice.id;
        card.append(
          make(
            "span",
            "upgrade-icon",
            { update: "🤖", tested: "🧪", train: "🎓", rest: "☕" }[
              option.kind
            ] || "🎁",
          ),
          make("strong", "", option.label),
          make("p", "", option.text),
        );
        const facts = make("dl", "upgrade-facts");
        for (const fact of option.facts)
          facts.append(make("dt", "", fact.label), make("dd", "", fact.value));
        card.append(facts);
        $("breakOptions").append(card);
      }
    }
    closeInfo();
    if (!$("breakDialog").open) {
      $("breakDialog").showModal();
      $("nextCargoTitle").focus({ preventScroll: true });
      $("breakDialog").scrollTop = 0;
      $("breakDeparture").classList.remove("break-arrival");
      void $("breakDeparture").offsetWidth;
      $("breakDeparture").classList.add("break-arrival");
    }
  }
  function handleNews(news) {
    if (!started) return;
    if (news.kind === "milestone") {
      text("milestoneToast", `🎁 ${news.text}`);
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
  function paintEffects() {
    text("sleighTarget", `of ${view.run.target} needed`);
    const run = view.run?.number ?? 1;
    if (run !== observedRun) {
      observedRun = run;
      observedRight = 0;
    }
    const gained = view.sleigh.right - observedRight;
    observedRight = view.sleigh.right;
    if (started && gained > 0 && !view.end) {
      const effect = make("span", "gift-flight", `🎁 +${gained}`);
      const from = $("queue-pass").getBoundingClientRect(),
        to = $("sleighRight").getBoundingClientRect();
      const visible = to.left >= 0 && to.right <= innerWidth;
      const target = visible ? to : $("right").getBoundingClientRect();
      effect.style.left = `${Math.max(12, Math.min(innerWidth - 100, visible ? from.right - 40 : target.left))}px`;
      effect.style.top = `${Math.max(12, Math.min(innerHeight - 40, visible ? from.top : target.bottom))}px`;
      effect.style.setProperty(
        "--fly-x",
        `${visible ? target.left - from.right + 40 : 0}px`,
      );
      effect.style.setProperty(
        "--fly-y",
        `${visible ? target.top - from.top : 0}px`,
      );
      while ($("celebration").children.length >= 4)
        $("celebration").firstChild.remove();
      $("celebration").append(effect);
      setTimeout(() => effect.remove(), 1500);
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
    if (caughtSnapshot)
      caught.textContent = `Caught! ${caughtSnapshot.made.icon} ${caughtSnapshot.made.name}`;
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
    if (
      panel.id === "tutorial" &&
      panel.dataset.compact === "true" &&
      anchor.closest(".station")
    ) {
      const column = anchor.closest(".station").getBoundingClientRect();
      if (p.width <= column.width - 2 && column.left >= 0 && column.right <= w)
        horizontal = Math.max(
          column.left + 1,
          Math.min(horizontal, column.right - p.width - 1),
        );
    }
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
    panel.style.left = `${Math.max(12, Math.min(fit.x, w - p.width - 12))}px`;
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
  function paintGuidance() {
    const moment = started && !view.end ? view.moment : null;
    $("guidanceContinue").hidden = !moment;
    $("tutorial").hidden = !moment || moment.control === "case";
    $("caseGuidance").hidden = !moment || moment.control !== "case";
    if (!moment) {
      hidePopupPointer("tutorial");
      delete $("tutorial").dataset.anchorVisit;
      lastMoment = null;
      return;
    }
    $("tutorial").dataset.control = moment.control;
    $("tutorial").dataset.compact = String(
      ["ai0", "ai1", "ask", "checking", "cocoa", "bypass"].includes(
        moment.control,
      ),
    );
    text("tutorialTitle", moment.title);
    text("tutorialText", moment.text);
    text(
      "tutorialPause",
      manualPaused
        ? "Your pause stays on after guidance."
        : "The clock resumes when you continue.",
    );
    text("caseGuidanceText", moment.text);
    if (moment.control === "case") {
      hidePopupPointer("tutorial");
      caseOpen = true;
      paintCase();
    } else {
      const ai = moment.control === "ai0" || moment.control === "ai1";
      const tiredElf = Number.isInteger(moment.elf)
        ? moment.elf
        : view.elves
            .map((elf, index) => ({ elf, index }))
            .filter((item) => item.elf.station < 3)
            .sort((a, b) => b.elf.tired - a.elf.tired)[0]?.index;
      const anchor =
        (["checking", "sleigh"].includes(moment.control) &&
        !$("wrongDelivery").hidden
          ? $("wrongDelivery")
          : null) ||
        (moment.control === "cocoa" && tiredElf !== undefined
          ? document.querySelector(`[data-elf="${tiredElf}"]`)
          : null) ||
        (ai
          ? document.querySelector(
              moment.control === "ai0" ? '[data-ai="0,1"]' : '[data-ai="1,2"]',
            )
          : null) ||
        actionGroups.get(moment.control) ||
        $(
          moment.control === "cocoa"
            ? "cocoa"
            : moment.control === "sleigh"
              ? "sleigh"
              : "elves0",
        );
      const protectedNodes = [
        ...(innerWidth >= 1000 &&
        ["elves", "cocoa", "bypass"].includes(moment.control)
          ? document.querySelectorAll(".machine")
          : []),
        ...document.querySelectorAll(".crew, [data-move]:not([hidden])"),
        $("cocoa"),
        ...(["ai0", "ai1", "ask", "checking", "cocoa", "bypass"].includes(
          moment.control,
        )
          ? [
              ...(actionGroups.has(moment.control)
                ? [actionGroups.get(moment.control)]
                : []),
              ...(anchor.closest(".station")?.querySelectorAll(".queue") || []),
            ]
          : []),
        anchor,
      ];
      showAnchorOnce($("tutorial"), anchor, moment.id);
      positionPanel($("tutorial"), anchor, protectedNodes);
    }
    lastMoment = moment.id;
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
    text(
      "caseCue",
      c.resolving
        ? `⏱ ${Math.ceil(c.resolving.remaining)}s · decision in progress`
        : "💬 Decision waiting",
    );
    if (lastCase !== c.id) {
      lastCase = c.id;
      caseOpen = false;
    }
    $("casePanel").hidden = !started || !caseOpen || !!view.end;
    if ($("casePanel").hidden) {
      hidePopupPointer("casePanel");
      delete $("casePanel").dataset.anchorVisit;
      return;
    }
    const headings = {
      update: { offered: "AI update offer", tested: "Update test result" },
      incident: {
        source: "Stop new mistakes",
        made: "Gifts in the workshop",
        aboard: "Wrong gifts on sleigh",
      },
      judge: "Checker question",
      unclear: "Clarify this wish",
      pattern: "Repeated mistake",
    };
    text(
      "caseKind",
      typeof headings[c.kind] === "string"
        ? headings[c.kind]
        : headings[c.kind]?.[c.step] || "Workshop decision",
    );
    text("caseTitle", c.text);
    const facts = $("caseFacts");
    $("casePanel").dataset.kind = c.kind;
    const preferred =
      c.kind === "update"
        ? c.step === "tested"
          ? ["Promises", "Test", "After the test"]
          : ["Promises", "Updates like this go wrong", "A test now"]
        : null;
    const hasPrimary = c.facts.some((f) => typeof f.primary === "boolean");
    const shown = hasPrimary
      ? c.facts
          .map((f, i) => (f.primary ? i : -1))
          .filter((i) => i >= 0)
          .slice(0, 3)
      : preferred
        ? preferred
            .map((label) => c.facts.findIndex((f) => f.label === label))
            .filter((i) => i >= 0)
        : c.facts.slice(0, 3).map((_, i) => i);
    if (!shown.length) shown.push(...c.facts.slice(0, 3).map((_, i) => i));
    const signature = shown.map((i) => c.facts[i].label).join("|");
    if (facts.dataset.signature !== signature) {
      facts.dataset.signature = signature;
      facts.replaceChildren();
      for (const i of shown) {
        const b = make("button", "fact-chip");
        b.append(make("b"), make("small"));
        b.dataset.help = `fact:${i}`;
        b.dataset.info = `fact:${i}`;
        facts.append(b);
      }
      if (c.facts.length > shown.length) {
        const more = make("button", "more-evidence", "i · All evidence");
        more.dataset.help = "caseFacts";
        more.dataset.info = "caseFacts";
        facts.append(more);
      }
    }
    shown.forEach((index, position) => {
      const f = c.facts[index],
        button = facts.children[position];
      const symbol = /cost|price|worth|loss/i.test(f.label)
        ? "£"
        : /wrong|fault|chance/i.test(f.label)
          ? "⚠"
          : /time|test|second/i.test(f.label)
            ? "⏱"
            : /parcel|gift|made|aboard/i.test(f.label)
              ? "📦"
              : "◈";
      button.querySelector("b").textContent = `${symbol} ${f.value}`;
      button.querySelector("small").textContent = f.label;
    });
    const evidence = $("caseEvidence");
    const evidenceSignature = JSON.stringify(c.evidence);
    if (evidence.dataset.signature !== evidenceSignature) {
      evidence.dataset.signature = evidenceSignature;
      evidence.replaceChildren();
      for (const e of c.evidence) {
        const row = make("div", "evidence-item");
        const wish = make("p", "wish", `“${e.wish}”`);
        row.append(wish);
        if (e.made) row.append(revealedToy(e.made, "toy-evidence"));
        if (e.reading)
          row.append(
            make(
              "p",
              "reading",
              `AI reads: ${typeof e.reading === "string" ? e.reading : e.reading.name}`,
            ),
          );
        evidence.append(row);
      }
    }
    const options = $("caseOptions");
    const ids = new Set(c.options.map((o) => o.id));
    for (const child of [...options.children])
      if (!ids.has(child.dataset.option)) child.remove();
    for (const o of c.options) {
      let row = [...options.children].find((n) => n.dataset.option === o.id);
      if (!row) {
        row = make("div", "case-option");
        row.dataset.option = o.id;
        const b = make("button", "case-choice");
        b.dataset.resolve = o.id;
        b.dataset.info = `option:${o.id}`;
        b.innerHTML =
          '<span class="option-icon" aria-hidden="true"></span><span class="option-label"></span><span class="option-cost"></span>';
        row.append(b, infoButton(`option:${o.id}`, `Explain ${o.label}`));
        options.append(row);
      }
      const b = row.querySelector(".case-choice");
      const icons = {
        ship: "🛷",
        remake: "🛠",
        ask: "💬",
        accept: "✓",
        investigate: "🔎",
        hold: "✋",
        carryOn: "→",
        install: "🤖",
        test: "🧪",
        skip: "↪",
        rollback: "↶",
        keep: "⚙",
        remakeAll: "🛠",
        checkEach: "🔎",
        letGo: "→",
        bringBack: "↩",
        leave: "🛷",
      };
      b.querySelector(".option-icon").textContent = icons[o.id] || "◇";
      b.querySelector(".option-label").textContent = o.label;
      const scope = [
        "install",
        "test",
        "skip",
        "rollback",
        "keep",
        "investigate",
      ].includes(o.id)
        ? "⚙ line"
        : `📦 ${c.affected.count}`;
      b.querySelector(".option-cost").textContent =
        `⏱ ${o.seconds}s · ${money(o.money)} · ${scope}`;
      b.disabled = !o.available || !!c.resolving;
      b.classList.toggle("chosen", c.resolving?.optionId === o.id);
    }
    $("caseResolving").hidden = !c.resolving;
    if (c.resolving) {
      text(
        "caseProgressText",
        `${Math.ceil(c.resolving.remaining)} seconds remaining`,
      );
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
    if (c.kind === "unclear") return $("queue-clarify");
    if (c.step === "made") {
      const affected = new Set(c.affected.ids);
      const queues = Object.values(view.queues)
        .map((q) => ({
          id: q.id,
          count: q.parcels.filter((p) => affected.has(p.id)).length,
        }))
        .sort((a, b) => b.count - a.count);
      if (queues[0]?.count) return $(`queue-${queues[0].id}`);
    }
    return $("queue-check");
  }
  function getInfo(key) {
    if (key === "cargo")
      return [
        view.run.cargo.name,
        [
          view.run.cargo.text,
          `${view.run.target} correct gifts needed on this sleigh.`,
        ],
      ];
    if (key === "caughtToy" && caughtSnapshot)
      return [
        "A checker caught this",
        [
          `Wish: ${caughtSnapshot.wish}`,
          `Wanted: ${caughtSnapshot.wanted.icon} ${caughtSnapshot.wanted.name}`,
          `Made: ${caughtSnapshot.made.icon} ${caughtSnapshot.made.name}`,
        ],
      ];
    if (key === "pace")
      return [
        "Projected correct gifts",
        [
          `At the current pace, about ${Math.round(view.pace.projected)} correct gifts across all sleigh runs, against the overall target of ${view.target}.`,
          "This estimate changes when staffing, AI or checking changes.",
        ],
      ];
    if (key === "score")
      return [
        "Christmas points",
        [
          "Right gifts earn points. Wrong gifts cost points. Clean runs, stars and remaining budget also count.",
          view.score
            ? `${view.score.stars} of ${view.score.best} stars so far.`
            : "",
        ],
      ];
    if (key === "caseFacts")
      return [
        "Decision evidence",
        (view.case?.facts || []).map((f) => `${f.label}: ${f.value}`),
      ];
    const parts = key.split(":"),
      type = parts[0];
    if (type === "ai") {
      const l = view.levers[`ai${parts[1]}`][Number(parts[2])];
      return [
        l.name,
        [
          l.who,
          l.speed,
          l.risk,
          `${Math.round(l.perMinute)} parcels a minute · ${money(l.costPerMinute)} a minute`,
          Number(parts[2]) === 2
            ? Number(parts[1]) === 0
              ? "The machine reads letters. Elves can ask children about unclear wishes; idle elves can move."
              : "The machine makes toys. Elves watch for faults; watching elves can move to checking."
            : Number(parts[2]) === 1
              ? "An elf confirms each result before it moves on."
              : "",
        ],
      ];
    }
    if (type === "checking") {
      const l = view.levers.checking[Number(parts[1])];
      return [
        l.name,
        [
          l.sends || `${l.checkedPer100} of 100 checked`,
          `${l.per100 ?? l.checkedPer100} of every 100 parcels. Human elves do the checking.`,
        ],
      ];
    }
    if (type === "action") {
      const a = view.actions[parts[1]];
      return [
        {
          ask: "Ask the child",
          bypass: "Let waiting parcels through",
          train: "Train checkers",
          ai0: "Read letters",
          ai1: "Make toys",
          checking: "Human checking",
        }[parts[1]],
        [
          a.cost,
          a.why,
          parts[1] === "bypass"
            ? `${view.queues.check.parcels.length} waiting parcels would leave checking. ${view.bypassed} already let through.`
            : "",
        ].filter(Boolean),
      ];
    }
    if (type === "queue") {
      const q = view.queues[parts[1]];
      return [
        q.name,
        [
          `${q.parcels.length} waiting, room for ${q.limit}.`,
          parts[1] === "pass"
            ? `Straight-through conveyor capacity: ${Math.round(q.rate)} parcels a minute. The dispatch station shows capacity at the current checking policy.`
            : `${Math.round(q.rate)} parcels a minute with the current staffing and AI setting.`,
          q.inflow !== undefined
            ? `${Math.round(q.inflow)} parcels arriving per minute.`
            : "",
          q.trend ? `This pile is ${q.trend}.` : "",
          rateChanges.has(parts[1])
            ? `Last move: ${Math.round(rateChanges.get(parts[1]).before)} → ${Math.round(rateChanges.get(parts[1]).after)} parcels per minute.`
            : "",
          q.blocked || "Work can move through this pile.",
          "Larger gifts cost more when wrong. ? means unsure; ! marks a known faulty batch.",
        ],
      ];
    }
    if (type === "elf") {
      const e = view.elves[Number(parts[1])];
      return [
        e.name,
        [
          e.doing,
          `Tiredness ${Math.round(e.tired)} out of 100.`,
          e.resting
            ? "Finishing a cocoa break."
            : "Drag this elf, or select then tap a destination.",
        ],
      ];
    }
    if (type === "staff" || type === "station") {
      const s = Number(parts[1]),
        v = view.stations[s];
      return [
        stationNames[s],
        [
          `${v.staff} elves: ${v.working} working, ${v.idle} idle.`,
          v.rate !== undefined
            ? `${v.rate} gifts a minute: ${["reading capacity", "toy-making capacity", "human checking and passing at the current checking policy"][s]}.`
            : "",
          v.blocked ||
            "Move elves here to change the available human capacity.",
          view.pace.behind && view.pace.slowest === s
            ? "This station is holding up the target pace."
            : "",
          s === 2
            ? "The checkers are people. AI does not check its own work."
            : "AI settings change who does the work.",
          ...(s < 2
            ? view.levers[`ai${s}`].map(
                (option) =>
                  `${option.name}: ${option.who}; ${option.speed}; ${option.risk}. ${option.perMinute} a minute; ${money(option.costPerMinute)} a minute.`,
              )
            : view.levers.checking.map(
                (option) =>
                  `${option.name}: ${option.sends}; ${option.per100} in 100 parcels.`,
              )),
          ...(s === 2
            ? [
                `${view.vigilance.secondsPerCheck} seconds per human check.`,
                view.actions.checking.cost,
                view.actions.bypass.cost,
                view.actions.bypass.why,
              ]
            : s === 0
              ? [view.actions.ask.cost, view.actions.ask.why]
              : []),
          ...view.elves
            .filter((elf) => elf.station === s)
            .map(
              (elf) =>
                `${elf.name}: ${elf.doing}, tiredness ${Math.round(elf.tired)} out of 100.`,
            ),
        ].filter(Boolean),
      ];
    }
    if (type === "option") {
      const o = view.case?.options.find((o) => o.id === parts[1]);
      return [
        o?.label || "Decision",
        [
          o?.scope,
          `${o?.seconds || 0} seconds · ${money(o?.money || 0)}`,
          o?.why,
        ].filter(Boolean),
      ];
    }
    if (type === "fact") {
      const f = view.case?.facts[Number(parts[1])];
      return [f?.label || "Evidence", [f?.value || ""]];
    }
    if (type === "lastWrong") {
      return [
        "Last wrong delivery",
        [
          `Wish: ${lastWrong.wish}`,
          `Wanted: ${lastWrong.wanted.icon} ${lastWrong.wanted.name}`,
          `Made: ${lastWrong.made.icon} ${lastWrong.made.name}`,
          lastWrong.big
            ? "A costly mistake: this is a big gift."
            : "The child received the wrong toy.",
        ],
      ];
    }
    const fixed = {
      goal: [
        "Correct gifts",
        [
          `This sleigh needs ${view.run?.target ?? view.target} correct gifts. The overall goal is ${view.target} across all sleigh runs. Wrong gifts do not count.`,
        ],
      ],
      clock: [
        "Until departure",
        [
          "The sleigh leaves when this clock reaches zero.",
          "Guidance and your Pause button stop the clock. Reading information and answering cases use workshop time.",
        ],
      ],
      wrong: [
        "Wrong gifts",
        [
          `${view.sleigh.wrong} wrong gifts currently aboard. Tap the red gift in the sleigh to compare wish and toy.`,
        ],
      ],
      budget: [
        "Budget",
        [
          `${money(view.budget.left)} left. People, AI, checks and repairs all cost money. Overspending continues to count in the final account.`,
        ],
      ],
      movement: [
        "Moving elves",
        [
          "Drag an elf to a station or cocoa. Or tap an elf, then tap a highlighted destination.",
          "The pile shows its actual before and after capacity for five seconds. An automated machine may keep the same rate.",
        ],
      ],
      cocoa: [
        "Cocoa breaks",
        [
          "Tired elves work less well. Move an elf here to rest; a break takes time before they can return.",
        ],
      ],
      sleigh: [
        "The sleigh",
        [
          "Correct gifts meet the goal. Wrong gifts bring a cost. The last wrong arrival stays visible so you can inspect it.",
          "The cocoa mug is a destination: move tired elves here to rest. All elves can fit; a break must finish before they return.",
          ...view.elves
            .filter((elf) => elf.station === 3)
            .map(
              (elf) =>
                `${elf.name}: ${elf.doing}, tiredness ${Math.round(elf.tired)} out of 100.`,
            ),
        ],
      ],
      vigilance: [
        "Checker attention",
        [
          `${view.vigilance.state}. ${view.vigilance.skipped} checks skipped.`,
          `${view.vigilance.secondsPerCheck} seconds per check now.`,
          view.vigilance.trained
            ? "Checkers have been trained."
            : "A long run of clean parcels can make checkers relax.",
        ],
      ],
    };
    return (
      fixed[key] || [
        "Workshop",
        ["Tap an elf or a control to make a decision."],
      ]
    );
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
    positionPanel($("infoPopover"), infoPositionAnchor());
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
      caseOpen = false;
      $("casePanel").hidden = true;
      hidePopupPointer("casePanel");
    }
  });
  document.addEventListener("click", (e) => {
    const target = e.target.closest("button");
    if (performance.now() < suppressClick && target?.dataset.elf !== undefined)
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
    if (target.dataset.ai) {
      const [s, l] = target.dataset.ai.split(",").map(Number);
      const wasAutomated = view.ai[s] === 2;
      perform(() => game.setAi(s, l));
      if (l === 2 && !wasAutomated) {
        spareHints.set(s, performance.now() + 5000);
        paint();
      }
      return;
    }
    if (target.dataset.checking !== undefined) {
      perform(() => game.setChecking(Number(target.dataset.checking)));
      return;
    }
    if (target.dataset.action) {
      const a = target.dataset.action;
      perform(() => (a === "ask" ? game.setAsk(!view.ask) : game[a]()));
      return;
    }
    if (
      target.dataset.choose &&
      view.choice &&
      String(view.choice.id) === target.dataset.choiceId
    ) {
      perform(() => game.choose(view.choice.id, target.dataset.choose));
      return;
    }
    if (target.dataset.resolve) {
      perform(() => game.resolve(view.case.id, target.dataset.resolve));
      return;
    }
  });
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
      suppressClick = performance.now() + 500;
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
  $("copyResult").onclick = async () => {
    const end = view.end;
    const link = new URL(location.href);
    link.searchParams.set("seed", seed);
    link.searchParams.delete("version");
    const result = `Santa’s AI Workshop: ${end.points} points, ${end.stars}/${view.score.best} stars. ${end.right} correct gifts, ${end.wrong} wrong. ${link.href}`;
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
    if (guided !== $("walkthrough").checked) {
      guided = $("walkthrough").checked;
      reset(false, false);
    }
    if (!guided) game.skipGuidance();
    started = true;
    $("intro").close();
    $("board").scrollLeft = 0;
    paint();
  };
  $("pause").onclick = () => {
    manualPaused = !manualPaused;
    paint();
  };
  $("continue").onclick = acknowledge;
  $("guidanceContinue").onclick = acknowledge;
  $("caseContinue").onclick = acknowledge;
  $("dismissTutorial").onclick = acknowledge;
  $("skipGuidance").onclick = skip;
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
    paintCase();
  };
  $("closeCase").onclick = () => {
    caseOpen = false;
    if (view.moment?.control === "case") acknowledge();
    paintCase();
  };
  $("guidanceToggle").onclick = () => {
    if (!started) {
      $("walkthrough").checked = !$("walkthrough").checked;
      return;
    }
    if (guided) skip();
    else {
      restartGuided = true;
      restartOpen = true;
      text("restartTitle", "Restart with the walkthrough?");
      $("restartDialog").showModal();
    }
  };
  $("restart").onclick = () => {
    if (!started || view.end) {
      reset();
      return;
    }
    restartOpen = true;
    text("restartTitle", "Start this Christmas again?");
    $("restartDialog").showModal();
  };
  $("confirmRestart").onclick = () => {
    if (restartGuided !== null) guided = restartGuided;
    restartGuided = null;
    reset();
  };
  $("cancelRestart").onclick = () => {
    restartOpen = false;
    restartGuided = null;
    $("restartDialog").close();
  };
  $("restartDialog").addEventListener("cancel", () => (restartOpen = false));
  $("replay").onclick = () => {
    guided = false;
    reset(false);
    $("start").click();
  };
  $("closeReport").onclick = () => $("report").close();
  $("motion").onclick = () => {
    const reduced = document.body.classList.toggle("reduce-motion");
    $("motion").setAttribute("aria-pressed", String(reduced));
  };
  let lastTime = performance.now(),
    accumulated = 0;
  function frame(now) {
    const dt = Math.min(0.25, (now - lastTime) / 1000);
    lastTime = now;
    if (
      started &&
      !manualPaused &&
      !restartOpen &&
      !document.hidden &&
      !view.moment &&
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
    paintGuidance();
    paintCase();
    if (infoAnchor) positionPanel($("infoPopover"), infoPositionAnchor());
  }
  window.addEventListener("resize", repositionPopups);
  document.addEventListener("scroll", repositionPopups, true);
  function paintAssurance(end) {
    const a = end.assurance;
    $("assurance").hidden = !a;
    if (a) {
      $("assuranceDial").setAttribute(
        "aria-label",
        `Checking: ${a.verdict}, from too little to too much`,
      );
      $("assuranceMarker").style.left =
        `${Math.max(0, Math.min(1, a.position)) * 100}%`;
      text("assuranceVerdict", a.verdict);
      text("underCost", money(a.underCost));
      text("overCost", money(a.overCost));
      text("assuranceText", a.text);
      $("assuranceGroups").replaceChildren();
      for (const group of a.groups) {
        const row = make("article", "assurance-group");
        row.dataset.group = group.id;
        row.append(
          make("strong", "", `${group.icon} ${group.name}`),
          make("span", "", `${money(group.checkCost)} spent on checks`),
          make(
            "span",
            "",
            `${group.caught} caught · ${money(group.prevented)} estimated saved`,
          ),
          make(
            "span",
            "",
            `${group.shipped} wrong shipped · ${money(group.shippedCost)}`,
          ),
          make("p", "", group.text),
        );
        $("assuranceGroups").append(row);
      }
      text(
        "noChecks",
        `Estimated without checks: ${a.noChecks.wrong} wrong gifts · ${money(a.noChecks.cost)}`,
      );
    }
    $("practices").hidden = !end.used;
    $("practiceTiles").replaceChildren();
    if (!end.used) return;
    for (const [icon, actions] of [
      ["🧑🤖", [["assist", "Elves confirm AI drafts", "Human in the loop"]]],
      ["🔎", [["risky", "Check risky ones", "Risk-based checking"]]],
      ["💬", [["asked", "Ask child", "Escalate ambiguity to a person"]]],
      [
        "🧪",
        [
          ["tested", "Test update", "Test before release"],
          ["rolledBack", "Roll back", "Way to undo"],
        ],
      ],
      [
        "☕",
        [
          ["trained", "Train checkers", "Keep human oversight sharp"],
          ["rested", "Rest checkers", "Keep human oversight sharp"],
        ],
      ],
    ]) {
      const tile = make("article", "practice-tile");
      tile.append(make("span", "practice-icon", icon));
      for (const [flag, label, meaning] of actions) {
        const action = make("div", "practice-action");
        action.dataset.used = String(end.used[flag]);
        action.dataset.practice = flag;
        action.append(
          make("strong", "", `${end.used[flag] ? "✓" : "○"} ${label}`),
          make("span", "", meaning),
        );
        tile.append(action);
      }
      $("practiceTiles").append(tile);
    }
  }
  function showReport() {
    const e = view.end;
    paintAssurance(e);
    const hadPreviousGame = personalBest !== null;
    const canCelebrate = hadPreviousGame && e.points >= 0;
    const newBest =
      Number.isFinite(e.points) &&
      (!personalBest || e.points > personalBest.points);
    const newStars =
      Number.isFinite(e.stars) &&
      (!personalBest || e.stars > personalBest.stars);
    if (Number.isFinite(e.points))
      personalBest = {
        points: newBest ? e.points : personalBest.points,
        stars: newStars ? e.stars : personalBest.stars,
      };
    const collection = new Map(
      collectedBlunders.map((item) => [item.id, item]),
    );
    for (const item of e.blunders || []) collection.set(item.id, item);
    collectedBlunders = [...collection.values()];
    try {
      if (personalBest)
        localStorage.setItem(
          "workshop-personal-best",
          JSON.stringify(personalBest),
        );
      localStorage.setItem(
        "workshop-blunders",
        JSON.stringify(collectedBlunders),
      );
    } catch {}
    text("endPoints", Number.isFinite(e.points) ? `${e.points} points` : "");
    text(
      "endStars",
      e.stars !== undefined ? `${e.stars} / ${view.score.best} ★` : "",
    );
    text(
      "personalBest",
      hadPreviousGame && personalBest
        ? `${canCelebrate && newBest ? "New best score! " : ""}${canCelebrate && newStars ? "New best stars! " : ""}Best score: ${personalBest.points} · Best stars: ${personalBest.stars} ★`
        : "",
    );
    $("endRuns").replaceChildren();
    for (const run of e.runs || []) {
      const card = make("article", "run-report");
      card.append(
        make("b", "", `Sleigh ${run.run} · ${"★".repeat(run.stars)}`),
        make("span", "run-cargo", `${run.cargo.icon} ${run.cargo.name}`),
        make(
          "p",
          "",
          `${run.right}/${run.target} correct · ${run.wrong} wrong`,
        ),
        make(
          "small",
          "",
          run.missedBy || (run.bonus ? `+${run.bonus} clean-run bonus` : ""),
        ),
      );
      $("endRuns").append(card);
    }
    text(
      "collectionTitle",
      e.blunderTotal !== undefined
        ? `Christmas blunders · ${collectedBlunders.length}/${e.blunderTotal} found`
        : "Christmas blunders",
    );
    $("blunderCollection").replaceChildren(
      ...collectedBlunders.map((item) => revealedToy(item, "blunder")),
    );
    text("copyStatus", "");
    $("copyFallback").hidden = true;
    text(
      "resultTitle",
      e.rating === 3
        ? "Christmas, carefully delivered."
        : e.rating === 2
          ? "Christmas needs a little rework."
          : "Some wishes are still waiting.",
    );
    text(
      "resultSummary",
      `${e.right} correct gifts / ${view.target} · ${e.wrong} wrong gifts delivered · ${e.lost} letters lost`,
    );
    text("lessonTitle", e.lesson.title);
    text("lessonText", e.lesson.text);
    $("account").replaceChildren();
    for (const [label, key] of [
      ["People", "people"],
      ["AI", "ai"],
      ["Checking", "checking"],
      ["Fixing mistakes", "fixing"],
      ["Spent from budget", "spent"],
      ["Available budget", "budget"],
      ["Cost of wrong gifts delivered", "mistakes"],
      ["Estimated losses prevented", "prevented"],
    ]) {
      const dt = document.createElement("dt"),
        dd = document.createElement("dd");
      dt.textContent = label;
      dd.textContent = money(
        key === "spent"
          ? e.costs.people + e.costs.ai + e.costs.checking + e.costs.fixing
          : e.costs[key],
      );
      $("account").append(dt, dd);
    }
    $("report").showModal();
  }
  reset();
  requestAnimationFrame(frame);
})();
