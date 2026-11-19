const $ = (id) => document.getElementById(id);
const seed = new URLSearchParams(location.search).get("seed") || "2026";
let game = new WishRouting(seed);
let started = false;
let paused = false;
let selected = 0;
let last = performance.now();
let queueSignature = "";
let deliveryCount = -1;
let letterId = null;
$("seed").textContent = `Same postbag on replay · Seed ${seed}`;
function render() {
  $("score").innerHTML = `${game.good} <small>/ 24</small>`;
  $("time").textContent = `${Math.ceil(90 - game.time)}s until departure`;
  $("clock").value = 90 - game.time;
  $("bulletin").textContent =
    game.time < 28
      ? "✉ First post: familiar toys are quick for AI. Vague wishes need a reply; fitted gifts need Pip’s check."
      : game.time < 56
        ? "⛑ Special deliveries: a wrong fit means a return. The AI machine spends 4 seconds dealing with it. Save Pip for these checks."
        : "📬 Replies have arrived! New mouse and bat wishes now include the child’s answer. AI can use those details; fitted gifts still need Pip.";
  if (!game.queue.some((o) => o.id === selected)) selected = game.queue[0]?.id;
  const sig = game.queue.map((o) => o.id).join() + ":" + selected;
  if (sig !== queueSignature) {
    queueSignature = sig;
    $("queue").innerHTML =
      game.queue
        .map(
          (o) =>
            `<button class="envelope ${o.id === selected ? "selected" : ""}" data-order="${o.id}" aria-pressed="${o.id === selected}"><span>✉ ${o.name}</span><small>${o.supplied ? "Reply enclosed" : o.kind === "fit" ? "Needs a fit check" : o.kind === "question" ? "Missing detail" : "Clear wish"}</small><progress max="18" value="18" data-deadline="${o.deadline}" aria-label="Time left for ${o.name}"></progress></button>`,
        )
        .join("") ||
      '<p class="empty">The postbag is empty. Another letter is on its way.</p>';
  }
  document
    .querySelectorAll("[data-deadline]")
    .forEach(
      (p) => (p.value = Math.max(0, Number(p.dataset.deadline) - game.time)),
    );
  $("queue-count").textContent = `${game.queue.length} waiting`;
  const order = game.queue.find((o) => o.id === selected);
  if (letterId !== selected) {
    letterId = selected;
    $("letter").innerHTML = order
      ? `<span class="stamp">NORTH POLE<br />✦ EXPRESS</span><span class="eyebrow">Dear Santa,</span><blockquote>“${order.wish}”</blockquote><p class="signature">Love, ${order.name}</p>${order.supplied ? `<p class="reply">Reply enclosed: “${order.reply}”</p>` : `<p class="letter-note">${order.kind === "fit" ? "Pip can ask for measurements. A wrong fit ties up AI for 4 seconds on return." : order.kind === "question" ? "There is more than one way to read this. Pip can ask what they mean." : "The request has the details AI needs."}</p>`}`
      : '<p class="empty">Choose the next letter when it arrives.</p>';
  }
  for (const maker of ["ai", "elf"]) {
    const job = game.jobs[maker];
    const repair = maker === "ai" && game.repairUntil > game.time;
    $(maker).disabled = paused || !order || !!job || repair;
    $(maker + "-state").textContent = job
      ? `${maker === "elf" ? "Asking & checking for" : "Making for"} ${job.order.name} · ${Math.ceil(job.end - game.time)}s`
      : repair
        ? `Handling a return · ${Math.ceil(game.repairUntil - game.time)}s`
        : "Ready for a wish →";
  }
  if (deliveryCount !== game.deliveries.length) {
    deliveryCount = game.deliveries.length;
    $("deliveries").innerHTML =
      game.deliveries
        .slice(0, 3)
        .map(
          (d) =>
            `<article class="delivery ${d.correct ? "correct" : "wrong"}"><span class="gift">${d.correct ? d.gift : d.wrong}</span><div><b>${d.name}: ${d.correct ? "Just what I wished for!" : "Oh, Santa…"}</b><p>${d.correct ? d.label : d.mistake}${d.route === "elf" && d.reply ? ` · “${d.reply}”` : ""}${d.repair ? ". Returning it takes the AI machine 4 seconds." : ""}</p><small>${d.route === "elf" ? "Pip asked and checked" : "Made by AI"} · ${d.correct ? "+1 correct gift" : "Wish still unfulfilled"}</small></div></article>`,
        )
        .join("") ||
      '<p class="empty">Wrapped gifts stay a surprise until delivery.</p>';
  }
  if (game.done) finish();
}
function finish() {
  document.body.classList.remove("playing");
  started = false;
  $("play").hidden = true;
  $("result").hidden = false;
  $("result").innerHTML =
    `<span class="eyebrow">Christmas morning</span><h2>${game.good >= 24 ? "A well-routed Christmas." : "Some wishes are still waiting."}</h2><p class="result-number">${game.good}<small> correct gifts delivered</small></p><p class="lesson">${game.lesson()}</p><p>You sent ${game.choices.ai} wishes to AI and ${game.choices.elf} to Pip. ${game.missed} letters waited too long; ${game.queue.length + Object.values(game.jobs).filter(Boolean).length} were unfinished at departure.</p><button class="primary" id="replay">Try the same postbag again →</button>`;
  $("replay").onclick = reset;
}
function reset() {
  document.body.classList.remove("playing");
  game = new WishRouting(seed);
  selected = 0;
  letterId = null;
  queueSignature = "";
  deliveryCount = -1;
  started = false;
  paused = false;
  $("pause").textContent = "Pause";
  $("result").hidden = true;
  $("play").hidden = true;
  $("intro").hidden = false;
  $("response").textContent = "";
  render();
}
$("start").onclick = () => {
  document.body.classList.add("playing");
  $("intro").hidden = true;
  $("play").hidden = false;
  started = true;
  last = performance.now();
  render();
};
$("restart").onclick = reset;
$("pause").onclick = () => {
  paused = !paused;
  $("pause").textContent = paused ? "Resume" : "Pause";
  render();
};
$("queue").onclick = (event) => {
  const button = event.target.closest("[data-order]");
  if (button && !paused) {
    selected = Number(button.dataset.order);
    render();
  }
};
for (const maker of ["ai", "elf"])
  $(maker).onclick = () => {
    if (paused || !started) return;
    const order = game.queue.find((o) => o.id === selected);
    if (game.route(selected, maker)) {
      $("response").textContent =
        maker === "elf"
          ? `Pip opens ${order.name}’s letter and asks for the details before making the gift.`
          : `AI is wrapping ${order.name}’s gift. See what arrives at the doorstep.`;
      render();
    }
  };
document.addEventListener("visibilitychange", () => {
  if (document.hidden && started) {
    paused = true;
    $("pause").textContent = "Resume";
    render();
  }
});
function frame(now) {
  if (started && !paused) {
    game.advance(Math.min((now - last) / 1000, 0.1));
    render();
  }
  last = now;
  requestAnimationFrame(frame);
}
render();
requestAnimationFrame(frame);
