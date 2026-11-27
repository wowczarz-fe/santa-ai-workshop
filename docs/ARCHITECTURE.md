# Architecture

It describes the boundary between the two scripts in `game/`: the calls the page makes and every
field of `view()`. The one-sleigh game it describes is decided in `docs/adr/0014-one-sleigh-in-two-halves.md`,
`docs/adr/0015-one-cost-figure.md` and `docs/adr/0016-unclear-wishes-become-decisions.md`.

## Two scripts

- `workshop.js` is the rules. `class Workshop` holds the state of one game and advances it over
  time. It never reads or changes the page, so it also runs in Node for scripted balance checks.
- `game.js` is the page. It calls `step` on a timer, draws what `view()` returns, and turns clicks
  and taps into the calls below. It holds no rules and no numbers. It owns the fixed labels of the
  interface: button names, headings, units, the rows of the cost account, the tour and the opening
  card. Everything that depends on the game comes from the rules: evidence, where mistakes come
  from, what a control does and costs, outcomes, the practices, the lesson.

## What the page calls

```
new Workshop({ seed })            // seed: any integer; the same seed and calls give the same game

step(dt)                          // advance the game by dt seconds; does nothing while half-time is open or after the end
view()                            // everything the page may draw, as plain data
move(elf, station)                // 0 read letters, 1 make toys, 2 check and dispatch, 3 cocoa break
setAi(station, level)             // station 0 or 1; level 0 by hand, 1 assist, 2 automate
setChecking(level)                // which gifts go to the checking pile: 0 Random, 1 Riskiest, 2 All
resolve(caseId, optionId)         // answer the open decision
choose(optionId)                  // pick one option at half-time: "update", "tested", "train", "rest" or "none"
```

Each action returns `true` when it took effect and `false` when it is not possible (for example
`move` on a burnt-out elf, `resolve` on a decision that is not open, `choose` when half-time is not
open). Every control works from t = 0. Page code must cope with a field being absent (`?.`, `??`).

## The game

One sleigh is filled over two halves of 45 seconds (`duration` 90). At t = 45 the rules stop and
`choice` holds the half-time card until `choose(optionId)` is called. The sleigh leaves at t = 90,
or the moment the budget runs out: `end` is set and nothing moves after that.

- Letters arrive at 0.6 a second for the first 9 seconds, then 1.1 a second, and stop 8 seconds
  before the end so the last ones can still reach the sleigh.
- The first half carries everyday gifts only. The second half carries mostly big gifts (6 in 10),
  the first of them 5 seconds in, so there is time to act on the half-time card.
- On everyday gifts the AI is as reliable as the elves, at reading and at making (1 job in 200
  wrong), and it never tires. Big gifts are rare, unusual requests it has seen few of: it misreads
  about 1 in 7 and makes about 1 in 5 wrong, without noticing. An elf confirming a draft on
  Assist, or a check, catches most of those. So automating is right in the first half, and the
  second half needs an elf's judgement on the big gifts
  (`docs/adr/0019-make-the-ai-reliable-on-everyday-gifts.md`,
  `docs/adr/0025-make-the-ai-wrong-on-1-in-5-big-gifts-and-keep-the-dial-honest.md`).
