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
setChecking(level)                // which gifts go to the checking pile: 0 a few, 1 the risky ones, 2 all
resolve(caseId, optionId)         // answer the open decision
choose(optionId)                  // pick one option at half-time: "update", "tested", "train", "rest" or "none"
```

Each action returns `true` when it took effect and `false` when it is not possible (for example
`move` on a burnt-out elf, `resolve` on a decision that is not open, `choose` when half-time is not
open). Every control works from t = 0. Page code must cope with a field being absent (`?.`, `??`).

## The game

One sleigh is filled over two halves of 75 seconds (`duration` 150). At t = 75 the rules stop and
`choice` holds the half-time card until `choose(optionId)` is called. The sleigh leaves at t = 150,
or the moment the budget runs out: `end` is set and nothing moves after that.

- Letters arrive at 0.6 a second for the first 15 seconds, then 1.1 a second, and stop 15 seconds
  before the end so the last ones can still reach the sleigh.
- The first half carries everyday gifts only. The second half carries mostly big gifts (6 in 10),
  the first of them 8 seconds in, so there is time to act on the half-time card.
- On everyday gifts the AI is as reliable as a fresh elf, at reading and at making (1 job in 200
  wrong), and it never tires. On big gifts it is poor: it misreads about 1 in 7 and makes about 1
  in 2 wrong. An elf confirming a draft on Assist, or a check, catches most of those. So
  automating is right in the first half, and the second half needs people on the big gifts
  (`docs/adr/0019-make-the-ai-reliable-on-everyday-gifts.md`).
- One unclear letter arrives in each half, at a seeded time 12 to 40 seconds into the half, from
  a pool of ten children and wishes (Timmy's little train among them). It raises a decision at once
  (below). All other letters are clear.
- Three goals, one star each, for the whole game: `full` (Full sleigh, 145 right gifts aboard),
  `right` (Few mistakes, at most 3 wrong gifts aboard) and `cost` (Within budget, some of the
  £900 budget left when the sleigh leaves). `right` and `cost` count only once the sleigh holds
  102 right gifts (`goalsCountFrom`), so a slow sleigh earns nothing for being cheap and clean.
- There is one money figure, the cost so far (`cost.spent`), counted against a budget of £900
  (`cost.limit`). It counts up: the AI's running cost, checks, the half-time purchase, fixes
  (remakes, recalls, a rollback) and what the wrong gifts aboard will cost. The moment it reaches
  the budget the game ends: the sleigh leaves with what is aboard, the Within budget star is lost
  and at most two stars are earned (`docs/adr/0020-end-the-game-when-the-budget-runs-out.md`).
  Nothing the player chooses can end the game by itself: an option the budget cannot cover is
  unavailable.
- The seed is different on every play unless the address fixes it, so the update on offer, the
  unclear letters and the letters differ from game to game.

## What `view()` returns

The target (145), the budget (£900) and `goalsCountFrom` (102) here are examples from the current
balance; the page reads them from `view()`.

The page reads only `view()`. Whether an unrevealed parcel is wrong is left out of it. Money is in
pounds, rounded to whole pounds unless said otherwise. Times are seconds.

| Field          | Type                             | Example                                              | Meaning                                                                                                          |
| -------------- | -------------------------------- | ---------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `t`            | number                           | `40.0000000001`                                      | Seconds played, unrounded                                                                                        |
| `duration`     | number                           | `150`                                                | Seconds in the whole game                                                                                        |
| `target`       | number                           | `145`                                                | Right gifts the sleigh needs for the Full sleigh star                                                            |
| `elves`        | array of elf                     | see below                                            | The eight elves, always in the same order                                                                        |
| `ai`           | `[number, number]`               | `[2, 1]`                                             | AI level at reading and at toy making: 0 by hand, 1 Assist, 2 Automate                                           |
| `checking`     | number                           | `1`                                                  | 0 a few, 1 the risky ones, 2 all                                                                                 |
| `levers`       | object                           | see below                                            | What each lever position does now                                                                                |
| `stations`     | array of 3 station               | see below                                            | Reading, toy making, checking                                                                                    |
| `queues`       | object of queue                  | see below                                            | `letters`, `orders`, `check`, `pass`, `rework`                                                                   |
| `vigilance`    | object                           | see below                                            | How far the elves have come to trust the AI                                                                      |
| `case`         | decision or `null`               | see Decisions                                        | The open decision                                                                                                |
| `casesWaiting` | number                           | `1`                                                  | Decisions waiting behind the open one                                                                            |
| `choice`       | half-time or `null`              | see Half-time                                        | Set only while half-time is open                                                                                 |
| `run`          | object                           | see below                                            | The one sleigh: half, clock, gifts aboard, goals                                                                 |
| `cost`         | `{ spent, limit, left, low }`    | `{ spent: 79, limit: 900, left: 821, low: false }`   | The budget: cost so far, wrong gifts aboard included, what is left, and whether it runs low                      |
| `focus`        | object or `null`                 | see below                                            | The one thing that most needs the player now                                                                     |
| `sleigh`       | `{ right, wrong, parcels }`      | `{ right: 36, wrong: 1, parcels: [...] }`            | Gifts aboard; `parcels` is every parcel aboard, each with `result`                                               |
| `lost`         | number                           | `0`                                                  | Letters lost: to a full letter pile, or unclear letters undecided at the end                                     |
| `prices`       | `{ wrongEveryday, wrongBig }`    | `{ wrongEveryday: 12, wrongBig: 100 }`               | What a wrong everyday and a wrong big gift cost                                                                  |
| `pace`         | `{ projected, behind, slowest }` | `{ projected: 137, behind: true, slowest: null }`    | Right gifts expected at departure, whether short of the target, the station holding things up (0 to 2) or `null` |
| `incident`     | object or `null`                 | `{ known: true, rollingBack: 0, suspectWaiting: 2 }` | Set once a faulty update is installed (below)                                                                    |
| `actions`      | object                           | see below                                            | For `ai0`, `ai1`, `checking`: whether it works now and what it costs                                             |
| `news`         | array of news                    | see News                                             | Up to 30 items, newest first                                                                                     |
| `end`          | end or `null`                    | see The end                                          | Set when the sleigh has left                                                                                     |

### Elves

An elf is `{ name, station, tired, energy, mood, resting, doing }`, for example
`{ name: "Pip", station: 2, tired: 30, energy: 66, mood: "fresh", resting: false, doing: "checking gifts" }`.

- `name`: string. `station`: 0 to 3 (3 the cocoa break).
- `energy`: number, 0 to 100. 100 is fresh, 0 is burnout; it falls as the elf works and rises on
  cocoa. Draw the energy bar from it: it drains.
- `mood`: `"fresh"` (energy 66 or more: full speed), `"tiring"` (energy 43 to 65: slower),
  `"tired"` (energy 42 or less: slower and slipping) or `"spent"` (burnt out, on a long break).
  Use it for the bar's colour (green, amber, red, empty) and the face.
- `tired`: number, 0 to 100, the same state the other way round: tiredness, with burnout at 88.
  The page should read `energy` and `mood`.
- `resting`: `true` while a burnt-out elf is on its long break, which cannot be cut short. It comes
  back to its station by itself after 15 seconds.
- `doing`: a short phrase: `"reading letters"`, `"confirming the AI's readings"`, `"making toys"`,
  `"confirming the AI's toys"`, `"checking gifts"`, `"loading"` (checkers loading waiting
  gifts onto the sleigh), `"remaking"` (checkers remaking a caught or recalled gift),
  `"nothing to do"`, `"having cocoa"` or `"burnt out"`. Elves at a station on Automate have nothing
  to do there.

### Levers

`levers` is `{ ai0, ai1, checking }`.

- `ai0` (reading) and `ai1` (toy making) each hold three entries, one per level, of
  `{ name, who, speed, risk, everyday, big, perMinute, costPerMinute }`, for example
  `{ name: "Automate", who: "AI works alone", speed: "about 9.2 times as fast", risk: "big gifts: 1 in 7 misread", everyday: "about 1 in 200 misread, same as a fresh elf", big: "about 1 in 7 misread", perMinute: 100, costPerMinute: 43 }`.
  `name` is "By hand", "Assist" or "Automate". `who`, `speed` and `risk` are six words at most;
  `risk` says what to watch for now, from the current state. `everyday` and `big` say how often
  a job goes wrong at that level on each kind of gift, figures first, for the level's information:
  by hand `"about 1 in 200 wrong while fresh"` on both; on Assist and Automate
  `"about 1 in 200 wrong, same as a fresh elf"` on everyday gifts, and on big gifts
  `"about 1 in 2 drafts wrong, an elf catches most"` (Assist) or `"about 1 in 2 wrong"` (Automate).
  Reading says "misread" where toy making says "wrong". `perMinute` is parcels a minute at the
  current staffing, `costPerMinute` the AI's running cost in pounds a minute (0, 13 or 43).
- `checking` holds three entries `{ name, sends, per100 }`, for example
  `{ name: "The risky ones", sends: "elves check big gifts and the ones the AI flagged", per100: 37 }`:
  which gifts the elves check and how many in a hundred that is now.

### Stations and queues

A station is `{ name, staff, working, idle, queues, blocked, rate }`, for example
`{ name: "Checking", staff: 4, working: 4, idle: 0, queues: ["check", "pass", "rework"], blocked: null, rate: 101 }`.
`name` is the station's heading word, `"Letters"`, `"Toys"` or `"Checking"`; every rules line that
points at a station uses it ("Move an elf to Toys", "Pip is rested and back at Letters").
`queues` lists the ids it works on in the order to draw them: station 0 `["letters"]`, station 1
`["orders"]`, station 2 `["check", "pass", "rework"]`. `blocked` is `null` or a short reason such
as `"the toy pile is full"`. `rate` is parcels a minute at its current staffing and AI level.

A queue is `{ id, name, parcels, limit, rate, inflow, trend, progress, blocked }`, for example
`{ id: "check", name: "To check", parcels: [...], limit: 10, rate: 51, inflow: 22, trend: "steady", progress: 0.42, blocked: null, held: 0 }`.
`parcels` are parcels (below), `limit` the pile's size, `rate` parcels a minute at the current
staffing, `inflow` parcels a minute arriving, `trend` `"growing"`, `"steady"` or `"shrinking"`
over the last ten seconds, `progress` 0 to 1 towards the next parcel (unrounded), `blocked` `null`
or a short reason such as `"nobody reading"`, `held` the unclear letters the player has read
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

`vigilance` is `{ state, name, cleanRun, confirming, secondsPerCheck, skipped, trained, swap }`, for
example
`{ state: "careful", name: "sharp", cleanRun: 6, confirming: "sharp", secondsPerCheck: 4.5, skipped: 0, trained: false, swap: null }`.

- `state` is the checkers' state, `"careful"`, `"relaxing"` or `"waving through"`, and `name` the
  word to show: `"sharp"`, `"drifting"` or `"not looking"`. Each elf keeps its own run of clean AI
  gifts seen at its station, and a station reads from the average of its elves. Checkers drift
  after 8 (they check faster and skip half the AI gifts) and stop looking after 20 (they skip nine
  in ten). A caught mistake takes 5 off each checker's run. A cocoa break, a burnout or a move to
  another station starts an elf's run afresh, so swapping in a rested elf pulls a drifting station
  back; training at half-time keeps every elf sharp for the rest of the game.
- `confirming` is the same word for the elves who confirm AI drafts on Assist, at the Assist
  station that trusts the AI most. Every clean draft counts as a clean gift for each confirmer at
  that station; a drifting confirmer passes more wrong drafts.
- `cleanRun` is the checkers' average run of clean AI gifts, `secondsPerCheck` what a check takes now,
  `skipped` how many checks they have skipped, `trained` whether half-time training was bought.
  Training keeps checkers and confirmers sharp for the rest of the game.
- `swap` is the one drift prompt now: `null`, or `{ elf, station, name }`, an elf (its index in
  `elves`) at a drifting station. When a prompt is needed it names the elf who trusts the AI most
  at the checkers if they drift, else at the Assist station that trusts the AI most, and it keeps
  naming that elf while the elf stays there and the station still drifts. It turns `null` the
  moment that elf leaves or the station looks properly again, empties, or is trained, and in the
  first 20 seconds; a new prompt may follow on the next step. Read it on every view to show the
  drift banner, the outline and the card tag on that one elf.

### Run

`run` is `{ half, halves, halfLeft, leavesIn, aboard, target, cargo, goals, goalsCountFrom }`, for
example
`{ half: 1, halves: 2, halfLeft: 35, leavesIn: 110, aboard: 36, target: 145, cargo: { id: "everyday", name: "Everyday gifts", icon: "🎁", text: "The AI matches a fresh elf here. A wrong one costs £12." }, goals: [...], goalsCountFrom: 102 }`.

- `half`: 1 or 2. `halves`: 2. `halfLeft`: whole seconds left in the half under way. While the
  half-time card is up (`choice` set) the first half is over and the second has not begun: `half`
  is 1, `halfLeft` 0 and `cargo` the first half's, until the player chooses. `leavesIn`: whole seconds until the sleigh leaves at the end of the game.
- `aboard`: right gifts on the sleigh, the figure the Full sleigh star counts. Show the sleigh
  count once, from here.
- `cargo`: the half's cargo `{ id, name, icon, text }`: `"everyday"` ("Everyday gifts") in the
  first half, `"big"` ("Big gifts", "The AI gets many of these wrong, and each costs £100.") in the
  second.
- `goals`: always three, in this order, each `{ id, name, now, need, text, met, waiting }`:

  | `id`    | `name`          | `now`                         | `need` | `text`                                            |
  | ------- | --------------- | ----------------------------- | ------ | ------------------------------------------------- |
  | `full`  | `Full sleigh`   | right gifts aboard            | 145    | `145 right gifts`                                 |
  | `right` | `Few mistakes`  | wrong gifts aboard            | 3      | `at most 3 wrong gifts`                           |
  | `cost`  | `Within budget` | cost so far (as `cost.spent`) | 900    | `some of the £900 budget left, wrong gifts count` |

  `met` is whether the star would be earned if the sleigh left now. `waiting` is `true` for a
  `right` or `cost` goal whose figures are within its limit while the sleigh holds fewer than
  `goalsCountFrom` right gifts, so the star is not earned yet; `full` never waits.

- `goalsCountFrom`: 102, the right gifts aboard from which the `right` and `cost` goals count.

### Cost

`cost` is `{ spent, limit, left, low }`, for example
`{ spent: 79, limit: 900, left: 821, low: false }`. `spent` is the one money figure of the game:
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

What costs what: the AI £0.22 a second per station on Assist and £0.72 on Automate; each gift
sent for a check £4, paid as it joins the checking pile whether or not a checker then looks at it
properly; a
remake £3, or £15 for a big gift; a rollback £65; a recall half as much again as its gifts count aboard and at least £40 more than that, remakes
included (£150 for one big gift, £52 for one everyday gift); a wrong everyday gift aboard £12 and a big one £100; the half-time option its
price (update £40, test £50, training £100, cocoa for everyone £50, carry on £0). Reading an
unclear wish costs nothing.

### Focus and actions

`focus` is `null` or `{ station, control, text }`, for example
`{ station: 3, control: "cocoa", text: "rest Holly" }`. `station` is 0 to 3, `control` one of
`"cocoa"`, `"elves"`, `"ai0"`, `"ai1"` or `"checking"`, and `text` four words at most.
When the line has stopped or a pile is full, `focus` names what would free it, ahead of anything
else: the checkers when the checking or waiting-to-load pile is full (`{ station: 2, control:
"elves", text: "needs another elf" }`, or `control: "checking", text: "check fewer"` while every
gift is checked by three elves or more), else the toy makers or readers when their pile is full
or nobody works there (`"elves"`, or `"ai0"`/`"ai1"` with `"try the AI"` while three elves work
it by hand). While a rollback holds the toys up, the other hints apply. A station on Automate is
never named with `"elves"`: the machine works alone there and another elf adds nothing. Its full
pile raises no focus, and a growing pile there, or one held up by a full pile further along, is
left out. The `behind` news line and a rested elf's walk follow the same rule.

`actions` has a key for each of `ai0`, `ai1` and `checking`, each
`{ available, why, cost }`, for example
`{ available: true, why: null, cost: "£13 a minute on Assist, £43 on Automate" }`. `available` is
`false` only after the end; `why` then says why in a few words (`"The sleigh has left"`). `cost` is what using it
costs, in the player's words.

### Incident

`incident` is `null` until a faulty update is installed, then `{ known, rollingBack, suspectWaiting }`:
`known` once an elf confirming toys, the checkers or the sleigh crew spot its full-sized trains,
`rollingBack` seconds of rollback left (0 when not rolling back), `suspectWaiting` known faulty
parcels still in the workshop. A good update never sets it.

## Decisions

A decision ("case") is
`{ id, kind, step, title, text, facts, evidence, affected, options }`, and an unclear
letter also has `stake` and `readings`. At most one is
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
- `evidence` is `[{ parcelId, child, wish, made }]`: the letter for an unclear wish, empty for an
  incident. `child` is the child's name, `made` is `null` until a toy is made.
- `affected` is `{ count, ids }`: the parcels an option could cover.
- `options` is `[{ id, label, seconds, money, risk, scope, why, goal, available }]`, and a recall's
  options also carry `instead` and `extra` (below). `seconds` is
  the time it takes, `money` what it costs, `risk` `null` or the chance (0 to 1) of a wrong gift or
  toy it leaves, `scope` what it does in a few plain words with no semicolon (it may be empty, and
  it never repeats `goal`: read the figures from the fields), `goal` `null` or a few words on what it does to the goals, `available` `false`
  with a short `why` when it cannot be chosen now.
- `stake` (unclear letters only): what a wrong pick costs once aboard, a number of pounds: 12
  for an everyday wish, 100 for a big one, as `prices` shows them. Format it on the page, for
  example `"£12 if wrong"`.
- `readings` (unclear letters only): the two things the wish could mean, each `{ name, art }`, for
  example `[{ name: "cuddly bat", art: "cuddly-bat" }, { name: "cricket bat", art: "cricket-bat" }]`.
  One is the right gift and one the wrong one; their order is drawn per decision from the seed (the
  right one first in about half of them), so it never tells which is right. `name` is the toy's
  short name as `made` shows it, and `art` the key the page already draws toys by: the name in lower
  case with dashes, as `SharedArt.toy` and `PaperArt.toy` look it up and as `blunders` ids read. For
  a card heading the child and the wish in its own words are `evidence[0].child` and
  `evidence[0].wish`.

### Unclear letter

```
{ id: 1, kind: "unclear", step: null, title: "Unclear wish",
  text: "Amir writes: 'A bat, please! I love caves.' It could mean two things.",
  facts: [ { label: "Gift", value: "£12 if wrong", primary: true },
           { label: "Time left", value: "116 s", primary: false } ],
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
  toy pile as the reading picked, without passing a reader. The right pick is made as the right
  gift. The wrong pick is made as the wrong one: a wrong gift like any other, caught by a check 9
  times in 10 if it is sent for one, else aboard under the cause `picked`. A letter the player has
  read is not flagged as risky, so "the risky ones" checks it only when it is a big gift.
- When the toy pile is full the read letter waits for room: it shows as `queues.orders.held`, is
  never dropped, and joins the pile ahead of the letters being read as soon as a toy is made.
- The `resolved` news line says what went on, not whether it was right
  (`"Amir's letter goes on: a cuddly bat."`); a check or the sleigh shows that.
- An unanswered card waits as long as the game lasts: it never answers itself. Its wait is game
  time, so it does not run while a Decide card is open or the game is paused. The half-time card
  names it in `choice.openCase`.

### Faulty update (`step` `"source"`)

Raised once, when a faulty update installed at half-time becomes known, which takes at least one
full-sized train. Facts: `"Trains so far"` (every train it has made, caught or not),
`"Rolling back"` (`"8 s, £65"`), `"Toys a minute"` (`"112 now, 80 after"`), `"Time left"`.
Options: `"rollback"` (the toy machine stops 8 seconds, £65, then the machine is back to its old speed)
and `"keep"` (risk 0.65: the machine keeps making full-sized trains until the sleigh leaves). Both
close at once; the rollback runs in `incident.rollingBack`. Known faulty parcels still in the
workshop are marked `suspect: "batch"`, so checking the risky ones checks them.

### Recall (`step` `"aboard"`)

Raised when wrong gifts aboard exceed the Few mistakes limit, including while a faulty update
is running. At most two recall decisions per game. After leaving gifts aboard, another decision
requires another wrong gift to arrive; answering does not repeat the same decision immediately.
Facts: `"Wrong gifts aboard"`, `"To bring back"`, `"In your cost now"`, `"Time left"`.

The affected gifts are just those above the limit, big gifts first, and never more than the
remake pile has room for. `"bringBack"` removes them from
the sleigh immediately and sends them to the checkers to remake, 4 seconds each and at most 20
in all. It needs a checker, and is unavailable with a reason when too little time remains. The
reputation decision still appears then. `"leave"` keeps them aboard.

Bringing gifts back always costs more than leaving them, so the player pays to protect Santa's
name. Both options carry three money fields: `money` is what the option adds to the cost (the
recall's payment, remakes included), `instead` what those gifts count in the cost now and stop
counting once recalled, and `extra` the difference, `money - instead`, which is the net rise in
`cost.spent`. The recall's `money` is 1.5 times `instead` and at least `instead + 40`, rounded, so
its `extra` is always above zero; leaving has all three at 0. `scope` says the same in words
(`"£50 more, checkers busy about 4 s"`, `"nothing more"`). `goal` shows `"Few mistakes star saved"` or
`"Few mistakes star lost"`. The mistakes star still needs the normal minimum of right gifts to
count.

A recall whose `extra` would take the last of the budget is unavailable, with
`why: "not enough budget left"`, like every option of every decision that costs money (the
rollback too): nothing the player chooses ends the game by itself. Leaving the gifts aboard, and
every option that costs nothing, is always available.

```
options: [ { id: "bringBack", label: "Bring it back", seconds: 4, money: 150, risk: null,
             scope: "£50 more, checkers busy about 4 s", why: null,
             instead: 100, extra: 50, goal: "Few mistakes star saved", available: true },
           { id: "leave", label: "Leave it", seconds: 0, money: 0, risk: null,
             scope: "nothing more", why: null,
             instead: 0, extra: 0, goal: "Few mistakes star lost", available: true } ]
```

A successful recall adds a `recalled` action to the end report's response practice, with its gift
count and price. Its cause and cost also remain in the account.

## Half-time

`choice` is set at t = 75 and the rules stand still until `choose(optionId)`. It is
`{ title, text, report, next, options, openCase }`:

```
{ title: "Half-time", text: "Pick one change before you carry on, or none.",
  report: { aboard: 78, wrong: 0, target: 145, cost: 140, limit: 900, tired: 2, burnouts: 0,
            goals: [ ...three goals as in run.goals... ], causes: [ ...up to three causes... ] },
  next: { cargo: { id: "big", name: "Big gifts", icon: "📦", text: "The AI gets many of these wrong, and each costs £100." },
          text: "Big gifts come next. The AI gets many of these wrong, and each costs £100." },
  options: [ ...five options... ],
  openCase: { id: 2, title: "Unclear wish" } }
```

- `report` is how the sleigh stands: `aboard` right gifts, `wrong` gifts, `target`, `cost` so far
  and its `limit`, `tired` (the share of the working elves' time so far that tiredness took, 0 to
  100), `burnouts` so far, `goals` (as `run.goals`) and `causes` (where the wrong gifts aboard came
  from, see Causes).
- `next.text` is one short sentence pair on what comes next, always
  `"Big gifts come next. The AI gets many of these wrong, and each costs £N."` with N the price of
  a wrong big gift; the page supplies its own headline and shows this as a small line.
  `next.cargo` is the cargo that comes next.
- `options` is always these five, in this order, each `{ id, label, text, facts, available, why }`
  with `facts` at most three `{ label, value }`. `available` is `false`, with
  `why: "not enough budget left"`, for an option whose price would take the last of the budget;
  otherwise `why` is `null`. `choose()` refuses an unavailable option. Carrying on is always
  available:

  | `id`     | `label`                 | `facts` labels                   | Price |
  | -------- | ----------------------- | -------------------------------- | ----- |
  | `update` | `Install the update`    | `Gives`, `Risk`, `Costs`         | £40   |
  | `tested` | `Test the update first` | `Gives`, `Stops`, `Costs`        | £50   |
  | `train`  | `Train the checkers`    | `Gives`, `Checkers now`, `Costs` | £100  |
  | `rest`   | `Cocoa for everyone`    | `Gives`, `Energy now`, `Costs`   | £50   |
  | `none`   | `Carry on`              | `Costs`                          | £0    |

  `update` speeds up the toy machine at once (30 to 60%) and is faulty on half of all games, with
  signs in its `text` that lean the right way; `Risk` gives the chance. `tested` runs four test
  toys and installs the update 20 seconds into the second half only if they all pass. `train`
  keeps checkers and confirmers sharp for the rest of the game. `rest` halves every elf's
  tiredness and ends burnouts. `none` changes nothing. The price is added to the cost so far.
  Each `text` is what the option's information button shows: one or two short plain sentences,
  for example `"The AI makes toys 50% faster. It is a big change that was tested briefly."`.

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
| `milestone`   | `right`                                                                                    | The sleigh passed 25, 50, 75 or 145 right gifts        |
| `cleared`     | `queue`                                                                                    | A pile that was more than half full has been emptied   |
| `halftime`    | `right`, `wrong`                                                                           | Half-time began                                        |
| `chose`       | `option`, `outcome: { money, seconds, gained }`                                            | The player picked a half-time option                   |
| `departed`    | `right`, `wrong`, `target`, `stars`, `reason`                                              | The sleigh left; the game is over                      |
| `budgetLow`   | `left`                                                                                     | A quarter of the budget or less is left, said once     |

A `relaxed` item names the elf who trusts the AI most and what to do now, for example
`"Tinsel is trusting the AI and skipping checks. Send Tinsel for cocoa or swap in another elf."`
(on Assist: "trusting the AI's drafts and missing mistakes"). `elf` and `station` say who and
where. It always names the elf and station `vigilance.swap` names at that moment: it is said when
the prompt first names an elf, at most one every 20 seconds, and never in the first 20 seconds.
`vigilance.swap` says whether the drift is still there.

### A wrong gift says what to do now

A `loaded` item's `text` is the wrong gift and then one action open to the player at that moment,
for example `"Wrong gift: Jack got a full-sized galleon, not a toy pirate ship. Big gifts need a person: put Toys on Assist."`.
Its `control` is the control to highlight and `action` a few words naming the action, for a tag
on that control. Following the advice never sends a station back to working by hand, and it asks
for Assist only for a big gift, where the AI is poor. A slip on an everyday gift that is as rare
as a fresh elf's asks for nothing ("Keep going"):

| `control`      | When                                                                               | Text                                                                                                                             | `action`               |
| -------------- | ---------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- | ---------------------- |
| `checking`     | A risky gift went out unchecked while checking was on a few                        | `Check the risky ones: big gifts need a person.` (big gift) or `Check the risky ones.`                                           | `Check more`           |
| `cocoa`        | A tired elf working by hand mixed the gift up                                      | `Tired elves mix gifts up: send them for cocoa.`                                                                                 | `Rest tired elves`     |
| `ai:0`, `ai:1` | The AI got a big gift wrong on Automate at reading or toy making                   | `Big gifts need a person: put Toys on Assist.`                                                                                   | `Assist for big gifts` |
| `cocoa`        | An elf on Assist passed the wrong draft while trusting the AI                      | `Swap the elves at Toys: Pip had stopped checking the AI's drafts.`                                                              | `Swap Pip`             |
| `cocoa`        | An elf on Assist passed it while tired                                             | `Tired elves miss the AI's slips: send them for cocoa.`                                                                          | `Rest tired elves`     |
| `checking`     | A rare slip on an everyday gift went out unchecked                                 | `Keep going: on everyday gifts the AI slips as rarely as a fresh elf.` or `Keep going: even a fresh elf mixes up 1 gift in 200.` | `Keep going`           |
| `checking`     | Any other gift went out unchecked (a faulty update's train)                        | `Check all for a while.`                                                                                                         | `Check all for now`    |
| `cocoa`        | A checker waved it through while trusting the AI                                   | `Swap the checkers: Tinsel had stopped checking properly.`                                                                       | `Swap Tinsel`          |
| `cocoa`        | A checker missed it while a checker was tired                                      | `Rest the checkers: tired ones miss more.`                                                                                       | `Rest the checkers`    |
| `decide`       | A wish the player read wrongly went out unchecked, or past a sharp, rested checker | `Read the child's clue before you pick.`                                                                                         | `Read the clue`        |
| `checking`     | A sharp, rested checker missed it                                                  | `Keep checking the risky ones: even sharp checkers miss 1 in 10.`                                                                | `Keep checking`        |

The first that applies is used. Tiredness is named only when an elf at that station is tired
(red), and drift names the elf there who trusts the AI most. `decide` has no control to outline
until the next unclear wish, so the page shows only the line.

A wrong gift whose advice was given in the last 20 seconds goes aboard without a new line, so the
player is not asked twice for the same thing; it still shows on the sleigh.

`cause` is the cause id (see Causes). `caseId` is set only when
the faulty update's decision was still waiting for an answer as the gift went aboard.

A `resolved` item's `text` says what the answer did, with the time, money and parcels involved,
for example `"Amir wrote back: a cuddly bat."` or
`"Rolling back for £65: the toy machine stops 8 s."`. A `check` is a copy taken when the check finished.
`by` is `"elf"`. A `consequence` leaves out the facts that do not apply; `about` is `"checking"`,
`"tested"` or `"case"`.

## The end

`end` is set when the sleigh leaves, at the end of the clock or the moment the budget runs out:

```
{ stars: 2, goals: [ ...three goals with their final figures... ],
  right: 145, wrong: 3, lost: 0,
  costs: { ai: 141, checking: 126, halfTime: 100, fixing: 76, mistakes: 215, prevented: 900, total: 658, limit: 900 },
  headline: "Careful, but slow.",
  lesson: { title: "Checking in the right places", text: "Checks went where mistakes were likeliest and dearest." },
  assurance: { ... }, checkingAnswer: "Yes: £126 of checks stopped about £900 of wrong gifts.",
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
  `"Wrong big gifts took £400 of your £900 budget."`, `"The faulty update's trains took £N..."`,
  `"Wrong gifts and putting them right took £N..."`, `"Checks took £N..."`,
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
  held it up, wrong gifts cost the Few mistakes goal, or the budget ran out. The headline names
  the same loss: "Careful, but slow." (short), "Slow, and wrong." (short with more wrong gifts
  than allowed), "Slow, with too few checks." (short, and the dial reads too little), "Too tired
  to keep up." (tiredness), "Fast, but wrong." (wrong gifts on a full sleigh), "Too many wrong
  gifts." (wrong gifts, sleigh short) or "Out of money." (the budget ended the game).
  "Christmas, carefully delivered." is for three stars, and the lesson is then a tip. A headline
  praises care only when the Few mistakes goal was not lost to too many wrong gifts and the dial
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
  - A game that lost the Few mistakes goal with wrong gifts that went past trusting or tired
    checkers reads "Not as run: £172 of checks stopped about £0 of wrong gifts, because trusting
    checkers waved 3 wrong gifts through." (or "tired checkers missed 2"); the dial then reads
    "about right" or "too little". The answer never advises fewer checks on a game that lost the
    Few mistakes goal.
- `blunders` is `[{ id, name, icon }]`: the absurd wrong toys this game produced, caught or not.
  `blunderTotal` is how many different ones exist, so the page can keep a collection across games.
  `blunderIds` lists the id of every one that exists now, so the page can drop a stored blunder
  that an older build knew under another name and never count more found than exist.

### Practices

`end.practices` is always these five, in this order, each
`{ id, name, used, actions, note }`; each action is `{ id, label, used, figure }`. `figure` is the
player's own figure for that action; `note` is `null` except on risk-based checking. Draw one
tile per practice and one line per action, with its figure.

| `id`            | `name`                                 | actions: `id`, `label`, example `figure`                                                                                                                                         | `note` example                                      |
| --------------- | -------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------- |
| `human-in-loop` | `Human in the loop`                    | `assist`, "Elves confirmed the AI's drafts", "Assist for 75 of 150 s" (of the seconds played)                                                                                    | `null`                                              |
| `risk-check`    | `Risk-based checking`                  | `risky`, "Checked the risky ones", "150 s on the risky ones; 3 of 7 mistakes caught"                                                                                             | "Wrong gifts cost Santa trust: 2 reached children." |
| `escalate`      | `Ask a person when unsure`             | `decided`, "Read the unclear wishes yourself", "decided 2 of 2, 2 right" / "decided 1 of 2, 0 right; 1 left unanswered"                                                          | `null`                                              |
| `test-release`  | `Test before release, keep a way back` | `tested`, "Tested the update first", "the test passed" / "installed untested" / "no update installed"; `rolledBack`, "Rolled back a faulty update", "rolled back after 9 trains" | `null`                                              |
| `oversight`     | `Keep human oversight sharp`           | `trained`, "Trained the checkers not to just defer to AI", "4 checks skipped"; `rested`, "Gave the elves a cocoa break", "6 cocoa breaks, 1 burnout"                             | `null`                                              |

A practice's `used` is `true` when any of its actions was used. `assist` and `risky` count once
the setting ran for 10 seconds or more; `decided` once the player read an unclear wish; `tested` and `trained`
when bought at half-time; `rolledBack` when the faulty update was rolled back; `rested` when an
elf was sent for cocoa or cocoa for everyone was bought.

### Causes

A cause is `{ id, name, wrong, cost, control, fix }`: up to three, dearest first, in
`end.causes` (the whole game) and `choice.report.causes` (the first half). `wrong` and `cost` count
the wrong gifts it accounts for, `control` is what would have stopped them, and `fix` one short
sentence saying how, leaving out any part the settings already follow (`""` when they follow all
of it), and on the end screen any part that asks for more checks while the dial reads too much. The end screen and the half-time card may mention half-time options.

| `id`       | `name`                                       | Wrong gifts from                                        | `control`  |
| ---------- | -------------------------------------------- | ------------------------------------------------------- | ---------- |
| `picked`   | Unclear wishes you read wrongly              | unclear wishes the player read wrongly                  | `decide`   |
| `big`      | Big gifts the AI made with no person looking | the AI's wrong big gifts that went out unchecked        | `checking` |
| `misread`  | Rare AI slips reading everyday letters       | the AI's slips on everyday letters, as rare as an elf's | `checking` |
| `misMade`  | Rare AI slips making everyday toys           | the AI's slips on everyday toys, as rare as an elf's    | `checking` |
| `waved`    | Checkers stopped looking                     | checkers who skipped or missed them                     | `train`    |
| `faulty`   | The faulty update                            | the faulty update                                       | `update`   |
| `tired`    | Gifts tired elves mixed up                   | tired elves working by hand                             | `cocoa`    |
| `slip`     | Gifts a fresh elf mixed up                   | ordinary mix-ups by fresh elves working by hand         | `checking` |
| `recalled` | Wrong gifts brought back off the sleigh      | wrong gifts brought back off the sleigh                 | `checking` |

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
  every unchecked parcel of that kind would have cost. A mistake that slipped past a checker who
  did look, or that relaxed checkers waved through, is not counted here.
- A gift is held back by checking when it is in the checking pile as the sleigh leaves, or a toy
  order stuck behind a full checking pile then, or a letter lost to a full letter pile while
  checking was the station holding up the line (`pace.slowest` 2). Each is worth £6.
- `overCost` is the checking money spent on checks actually done, on kinds of gift where they cost
  more than the mistakes they stopped, plus £6 for each gift held back while every gift was being
  checked. Checks paid for but waved through by trusting checkers are checking not done properly,
  not too much checking, and are left out.
- `position` is `overCost / (underCost + overCost)`, pulled toward 0.5 when the two together are
  small against all the money spent: `0.5 + (share - 0.5) * lost / (lost + 0.1 * spent)`, rounded
  to two places. Below `thresholds.little` the verdict is `"too little"`, above
  `thresholds.much` `"too much"`, and `"about right"` between.
- The game's losses are compared once, in pounds: the wrong gifts delivered; gifts held back by
  checking every gift (over-checking); gifts held back while only some gifts were checked (a
  bottleneck); and other letters lost to a full pile. Held and lost gifts count only when the game
  fell short of its target, and those held back while only some were checked, and lost letters,
  only when the smaller of their number and the shortfall is 15% of the target or more. Wrong gifts
  count when the Few mistakes goal was missed or they cost 30% of the budget or more. The
  headline, the dial and the lesson follow the largest loss that passes its gate. When the
  bottleneck is the largest, `verdict` is `"bottleneck"` and `text` names the gifts held back and
  the fix: rest the checkers with cocoa when `tired`, else move an elf to checking. When
  over-checking is the largest, `verdict` is `"too much"`. When checking stayed on a few all
  game the verdict is never `"too much"`: the player checked as little as the game allows.
- The dial measures checking by its own two figures and is never moved to fit the headline. When
  one of `underCost` and `overCost` is three times the other and at least £100, the verdict is that
  side ("too little" or "too much") whatever the rest of the bill. On three stars it reads "about
  right": neither too much nor too little checking cost a star. On a game that lost the Few mistakes
  goal to too many wrong gifts it never reads "too much". The words follow the dial instead.
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

## Behaviour the page relies on

- When the checking pile is full the line waits; nothing lets gifts past it, and `focus` names
  what frees it: another elf at Checking, or checking fewer when every gift is checked by three
  elves or more. Relaxed checkers who wave a gift through are counted in `vigilance.skipped`.
- A cocoa break from tired to fresh takes about 3 seconds. Once fully rested (at least 3 seconds
  after it sat down) an elf on cocoa leaves by itself, with a `rested` news item saying where. It
  goes back to the station it came from unless that station clearly does not need it (it works on
  Automate, or keeps two elves or more with every pile under half full, and for Checking the To
  check pile is not growing) and another station needs an elf, as `focus` would name it. A need
  one rested elf has gone to is left to it for 5 seconds, so two elves rested together do not both
  answer it. Nobody is left on a break. A `tired` news item means an elf burnt
  out; it comes back by itself after 15 seconds, still tired. An elf working without rest burns out
  for the first time about 110 seconds in; a player who rests elves when they turn red sees about
  one burnout a game.
- An elf confirming an AI draft on Assist catches 95 in 100 wrong ones while sharp and rested. A
  checker catches 90 in 100. Both miss more as they tire. A caught mistake takes 10 clean gifts
  off the trust of the elves who caught it, so checkers who drifted on the clean everyday gifts
  of the first half sharpen again once the big gifts bring mistakes, unless they have stopped
  looking altogether.
- An elf's slip by hand is a mix-up: the child gets another child's toy of the same kind, drawn
  per parcel from the seed. It is never one of the AI's blunders and never joins `end.blunders`.
- `pace.projected` is smoothed over about fifteen seconds; a player action works it out afresh.
- Every option closes its decision at once: pick a reading, roll back, keep running, bring back,
  leave.
