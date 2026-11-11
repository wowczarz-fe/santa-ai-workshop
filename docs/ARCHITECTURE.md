# Architecture

Agreed between santa-claude and santa-codex on 2026-11-11 for the simplified game
(`docs/adr/0002-simplify-the-original-game-in-place.md`). It describes the boundary between the two
scripts in `game/`.

## Two scripts

- `workshop.js` is the rules. `class Workshop` holds the state of one run and advances it over
  time. It never reads or changes the page, so it also runs in Node for scripted balance checks.
- `game.js` is the page. It calls `step` on a timer, draws what `view()` returns, and turns clicks
  and taps into the calls below. It holds no rules and no numbers of its own: the run length and
  the target come from the `Workshop`.

## What the page calls

```
new Workshop({ seed, guided })   // guided true: controls unlock during the run; false: all unlocked

step(dt)                   // advance the run by dt seconds
view()                     // everything the page may draw, as plain data
move(elf, station)         // elf is an index; station 0 read letters, 1 make toys, 2 check and dispatch, 3 cocoa break
setAi(station, level)      // station 0 or 1; level 0 by hand, 1 assist, 2 automate
setChecking(level)         // 0 spot-check, 1 check the risky ones, 2 check everything
setAsk(on)                 // ask the child when a wish is unclear
inspect(parcelId)          // a checker opens one parcel waiting at dispatch
decide(parcelId, choice)   // "ship" or "remake", for the parcel the player opened
train()                    // train the checkers not to wave AI gifts through
rollback()                 // stop the faulty update reaching new toys
quarantine()               // send suspect parcels waiting at dispatch to rework
recall()                   // bring wrong gifts back off the sleigh for rework
```

Each action returns `true` when it took effect and `false` when it is locked or not possible.

## What `view()` returns

The page reads only `view()`. Whether an unopened parcel is wrong is left out of it, so the page
cannot show what the player has not found out.

| Field                     | Meaning                                                                                                                                                         |
| ------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `t`, `duration`, `target` | Seconds played, run length, right gifts needed                                                                                                                  |
| `hint`                    | `null` or `{ text, control }`: the one sentence of guidance and the control it points at                                                                        |
| `elves`                   | `[{ name, station, tired, resting }]`: station 0 to 3 (3 is the cocoa break), tiredness 0 to 100, `resting` while a break cannot be cut short                   |
| `ai`, `checking`, `ask`   | Current lever positions                                                                                                                                         |
| `levers`                  | `{ ai0, ai1, checking }`: for each lever, one entry per position with what it does at the current staffing; see below                                           |
| `stations`                | Three of `{ waiting, limit, staff, rate, progress, blocked }`; see below                                                                                        |
| `rework`                  | How many parcels are waiting to be remade at dispatch                                                                                                           |
| `dispatchHeld`            | `true` while dispatch waits for quarantined parcels                                                                                                             |
| `inspection`              | `null` or `{ parcel, remaining, duration, ready }`: the parcel the player opened; `ready` when it awaits a decision                                             |
| `sleigh`                  | `{ right, wrong, parcels }`: live counts and the parcels aboard, each with `result`                                                                             |
| `lost`                    | Letters lost to a full pile                                                                                                                                     |
| `budget`                  | `{ left, spent: { people, ai, checking, fixing } }`: money left and where it went so far                                                                        |
| `pace`                    | `{ projected, behind, slowest }`: right gifts expected at departure at the current pace, whether that is short of the target, and the station holding things up |
| `incident`                | `null` or `{ known, rollingBack, suspectWaiting }`; `rollingBack` is the seconds left                                                                           |
| `actions`                 | For each control: `{ unlocked, available, why, cost }`; see below                                                                                               |
| `news`                    | `[{ id, t, kind, text, ... }]`, newest first: what just happened, for animation and the status line                                                             |
| `end`                     | `null` or `{ right, wrong, lost, rating, costs, lesson: { title, text } }`; `costs` is `{ people, ai, checking, fixing, mistakes, prevented, total, budget }`   |

- A station's `waiting` is its parcels in order, `limit` how many it holds, `staff` how many elves
  are working there, `rate` parcels a second at the current settings, `progress` 0 to 1 towards the
  next parcel, and `blocked` is `true` when the next station is full.
