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
  const rawSeed = new URLSearchParams(location.search).get("seed");
  const seed =
    rawSeed !== null && Number.isFinite(Number(rawSeed))
      ? Number(rawSeed) >>> 0
      : 2026;
  let game,
    view,
    running = false,
    started = false,
    selected = null,
    activeStation = 0,
    last = 0,
    accumulator = 0,
    paint = 0,
    seenNews = 0,
    lastHint = null,
    reportShown = false,
    resumeRestart = false,
    toast = "",
    toastUntil = 0;
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
  function actionBlock(key, label) {
    return `<div id="control-${key}" class="action-block" data-control="${key}" hidden><button data-action="${key}">${label}</button><small id="cost-${key}"></small><small id="why-${key}" class="why"></small></div>`;
  }
  $("stations").innerHTML = names
    .map(
      (name, s) =>
        `<section id="station${s}" class="station ${s === 0 ? "expanded" : ""}"><button class="station-heading" data-station="${s}" aria-expanded="${s === 0}"><span class="station-number">0${s + 1}</span><h2>${name}</h2><span class="expand-label">Controls ⌄</span></button><div class="machine" id="machine${s}"><svg viewBox="0 0 100 90" aria-hidden="true">${machineArt[s]}</svg><span class="machine-state" id="state${s}"></span><div class="belt" aria-hidden="true"><span>✉</span><span>🎁</span><span>🎁</span></div></div><div class="queue-label"><span id="queue${s}"></span><span id="rate${s}"></span></div><progress id="queuebar${s}" max="1" value="0" aria-label="${name} queue fullness"></progress><div class="job"><span>Next parcel</span><progress id="progress${s}" max="1" value="0" aria-label="${name} job progress"></progress></div><p class="pace" id="pace${s}" hidden></p><div id="elves${s}" class="elves"></div><button data-move="${s}" class="move" hidden>Move selected elf here</button><div class="station-controls">${s < 2 ? `<div id="control-ai${s}" class="lever" data-control="ai${s}" hidden><h3>How much should AI do?</h3><div role="group" aria-label="${name}: AI level">${[0, 1, 2].map((level) => `<button class="option" data-ai="${s},${level}" aria-pressed="false"><b id="ai${s}-${level}-name"></b><span id="ai${s}-${level}-effect"></span><small id="ai${s}-${level}-cost"></small></button>`).join("")}</div><small class="lever-note">Estimates at this staffing; queues and checks can slow the line.</small><small id="why-ai${s}" class="why"></small></div>` : `<div id="control-checking" class="lever" data-control="checking" hidden><h3>How much should elves check?</h3><div role="group" aria-label="Checking policy">${[0, 1, 2].map((level) => `<button class="option" data-checking="${level}" aria-pressed="false"><b id="checking${level}-name"></b><span id="checking${level}-effect"></span></button>`).join("")}</div><small id="cost-checking"></small><small id="why-checking" class="why"></small></div>`}${s === 0 ? `<div id="control-ask" class="action-block" data-control="ask" hidden><button id="ask" aria-pressed="false">Ask the child about unclear wishes</button><small id="cost-ask"></small><small id="why-ask" class="why"></small></div>` : s === 1 ? actionBlock("rollback", "Roll back the faulty AI") : `<div id="control-inspect" data-control="inspect" class="inspection-area" hidden><h3>Open a parcel yourself</h3><small id="cost-inspect"></small><small id="why-inspect" class="why"></small><div id="parcels" class="parcels"></div><p class="legend">★ Big gift: a mistake costs more. ? means uncertain; ! means from the faulty update.</p></div><section id="inspection" class="inspection" hidden><h3 id="inspectionTitle"></h3><blockquote id="inspectionWish"></blockquote><div class="inspection-toy"><span id="inspectionIcon"></span><b id="inspectionMade"></b></div><p id="inspectionStatus"></p><progress id="inspectionProgress" max="1" value="0" aria-label="Inspection progress"></progress><div class="inspection-decisions"><button id="ship">Ship this gift</button><button id="remake">Send back to remake</button></div></section><section id="evidence" class="evidence" hidden><h3 id="evidenceTitle"></h3><p id="evidenceWish"></p><p id="evidenceMade"></p><p id="evidenceResult"></p></section>${actionBlock("quarantine", "Quarantine the suspect queue")}${actionBlock("recall", "Recall wrong gifts from the sleigh")}${actionBlock("train", "Train the checkers")}<p id="rework" class="rework" hidden></p>`}</div></section>`,
    )
    .join("");
  for (let s = 0; s < 3; s++) {
    const station = $("station" + s);
    const summary = document.createElement("div");
    summary.className = "station-summary";
    for (const node of [...station.children])
      if (!node.classList.contains("station-controls")) summary.append(node);
    station.prepend(summary);
  }
  const bench = document.createElement("section");
  bench.className = "parcel-bench";
  bench.id = "parcelBench";
  bench.setAttribute("aria-label", "Dispatch inspection bench");
  const opening = document.createElement("div");
  opening.append($("control-inspect"), $("inspection"));
  bench.append(opening, $("evidence"));
  $("stations").after(bench);
  const incidentActions = document.createElement("section");
  incidentActions.id = "incidentActions";
  incidentActions.className = "incident-actions";
  incidentActions.setAttribute("aria-label", "Respond to the faulty update");
  for (const [key, label] of [
    ["rollback", "1 · Protect new toys"],
    ["quarantine", "2 · Fix the waiting batch"],
    ["recall", "3 · Bring wrong gifts back"],
  ]) {
    const control = $("control-" + key);
    const heading = document.createElement("h3");
    heading.textContent = label;
    control.prepend(heading);
    incidentActions.append(control);
  }
  bench.after(incidentActions);
  function selectStation(s) {
    activeStation = s;
    for (let i = 0; i < 3; i++) {
      $("station" + i).classList.toggle("expanded", i === s);
      document
        .querySelector(`[data-station="${i}"]`)
        .setAttribute("aria-expanded", i === s);
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
        '<span class="elf-name"></span><span class="elf-state"></span><progress max="100" value="0"></progress>';
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
      b.setAttribute("aria-pressed", selected === i);
      b.disabled = !started || !!view.end || e.resting;
      b.querySelector("progress").value = e.tired;
      const label = e.resting
        ? "Resting"
        : e.station === 3
          ? "Ready to return"
          : `${e.tired}% tired`;
      b.querySelector(".elf-state").textContent = label;
      b.setAttribute("aria-label", `${e.name}, ${label}. Select to move.`);
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
  function updateActions() {
    $("parcelBench").hidden = !started || !view.actions.inspect.unlocked;
    $("incidentActions").hidden =
      !started ||
      !["rollback", "quarantine", "recall"].some(
        (key) => view.actions[key].unlocked,
      );
    for (const [key, a] of Object.entries(view.actions)) {
      const container = $("control-" + key);
      if (!container) continue;
      container.hidden = !started || !a.unlocked;
      container.classList.toggle("guided", view.hint?.control === key);
      const why = $("why-" + key);
      if (why) why.textContent = a.why || "";
      const cost = $("cost-" + key);
      if (cost) cost.textContent = a.cost || "";
      container
        .querySelectorAll("button")
        .forEach((b) => (b.disabled = !started || !a.available || !!view.end));
    }
    for (const s of [0, 1])
      view.levers["ai" + s].forEach((o, i) => {
        text(`ai${s}-${i}-name`, o.name);
        text(
          `ai${s}-${i}-effect`,
          `${number(o.perMinute)} / min · ${number(o.wrongPer100)} mistakes / 100`,
        );
        text(`ai${s}-${i}-cost`, `${money(o.costPerMinute)} / min`);
        document
          .querySelector(`[data-ai="${s},${i}"]`)
          .setAttribute("aria-pressed", view.ai[s] === i);
      });
    view.levers.checking.forEach((o, i) => {
      text(`checking${i}-name`, o.name);
      text(
        `checking${i}-effect`,
        `${number(o.checkedPer100)} checked / 100 · ${number(o.perMinute)} dispatched / min`,
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
    text(
      "rework",
      `${view.rework} parcels being remade${view.dispatchHeld ? " · Dispatch waits for this batch" : ""}`,
    );
    $("rework").hidden = !view.rework;
    const inc = view.incident;
    if (inc?.rollingBack)
      document.querySelector('[data-action="rollback"]').textContent =
        `Rolling back · ${Math.ceil(inc.rollingBack)}s`;
    else
      document.querySelector('[data-action="rollback"]').textContent =
        "Roll back the faulty AI";
  }
  function paintParcels() {
    const box = $("parcels");
    const parcels = view.stations[2].waiting.slice(0, 6);
    const ids = new Set(parcels.map((p) => String(p.id)));
    for (const node of [...box.children])
      if (!ids.has(node.dataset.parcel)) node.remove();
    for (const p of parcels) {
      let b = box.querySelector(`[data-parcel="${p.id}"]`);
      if (!b) {
        b = document.createElement("button");
        b.dataset.parcel = p.id;
        b.className = "parcel";
        b.innerHTML =
          '<span class="parcel-icon"></span><span class="parcel-id"></span><span class="parcel-mark"></span>';
        box.append(b);
      }
      b.classList.toggle("big", p.big);
      b.classList.toggle("suspect", !!p.suspect);
      b.classList.toggle("batch", p.suspect === "batch");
      b.querySelector(".parcel-icon").textContent = p.made?.icon || "🎁";
      b.querySelector(".parcel-id").textContent = "#" + p.id;
      b.querySelector(".parcel-mark").textContent =
        (p.big ? "★ " : "") +
        (p.suspect === "batch" ? "!" : p.suspect ? "?" : "");
      b.setAttribute(
        "aria-label",
        `Open parcel ${p.id}${p.big ? ", big gift" : ""}${p.suspect === "batch" ? ", from faulty update" : p.suspect ? ", uncertain" : ""}. ${p.wish}`,
      );
      b.disabled = !started || !view.actions.inspect.available || !!view.end;
    }
    const ins = view.inspection;
    $("inspection").hidden = !ins;
    if (ins) {
      text(
        "inspectionTitle",
        `Parcel #${ins.parcel.id}${ins.parcel.big ? " · Big gift" : ""}`,
      );
      text("inspectionWish", `“${ins.parcel.wish}”`);
      text("inspectionIcon", ins.parcel.made?.icon || "🎁");
      text("inspectionMade", ins.parcel.made?.name || "Opening the wrapping…");
      text(
        "inspectionStatus",
        ins.ready
          ? "Does this toy meet the wish? You decide."
          : `One checker is busy for ${Math.ceil(ins.remaining)} more seconds.`,
      );
      $("inspectionProgress").value = 1 - ins.remaining / ins.duration;
      $("ship").disabled = $("remake").disabled = !ins.ready || !!view.end;
    }
  }
  function paintNews() {
    const fresh = view.news.filter((n) => n.id > seenNews).reverse();
    for (const n of fresh) {
      if (n.check) {
        $("evidence").hidden = false;
        text(
          "evidenceTitle",
          n.kind === "loaded" ? "Latest delivery reveal" : "Latest check",
        );
        text("evidenceWish", `Wish: “${n.check.wish}”`);
        text("evidenceMade", `Made: ${n.check.made.icon} ${n.check.made.name}`);
        text("evidenceResult", n.text);
      }
    }
    seenNews = view.news[0]?.id || seenNews;
    const hint = view.hint;
    if (hint && hint.control !== lastHint) {
      const s =
        hint.control === "ai0" || hint.control === "ask"
          ? 0
          : hint.control === "ai1" || hint.control === "rollback"
            ? 1
            : hint.control === "elves"
              ? 0
              : 2;
      if (!view.inspection) selectStation(s);
      lastHint = hint.control;
    } else if (!hint) lastHint = null;
    const e = selected === null ? null : view.elves[selected];
    text(
      "status",
      toast && performance.now() < toastUntil
        ? toast
        : e
          ? `${e.name} selected. Choose a station or cocoa corner.`
          : hint?.text ||
            view.news[0]?.text ||
            "Move elves between stations to keep the presents flowing.",
    );
    const cocoaHint =
      hint?.control === "elves" &&
      view.elves.some((e) => e.station < 3 && e.tired >= 60);
    document.querySelector(".cocoa").classList.toggle("guided", cocoaHint);
    document
      .querySelectorAll(".elves")
      .forEach((node) =>
        node.classList.toggle(
          "guided",
          hint?.control === "elves" && !cocoaHint && node.children.length > 0,
        ),
      );
    view.elves.forEach((e, i) =>
      document
        .querySelector(`[data-elf="${i}"]`)
        .classList.toggle(
          "guided",
          cocoaHint && e.station < 3 && e.tired >= 60,
        ),
    );
  }
  function paintSleigh() {
    const holder = $("aboard");
    const parcels = view.sleigh.parcels.slice(-3).reverse();
    const signature = parcels.map((p) => p.id + ":" + p.result).join();
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
    document.body.classList.toggle("stopped", !running);
    document.body.classList.toggle("playing", started);
    text("right", `${view.sleigh.right} / ${view.target}`);
    text("wrong", view.sleigh.wrong);
    text("budget", money(view.budget.left));
    $("budget").classList.toggle("warning", view.budget.left < 0);
    text("clock", time(view.duration - view.t));
    $("goal").value = Math.min(1, view.sleigh.right / view.target);
    text("pause", running ? "Pause" : "Resume");
    $("pause").disabled = !started || !!view.end;
    view.stations.forEach((st, s) => {
      const rollback = s === 1 && view.incident?.rollingBack;
      const held = s === 2 && view.dispatchHeld;
      const moving =
        started &&
        running &&
        !view.end &&
        !st.blocked &&
        !rollback &&
        !!st.rate &&
        (!!st.waiting.length || (s === 2 && view.rework > 0));
      $("machine" + s).classList.toggle("working", moving);
      $("machine" + s)
        .querySelectorAll(".belt span")
        .forEach((node, i) => {
          const parcel = st.waiting[i];
          node.hidden = !parcel;
          node.textContent = parcel
            ? s === 0
              ? "✉"
              : parcel.made?.icon || "🎁"
            : "";
          node.classList.toggle("big", !!parcel?.big);
        });
      $("machine" + s).style.setProperty(
        "--belt-time",
        `${Math.max(0.4, 3 / Math.max(0.1, st.rate))}s`,
      );
      text(
        "state" + s,
        !started
          ? "Ready"
          : view.end
            ? "Shift finished"
            : !running
              ? "Paused"
              : rollback
                ? `Rollback · ${Math.ceil(rollback)}s`
                : held
                  ? "Remaking held batch"
                  : st.blocked
                    ? "Next station is full"
                    : !st.staff
                      ? "Needs an elf"
                      : st.waiting.length
                        ? "Working"
                        : "Waiting for work",
      );
      text("queue" + s, `${st.waiting.length} / ${st.limit} waiting`);
      text("rate" + s, `${number(st.rate * 60)} / min`);
      $("rate" + s).hidden =
        s === 2 && (!started || !view.actions.checking.unlocked);
      $("queuebar" + s).value = st.waiting.length / st.limit;
      $("progress" + s).value = st.progress;
      $("station" + s).classList.toggle("blocked", st.blocked);
      const behind =
        started && !view.end && view.pace.behind && view.pace.slowest === s;
      $("pace" + s).hidden = !behind;
      text(
        "pace" + s,
        `At this pace: about ${Math.round(view.pace.projected)} / ${view.target} gifts. This station is holding up the line.`,
      );
    });
    paintElves();
    updateActions();
    paintParcels();
    paintNews();
    paintSleigh();
    if (view.end && !reportShown) {
      running = false;
      document.body.classList.add("stopped");
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
    game = new Workshop({ seed, guided });
    view = game.view();
    running = false;
    started = false;
    selected = null;
    seenNews = 0;
    lastHint = null;
    reportShown = false;
    accumulator = 0;
    paint = 0;
    toast = "";
    $("welcome").hidden = false;
    $("report").close();
    $("restartDialog").close();
    $("evidence").hidden = true;
    $("aboard").dataset.signature = "reset";
    $("parcels").replaceChildren();
    text(
      "mission",
      `Deliver ${view.target} correct presents before the sleigh leaves in ${number(view.duration / 60)} minutes.`,
    );
    text("seedLabel", `Christmas seed ${seed} · Same seed on replay`);
    setupElves();
    selectStation(0);
    render();
  }
  function apply(name, args = []) {
    const ok = game[name](...args);
    if (!ok) {
      const key =
        name === "setAi"
          ? "ai" + args[0]
          : name === "setChecking"
            ? "checking"
            : name === "setAsk"
              ? "ask"
              : name;
      toast =
        game.view().actions[key]?.why ||
        "That action is not available right now.";
      toastUntil = performance.now() + 3000;
    }
    render();
    return ok;
  }
  document.addEventListener("click", (event) => {
    const b = event.target.closest("button");
    if (!b || b.disabled) return;
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
    if (b.dataset.parcel) {
      if (apply("inspect", [Number(b.dataset.parcel)])) selectStation(2);
      return;
    }
  });
  $("start").onclick = () => {
    started = true;
    running = true;
    $("welcome").hidden = true;
    last = performance.now();
    render();
  };
  $("pause").onclick = () => {
    running = !running;
    render();
  };
  $("ask").onclick = () => apply("setAsk", [!view.ask]);
  for (const choice of ["ship", "remake"])
    $(choice).onclick = () => {
      if (view.inspection) apply("decide", [view.inspection.parcel.id, choice]);
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
    resumeRestart = running;
    running = false;
    $("restartDialog").showModal();
    render();
  };
  $("confirmRestart").onclick = () => reset(false);
  function cancelRestart() {
    $("restartDialog").close();
    running = resumeRestart;
    render();
  }
  $("cancelRestart").onclick = cancelRestart;
  $("restartDialog").addEventListener("cancel", (event) => {
    event.preventDefault();
    cancelRestart();
  });
  document.addEventListener("visibilitychange", () => {
    if (document.hidden && running) {
      running = false;
      render();
    }
  });
  function frame(now) {
    const dt = last ? Math.min(0.1, (now - last) / 1000) : 0;
    last = now;
    if (running && !view.end) {
      accumulator += dt;
      while (accumulator >= 0.1 && !game.view().end) {
        game.step(0.1);
        accumulator -= 0.1;
      }
      paint += dt;
      if (paint >= 0.15) {
        paint = 0;
        render();
      }
    }
    requestAnimationFrame(frame);
  }
  reset(true);
  requestAnimationFrame(frame);
})();
