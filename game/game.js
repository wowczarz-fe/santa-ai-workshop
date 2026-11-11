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

  const $ = (id) => document.getElementById(id),
    stationNames = ["Wish lists", "Toy workshop", "Check & dispatch"];
  let mobileTab = 0;
  let game = new Workshop(),
    running = false,
    started = false,
    selected = null,
    speed = 1,
    last = 0,
    acc = 0,
    paint = 0,
    history = [],
    lastSave = -1,
    shownEnd = false,
    toastTimer,
    returnFocus = null,
    modalKind = "",
    resumeAfter = false,
    parcelId = null;

  function icon(kind) {
    const body =
      kind === "letter"
        ? '<rect x="3" y="7" width="26" height="19" rx="2" fill="#fff" stroke="#286e73" stroke-width="2"/><path d="M4 8l12 10L28 8" stroke="#286e73" stroke-width="2" fill="none"/>'
        : kind === "train"
          ? '<path d="M5 12h13v12H5zM17 6h10v18H17z" fill="#e83f35"/><path d="M20 8h5v6h-5zM8 7h4v6H8z" fill="#286e73"/><circle cx="9" cy="25" r="4" fill="#2d2926"/><circle cx="23" cy="25" r="4" fill="#2d2926"/>'
          : kind === "unknown"
            ? '<rect x="5" y="6" width="23" height="22" rx="2" fill="#efc784"/><text x="16" y="23" text-anchor="middle" font-size="21" font-family="Arial" font-weight="bold" fill="#2d2926">?</text>'
            : '<rect x="4" y="10" width="24" height="19" rx="2" fill="#8ed0d2"/><path d="M16 10v19M4 15h24" stroke="#fff" stroke-width="3"/><path d="M16 10C1 10 7-2 16 10C31-2 31 10 16 10" stroke="#e83f35" stroke-width="2" fill="none"/>';
    return '<svg viewBox="0 0 32 32" aria-hidden="true">' + body + "</svg>";
  }
  $("stations").innerHTML = stationNames
    .map(
      (name, i) =>
        `<section class="station" id="station${i}"><div class="station-head"><span class="number">0${i + 1}</span><h2>${name}</h2></div><div class="station-state" id="state${i}">Ready</div><div class="machine"><span class="statuslamp" id="lamp${i}">READY</span><svg viewBox="0 0 100 90" aria-hidden="true">${machineArt[i]}</svg><div class="belt"><span class="parcel">${icon(i === 0 ? "letter" : "gift")}</span><span class="parcel">${icon(i === 0 ? "letter" : "gift")}</span><span class="parcel">${icon(i === 0 ? "letter" : "gift")}</span></div></div><div class="queue"><span>Queue capacity</span><b id="queue${i}"></b></div><div class="track queue-track"><span id="qbar${i}"></span></div><div class="elves" id="elves${i}"></div><button class="move" data-move="${i}">Move selected elf here</button>${i < 2 ? `<label class="control">AI freedom</label><div class="seg" aria-label="${name} AI freedom" role="group">${["Off", "Assist", "Automate"].map((t, m) => `<button data-mode="${i},${m}">${t}</button>`).join("")}</div>${i === 0 ? '<label class="control" for="escalate">Ambiguous wishes</label><select id="escalate"><option value="review">Ask an elf · slower, safer</option><option value="trust">Trust the AI · faster, riskier</option></select><button id="intake" class="intervene" data-action="intake">Throttle incoming letters</button>' : '<button class="intervene danger" data-action="stop" id="stop">Emergency stop</button><button class="intervene" data-action="patch" id="patch">Roll back faulty AI · £65 / 8s</button>'}<p class="effect" id="effect${i}"></p>` : `<label class="control">Inspection policy</label><div class="seg" role="group" aria-label="Inspection policy">${["Spot", "Targeted", "Every gift"].map((t, i) => `<button data-policy="${i}">${t}</button>`).join("")}</div><button class="intervene" data-action="hold" id="hold">Hold dispatch</button><button class="intervene" data-action="training" id="training">Train reviewers · £70</button><div class="parcel-tray" id="parcelTray" aria-label="Parcels available for inspection"></div><div class="muted">Tap a parcel to inspect, isolate or release it.</div>`}</section>`,
    )
    .join("");
  function toast(text) {
    $("toast").textContent = text;
    $("toast").hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => ($("toast").hidden = true), 3000);
  }
  function seconds(n) {
    return (
      String(Math.floor(n / 60)).padStart(2, "0") +
      ":" +
      String(Math.ceil(n % 60)).padStart(2, "0")
    );
  }
  let elfSignature = "",
    feedSignature = "",
    traySignature = "";
  function renderElves() {
    const sig =
      game.elves.map((e) => e.s + e.reason + e.ready).join("|") +
      selected +
      !!game.end;
    if (sig !== elfSignature) {
      elfSignature = sig;
      for (let s = 0; s < 4; s++)
        $("elves" + s).innerHTML = game.elves
          .map((e, i) =>
            e.s === s
              ? `<button class="elf ${i === selected ? "selected" : ""}" data-elf="${i}" draggable="true" aria-pressed="${i === selected}" ${game.end ? "disabled" : ""}>${elfSVG(i)}<span>${e.name}</span><small class="elf-status"></small><span class="fatigue"><i></i></span></button>`
              : "",
          )
          .join("");
    }
    document.querySelectorAll("[data-elf]").forEach((b) => {
      const e = game.elves[+b.dataset.elf],
        status =
          e.s === 3
            ? e.reason === "burnout" && !e.ready
              ? "Recovering"
              : e.rest > 0
                ? "On break"
                : "Ready"
            : e.f > 70
              ? "Exhausted"
              : e.f > 45
                ? "Tiring"
                : "Working";
      b.querySelector("i").style.width = e.f + "%";
      b.querySelector(".elf-status").textContent = status;
      b.setAttribute(
        "aria-label",
        `${e.name}, ${status}, ${Math.round(e.f)}% fatigue. Select to move.`,
      );
      b.title = `${e.name} · ${Math.round(e.f)}% fatigue${e.s === 3 ? " · " + Math.ceil(e.rest) + "s minimum break" : ""}`;
    });
    $("selection").textContent =
      selected === null
        ? "Select an elf, then move them to a station or cocoa corner."
        : `${game.elves[selected].name} selected. Choose where they work.`;
    document
      .querySelectorAll("[data-move]")
      .forEach((b) => (b.disabled = selected === null || !!game.end));
  }
  function warnings() {
    const a = [];
    if (game.strike)
      a.push({
        title: `STRIKE · ${Math.ceil(game.strike)}s to settle`,
        text: "All production has stopped. Agree paid cocoa before Christmas is cancelled.",
      });
    else if (game.morale < 35)
      a.push({
        title: `STRIKE NOTICE · ${Math.ceil(12 - game.notice)}s`,
        text: "Morale is below 35. Agree a deal or restore morale before the elves walk out.",
      });
    else if (game.morale < 45)
      a.push({
        title: "WORK TO RULE",
        text: "Elves are working at 65% capacity. Rest them or agree paid cocoa.",
      });
    for (let s = 0; s < 3; s++) {
      if (game.overflow[s] > 0)
        a.push({
          title: `${stationNames[s]} · collapse in ${Math.max(0, Math.ceil(16 - game.overflow[s]))}s`,
          text: `Drain below ${Math.ceil(game.limits[s] * 0.8) - 1} items or buy extra storage. ${game.jam[s] > 0 ? "The jam clears in " + Math.ceil(game.jam[s]) + "s." : ""}`,
        });
      else if (game.q[s].length >= game.limits[s] * 0.7)
        a.push({
          title: `${stationNames[s]} filling up`,
          text: "Move elves to the bottleneck or slow the flow upstream.",
        });
    }
    if (game.batchClock > 0)
      a.push({
        title: `SLEIGH OVERLOAD · ${Math.ceil(18 - game.batchClock)}s`,
        text: "Recall the suspect batch. Rolling back the AI only protects future production.",
      });
    if (game.fault)
      a.push({
        title: game.patch ? "AI ROLLBACK IN PROGRESS" : "FAULTY AI UPDATE",
        text: game.patch
          ? `${Math.ceil(game.patch)}s until production restarts. Contain existing batches.`
          : "Automated toy lines can produce full-sized trains. Stop, roll back and quarantine.",
      });
    if (game.timmy && !game.timmy.done)
      a.push({
        title: `TIMMY NEEDS HELP · ${Math.ceil(game.timmy.until - game.t)}s`,
        text: "Open his urgent letter and clarify what he means by “a little train”.",
      });
    return a;
  }
  function render() {
    const g = game;
    document.body.classList.toggle("playing", started);
    document.body.classList.toggle("stopped", !running);
    document.body.classList.toggle("mobile-cocoa", mobileTab === 3);
    document.querySelectorAll("[data-tab]").forEach((b) => {
      const i = +b.dataset.tab;
      b.classList.toggle("active", mobileTab === i);
      b.setAttribute("aria-pressed", mobileTab === i);
      b.textContent =
        ["Letters", "Toys", "Dispatch", "Cocoa"][i] +
        " " +
        (i === 3 ? g.staff(3).length : g.q[i].length);
    });
    for (let i = 0; i < 3; i++)
      $("station" + i).classList.toggle("mobile-active", i === mobileTab);
    $("mobilePause").disabled = !started || !!g.end;
    $("mobilePause").textContent = running ? "Pause" : "Resume";
    $("mobileBrief").textContent =
      seconds(Math.max(0, 240 - Math.ceil(g.t))) +
      " · " +
      (warnings()[0]?.title || "Workshop stable");
    document.body.classList.toggle("finished", !!g.end);
    $("clock").textContent = seconds(Math.max(0, 240 - Math.ceil(g.t)));
    $("date").textContent =
      `${Math.min(24, 1 + Math.floor(g.t / 10))} December · ${g.practice ? "Practice run" : g.t < 104 ? "The Christmas shift" : g.t < 144 ? "Last-minute rush" : "The final push"}`;
    $("loaded").textContent = g.loaded.length;
    $("loadbar").style.width =
      Math.min(100, (g.loaded.length / 155) * 100) + "%";
    $("verified").textContent =
      `${g.caught} mistakes caught · ${g.checked} checks`;
    $("budget").textContent =
      "£" + Math.round(g.budget).toLocaleString("en-GB");
    $("budget").classList.toggle("warning", g.budget < 100);
    $("strain").textContent = Math.round(g.fatigue()) + "%";
    $("strainbar").style.width = g.fatigue() + "%";
    $("straintext").textContent =
      `${g.staff(3).length} on cocoa · ${g.burnouts} burnouts`;
    $("morale").textContent = Math.round(g.morale) + "%";
    $("moralebar").style.width = g.morale + "%";
    $("moralebar").style.background = g.morale < 45 ? "#e83f35" : "#286e73";
    $("moraleNote").textContent = g.strike
      ? "On strike"
      : g.morale < 35
        ? "Strike notice"
        : g.morale < 45
          ? "Work to rule"
          : "Keeping Christmas civil";
    $("pause").disabled = !started || !!g.end;
    $("pause").textContent = running ? "Pause" : "Resume";
    $("speed").disabled = !started || !!g.end;
    $("speed").textContent = `Speed ${speed}×`;
    $("welcome").hidden = started;
    $("report").hidden = !g.end;
    for (let s = 0; s < 3; s++) {
      const count = g.q[s].length,
        limit = g.limits[s];
      $("queue" + s).textContent = `${count} / ${limit}`;
      $("qbar" + s).style.width = Math.min(100, (count / limit) * 100) + "%";
      $("qbar" + s).style.background =
        count >= limit * 0.7 ? "#e83f35" : "#286e73";
      const state = !running
        ? "PAUSED"
        : g.strike
          ? "ON STRIKE"
          : g.deal
            ? "PAID COCOA"
            : g.jam[s] > 0
              ? `JAM ${Math.ceil(g.jam[s])}s`
              : s === 1 && g.patch
                ? `ROLLBACK ${Math.ceil(g.patch)}s`
                : s === 1 && g.stop
                  ? "LINE STOPPED"
                  : s === 2 && g.hold
                    ? "DISPATCH HELD"
                    : s === 2 && g.rework.length
                      ? `REWORKING ${g.rework.length}`
                      : g.cap(s) === 0
                        ? "NEEDS ELVES"
                        : count
                          ? "WORKING"
                          : "IDLE";
      $("lamp" + s).textContent = state;
      $("state" + s).textContent =
        g.overflow[s] > 0
          ? `Collapse in ${Math.ceil(16 - g.overflow[s])}s · clear the backlog`
          : s === 2
            ? `${g.suspect()} suspect gifts aboard · ${g.rework.length} in rework`
            : `${g.cap(s).toFixed(1)} jobs/sec before checks and pauses`;
      $("station" + s).classList.toggle("critical", g.overflow[s] > 0);
      $("station" + s)
        .querySelector(".machine")
        .classList.toggle(
          "idle",
          count === 0 ||
            g.cap(s) === 0 ||
            g.jam[s] > 0 ||
            (s === 1 && (g.stop || g.patch)),
        );
      if (s < 2)
        $("effect" + s).textContent = [
          "Elf-led production. Low error risk, limited capacity.",
          "AI assists elves. Supervision and targeted checks still matter.",
          "Fast autonomous production. Mistakes scale up too.",
        ][g.mode[s]];
    }
    renderElves();
    document.querySelectorAll("[data-mode]").forEach((b) => {
      const [s, m] = b.dataset.mode.split(",").map(Number);
      b.classList.toggle("active", g.mode[s] === m);
      b.setAttribute("aria-pressed", g.mode[s] === m);
      b.disabled = !!g.end;
    });
    document.querySelectorAll("[data-policy]").forEach((b) => {
      b.classList.toggle("active", g.policy === +b.dataset.policy);
      b.setAttribute("aria-pressed", g.policy === +b.dataset.policy);
      b.disabled = !!g.end;
    });
    $("escalate").value = g.ask ? "review" : "trust";
    $("escalate").disabled = !!g.end;
    const buttons = {
      patch: !g.fault || g.patch > 0 || g.budget < 65,
      training: g.trained || g.budget < 70,
      quarantine: !g.q[2].some((x) => x.batch && !x.clean) || g.budget < 15,
      recall: g.suspect() === 0 || g.budget < 40,
      deal: g.dealCooldown > 0 || g.budget < 90,
      storage: g.budget < 85,
    };
    document
      .querySelectorAll("[data-action]")
      .forEach((b) => (b.disabled = !!g.end || !!buttons[b.dataset.action]));
    $("stop").textContent = g.stop ? "Restart toy line" : "Emergency stop";
    $("hold").textContent = g.hold ? "Release dispatch" : "Hold dispatch";
    $("intake").textContent = g.metered
      ? "Restore full letter intake"
      : "Throttle incoming letters";
    $("patch").textContent = g.patch
      ? `Rolling back · ${Math.ceil(g.patch)}s`
      : "Roll back faulty AI · £65 / 8s";
    $("training").textContent = g.trained
      ? "Reviewers trained ✓"
      : "Train reviewers · £70";
    $("deal").textContent =
      g.dealCooldown > 0
        ? `Cocoa agreement · ready in ${Math.ceil(g.dealCooldown)}s`
        : "Agree paid cocoa · £90 / 7s stop";
    $("quarantine").textContent = `Quarantine suspect queue · £15`;
    $("recall").textContent = `Recall ${g.suspect()} suspect gifts · £40`;
    const warn = warnings();
    $("alerts").classList.toggle("quiet", !warn.length);
    $("alerts").innerHTML = warn.length
      ? warn
          .slice(0, 3)
          .map((w) => `<div><b>${w.title}</b><span>${w.text}</span></div>`)
          .join("")
      : "<div><b>WORKSHOP STABLE</b><span>Watch the queues, give elves breaks and contain suspicious batches.</span></div>";
    $("timmyButton").hidden = !g.timmy || g.timmy.done || !!g.end;
    $("timmyButton").textContent = g.timmy
      ? `Read Timmy’s letter · ${Math.max(0, Math.ceil(g.timmy.until - g.t))}s`
      : "Read Timmy’s letter";
    const fs = JSON.stringify(g.log);
    if (fs !== feedSignature) {
      feedSignature = fs;
      $("feed").innerHTML = g.log
        .slice(0, 4)
        .map(
          (x) =>
            `<li><time>${seconds(Math.floor(x.t))}</time><span>${x.text}</span></li>`,
        )
        .join("");
      $("headline").textContent = g.log[0]?.text || "";
    }
    const xs = g.q[2].slice(0, 5),
      ts =
        xs.map((x) => x.id + ":" + x.batch + ":" + x.clue).join(",") + !!g.end;
    if (ts !== traySignature) {
      traySignature = ts;
      $("parcelTray").innerHTML = xs.length
        ? xs
            .map(
              (x) =>
                `<button data-parcel="${x.id}" class="parcel-button ${x.batch || x.clue ? "suspect" : ""}" aria-label="Inspect parcel ${x.id}${x.batch ? ", suspect batch" : x.clue ? ", unusual shape" : ""}" ${g.end ? "disabled" : ""}><span>${icon(x.batch ? "train" : x.clue ? "unknown" : "gift")}</span><small>#${x.id}</small></button>`,
            )
            .join("")
        : '<span class="muted">Parcels will appear here.</span>';
    }
    $("reworkCount").textContent =
      `${g.rework.length} quarantined · ${g.activeJob ? "Inspection in progress" : "Checker available"}`;
    if (g.end && !shownEnd) {
      shownEnd = true;
      running = false;
      showResults();
    }
  }
  function openModal(kind, html) {
    resumeAfter = running;
    running = false;
    modalKind = kind;
    returnFocus = document.activeElement;
    $("sheet").innerHTML = html;
    $("modal").hidden = false;
    $("gameRoot").inert = true;
    $("sheet").querySelector("button,a")?.focus();
  }
  function closeModal() {
    const resume = resumeAfter;
    modalKind = "";
    $("modal").hidden = true;
    $("gameRoot").inert = false;
    running = resume && !game.end;
    returnFocus?.focus();
    render();
  }
  function showParcel(id) {
    const x = game.q[2].find((x) => x.id === id);
    if (!x) return;
    parcelId = id;
    openModal(
      "parcel",
      `<div class="eyebrow">Parcel #${id}</div><h2 id="modalTitle">${x.batch ? "That is a suspiciously large train…" : x.clue ? "Something looks odd." : "A parcel on the conveyor"}</h2><p>${x.batch ? "This gift came from the faulty AI batch. An ordinary wrapper is concealing an extraordinary amount of locomotive." : x.clue ? "The shape is unusual. It might be a mistake, or just an unusual wish." : "There is no obvious warning sign. That does not guarantee the present is correct."}</p><p>Inspection costs £8 and occupies one checker for three seconds. Quarantine sends it to the rework bench. Releasing it skips further checks.</p><div class="endbuttons"><button data-inspect="inspect" ${game.budget < 8 || !game.staff(2).length || game.activeJob ? "disabled" : ""}>Assign checker · £8</button><button data-inspect="quarantine">Quarantine</button><button data-inspect="release">Release unchecked</button><button data-close>Back</button></div>`,
    );
  }
  function showTimmy() {
    if (!game.timmy || game.timmy.done) return;
    openModal(
      "timmy",
      `<div class="eyebrow">An urgent letter from Timmy</div><h2 id="modalTitle">“A little train, please.”</h2><p>“I want to put it on the carpet next to my teddy. Mum says it must fit in the toy box.”</p><div class="letter-art">${icon("letter")}${icon("train")}${icon("gift")}</div><p>The AI has shortlisted two options. Your attention can prevent a mistake before it reaches the production line.</p><div class="endbuttons"><button class="primary" data-timmy="little">A model train for his toy box</button><button data-timmy="large">A full-sized locomotive</button><button data-close>Leave it to the workshop</button></div>`,
    );
  }
  function showResults() {
    const g = game,
      correct = g.loaded.filter((x) => !x.wrong).length,
      wrong = g.loaded.length - correct,
      left = g.id - g.loaded.length,
      avg = g.avgFatigue / Math.max(0.1, g.t),
      success =
        g.end.kind === "complete" &&
        correct >= 155 &&
        wrong / Math.max(1, g.loaded.length) < 0.1 &&
        g.morale >= 45 &&
        g.budget >= 0;
    const title =
      g.end.kind !== "complete"
        ? g.end.title
        : success
          ? "Christmas, expertly calibrated"
          : correct < 155
            ? "Christmas needs a little rework"
            : "A very mixed Christmas";
    const t = g.loaded.find((x) => x.timmy);
    const story = !t
      ? "Timmy’s present is still at the workshop."
      : t.wrong
        ? "Timmy gets a locomotive. His parents get a structural survey."
        : "Timmy gets his little train. It fits in the toy box.";
    openModal(
      "result",
      `<div class="eyebrow">${g.end.kind === "complete" ? "Christmas morning" : "Workshop closed early"} · ${g.practice ? "Practice run" : "Your report"}</div><h2 id="modalTitle">${title}</h2><p>${g.end.why || "Santa’s sleigh has left. Here is what your decisions delivered."}</p><div class="results"><div><strong>${correct}</strong><small>correct gifts / 155</small></div><div><strong>${wrong}</strong><small>wrong gifts aboard</small></div><div><strong>${left}</strong><small>left at the workshop</small></div></div><p>Budget £${Math.round(g.budget)} · Morale ${Math.round(g.morale)}% · ${g.burnouts} burnouts</p><div class="timmy"><b>And little Timmy?</b><p>${story}</p></div><div class="insight"><b>Your AI assurance lesson</b><p>${g.end.tip || (wrong > 15 ? "Errors travelled as fast as production. Targeted checks, rollback and batch containment protect the value of automation." : left > 35 ? "Capacity is a system-wide constraint. More production does not help when inspection and dispatch cannot keep up." : "Good controls preserved the benefits of automation. Human oversight still needed capacity, recovery time and clear decisions.")}</p><p>${g.caught} mistakes repaired across ${g.checked} checks. Average fatigue ${Math.round(avg)}%. All figures are illustrative.</p></div><div class="endbuttons"><button class="primary" data-new>Start a new Christmas</button><button data-rewind ${history.some((h) => h.t <= g.t - 20) ? "" : "disabled"}>Rewind 20s · practice</button><button data-close>View workshop</button></div><a class="assurance" href="https://www.frontier-economics.com/uk/en/expertise/data-science-ai/" target="_blank" rel="noopener noreferrer">Explore Data Science &amp; AI at Frontier →</a>`,
    );
    resumeAfter = false;
  }
  function reset() {
    game = new Workshop();
    running = false;
    started = false;
    selected = null;
    mobileTab = 0;
    shownEnd = false;
    speed = 1;
    history = [];
    lastSave = -1;
    acc = 0;
    elfSignature = feedSignature = traySignature = "";
    $("modal").hidden = true;
    $("gameRoot").inert = false;
    modalKind = "";
    $("toast").hidden = true;
    render();
  }
  function rewind() {
    const h = [...history].reverse().find((h) => h.t <= game.t - 20);
    if (!h) return;
    game = Workshop.restore(h.state);
    game.end = null;
    game.practice = true;
    shownEnd = false;
    history = history.filter((x) => x.t <= h.t);
    lastSave = h.t;
    acc = 0;
    selected = null;
    elfSignature = feedSignature = traySignature = "";
    $("modal").hidden = true;
    $("gameRoot").inert = false;
    modalKind = "";
    running = false;
    started = true;
    game.emit(
      "Rewound 20 seconds. Practice is paused: change your decisions, then resume.",
    );
    render();
  }
  function advance(dt) {
    if (game.end) return;
    if (Math.floor(game.t) > lastSave) {
      history.push({ t: game.t, state: game.snapshot() });
      history = history.filter((x) => x.t > game.t - 35);
      lastSave = Math.floor(game.t);
    }
    game.step(dt);
  }
  function dispatchAction(name) {
    const ok = game.action(name);
    if (!ok)
      toast(
        "That action is not available right now. Check the budget and station status.",
      );
    render();
    return ok;
  }
  document.addEventListener("click", (ev) => {
    const b = ev.target.closest("button");
    if (!b || b.disabled) return;
    if (b.hasAttribute("data-new")) {
      reset();
      $("start").focus();
      return;
    }
    if (b.hasAttribute("data-rewind")) {
      rewind();
      return;
    }
    if (b.hasAttribute("data-close")) {
      closeModal();
      return;
    }
    if (b.dataset.timmy) {
      game.resolveTimmy(b.dataset.timmy);
      closeModal();
      return;
    }
    if (b.dataset.inspect) {
      const ok = game.inspect(parcelId, b.dataset.inspect);
      if (ok) closeModal();
      else toast("A checker, budget or inspection slot is unavailable.");
      return;
    }
    if (b.dataset.tab !== undefined) {
      mobileTab = +b.dataset.tab;
      render();
      return;
    }
    if (game.end) return;
    if (b.dataset.elf !== undefined) {
      selected = selected === +b.dataset.elf ? null : +b.dataset.elf;
      elfSignature = "";
      renderElves();
      $("elves" + game.elves[+b.dataset.elf].s)
        .querySelector(`[data-elf="${b.dataset.elf}"]`)
        ?.focus();
    }
    if (b.dataset.move !== undefined && selected !== null) {
      const n = game.elves[selected].name;
      if (game.move(selected, +b.dataset.move)) {
        selected = null;
        toast(`${n} reassigned.`);
      } else toast("This elf needs to recover before returning.");
      render();
    }
    if (b.dataset.mode) {
      const [s, m] = b.dataset.mode.split(",").map(Number);
      game.mode[s] = m;
      render();
    }
    if (b.dataset.policy !== undefined) {
      game.policy = +b.dataset.policy;
      game.q[2].forEach((x) => {
        if (!x.done) delete x.review;
      });
      render();
    }
    if (b.dataset.action) dispatchAction(b.dataset.action);
    if (b.dataset.parcel) showParcel(+b.dataset.parcel);
  });
  $("mobilePause").onclick = () => {
    running = !running;
    render();
  };
  $("start").onclick = () => {
    started = true;
    running = true;
    game.emit(
      "Workshop open. Keep the queues below capacity and remember the cocoa.",
    );
    render();
    $("pause").focus();
  };
  $("pause").onclick = () => {
    running = !running;
    render();
  };
  $("speed").onclick = () => {
    speed = speed === 1 ? 2 : 1;
    render();
  };
  $("motion").onclick = () => {
    const v = document.body.classList.toggle("reduced");
    $("motion").setAttribute("aria-pressed", v);
    $("motion").textContent = v ? "Motion reduced" : "Reduce motion";
  };
  $("escalate").onchange = (e) => (game.ask = e.target.value === "review");
  $("timmyButton").onclick = showTimmy;
  $("report").onclick = showResults;
  $("restart").onclick = () => {
    if (!started || game.end) {
      reset();
      return;
    }
    openModal(
      "restart",
      '<h2 id="modalTitle">Restart Christmas?</h2><p>Your current run will be reset.</p><div class="endbuttons"><button class="primary" data-new>Restart</button><button data-close>Keep playing</button></div>',
    );
  };
  document.addEventListener("dragstart", (e) => {
    const b = e.target.closest("[data-elf]");
    if (!b || game.end) return;
    selected = +b.dataset.elf;
    e.dataTransfer.setData("text/plain", String(selected));
  });
  for (let s = 0; s < 4; s++) {
    const zone = s === 3 ? $("lounge") : $("station" + s);
    zone.addEventListener("dragover", (e) => {
      e.preventDefault();
      zone.classList.add("drop");
    });
    zone.addEventListener("dragleave", () => zone.classList.remove("drop"));
    zone.addEventListener("drop", (e) => {
      e.preventDefault();
      zone.classList.remove("drop");
      if (selected !== null) {
        if (game.move(selected, s)) selected = null;
        else toast("This elf needs to finish recovering.");
        render();
      }
    });
  }
  $("modal").addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      closeModal();
      return;
    }
    if (e.key === "Tab") {
      const controls = [
          ...$("sheet").querySelectorAll("button:not(:disabled),a[href]"),
        ],
        a = controls[0],
        z = controls.at(-1);
      if (e.shiftKey && document.activeElement === a) {
        e.preventDefault();
        z.focus();
      } else if (!e.shiftKey && document.activeElement === z) {
        e.preventDefault();
        a.focus();
      }
    }
  });
  document.addEventListener("visibilitychange", () => {
    if (document.hidden && running) {
      running = false;
      render();
      toast("Workshop paused while you were away.");
    }
  });
  function frame(now) {
    const dt = last ? Math.min(0.1, (now - last) / 1000) : 0;
    last = now;
    if (running && !game.end) {
      acc += dt * speed;
      while (acc >= 0.1 && !game.end) {
        advance(0.1);
        acc -= 0.1;
      }
      paint += dt;
      if (paint > 0.2 || game.end) {
        render();
        paint = 0;
      }
    }
    requestAnimationFrame(frame);
  }
  reset();
  requestAnimationFrame(frame);
})();
