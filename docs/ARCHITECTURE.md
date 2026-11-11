# Architecture

Agreed between santa-claude and santa-codex on 2026-11-11. It describes the boundary between the
two scripts in `game/`. The decisions behind it are in
`docs/adr/0002-simplify-the-original-game-in-place.md` and
`docs/adr/0003-make-assurance-the-work-the-player-does.md`.

## Two scripts

- `workshop.js` is the rules. `class Workshop` holds the state of one run and advances it over
  time. It never reads or changes the page, so it also runs in Node for scripted balance checks.
- `game.js` is the page. It calls `step` on a timer, draws what `view()` returns, and turns clicks
  and taps into the calls below. It holds no rules and no numbers. It owns the fixed labels of the interface:
  button names, headings, units, the rows of the cost account, the version picker and the opening
  card. Everything that depends on the run comes from the rules: guidance, evidence, where mistakes
  come from, what a control does and costs, outcomes, the lesson and the version descriptions.

## What the page calls

```
new Workshop({ seed, guided, version })
    // guided true: controls unlock during the run, with tutorial moments; false: all unlocked
    // version "piles", "cases" or "calm"; see Versions

step(dt)                          // advance the run by dt seconds
view()                            // everything the page may draw, as plain data
move(elf, station)                // 0 read letters, 1 make toys, 2 check and dispatch, 3 cocoa break
setAi(station, level)             // station 0 or 1; level 0 by hand, 1 assist, 2 automate
setAsk(on)                        // unclear letters wait for an elf to ask the child
setChecking(level)                // which parcels go to the checking pile: 0 a few, 1 the risky ones, 2 all
bypass()                          // let the parcels waiting for a check go through unchecked
train()                           // train the checkers
resolve(caseId, optionId)         // answer a case a checker brought to the player
acknowledge(momentId)             // close a tutorial moment without acting
skipGuidance()                    // unlock everything now and show no more tutorial moments
```

Each action returns `true` when it took effect and `false` when it is locked or not possible.

## What `view()` returns

The page reads only `view()`. Whether an unrevealed parcel is wrong is left out of it.

| Field                     | Meaning                                                                                 |
| ------------------------- | --------------------------------------------------------------------------------------- |
| `t`, `duration`, `target` | Seconds played, run length, right gifts needed                                          |
| `version`                 | `{ id, name, text }`: the version being played                                          |
| `moment`                  | `null` or a tutorial moment; the page stops its clock while one is open                 |
| `elves`                   | `[{ name, station, tired, resting, doing }]`                                            |
| `ai`, `ask`, `checking`   | Current lever positions                                                                 |
| `levers`                  | `{ ai0, ai1, checking }`: what each position does now                                   |
| `stations`                | Three of `{ staff, working, idle, queues, blocked }`                                    |
| `queues`                  | `{ letters, clarify, orders, check, pass, rework }`, each a queue                       |
| `bypassed`                | How many parcels the player has let through unchecked                                   |
| `vigilance`               | `{ state, cleanRun, secondsPerCheck, skipped, trained }`: how the checkers are checking |
| `case`                    | `null` or the case a checker has brought to the player                                  |
| `casesWaiting`            | How many more cases are waiting, 0 or 1                                                 |
| `sleigh`                  | `{ right, wrong, parcels }`: live counts and the parcels aboard, each with `result`     |
| `lost`                    | Letters lost to a full pile                                                             |
| `budget`                  | `{ left, spent: { people, ai, checking, fixing } }`                                     |
| `pace`                    | `{ projected, behind, slowest }`                                                        |
| `incident`                | `null` or `{ known, rollingBack, suspectWaiting }`                                      |
| `actions`                 | For each control: `{ unlocked, available, why, cost }`                                  |
| `news`                    | `[{ id, t, kind, text, ... }]`, newest first                                            |
| `end`                     | `null` or `{ right, wrong, lost, rating, costs, lesson: { title, text } }`              |

