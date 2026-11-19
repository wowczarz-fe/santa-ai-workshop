// The text feedback page: lists every text the game shows today from data.js, lets a reviewer suggest
// a wording or comment on any of them, keeps that in this browser, and turns it into plain text to
// paste into an email (or a file to carry on on another computer).
(() => {
  "use strict";
  const DATA = window.TEXT_FEEDBACK;
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

  // ---- The reviewer's feedback, kept in this browser ----
  const STORE = `text-feedback:${DATA.build}`;
  let storageWorks = true;
  const state = { reviewer: "", overall: "", items: {} };
  try {
    const saved = JSON.parse(localStorage.getItem(STORE));
    if (saved && typeof saved === "object") {
      if (typeof saved.reviewer === "string") state.reviewer = saved.reviewer;
      if (typeof saved.overall === "string") state.overall = saved.overall;
      if (saved.items && typeof saved.items === "object")
        state.items = saved.items;
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
        "This browser is not saving your feedback. Please send it before you close this page.";
  }
  addEventListener("pagehide", saveNow);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") saveNow();
  });

  const tidy = (s) => (typeof s === "string" ? s.trim() : "");
  // A suggestion counts only when it differs from the text in the game.
  const suggestionOf = (row, item) => {
    const s = tidy(item && item.suggested);
    return s && s !== row.current.trim() ? s : "";
  };
  const commentOf = (item) => tidy(item && item.comment);
  const touched = (row) => {
    const item = state.items[row.key];
    return !!(suggestionOf(row, item) || commentOf(item));
  };

  // ---- Showing a text: placeholders marked, and what a suggestion changes ----
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
  const paintPlain = (node, text) => paint(node, tokenise(text), null, "span");

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
  const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

  function buildRow(entry, index, section) {
    const current = entry.texts[index];
    const key = `${entry.id}#${index}`;
    const el = make("div", "text-row");
    el.dataset.key = key;
    if (entry.texts.length > 1)
      el.append(
        make("p", "text-of", `Text ${index + 1} of ${entry.texts.length}`),
      );
    const currentText = make("p", "current-text");
    paintPlain(currentText, current);
    el.append(currentText);

    const actions = make("div", "actions");
    const suggest = make("button", "", "Suggest a change");
    suggest.type = "button";
    suggest.dataset.action = "suggest";
    const comment = make("button", "", "Add a comment");
    comment.type = "button";
    comment.dataset.action = "comment";
    const badge = make("span", "badge");
    actions.append(suggest, comment, badge);
    el.append(actions);

    const row = {
      key,
      entry,
      index,
      section,
      current,
      el,
      currentText,
      suggest,
      comment,
      badge,
      suggestField: null,
      commentField: null,
      hay: `${entry.id} ${entry.where} ${entry.kind} ${current}`.toLowerCase(),
      visible: true,
      painted: "",
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
    if (entry.kind) head.append(make("span", "tag", entry.kind));
    el.append(head);
    if (entry.texts.some((t) => /\{[^{}]*\}/.test(t)))
      for (const example of entry.examples) {
        const p = make("p", "entry-meta");
        p.append(make("b", "", "For example, in the game: "), example);
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
    head.append(title, section.count);
    el.append(head);
    const about = DATA.about && DATA.about[name];
    if (about) el.append(make("p", "screen-about", about));
    for (const entry of entries) {
      const entryEl = buildEntry(entry, section);
      section.entryEls.push(entryEl);
      el.append(entryEl);
    }
    section.el = el;
    main.append(el);
    const link = make("a");
    link.href = `#${id}`;
    link.append(make("span", "name", name));
    section.navCount = make("span", "count");
    section.navMine = make("span", "mine");
    link.append(section.navCount, section.navMine);
    section.link = link;
    nav.append(link);
    sections.push(section);
  }

  // ---- Painting a row's feedback ----
  const selfSizing = CSS.supports("field-sizing", "content");
  function grow(area) {
    if (selfSizing) return;
    area.style.height = "auto";
    area.style.height = `${area.scrollHeight + 2}px`;
  }
  const itemFor = (key) => (state.items[key] ||= {});
  function dropIfEmpty(key) {
    const item = state.items[key];
    if (item && !tidy(item.suggested) && !tidy(item.comment))
      delete state.items[key];
  }
  function field(row, cls, label, removeLabel) {
    const wrap = make("div", `field ${cls}`);
    const labelEl = make("label");
    const area = make("textarea");
    area.id = `${cls}-${rows.indexOf(row)}`;
    labelEl.htmlFor = area.id;
    labelEl.textContent = label;
    area.rows = 1;
    area.spellcheck = true;
    area.lang = "en-GB";
    const remove = make("button", "link remove", removeLabel);
    remove.type = "button";
    const head = make("div", "field-head");
    head.append(labelEl, remove);
    wrap.append(head, area);
    return { wrap, area, remove };
  }
  function ensureSuggestField(row) {
    if (row.suggestField) return row.suggestField;
    const f = field(
      row,
      "suggestion",
      "Your suggested wording",
      "Remove my suggestion",
    );
    f.preview = make("p", "preview");
    f.warn = make("p", "warn-note");
    f.wrap.append(f.preview, f.warn);
    f.area.addEventListener("input", () => {
      itemFor(row.key).suggested = f.area.value;
      grow(f.area);
      paintRow(row);
      save();
      scheduleCounts();
    });
    f.remove.addEventListener("click", () => {
      const item = itemFor(row.key);
      delete item.suggested;
      dropIfEmpty(row.key);
      row.suggestOpen = false;
      saveNow();
      paintRow(row);
      scheduleCounts();
      row.suggest.focus();
    });
    row.el.insertBefore(
      f.wrap,
      row.commentField ? row.commentField.wrap : null,
    );
    row.suggestField = f;
    return f;
  }
  function ensureCommentField(row) {
    if (row.commentField) return row.commentField;
    const f = field(row, "comment", "Your comment", "Remove my comment");
    f.area.addEventListener("input", () => {
      itemFor(row.key).comment = f.area.value;
      grow(f.area);
      paintRow(row);
      save();
      scheduleCounts();
    });
    f.remove.addEventListener("click", () => {
      const item = itemFor(row.key);
      delete item.comment;
      dropIfEmpty(row.key);
      row.commentOpen = false;
      saveNow();
      paintRow(row);
      scheduleCounts();
      row.comment.focus();
    });
    row.el.append(f.wrap);
    row.commentField = f;
    return f;
  }
  // Placeholders the suggestion dropped, so the reviewer can put them back.
  function missingPlaceholders(current, suggested) {
    const have = new Set(suggested.match(/\{[^{}]*\}/g) || []);
    return [...new Set(current.match(/\{[^{}]*\}/g) || [])].filter(
      (p) => !have.has(p),
    );
  }
  function paintRow(row) {
    const item = state.items[row.key];
    const suggestion = suggestionOf(row, item);
    const comment = commentOf(item);
    const hasSuggestionText = !!tidy(item && item.suggested);
    const kind = suggestion
      ? comment
        ? "both"
        : "suggestion"
      : comment
        ? "comment"
        : "none";
    row.el.dataset.state = kind;
    row.badge.textContent = {
      none: "",
      suggestion: "Your suggestion",
      comment: "Your comment",
      both: "Your suggestion and comment",
    }[kind];
    row.suggest.textContent =
      hasSuggestionText || row.suggestOpen
        ? "Edit my suggestion"
        : "Suggest a change";
    row.comment.textContent =
      comment || row.commentOpen ? "Edit my comment" : "Add a comment";

    // The text in the game, with the words a suggestion takes out struck through.
    const paintKey = suggestion;
    if (row.painted !== paintKey) {
      row.painted = paintKey;
      if (suggestion) {
        const a = tokenise(row.current),
          b = tokenise(suggestion);
        const [inA, inB] = common(a, b);
        paint(row.currentText, a, smooth(a, inA), "del");
        row.diff = [b, smooth(b, inB)];
      } else {
        paintPlain(row.currentText, row.current);
        row.diff = null;
      }
    }

    if (hasSuggestionText || row.suggestOpen) {
      const f = ensureSuggestField(row);
      f.wrap.hidden = false;
      if (document.activeElement !== f.area)
        f.area.value =
          item && typeof item.suggested === "string"
            ? item.suggested
            : row.current;
      grow(f.area);
      if (row.diff) {
        f.preview.hidden = false;
        f.preview.textContent = "";
        const shown = make("span");
        paint(shown, row.diff[0], row.diff[1], "ins");
        f.preview.append(
          make("b", "", "Your version, with changes marked: "),
          shown,
        );
      } else {
        f.preview.hidden = false;
        f.preview.textContent =
          "Change the words above. This text stays as it is until you do.";
      }
      const missing = suggestion
        ? missingPlaceholders(row.current, suggestion)
        : [];
      f.warn.hidden = !missing.length;
      if (missing.length)
        f.warn.textContent = `Your version leaves out ${missing.join(", ")}. The game fills these in, so please keep them unless you mean to drop them.`;
    } else if (row.suggestField) row.suggestField.wrap.hidden = true;

    if (comment || row.commentOpen) {
      const f = ensureCommentField(row);
      f.wrap.hidden = false;
      if (document.activeElement !== f.area)
        f.area.value = (item && item.comment) || "";
      grow(f.area);
    } else if (row.commentField) row.commentField.wrap.hidden = true;
  }
  main.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-action]");
    if (!button) return;
    const row = byKey.get(button.closest(".text-row").dataset.key);
    if (button.dataset.action === "suggest") {
      row.suggestOpen = true;
      paintRow(row);
      const area = row.suggestField.area;
      area.focus();
      area.setSelectionRange(area.value.length, area.value.length);
    } else {
      row.commentOpen = true;
      paintRow(row);
      row.commentField.area.focus();
    }
  });

  // ---- Counts, filters and search ----
  let filter = "all",
    query = "";
  const FILTERS = { all: () => true, mine: (r) => touched(r) };
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
    $("empty").textContent =
      filter === "mine" && !query.trim()
        ? "You have not given feedback on any text yet. Choose All texts to see them all."
        : "No text matches. Change the filter or the search to see more.";
    paintCounts(shown);
    markCurrent();
  }
  // Feedback does not take a row out of the view being read: "Texts with my feedback" is worked out
  // again only when the reviewer chooses a view or searches, so rows do not jump away.
  let countsQueued = false;
  function scheduleCounts() {
    if (countsQueued) return;
    countsQueued = true;
    requestAnimationFrame(() => {
      countsQueued = false;
      paintCounts(rows.filter((r) => r.visible).length);
    });
  }
  function feedbackCount() {
    return rows.filter(touched).length;
  }
  function paintCounts(shown) {
    let total = 0;
    for (const section of sections) {
      const n = section.rows.filter(touched).length;
      total += n;
      const texts = section.rows.length;
      section.count.textContent =
        `${plural(texts, "text", "texts")}.` +
        (n ? ` Your feedback on ${n}.` : "");
      section.navCount.textContent = String(texts);
      section.navMine.textContent = n ? String(n) : "";
      section.navMine.hidden = !n;
      section.link.setAttribute(
        "aria-label",
        `${section.name}: ${plural(texts, "text", "texts")}` +
          (n ? `, your feedback on ${n}` : ""),
      );
    }
    const narrowed = filter !== "all" || query.trim();
    $("progress").textContent =
      (total
        ? `Your feedback on ${plural(total, "text", "texts")} of ${rows.length}.`
        : `${rows.length} texts. Your feedback appears here as you add it.`) +
      (narrowed ? ` Showing ${shown}.` : "");
    $("sendButton").textContent = total
      ? `Send your feedback (${total})`
      : "Send your feedback";
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

  // ---- Messages, with an undo for imports ----
  let undo = null,
    toastTimer = 0;
  function toast(message, restore) {
    undo = restore || null;
    $("toastText").textContent = message;
    $("toastUndo").hidden = !restore;
    $("toast").hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(
      () => ($("toast").hidden = true),
      restore ? 15000 : 6000,
    );
  }
  $("toastUndo").addEventListener("click", () => {
    if (!undo) return;
    Object.assign(state, JSON.parse(undo));
    $("reviewer").value = state.reviewer;
    $("overall").value = state.overall;
    saveNow();
    for (const row of rows) paintRow(row);
    applyFilter();
    toast("Undone.");
  });
  $("toastClose").addEventListener("click", () => {
    $("toast").hidden = true;
    undo = null;
  });

  // ---- Sending it back: plain text for an email, or a file ----
  const today = () =>
    new Date().toLocaleDateString("en-GB", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  // A blank line ends an item in the plain text, so blank lines inside what the reviewer wrote are
  // closed up to single line breaks.
  const closeUp = (s) => s.replace(/\r\n?/g, "\n").replace(/\n\s*\n+/g, "\n");
  function collected() {
    const items = [];
    for (const row of rows) {
      const item = state.items[row.key];
      const suggested = suggestionOf(row, item);
      const comment = commentOf(item);
      if (!suggested && !comment) continue;
      items.push({
        id: row.entry.id,
        index: row.index,
        where: row.entry.where,
        of: row.entry.texts.length,
        current: row.current,
        suggested: suggested || null,
        comment: comment || null,
      });
    }
    return items;
  }
  function plainText() {
    const items = collected();
    const overall = tidy(state.overall);
    const lines = [
      "Feedback on the Santa's AI Workshop text",
      `Reviewer: ${tidy(state.reviewer) || "no name given"}`,
      `Build: ${DATA.build}, texts gathered on ${DATA.generated}`,
      `Written on: ${today()}`,
      `Texts with feedback: ${items.length}`,
    ];
    if (overall) lines.push("", "Overall comments:", closeUp(overall));
    items.forEach((item, i) => {
      const part = item.of > 1 ? `, text ${item.index + 1} of ${item.of}` : "";
      const ref = item.index ? `${item.id}:${item.index}` : item.id;
      lines.push("", `${i + 1}. ${item.where}${part} [${ref}]`);
      lines.push(`Now: ${closeUp(item.current)}`);
      if (item.suggested) lines.push(`Suggested: ${closeUp(item.suggested)}`);
      if (item.comment) lines.push(`Comment: ${closeUp(item.comment)}`);
    });
    lines.push("", "End of feedback.");
    return lines.join("\n");
  }
  function fileData() {
    return {
      tool: "santa-text-feedback",
      reviewer: tidy(state.reviewer),
      build: DATA.build,
      generated: DATA.generated,
      exportedAt: new Date().toISOString(),
      overall: tidy(state.overall),
      items: collected().map(({ of, ...item }) => item),
    };
  }
  const MAIL_LIMIT = 1800;
  const SUBJECT = "Feedback on the Santa's AI Workshop text";
  function mailHref(text) {
    const body =
      text.length <= MAIL_LIMIT
        ? text
        : "Please paste the feedback you copied from the page here, or attach the file you downloaded from it.";
    const enc = (s) => encodeURIComponent(s.replace(/\r?\n/g, "\r\n"));
    return `mailto:?subject=${enc(SUBJECT)}&body=${enc(body)}`;
  }
  let lastText = "";
  function openSend() {
    saveNow();
    lastText = plainText();
    const items = collected();
    const overall = tidy(state.overall);
    const parts = [];
    parts.push(
      items.length
        ? `You have given feedback on ${plural(items.length, "text", "texts")}`
        : "You have not given feedback on any text yet",
    );
    $("sendSummary").textContent =
      parts[0] +
      (overall ? ", and written overall comments." : ".") +
      (tidy(state.reviewer)
        ? ""
        : " Your name is missing. Please add it at the top of the page so we know who it is from.");
    $("plainText").value = lastText;
    $("mailLink").href = mailHref(lastText);
    $("mailLink").title =
      lastText.length <= MAIL_LIMIT
        ? "Opens your email program with your feedback in the message."
        : "Your feedback is long, so this copies it first. Paste it into the email that opens.";
    $("sendStatus").textContent = "";
    $("sendDialog").showModal();
    grow($("plainText"));
  }
  $("sendButton").addEventListener("click", openSend);
  $("sendClose").addEventListener("click", () => $("sendDialog").close());
  async function copy(text) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      const area = $("plainText");
      area.focus();
      area.select();
      try {
        return document.execCommand("copy");
      } catch {
        return false;
      }
    }
  }
  $("copyText").addEventListener("click", async () => {
    const ok = await copy(lastText);
    $("sendStatus").textContent = ok
      ? "Copied. Now paste it into an email to the person who gave you this link."
      : "This browser did not let the page copy. The text below is selected: copy it with Ctrl+C, or Cmd+C on a Mac.";
    if (!ok) {
      $("plainText").focus();
      $("plainText").select();
    }
  });
  $("plainText").addEventListener("focus", (event) => event.target.select());
  $("mailLink").addEventListener("click", async () => {
    if (lastText.length > MAIL_LIMIT) {
      const ok = await copy(lastText);
      $("sendStatus").textContent = ok
        ? "Your feedback is long, so it has been copied. Paste it into the email that opens."
        : "Your feedback is long. Please copy the text below and paste it into the email.";
    }
  });
  $("downloadFile").addEventListener("click", () => {
    const who = slug(state.reviewer) || "reviewer";
    const link = make("a");
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(fileData(), null, 2)], {
        type: "application/json",
      }),
    );
    link.href = url;
    link.download = `text-feedback-${who}-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
    $("sendStatus").textContent = `Saved as ${link.download}.`;
  });
  $("importButton").addEventListener("click", () => $("importFile").click());
  $("importFile").addEventListener("change", async (event) => {
    const file = event.target.files[0];
    event.target.value = "";
    if (!file) return;
    let data;
    try {
      data = JSON.parse(await file.text());
    } catch {
      $("sendStatus").textContent =
        "That file could not be read. Please choose a file downloaded from this page.";
      return;
    }
    importFeedback(data);
  });
  function importFeedback(data) {
    if (!data || !Array.isArray(data.items)) {
      $("sendStatus").textContent =
        "That file is not one downloaded from this page.";
      return;
    }
    const before = JSON.stringify(state);
    let taken = 0,
      unknown = 0;
    for (const item of data.items) {
      const row = item && byKey.get(`${item.id}#${item.index ?? 0}`);
      if (!row) {
        unknown++;
        continue;
      }
      const next = {};
      if (typeof item.suggested === "string" && item.suggested.trim())
        next.suggested = item.suggested;
      if (typeof item.comment === "string" && item.comment.trim())
        next.comment = item.comment;
      if (!next.suggested && !next.comment) continue;
      state.items[row.key] = next;
      paintRow(row);
      taken++;
    }
    if (!tidy(state.reviewer) && tidy(data.reviewer)) {
      state.reviewer = data.reviewer;
      $("reviewer").value = data.reviewer;
    }
    if (!tidy(state.overall) && tidy(data.overall)) {
      state.overall = data.overall;
      $("overall").value = data.overall;
    }
    saveNow();
    applyFilter();
    $("sendDialog").close();
    toast(
      `Imported feedback on ${plural(taken, "text", "texts")}.` +
        (unknown
          ? ` ${plural(unknown, "item was", "items were")} for texts that are not on this page.`
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
  $("overall").value = state.overall;
  grow($("overall"));
  $("overall").addEventListener("input", (event) => {
    state.overall = event.target.value;
    grow(event.target);
    save();
  });
  $("buildLine").textContent =
    `Santa's AI Workshop, build ${DATA.build}. Texts gathered on ${DATA.generated}.`;
  showStorageNote();
  // Once the reviewer has begun, the explanation stays folded away.
  if (Object.keys(state.items).length || tidy(state.overall))
    $("how").open = false;

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

  for (const row of rows) if (state.items[row.key]) paintRow(row);
  applyFilter();
})();
