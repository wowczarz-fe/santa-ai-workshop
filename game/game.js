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
  const names = ["Read letters", "Make toys", "Check & dispatch"];
  const caseStations = new Map();
  let resolvedCaseStation = 2;
  const params = new URLSearchParams(location.search);
  const rawSeed = params.get("seed");
  const seed =
    rawSeed !== null && Number.isFinite(Number(rawSeed))
      ? Number(rawSeed) >>> 0
      : 2026;
  const versions = ["piles", "cases", "calm"].map(
    (version) => new Workshop({ seed, version }).view().version,
  );
  let version = versions.some((v) => v.id === params.get("version"))
    ? params.get("version")
    : "cases";
  let game,
    view,
    started = false,
    manualPaused = false,
    hiddenPaused = document.hidden,
    restartOpen = false,
    selected = null,
    last = 0,
    accumulator = 0,
    paint = 0,
    seenNews = 0,
    momentId = null,
    caseId = null,
    reportShown = false,
    guidedRun = true,
    reworkSeen = false;
  const money = (n) => "£" + Math.round(n).toLocaleString("en-GB");
  const number = (n) =>
    Number(n).toLocaleString("en-GB", { maximumFractionDigits: 1 });
  const time = (n) =>
    `${Math.floor(Math.max(0, Math.ceil(n)) / 60)
      .toString()
      .padStart(
        2,
        "0",
      )}:${(Math.max(0, Math.ceil(n)) % 60).toString().padStart(2, "0")}`;
  function text(id, value) {
    const node = $(id);
    if (node.textContent !== String(value)) node.textContent = value;
  }
  function canRun() {
    return (
      started &&
      !manualPaused &&
      !hiddenPaused &&
      !restartOpen &&
      !view.moment &&
      !view.end
    );
  }
  function actionBlock(key, label) {
    return `<div id="control-${key}" class="action-block" data-control="${key}" hidden><button data-action="${key}">${label}</button><small id="cost-${key}"></small><small id="why-${key}" class="why"></small></div>`;
  }
  $("stations").innerHTML = names
    .map(
      (name, s) =>
        `<section id="station${s}" class="station ${s === 0 ? "expanded" : ""}"><div class="station-summary"><button class="station-heading" data-station="${s}" aria-expanded="${s === 0}"><span class="station-number">0${s + 1}</span><h2>${name}</h2><span class="expand-label">Controls ⌄</span></button><div class="machine" id="machine${s}"><svg viewBox="0 0 100 90" aria-hidden="true">${machineArt[s]}</svg><span class="machine-state" id="state${s}"></span><div class="belt" aria-hidden="true"></div></div><div id="queues${s}" class="queue-piles"></div><p class="staffing" id="staff${s}"></p><p class="pace" id="pace${s}" hidden></p><div id="elves${s}" class="elves"></div><button data-move="${s}" class="move" hidden>Move selected elf here</button><div class="case-anchor" id="caseAnchor${s}"></div><div id="feedback${s}"></div></div><div class="station-controls">${s < 2 ? `<div id="control-ai${s}" class="lever" data-control="ai${s}" hidden><h3>Who does the work?</h3><div role="group" aria-label="${name}: AI level">${[0, 1, 2].map((level) => `<button class="option" data-ai="${s},${level}" aria-pressed="false"><b id="ai${s}-${level}-name"></b><span id="ai${s}-${level}-who" class="option-who"></span><span id="ai${s}-${level}-effect"></span><small id="ai${s}-${level}-cost"></small><span id="ai${s}-${level}-risk" class="option-risk"></span></button>`).join("")}</div><small class="lever-note">Capacity at this staffing; full piles can stop the line.</small><small id="why-ai${s}" class="why"></small></div>` : `<div id="control-checking" class="lever" data-control="checking" hidden><h3>Send to the checking pile</h3><div role="group" aria-label="Checking policy">${[0, 1, 2].map((level) => `<button class="option" data-checking="${level}" aria-pressed="false"><b id="checking${level}-name"></b><span id="checking${level}-sends"></span><span id="checking${level}-effect"></span></button>`).join("")}</div><small id="cost-checking"></small><small id="why-checking" class="why"></small></div>${actionBlock("bypass", "Let waiting checks through")}<p id="bypassCount" class="muted" hidden></p><section id="vigilance" class="vigilance" hidden><h3>How the checkers are behaving</h3><p id="vigilanceState"></p><small id="vigilanceDetail"></small></section>${actionBlock("train", "Train the checkers")}`}${s === 0 ? `<div id="control-ask" class="action-block" data-control="ask" hidden><button id="ask" aria-pressed="false">Ask the child about unclear wishes</button><small id="cost-ask"></small><small id="why-ask" class="why"></small></div>` : ""}</div></section>`,
    )
    .join("");
  const incident = document.createElement("section");
  incident.id = "incidentActions";
  incident.className = "incident-actions";
  incident.setAttribute("aria-label", "Respond to the faulty update");
  incident.innerHTML =
    actionBlock("rollback", "Roll back the faulty AI") +
    actionBlock("quarantine", "Quarantine the suspect batch") +
    actionBlock("recall", "Recall wrong gifts from the sleigh");
  $("stations").after(incident);
  const tutorial = document.createElement("section");
  tutorial.id = "tutorial";
  tutorial.className = "tutorial";
  tutorial.hidden = true;
  tutorial.setAttribute("aria-label", "Workshop guidance");
  tutorial.innerHTML =
    '<span class="eyebrow">Clock paused · try this decision</span><h3 id="tutorialTitle"></h3><p id="tutorialText"></p><small id="tutorialPause"></small><button id="continue">Continue →</button>';
  document.querySelector(".workshop").append(tutorial);
  const casePanel = document.createElement("section");
  casePanel.id = "casePanel";
  casePanel.className = "case-panel";
  casePanel.hidden = true;
  casePanel.innerHTML =
    '<span class="eyebrow">Pinned on the line</span><h3 id="caseTitle"></h3><div id="caseEvidence"></div><p id="caseAffected"></p><div id="caseOptions" class="case-options"></div><div id="caseResolving" hidden><p id="caseProgressText"></p><progress id="caseProgress" max="1" value="0" aria-label="Case work progress"></progress></div><small id="caseWaiting"></small>';
  $("caseAnchor2").append(casePanel);
  const consequence = document.createElement("section");
  consequence.id = "consequence";
  consequence.className = "evidence";
  consequence.hidden = true;
  consequence.innerHTML =
    '<h3>What that decision did</h3><p id="consequenceText"></p><small id="consequenceFacts"></small>';
  $("feedback2").append(consequence);
  for (const v of versions) {
    const b = document.createElement("button");
    b.dataset.version = v.id;
    b.innerHTML = "<b></b><span></span>";
    b.querySelector("b").textContent = v.name;
    b.querySelector("span").textContent = v.text;
    $("versions").append(b);
  }
  function selectStation(s) {
    for (let i = 0; i < 3; i++) {
      $("station" + i).classList.toggle("expanded", i === s);
      document
        .querySelector(`[data-station="${i}"]`)
        .setAttribute("aria-expanded", i === s);
    }
  }
  function setupQueues() {
    for (let s = 0; s < 3; s++) {
      $("queues" + s).replaceChildren();
      for (const id of [
        ...view.stations[s].queues,
        ...(s === 2 ? ["dispatch"] : []),
      ]) {
        const q =
            id === "dispatch" ? { name: "Waiting parcels" } : view.queues[id],
          node = document.createElement("section");
        node.className = "queue-pile";
        node.id = "pile-" + id;
        node.innerHTML = `<div class="pile-heading"><h3></h3><b id="count-${id}"></b></div><div class="pile-parcels" id="parcels-${id}" aria-label="${q.name} waiting parcels"></div><div class="pile-detail"><span id="rate-${id}"></span><span id="more-${id}"></span></div><progress id="progress-${id}" max="1" value="0" aria-label="${q.name} next parcel progress"></progress><p id="blocked-${id}" class="pile-blocked" hidden></p>`;
        node.querySelector("h3").textContent = q.name;
        $("queues" + s).append(node);
      }
    }
  }
  function setupElves() {
    document.querySelectorAll(".elf").forEach((n) => n.remove());
    view.elves.forEach((e, i) => {
      const b = document.createElement("button");
      b.className = "elf";
      b.dataset.elf = i;
      b.innerHTML =
        elfSVG(i) +
        '<span class="elf-name"></span><span class="elf-doing"></span><span class="elf-state"></span><progress max="100" value="0"></progress>';
      b.querySelector(".elf-name").textContent = e.name;
      b.querySelector("progress").setAttribute(
        "aria-label",
        e.name + " tiredness",
      );
      $("elves" + e.station).append(b);
    });
  }
  function paintElves() {
    view.elves.forEach((e, i) => {
      const b = document.querySelector(`[data-elf="${i}"]`),
        parent = $("elves" + e.station);
      if (b.parentElement !== parent) parent.append(b);
      b.classList.toggle("selected", selected === i);
      b.classList.toggle("tired", e.tired >= 60);
      b.classList.toggle(
        "guided",
        started &&
          view.moment?.control === "cocoa" &&
          e.station < 3 &&
          e.tired >= 60,
      );
      b.setAttribute("aria-pressed", selected === i);
      b.disabled = !started || !!view.end || e.resting;
      b.querySelector("progress").value = e.tired;
      b.querySelector(".elf-doing").textContent = e.doing;
      const label = e.resting
        ? "Resting"
        : e.station === 3
          ? "Ready to return"
          : `${e.tired}% tired`;
      b.querySelector(".elf-state").textContent = label;
      b.setAttribute(
        "aria-label",
        `${e.name}, ${e.doing}, ${label}. Select to move.`,
      );
    });
    document.querySelectorAll("[data-move]").forEach((b) => {
      const e = selected === null ? null : view.elves[selected],
        s = Number(b.dataset.move);
      b.hidden = !e;
      b.disabled = !e || e.resting || e.station === s || !!view.end;
      b.textContent = e
        ? `Move ${e.name} ${s === 3 ? "for cocoa" : "here"} →`
        : "Move selected elf here";
    });
  }
  function paintQueues() {
    const dispatchParcels = ["check", "pass", "rework"].flatMap(
      (id) => view.queues[id].parcels,
    );
    const queues = {
      ...view.queues,
      dispatch: {
        parcels: dispatchParcels,
        limit: Infinity,
        rate: 0,
        progress: 0,
        blocked: view.stations[2].blocked,
      },
    };
    for (const [id, q] of Object.entries(queues)) {
      text(
        "count-" + id,
        id === "dispatch"
          ? `${q.parcels.length} waiting`
          : `${q.parcels.length} / ${q.limit}`,
      );
      text("rate-" + id, `${number(q.rate)} / min`);
      $("rate-" + id).hidden = !started || id === "dispatch";
      $("progress-" + id).hidden = id === "dispatch";
      text(
        "more-" + id,
        q.parcels.length > 8 ? `+ ${q.parcels.length - 8} more` : "",
      );
      $("progress-" + id).value = q.progress;
      text("blocked-" + id, q.blocked || "");
      $("blocked-" + id).hidden = !q.blocked;
      $("pile-" + id).classList.toggle("blocked", !!q.blocked);
      $("pile-" + id).classList.toggle("full", q.parcels.length >= q.limit);
      const holder = $("parcels-" + id),
        shown = q.parcels.slice(0, 8),
        ids = new Set(shown.map((p) => String(p.id)));
      for (const node of [...holder.children])
        if (!ids.has(node.dataset.parcel)) node.remove();
      for (const p of shown) {
        let node = holder.querySelector(`[data-parcel="${p.id}"]`);
        if (!node) {
          node = document.createElement("span");
          node.dataset.parcel = p.id;
          node.className = "pile-parcel";
          holder.append(node);
        }
        node.textContent =
          p.made?.icon || (id === "letters" || id === "clarify" ? "✉" : "🎁");
        node.classList.toggle("big", p.big);
        node.classList.toggle("suspect", !!p.suspect);
        node.classList.toggle("batch", p.suspect === "batch");
        node.dataset.mark =
          p.suspect === "batch" ? "!" : p.suspect ? "?" : p.big ? "★" : "";
        node.title = `#${p.id}: ${p.wish}${p.big ? " · Big gift" : ""}${p.suspect === "batch" ? " · Faulty update" : p.suspect ? " · Uncertain" : ""}`;
        node.setAttribute("role", "img");
        node.setAttribute("aria-label", node.title);
      }
      holder.classList.toggle("empty", shown.length === 0);
    }
    const showClarify = started && (!guidedRun || view.actions.ask.unlocked);
    const showChecks =
      started && (!guidedRun || view.actions.checking.unlocked);
    reworkSeen ||= view.queues.rework.parcels.length > 0;
    $("pile-clarify").hidden = !showClarify;
    $("pile-check").hidden = $("pile-pass").hidden = !showChecks;
    $("pile-rework").hidden = !showChecks || (guidedRun && !reworkSeen);
    $("pile-dispatch").hidden = showChecks;
    for (let s = 0; s < 3; s++)
      $("queues" + s).classList.toggle(
        "single-pile",
        [...$("queues" + s).children].filter((node) => !node.hidden).length ===
          1,
      );
    view.stations.forEach((st, s) => {
      text("staff" + s, `${st.working} working · ${st.idle} idle`);
      text(
        "state" + s,
        !started
          ? "Ready"
          : view.end
            ? "Shift finished"
            : !canRun()
              ? "Paused"
              : st.blocked || "Working",
      );
      const active =
        canRun() &&
        !st.blocked &&
        st.queues.some(
          (id) =>
            view.queues[id].parcels.length &&
            view.queues[id].rate > 0 &&
            !view.queues[id].blocked,
        );
      if (started && canRun() && !st.blocked)
        text(
          "state" + s,
          active || st.working ? "Working" : "Waiting for work",
        );
      $("machine" + s).classList.toggle("working", active);
      $("station" + s).classList.toggle("blocked", !!st.blocked);
      const behind =
        started && !view.end && view.pace.behind && view.pace.slowest === s;
      $("pace" + s).hidden = !behind;
      text(
        "pace" + s,
        `At this pace: about ${Math.round(view.pace.projected)} / ${view.target} gifts. This station is holding up the line.`,
      );
    });
  }
  function updateActions() {
    $("incidentActions").hidden =
      !started ||
      !["rollback", "quarantine", "recall"].some(
        (key) => view.actions[key].unlocked,
      );
    for (const [key, a] of Object.entries(view.actions)) {
      const container = $("control-" + key);
      container.hidden = !started || !a.unlocked;
      container.classList.toggle(
        "guided",
        started && view.moment?.control === key,
      );
      text("why-" + key, a.why || "");
      if ($("cost-" + key)) text("cost-" + key, a.cost || "");
      container.querySelectorAll("button").forEach((b) => {
        if (b.id !== "continue")
          b.disabled = !started || !a.available || !!view.end;
      });
    }
    for (const s of [0, 1])
      view.levers["ai" + s].forEach((o, i) => {
        text(`ai${s}-${i}-name`, o.name);
        text(`ai${s}-${i}-who`, o.who);
        text(`ai${s}-${i}-effect`, `${number(o.perMinute)} / min`);
        text(`ai${s}-${i}-cost`, `${money(o.costPerMinute)} / min`);
        text(`ai${s}-${i}-risk`, o.mistakesFrom);
        document
          .querySelector(`[data-ai="${s},${i}"]`)
          .setAttribute("aria-pressed", view.ai[s] === i);
      });
    view.levers.checking.forEach((o, i) => {
      text(`checking${i}-name`, o.name);
      text(`checking${i}-sends`, o.sends);
      text(
        `checking${i}-effect`,
        `${number(o.per100)} of every 100 parcels sent to check`,
      );
      document
        .querySelector(`[data-checking="${i}"]`)
        .setAttribute("aria-pressed", view.checking === i);
    });
    $("ask").setAttribute("aria-pressed", view.ask);
    text(
      "ask",
      `${view.ask ? "✓ Asking" : "Ask the child"} about unclear wishes`,
    );
    document.querySelector('[data-action="bypass"]').textContent =
      `Let ${view.queues.check.parcels.length} waiting parcels through unchecked`;
    text("bypassCount", `${view.bypassed} parcels let through by you`);
    $("bypassCount").hidden = !started || !view.actions.bypass.unlocked;
    $("vigilance").hidden = !started || !view.actions.checking.unlocked;
    text(
      "vigilanceState",
      `${view.vigilance.state} · ${number(view.vigilance.secondsPerCheck)} seconds per check`,
    );
    text(
      "vigilanceDetail",
      `${view.vigilance.cleanRun} clean AI parcels in a row · ${view.vigilance.skipped} checks skipped${view.vigilance.trained ? " · Trained" : ""}`,
    );
    document.querySelectorAll(".station-controls").forEach((node) => {
      node.hidden =
        !started || ![...node.children].some((child) => !child.hidden);
    });
    const remaining = view.incident?.rollingBack;
    document.querySelector('[data-action="rollback"]').textContent = remaining
      ? `Rolling back · ${Math.ceil(remaining)}s`
      : "Roll back the faulty AI";
  }
  function paintCase() {
    const c = view.case;
    casePanel.hidden = !started || !c;
    $("caseCue").hidden = !started || !c || !!view.end;
    if (c)
      text(
        "caseCue",
        c.resolving
          ? `Case in progress · ${Math.ceil(c.resolving.remaining)}s`
          : c.kind === "unclear"
            ? "Clarification needs a decision"
            : "Checker needs a decision",
      );
    if (!c) {
      caseId = null;
      return;
    }
    const station = c.kind === "unclear" ? 0 : 2;
    caseStations.set(c.id, station);
    const parent = $("caseAnchor" + station);
    if (casePanel.parentElement !== parent) parent.append(casePanel);
    text("caseTitle", c.text);
    text("caseAffected", `${c.affected.count} parcels affected`);
    text(
      "caseWaiting",
      view.casesWaiting ? `${view.casesWaiting} more case waiting` : "",
    );
    if (caseId !== c.id) {
      caseId = c.id;
      $("caseEvidence").replaceChildren();
      for (const e of c.evidence) {
        const row = document.createElement("article");
        row.className = "case-evidence";
        const wish = document.createElement("blockquote"),
          made = document.createElement("p");
        wish.textContent = `“${e.wish}”`;
        made.textContent = e.made
          ? `${e.made.icon} ${e.made.name}`
          : "No toy shown yet.";
        row.append(wish, made);
        $("caseEvidence").append(row);
      }
      $("caseOptions").replaceChildren();
      for (const o of c.options) {
        const b = document.createElement("button");
        b.dataset.option = o.id;
        b.innerHTML = "<b></b><span></span><small></small><em></em>";
        $("caseOptions").append(b);
      }
    }
    for (const o of c.options) {
      const b = $("caseOptions").querySelector(`[data-option="${o.id}"]`);
      b.querySelector("b").textContent = o.label;
      b.querySelector("span").textContent = o.scope;
      b.querySelector("small").textContent =
        `${number(o.seconds)} seconds · ${money(o.money)}`;
      b.querySelector("em").textContent = o.why || "";
      b.disabled = !o.available || !!c.resolving || !!view.end;
      b.classList.toggle("chosen", c.resolving?.optionId === o.id);
    }
    $("caseResolving").hidden = !c.resolving;
    if (c.resolving) {
      text(
        "caseProgressText",
        `An elf is working on this · ${Math.ceil(c.resolving.remaining)} seconds left`,
      );
      $("caseProgress").value = c.resolving.duration
        ? 1 - c.resolving.remaining / c.resolving.duration
        : 1;
    }
  }
  function controlStation(key) {
    return key === "ai0" || key === "ask"
      ? 0
      : key === "ai1" || key === "rollback"
        ? 1
        : 2;
  }
  function paintNews() {
    for (const n of view.news.filter((n) => n.id > seenNews).reverse()) {
      if (n.kind === "resolved")
        resolvedCaseStation = caseStations.get(n.caseId) ?? 2;
      if (n.kind === "consequence") {
        const s =
          n.about === "case" ? resolvedCaseStation : controlStation(n.about);
        $("feedback" + s).append(consequence);
        consequence.hidden = false;
        text("consequenceText", n.text);
        $("consequenceFacts").hidden = true;
      }
    }
    seenNews = view.news[0]?.id || seenNews;
    const e = selected === null ? null : view.elves[selected];
    text(
      "status",
      e
        ? `${e.name} selected. Choose a station or cocoa corner.`
        : view.moment && started
          ? `${manualPaused ? "Paused by you · guidance open" : "Workshop started · clock paused for guidance"}: ${view.moment.title}`
          : view.news[0]?.text ||
            "Move elves between piles to keep the presents flowing.",
    );
  }
  function paintMoment() {
    const m = started ? view.moment : null;
    tutorial.hidden = !m;
    $("guidanceContinue").hidden = !m;
    text(
      "guidanceContinue",
      manualPaused ? "Close guidance" : "Continue playing →",
    );
    text("continue", manualPaused ? "Close guidance" : "Continue playing →");
    document
      .querySelector(".cocoa")
      .classList.toggle("guided", m?.control === "cocoa");
    document
      .querySelector(".sleigh")
      .classList.toggle("guided", m?.control === "sleigh");
    if (!m) {
      momentId = null;
      return;
    }
    text("tutorialTitle", m.title);
    text("tutorialText", m.text);
    text(
      "tutorialPause",
      manualPaused
        ? "Your manual pause stays on when this guidance closes."
        : "Act on the guidance or continue to resume the clock.",
    );
    if (momentId !== m.id) {
      momentId = m.id;
      let anchor = $("control-" + m.control);
      if (m.control === "elves")
        anchor = $("station0").querySelector(".station-summary");
      if (m.control === "cocoa") anchor = document.querySelector(".cocoa");
      if (m.control === "sleigh") anchor = document.querySelector(".sleigh");
      if (m.control === "case") anchor = casePanel;
      anchor ??= $("station2").querySelector(".station-summary");
      if (anchor.closest("[hidden]"))
        anchor = $("station" + controlStation(m.control)).querySelector(
          ".station-summary",
        );
      anchor.prepend(tutorial);
      if (
        ["ai0", "ai1", "ask", "checking", "bypass", "train"].includes(m.control)
      )
        selectStation(controlStation(m.control));
      tutorial.scrollIntoView({ block: "nearest", behavior: "instant" });
    }
  }
  function paintSleigh() {
    const holder = $("aboard"),
      parcels = view.sleigh.parcels.slice(-3).reverse(),
      signature = parcels.map((p) => p.id + ":" + p.result).join();
    if (holder.dataset.signature !== signature) {
      holder.dataset.signature = signature;
      holder.replaceChildren();
      for (const p of parcels) {
        const item = document.createElement("span");
        item.className = "aboard-gift " + p.result;
        item.textContent = `${p.made?.icon || "🎁"} ${p.result === "wrong" ? "Wrong" : "Right"}`;
        item.title = `${p.wish} → ${p.made?.name || ""}`;
        holder.append(item);
      }
      if (!parcels.length) holder.textContent = "Ready for the first delivery.";
    }
    text("lost", `${view.lost} letters lost when the pile was full`);
  }
  function render() {
    view = game.view();
    document.body.classList.toggle("playing", started);
    document.body.classList.toggle("stopped", !canRun());
    text("right", `${view.sleigh.right} / ${view.target}`);
    text("wrong", view.sleigh.wrong);
    text("budget", money(view.budget.left));
    $("budget").classList.toggle("warning", view.budget.left < 0);
    text("clock", time(view.duration - view.t));
    $("goal").value = Math.min(1, view.sleigh.right / view.target);
    text("pause", manualPaused ? "Resume" : "Pause");
    $("pause").disabled = !started || !!view.end;
    text(
      "pauseState",
      !started
        ? ""
        : manualPaused
          ? "Paused by you"
          : hiddenPaused
            ? "Paused while away"
            : view.moment
              ? "Paused for guidance"
              : "",
    );
    paintElves();
    paintQueues();
    updateActions();
    paintCase();
    paintNews();
    paintMoment();
    paintSleigh();
    if (view.end && !reportShown) {
      reportShown = true;
      showReport();
    }
  }
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
  function reset(guided) {
    game = new Workshop({ seed, guided, version });
    view = game.view();
    guidedRun = guided;
    reworkSeen = false;
    started = false;
    manualPaused = false;
    hiddenPaused = document.hidden;
    restartOpen = false;
    selected = null;
    seenNews = 0;
    momentId = null;
    caseId = null;
    caseStations.clear();
    resolvedCaseStation = 2;
    reportShown = false;
    accumulator = 0;
    paint = 0;
    last = performance.now();
    $("welcome").hidden = false;
    $("report").close();
    $("restartDialog").close();
    consequence.hidden = true;
    tutorial.hidden = true;
    casePanel.hidden = true;
    $("aboard").dataset.signature = "reset";
    text(
      "mission",
      `Deliver ${view.target} correct presents before the sleigh leaves in ${number(view.duration / 60)} minutes.`,
    );
    text(
      "seedLabel",
      `${view.version.name} · Christmas seed ${seed} · Same seed on replay`,
    );
    document
      .querySelectorAll("[data-version]")
      .forEach((b) =>
        b.setAttribute("aria-pressed", b.dataset.version === version),
      );
    setupElves();
    setupQueues();
    selectStation(0);
    render();
  }
  function apply(name, args = []) {
    const ok = game[name](...args);
    render();
    return ok;
  }
  document.addEventListener("click", (event) => {
    const b = event.target.closest("button");
    if (!b || b.disabled) return;
    if (b.dataset.version) {
      const changed = version !== b.dataset.version;
      version = b.dataset.version;
      const url = new URL(location.href);
      url.searchParams.set("version", version);
      try {
        history.replaceState(null, "", url);
      } catch {}
      reset(changed ? true : guidedRun);
      return;
    }
    if (b.dataset.station !== undefined) {
      selectStation(Number(b.dataset.station));
      return;
    }
    if (b.dataset.elf !== undefined) {
      selected =
        selected === Number(b.dataset.elf) ? null : Number(b.dataset.elf);
      render();
      return;
    }
    if (b.dataset.move !== undefined && selected !== null) {
      if (apply("move", [selected, Number(b.dataset.move)])) selected = null;
      render();
      return;
    }
    if (b.dataset.ai) {
      apply("setAi", b.dataset.ai.split(",").map(Number));
      return;
    }
    if (b.dataset.checking !== undefined) {
      apply("setChecking", [Number(b.dataset.checking)]);
      return;
    }
    if (b.dataset.action) {
      apply(b.dataset.action);
      return;
    }
    if (b.dataset.option && view.case) {
      apply("resolve", [view.case.id, b.dataset.option]);
      return;
    }
  });
  $("start").onclick = () => {
    started = true;
    $("welcome").hidden = true;
    last = performance.now();
    render();
  };
  $("pause").onclick = () => {
    manualPaused = !manualPaused;
    accumulator = 0;
    render();
  };
  $("guidanceContinue").onclick = () => {
    if (view.moment) apply("acknowledge", [view.moment.id]);
  };
  $("continue").onclick = () => {
    if (view.moment) apply("acknowledge", [view.moment.id]);
  };
  $("ask").onclick = () => apply("setAsk", [!view.ask]);
  $("caseCue").onclick = () => {
    if (!view.case) return;
    selectStation(view.case.kind === "unclear" ? 0 : 2);
    casePanel.scrollIntoView({ block: "start", behavior: "instant" });
    $("caseTitle").tabIndex = -1;
    $("caseTitle").focus({ preventScroll: true });
  };
  $("motion").onclick = () => {
    const on = document.body.classList.toggle("reduced");
    $("motion").setAttribute("aria-pressed", on);
    text("motion", on ? "Motion reduced" : "Reduce motion");
  };
  $("replay").onclick = () => reset(false);
  $("closeReport").onclick = () => {
    $("report").close();
    render();
  };
  $("restart").onclick = () => {
    if (!started || view.end) {
      reset(false);
      return;
    }
    restartOpen = true;
    $("restartDialog").showModal();
    render();
  };
  $("confirmRestart").onclick = () => reset(false);
  function cancelRestart() {
    restartOpen = false;
    $("restartDialog").close();
    render();
  }
  $("cancelRestart").onclick = cancelRestart;
  $("restartDialog").addEventListener("cancel", (event) => {
    event.preventDefault();
    cancelRestart();
  });
  document.addEventListener("visibilitychange", () => {
    hiddenPaused = document.hidden;
    accumulator = 0;
    last = performance.now();
    render();
  });
  function frame(now) {
    const dt = last ? Math.min(0.1, (now - last) / 1000) : 0;
    last = now;
    if (canRun()) {
      accumulator += dt;
      while (accumulator >= 0.1 && canRun()) {
        game.step(0.1);
        accumulator -= 0.1;
        view = game.view();
      }
      paint += dt;
      if (paint >= 0.15 || view.moment || view.end) {
        paint = 0;
        render();
      }
    } else accumulator = 0;
    requestAnimationFrame(frame);
  }
  reset(true);
  requestAnimationFrame(frame);
})();
