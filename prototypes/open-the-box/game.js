const app = document.getElementById("app");
const pause = document.getElementById("pause");
const rawSeed = new URLSearchParams(location.search).get("seed");
const seed =
  rawSeed === null
    ? 3719
    : [...rawSeed].reduce(
        (n, c) => (Math.imul(n, 31) + c.charCodeAt(0)) >>> 0,
        0,
      );
let workshop;
let paused = false;
function render() {
  if (!workshop) {
    app.innerHTML = `<section class="welcome"><div class="hero" aria-hidden="true">🎁 ✨ 🛷</div><h2>Tap a box. See what the AI packed.</h2><p>Deliver as many correct gifts as you can before midnight. Opening a box takes 2 seconds. Ship a load in 3 seconds, or let elves remake it in 10.</p><button class="primary" data-action="start">Start the night →</button></section>`;
    return;
  }
  const g = workshop;
  pause.hidden = g.done;
  pause.textContent = paused ? "Resume" : "Pause";
  if (g.done) {
    app.innerHTML = `<section class="welcome"><p class="eyebrow">CHRISTMAS MORNING</p><h2>The sleigh is home.</h2><div class="result">${g.good}</div><p>correct gifts delivered</p><p class="lesson">${g.lesson()}</p><p>You opened ${g.checks} boxes, held ${g.holds} loads and rolled back ${g.resets} updates.</p><button class="primary" data-action="start">Try the same night again →</button></section>`;
    return;
  }
  const disabled = g.busy > 0 || paused;
  const opened = g.boxes.filter((b) => b.open).length;
  app.innerHTML = `<div class="score"><div><strong>${g.good}</strong><span>correct gifts delivered</span></div><div class="clock">${Math.ceil(g.time)}s <span>until midnight</span></div></div><div class="time"><i style="width:${(g.time / 90) * 100}%"></i></div><section class="load"><div class="load-title"><div><p class="eyebrow">LOAD ${g.round} / ${g.kind.name}</p><h2>“${g.kind.wish}, please.”</h2></div><span class="stamp">${g.phase === "delivery" ? "DELIVERED" : "NORTH POLE"}</span></div><p class="stakes">${g.kind.note}</p>${g.update ? '<div class="update">✦ New AI version installed. Reliability needs checking.</div>' : ""}<div class="boxes">${g.boxes.map((b, i) => `<button data-box="${i}" class="box ${b.open ? "opened" : ""}" ${disabled || b.open ? "disabled" : ""} aria-label="${b.open ? (b.bad ? g.kind.wrong : g.kind.wish) : "Open box " + (i + 1) + " for 2 seconds"}"><span>${b.open ? (b.bad ? g.kind.bad : g.kind.good) : "🎁"}</span><small>${b.open ? (b.bad ? g.kind.wrong : "Matches wish") : "Open · 2s"}</small></button>`).join("")}</div><p class="evidence">${opened} of 6 boxes revealed${opened < 6 ? " · The rest are still unknown." : "."}</p><p class="message" role="status">${paused ? "Paused. Take a breath; midnight can wait." : g.message}</p><div class="actions"><button class="primary" data-action="ship" ${disabled ? "disabled" : ""}>Ship this load · 3s</button><button data-action="hold" ${disabled ? "disabled" : ""}>Hold & remake · 10s</button>${g.update ? `<button class="reset" data-action="reset" ${disabled ? "disabled" : ""}>Roll back AI · 8s</button>` : ""}</div><p class="hint">${g.busy ? `Working… ${Math.ceil(g.busy)}s` : "Open another box, or make your call."}</p></section>`;
}
app.addEventListener("click", (e) => {
  const button = e.target.closest("button");
  if (!button || button.disabled) return;
  if (button.dataset.action === "start") {
    workshop = new BoxWorkshop(seed);
    paused = false;
  } else if (!paused && workshop) {
    if (button.dataset.box !== undefined)
      workshop.open(Number(button.dataset.box));
    else workshop.act(button.dataset.action);
  }
  render();
});
pause.onclick = () => {
  paused = !paused;
  render();
};
document.addEventListener("visibilitychange", () => {
  if (document.hidden && workshop && !workshop.done) {
    paused = true;
    render();
  }
});
let last = performance.now();
setInterval(() => {
  const now = performance.now();
  if (workshop && !workshop.done && !paused) {
    const before = [
      workshop.phase,
      workshop.round,
      workshop.done,
      workshop.busy > 0,
    ].join();
    workshop.tick(Math.min((now - last) / 1000, 0.5));
    const after = [
      workshop.phase,
      workshop.round,
      workshop.done,
      workshop.busy > 0,
    ].join();
    if (before !== after) render();
    else {
      app.querySelector(".clock").firstChild.textContent =
        `${Math.ceil(workshop.time)}s `;
      app.querySelector(".time i").style.width =
        `${(workshop.time / 90) * 100}%`;
      if (workshop.busy)
        app.querySelector(".hint").textContent =
          `Working… ${Math.ceil(workshop.busy)}s`;
    }
  }
  last = now;
}, 100);
render();
