class Workshop {
  constructor() {
    this.duration = 240;
    this.target = 155;
    this.t = 0;
    this.seed = 251226;
    this.q = [[], [], []];
    this.work = [0, 0, 0];
    this.elves = [
      "Pip",
      "Holly",
      "Jingle",
      "Noel",
      "Ivy",
      "Fig",
      "Tinsel",
      "Coco",
    ].map((name, i) => ({
      name,
      s: i < 3 ? 0 : i < 6 ? 1 : 2,
      f: 8,
      idle: 0,
      rest: 0,
      reason: "",
      ready: false,
    }));
    this.mode = [1, 1];
    this.policy = 1;
    this.ask = true;
    this.budget = 1050;
    this.morale = 85;
    this.loaded = [];
    this.rework = [];
    this.id = 0;
    this.inflow = 0;
    this.caught = 0;
    this.checked = 0;
    this.fault = false;
    this.patched = false;
    this.patch = 0;
    this.trained = false;
    this.stop = false;
    this.hold = false;
    this.metered = false;
    this.jam = [0, 0, 0];
    this.limits = [24, 20, 18];
    this.overflow = [0, 0, 0];
    this.strike = 0;
    this.notice = 0;
    this.deal = 0;
    this.dealCooldown = 0;
    this.batchClock = 0;
    this.unionWarned = false;
    this.events = [];
    this.log = [];
    this.end = null;
    this.avgFatigue = 0;
    this.burnouts = 0;
    this.idleBreaks = 0;
    this.inspections = 0;
    this.practice = false;
    this.timmy = null;
    this.activeJob = null;
    this.emit("Santa has handed you the keys. Keep the workshop moving.");
    for (let i = 0; i < 6; i++) this.arrive();
  }
  rng() {
    this.seed = (Math.imul(1664525, this.seed) + 1013904223) >>> 0;
    return this.seed / 4294967296;
  }
  emit(text) {
    this.log.unshift({ t: this.t, text });
    this.log = this.log.slice(0, 6);
  }
  arrive(timmy = false) {
    this.q[0].push({
      id: ++this.id,
      amb: timmy || this.rng() < 0.27,
      timmy,
      wrong: false,
      batch: false,
      clue: false,
      read: this.rng(),
      make: this.rng(),
      check: this.rng(),
      sample: this.rng(),
      type: Math.floor(this.rng() * 3),
    });
  }
  staff(s) {
    return this.elves.filter((e) => e.s === s);
  }
  power(s) {
    return (
      this.staff(s).reduce((v, e) => v + 1 - e.f * 0.005, 0) *
      (this.strike > 0 || this.deal > 0 ? 0 : this.morale < 45 ? 0.65 : 1)
    );
  }
  cap(s) {
    const p = this.power(s);
    if (this.strike > 0 || this.deal > 0) return 0;
    if (s === 2) return p * 0.75;
    const m = this.mode[s];
    return m === 0
      ? p * 0.31
      : m === 1
        ? p
          ? p * 0.4 + 0.12
          : 0
        : 1.8 + p * 0.16;
  }
  fatigue() {
    return this.elves.reduce((a, e) => a + e.f, 0) / 8;
  }
  suspect() {
    return this.loaded.filter((x) => x.batch).length;
  }
  spend(n) {
    if (this.budget < n) return false;
    this.budget -= n;
    return true;
  }
  move(i, s) {
    const e = this.elves[i];
    if (this.end || !e || s < 0 || s > 3) return false;
    if (e.s === s) return false;
    if (s !== 3 && e.reason === "burnout" && (e.rest > 0 || e.f > 35))
      return false;
    if (s !== 3 && e.rest > 0) {
      this.morale = Math.max(0, this.morale - 5);
      this.emit(`${e.name}'s break was cut short. Morale −5.`);
    }
    e.s = s;
    e.idle = 0;
    e.ready = false;
    e.reason = s === 3 ? "break" : "";
    e.rest = s === 3 ? 8 : 0;
    return true;
  }
  action(name) {
    if (this.end) return false;
    switch (name) {
      case "stop":
        this.stop = !this.stop;
        this.emit(
          this.stop
            ? "Emergency stop. Toys stop moving; letters still arrive."
            : "Production restarted.",
        );
        return true;
      case "hold":
        this.hold = !this.hold;
        this.emit(
          this.hold
            ? "Dispatch held. Checking continues, but parcels cannot leave."
            : "Dispatch released.",
        );
        return true;
      case "intake":
        this.metered = !this.metered;
        this.emit(
          this.metered
            ? "Letter intake throttled. Fewer wishes arrive; fewer gifts can be delivered."
            : "Letter intake back to full speed.",
        );
        return true;
      case "patch":
        if (this.patch || this.patched || !this.fault || !this.spend(65))
          return false;
        this.patch = 8;
        this.emit(
          "Rolling back the AI update. Eight-second production stop. Existing batches still need checking.",
        );
        return true;
      case "training":
        if (this.trained || !this.spend(70)) return false;
        this.trained = true;
        this.emit(
          "Reviewers trained. “The robot said so” is no longer a defence.",
        );
        return true;
      case "quarantine": {
        const batch = this.q[2].filter((x) => x.batch && !x.clean);
        if (!batch.length || !this.spend(15)) return false;
        this.q[2] = this.q[2].filter((x) => !batch.includes(x));
        batch.forEach((x) => {
          x.review = true;
          delete x.done;
        });
        this.rework.push(...batch);
        this.emit(
          `${batch.length} suspect gifts quarantined. Checkers will rework them before new parcels.`,
        );
        return true;
      }
      case "recall": {
        const batch = this.loaded.filter((x) => x.batch);
        if (!batch.length || !this.spend(40)) return false;
        this.loaded = this.loaded.filter((x) => !x.batch);
        batch.forEach((x) => {
          x.review = true;
          delete x.done;
        });
        this.rework.push(...batch);
        this.emit(
          `${batch.length} suspect gifts recalled from the sleigh. The loading score falls while they are repaired.`,
        );
        return true;
      }
      case "deal":
        if (this.dealCooldown > 0 || !this.spend(90)) return false;
        this.deal = 7;
        this.dealCooldown = 40;
        this.strike = 0;
        this.notice = 0;
        this.morale = Math.min(100, this.morale + 30);
        this.elves.forEach((e) => (e.f = Math.max(0, e.f - 20)));
        this.emit(
          "Agreement reached. Seven seconds for paid cocoa, then back to work. Morale +30.",
        );
        return true;
      case "storage": {
        const s = this.q
          .map((q, i) => q.length / this.limits[i])
          .indexOf(
            Math.max(...this.q.map((q, i) => q.length / this.limits[i])),
          );
        if (this.limits[s] >= 36 || !this.spend(85)) return false;
        this.limits[s] += 8;
        this.jam[s] = 0;
        this.overflow[s] = 0;
        this.emit(
          `Temporary storage added at ${["wish lists", "toy-making", "dispatch"][s]}. Eight extra spaces.`,
        );
        return true;
      }
      default:
        return false;
    }
  }
  resolveTimmy(choice) {
    if (!this.timmy || this.timmy.done || this.end) return false;
    this.timmy.done = true;
    const x = this.q.flat().find((x) => x.timmy);
    if (x) {
      x.read = choice === "little" ? 1 : 0;
      x.wrong = choice !== "little";
      x.amb = false;
      x.resolved = true;
    }
    this.emit(
      choice === "little"
        ? "Timmy wants a model train. A careful question saves a very large mistake."
        : "A full-sized locomotive? Bold interpretation. Timmy’s parents may disagree.",
    );
    return true;
  }
  inspect(id, choice) {
    const x = this.q[2].find((x) => x.id === id);
    if (!x || this.end) return false;
    if (choice === "release") {
      x.review = false;
      x.done = true;
      x.clue = false;
      this.emit("Parcel released without another check.");
      return true;
    }
    if (choice === "quarantine") {
      this.q[2] = this.q[2].filter((y) => y.id !== id);
      delete x.done;
      x.review = true;
      this.rework.push(x);
      this.emit("Parcel sent to the rework bench.");
      return true;
    }
    if (choice === "inspect") {
      if (this.activeJob || !this.staff(2).length || !this.spend(8))
        return false;
      this.activeJob = { id, remaining: 3 };
      this.q[2] = this.q[2].filter((y) => y.id !== id);
      this.activeJob.item = x;
      this.emit(
        "Checker assigned for three seconds. Other dispatch work slows.",
      );
      return true;
    }
    return false;
  }
  fail(kind, title, why, tip) {
    this.end = { kind, title, why, tip };
    this.emit(title);
  }
  step(dt) {
    if (this.end) return;
    this.t = Math.min(this.duration, this.t + dt);
    this.dealCooldown = Math.max(0, this.dealCooldown - dt);
    if (this.deal > 0) this.deal = Math.max(0, this.deal - dt);
    if (this.patch > 0) {
      this.patch = Math.max(0, Math.round((this.patch - dt) * 1000) / 1000);
      if (!this.patch) {
        this.fault = false;
        this.patched = true;
        this.emit(
          "AI rollback complete. New toys are safer; suspect gifts already made still need rework.",
        );
      }
    }
    const event = (time, id, fn) => {
      if (this.t >= time && !this.events.includes(id)) {
        this.events.push(id);
        fn();
      }
    };
    event(28, "timmy", () => {
      this.arrive(true);
      this.timmy = { done: false, until: this.t + 18 };
      this.emit(
        "Timmy’s urgent letter! “A little train”. Clarify it before the AI guesses.",
      );
    });
    event(62, "update", () => {
      this.fault = true;
      this.patched = false;
      this.emit(
        "Bad AI update! Automated toy lines may now produce full-sized trains. Roll back and contain the batch.",
      );
    });
    event(104, "rush", () =>
      this.emit(
        "Last-minute letter rush. Intake doubles for 40 seconds. Watch the queues.",
      ),
    );
    event(154, "union", () => {
      this.morale = Math.max(0, this.morale - 14);
      this.emit(
        "The elves want predictable breaks. Morale falls as the Christmas shift drags on.",
      );
    });
    event(211, "close", () =>
      this.emit("The post is closed. Clear the benches before Santa leaves."),
    );
    if (this.timmy && !this.timmy.done && this.t >= this.timmy.until) {
      this.timmy.done = true;
      this.emit(
        "Timmy’s letter goes back into the queue. Your wish-list settings now decide its fate.",
      );
    }
    if (this.t < 211) {
      this.inflow +=
        dt *
        (this.t >= 104 && this.t < 144 ? 1.65 : 0.88) *
        (this.metered ? 0.42 : 1);
      while (this.inflow >= 1) {
        this.arrive();
        this.inflow--;
      }
    }
    // Continuous fatigue plus pressure. Idle breaks are staggered so a whole team cannot vanish together.
    const busy = this.q.map(
      (q, s) =>
        q.length > 0 || (s === 2 && (this.rework.length > 0 || this.activeJob)),
    );
    for (const e of this.elves) {
      if (e.s === 3) {
        e.f = Math.max(0, e.f - dt * 1.9);
        e.rest = Math.max(0, e.rest - dt);
        if (!e.ready && e.rest === 0 && e.f <= 35) {
          e.ready = true;
          this.emit(`${e.name} is refreshed and ready to recall.`);
        }
        continue;
      }
      if (this.deal > 0 || this.strike > 0) {
        e.f = Math.max(0, e.f - dt * 0.6);
        continue;
      }
      const s = e.s,
        pressure = this.q[s].length / this.limits[s],
        working = busy[s] && !(s === 1 && (this.stop || this.patch));
      e.f = Math.max(
        0,
        Math.min(
          100,
          e.f +
            dt *
              (working
                ? 0.24 +
                  Math.max(0, pressure - 0.25) * 0.75 +
                  (s === 2 && this.rework.length ? 0.18 : 0)
                : -0.12),
        ),
      );
      e.idle = working ? Math.max(0, e.idle - dt * 0.6) : e.idle + dt;
      if (e.f >= 88) {
        e.s = 3;
        e.reason = "burnout";
        e.rest = 20;
        e.idle = 0;
        e.ready = false;
        this.burnouts++;
        this.morale = Math.max(0, this.morale - 13);
        this.emit(
          `${e.name} has burnt out and walked off for cocoa. Recovery is compulsory. Morale −13.`,
        );
      } else if (e.idle > 20 && this.staff(s).length > 1) {
        e.s = 3;
        e.reason = "idle";
        e.rest = 0;
        e.ready = true;
        e.idle = 0;
        this.idleBreaks++;
        this.staff(s).forEach((other) => (other.idle = 0));
        this.emit(
          `${e.name} is underused and has wandered off for cocoa. Recall when needed.`,
        );
      }
    }
    const over = this.elves.filter((e) => e.s !== 3 && e.f > 65).length,
      rest = this.staff(3).length,
      peak = Math.max(...this.q.map((q, i) => q.length / this.limits[i]));
    this.morale = Math.max(
      0,
      Math.min(
        100,
        this.morale +
          dt * (rest * 0.055 + 0.015 - over * 0.15 - (peak > 0.8 ? 0.13 : 0)),
      ),
    );
    if (this.morale < 45 && !this.unionWarned) {
      this.unionWarned = true;
      this.emit(
        "Work to rule. Morale below 45: elves slow to 65% capacity. A strike is brewing.",
      );
    }
    if (this.morale >= 50) this.unionWarned = false;
    if (!this.strike && !this.deal) {
      this.notice =
        this.morale < 35 ? this.notice + dt : Math.max(0, this.notice - dt * 2);
      if (this.notice >= 12) {
        this.strike = 22;
        this.emit(
          "STRIKE! “More cocoa, less chaos!” Agree a deal within 22 seconds or Christmas is cancelled.",
        );
      }
    } else if (this.strike) {
      this.strike = Math.max(0, this.strike - dt);
      if (this.strike === 0) {
        this.fail(
          "strike",
          "No elves, no Christmas",
          "The workforce walked out and the dispute was not resolved.",
          "Rotate tired elves before burnout. A paid cocoa agreement can stop an active strike.",
        );
        return;
      }
    }
    this.avgFatigue += this.fatigue() * dt;
    this.budget -=
      dt *
      (this.elves.filter((e) => e.s !== 3).length * 0.15 +
        rest * 0.08 +
        this.mode.reduce((a, m) => a + [0, 0.22, 0.72][m], 0));
    // An inspection occupies one checker and uses simulation time, even if the player clicks while paused.
    if (this.activeJob && this.staff(2).length && this.power(2) > 0) {
      this.activeJob.remaining -= dt;
      if (this.activeJob.remaining <= 0) {
        const x = this.activeJob.item;
        this.checked++;
        this.inspections++;
        if (x.wrong) {
          this.caught++;
          this.budget -= 2;
          this.emit(
            `Inspection caught a wrong present in parcel ${x.id}. Repaired.`,
          );
        } else
          this.emit(
            `Parcel ${x.id} checked. It was fine; inspection still cost time.`,
          );
        x.wrong = false;
        x.batch = false;
        x.clue = false;
        x.clean = true;
        x.done = true;
        this.q[2].unshift(x);
        this.activeJob = null;
      }
    }
    for (let s = 0; s < 3; s++) {
      if (this.jam[s] > 0) {
        this.jam[s] = Math.max(0, this.jam[s] - dt);
        continue;
      }
      if (s === 1 && (this.stop || this.patch > 0)) continue;
      let cap = this.cap(s);
      if (s === 2 && this.activeJob) cap = Math.max(0, cap - 0.75);
      const repairing = s === 2 && this.rework.length > 0;
      const q = repairing ? this.rework : this.q[s];
      if (!q.length) {
        this.work[s] = 0;
        continue;
      }
      this.work[s] += cap * dt;
      let guard = 0;
      while (q.length && guard++ < 20) {
        const x = q[0];
        if (s === 0 && x.timmy && this.timmy && !this.timmy.done) break;
        if (s === 2 && x.review === undefined)
          x.review =
            repairing ||
            this.policy === 2 ||
            (this.policy === 1
              ? x.amb || x.clue || x.sample < 0.18
              : x.sample < 0.07);
        const cost =
          s === 2
            ? x.done
              ? 0.1
              : repairing
                ? 2
                : x.review
                  ? 2.2
                  : 0.12
            : s === 0 && x.amb && this.ask
              ? 1.6
              : 1;
        if (s === 0 && x.amb && this.ask && !this.staff(0).length) break;
        if (s === 2 && x.review && !this.staff(2).length) break;
        if (this.work[s] < cost) break;
        if (s === 2 && this.hold && x.done && !repairing) break;
        this.work[s] -= cost;
        if (s === 2 && !x.done) {
          if (x.review) {
            this.checked++;
            const mean =
              this.staff(2).reduce((a, e) => a + e.f, 0) /
              Math.max(1, this.staff(2).length);
            const chance = repairing
              ? 1
              : Math.max(
                  0.35,
                  (this.trained ? 0.98 : 0.87) -
                    mean * 0.004 -
                    (this.t > 130 && !this.trained ? 0.12 : 0),
                );
            if (x.check < chance) {
              if (x.wrong) {
                this.caught++;
                this.budget -= 2;
              }
              x.wrong = false;
              x.batch = false;
              x.clean = true;
            }
          }
          x.done = true;
          if (this.hold && !repairing) break;
        }
        q.shift();
        if (s === 0) {
          if (!x.resolved) {
            let risk =
              [0.025, 0.065, 0.16][this.mode[0]] +
              (x.amb ? [0.04, 0.13, 0.35][this.mode[0]] : 0);
            if (x.amb && this.ask) risk *= 0.18;
            x.wrong = x.read < risk;
          }
          this.q[1].push(x);
        } else if (s === 1) {
          x.batch = this.fault && this.mode[1] > 0;
          x.wrong =
            x.wrong ||
            x.make < [0.025, 0.06, 0.12][this.mode[1]] + (x.batch ? 0.65 : 0);
          x.clue = x.batch || x.make < 0.15;
          this.q[2].push(x);
        } else if (repairing) {
          x.batch = false;
          x.wrong = false;
          x.clean = true;
          this.q[2].push(x);
        } else this.loaded.push(x);
      }
      this.work[s] = Math.min(3, this.work[s]);
    }
    // Full queues first jam, then accumulate a visible 16-second collapse countdown. Drain to 80% to reset.
    for (let s = 0; s < 3; s++) {
      const q = this.q[s].length,
        lim = this.limits[s];
      if (q >= lim) {
        if (this.overflow[s] === 0) {
          this.jam[s] = 3;
          this.emit(
            `${["Letter mountain", "Toy backlog", "Dispatch pile-up"][s]}! A jam stops this station for 3s. Drain below ${Math.floor(lim * 0.8)} to reset the collapse countdown.`,
          );
        }
        this.overflow[s] += dt;
      } else if (q < lim * 0.8) this.overflow[s] = 0;
      else if (this.overflow[s] > 0) this.overflow[s] += dt;
      if (this.overflow[s] >= 16) {
        this.fail(
          "queue",
          "The Great Parcel Avalanche",
          `${["Wish lists", "Toy orders", "Dispatch parcels"][s]} filled the available space and the backlog was not cleared in time.`,
          `Keep ${["wish lists", "production", "dispatch"][s]} moving. Throttle letters, rebalance elves or buy emergency storage before the countdown expires.`,
        );
        return;
      }
    }
    if (this.suspect() >= 12) {
      if (this.batchClock === 0)
        this.emit(
          "Sleigh overload! At least 12 suspect train parcels aboard. Recall the batch within 18s.",
        );
      this.batchClock += dt;
    } else this.batchClock = 0;
    if (this.batchClock >= 18) {
      this.fail(
        "batch",
        "The Locomotive Incident",
        "A suspect batch overloaded the sleigh. Santa has filed an unusually long expenses claim.",
        "Roll back the AI update, quarantine suspect parcels, and recall anything already loaded.",
      );
      return;
    }
    if (this.t >= this.duration) this.end = { kind: "complete" };
  }
  snapshot() {
    return JSON.parse(JSON.stringify(this));
  }
  static restore(data) {
    const g = new Workshop();
    Object.assign(g, JSON.parse(JSON.stringify(data)));
    return g;
  }
}