- An elf's `station` is 0 to 3, `tired` is 0 to 100, and `resting` is `true` while a break cannot be
  cut short. `doing` is a short phrase for what the elf is doing now, such as "reading letters",
  "asking a child", "confirming the AI's toys", "checking parcels", "watching the toy machine",
  "nothing to do" or "having cocoa".
- A station's `staff` is how many elves are there, `working` and `idle` split them, `queues` lists
  the ids of the queues it works on in the order to draw them, and `blocked` is `null` or a short
  reason such as "the toy pile is full".
- A queue is `{ id, name, parcels, limit, rate, progress, blocked }`. `rate` is parcels a minute at
  the current staffing and `progress` is 0 to 1 towards the next parcel. `blocked` is `null` or a
  short reason such as "nobody here to ask". Station 0 works `letters` and `clarify`; station 1
  works `orders`; station 2 works `check`, `pass` (parcels going straight through) and `rework`.
- `levers.ai0` and `levers.ai1` each hold three entries
  `{ name, who, speed, risk, perMinute, costPerMinute }`. The three text fields are written to be
  read at a glance, six words at most each: `who` says who does the work ("AI drafts, an elf
  confirms"), `speed` compares it with working by hand ("about twice as fast"), and `risk` says
  what to watch for now, from the current state ("guesses unclear wishes: 4 waiting").
  `levers.checking` holds three entries `{ name, sends, per100 }`: which parcels the elves check
  and how many in a hundred that is now.
- `vigilance.state` is `"careful"`, `"relaxing"` or `"waving through"`. `cleanRun` is how many
  clean AI-made parcels the checkers have seen in a row, `secondsPerCheck` what a check takes them
  now, `skipped` how many checks they have skipped, and `trained` whether training has been done.
- `pace.projected` is the right gifts expected at departure at the current pace, `behind` whether
  that is short of the target, and `slowest` the station holding things up.
- `actions` has a key for each of `ai0`, `ai1`, `ask`, `checking`, `bypass` and `train`. `unlocked` says whether the guided run has introduced the control,
  `available` whether it can be used now, `why` is one short phrase when it cannot, and `cost` is
  what using it costs in time, money and parcels covered, in the player's words.
- `end.costs` is `{ people, ai, checking, fixing, mistakes, prevented, total, budget }`. `mistakes`
  is what the delivered wrong gifts cost. `prevented` is an estimate of what the mistakes that
  checking caught would have cost; the page labels it as an estimate.

### Parcels

A parcel is `{ id, wish, big, unclear, wanted, made, suspect, result }`.

- `id` never changes. `wish` is the child's words. `big` marks a gift whose mistake costs several
  times as much. `unclear` marks a wish that needs a question back.
- `suspect` is `false`, `"unsure"` (the AI was not sure) or `"batch"` (made during the faulty
  update, once the update is known).
- `wanted` and `made` are `{ name, icon }` and `result` is `"right"` or `"wrong"`. All three are
  `null` until they are revealed, because the wanted toy next to the made toy gives the answer away.
  A check by an elf or loading onto the sleigh reveals all three at once.

### Cases

A case is `{ id, kind, step, text, facts, evidence, affected, options, resolving }`.

- `kind` is one of:
  - `"judge"`: an unsure checker asks the player to judge one toy against its wish.
  - `"unclear"`: an unclear wish for a big gift. The evidence shows the wish and how the AI reads
    it, so the player can accept that reading or have an elf ask the child.
  - `"pattern"`: the same wrong toy has turned up more than once.
  - `"update"`: a new AI update is offered for the toy machine, with what it promises. The player
    installs it now, tests it first (takes time while the old version keeps working) or skips it.
    Some updates are good and some are faulty. `step` is `"offered"`, or `"tested"` when the case
    comes back after a test with the finding added to `facts` and the options install or skip.
  - `"incident"`: a faulty update that was installed. It comes as up to three cases in turn, told apart by `step`:
    `"source"` (the toy machine is still making the wrong toy: roll the update back or keep it
    running), `"made"` (parcels made during the update are still in the workshop: remake them all,
    check each one, or let them go) and `"aboard"` (wrong gifts are already on the sleigh: bring
    them back or leave them). A step that does not apply is skipped. A `"source"` case the player
    answered with keep running comes back while the fault lasts.
- `step` is set on update and incident cases and is `null` on the others.
- `facts` is `[{ label, value }]`: the few figures the decision turns on, shown before the choice.
  For an update: what it promises, what is known about it, what a test costs and how far to trust a
  test. For an incident: how many parcels, how many of them big gifts, what stopping costs. For a
  judged parcel: what the gift is worth and why the checker was unsure.
- `evidence` is `[{ parcelId, wish, made, reading }]`: what the checker has seen. `made` is the toy,
  when there is one. `reading` is how the AI reads the wish, on unclear cases. It never includes
  `wanted` or `result`.
- `affected` is `{ count, ids }`: the parcels an option could cover.
- `options` is `[{ id, label, seconds, money, scope, available, why }]`. The options depend on the
  kind. `scope` is how many parcels that option covers, in words. `available` is `false` with a
  short `why` when the option cannot be chosen now, for example when no checker is free.
- `resolving` is `null` until the player answers, then `{ optionId, remaining, duration }` while the
  chosen option takes its time. The case stays open and takes no second answer until `remaining`
  reaches zero; then it closes with a `resolved` news item. An option that takes no time closes the
  case at once.
- The parcel in a `"judge"` case is held aside. Until the case is resolved it shows `wanted` and
  `result` as `null` everywhere in `view()`, and no news item or consequence gives its answer away.
- At most one case is open. Update and incident cases appear in every version and always get their
  turn; of
  the other kinds at most one waits, and they appear only in the versions that have them.
- No option wins whatever the situation. The better choice depends on what the case shows before
  the player chooses (the evidence, how sure it is, what is at stake) and on what the workshop can
  spare at that moment (elves, time, money). A player who reads the case can choose well; a player
  who always picks the same option cannot. The outcome is never a coin toss that only hindsight
  explains.
- An open case is never replaced and a held parcel stays held until its case is resolved. Waiting
  cases take their turn in this order: incident source, made, aboard, then update, then the other
  kinds. A source case answered with keep running comes back only after that incident's made and
  aboard cases have had their turn.
- Every option says what it costs. No option is free of consequence: keeping the update running,
  letting parcels go and leaving wrong gifts aboard all carry a cost that the `scope` text names.

### Tutorial moments

A moment is `{ id, control, title, text, parcelId, completes }`.

- `control` is the control or place it points at: an `actions` key, `"elves"`, `"cocoa"`, `"sleigh"`
  or `"case"`. `parcelId` is the example that triggered it, or `null`.
- `completes` lists the calls that close it, such as `["setAi"]`. `acknowledge(id)` always closes
  it. The rules do not advance while a moment is open only because the page stops calling `step`;
  the page never resumes a game the player paused by hand.
- A moment appears at the first real example of a decision in a guided run, once per decision.

## News

Every item has `id`, `t`, `kind` and `text`. Some carry more:

| Kind          | Extra fields                                                                     | When                                             |
| ------------- | -------------------------------------------------------------------------------- | ------------------------------------------------ |
| `unlock`      | `control`                                                                        | The guided run introduces a control              |
| `checked`     | `check: { wish, wanted, made, result, seconds, by }`                             | A checker finished checking a parcel             |
| `loaded`      | `check: { wish, wanted, made, result }`, only when wrong                         | A wrong gift landed on the sleigh                |
| `consequence` | `about`, `facts: { seconds, checked, caught, estimatedAvoided, waiting, money }` | An assurance decision reports what it did        |
| `case`        | `caseId`                                                                         | A checker brought a case to the player           |
| `resolved`    | `caseId`, `option`, `outcome`, `check` when one parcel was judged                | The player answered a case                       |
| `bypassed`    | `count`                                                                          | The player let waiting parcels through unchecked |
| `timmy`       |                                                                                  | Timmy's letter arrives                           |
| `update`      |                                                                                  | The faulty AI update lands                       |
| `noticed`     | `by`: `"watcher"`, `"checker"`, `"sleigh"` or `"case"`                           | The faulty update became known                   |
| `rolledBack`  |                                                                                  | The rollback finished                            |
| `quarantined` | `count`                                                                          | The suspect batch went to be remade              |
| `recalled`    | `count`                                                                          | Wrong gifts came off the sleigh                  |
| `rush`        |                                                                                  | The last-minute letter rush starts               |
| `relaxed`     |                                                                                  | The checkers started skipping checks             |
| `trained`     |                                                                                  | The checkers finished training                   |
| `tired`       | `elf`                                                                            | An elf burnt out                                 |
| `broke`       |                                                                                  | The money ran out; paid actions stop             |
| `blocked`     | `station`                                                                        | A station stopped because the next one is full   |
| `lost`        | `count`                                                                          | Letters were lost to a full pile                 |
| `behind`      | `station`                                                                        | The pace first falls short of the target         |

A `resolved` item's `text` says what the choice did, with the time, money and parcels involved, and
`outcome` is `{ seconds, money, parcels, gained }` with the figures that apply. Testing a good update,
for example, reports both the delay and the speed gained.

A `check` is a copy taken when the check finished, so it still shows the toy as the AI made it after
the parcel has been remade or moved. `by` is `"elf"` or `"player"`. A `consequence` leaves out the
facts that do not apply to it. `about` is the `actions` key or `"case"`.

## Versions

| `version` | What differs                                                               |
| --------- | -------------------------------------------------------------------------- |
| `"piles"` | Assurance as piles only. The only cases are update and incident cases.     |
| `"cases"` | Piles, plus cases.                                                         |
| `"calm"`  | As `"cases"`, with fewer letters arriving and the target lowered to match. |

The page offers the three on the opening card and passes the choice in. `?version=` in the address
preselects one.

## Behaviour the page relies on

- `end.rating` is 1, 2 or 3. 3 needs the target met, at most 10 percent of the gifts aboard wrong,
  and the total cost within budget. 2 needs 80 percent of the target and at most 20 percent wrong.
- When the checking pile is full the line waits; a full pile never lets parcels through by itself.
  Parcels miss a check in two ways, both visible: the player calls `bypass()`, counted in
  `bypassed`, or relaxed checkers wave a parcel through, counted in `vigilance.skipped`.
- The faulty update is handled through incident cases, not through standing controls. Outside the
  update, an `"aboard"` case is raised when the wrong gifts on the sleigh reach five.
- Tutorial moments name their cause: what the player just did or what just happened. `skipGuidance()`
  is how a returning player leaves the guided run.
- `budget.left` can go below zero. Wages, AI and the elves' checks keep costing; the one-off actions
  stop until there is money.
- A `tired` news item means an elf burnt out. A burnt-out elf comes back to its station by itself;
  sending an elf for cocoa earlier is quicker.
- `pace.projected` is smoothed over about fifteen seconds.
- `casesWaiting` can be more than 1 when several update or incident cases wait.
- Options that take no time close the case at once: roll back, hold, let go, leave, install, skip,
  accept and carry on. Test, remake, check each, bring back, ask and investigate count down in
  `resolving`.
- An `update` news item means an update was installed, good or faulty. The `rolledBack`,
  `quarantined` and `recalled` items come from the answers to incident cases.
- A `resolved` item for a choice whose result is not yet known (install, accept, carry on, keep
  running, let go, leave) states the time, money, parcels and risk taken, and does not say whether
  it was right.
- Updates are offered at 50, 100 and 150 seconds. Asking a child takes an elf 12 seconds. The budget
  is 1,000.
