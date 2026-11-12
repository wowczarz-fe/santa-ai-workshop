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
new Workshop({ seed, guided })
    // guided true: controls unlock during the run, with tutorial moments; false: all unlocked

step(dt)                          // advance the run by dt seconds
view()                            // everything the page may draw, as plain data
move(elf, station)                // 0 read letters, 1 make toys, 2 check and dispatch, 3 cocoa break
setAi(station, level)             // station 0 or 1; level 0 by hand, 1 assist, 2 automate
setAsk(on)                        // unclear letters wait for an elf to ask the child
setChecking(level)                // which parcels go to the checking pile: 0 a few, 1 the risky ones, 2 all
bypass()                          // let the parcels waiting for a check go through unchecked
choose(choiceId, optionId)        // pick one option at the break between two sleigh runs
resolve(caseId, optionId)         // answer a case a checker brought to the player
acknowledge(momentId)             // close a tutorial moment without acting
skipGuidance()                    // unlock everything now and show no more tutorial moments
```

Each action returns `true` when it took effect and `false` when it is locked or not possible.

## What `view()` returns

The page reads only `view()`. Whether an unrevealed parcel is wrong is left out of it.

| Field                     | Meaning                                                                                                                                   |
| ------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `t`, `duration`, `target` | Seconds played, run length, right gifts needed                                                                                            |
| `moment`                  | `null` or a tutorial moment; the page stops its clock while one is open                                                                   |
| `elves`                   | `[{ name, station, tired, resting, doing }]`                                                                                              |
| `ai`, `ask`, `checking`   | Current lever positions                                                                                                                   |
| `levers`                  | `{ ai0, ai1, checking }`: what each position does now                                                                                     |
| `stations`                | Three of `{ staff, working, idle, queues, blocked, rate }`                                                                                |
| `queues`                  | `{ letters, clarify, orders, check, pass, rework }`, each a queue                                                                         |
| `bypassed`                | How many parcels the player has let through unchecked                                                                                     |
| `vigilance`               | `{ state, name, cleanRun, secondsPerCheck, skipped, trained }`: how the checkers are checking                                             |
| `case`                    | `null` or the case a checker has brought to the player                                                                                    |
| `choice`                  | `null` or the break between two sleigh runs; the rules do not advance while one is open                                                   |
| `score`                   | `{ points, stars, best }`: points so far, stars earned so far, and the most stars a run of the game can earn                              |
| `casesWaiting`            | How many more cases are waiting, 0 or 1                                                                                                   |
| `sleigh`                  | `{ right, wrong, parcels }`: live counts and the parcels aboard the sleigh run under way, each with `result`                              |
| `run`                     | `{ number, of, target, cargo, goals, goalsCountFrom, leavesIn, stars }`: the sleigh run under way, and the stars each finished run earned |
| `focus`                   | `null` or `{ station, control, text }`: the one thing that most needs the player now                                                      |
| `lost`                    | Letters lost to a full pile                                                                                                               |
| `prices`                  | `{ wrongEveryday, wrongBig }`: what a wrong everyday gift and a wrong big gift cost                                                       |
| `budget`                  | `{ left, spent: { people, ai, checking, fixing } }`                                                                                       |
| `pace`                    | `{ projected, behind, slowest }`                                                                                                          |
| `incident`                | `null` or `{ known, rollingBack, suspectWaiting }`                                                                                        |
| `actions`                 | For each control: `{ unlocked, available, why, cost }`                                                                                    |
| `news`                    | `[{ id, t, kind, text, ... }]`, newest first                                                                                              |
| `end`                     | `null` or `{ right, wrong, lost, rating, costs, headline, lesson: { title, text }, assurance, checkingAnswer, used, causes }`             |

- An elf's `station` is 0 to 3, `tired` is 0 to 100, and `resting` is `true` while a break cannot be
  cut short. `doing` is a short phrase for what the elf is doing now, such as "reading letters",
  "asking a child", "confirming the AI's toys", "checking parcels", "nothing to do" or "having
  cocoa". Elves at a station on Automate have nothing to do there, except that at reading they ask
  children when asking is on and a letter is waiting to be asked about.
- A station's `staff` is how many elves are there, `working` and `idle` split them, `queues` lists
  the ids of the queues it works on in the order to draw them, and `blocked` is `null` or a short
  reason such as "the toy pile is full". `rate` is the parcels a minute the station manages at its
  current staffing and AI level.
- A queue is `{ id, name, parcels, limit, rate, inflow, trend, progress, blocked }`. `inflow` is
  parcels a minute arriving and `trend` is `"growing"`, `"steady"` or `"shrinking"`, so the page can
  show at a glance whether the player's last move helped. `rate` is parcels a minute at
  the current staffing and `progress` is 0 to 1 towards the next parcel. `blocked` is `null` or a
  short reason such as "nobody here to ask". Station 0 works `letters` and `clarify`; station 1
  works `orders`; station 2 works `check`, `pass` (parcels going straight through) and `rework`.
- `levers.ai0` and `levers.ai1` each hold three entries
  `{ name, who, speed, risk, perMinute, costPerMinute }`. The three text fields are written to be
  read at a glance, six words at most each: `who` says who does the work, the same for both
  stations: "Elves do it", "AI drafts, an elf confirms each" or "AI works alone", `speed` compares it with working by hand ("about twice as fast"), and `risk` says
  what to watch for now, from the current state ("guesses unclear wishes: 4 waiting").
  `levers.checking` holds three entries `{ name, sends, per100 }`: which parcels the elves check
  and how many in a hundred that is now.
- `vigilance.state` is `"careful"`, `"relaxing"` or `"waving through"`, and `name` is the plain word
  for it to show: `"sharp"`, `"drifting"` or `"not looking"`. `cleanRun` is how many
  clean AI-made parcels the checkers have seen in a row, `secondsPerCheck` what a check takes them
  now, `skipped` how many checks they have skipped, and `trained` whether training has been done.
- `pace.projected` is the right gifts expected at departure at the current pace, `behind` whether
  that is short of the target, and `slowest` the station holding things up: the furthest along
  the line whose own pile is filling, or `null` when no pile is filling because letters are not
  arriving faster than the workshop works. Each step smooths
  `projected` over about 15 seconds; a player action works both out afresh at once, even while the
  clock is stopped.
- `actions` has a key for each of `ai0`, `ai1`, `ask`, `checking` and `bypass`. `unlocked` says whether the guided run
  `available` whether it can be used now, `why` is one short phrase when it cannot, and `cost` is
  what using it costs in time, money and parcels covered, in the player's words.
- `end.costs` is `{ people, ai, checking, fixing, mistakes, prevented, total, budget }`. `mistakes`
  is what the delivered wrong gifts cost. `prevented` is an estimate of what the mistakes that
  checking caught would have cost; the page labels it as an estimate.
- `end.headline` is the end screen's title, a few words without figures, and `end.lesson` the one
  lesson under it. Both follow one comparison of the game's losses in its own money (below):
  "Fast, but wrong." when the wrong gifts delivered cost most, "Careful, but slow." when gifts held
  back by checking did, and "Too slow for the letters." when other lost letters did, each only when
  its loss mattered (below). "Christmas, carefully delivered." is for a rating of 3, and "A good
  Christmas." for any other game where no loss mattered; its lesson then names the largest loss as
  a tip. "Too tired to keep up." replaces
  the second and third when tiredness took a quarter or more (`TIRED_SHARE`) of the working time
  at the station that held the line up: checking for held gifts, the station that held gifts back
  longest for lost letters. The assurance verdict follows the same comparison, so the dial, the
  lesson and the headline agree.
- `end.checkingAnswer` is one sentence answering "Was checking worth it?": yes or no with what the
  checks cost and about what they stopped. It follows the dial's verdict: with `"too little"` it
  names the kind of gift where more checks would have paid, with `"too much"` the kind where checks
  did not pay, and with `"bottleneck"` it says how many gifts the pile held back.
- `end.used` is `{ assist, risky, asked, tested, rolledBack, trained, rested }`, each `true` once the
  player has done that thing in this game, set when the action succeeds and never cleared:
  `assist` an AI level on Assist for at least 10 seconds of play in all, `risky` checking on the
  risky ones for at least 10 seconds, so one click does not count,
  `asked` a child asked (with asking on, or from a case), `tested` the test-it-first break option,
  `rolledBack` a faulty update rolled back, `trained` the training break option, `rested` the
  cocoa-for-everyone break option.

### The assurance summary

`end.assurance` says whether checking came out too little, about right or too much in this game,
in the game's own money. It describes how this game turned out, not whether a choice was wise
beforehand: a risky batch can happen to come out clean.

| Field                    | Meaning                                                                                            |
| ------------------------ | -------------------------------------------------------------------------------------------------- |
| `verdict`                | `"too little"`, `"about right"`, `"too much"` or `"bottleneck"`                                    |
| `position`               | 0 to 1 for a dial: 0 far too little, 0.5 about right, 1 far too much                               |
| `thresholds`             | `{ little, much }`: the positions where the verdict changes, for drawing the dial's zones          |
| `underCost`              | £ lost to under-checking (below)                                                                   |
| `overCost`               | £ lost to over-checking (below); partly an estimate                                                |
| `wrongMade`              | Wrong toys the workshop made in the whole game                                                     |
| `caught`, `prevented`    | Wrong toys stopped before the sleigh, and about what they would have cost (an estimate)            |
| `shipped`, `shippedCost` | Wrong gifts that reached children and stayed, checked or not, and what they cost                   |
| `held`                   | Gifts held back by checking in the whole game (below), the figure the bottleneck `text` names      |
| `tired`                  | `true` for a bottleneck where tiredness took a quarter or more of the checkers' working time       |
| `spent`                  | £ on checking, asking children, training and investigating                                         |
| `groups`                 | One row per kind of parcel (below)                                                                 |
| `noChecks`               | `{ wrong, cost }`: every wrong toy made, and about what they would have cost had none been checked |
| `text`                   | Two short sentences: the verdict for this game with its figures                                    |

- `underCost` is the avoidable part of the wrong gifts that reached children without a check
  (never sent for one, or let through by the player), plus the recalls and
  remakes of such gifts brought back off the sleigh. For each kind of gift, the avoidable part is
  what its unchecked wrong gifts cost beyond what checking every unchecked parcel of that kind
  would have cost; leaving cheap mistakes unchecked when checking them all would cost more is not
  under-checking. A mistake that slipped past a checker who did look counts in `shipped` but not
  here: it is the price of checks being imperfect, not of checking too little. Nor does a gift
  relaxed checkers waved through: it was sent for a check, and the causes name the checkers instead.
- A gift is held back by checking when it is in the checking pile as a sleigh leaves, or a toy
  order stuck behind a full checking pile then (one that misses two sleighs counts twice), or a
  letter lost to a full letter pile while checking was the station holding up the line
  (`pace.slowest` 2). Each is worth £6 (half a wrong everyday gift, `LATE_PRICE`).
- `overCost` is the checking money spent on kinds of parcel where checks cost more than the
  mistakes they stopped, plus £6 for each gift held back by checking while every parcel was being
  checked. Gifts held back while only a few or the risky ones were checked are not over-checking:
  too few or too tired checkers held them up, and they count towards the `"bottleneck"` verdict
  instead.
- `position` is `overCost / (underCost + overCost)`, pulled toward 0.5 when the two together are
  small against all the money spent: `0.5 + (share - 0.5) * lost / (lost + 0.1 * spent)`, rounded
  to two places. Below `thresholds.little` (0.1) the verdict is `"too little"`, above
  `thresholds.much` (0.8) `"too much"`, and `"about right"` between, so a dial drawn from
  `thresholds` always puts the needle in the zone its verdict names.
- The game's losses are compared once, in pounds: the wrong gifts delivered; gifts held back by
  checking every parcel (over-checking); gifts held back by checking while only some parcels were
  checked (a bottleneck); and other letters lost to a full pile. Held and lost gifts count only
  when the game fell short of its target. Gifts held back while only some parcels were checked
  count only when the smaller of their number and the gifts the game fell short by is 15% of the
  target or more (`LATE_SHARE`): a gift held at one departure usually rides the next sleigh, so
  checking cost the game at most its shortfall. Lost letters pass the same gate. Wrong gifts count
  when the mistakes goal was missed in two runs or more (`WRONG_RUNS`) or they cost 30% of the
  whole budget or more (`WRONG_SHARE`). The headline, the dial and the lesson follow the largest
  loss that passes its gate. When the bottleneck is the largest, `verdict` is
  `"bottleneck"` whatever `position` says, and `text` names the gifts held back and the fix: rest
  the checkers with cocoa when `tired`, else move an elf to checking.
  When over-checking is the largest, `verdict` is `"too much"` and `position` is moved into
  that zone if the money alone left it short of it.
- A group is `{ id, name, icon, parcels, wrongMade, checked, caught, shipped, checkCost, prevented,
shippedCost, shippedUnchecked, shippedUncheckedCost, verdict, text }` for `id` `"everyday"`,
  `"big"` or `"unclear"`. A gift that is both big and unclear counts as big, because its mistake
  costs the big price; `"everyday"` is everything else. `parcels` counts parcels made.
  `shippedUnchecked` and `shippedUncheckedCost` are the part of `shipped` that went out without a
  check.
- A group's `verdict` is `"left exposed"` when its wrong gifts that went out unchecked cost more
  than checking the rest of that kind would have, else `"cost more than it saved"` when its checks
  cost more than they prevented, else `"paid"`. `text` is one short sentence with the figures.
- `end.lesson` agrees with the verdict: a lesson about how much was checked, or about the
  bottleneck, takes its title from `assurance`, and its text says what to do next time, so it
  never repeats `assurance.text`. When lost letters were the largest loss
  the lesson is "Letters piled up", naming the station that held things up longest, or "Tired elves
  let letters pile up" when tiredness took a quarter or more of that station's working time. A
  bottleneck with tired checkers is "Tired checkers held up the line". When the
  faulty update's trains that went aboard while its decision waited unanswered made at least half
  of what the wrong gifts cost, the lesson says so.

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

  - `"incident"`: a faulty update that was installed. It comes as up to three cases in turn, told apart by `step`:
    `"source"` (the toy machine is still making the wrong toy: roll the update back or keep it
    running), `"made"` (parcels made during the update are still in the workshop: remake them all,
    check each one, or let them go) and `"aboard"` (wrong gifts are already on the sleigh: bring
    them back or leave them). A step that does not apply is skipped. A `"source"` case the player
    answered with keep running comes back while the fault lasts.
- `step` is set on incident cases and is `null` on the others.
- `facts` is `[{ label, value, primary }]`: the figures the decision turns on, shown before the
  choice. At most three are `primary`: the page shows those on the card and keeps the rest behind
  the info pop-up.
  For an update: what it promises, what is known about it, what a test costs and how far to trust a
  test. For an incident: how many parcels, how many of them big gifts, what stopping costs. For a
  judged parcel: what the gift is worth and why the checker was unsure.
- `evidence` is `[{ parcelId, wish, made, reading }]`: what the checker has seen. `made` is the toy,
  when there is one. `reading` is how the AI reads the wish, on unclear cases. It never includes
  `wanted` or `result`.
- `affected` is `{ count, ids }`: the parcels an option could cover.
- `options` is `[{ id, label, seconds, money, scope, goal, available, why }]`. The options depend on the
  kind. `scope` is what the option does, in words; the part before the first semicolon is a few
  words a chip can show, and a time longer than the run left reads "longer than the run". `goal` is `null` or a few words on
  what the option does to the run's goals, set on the `"aboard"` step: leaving the wrong gifts when
  they are more than the mistakes goal allows reads "Few mistakes goal lost"; bringing them back reads
  "Few mistakes goal saved", and adds "Within budget goal lost" when the recall's price would push the
  run over its allowance. The goal names come from `run.goals`. `scope` ends with the same words
  after a semicolon. `available` is `false` with a
  short `why` when the option cannot be chosen now, for example when no checker is free.
- `resolving` is `null` until the player answers, then `{ optionId, remaining, duration }` while the
  chosen option takes its time. The case stays open and takes no second answer until `remaining`
  reaches zero; then it closes with a `resolved` news item. An option that takes no time closes the
  case at once.
- The parcel in a `"judge"` case is held aside. Until the case is resolved it shows `wanted` and
  `result` as `null` everywhere in `view()`, and no news item or consequence gives its answer away.
- At most one case is open. Incident cases appear in every version and always get their
  turn; of
  the other kinds at most one waits, and they appear only in the versions that have them.
- No option wins whatever the situation. The better choice depends on what the case shows before
  the player chooses (the evidence, how sure it is, what is at stake) and on what the workshop can
  spare at that moment (elves, time, money). A player who reads the case can choose well; a player
  who always picks the same option cannot. The outcome is never a coin toss that only hindsight
  explains.
- An incident's `"made"` or `"aboard"` case closes without an answer once it covers no parcels:
  its gifts were all loaded, or left with the sleigh.
- An open case is never replaced and a held parcel stays held until its case is resolved. Waiting
  cases take their turn in this order: incident source, made, aboard, then the other
  kinds. A source case answered with keep running comes back only after that incident's made and
  aboard cases have had their turn.
- Every option says what it costs. No option is free of consequence: keeping the update running,
  letting parcels go and leaving wrong gifts aboard all carry a cost that the `scope` text names.

### Tutorial moments

A moment is `{ id, control, title, text, parcelId, elf, completes }`.

- `control` is the control or place it points at: an `actions` key, `"elves"`, `"cocoa"`, `"sleigh"`
  or `"case"`. `parcelId` is the example that triggered it, or `null`. `elf` is the index of the
  elf it is about, or `null`.
- `completes` lists the calls that close it, such as `["setAi"]`. `acknowledge(id)` always closes
  it. The rules do not advance while a moment is open only because the page stops calling `step`;
  the page never resumes a game the player paused by hand.
- A moment appears at the first real example of a decision in a guided run, once per decision.
- In a guided run Timmy's unclear letter arrives when the `ask` moment can show at once, at most
  20 seconds after his usual time, and the `ask` moment points at an unclear letter still unread,
  so turning asking on still saves his gift.
- The `cocoa` moment appears the first time a working elf reaches 55 tiredness (`COCOA_MOMENT_AT`).
  Its `elf` is that elf and its `control` is `"cocoa"`. Moving an elf to cocoa (station 3) closes
  it; a move elsewhere does not. It goes away if that elf rests, burns out or is no longer tired.

## News

Every item has `id`, `t`, `kind` and `text`. Some carry more:

| Kind          | Extra fields                                                                            | When                                                 |
| ------------- | --------------------------------------------------------------------------------------- | ---------------------------------------------------- |
| `unlock`      | `control`                                                                               | The guided run introduces a control                  |
| `checked`     | `check: { wish, wanted, made, result, seconds, by }`                                    | A checker finished checking a parcel                 |
| `loaded`      | `check: { wish, wanted, made, result }`, `cause`, `control`, `caseId`; only when wrong  | A wrong gift landed on the sleigh                    |
| `consequence` | `about`, `facts: { seconds, checked, caught, estimatedAvoided, waiting, money }`        | An assurance decision reports what it did            |
| `case`        | `caseId`                                                                                | A checker brought a case to the player               |
| `resolved`    | `caseId`, `option`, `outcome`, `check` when one parcel was judged                       | The player answered a case                           |
| `bypassed`    | `count`                                                                                 | The player let waiting parcels through unchecked     |
| `timmy`       |                                                                                         | Timmy's letter arrives                               |
| `update`      |                                                                                         | An update was installed on the toy machine           |
| `noticed`     | `by`: `"watcher"` (an elf confirming toys on Assist), `"checker"`, `"sleigh"`, `"case"` | The faulty update became known                       |
| `rolledBack`  |                                                                                         | The rollback finished                                |
| `quarantined` | `count`                                                                                 | The suspect batch went to be remade                  |
| `recalled`    | `count`                                                                                 | Wrong gifts came off the sleigh                      |
| `rush`        |                                                                                         | The run carrying the rush cargo starts               |
| `relaxed`     |                                                                                         | The checkers started skipping checks                 |
| `trained`     |                                                                                         | The checkers finished training                       |
| `tired`       | `elf`                                                                                   | An elf burnt out                                     |
| `broke`       |                                                                                         | The money ran out; paid actions stop                 |
| `blocked`     | `station`                                                                               | A station stopped because the next one is full       |
| `lost`        | `count`                                                                                 | Letters were lost to a full pile                     |
| `behind`      | `station`: the station holding things up                                                | The pace first falls short and a station holds it up |
| `milestone`   | `right`                                                                                 | The sleigh passed a round number of right gifts      |
| `cleared`     | `queue`                                                                                 | A pile that was more than half full has been emptied |
| `departed`    | `run`, `right`, `wrong`, `target`, `stars`                                              | A sleigh run left                                    |
| `chose`       | `choiceId`, `option`, `outcome`                                                         | The player picked an option at a break               |

A `resolved` item's `text` says what the choice did, with the time, money and parcels involved, and
`outcome` is `{ seconds, money, parcels, gained }` with the figures that apply. Testing a good update,
for example, reports both the delay and the speed gained.

A `loaded` item carries `caseId` only when a decision still waiting for an answer would have
stopped that gift: the faulty update's `"source"` or `"made"` case, or a `"pattern"` case about the
same wrong toy. A decision being carried out no longer counts. Decisions never resolve on their own.

A `check` is a copy taken when the check finished, so it still shows the toy as the AI made it after
the parcel has been remade or moved. `by` is `"elf"` or `"player"`. A `consequence` leaves out the
facts that do not apply to it. `about` is the `actions` key or `"case"`.

## Sleigh runs

The game is four sleigh runs of a minute each. Each run has its own target, and the four targets add
up to `target`.

- When a run leaves, its gifts are delivered: right ones count, wrong ones cost, and neither can be
  brought back. Parcels still in the workshop carry over. `sleigh` holds only the run under way.
- A run has three goals and earns one star for each it meets, 0 to 3, 12 in a game:
  - `full`: the right gifts aboard reach the run's target.
  - `right`: the wrong gifts aboard are at most one for every 12 gifts of target, and at least one
    is always allowed. Every wrong gift counts as one.
  - `cost`: the money spent during the run, the break before it included, plus what the wrong
    gifts aboard will cost when the sleigh leaves, is at most £300 plus £4 for each gift of target.
  - `right` and `cost` count only once the sleigh holds two thirds of its target, so a near-empty
    sleigh earns nothing.

  A run with its target met and no wrong gift at all also earns a clean-run bonus in points.

- `run.goals` is the three goals for the run under way, as they stand now:
  `[{ id, name, now, need, text, met, waiting }]` with `id` `"full"`, `"right"` or
  `"cost"`. `now` and `need` are the figures (right gifts against the target, wrong gifts aboard
  against the most allowed, money spent with wrong gifts against the allowance), and `text` is a short phrase such
  as "at most 3 wrong gifts". The names are "Full sleigh", "Few mistakes" and "Within budget". `met` is whether the star would be earned if the sleigh left now.
  `waiting` is `true` for a `right` or `cost` goal whose figures are within its limit while the
  sleigh is not yet two thirds full, so the star is not earned yet. `full` never waits.
- `run.goalsCountFrom` is the number of right gifts aboard from which the `right` and `cost`
  goals count; each report (`choice.report`, `end.runs[]`) carries its own.
- Letters arrive slowly in the first run and faster in each later one.
- `score.points` rises with every right gift delivered, falls with every wrong one by what it
  cost, and gains the clean-run bonuses, the stars and a share of the budget left at the end. It is
  the one number a player tries to beat. The page remembers the best one.
- The seed is different on every play unless the address fixes it, so the updates on offer and the
  letters differ from game to game.

### The break between runs

After each of the first three runs leaves, `choice` is set and the rules stop until
`choose(choiceId, optionId)` is called.

A choice is `{ id, run, report, next, title, text, options, openCase }`.

- `report` is `{ run, right, wrong, target, stars, missedBy, bonus, slips, more, spent, assurance, cargo, goals, goalsCountFrom, causes, tired, burnouts }`:
  how the run that just left went. `missedBy` names the first goal it missed, in the player's words,
  or is `null`. `goals` is the run's three goals with their final figures. `tired` is the share of the
  working elves' time during the run that tiredness took, 0 to 100: the slower work of a tired elf,
  and all of a burnt-out elf's time. Idle elves do not count. `burnouts` counts the elves that burnt
  out during the run.
  `slips` is `[{ wish, wanted, made, cause, cost }]` for the wrong gifts delivered, dearest first, at
  most three, with `more` on the report counting the rest. `cause` names what let it through: "the
  AI guessed an unclear wish", "made by the faulty update", "the AI on a big gift", "a tired elf",
  "waved through by relaxed checkers", "let through unchecked".
  `spent` is `{ people, ai, checking, fixing }`: the money spent during that run, the break before
  it included. `assurance` is `{ caught, prevented, shipped, shippedCost, held, checkCost }` for that
  run, on the same terms as `end.assurance`. `cargo` is what that run carried. `causes` says
  where that run's wrong gifts came from (below).
- A cause is `{ id, name, wrong, cost, control, fix }`: up to three, dearest first. `wrong` and
  `cost` count the wrong gifts it accounts for, `control` is the control that would have stopped
  them, and `fix` one short sentence saying how, leaving out any part the settings already follow
  (`""` when they follow all of it). `end.causes` covers the whole game, and a
  `loaded` news item carries the `cause` id and `control` of the wrong gift it reports.

  | `id`      | Wrong gifts from                                     | `control`  |
  | --------- | ---------------------------------------------------- | ---------- |
  | `guessed` | unclear wishes the AI guessed                        | `ask`      |
  | `big`     | AI slips on big gifts that went out unchecked        | `checking` |
  | `misread` | AI misreadings of everyday letters                   | `ai0`      |
  | `misMade` | AI slips making everyday toys                        | `ai1`      |
  | `waved`   | checkers who stopped looking: skipped or missed them | `train`    |
  | `faulty`  | a faulty update                                      | `update`   |
  | `tired`   | tired elves working by hand                          | `cocoa`    |

  A gift that went past a checker counts under `waved` whatever made it wrong, and one from a
  faulty update under `faulty`.

- `openCase` is `{ id, title }` for the first decision still waiting for an answer, or `null`.
  `title` names it in a few words, such as "Faulty update" for a faulty update still running.
  The page can offer to open it from the break; a case can be answered while the break is open.
- `next` is `{ cargo, target }`: what the run about to start carries and the right gifts it needs
  for three stars, so the player can set up for it during the break.
- `options` is up to four of `{ id, kind, label, text, facts }`, and the player picks exactly one.
  `kind` is `"update"` (install an AI update now), `"tested"` (test it first: if the test is clean
  it is installed part-way through the next run, if not nothing is installed), `"train"` (train the
  checkers) or `"rest"` (cocoa for every elf, which halves each elf's tiredness). `facts` is at most three `{ label, value }`: what
  the option gives (`Gives`), what it risks (`Risk`, on the install option only: how likely the
  update is faulty) and what it costs (`Costs`). The test option has `Stops` in place of a risk.
  `"train"` is left out when the AI was used in the run but none of its gifts are still to come.
- No option wins whatever the situation. What an update promises and how likely it is to go wrong
  are shown and differ from break to break; training is worth more the more relaxed the checkers
  are and the more AI-made parcels are still to come; rest is worth more the more tired the elves
  are.
- AI updates, training and resting everyone happen only here. A faulty update that was installed
  shows up during the next run and is handled through incident cases.

After the fourth run the game ends. `end` gains `stars`, `points`, `runs` (one report for each
run), `blunders` and `blunderTotal`. `blunders` is `[{ id, name, icon }]`: the absurd wrong toys
this game produced, caught or not. `blunderTotal` is how many different ones exist, so the page can
keep a collection across games and show how many have been found.

`run.stars` is an array with the star count of each run that has left, in order; it is empty
during the first run. `score.stars` is their sum and `score.best` the most a game can earn.

### Cargo

Each sleigh run carries a cargo, so the set-up that pays changes from run to run. A cargo is
`{ id, name, icon, text }`, where `text` is a few plain words a player can act on, short enough to
follow the cargo's name in a heading.

- `"everyday"`: the plain mix of all wishes. The first run always carries it.
- `"big"`: mostly big gifts. The AI slips more on them and a wrong one costs the big price.
- `"unclear"`: letters from little ones, most of them unclear wishes the AI guesses.
- `"rush"`: mostly plain gifts, with letters coming much faster.

Runs 2 to 4 carry one each of big, unclear and rush, in an order drawn from the seed. The cargo sets
the mix of wishes, how fast letters arrive and that run's target; `run.target` and `next.target`
give it. `run.cargo` is the cargo of the run under way; each entry of `end.runs` carries its own.

## Versions

There is one game. The earlier test versions are gone from the rules; a `version` passed to the
constructor is ignored. The game plays incident cases and now and then a judge case, where a
checker asks the player to judge one toy against its wish.

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
- Asking a child takes an elf 5 seconds and remaking a caught mistake 10. The budget
  is 1,800. A wrong everyday gift costs 12 and a wrong big gift 100 (`prices` gives both).
- An elf confirming an AI draft on Assist catches 95 in 100 wrong ones. A checker catches 90 in 100,
  but only 30 in 100 on an unclear wish nobody asked about, because the checker cannot tell what the
  child meant either; asking the child or confirming the reading fixes those at the source.
- A recall takes the checkers 4 seconds for each gift brought back, at most 20 seconds in all. It
  is dear in money instead: £20, plus £40 for each everyday gift and £80 for each big one, plus the
  £3 remake of each, so fixing a mistake after it has shipped costs far more than checking would
  have. The gifts come off the sleigh at once; one still being remade when the sleigh
  leaves stays in the workshop and goes on the next sleigh.
- Nobody watches the toy machine: a faulty update shows up through elves confirming on Assist,
  checkers, the sleigh or an investigation.