- One unclear letter arrives in each half, at a seeded time 7 to 24 seconds into the half, from
  a pool of ten children and wishes (Timmy's little train among them). It raises a decision at once
  (below). All other letters are clear.
- Three goals, one star each, for the whole game: `full` (Full sleigh, 89 correct gifts aboard),
  `right` (Minimal mistakes, at most 1 wrong gift aboard) and `cost` (Within budget, less than the
  £660 budget spent when the sleigh leaves). `right` and `cost` count only once the sleigh holds
  63 correct gifts (`goalsCountFrom`), so a slow sleigh earns nothing for being cheap and clean.
- There is one money figure, the cost so far (`cost.spent`), counted against a budget of £660
  (`cost.limit`). It counts up: the AI's running cost, checks, the half-time purchase, fixes
  (remakes, recalls, a rollback) and what the wrong gifts aboard will cost. The moment it reaches
  the budget the game ends: the sleigh leaves with what is aboard, the Within budget star is lost
  and at most two stars are earned (`docs/adr/0020-end-the-game-when-the-budget-runs-out.md`).
  Nothing the player chooses can end the game by itself: an option the budget cannot cover is
  unavailable.
- The seed is different on every play unless the address fixes it, so the update on offer, the
  unclear letters and the letters differ from game to game.

## What `view()` returns

The target (89), the budget (£660) and `goalsCountFrom` (63) here are examples from the current
balance; the page reads them from `view()`.

The page reads only `view()`. Whether an unrevealed parcel is wrong is left out of it. Money is in
pounds, rounded to whole pounds unless said otherwise. Times are seconds.

| Field          | Type                             | Example                                            | Meaning                                                                                                            |
| -------------- | -------------------------------- | -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| `t`            | number                           | `40.0000000001`                                    | Seconds played, unrounded                                                                                          |
| `duration`     | number                           | `90`                                               | Seconds in the whole game                                                                                          |
| `elves`        | array of elf                     | see below                                          | The eight elves, always in the same order                                                                          |
| `ai`           | `[number, number]`               | `[2, 1]`                                           | AI level at reading and at toy making: 0 by hand, 1 Assist, 2 Automate                                             |
| `checking`     | number                           | `1`                                                | 0 Random, 1 Riskiest, 2 All                                                                                        |
| `levers`       | object                           | see below                                          | What each lever position does now                                                                                  |
| `stations`     | array of 3 station               | see below                                          | Reading, toy making, checking                                                                                      |
| `queues`       | object of queue                  | see below                                          | `letters`, `orders`, `check`, `pass`, `rework`                                                                     |
| `vigilance`    | object                           | see below                                          | How far the elves have come to trust the AI                                                                        |
| `case`         | decision or `null`               | see Decisions                                      | The open decision                                                                                                  |
| `casesWaiting` | number                           | `1`                                                | Decisions waiting behind the open one                                                                              |
| `choice`       | half-time or `null`              | see Half-time                                      | Set only while half-time is open                                                                                   |
| `run`          | object                           | see below                                          | The one sleigh: half, clock, gifts aboard, goals                                                                   |
| `cost`         | `{ spent, limit, left, low }`    | `{ spent: 79, limit: 660, left: 581, low: false }` | The budget: cost so far, wrong gifts aboard included, what is left, and whether it runs low                        |
| `focus`        | object or `null`                 | see below                                          | The one thing that most needs the player now                                                                       |
| `sleigh`       | `{ right, wrong, parcels }`      | `{ right: 36, wrong: 1, parcels: [...] }`          | Gifts aboard; `parcels` is every parcel aboard, each with `result`                                                 |
| `lost`         | number                           | `0`                                                | Letters lost: to a full letter pile, or unclear letters undecided at the end                                       |
| `prices`       | `{ wrongEveryday, wrongBig }`    | `{ wrongEveryday: 12, wrongBig: 100 }`             | What a wrong everyday and a wrong big gift cost                                                                    |
| `pace`         | `{ projected, behind, slowest }` | `{ projected: 137, behind: true, slowest: null }`  | Correct gifts expected at departure, whether short of the target, the station holding things up (0 to 2) or `null` |
| `incident`     | object or `null`                 | `{ known: true, rollingBack: 0 }`                  | Set once a faulty update is installed (below)                                                                      |
| `actions`      | object                           | see below                                          | For `ai0`, `ai1`, `checking`: whether it works now and what it costs                                               |
| `news`         | array of news                    | see News                                           | Up to 30 items, newest first                                                                                       |
| `end`          | end or `null`                    | see The end                                        | Set when the sleigh has left                                                                                       |

### Elves

An elf is `{ name, station, energy, mood, resting, doing }`, for example
`{ name: "Pip", station: 2, energy: 66, mood: "fresh", resting: false, doing: "checking gifts" }`.

- `name`: string. `station`: 0 to 3 (3 the cocoa break).
- `energy`: number, 0 to 100. 100 is fresh, 0 is burnout; it falls as the elf works and rises on
  cocoa. Draw the energy bar from it: it drains.
- `mood`: `"fresh"` (energy 66 or more: full speed), `"tiring"` (energy 43 to 65: slower),
  `"tired"` (energy 42 or less: slower and slipping) or `"spent"` (burnt out, on a long break).
  Use it for the bar's colour (green, amber, red, empty) and the face.
- `resting`: `true` while a burnt-out elf is on its long break, which cannot be cut short. It comes
  back to its station by itself after 9 seconds.
- `doing`: a short phrase: `"reading letters"`, `"confirming the AI's understanding"`, `"making toys"`,
  `"confirming the AI's toys"`, `"checking gifts"`, `"loading the sleigh"` (checkers loading waiting
  gifts onto the sleigh), `"remaking caught gifts"` (checkers remaking a caught or recalled gift),
  `"nothing to do"`, `"having cocoa"` or `"burnt out"`. Elves at a station on Automate have nothing
  to do there.

### Levers

`levers` is `{ ai0, ai1, checking }`.

- `ai0` (reading) and `ai1` (toy making) each hold three entries, one per level, of
  `{ name, summary, perMinute }`, for example
  `{ name: "Automate", summary: "The AI works alone and needs no elves. It rarely slips on everyday letters, but misreads about 1 in 7 letters for big gifts.", perMinute: 100 }`.
  `name` is "By hand", "Assist" or "Automate". `summary` is the tooltip on the level's button:
  two complete sentences of about twenty words, what the level does and then how fast or how
  reliable it is. The figures come from `RISK`, and Assist's speed against by hand from the
  seconds per job ("about twice as fast", "about three times as fast" after an update). On
  Automate at Toys, once a faulty update is known, the second sentence names it instead.
- `checking` holds three entries `{ name, sends, per100 }`, for example
  `{ name: "Riskiest gifts", sends: "checkers look at the big gifts and the ones flagged by AI", per100: 37 }`:
  which gifts the checkers look at, as a clause the page starts a sentence with, and how many in
  a hundred that is now.

### Stations and queues

A station is `{ name, staff, working, idle, blocked, rate }`, for example
`{ name: "Checking", staff: 4, working: 4, idle: 0, blocked: null, rate: 101 }`.
`name` is the station's heading word, `"Letters"`, `"Toys"` or `"Checking"`; every rules line that
points at a station uses it ("Move an elf to Toys", "Pip is rested and back at Letters").
`blocked` is `null` or the reason as a
sentence, such as `"The toy pile is full."`. `rate` is parcels a minute at its current staffing and AI level.

A queue is `{ id, name, parcels, limit, rate, trend, progress, blocked, held }`, for example
`{ id: "check", name: "To check", parcels: [...], limit: 10, rate: 51, trend: "steady", progress: 0.42, blocked: null, held: 0 }`.
`parcels` are parcels (below), `limit` the pile's size, `rate` parcels a minute at the current
staffing, `trend` `"growing"`, `"steady"` or `"shrinking"`
over the last ten seconds, `progress` 0 to 1 towards the next parcel (unrounded), `blocked` `null`
or the reason as a sentence, such as `"Nobody is reading the letters."`, `held` the unclear letters the player has read
that wait for room in a full pile (toy orders only, else 0). Limits: letters 24, orders 20, check
10, pass 12, rework 30; `parcels` never holds more than `limit`. Names: `"Letters"`, `"Toy orders"`, `"To check"`, `"Waiting to load"` (the gifts that
need no check, which the checkers load onto the sleigh) and `"To remake"`; every line about the
`pass` pile calls it the waiting-to-load pile.

### Parcels

A parcel is `{ id, wish, big, unclear, wanted, made, suspect, result }`, for example
`{ id: 38, wish: "A book about dinosaurs.", big: false, unclear: false, wanted: { name: "dinosaur book", icon: "📕" }, made: { name: "dinosaur book", icon: "📕" }, suspect: false, result: "right" }`.

- `id` never changes. `wish` is the child's words. `big` marks a gift whose mistake costs £100.
  `unclear` marks one of the two unclear letters.
- `suspect` is `false`, `"unsure"` (the AI flagged it) or `"batch"` (made during the faulty update,
  once the update is known).
- `wanted` and `made` are `{ name, icon }` and `result` is `"right"` or `"wrong"`. All three are
  `null` until a check or loading onto the sleigh reveals them. A wrong `made` is one of two
  things: a toy the AI made up (the wish's own wrong toy, or a full-sized locomotive from a
  faulty update), or an elf's mix-up, which is another child's wanted toy of the same kind
  (everyday for everyday, big for big). Every `made.name` is a toy the page can draw.

### Vigilance

`vigilance` is `{ state, skipped, swap }`, for example `{ state: "careful", skipped: 0, swap: null }`.

- `state` is the checkers' state, `"careful"`, `"relaxing"` or `"waving through"`. Each elf keeps its own run of clean AI
  gifts seen at its station, and a station reads from the average of its elves. Checkers drift
  after 5 (they check faster and skip half the AI gifts) and stop looking after 12 (they skip nine
  in ten). A caught mistake takes 6 off each checker's run. A cocoa break, a burnout or a move to
  another station starts an elf's run afresh, so swapping in a rested elf pulls a drifting station
  back; training at half-time keeps every elf sharp for the rest of the game.
- Elves who confirm AI drafts on Assist drift the same way: every clean draft counts as a clean
  gift for each confirmer at that station, and a drifting confirmer passes more wrong drafts.
- `skipped` is how many checks the checkers have skipped. Training keeps checkers and confirmers
  sharp for the rest of the game.
- `swap` is the one drift prompt now: `null`, or `{ elf, station, name }`, an elf (its index in
  `elves`) at a drifting station. When a prompt is needed it names the elf who trusts the AI most
  at the checkers if they drift, else at the Assist station that trusts the AI most, and it keeps
  naming that elf while the elf stays there and the station still drifts. It turns `null` the
  moment that elf leaves or the station looks properly again, empties, or is trained, and in the
  first 12 seconds; a new prompt may follow on the next step. Read it on every view to show the
  drift banner, the outline and the card tag on that one elf.

### Run

`run` is `{ half, halves, halfLeft, leavesIn, aboard, target, cargo, goals, goalsCountFrom }`, for
example
`{ half: 1, halves: 2, halfLeft: 21, leavesIn: 66, aboard: 22, target: 89, cargo: { id: "everyday", name: "Everyday gifts", icon: "🎁", text: "The AI handles these as reliably as your elves, and much faster. A wrong one costs £12." }, goals: [...], goalsCountFrom: 63 }`.

- `half`: 1 or 2. `halves`: 2. `halfLeft`: whole seconds left in the half under way. While the
  half-time card is up (`choice` set) the first half is over and the second has not begun: `half`
  is 1, `halfLeft` 0 and `cargo` the first half's, until the player chooses. `leavesIn`: whole seconds until the sleigh leaves at the end of the game.
- `aboard`: correct gifts on the sleigh, the figure the Full sleigh star counts. Show the sleigh
  count once, from here.
- `cargo`: the half's cargo `{ id, name, icon, text }`: `"everyday"` ("Everyday gifts") in the
  first half, `"big"` ("Big gifts", "These are rare and unusual. The AI has seen few like them and can be wrong without noticing. Each wrong one costs £100.") in the
  second.
- `goals`: always three, in this order, each `{ id, name, now, need, text, met, waiting }`:

  | `id`    | `name`             | `now`                         | `need` | `text`                            |
  | ------- | ------------------ | ----------------------------- | ------ | --------------------------------- |
  | `full`  | `Full sleigh`      | correct gifts aboard          | 89     | `89 correct gifts`                |
  | `right` | `Minimal mistakes` | wrong gifts aboard            | 1      | `at most 1 wrong gift`            |
  | `cost`  | `Within budget`    | cost so far (as `cost.spent`) | 660    | `spend less than the £660 budget` |

  `met` is whether the star would be earned if the sleigh left now. `waiting` is `true` for a
  `right` or `cost` goal whose figures are within its limit while the sleigh holds fewer than
  `goalsCountFrom` correct gifts, so the star is not earned yet; `full` never waits.

- `goalsCountFrom`: 63, the correct gifts aboard from which the `right` and `cost` goals count.

### Cost

`cost` is `{ spent, limit, left, low }`, for example
`{ spent: 79, limit: 660, left: 581, low: false }`. `spent` is the one money figure of the game:
everything spent so far plus what the wrong gifts aboard will cost, in whole pounds rounded down.
It only grows, except when a recall brings wrong gifts back (their price leaves, the recall's is
added). `limit` is the budget, `left` what remains of it (`limit - spent`, never below 0) and
`low` is `true` once a quarter of the budget or less is left. Show `left` in the top bar as
"Budget left", counting down, with a clear low state.

The game ends the moment `spent` reaches `limit`, on the one event that took the last of it (a
wrong gift going aboard, a check, a remake, the AI's running cost): nothing is made, checked or
loaded after that event, so the cost never passes the budget by more than that event. While the
game runs `left` is at least 1. What was paid stays paid; work not finished is not charged, and
gifts still in the workshop miss the sleigh, those being remade after a recall among them. One
`budgetLow` news item is said when `low` first turns `true`.

What costs what: the AI £0.72 a second per station on Assist or Automate (on Assist the AI still drafts every gift); each gift
sent for a check £4, paid as it joins the checking pile whether or not a checker then looks at it
properly; a
remake £3, or £50 for a big gift; a rollback £40; a recall half as much again as its gifts count aboard and at least £25 more than that, remakes
included (£150 for one big gift, £37 for one everyday gift); a wrong everyday gift aboard £12 and a big one £100; the half-time option its
price (update £25, test £30, training £60, cocoa for everyone £30, carry on £0). Reading an
unclear wish costs nothing.

### Focus and actions

`focus` is `null` or `{ station, control, text }`, for example
`{ station: 3, control: "cocoa", text: "rest Holly" }`. `station` is 0 to 3, `control` one of
`"cocoa"`, `"elves"`, `"ai0"`, `"ai1"` or `"checking"`, and `text` four words at most.
When the line has stopped or a pile is full, `focus` names what would free it, ahead of anything
else: the checkers when the checking or waiting-to-load pile is full (`{ station: 2, control:
"elves", text: "add another elf" }`, or `control: "checking", text: "check fewer"` while every
gift is checked by three elves or more), else the toy makers or readers when their pile is full
or nobody works there (`"elves"`, or `"ai0"`/`"ai1"` with `"try using AI"` while three elves work
it by hand). While a rollback holds the toys up, the other hints apply. A station on Automate is
never named with `"elves"`: the machine works alone there and another elf adds nothing. Its full
pile raises no focus, and a growing pile there, or one held up by a full pile further along, is
left out. The `behind` news line and a rested elf's walk follow the same rule.

`actions` has a key for each of `ai0`, `ai1` and `checking`, each
`{ available, why, cost }`, for example
`{ available: true, why: null, cost: "Assist and Automate each cost £43 a minute here." }`. `available` is
`false` only after the end; `why` then says why in a few words (`"The sleigh has left"`). `cost` is what using it
costs, in the player's words.

### Incident

`incident` is `null` until a faulty update is installed, then `{ known, rollingBack }`: `known`
once an elf confirming toys, the checkers or the sleigh crew spot its full-sized trains,
`rollingBack` seconds of rollback left (0 when not rolling back). A good update never sets it.

## Decisions

A decision ("case") is
`{ id, kind, step, title, text, facts, evidence, affected, options }`, an unclear
letter also has `stake` and `readings`, and a recall also has `gift`. At most one is
open (`case`); the others wait (`casesWaiting`) in this order: the faulty update, the recall, the
unclear letters. The page pauses the clock while a Decide card awaits an answer, preserving any
manual pause. Every answer closes its decision at once. A game has two to five decisions:
two unclear letters, at most one faulty update and at most two recalls.

- `kind` is `"unclear"` or `"incident"`. `step` is `null` for an unclear letter, and `"source"`
  (the faulty update) or `"aboard"` (wrong gifts on the sleigh) for an incident.
- `title` names it in a few words: `"Unclear wish"`, `"Faulty update"` or `"Santa's reputation at risk"`.
- `text` is one short sentence of what happened, for example
  `"Timmy writes: 'A little train for my toy track.' It could mean two things."`.
- `facts` is `[{ label, value, primary }]`: the figures the decision turns on. At most three are
  `primary`; show those on the card and the rest behind the info pop-up.
- `evidence` is `[{ parcelId, child, wish, made }]`: the letter for an unclear wish, the gift for a
  recall raised by one wrong gift, empty for any other incident. `child` is the child's name, `made` is `null` until a toy is made.
- `affected` is `{ count, ids }`: the parcels an option could cover. For a recall, `count` is the
  number of gifts `bringBack` takes off the sleigh and `ids` those gifts.
- `options` is `[{ id, label, seconds, money, risk, scope, why, goal, available }]`, and a recall's
  options also carry `instead` and `extra` (below). `seconds` is
  the time it takes, `money` what it costs, `risk` `null` or the chance (0 to 1) of a wrong gift or
  toy it leaves, `scope` what it does in a few plain words with no semicolon (it may be empty, and
  it never repeats `goal`: read the figures from the fields), `goal` `null` or a few words on what it does to the goals, `available` `false`
  with a short `why` when it cannot be chosen now.
- `stake` (unclear letters only): what a wrong pick costs once aboard, a number of pounds: 12
  for an everyday wish, 100 for a big one, as `prices` shows them. Format it on the page, for
  example `"Costs £12 if wrong"`.
- `readings` (unclear letters only): the two things the wish could mean, each `{ name, art }`, for
  example `[{ name: "cuddly bat", art: "cuddly-bat" }, { name: "cricket bat", art: "cricket-bat" }]`.
  One is the correct gift and one the wrong one; their order is drawn per decision from the seed (the
  right one first in about half of them), so it never tells which is right. `name` is the toy's
  short name as `made` shows it, and `art` the key the page already draws toys by: the name in lower
  case with dashes, as `SharedArt.toy` and `PaperArt.toy` look it up and as `blunders` ids read. For
  a card heading the child and the wish in its own words are `evidence[0].child` and
  `evidence[0].wish`.

### Unclear letter

```
{ id: 1, kind: "unclear", step: null, title: "Unclear wish",
  text: "Amir writes: 'A bat, please! I love caves.' It could mean two things.",
  facts: [ { label: "Cost if wrong", value: "£12", primary: true },
           { label: "Time left", value: "66 s", primary: false } ],
  evidence: [ { parcelId: 36, child: "Amir", wish: "A bat, please! I love caves.", made: null } ],
  affected: { count: 1, ids: [36] },
  options: [ { id: "pick:0", label: "cuddly bat", seconds: 0, money: 0, risk: null,
               scope: "", why: null, goal: null, available: true },
             { id: "pick:1", label: "cricket bat", seconds: 0, money: 0, risk: null,
               scope: "", why: null, goal: null, available: true } ],
  stake: 12,
  readings: [ { name: "cuddly bat", art: "cuddly-bat" }, { name: "cricket bat", art: "cricket-bat" } ] }
```

- The letter is set aside as it arrives and waits for the answer; it never joins the letter pile
  until answered and is never lost to a full pile. Still undecided when the sleigh leaves, it is
  lost (counted in `lost`).
- The player reads the wish: the options are the two readings, `"pick:0"` and `"pick:1"`, in the
  same order as `readings`, each with the reading's name as its `label`. Draw the two pictures as
  the two buttons. Nothing in `view()` says which reading is right: the child's line carries the
  clue ("I love caves"), and every unclear wish has one.
- `resolve(caseId, "pick:0" | "pick:1")` closes the decision at once and sends the letter to the
  toy pile as the reading picked, without passing a reader. The right pick is made as the correct
  gift. The wrong pick is made as the wrong one: a wrong gift like any other, caught by a check 9
  times in 10 if it is sent for one, else aboard under the cause `picked`. A letter the player has
  read is not flagged as risky, so Riskiest checking checks it only when it is a big gift.
- When the toy pile is full the read letter waits for room: it shows as `queues.orders.held`, is
  never dropped, and joins the pile ahead of the letters being read as soon as a toy is made.
- The `resolved` news line says what went on, not whether it was right
  (`"You chose a cuddly bat for Amir."`); a check or the sleigh shows that.
- An unanswered card waits as long as the game lasts: it never answers itself. Its wait is game
  time, so it does not run while a Decide card is open or the game is paused. The half-time card
  names it in `choice.openCase`.

### Faulty update (`step` `"source"`)

Raised once, when a faulty update installed at half-time becomes known, which takes at least one
full-sized train. Facts: `"Full-sized trains so far"` (every train it has made, caught or not),
`"Rolling back"` (`"takes 5 seconds and costs £40"`), `"Toys a minute"`
(`"112 now, 80 after rolling back"`), `"Time left"` (`"66 seconds"`).
Options: `"rollback"` (the toy machine stops 5 seconds, £40, then the machine is back to its old speed)
and `"keep"` (risk 0.65: the machine keeps making full-sized trains until the sleigh leaves). Both
close at once; the rollback runs in `incident.rollingBack`. Known faulty parcels still in the
workshop are marked `suspect: "batch"`, so Riskiest checking checks them.

### Recall (`step` `"aboard"`)

Raised in two ways, at most two recall decisions per game between them, one at a time, including
while a faulty update is running:

- The first time a wrong gift is aboard, everyday or big, for that one gift, while the wrong gifts aboard are
  still within the Minimal mistakes limit. No star is at stake: the choice is whether the gift counts
  as a mistake. This card waits until the gift can be brought back (room on the remake pile, time
  before the sleigh leaves, budget for it) and is not raised at all if it never can.
- When wrong gifts aboard exceed the Minimal mistakes limit, for the excess. This can be the first
  card, when the first wrong gift's card could not be raised. After leaving
  gifts aboard, another decision requires another wrong gift to arrive.

A card open for one gift follows the count: once the limit is passed it covers the excess and
reads as the second kind. Facts: `"Wrong gifts aboard"`, `"Gifts to bring back"`
(`"2, including 1 big"`), `"Counted against your budget"`, `"Time left"`.

`text` names the gift when one wrong gift raised the card
(`"Mia got a blue bike, not a red bike."`), and the count otherwise
(`"3 wrong gifts are aboard, one more than Santa's reputation can take."`).

`affected.count` is the number of gifts `"bringBack"` takes off the sleigh and `affected.ids`
those gifts: the one gift, or the gifts above the limit, big gifts first, and never more than the
remake pile has room for. `gift` is `{ child, wanted: { name }, made: { name } }` when exactly one
gift is affected, so the card can draw what the child got and what they wanted, and `null`
otherwise. `"bringBack"` removes the gifts from
the sleigh immediately and sends them to the checkers to remake, 4 seconds each and at most 12
in all. It needs a checker, and is unavailable with a reason when too little time remains.
`"leave"` keeps them aboard.

Bringing gifts back always costs more than leaving them, so the player pays to protect Santa's
name. Both options carry three money fields: `money` is what the option adds to the cost (the
recall's payment, remakes included), `instead` what those gifts count in the cost now and stop
counting once recalled, and `extra` the difference, `money - instead`, which is the net rise in
`cost.spent`. The recall's `money` is 1.5 times `instead` and at least `instead + 40`, rounded, so
its `extra` is always above zero; leaving has all three at 0. `scope` says the same in words
(`"costs £50 more and keeps the checkers busy for about 4 seconds"`, `"costs nothing more"`), as
words that follow the option's name. The page finds the words "checkers busy" in it to label the
time chip.

`goal` mentions a star only when one is saved or lost. Within the limit it is
`"Not counted as a mistake"` for bringing the gift back and `"Counts as mistake N of 2"` for
leaving it, N being the wrong gifts aboard if it stays. Past the limit it is
`"Keeps the Minimal mistakes star"` (or `null` when the recall does not bring the count back within
the limit) and `"Loses the Minimal mistakes star"`. The page shows a goal that names a star as a star
chip, and one that starts with "Loses" as a lost star. The mistakes star still needs the normal minimum of correct gifts to
count.

A recall whose `extra` would take the last of the budget is unavailable, with
`why: "Not enough budget left"`, like every option of every decision that costs money (the
rollback too): nothing the player chooses ends the game by itself. Leaving the gifts aboard, and
every option that costs nothing, is always available.

```
text: "Mia got a blue bike, not a red bike."
affected: { count: 1, ids: [109] }
gift: { child: "Mia", wanted: { name: "red bike" }, made: { name: "blue bike" } }
options: [ { id: "bringBack", label: "Bring it back", seconds: 4, money: 150, risk: null,
             scope: "costs £50 more and keeps the checkers busy for about 4 seconds", why: null,
             instead: 100, extra: 50, goal: "Not counted as a mistake", available: true },
           { id: "leave", label: "Leave it", seconds: 0, money: 0, risk: null,
             scope: "costs nothing more", why: null,
             instead: 0, extra: 0, goal: "Counts as mistake 1 of 2", available: true } ]
```

A successful recall adds a `recalled` action to the end report's response practice, with its gift
count and price. Its cause and cost also remain in the account.

## Half-time

`choice` is set at t = 45 and the rules stand still until `choose(optionId)`. It is
`{ title, text, report, next, options, openCase }`:

```
{ title: "Half-time", text: "Pick one change before you carry on, or none.",
  report: { aboard: 46, wrong: 0, target: 89, cost: 85, limit: 660, tired: 2, burnouts: 0,
            goals: [ ...three goals as in run.goals... ], causes: [ ...up to three causes... ] },
  next: { cargo: { id: "big", name: "Big gifts", icon: "📦", text: "These are rare and unusual. The AI has seen few like them and can be wrong without noticing. Each wrong one costs £100." },
          text: "Big, unusual gifts come next. The AI has seen few like them and can be confidently wrong. Each wrong one costs £100." },
  options: [ ...five options... ],
  openCase: { id: 2, title: "Unclear wish" } }
```

- `report` is how the sleigh stands: `aboard` correct gifts, `wrong` gifts, `target`, `cost` so far
  and its `limit`, `tired` (the share of the working elves' time so far that tiredness took, 0 to
  100), `burnouts` so far, `goals` (as `run.goals`) and `causes` (where the wrong gifts aboard came
  from, see Causes).
- `next.text` is one short sentence pair on what comes next, always
  `"Big, unusual gifts come next. The AI has seen few like them and can be confidently wrong. Each wrong one costs £N."` with N the price of
  a wrong big gift; the page supplies its own headline and shows this as a small line.
  `next.cargo` is the cargo that comes next.
- `options` is always these five, in this order, each `{ id, label, text, facts, available, why }`
  with `facts` at most three `{ label, value }`. `available` is `false`, with
  `why: "Not enough budget left"`, for an option whose price would take the last of the budget;
  otherwise `why` is `null`. `choose()` refuses an unavailable option. Carrying on is always
  available:

  | `id`     | `label`                    | `facts` labels            | Price |
  | -------- | -------------------------- | ------------------------- | ----- |
  | `update` | `Install a hot-fix update` | `Gives`, `Risk`, `Costs`  | £25   |
  | `tested` | `Install a tested update`  | `Gives`, `Stops`, `Costs` | £30   |
  | `train`  | `Train the checkers`       | `Gives`, `Costs`          | £60   |
  | `rest`   | `Cocoa for everyone`       | `Gives`, `Costs`          | £30   |
  | `none`   | `Carry on`                 | `Costs`                   | £0    |

  `update` speeds up the toy machine at once (30 to 60%) and is faulty on half of all games, with
  signs in its `text` that lean the right way; `Risk` gives the chance. `tested` runs four test
  toys and installs the update 12 seconds into the second half only if they all pass. `train`
  keeps checkers and confirmers sharp for the rest of the game. `rest` halves every elf's
  tiredness and ends burnouts. `none` changes nothing. The price is added to the cost so far.
  Each `text` is everything the option's information button shows, in short plain sentences, for
  example `"The AI makes toys 50% faster. Its makers say it is a big change and tested it briefly."`. The
  `train` text ends with the checkers' state as a sentence (`"Your checkers are sharp now."`,
  `"Your checkers are starting to skip checks."` or `"Your checkers have stopped looking."`) and
  the `rest` text with the elves' energy (`"The elves' average energy is now 47."`), so neither
  is a fact of its own. `Gives` is the line under the option's name, written to be read cold:
  `"The AI makes toys 50% faster"`, `"Installed after 12 seconds if it passes"`, `"Checkers stay
sharp all night"`, `"Every elf is half as tired"`. `Stops` is `"a faulty update"`, which the
  page puts after "Stops". `Risk` keeps the form `"may be faulty, about 1 in 5"`, from which the
  page takes the "1 in 5".

- `openCase` is `{ id, title }` for the first decision still waiting for an answer, or `null`; a
  decision can be answered while half-time is open.

## News

Every item has `id`, `t`, `kind` and `text`; some carry more. During play no item suggests
something only half-time sells.

| Kind          | Extra fields                                                                               | When                                                   |
| ------------- | ------------------------------------------------------------------------------------------ | ------------------------------------------------------ |
| `checked`     | `check: { wish, wanted, made, result, seconds, by }`                                       | A checker finished checking a gift                     |
| `loaded`      | `check: { wish, wanted, made, result }`, `cause`, `control`, `action`, `caseId` (optional) | A wrong gift landed on the sleigh                      |
| `consequence` | `about`, `facts: { seconds, checked, caught, estimatedAvoided, waiting, money }`           | A setting or decision reports what it did              |
| `case`        | `caseId`                                                                                   | A decision was raised                                  |
| `resolved`    | `caseId`, `option`, `outcome: { seconds, money, parcels }`                                 | A decision closed                                      |
| `update`      |                                                                                            | An update was installed on the toy machine             |
| `noticed`     | `by`: `"watcher"`, `"checker"` or `"sleigh"`                                               | The faulty update became known                         |
| `rolledBack`  |                                                                                            | The rollback finished                                  |
| `recalled`    | `count`                                                                                    | Wrong gifts came off the sleigh                        |
| `relaxed`     | `elf`, `station`                                                                           | Checkers, or elves on Assist, started to trust the AI  |
| `trained`     |                                                                                            | Training was bought at half-time                       |
| `tired`       | `elf`                                                                                      | An elf burnt out                                       |
| `rested`      | `elf`, `station`                                                                           | A rested elf left cocoa for a station                  |
| `blocked`     | `station`                                                                                  | A station stopped because the next pile is full        |
| `lost`        | `count`                                                                                    | Letters were lost to a full pile                       |
| `behind`      | `station`                                                                                  | The pace falls short and elves at a station hold it up |
| `milestone`   | `right`                                                                                    | The sleigh passed 25, 50, 75 or 89 correct gifts       |
| `cleared`     | `queue`                                                                                    | A pile that was more than half full has been emptied   |
| `halftime`    | `right`, `wrong`                                                                           | Half-time began                                        |
| `chose`       | `option`, `outcome: { money, seconds, gained }`                                            | The player picked a half-time option                   |
| `departed`    | `right`, `wrong`, `target`, `stars`, `reason`                                              | The sleigh left; the game is over                      |
| `budgetLow`   | `left`                                                                                     | A quarter of the budget or less is left, said once     |

A `relaxed` item names the elf who trusts the AI most and what to do now, for example
`"Tinsel is trusting the AI and skipping checks. Send Tinsel for a cocoa break or swap in another elf."`
(on Assist: "trusting the AI's drafts and missing mistakes"). `elf` and `station` say who and
where. It always names the elf and station `vigilance.swap` names at that moment: it is said when
the prompt first names an elf, at most one every 12 seconds, and never in the first 12 seconds.
`vigilance.swap` says whether the drift is still there.

### A wrong gift says what to do now

A `loaded` item's `text` is the wrong gift and then one action open to the player at that moment,
for example `"A wrong gift is on the sleigh. Jack will get a full-sized galleon, not a toy pirate ship. Big gifts need an elf, so put Toys on Assist."`.
Its `control` is the control to highlight and `action` a few words naming the action, for a tag
on that control. Following the advice never sends a station back to working by hand, and it asks
for Assist only for a big gift, where the AI has least experience. A slip on an everyday gift,
as rare as an elf's, asks for nothing ("Keep going"):

| `control`      | When                                                                               | Text                                                                                                                            | `action`                   |
| -------------- | ---------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- | -------------------------- |
| `checking`     | A risky gift went out unchecked while checking was on Random                       | `Big gifts need an elf, so set Checking to Riskiest.` (big gift) or `Set Checking to Riskiest.`                                 | `Check more`               |
| `cocoa`        | A tired elf working by hand mixed the gift up                                      | `Tired elves mix gifts up, so send them for a cocoa break.`                                                                     | `Rest tired elves`         |
| `ai:0`, `ai:1` | The AI got a big gift wrong on Automate at reading or toy making                   | `Big gifts need an elf, so put Toys on Assist.`                                                                                 | `Use Assist for big gifts` |
| `cocoa`        | An elf on Assist passed the wrong draft while trusting the AI                      | `One of the elves at Toys, Pip, had stopped checking the AI's drafts. Swap in another elf.`                                     | `Swap Pip`                 |
| `cocoa`        | An elf on Assist passed it while tired                                             | `Tired elves miss the AI's mistakes, so send them for a cocoa break.`                                                           | `Rest tired elves`         |
| `checking`     | A rare slip on an everyday gift went out unchecked                                 | `Keep going. On everyday gifts, the AI is as reliable as your elves.` or `Keep going. Even a fresh elf mixes up 1 gift in 200.` | `Keep going`               |
| `checking`     | Any other gift went out unchecked (a faulty update's train)                        | `Set Checking to All for a while.`                                                                                              | `Check all for now`        |
| `cocoa`        | A checker waved it through while trusting the AI                                   | `One of the checkers, Tinsel, had stopped checking properly. Swap in another elf.`                                              | `Swap Tinsel`              |
| `cocoa`        | A checker missed it while a checker was tired                                      | `Tired checkers miss more mistakes, so send them for a cocoa break.`                                                            | `Rest the checkers`        |
| `decide`       | A wish the player read wrongly went out unchecked, or past a sharp, rested checker | `Read the child's clue before you pick.`                                                                                        | `Read the clue`            |
| `checking`     | A sharp, rested checker missed it                                                  | `Even sharp checkers miss 1 wrong gift in 10, so keep checking the riskiest gifts.`                                             | `Keep checking`            |

The first that applies is used. Tiredness is named only when an elf at that station is tired
(red), and drift names the elf there who trusts the AI most. `decide` has no control to outline
until the next unclear wish, so the page shows only the line.

A wrong gift whose advice was given in the last 12 seconds goes aboard without a new line, so the
player is not asked twice for the same thing; it still shows on the sleigh.

`cause` is the cause id (see Causes). `caseId` is set only when
the faulty update's decision was still waiting for an answer as the gift went aboard.

A `resolved` item's `text` says what the answer did, with the time, money and parcels involved,
for example `"Amir wrote back: a cuddly bat."` or
`"Rolling back for £40: the toy machine stops 5 s."`. A `check` is a copy taken when the check finished.
`by` is `"elf"`. A `consequence` leaves out the facts that do not apply; `about` is `"checking"`,
`"tested"` or `"case"`.

## The end

`end` is set when the sleigh leaves, at the end of the clock or the moment the budget runs out:

```
{ stars: 2, goals: [ ...three goals with their final figures... ],
  right: 89, wrong: 2, lost: 0,
  costs: { ai: 85, checking: 76, halfTime: 60, fixing: 46, mistakes: 129, prevented: 540, total: 396, limit: 660 },
  headline: "Careful, but slow.",
  lesson: { title: "Checking in the right places", text: "Checks went where mistakes were likeliest and dearest." },
  assurance: { ... }, checkingAnswer: "Yes: £76 of checks stopped about £540 of wrong gifts.",
  practices: [ ...five practices... ], causes: [ ...up to three... ],
  blunders: [ { id: "pet-mouse", name: "pet mouse", icon: "🐭" } ], blunderTotal: 27,
  blunderIds: [ "pet-mouse", "oil-drum", ... ],
  reason: "time", leftAt: 0,
  reliability: { everyday: { ai: { made: 190, wrong: 1 }, elves: { made: 12, wrong: 0 } },
                 big: { ai: { made: 64, wrong: 21 }, elves: { made: 0, wrong: 0 } } } }
```

- `reason` is `"time"` when the clock ended the game and `"budget"` when the budget ran out;
  `leftAt` is the whole seconds that were left on the clock then (0 for `"time"`). A game the
  budget ended earns two stars at most, reads `headline: "Out of money."` and its `lesson` is
  `{ title: "Out of money", text }` with `text` one sentence naming where most of the budget went:
  `"Wrong big gifts took £300 of your £660 budget."`, `"The faulty update's trains took £N..."`,
  `"Making and fixing wrong gifts took £N..."`, `"Checks took £N..."`,
  `"Running the AI took £N..."` or `"The half-time change took £N..."`. Wrong gifts and fixing them
  (recalls, remakes, a rollback) are weighed together. Gifts such a game did not reach are not
  counted against the checkers: the dial reads its money figures only, never a bottleneck.
- `reliability` is `{ everyday, big }`, each `{ ai, elves }`, each `{ made, wrong }`. It counts
  jobs, where a job is one letter read or one toy made: `made` is the jobs that worker did on that
  kind of gift and `wrong` how many of those it did wrongly, counted before any confirmation or
  check, caught or not. By hand the job is the elves'; on Automate and on Assist it is the AI's
  (the elf's confirmation is a check, and a draft the elf corrected is still a wrong AI job); a
  faulty update's wrong toys are wrong AI jobs, an elf's mix-up is a wrong elf job, and a player's
  wrong pick on an unclear wish is nobody's job. Zero jobs is `{ made: 0, wrong: 0 }`.

- `stars`: 0 to 3, one for each goal met. `goals`: the three goals as in `run.goals`, final.
- `right`, `wrong`: gifts delivered. `lost`: letters lost to a full pile plus unclear letters
  still undecided.
- `costs`: `{ ai, checking, halfTime, fixing, mistakes, prevented, total, limit }`. `fixing` is
  remakes, recalls and a rollback; `mistakes` what the wrong gifts delivered cost; `total` the
  final cost so far (the cost goal's figure, at or just over `limit` when the budget ended the
  game and under it otherwise); `limit` the budget; `prevented` an estimate of what the mistakes
  checking stopped would have cost; the page labels it as an estimate.
- `headline` is a few words without figures and `lesson` `{ title, text }` the one lesson under
  it. The lesson names one loss, and only a loss that cost a goal: the sleigh fell short, tiredness
  held it up, wrong gifts cost the Minimal mistakes goal, or the budget ran out. The headline names
  the same loss: "Careful, but slow." (short), "Slow and wrong." (short with more wrong gifts
  than allowed), "Slow, with too few checks." (short, and the dial reads too little), "Too tired
  to keep up." (tiredness), "Fast, but wrong." (wrong gifts on a full sleigh), "Too many wrong
  gifts." (wrong gifts, sleigh short) or "Out of money." (the budget ended the game).
  "Christmas, carefully delivered." is for three stars, and the lesson is then a tip. A headline
  praises care only when the Minimal mistakes goal was not lost to too many wrong gifts and the dial
  does not read too little.
- `checkingAnswer` is one sentence answering "Was checking worth it?", always in the dial's
  direction:
  - "about right": "Yes: £208 of checks stopped about £400 of wrong gifts." or, when the checks
    stopped less than they cost, "Mostly: ..."; on three stars "Yes: checks kept the wrong gifts
    aboard to 3, though they stopped only about £36 this time." It never starts "No" on three stars.
  - "too little": "Yes, but too few: ..., and more checks on big gifts would have paid too." or
    "Too few: ...; more checks on big gifts would have paid."
  - "too much": "Mostly: ..., but the checks on everyday gifts cost more than they saved." or "No:
    ...; fewer checks would have done."
  - "bottleneck": "Not as run: ..., but the pile held back 23 gifts."
  - A game that lost the Minimal mistakes goal with wrong gifts that went past trusting or tired
    checkers reads "Not as run: £172 of checks stopped about £0 of wrong gifts. Trusting checkers
    waved 3 wrong gifts through." with "Tired checkers missed 2 wrong gifts." as a sentence of its
    own when that happened too. Those wrong gifts count as lost to too few checks, so the dial
    then reads "too little" when they cost £60 or more. When checks also cost the budget, the
    larger figure decides, and "too much" reads "No: £460 of checks stopped only about £120 of
    wrong gifts. Tired checkers missed 3 wrong gifts." The answer never advises fewer checks on a
    game that lost the Minimal mistakes goal.
- `blunders` is `[{ id, name, icon }]`: the absurd wrong toys this game produced, caught or not.
  `blunderTotal` is how many different ones exist, so the page can keep a collection across games.
  `blunderIds` lists the id of every one that exists now, so the page can drop a stored blunder
  that an older build knew under another name and never count more found than exist.

### Practices

`end.practices` is always these five, in this order, each
`{ id, name, used, actions, note }`; each action is `{ id, label, used, figure }`. `figure` is the
player's own figure for that action; `note` is `null` except on `risk-check`. Draw one
tile per practice and one line per action, with its figure.

| `id`            | `name`                            | actions: `id`, `label`, example `figure`                                                                                                                                                                                                                                                                                                                                      | `note` example                                             |
| --------------- | --------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| `human-in-loop` | `Augmentation not automation`     | `assist`, "Elves confirmed the AI's drafts", "45 of 90 s on Assist" (of the seconds played)                                                                                                                                                                                                                                                                                   | `null`                                                     |
| `risk-check`    | `Proportionate inspections`       | `risky`, "Checked the riskiest gifts", "90 s on Riskiest, 3 of 7 mistakes caught"                                                                                                                                                                                                                                                                                             | "Wrong gifts hurt Santa's reputation. 2 reached children." |
| `escalate`      | `Human in the loop`               | `decided`, "Read the unclear wishes yourself", "Answered 2 of 2, 2 of them right" / "Answered 1 of 2, 0 of them right, 1 left unanswered"                                                                                                                                                                                                                                     | `null`                                                     |
| `test-release`  | `Test, monitor and feedback`      | `tested`, "Tested the update first", "The test passed" / "The test was still running" / "Installed straight away, untested" / "No update installed"; `rolledBack`, "Rolled back a faulty update", "Rolled back after 9 wrong trains"; `recalled`, "Brought wrong gifts back off the sleigh", "2 wrong gifts brought back for £202" / "Wrong gifts left aboard" / "Not needed" | `null`                                                     |
| `oversight`     | `Don't lose focus on your people` | `trained`, "Trained the checkers not to simply trust the AI", "4 checks skipped"; `rested`, "Gave the elves a cocoa break", "6 cocoa breaks, 1 burnout"                                                                                                                                                                                                                       | `null`                                                     |

The id `human-in-loop` stays on the Assist practice, while the name "Human in the loop" belongs to
`escalate`; `tests/wording-check.js` holds the two apart.

A practice's `used` is `true` when any of its actions was used. `assist` and `risky` count once
the setting ran for 6 seconds or more; `decided` once the player read an unclear wish; `tested` and `trained`
when bought at half-time; `rolledBack` when the faulty update was rolled back; `rested` when an
elf was sent for cocoa or cocoa for everyone was bought.

### Causes

A cause is `{ id, name, wrong, cost, control, fix }`: up to three, dearest first, in
`end.causes` (the whole game) and `choice.report.causes` (the first half). `wrong` and `cost` count
the wrong gifts it accounts for, `control` is what would have stopped them, and `fix` one short
sentence saying how, leaving out any part the settings already follow (`""` when they follow all
of it), and on the end screen any part that asks for more checks while the dial reads too much. The end screen and the half-time card may mention half-time options.

| `id`       | `name`                                             | Wrong gifts from                                        | `control`  |
| ---------- | -------------------------------------------------- | ------------------------------------------------------- | ---------- |
| `picked`   | Unclear wishes you read wrongly                    | unclear wishes the player read wrongly                  | `decide`   |
| `big`      | Big gifts the AI made with no person looking       | the AI's wrong big gifts that went out unchecked        | `checking` |
| `misread`  | Rare slips by the AI when reading everyday letters | the AI's slips on everyday letters, as rare as an elf's | `checking` |
| `misMade`  | Rare slips by the AI when making everyday toys     | the AI's slips on everyday toys, as rare as an elf's    | `checking` |
| `waved`    | Checkers stopped looking                           | checkers who skipped or missed them                     | `train`    |
| `faulty`   | The faulty update                                  | the faulty update                                       | `update`   |
| `tired`    | Gifts tired elves mixed up                         | tired elves working by hand                             | `cocoa`    |
| `slip`     | Gifts a fresh elf mixed up                         | ordinary mix-ups by fresh elves working by hand         | `checking` |
| `recalled` | Wrong gifts brought back off the sleigh            | wrong gifts brought back off the sleigh                 | `checking` |

The rare slips (`misread`, `misMade`, `slip`) have `fix: ""`: there is nothing to change, and no
cause ever asks for Assist on everyday gifts.

A gift that went past a checker counts under `waved` whatever made it wrong, and one from the
faulty update under `faulty`. A recall is a cause of its own: `wrong` is the gifts brought back
and `cost` what bringing them back cost; it always shows among the three.

### The assurance summary

`end.assurance` says whether checking came out too little, about right or too much in this game,
in the game's own money. It describes how this game turned out, not whether a choice was wise
beforehand: a risky batch can happen to come out clean.

| Field                    | Type    | Example                      | Meaning                                                                                 |
| ------------------------ | ------- | ---------------------------- | --------------------------------------------------------------------------------------- |
| `verdict`                | string  | `"about right"`              | `"too little"`, `"about right"`, `"too much"` or `"bottleneck"`                         |
| `position`               | number  | `0.61`                       | 0 to 1 for a dial: 0 far too little, 0.5 about right, 1 far too much                    |
| `thresholds`             | object  | `{ little: 0.1, much: 0.8 }` | The positions where the verdict changes, for drawing the dial's zones                   |
| `underCost`              | number  | `0`                          | Lost to too few checks (estimate, below); show it under that name                       |
| `overCost`               | number  | `10`                         | Lost to too many checks (estimate, below): `overChecks` plus `overHeld`                 |
| `overChecks`             | number  | `10`                         | The part on checks that cost more than they stopped; never more than `costs.checking`   |
| `overHeld`               | number  | `0`                          | The part on gifts held back while every gift was checked, £6 each                       |
| `wrongMade`              | number  | `16`                         | Wrong toys the workshop made in the whole game                                          |
| `caught`, `prevented`    | number  | `5`, `500`                   | Wrong toys stopped before the sleigh, and about what they would have cost (an estimate) |
| `shipped`, `shippedCost` | number  | `6`, `72`                    | Wrong gifts that reached children, checked or not, and what they cost                   |
| `held`                   | number  | `65`                         | Gifts held back by checking (below), the figure the bottleneck `text` names             |
| `tired`                  | boolean | `true`                       | A bottleneck where tiredness took a quarter or more of the checkers' working time       |
| `spent`                  | number  | `22`                         | £ on checking and training                                                              |
| `groups`                 | array   | see below                    | One row per kind of gift                                                                |
| `noChecks`               | object  | `{ wrong: 16, cost: 720 }`   | Every wrong toy made, and about what they would have cost had none been checked         |
| `text`                   | string  |                              | One sentence: the verdict with the two estimates                                        |

- `underCost` is the avoidable part of the wrong gifts that reached children without a check
  (never sent for one), plus the recalls of such gifts. For each
  kind of gift, the avoidable part is what its unchecked wrong gifts cost beyond what checking
  every unchecked parcel of that kind would have cost. A mistake that slipped past a fresh checker who
  did look is not counted here. One that relaxed checkers waved through or tired ones missed counts
  only in a game with more than 1 wrong gift aboard.
- A gift is held back by checking when it is in the checking pile as the sleigh leaves, or a toy
  order stuck behind a full checking pile then, or a letter lost to a full letter pile while
  checking was the station holding up the line (`pace.slowest` 2). Each is worth £6.
- `overCost` is the checking money spent on checks actually done, on kinds of gift where they cost
  more than the mistakes they stopped, plus £6 for each gift held back while every gift was being
  checked. Checks paid for but waved through by trusting checkers are checking not done properly,
  not too much checking, and are left out.
- `position` is `overCost / (underCost + overCost)`, pulled toward 0.5 when the two together are
  small against the budget: `0.5 + (share - 0.5) * lost / (lost + 0.1 * budget)`, rounded
  to two places. Below `thresholds.little` the verdict is `"too little"`, above
  `thresholds.much` `"too much"`, and `"about right"` between.
- The game's losses are compared once, in pounds: the wrong gifts delivered; gifts held back by
  checking every gift (over-checking); gifts held back while only some gifts were checked (a
  bottleneck); and other letters lost to a full pile. Held and lost gifts count only when the game
  fell short of its target, and those held back while only some were checked, and lost letters,
  only when the smaller of their number and the shortfall is 15% of the target or more. Wrong gifts
  count when the Minimal mistakes goal was missed or they cost 30% of the budget or more. The
  headline, the dial and the lesson follow the largest loss that passes its gate. When the
  bottleneck is the largest, `verdict` is `"bottleneck"` and `text` names the gifts held back and
  the fix: rest the checkers with cocoa when `tired`, else move an elf to checking. When
  over-checking is the largest, `verdict` is `"too much"`. When checking stayed on a few all
  game the verdict is never `"too much"`: the player checked as little as the game allows.
- The dial measures checking by its own two figures and is never moved to fit the headline. When
  one of `underCost` and `overCost` is three times the other and at least £60, the verdict is that
  side ("too little" or "too much") whatever the rest of the bill. On three stars it reads "about
  right": neither too much nor too little checking cost a star. A game that lost a star to
  checking never reads "about right", judged by the raw figures: when the budget ran out and
  `overCost` is £60 or more it reads "too much", and when more than 1 wrong gift went aboard and
  `underCost` is £60 or more it reads "too little" (the larger figure decides when both hold).
  In such a game `underCost` includes the wrong gifts that trusting checkers waved through or tired
  ones missed. A needle that reads "about right" sits at least 0.05 inside both thresholds. Otherwise a game that
  lost the Minimal mistakes goal never reads "too much". The words follow the dial instead.
- The one figure for what wrong gifts cost is `costs.mistakes` (the wrong gifts aboard at
  departure, the same as in `cost.spent`). `underCost` and `overCost` are estimates of something
  else and are named so: "Lost to too few checks (estimate)" and "Lost to too many checks
  (estimate)". `text` reads, for example, "Too little checking: about £664 lost to too few checks,
  against about £44 lost to too many checks." Under the too-many figure the page may show its parts,
  for example "£176 extra checks, £498 gifts held up", from `overChecks` and `overHeld`.
- A group is `{ id, name, icon, parcels, wrongMade, checked, caught, shipped, checkCost, prevented, shippedCost, shippedUnchecked, shippedUncheckedCost, verdict, text }`
  for `id` `"everyday"`, `"big"` or `"unclear"` (the two unclear letters; one that is also big
  counts as big), for example
  `{ id: "big", name: "Big gifts", icon: "📦", parcels: 7, wrongMade: 6, checked: 6, caught: 5, shipped: 0, checkCost: 12, prevented: 500, shippedCost: 0, shippedUnchecked: 0, shippedUncheckedCost: 0, verdict: "paid", text: "Checking 6 big gifts cost £12 and stopped about £500 of wrong gifts." }`.
  `verdict` is `"left exposed"`, `"cost more than it saved"` or `"paid"`. The unclear wishes'
  `text` counts the player's readings: "2 of 2 decided; no wrong ones." or
  "2 of 2 decided; 1 wrong one cost £12.".
- `end.lesson` and the verdict agree: a "Too much checking" lesson shows only when the dial reads
  too much, "Too little checking" only when it reads too little, and "Checking in the right places"
  only with "about right".

## Texts

Every text is complete, plain British English (`docs/adr/0021-write-every-text-as-plain-sentences.md`).
The rules send each text in the form the player reads, so the page adds nothing to these:

- Whole sentences, with their capital and full stop: every news `text`, a decision's `text`, the
  lesson, a cause's `fix`, the dial's `text`, a half-time option's `text`, `blocked` on stations and
  queues, a lever's `summary`, and the AI switches' `cost` under `actions`.
- Labels and chips, with a capital and no full stop: option `why`, a recall's `goal`, the faulty
  update options' `scope`, the half-time `Gives` value, practice names, labels and figures, cause
  names, fact labels and the `action` tag of a wrong gift. `focus.text` is a tag in lower case
  ("add another elf").

A few are clauses in lower case that the page builds a sentence around:

| Field                               | Example                                                          | The page makes                                   |
| ----------------------------------- | ---------------------------------------------------------------- | ------------------------------------------------ |
| lever `sends`                       | "checkers look at every gift"                                    | "{Sends}. That is {per100} in 100 gifts."        |
| recall `scope`                      | "costs £50 more and keeps the checkers busy for about 4 seconds" | "{label}: {scope}."                              |
| goal `text`                         | "spend less than the £660 budget"                                | a sentence, or a clause after a comma            |
| checking `cost` under `actions`     | "each check takes a checker about 5 seconds and costs £4"        | a sentence, with a capital and a full stop       |
| fact `value`                        | "takes 5 seconds and costs £40"                                  | "{label}: {value}."                              |
| half-time `Stops` and `Risk` values | "a faulty update", "may be faulty, about 1 in 5"                 | "Stops a faulty update", "May be faulty: 1 in 5" |

The page reads words out of four texts, so these stay as they are: the "N in N" in the half-time
`Risk` value, the words "checkers busy" in a recall's `scope`, the word "star" in a recall's
`goal` (a star chip) with "Loses" at its start for a lost star, and the words "checkers" or
"at {station}" in a wrong gift's news line (to outline that crew). An elf's `doing` keeps its
first word as the task word under the elf, and "nothing to do" is compared as it stands.
`tests/wording-check.js` fails on a semicolon, on "s" for seconds outside the practice figures,
and on any of the clipped wordings the copyedit replaced.

## Behaviour the page relies on

- When the checking pile is full the line waits; nothing lets gifts past it, and `focus` names
  what frees it: another elf at Checking, or checking fewer when every gift is checked by three
  elves or more. Relaxed checkers who wave a gift through are counted in `vigilance.skipped`.
- A cocoa break from tired to fresh takes about 2 seconds. Once fully rested (at least 2 seconds
  after it sat down) an elf on cocoa leaves by itself, with a `rested` news item saying where. It
  goes back to the station it came from unless that station clearly does not need it (it works on
  Automate, or keeps two elves or more with every pile under half full, and for Checking the To
  check pile is not growing) and another station needs an elf, as `focus` would name it. A need
  one rested elf has gone to is left to it for 3 seconds, so two elves rested together do not both
  answer it. Nobody is left on a break. A `tired` news item means an elf burnt
  out; it comes back by itself after 9 seconds, still tired. An elf working without rest burns out
  for the first time about 66 seconds in; a player who rests elves when they turn red sees about
  one burnout a game.
- An elf confirming an AI draft on Assist catches 95 in 100 wrong ones while sharp and rested. A
  checker catches 90 in 100. Both miss more as they tire. A caught mistake takes 6 clean gifts
  off the trust of the elves who caught it, so checkers who drifted on the clean everyday gifts
  of the first half sharpen again once the big gifts bring mistakes, unless they have stopped
  looking altogether.
- An elf's slip by hand is a mix-up: the child gets another child's toy of the same kind, drawn
  per parcel from the seed. It is never one of the AI's blunders and never joins `end.blunders`.
- `pace.projected` is smoothed over about nine seconds; a player action works it out afresh.
- Every option closes its decision at once: pick a reading, roll back, keep running, bring back,
  leave.
