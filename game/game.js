(() => {
  "use strict";
  const machineArt = [
    `<rect x="17" y="19" width="63" height="48" rx="7" fill="#2d2926"/><rect x="24" y="25" width="49" height="30" rx="3" fill="#dff0ef"/><path d="M32 34h30M32 41h21M32 48h26" stroke="#7ca18e" stroke-width="3"/><rect x="34" y="8" width="32" height="17" rx="2" fill="#fff"/><path d="M39 12l11 8 11-8" fill="none" stroke="#b6accd" stroke-width="2"/><circle cx="72" cy="61" r="2" fill="#e83f35"/>`,
    `<path d="M20 66V23h15v43M65 66V23h15v43M20 23h60" stroke="#2d2926" stroke-width="8" fill="none"/><path d="M50 25v13l-8 8m8-8 8 8" stroke="#286e73" stroke-width="6" fill="none"/><rect x="35" y="51" width="30" height="23" rx="3" fill="#e83f35"/><path d="M50 51v23m-15-12h30" stroke="#f9c6ae" stroke-width="4"/>`,
    `<rect x="20" y="38" width="43" height="32" rx="4" fill="#8ed0d2"/><path d="M41 38v32m-21-17h43" stroke="#fff" stroke-width="4"/><circle cx="66" cy="31" r="17" fill="#dff0ef" stroke="#2d2926" stroke-width="5"/><path d="M78 44l12 15" stroke="#2d2926" stroke-width="7" stroke-linecap="round"/><path d="M58 31l6 6 10-12" stroke="#6e9b84" stroke-width="3" fill="none"/>`,
  ];
  function elfSVG(i) {
    const colour = ["#799c8a", "#65a9ac", "#d7896e"][i % 3];
    return `<svg viewBox="0 0 42 48" aria-hidden="true"><path d="M8 47q0-19 13-19t13 19" fill="${colour}"/><path d="M14 32l7 9 7-9" fill="#eee9de"/><path d="M10 18l-7-3 6 10m23-7 7-3-6 10" fill="#e9ba91"/><circle cx="21" cy="21" r="12" fill="#efc9a4"/><path d="M8 16L21 1l12 15" fill="${colour}"/><rect x="7" y="14" width="28" height="5" rx="2" fill="#f4f0e7"/><circle cx="17" cy="23" r="1.4" fill="#2d2926"/><circle cx="25" cy="23" r="1.4" fill="#2d2926"/><path d="M18 28q3 3 6 0" fill="none" stroke="#a46651" stroke-width="1.5"/></svg>`;
  }

  const $ = (id) => document.getElementById(id);
  const text = (id, value) => {
    $(id).textContent = value;
  };
  const money = (n) => `£${Math.round(n).toLocaleString()}`;
  const params = new URLSearchParams(location.search);
  const requestedSeed = params.get("seed");
  const seed =
    requestedSeed !== null && Number.isFinite(Number(requestedSeed))
      ? Number(requestedSeed)
      : 2026;
  let version = ["piles", "cases", "calm"].includes(params.get("version"))
    ? params.get("version")
    : "cases";
  const versionNames = {
    piles: "A · Workshop decisions",
    cases: "B · Extra checker questions",
    calm: "C · Slower with questions",
  };
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
    rateChanges = new Map();
  let infoAnchor = null,
    infoKey = null,
    infoPinned = false,
    drag = null,
    suppressClick = 0;
  const make = (tag, cls, content) => {
    const node = document.createElement(tag);
    if (cls) node.className = cls;
    if (content !== undefined) node.textContent = content;
    return node;
  };
  const infoButton = (key, label = "More information") => {
    const b = make("button", "info-button", "i");
    b.dataset.help = key;
    b.setAttribute("aria-label", label);
    return b;
  };
  const actionGroups = new Map();
  for (let s = 0; s < 3; s++) {
    const station = make("section", "station");
    station.id = `station${s}`;
    station.dataset.destination = s;
    station.innerHTML = `<div class="column-heading"><span class="station-number">0${s + 1}</span><h2>${stationNames[s]}</h2></div><div class="machine" aria-hidden="true"><svg viewBox="0 0 100 80">${machineArt[s]}</svg></div><div class="queue-piles" id="piles${s}"></div><div class="crew-heading"><span>Elves</span><span id="staff${s}" data-info="staff:${s}" tabindex="0"></span></div><div class="crew" id="elves${s}"></div><button class="move-target" data-move="${s}" hidden>Move here</button><div class="controls" id="controls${s}"></div><div class="feedback-slot" id="feedback${s}"></div>`;
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
        '<span class="queue-name"></span><strong class="queue-count"></strong><span class="queue-picture"><span class="stack"></span></span><span class="queue-rate"></span><progress max="1" value="0"></progress>';
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
        b.innerHTML = `<span class="switch-art" aria-hidden="true">${[elfSVG(s), `${elfSVG(s)}<span>🤖</span>`, "🤖"][level]}</span><span class="switch-label">${["By hand", "Assist", "Automate"][level]}</span>`;
        position.append(
          b,
          infoButton(
            `ai:${s}:${level}`,
            `Explain ${["by hand", "assist", "automate"][level]}`,
          ),
        );
        sw.append(position);
      }
      addGroup(`ai${s}`, sw);
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
        b.innerHTML = `<span class="switch-art" aria-hidden="true">${["🔎 ·", "🔎 ◆", "🔎 ▦"][level]}</span><span class="switch-label">${["A few", "Risky", "All"][level]}</span>`;
        position.append(b, infoButton(`checking:${level}`));
        sw.append(position);
      }
      addGroup("checking", sw);
      for (const [key, label] of [
        ["bypass", "↗ Let through"],
        ["train", "🎓 Train checkers"],
      ]) {
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
  for (const [id, label] of Object.entries(versionNames)) {
    const b = make("button", "version-option", label);
    b.dataset.version = id;
    $("versions").append(b);
  }
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
      b.innerHTML = `${elfSVG(i)}<span class="elf-name"></span><progress class="fatigue" max="100" value="0"></progress><span class="elf-doing" aria-hidden="true"></span>`;
      const more = infoButton(`elf:${i}`, `About ${elf.name}`);
      more.classList.add("elf-info");
      wrap.append(b, more);
      elfNodes.push(wrap);
    });
  }
  function reset(showIntro = true) {
    game = new Workshop({ seed, version, guided });
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
    closeInfo();
    buildElves();
    $("walkthrough").checked = guided;
    $("report").close();
    $("restartDialog").close();
    const url = new URL(location.href);
    url.searchParams.set("seed", seed);
    url.searchParams.set("version", version);
    history.replaceState(null, "", url);
    paint();
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
    text("right", `${view.sleigh.right} / ${view.target}`);
    $("goal").max = view.target;
    $("goal").value = view.sleigh.right;
    text("wrong", view.sleigh.wrong);
    text("budget", money(view.budget.left));
    const left = Math.ceil(view.duration - view.t);
    text(
      "clock",
      `${Math.floor(left / 60)}:${String(left % 60).padStart(2, "0")}`,
    );
    text(
      "mission",
      `Deliver ${view.target} correct gifts in ${Math.round(view.duration / 60)} minutes.`,
    );
    text("versionLabel", versionNames[version]);
    for (const b of $("versions").children)
      b.setAttribute("aria-pressed", String(b.dataset.version === version));
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
            : view.moment
              ? "Paused for guidance"
              : document.hidden
                ? "Paused while away"
                : "",
    );
    for (let s = 0; s < 3; s++) {
      const station = view.stations[s];
      text(`staff${s}`, `${station.working} working · ${station.idle} idle`);
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
        node.querySelector(".queue-count").textContent =
          `${q.parcels.length}/${q.limit}`;
        node.classList.toggle("blocked", !!q.blocked);
        node.classList.toggle("full", q.parcels.length >= q.limit);
        node.querySelector("progress").value = q.progress;
        const change = rateChanges.get(id);
        node.querySelector(".queue-rate").textContent =
          change && change.until > performance.now()
            ? `${Math.round(change.after - change.before) > 0 ? "+" : ""}${Math.round(change.after - change.before)}/min${Math.round(change.after - change.before) === 0 ? " unchanged" : ""}`
            : `${Math.round(q.rate)}/min`;
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
      b.querySelector(".elf-doing").textContent =
        elf.station === 3 ? "☕" : elf.doing === "nothing to do" ? "◌" : "⚙";
    });
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
    text("sleighRight", view.sleigh.right);
    const arrivals = view.sleigh.parcels;
    const newest = arrivals.at(-1);
    if (newest && newest.id !== lastArrival) {
      lastArrival = newest.id;
      text("arrivalIcon", newest.made?.icon || "🎁");
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
  function positionPanel(panel, anchor) {
    const anchorBounds = anchor.getBoundingClientRect();
    if (panel === $("infoPopover")) {
      const roomBeside = Math.max(
        anchorBounds.left - 24,
        innerWidth - anchorBounds.right - 24,
      );
      panel.style.maxHeight = `${roomBeside >= panel.offsetWidth ? innerHeight - 24 : Math.max(80, anchorBounds.top - 24, innerHeight - anchorBounds.bottom - 24)}px`;
    }
    const r = anchorBounds,
      p = panel.getBoundingClientRect(),
      gap = 12,
      w = innerWidth,
      h = innerHeight;
    const horizontal = Math.max(12, Math.min(r.left, w - p.width - 12));
    const vertical = Math.max(12, Math.min(r.top, h - p.height - 12));
    const places = [
      { x: r.right + gap, y: vertical },
      { x: r.left - p.width - gap, y: vertical },
      { x: horizontal, y: r.bottom + gap },
      { x: horizontal, y: r.top - p.height - gap },
    ];
    const fit = places.find(
      (a) =>
        a.x >= 12 &&
        a.y >= 12 &&
        a.x + p.width <= w - 12 &&
        a.y + p.height <= h - 12,
    ) || {
      x: w - p.width - 12,
      y: Math.max(12, Math.min(r.bottom + gap, h - p.height - 12)),
    };
    panel.style.left = `${Math.max(12, Math.min(fit.x, w - p.width - 12))}px`;
    panel.style.top = `${Math.max(12, Math.min(fit.y, h - p.height - 12))}px`;
  }
  function paintGuidance() {
    const moment = started && !view.end ? view.moment : null;
    $("guidanceContinue").hidden = !moment;
    $("tutorial").hidden = !moment || moment.control === "case";
    $("caseGuidance").hidden = !moment || moment.control !== "case";
    if (!moment) {
      lastMoment = null;
      return;
    }
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
      caseOpen = true;
      paintCase();
    } else {
      const anchor =
        actionGroups.get(moment.control) ||
        $(
          moment.control === "cocoa"
            ? "cocoa"
            : moment.control === "sleigh"
              ? "sleigh"
              : "elves0",
        );
      positionPanel($("tutorial"), anchor);
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
    if ($("casePanel").hidden) return;
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
    const preferred =
      c.kind === "update"
        ? c.step === "tested"
          ? ["Promises", "Test", "After the test"]
          : ["Promises", "Updates like this go wrong", "A test now"]
        : null;
    const shown = preferred
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
        if (e.made)
          row.append(
            make("p", "toy-evidence", `${e.made.icon} ${e.made.name}`),
          );
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
    const station =
      c.kind === "unclear"
        ? 0
        : c.kind === "update" || c.step === "source"
          ? 1
          : c.step === "aboard"
            ? 3
            : 2;
    positionPanel(
      $("casePanel"),
      $(station === 3 ? "sleigh" : `station${station}`),
    );
  }
  function getInfo(key) {
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
          `${Math.round(l.perMinute)} parcels/min · ${money(l.costPerMinute)}/min`,
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
          `${Math.round(q.rate)} parcels a minute with the current staffing and AI setting.`,
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
          v.blocked ||
            "Move elves here to change the available human capacity.",
          view.pace.behind && view.pace.slowest === s
            ? "This station is holding up the target pace."
            : "",
          s === 2
            ? "The checkers are people. AI does not check its own work."
            : "AI settings change who does the work.",
        ],
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
          `Deliver ${view.target} correct gifts before departure. Wrong gifts do not count.`,
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
  function renderInfo() {
    const [title, lines] = getInfo(infoKey);
    text("infoTitle", title);
    $("infoContent").replaceChildren(
      ...lines.filter(Boolean).map((line) => make("p", "", line)),
    );
    positionPanel($("infoPopover"), infoAnchor);
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
  }
  let pointerFocus = false,
    recentTouchUntil = 0;
  document.addEventListener(
    "pointerdown",
    (e) => {
      pointerFocus = true;
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
      e.pointerType !== "touch" &&
      performance.now() > recentTouchUntil &&
      !infoPinned &&
      !drag
    )
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
    selected = null;
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
      perform(() => game.setAi(s, l));
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
    if (target.dataset.resolve) {
      perform(() => game.resolve(view.case.id, target.dataset.resolve));
      return;
    }
    if (target.dataset.version) {
      guided = $("walkthrough").checked;
      version = target.dataset.version;
      reset();
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
      moveElf(Number(node.dataset.destination));
    });
  });
  document.addEventListener("dragstart", (e) => {
    const elf = e.target.closest("[data-elf]");
    if (!elf) return;
    closeInfo();
    selected = Number(elf.dataset.elf);
    e.dataTransfer.setData("text/plain", String(selected));
    e.dataTransfer.effectAllowed = "move";
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
  $("start").onclick = () => {
    if (guided !== $("walkthrough").checked) {
      guided = $("walkthrough").checked;
      reset(false);
    }
    if (!guided) game.skipGuidance();
    started = true;
    $("intro").close();
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
    reset();
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
  window.addEventListener("resize", () => {
    paintGuidance();
    paintCase();
    if (infoAnchor) renderInfo();
  });
  function showReport() {
    const e = view.end;
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
      `${e.right} correct gifts / ${view.target} · ${e.wrong} wrong gifts aboard · ${e.lost} letters lost`,
    );
    text("lessonTitle", e.lesson.title);
    text("lessonText", e.lesson.text);
    $("account").replaceChildren();
    for (const [label, key] of [
      ["People", "people"],
      ["AI", "ai"],
      ["Checking", "checking"],
      ["Fixing mistakes", "fixing"],
      ["Delivered mistakes", "mistakes"],
      ["Total cost", "total"],
      ["Available budget", "budget"],
    ]) {
      const dt = document.createElement("dt"),
        dd = document.createElement("dd");
      dt.textContent = label;
      dd.textContent = money(e.costs[key]);
      $("account").append(dt, dd);
    }
    text(
      "prevented",
      `${money(e.costs.prevented)} in estimated losses prevented by catching mistakes.`,
    );
    $("report").showModal();
  }
  reset();
  requestAnimationFrame(frame);
})();