- `levers.ai0` and `levers.ai1` each hold three entries `{ name, perMinute, wrongPer100, costPerMinute }`.
  `levers.checking` holds three entries `{ name, checkedPer100, perMinute }`, where `perMinute` is
  what dispatch can pass at that setting. The page shows these on the levers.
- `end.costs.mistakes` is what the delivered wrong gifts cost and `end.costs.prevented` is what the
  mistakes that checking caught would have cost.
- A parcel is `{ id, wish, big, wanted, made, suspect, result }`. `id` never changes. `big` marks a
  gift whose mistake costs several times as much. `wish` is the
  child's words. `suspect` is the warning mark: `false`, `"unsure"` (the AI was not sure) or `"batch"` (made during the faulty update, once the update is known). `wanted` and `made` are `{ name, icon }` and `result`
  is `"right"` or `"wrong"`; all three are `null` until they are revealed, because the wanted toy
  next to the made toy gives the answer away. The page draws a sealed gift until then.
  - A check by an elf, or loading onto the sleigh, reveals all three at once.
  - The parcel the player opened shows `made` once `inspection.ready` is `true`, with `wanted` and
    `result` still `null`: the player judges the toy against the wish. `decide` reveals the rest.
- `actions` has a key for each of `ai0`, `ai1`, `checking`, `ask`, `inspect`, `rollback`,
  `train`, `quarantine` and `recall`. `unlocked` says whether the guided run has introduced the control,
  `available` whether it can be used now, `why` is one short phrase when it cannot, and `cost` is
  what using it costs in time and money in the player's words, such as "stops the toy line for 8
  seconds, costs 65".

## News

Every item has `id`, `t`, `kind` and `text`. Some carry more:

| Kind          | Extra fields                                             | When                                               |
| ------------- | -------------------------------------------------------- | -------------------------------------------------- |
| `unlock`      | `control`                                                | The guided run introduces a control                |
| `checked`     | `check: { wish, wanted, made, result, seconds, by }`     | A checker or the player finished checking a parcel |
| `loaded`      | `check: { wish, wanted, made, result }`, only when wrong | A wrong gift landed on the sleigh                  |
| `timmy`       |                                                          | Timmy's letter arrives                             |
| `update`      |                                                          | The faulty AI update lands                         |
| `rolledBack`  |                                                          | The rollback finished                              |
| `quarantined` | `count`                                                  | Suspect parcels went to rework                     |
| `recalled`    | `count`                                                  | Wrong gifts came off the sleigh                    |
| `rush`        |                                                          | The last-minute letter rush starts                 |
| `behind`      | `station`                                                | The pace first falls short of the target           |
| `overtrust`   |                                                          | Checkers start waving AI gifts through             |
| `trained`     |                                                          | The checkers finished training                     |
| `tired`       | `elf`                                                    | An elf went for a cocoa break                      |
| `broke`       |                                                          | The money ran out; paid actions stop               |
| `blocked`     | `station`                                                | A station stopped because the next one is full     |
| `lost`        | `count`                                                  | Letters were lost to a full pile                   |

A `check` is a copy taken when the check finished, so it still shows the toy as the AI made it after
the parcel has been remade or moved. `by` is `"elf"` or `"player"`.

## Behaviour the page relies on

- `end.rating` is 1, 2 or 3. 3 needs the target met, at most 10 percent of the gifts aboard wrong,
  and the total cost within budget. 2 needs 80 percent of the target and at most 20 percent wrong.
- `quarantine` takes the `"batch"` parcels waiting at dispatch and is available once the update is
  known. Parcels marked `"unsure"` stay where they are.
- `recall` unlocks at the first wrong gift aboard after the update lands.
- The player's own check sends its `checked` news item when `decide` is called, not when the parcel
  is ready, because the item carries the result.
- `budget.left` can go below zero. Wages, AI and the elves' checks keep costing; the one-off actions
  (inspect, train, rollback, quarantine, recall) stop until there is money.
- A `tired` news item means an elf burnt out. A burnt-out elf comes back to its station by itself;
  sending an elf for cocoa earlier is quicker.
- Work waiting to be remade takes turns with new parcels at dispatch, and takes over completely
  while quarantined parcels hold dispatch.
- `pace.projected` is smoothed over about fifteen seconds.
