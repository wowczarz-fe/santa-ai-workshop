// The copy review page: lists every text from data.js, shows what the editor changed, records the
// reviewer's decision on each text in this browser, and exports those decisions as one file.
(() => {
  "use strict";
  const DATA = window.COPY_REVIEW;
  const $ = (id) => document.getElementById(id);
  const make = (tag, cls, text) => {
    const node = document.createElement(tag);
    if (cls) node.className = cls;
    if (text !== undefined) node.textContent = text;
    return node;
  };
  if (!DATA || !Array.isArray(DATA.entries)) {
    $("progress").textContent =
      "The texts could not be loaded. The file data.js is missing.";
    return;
  }

  // ---- What the reviewer has decided, kept in this browser ----
  const STORE = `copy-review:${DATA.build}`;
  let storageWorks = true;
  const state = { reviewer: "", decisions: {} };
  try {
    const saved = JSON.parse(localStorage.getItem(STORE));
    if (saved && typeof saved === "object") {
      if (typeof saved.reviewer === "string") state.reviewer = saved.reviewer;
      if (saved.decisions && typeof saved.decisions === "object")
        state.decisions = saved.decisions;
    }
    localStorage.setItem(`${STORE}:check`, "1");
    localStorage.removeItem(`${STORE}:check`);
  } catch {
    storageWorks = false;
  }
  let saveTimer = 0;
  const saveNow = () => {
    clearTimeout(saveTimer);
    saveTimer = 0;
    if (!storageWorks) return;
    try {
      localStorage.setItem(STORE, JSON.stringify(state));
    } catch {
      storageWorks = false;
      showStorageNote();
    }
  };
  const save = () => {
    if (!saveTimer) saveTimer = setTimeout(saveNow, 250);
  };
  function showStorageNote() {
    const note = $("savedNote");
    note.classList.toggle("warn", !storageWorks);
    if (!storageWorks)
      note.textContent =
        "This browser is not saving your work. Please export your review before you close this page.";
  }
  addEventListener("pagehide", saveNow);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") saveNow();
  });

  const stateOf = (d) =>
    d && d.decision
      ? d.decision
      : d && d.comment && d.comment.trim()
        ? "comment"
        : "none";
  const reviewed = (d) => stateOf(d) !== "none";
  const BADGE = {
    none: "Not reviewed",
    approve: "Approved",
    keep: "Kept as it is",
    rewrite: "Rewritten",
    comment: "Commented",
  };

  // ---- Showing a text: placeholders marked, and what changed between the two versions ----
  // A token is a placeholder in braces, a word (with its apostrophes, straight or curly), a run of
  // spaces, or one other character.
  const APOSTROPHES = "'" + String.fromCharCode(0x2019);
  const WORD = "A-Za-z0-9%" + String.fromCharCode(0xa3);
  const TOKEN = new RegExp(
    `\\{[^{}]*\\}|[${WORD}]+(?:[${APOSTROPHES}][A-Za-z]+)*|\\s+|[^\\s${WORD}]`,
    "g",
  );
  const tokenise = (s) => s.match(TOKEN) || [];
  const isSpace = (t) => /^\s+$/.test(t);
  const isPlaceholder = (t) => /^\{[^{}]*\}$/.test(t);
  // For each token of a and of b, whether it also stands in the other text (longest common run).
  function common(a, b) {
    const n = a.length,
      m = b.length;
    const inA = new Array(n).fill(false),
      inB = new Array(m).fill(false);
    if (n * m > 400000) return [inA.fill(true), inB.fill(true)];
    const t = Array.from({ length: n + 1 }, () => new Uint16Array(m + 1));
    for (let i = n - 1; i >= 0; i--)
      for (let j = m - 1; j >= 0; j--)
        t[i][j] =
          a[i] === b[j]
            ? t[i + 1][j + 1] + 1
            : Math.max(t[i + 1][j], t[i][j + 1]);
    let i = 0,
      j = 0;
    while (i < n && j < m) {
      if (a[i] === b[j]) {
        inA[i++] = true;
        inB[j++] = true;
      } else if (t[i + 1][j] >= t[i][j + 1]) i++;
      else j++;
    }
    return [inA, inB];
  }
  // A space between two changed words belongs to the change, so a run of new words reads as one mark.
  function smooth(tokens, kept) {
    const changed = kept.map((k) => !k);
    for (let i = 0; i < tokens.length; i++) {
      if (!isSpace(tokens[i])) continue;
      let before = i - 1,
        after = i + 1;
      while (before >= 0 && isSpace(tokens[before])) before--;
      while (after < tokens.length && isSpace(tokens[after])) after++;
      changed[i] =
        before >= 0 &&
        after < tokens.length &&
        changed[before] &&
        changed[after];
    }
    return changed;
  }
  function paint(node, tokens, changed, tag) {
    node.textContent = "";
    let run = node,
      runChanged = false;
    for (let i = 0; i < tokens.length; i++) {
      const isChanged = changed ? changed[i] : false;
      if (isChanged !== runChanged || (isChanged && run === node)) {
        runChanged = isChanged;
        if (isChanged) {
          run = document.createElement(tag);
          node.append(run);
        } else run = node;
      }
      if (isPlaceholder(tokens[i])) run.append(make("span", "ph", tokens[i]));
      else run.append(tokens[i]);
    }
  }
  function paintPlain(node, text) {
    paint(node, tokenise(text), null, "span");
  }

  // ---- The rows ----
  const rows = [];
  const byKey = new Map();
  const sections = [];
  const main = $("main");
  const nav = $("sections");
  const slug = (s) =>
    s
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");

  function buildRow(entry, index, section) {
    const text = entry.texts[index];
    const key = `${entry.id}#${index}`;
    const el = make("div", "text-row");
    el.dataset.key = key;
    const same = text.proposed !== null && text.proposed === text.current;
    if (same) el.classList.add("same");
    const of =
      entry.texts.length > 1 ? `, ${index + 1} of ${entry.texts.length}` : "";

    const versions = make("div", "versions");
    const left = make("div");
    left.append(make("p", "version-label", `Current${of}`));
    const currentText = make("p", "version-text");
    left.append(currentText);
    const right = make("div");
    right.append(
      make("p", "version-label", same ? "Proposed: no change" : "Proposed"),
    );
    const proposedText = make("p", "version-text");
    right.append(proposedText);
    if (text.proposed === null) {
      paintPlain(currentText, text.current);
      proposedText.classList.add("missing");
      proposedText.textContent = "Not edited yet.";
    } else if (same) {
      paintPlain(currentText, text.current);
      paintPlain(proposedText, text.proposed);
    } else {
      const a = tokenise(text.current),
        b = tokenise(text.proposed);
      const [inA, inB] = common(a, b);
      paint(currentText, a, smooth(a, inA), "del");
      paint(proposedText, b, smooth(b, inB), "ins");
    }
    versions.append(left, right);

    const decide = make("div", "decide");
    const button = (label, action) => {
      const b = make("button", "", label);
      b.type = "button";
      b.dataset.action = action;
      b.setAttribute("aria-pressed", "false");
      return b;
    };
    const approve = button("Approve the proposal", "approve");
    if (text.proposed === null) {
      approve.disabled = true;
      approve.title = "There is no proposal for this text yet.";
    }
    const keep = button("Keep the current text", "keep");
    const rewrite = button("Write my own", "rewrite");
    const comment = make("button", "", "Add a comment");
    comment.type = "button";
    comment.dataset.action = "comment";
    const badge = make("span", "badge", BADGE.none);
    decide.append(approve, keep, rewrite, comment, badge);
    el.append(versions, decide);

    const row = {
      key,
      entry,
      index,
      section,
      current: text.current,
      proposed: text.proposed,
      same,
      el,
      approve,
      keep,
      rewrite,
      badge,
      ownField: null,
      commentField: null,
      staleNote: null,
      hay: `${entry.id} ${entry.where} ${text.current} ${text.proposed || ""}`.toLowerCase(),
      visible: true,
    };
    rows.push(row);
    byKey.set(key, row);
    section.rows.push(row);
    return row;
  }

  function buildEntry(entry, section) {
    const el = make("article", "entry");
    const head = make("div", "entry-head");
    head.append(
      make(
        "p",
        "entry-where",
        entry.where || "Where it appears is not recorded.",
      ),
    );
    if (entry.status === "question")
      head.append(make("span", "tag question", "Editor's question"));
    if (entry.kind) head.append(make("span", "tag", entry.kind));
    head.append(make("span", "entry-id", entry.id));
    el.append(head);
    for (const example of entry.examples.slice(0, 2)) {
      const p = make("p", "entry-meta");
      p.append(make("b", "", "For example, in the game: "), example);
      el.append(p);
    }
    if (entry.note) {
      const p = make("p", "entry-note");
      p.append(make("b", "", "Editor's note: "), entry.note);
      el.append(p);
    }
    const mine = [];
    for (let i = 0; i < entry.texts.length; i++) {
      const row = buildRow(entry, i, section);
      mine.push(row);
      el.append(row.el);
    }
    el.rowsOf = mine;
    return el;
  }

  for (const name of DATA.screens) {
    const entries = DATA.entries.filter((e) => e.screen === name);
    if (!entries.length) continue;
    const id = `screen-${slug(name)}`;
    const section = { name, id, rows: [], entryEls: [] };
    const el = make("section", "screen");
    el.id = id;
    const head = make("div", "screen-head");
    const title = make("h2", "", name);
    title.id = `${id}-title`;
    el.setAttribute("aria-labelledby", title.id);
    section.count = make("span", "count");
    section.bulk = make("button", "", "Approve all remaining in this section");
    section.bulk.type = "button";
    head.append(title, section.count, section.bulk);
    el.append(head);
    for (const entry of entries) {
      const entryEl = buildEntry(entry, section);
      section.entryEls.push(entryEl);
      el.append(entryEl);
    }
    section.el = el;
    main.append(el);
    const link = make("a");
    link.href = `#${id}`;
    link.append(make("span", "", name));
    section.navCount = make("span", "count");
    link.append(section.navCount);
    section.link = link;
    nav.append(link);
    section.bulk.addEventListener("click", () =>
      bulkApprove(
        section.rows.filter((r) => r.proposed !== null),
        `in ${name}`,
      ),
    );
    sections.push(section);
  }

  // An approval is for the proposal the reviewer saw. If the proposal has changed since, ask again.
  for (const [key, d] of Object.entries(state.decisions)) {
    const row = byKey.get(key);
    if (!row || !d) continue;
    if (
      d.decision === "approve" &&
      d.seen !== undefined &&
      d.seen !== row.proposed
    ) {
      d.decision = null;
      d.stale = true;
    }
  }

  // ---- Painting a row's decision ----
  function field(row, cls, label, onInput) {
    const wrap = make("label", `field ${cls}`);
    wrap.append(make("span", "", label));
    const area = make("textarea");
    area.rows = 1;
    area.spellcheck = true;
    area.lang = "en-GB";
    wrap.append(area);
    area.addEventListener("input", () => {
      onInput(area.value);
      grow(area);
      save();
    });
    row.el.append(wrap);
    return [wrap, area];
  }
  function ensureOwnField(row) {
    if (!row.ownField)
      [row.ownField, row.ownArea] = field(row, "own", "Your version", (v) => {
        decisionFor(row.key).own = v;
      });
    return row.ownField;
  }
  function ensureCommentField(row) {
    if (!row.commentField)
      [row.commentField, row.commentArea] = field(
        row,
        "comment",
        "Your comment",
        (v) => {
          const d = decisionFor(row.key);
          const before = stateOf(d);
          d.comment = v;
          if (stateOf(d) !== before) {
            paintRow(row);
            scheduleCounts();
          }
        },
      );
    return row.commentField;
  }
  // Text boxes grow with what is typed. Browsers that size them from their content need no help.
  const selfSizing = CSS.supports("field-sizing", "content");
  function grow(area) {
    if (selfSizing) return;
    area.style.height = "auto";
    area.style.height = `${area.scrollHeight + 2}px`;
  }
  function decisionFor(key) {
    return (state.decisions[key] ||= { decision: null });
  }
  function paintRow(row) {
    const d = state.decisions[row.key];
    const s = stateOf(d);
    row.el.dataset.state = s;
    const hasComment = !!(d && d.comment && d.comment.trim());
    row.badge.textContent =
      s !== "none" && s !== "comment" && hasComment
        ? `${BADGE[s]}, with a comment`
        : BADGE[s];
    row.approve.setAttribute("aria-pressed", String(s === "approve"));
    row.keep.setAttribute("aria-pressed", String(s === "keep"));
    row.rewrite.setAttribute("aria-pressed", String(s === "rewrite"));
    if (s === "rewrite") {
      ensureOwnField(row).hidden = false;
      if (row.ownArea.value !== (d.own ?? "")) row.ownArea.value = d.own ?? "";
      grow(row.ownArea);
    } else if (row.ownField) row.ownField.hidden = true;
    if (hasComment || row.commentOpen) {
      ensureCommentField(row).hidden = false;
      if (document.activeElement !== row.commentArea)
        row.commentArea.value = (d && d.comment) || "";
      grow(row.commentArea);
    } else if (row.commentField) row.commentField.hidden = true;
    if (d && d.stale) {
      if (!row.staleNote) {
        row.staleNote = make(
          "p",
          "stale",
          "The proposal changed after you approved it. Please look at it again.",
        );
        row.el.append(row.staleNote);
      }
      row.staleNote.hidden = false;
    } else if (row.staleNote) row.staleNote.hidden = true;
  }
  function decide(row, action) {
    const d = decisionFor(row.key);
    delete d.stale;
    if (action === "comment") {
      row.commentOpen = true;
      paintRow(row);
      row.commentArea.focus();
      return;
    }
    if (d.decision === action) d.decision = null;
    else {
      d.decision = action;
      if (action === "approve") d.seen = row.proposed;
      if (action === "rewrite" && d.own === undefined)
        d.own = row.proposed ?? row.current;
    }
    save();
    paintRow(row);
    scheduleCounts();
    if (action === "rewrite" && d.decision === "rewrite") row.ownArea.focus();
  }
  main.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-action]");
    if (!button) return;
    const row = byKey.get(button.closest(".text-row").dataset.key);
    decide(row, button.dataset.action);
  });
  // Ctrl+Enter approves the text the keyboard is on and moves to the next one on the page.
  document.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" || !(event.ctrlKey || event.metaKey)) return;
    const at =
      document.activeElement && document.activeElement.closest(".text-row");
    if (!at) return;
    const row = byKey.get(at.dataset.key);
    if (row.proposed === null) return;
    event.preventDefault();
    if (decisionFor(row.key).decision !== "approve") decide(row, "approve");
    const next = rows.slice(rows.indexOf(row) + 1).find((r) => r.visible);
    if (next) (next.approve.disabled ? next.keep : next.approve).focus();
  });

  // ---- Counts, filters and search ----
  let filter = "all",
    query = "";
  const FILTERS = {
    all: () => true,
    changed: (r) => r.proposed !== null && !r.same,
    questions: (r) => r.entry.status === "question",
    todo: (r) => !reviewed(state.decisions[r.key]),
    mine: (r) => {
      const d = state.decisions[r.key];
      return (
        !!d && (d.decision === "rewrite" || !!(d.comment && d.comment.trim()))
      );
    },
  };
  function applyFilter() {
    const words = query.toLowerCase().split(/\s+/).filter(Boolean);
    let shown = 0;
    for (const row of rows) {
      row.visible =
        FILTERS[filter](row) && words.every((w) => row.hay.includes(w));
      row.el.hidden = !row.visible;
      if (row.visible) shown++;
    }
    for (const section of sections) {
      let any = false;
      for (const entryEl of section.entryEls) {
        const visible = entryEl.rowsOf.some((r) => r.visible);
        entryEl.hidden = !visible;
        any ||= visible;
      }
      section.el.hidden = !any;
    }
    $("empty").hidden = shown > 0;
    paintCounts(shown);
    markCurrent();
  }
  // A decision does not take a row out of the view being read: "not yet reviewed" and "my rewrites"
  // are worked out again only when the reviewer chooses a view or searches, so rows do not jump away.
  let countsQueued = false;
  function scheduleCounts() {
    if (countsQueued) return;
    countsQueued = true;
    requestAnimationFrame(() => {
      countsQueued = false;
      paintCounts(rows.filter((r) => r.visible).length);
    });
  }
  function paintCounts(shown) {
    let done = 0;
    for (const section of sections) {
      const n = section.rows.filter((r) =>
        reviewed(state.decisions[r.key]),
      ).length;
      done += n;
      const total = section.rows.length;
      section.count.textContent = `${n} of ${total} reviewed`;
      section.navCount.textContent = `${n} / ${total}`;
      section.link.classList.toggle("done", n === total);
      section.link.setAttribute(
        "aria-label",
        `${section.name}: ${n} of ${total} texts reviewed`,
      );
      section.bulk.disabled = !section.rows.some(
        (r) => r.proposed !== null && !reviewed(state.decisions[r.key]),
      );
    }
    const narrowed = filter !== "all" || query.trim();
    $("progress").textContent =
      `Reviewed ${done} of ${rows.length} texts.` +
      (narrowed ? ` Showing ${shown}.` : "");
    $("approveUnchanged").disabled = !rows.some(
      (r) => r.same && !reviewed(state.decisions[r.key]),
    );
  }
  for (const button of document.querySelectorAll("[data-filter]"))
    button.addEventListener("click", () => {
      filter = button.dataset.filter;
      for (const other of document.querySelectorAll("[data-filter]"))
        other.setAttribute("aria-pressed", String(other === button));
      applyFilter();
    });
  let searchTimer = 0;
  $("search").addEventListener("input", (event) => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => {
      query = event.target.value;
      applyFilter();
    }, 150);
  });

  // ---- Approving many at once, with an undo ----
  let undo = null,
    toastTimer = 0;
  function toast(message, restore) {
    undo = restore || null;
    $("toastText").textContent = message;
    $("toastUndo").hidden = !restore;
    $("toast").hidden = false;
    clearTimeout(toastTimer);
    if (!restore)
      toastTimer = setTimeout(() => ($("toast").hidden = true), 6000);
  }
  function restoreFrom(before) {
    for (const [key, d] of Object.entries(before)) {
      if (d === null) delete state.decisions[key];
      else state.decisions[key] = d;
      const row = byKey.get(key);
      if (row) paintRow(row);
    }
    saveNow();
    scheduleCounts();
  }
  $("toastUndo").addEventListener("click", () => {
    if (!undo) return;
    restoreFrom(undo);
    toast("Undone.");
  });
  $("toastClose").addEventListener("click", () => {
    $("toast").hidden = true;
    undo = null;
  });
  const snapshot = (key) =>
    state.decisions[key]
      ? JSON.parse(JSON.stringify(state.decisions[key]))
      : null;
  function bulkApprove(candidates, what) {
    const before = {};
    for (const row of candidates) {
      if (reviewed(state.decisions[row.key])) continue;
      before[row.key] = snapshot(row.key);
      const d = decisionFor(row.key);
      delete d.stale;
      d.decision = "approve";
      d.seen = row.proposed;
      paintRow(row);
    }
    const n = Object.keys(before).length;
    saveNow();
    scheduleCounts();
    toast(
      n
        ? `Approved ${n} ${n === 1 ? "text" : "texts"} ${what}.`
        : `There was nothing left to approve ${what}.`,
      n ? before : null,
    );
  }
  $("approveUnchanged").addEventListener("click", () =>
    bulkApprove(
      rows.filter((r) => r.same),
      "that the editor left unchanged",
    ),
  );

  // ---- Export and import ----
  function exported() {
    const decisions = [];
    const summary = {
      texts: rows.length,
      reviewed: 0,
      approved: 0,
      kept: 0,
      rewritten: 0,
      comments: 0,
    };
    for (const row of rows) {
      const d = state.decisions[row.key];
      if (!reviewed(d)) continue;
      summary.reviewed++;
      const comment = d.comment && d.comment.trim() ? d.comment.trim() : "";
      if (comment) summary.comments++;
      const item = {
        id: row.entry.id,
        index: row.index,
        decision: d.decision || null,
        current: row.current,
      };
      if (d.decision === "approve") {
        summary.approved++;
        item.text = row.proposed;
      } else if (d.decision === "keep") {
        summary.kept++;
        item.text = row.current;
      } else if (d.decision === "rewrite") {
        summary.rewritten++;
        item.text = d.own ?? "";
      }
      if (comment) item.comment = comment;
      decisions.push(item);
    }
    return {
      tool: "santa-copy-review",
      reviewer: state.reviewer.trim(),
      build: DATA.build,
      generated: DATA.generated,
      exportedAt: new Date().toISOString(),
      summary,
      decisions,
    };
  }
  let exportText = "";
  $("exportButton").addEventListener("click", () => {
    saveNow();
    const data = exported();
    exportText = JSON.stringify(data, null, 2);
    const s = data.summary;
    $("exportSummary").textContent =
      `You have reviewed ${s.reviewed} of ${s.texts} texts: ${s.approved} approved, ` +
      `${s.kept} kept as they are, ${s.rewritten} rewritten and ${s.comments} with a comment.` +
      (data.reviewer
        ? ""
        : " Your name is missing. Please close this box and add it at the top of the page.");
    $("exportStatus").textContent = "";
    $("exportDialog").showModal();
  });
  $("exportDownload").addEventListener("click", () => {
    const who = slug(state.reviewer) || "reviewer";
    const link = make("a");
    const url = URL.createObjectURL(
      new Blob([exportText], { type: "application/json" }),
    );
    link.href = url;
    link.download = `copy-review-${who}-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
    $("exportStatus").textContent = `Saved as ${link.download}.`;
  });
  $("exportCopy").addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(exportText);
      $("exportStatus").textContent = "Copied. Paste it into your message.";
    } catch {
      const area = make("textarea");
      area.value = exportText;
      $("exportDialog").append(area);
      area.select();
      const ok = document.execCommand("copy");
      area.remove();
      $("exportStatus").textContent = ok
        ? "Copied. Paste it into your message."
        : "Copying is blocked in this browser. Please download the file.";
    }
  });
  $("exportClose").addEventListener("click", () => $("exportDialog").close());

  $("importButton").addEventListener("click", () => $("importFile").click());
  $("importFile").addEventListener("change", async (event) => {
    const file = event.target.files[0];
    event.target.value = "";
    if (!file) return;
    let data;
    try {
      data = JSON.parse(await file.text());
    } catch {
      toast(
        "That file could not be read. Please choose a review exported from this page.",
      );
      return;
    }
    importReview(data);
  });
  function importReview(data) {
    if (!data || !Array.isArray(data.decisions)) {
      toast("That file is not a review exported from this page.");
      return;
    }
    const before = {};
    let taken = 0,
      replaced = 0,
      unknown = 0;
    for (const item of data.decisions) {
      // Older exports called the index within the entry "variant".
      const row = item && byKey.get(`${item.id}#${item.index ?? item.variant}`);
      if (!row) {
        unknown++;
        continue;
      }
      const old = state.decisions[row.key];
      const next = { decision: null };
      const text = typeof item.text === "string" ? item.text : undefined;
      if (item.decision === "keep") next.decision = "keep";
      else if (item.decision === "rewrite") {
        next.decision = "rewrite";
        next.own = text ?? "";
      } else if (item.decision === "approve") {
        // An approval of a proposal that has since changed is kept as the text that was approved.
        if (text === undefined || text === row.proposed) {
          next.decision = "approve";
          next.seen = row.proposed;
        } else {
          next.decision = "rewrite";
          next.own = text;
        }
      }
      if (typeof item.comment === "string" && item.comment.trim())
        next.comment = item.comment.trim();
      if (!reviewed(next)) continue;
      if (reviewed(old) && JSON.stringify(old) !== JSON.stringify(next))
        replaced++;
      before[row.key] = snapshot(row.key);
      state.decisions[row.key] = next;
      paintRow(row);
      taken++;
    }
    if (!state.reviewer && typeof data.reviewer === "string" && data.reviewer) {
      state.reviewer = data.reviewer;
      $("reviewer").value = data.reviewer;
    }
    saveNow();
    scheduleCounts();
    const from =
      typeof data.reviewer === "string" && data.reviewer
        ? ` from ${data.reviewer}`
        : "";
    toast(
      `Imported ${taken} ${taken === 1 ? "decision" : "decisions"}${from}.` +
        (replaced
          ? ` ${replaced} replaced decisions you had already made.`
          : "") +
        (unknown
          ? ` ${unknown} were for texts that are not on this page.`
          : "") +
        (data.build && data.build !== DATA.build
          ? ` The file was made for build ${data.build}, and this page shows ${DATA.build}.`
          : ""),
      taken ? before : null,
    );
  }

  // ---- The page around the rows ----
  $("reviewer").value = state.reviewer;
  $("reviewer").addEventListener("input", (event) => {
    state.reviewer = event.target.value;
    save();
  });
  $("buildLine").textContent =
    `Santa's AI Workshop, build ${DATA.build}. Texts gathered on ${DATA.generated}.`;
  showStorageNote();
  // Once the reviewer has begun, the explanation stays folded away.
  if (Object.values(state.decisions).some(reviewed)) $("how").open = false;

  const toolbar = $("toolbar");
  const measure = () => {
    const sticky = getComputedStyle(toolbar).position === "sticky";
    document.documentElement.style.setProperty(
      "--toolbar-height",
      `${sticky ? toolbar.offsetHeight : 0}px`,
    );
  };
  measure();
  addEventListener("resize", measure);
  if (document.fonts && document.fonts.ready)
    document.fonts.ready.then(measure);

  // The screen being read is marked in the list of screens.
  let scrollQueued = false;
  function markCurrent() {
    scrollQueued = false;
    const line = toolbar.getBoundingClientRect().bottom + 60;
    let current = null;
    for (const section of sections) {
      if (section.el.hidden) continue;
      if (!current || section.el.getBoundingClientRect().top <= line)
        current = section;
    }
    for (const section of sections) {
      if (section === current)
        section.link.setAttribute("aria-current", "true");
      else section.link.removeAttribute("aria-current");
    }
  }
  addEventListener(
    "scroll",
    () => {
      if (scrollQueued) return;
      scrollQueued = true;
      requestAnimationFrame(markCurrent);
    },
    { passive: true },
  );

  for (const row of rows) if (state.decisions[row.key]) paintRow(row);
  applyFilter();
})();
