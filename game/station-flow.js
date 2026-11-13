const StationFlow = (() => {
  const ns = "http://www.w3.org/2000/svg";
  const heaps = [
    {
      station: 0,
      queue: "letters",
      x: 88,
      y: 238,
      from: [168, 182],
      width: 28,
      height: 19,
    },
    {
      station: 1,
      queue: "orders",
      x: 0,
      y: 66,
      from: [0, 0],
      width: 28,
      height: 24,
    },
    {
      station: 2,
      queue: "check",
      x: 42,
      y: 210,
      from: [12, 148],
      width: 32,
      height: 27,
    },
    {
      station: 3,
      queue: "sleigh",
      x: 108,
      y: 235,
      from: [82, 174],
      width: 28,
      height: 24,
    },
    {
      station: 2,
      queue: "pass",
      small: true,
      x: 2,
      y: 60,
      from: [0, 0],
      width: 26,
      height: 23,
    },
    {
      station: 2,
      queue: "rework",
      small: true,
      x: 2,
      y: 60,
      from: [0, 0],
      width: 26,
      height: 23,
    },
  ];
  let previousTime = -1;
  const previous = new Map();
  const groups = new Map();
  const motion = new Set();

  function element(name, attrs) {
    const node = document.createElementNS(ns, name);
    for (const [key, value] of Object.entries(attrs))
      node.setAttribute(key, value);
    return node;
  }

  function prepare(heap) {
    const { station, queue } = heap;
    let svg = document.querySelector(
      station === 3
        ? "#sleigh .sleigh-art > svg"
        : `#station${station} .machine > svg`,
    );
    if (!svg) return null;
    if (groups.has(queue)) return groups.get(queue);
    if (station === 0) {
      for (const letter of svg.querySelectorAll('use[href="#env"]'))
        letter.remove();
    }
    if (queue === "check") {
      svg.closest(".paper-scene").append(document.getElementById("feedback2"));
      for (const parcel of svg.querySelectorAll('use[href^="#parcel-"]'))
        parcel.remove();
      // The mock's chimney parcel is a prop, not a gift in the checking queue.
      const benchProps = [...svg.children].find((node) =>
        node.querySelector('text[transform="rotate(-18 238 175)"]'),
      );
      benchProps?.remove();
    }
    if (station === 1) {
      svg = element("svg", {
        viewBox: "0 0 120 68",
        class: "orders-heap",
        preserveAspectRatio: "xMidYMax meet",
        "aria-hidden": "true",
      });
      document.querySelector("#queue-orders .queue-picture").append(svg);
    }
    if (heap.small) {
      const queueButton = document.getElementById(`queue-${queue}`);
      const label = document.createElement("span");
      label.className = "flow-queue-label";
      label.append(...queueButton.childNodes);
      queueButton.append(label);
      svg = element("svg", {
        viewBox: "0 0 120 62",
        class: "flow-small-heap",
        preserveAspectRatio: "xMidYMax meet",
        "aria-hidden": "true",
      });
      document.getElementById(`queue-${queue}`).append(svg);
    }
    const pile = element("g", {
      class: "live-heap",
      "data-queue": queue,
      "aria-hidden": "true",
    });
    if (station === 3) {
      for (const parcel of svg.querySelectorAll('use[href^="#parcel-"]'))
        parcel.remove();
      svg.querySelector('path[d^="M104 230"]')?.remove();
      svg.querySelector('path[d^="M120 186"]')?.remove();
      const front = svg.querySelector('path[d^="M96 230"]');
      front.parentNode.insertBefore(pile, front);
    } else svg.append(pile);
    groups.set(queue, pile);
    return pile;
  }

  function update(view, running) {
    if (document.body.dataset.look !== "paper") return;
    const reset = view.t < previousTime;
    const reduced = document.body.classList.contains("reduce-motion");
    if (reset || reduced || !running) stop();
    if (reset) previous.clear();
    for (const heap of heaps) {
      const { station } = heap;
      const pile = prepare(heap);
      const parcels =
        station === 3 ? view.sleigh.parcels : view.queues[heap.queue]?.parcels;
      if (!pile || !parcels) continue;
      const old = previous.get(heap.queue);
      const ids = new Set(parcels.map((parcel) => parcel.id));
      const signature = parcels
        .slice(-18)
        .map((p) => `${p.id}:${p.big}:${p.suspect}`)
        .join();
      if (pile.dataset.signature === signature) continue;
      pile.dataset.signature = signature;
      for (const animation of motion) {
        if (animation.flowQueue === heap.queue) {
          animation.cancel();
          motion.delete(animation);
        }
      }
      pile.replaceChildren();

      for (const [index, parcel] of parcels.slice(-18).entries()) {
        const row = Math.floor(index / 5);
        const x = heap.x + (index % 5) * 22 + (row % 2) * 5;
        const size = parcel.big && station !== 0 ? 1.18 : 1;
        const y =
          heap.y -
          heap.height * size -
          row * (station === 0 ? 5 : heap.small ? 9 : 12);
        const wrap = element("g", { class: "heap-item" });
        const symbol =
          station === 0
            ? "env"
            : parcel.big
              ? "parcel-k"
              : index % 2
                ? "parcel-g"
                : "parcel-r";
        const item = element("use", {
          href: `#${symbol}`,
          x,
          y,
          width: heap.width * size,
          height: heap.height * size,
          transform: `rotate(${index % 2 ? 7 : -6} ${x + heap.width / 2} ${y + heap.height / 2})`,
        });
        wrap.append(item);
        if (parcel.suspect)
          wrap.append(
            element("circle", {
              cx: x + heap.width - 2,
              cy: y + 3,
              r: 4,
              fill: parcel.suspect === "batch" ? "#a3263a" : "#d2a447",
              stroke: "#f4ead3",
              "stroke-width": 1.5,
            }),
          );
        pile.append(wrap);
        if (
          old &&
          !old.has(parcel.id) &&
          !reduced &&
          running &&
          [...motion].filter((animation) => animation.flowStation === station)
            .length < 3 &&
          view.t > previousTime
        ) {
          const animation = wrap.animate(
            [
              {
                transform: `translate(${heap.from[0] - x}px, ${heap.from[1] - y}px)`,
                opacity: 0,
              },
              { opacity: 1, offset: 0.12 },
              { transform: "translate(0px, 0px)", opacity: 1 },
            ],
            {
              duration: 460,
              easing: "cubic-bezier(.3,0,.7,1)",
              fill: "backwards",
            },
          );
          animation.flowStation = station;
          animation.flowQueue = heap.queue;
          motion.add(animation);
          animation.finished.then(
            () => motion.delete(animation),
            () => motion.delete(animation),
          );
        }
      }
      previous.set(heap.queue, ids);
    }
    placeCheckingHeaps();
    previousTime = view.t;
  }
  function placeCheckingHeaps() {
    const scene = document.querySelector("#station2 .paper-scene");
    const art = scene.querySelector(".machine > svg");
    const rect = scene.getBoundingClientRect();
    const bench =
      new DOMPoint(0, 212).matrixTransform(art.getScreenCTM()).y - rect.top;
    const floor = rect.height;
    const separateSurfaces = bench - 112 >= 32;
    for (const queue of ["pass", "rework"]) {
      const svg = groups.get(queue)?.ownerSVGElement;
      if (!svg) continue;
      const surface = queue === "pass" && separateSurfaces ? bench : floor;
      const height = Math.max(0, Math.min(58, surface - 112));
      svg.style.top = `${surface - height - 8 - (queue === "rework" ? 52 : 0)}px`;
      svg.style.right = `${!separateSurfaces && queue === "pass" ? 60 : 0}px`;
      svg.style.width = `${separateSurfaces ? 112 : 52}px`;
      svg.style.height = `${height}px`;
    }
  }
  function stop() {
    for (const animation of motion) animation.cancel();
    motion.clear();
  }
  window.addEventListener("resize", () => {
    if (groups.has("check")) placeCheckingHeaps();
  });
  return { update, stop };
})();
