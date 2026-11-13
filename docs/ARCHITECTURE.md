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
bypass()                          // let the gifts waiting for a check go through unchecked
resolve(caseId, optionId)         // answer the open decision
choose(optionId)                  // pick one option at half-time: "update", "tested", "train", "rest" or "none"
```

Each action returns `true` when it took effect and `false` when it is not possible (for example
`move` on a burnt-out elf, `resolve` on a decision that is not open, `choose` when half-time is not
open). Every control works from t = 0. Page code must cope with a field being absent (`?.`, `??`).

## The game

One sleigh is filled over two halves of 75 seconds (`duration` 150). At t = 75 the rules stop and
`choice` holds the half-time card until `choose(optionId)` is called. The sleigh leaves at t = 150:
`end` is set and nothing moves after that.

- Letters arrive at 0.6 a second for the first 15 seconds, then 1.1 a second, and stop 15 seconds
  before the end so the last ones can still reach the sleigh.
- The first half carries everyday gifts (the mix of all clear wishes, about one in five big). The
  second half carries mostly big gifts (6 in 10), where the AI slips more and a mistake costs most.
  This is the only difference between the halves.
- One unclear letter arrives in each half, at a seeded time 12 to 40 seconds into the half, from
  a pool of ten children and wishes (Timmy's little train among them). It raises a decision at once
  (below). All other letters are clear.
- Three goals, one star each, for the whole game: `full` (Full sleigh, 110 right gifts aboard),
  `right` (Few mistakes, at most 3 wrong gifts aboard) and `cost` (Within budget, cost so far at
  most £850, wrong gifts aboard counted at what they cost). `right` and `cost` count only once the
  sleigh holds 77 right gifts (`goalsCountFrom`), so a slow sleigh earns nothing for being cheap
  and clean.
- There is one money figure, the cost so far (`cost.spent`). It counts up: the AI's running cost,
  checks, the half-time purchase, fixes (remakes, recalls, a rollback) and what the wrong gifts
  aboard will cost. Nothing is ever unaffordable.
- The seed is different on every play unless the address fixes it, so the update on offer, the
  unclear letters and the letters differ from game to game.

## What `view()` returns

The target (110), the cost limit (£850) and `goalsCountFrom` (77) here are examples from the current balance; the page reads them from `view()`.

The page reads only `view()`. Whether an unrevealed parcel is wrong is left out of it. Money is in
pounds, rounded to whole pounds unless said otherwise. Times are seconds.

| Field          | Type                             | Example                                              | Meaning                                                                                                          |
| -------------- | -------------------------------- | ---------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `t`            | number                           | `40.0000000001`                                      | Seconds played, unrounded                                                                                        |
| `duration`     | number                           | `150`                                                | Seconds in the whole game                                                                                        |
| `target`       | number                           | `110`                                                | Right gifts the sleigh needs for the Full sleigh star                                                            |
| `elves`        | array of elf                     | see below                                            | The eight elves, always in the same order                                                                        |
| `ai`           | `[number, number]`               | `[2, 1]`                                             | AI level at reading and at toy making: 0 by hand, 1 Assist, 2 Automate                                           |
| `checking`     | number                           | `1`                                                  | 0 a few, 1 the risky ones, 2 all                                                                                 |
| `levers`       | object                           | see below                                            | What each lever position does now                                                                                |
| `stations`     | array of 3 station               | see below                                            | Reading, toy making, checking                                                                                    |
| `queues`       | object of queue                  | see below                                            | `letters`, `orders`, `check`, `pass`, `rework`                                                                   |
| `bypassed`     | number                           | `0`                                                  | Gifts the player has let through unchecked                                                                       |
| `vigilance`    | object                           | see below                                            | How far the elves have come to trust the AI                                                                      |
| `case`         | decision or `null`               | see Decisions                                        | The open decision                                                                                                |
| `casesWaiting` | number                           | `1`                                                  | Decisions waiting behind the open one                                                                            |
| `choice`       | half-time or `null`              | see Half-time                                        | Set only while half-time is open                                                                                 |
| `run`          | object                           | see below                                            | The one sleigh: half, clock, gifts aboard, goals                                                                 |
| `cost`         | `{ spent, limit }`               | `{ spent: 79, limit: 850 }`                          | Cost so far, wrong gifts aboard included, and the limit for the cost goal                                        |
| `focus`        | object or `null`                 | see below                                            | The one thing that most needs the player now                                                                     |
| `sleigh`       | `{ right, wrong, parcels }`      | `{ right: 36, wrong: 1, parcels: [...] }`            | Gifts aboard; `parcels` is every parcel aboard, each with `result`                                               |
| `lost`         | number                           | `0`                                                  | Letters lost: to a full letter pile, or unclear letters undecided at the end                                     |
| `prices`       | `{ wrongEveryday, wrongBig }`    | `{ wrongEveryday: 12, wrongBig: 100 }`               | What a wrong everyday and a wrong big gift cost                                                                  |
| `pace`         | `{ projected, behind, slowest }` | `{ projected: 137, behind: true, slowest: null }`    | Right gifts expected at departure, whether short of the target, the station holding things up (0 to 2) or `null` |
| `incident`     | object or `null`                 | `{ known: true, rollingBack: 0, suspectWaiting: 2 }` | Set once a faulty update is installed (below)                                                                    |
| `actions`      | object                           | see below                                            | For `ai0`, `ai1`, `checking`, `bypass`: whether it works now and what it costs                                   |
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
  `{ name, who, speed, risk, perMinute, costPerMinute }`, for example
  `{ name: "Automate", who: "AI works alone", speed: "about 9.2 times as fast", risk: "big gifts: 1 in 5 misread", perMinute: 100, costPerMinute: 43 }`.
  `name` is "By hand", "Assist" or "Automate". `who`, `speed` and `risk` are six words at most;
  `risk` says what to watch for now, from the current state. `perMinute` is parcels a minute at the
  current staffing, `costPerMinute` the AI's running cost in pounds a minute (0, 13 or 43).
- `checking` holds three entries `{ name, sends, per100 }`, for example
  `{ name: "The risky ones", sends: "elves check big, guessed and unsure gifts, where the AI slips most", per100: 37 }`:
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
`{ id: "check", name: "To check", parcels: [...], limit: 10, rate: 51, inflow: 22, trend: "steady", progress: 0.42, blocked: null }`.
`parcels` are parcels (below), `limit` the pile's size, `rate` parcels a minute at the current
staffing, `inflow` parcels a minute arriving, `trend` `"growing"`, `"steady"` or `"shrinking"`
over the last ten seconds, `progress` 0 to 1 towards the next parcel (unrounded), `blocked` `null`
or a short reason such as `"nobody reading"`. Limits: letters 24, orders 20, check 10, pass 12,
rework 30. Names: `"Letters"`, `"Toy orders"`, `"To check"`, `"Waiting to load"` (the gifts that
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
  `null` until a check or loading onto the sleigh reveals them.

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
`{ half: 1, halves: 2, halfLeft: 35, leavesIn: 110, aboard: 36, target: 110, cargo: { id: "everyday", name: "Everyday gifts", icon: "🎁", text: "A wrong gift costs £12, a big one £100." }, goals: [...], goalsCountFrom: 77 }`.

- `half`: 1 or 2. `halves`: 2. `halfLeft`: whole seconds left in the half under way. While the
  half-time card is up (`choice` set) the first half is over and the second has not begun: `half`
  is 1, `halfLeft` 0 and `cargo` the first half's, until the player chooses. `leavesIn`: whole seconds until the sleigh leaves at the end of the game.
- `aboard`: right gifts on the sleigh, the figure the Full sleigh star counts. Show the sleigh
  count once, from here.
- `cargo`: the half's cargo `{ id, name, icon, text }`: `"everyday"` ("Everyday gifts") in the
  first half, `"big"` ("Big gifts", "The AI slips more, and a wrong one costs £100.") in the second.
- `goals`: always three, in this order, each `{ id, name, now, need, text, met, waiting }`:

  | `id`    | `name`          | `now`                         | `need` | `text`                                 |
  | ------- | --------------- | ----------------------------- | ------ | -------------------------------------- |
  | `full`  | `Full sleigh`   | right gifts aboard            | 110    | `110 right gifts`                      |
  | `right` | `Few mistakes`  | wrong gifts aboard            | 3      | `at most 3 wrong gifts`                |
  | `cost`  | `Within budget` | cost so far (as `cost.spent`) | 850    | `cost at most £850, wrong gifts count` |

  `met` is whether the star would be earned if the sleigh left now. `waiting` is `true` for a
  `right` or `cost` goal whose figures are within its limit while the sleigh holds fewer than
  `goalsCountFrom` right gifts, so the star is not earned yet; `full` never waits.

- `goalsCountFrom`: 77, the right gifts aboard from which the `right` and `cost` goals count.

### Cost

`cost` is `{ spent, limit }`, for example `{ spent: 79, limit: 850 }`. `spent` is the one money
figure of the game: everything spent so far plus what the wrong gifts aboard will cost. It only
grows, except when a recall brings wrong gifts back (their price leaves, the recall's is added).
`limit` is the most the cost goal allows. Show it in the top bar as "Cost so far".

What costs what: the AI £0.22 a second per station on Assist and £0.72 on Automate; each gift
sent for a check £4, paid as it joins the checking pile whether or not a checker then looks at it
properly; a
remake £3; a rollback £65; a recall £20 plus £40 for each everyday gift and £80 for each big one,
plus its remake; a wrong everyday gift aboard £12 and a big one £100; the half-time option its
price (update £40, test £50, training £100, cocoa for everyone £50, carry on £0). Asking a child
costs time only.

### Focus and actions

`focus` is `null` or `{ station, control, text }`, for example
`{ station: 3, control: "cocoa", text: "rest Holly" }`. `station` is 0 to 3, `control` one of
`"cocoa"`, `"elves"`, `"ai0"`, `"ai1"` or `"checking"`, and `text` four words at most.
When the line has stopped or a pile is full, `focus` names what would free it, ahead of anything
else: the checkers when the checking or waiting-to-load pile is full (`{ station: 2, control:
"elves", text: "needs another elf" }`, or `control: "checking", text: "check fewer"` while every
gift is checked by three elves or more), else the toy makers or readers when their pile is full
or nobody works there (`"elves"`, or `"ai0"`/`"ai1"` with `"try the AI"` while three elves work
it by hand). While a rollback holds the toys up, the other hints apply.

`actions` has a key for each of `ai0`, `ai1`, `checking` and `bypass`, each
`{ available, why, cost }`, for example
`{ available: true, why: null, cost: "£13 a minute on Assist, £43 on Automate" }`. `available` is
`false` only after the end, or for `bypass` while nothing waits for a check; `why` then says why in
a few words (`"The sleigh has left"`, `"Nothing waiting for a check"`). `cost` is what using it
costs, in the player's words.

### Incident

`incident` is `null` until a faulty update is installed, then `{ known, rollingBack, suspectWaiting }`:
`known` once an elf confirming toys, the checkers or the sleigh crew spot its full-sized trains,
`rollingBack` seconds of rollback left (0 when not rolling back), `suspectWaiting` known faulty
parcels still in the workshop. A good update never sets it.

## Decisions

A decision ("case") is
`{ id, kind, step, title, text, facts, evidence, affected, options, resolving }`, and an unclear
letter also has `stake`. At most one is
open (`case`); the others wait (`casesWaiting`) in this order: the faulty update, the recall, the
unclear letters. Decisions never resolve on their own, and the clock keeps running while one is
open. A game has two to four: the two unclear letters, plus at most one faulty update and one
recall.

- `kind` is `"unclear"` or `"incident"`. `step` is `null` for an unclear letter, and `"source"`
  (the faulty update) or `"aboard"` (wrong gifts on the sleigh) for an incident.
- `title` names it in a few words: `"Unclear wish"`, `"Faulty update"` or `"Wrong gifts on sleigh"`.
- `text` is one short sentence of what happened, for example
  `"Timmy writes: 'A little train, please.' It could mean two things."`.
- `facts` is `[{ label, value, primary }]`: the figures the decision turns on. At most three are
  `primary`; show those on the card and the rest behind the info pop-up.
- `evidence` is `[{ parcelId, child, wish, made }]`: the letter for an unclear wish, empty for an
  incident. `child` is the child's name, `made` is `null` until a toy is made.
- `affected` is `{ count, ids }`: the parcels an option could cover.
- `options` is `[{ id, label, seconds, money, risk, scope, why, goal, available }]`. `seconds` is
  the time it takes, `money` what it costs, `risk` `null` or the chance (0 to 1) of a wrong gift or
  toy it leaves, `scope` what it does in words (the part before the first semicolon is a few words
  a chip can show), `goal` `null` or a few words on what it does to the goals, `available` `false`
  with a short `why` when it cannot be chosen now.
- `stake` (unclear letters only): what a wrong guess costs once aboard, a number of pounds: 12
  for an everyday wish, 100 for a big one, as `prices` shows them. Format it on the page, for
  example `"£12 if wrong"`.
- `resolving` is `null` until the player answers, then `{ optionId, remaining, duration }` while
  the chosen option takes its time. The decision stays open and takes no second answer until
  `remaining` reaches zero; then it closes with a `resolved` news item. An option that takes no
  time closes it at once.

### Unclear letter

```
{ id: 1, kind: "unclear", step: null, title: "Unclear wish",
  text: "Amir writes: 'A bat, please! I love caves.' It could mean two things.",
  facts: [ { label: "Gift", value: "£12 if wrong", primary: true },
           { label: "Ask", value: "waits 10 s, comes out right", primary: true },
           { label: "Guess", value: "70% wrong, AI reads", primary: true },
           { label: "Time left", value: "116 s", primary: false } ],
  evidence: [ { parcelId: 36, child: "Amir", wish: "A bat, please! I love caves.", made: null } ],
  affected: { count: 1, ids: [36] },
  options: [ { id: "ask", label: "Ask the child", seconds: 10, money: 0, risk: null,
               scope: "the letter waits about 10 s; the gift comes out right", why: null, goal: null, available: true },
             { id: "guess", label: "Let the reader guess", seconds: 0, money: 0, risk: 0.7,
               scope: "goes on now; 70% wrong, the AI guesses confidently", why: null, goal: null, available: true } ],
  resolving: null, stake: 12 }
```

- The letter is set aside as it arrives and waits for the answer; it never joins the letter pile
  until answered and is never lost to a full pile. Still undecided when the sleigh leaves, it is
  lost (counted in `lost`).
- `"ask"` counts down 10 seconds in `resolving`; then the child's answer comes back, the letter is
  read right and goes to the toy pile. No elf is taken from its station.
- `"guess"` closes at once: the letter goes to the front of the letter pile and the reader guesses
  as it reads it. By hand an elf is wrong 35% of the time; with the AI reading (Assist or Automate)
  70%, and an elf confirming the AI's guess cannot tell either. Every line about a guess gives the
  chance as a percentage, the same figure as `risk`. The `risk` and
  the `"Guess"` fact follow the reading level at the moment. A guessed gift counts as risky for
  checking, but a checker catches only 3 in 10 wrong guesses.

### Faulty update (`step` `"source"`)

Raised once, when a faulty update installed at half-time becomes known, which takes at least one
full-sized train. Facts: `"Trains so far"` (every train it has made, caught or not),
`"Rolling back"` (`"8 s, £65"`), `"Toys a minute"` (`"112 now, 80 after"`), `"Time left"`.
Options: `"rollback"` (the toy machine stops 8 seconds, £65, then the machine is back to its old speed)
and `"keep"` (risk 0.65: the machine keeps making full-sized trains until the sleigh leaves). Both
close at once; the rollback runs in `incident.rollingBack`. Known faulty parcels still in the
workshop are marked `suspect: "batch"`, so checking the risky ones checks them.

### Recall (`step` `"aboard"`)

Raised once a game, when the wrong gifts aboard reach 5 (not while a faulty update is running).
Facts: `"Wrong gifts"`, `"Big gifts"`, `"In your cost now"` (what they already add to the cost
so far), `"Time left"`. Options: `"bringBack"` (the wrong gifts come off the sleigh at once and the
checkers remake them, 4 seconds each and at most 20 in all; costs the recall price instead of what
they count now; needs an elf at checking; `scope` "costs £395 instead of the £412 they count now;
checkers busy about 20 s") and `"leave"` (they stay, and their price stays in the cost; `scope`
"their £412 stays in your cost"). `goal` on each reads, when it applies, `"Few mistakes goal
saved"`, `"Within budget goal lost"` or `"Few mistakes goal lost"`, and `scope` ends with the same
words.

## Half-time

`choice` is set at t = 75 and the rules stand still until `choose(optionId)`. It is
`{ title, text, report, next, options, openCase }`:

```
{ title: "Half-time", text: "Pick one change for the second half, or none.",
  report: { aboard: 63, wrong: 2, target: 110, cost: 356, limit: 850, tired: 12, burnouts: 1,
            goals: [ ...three goals as in run.goals... ], causes: [ ...up to three causes... ] },
  next: { cargo: { id: "big", name: "Big gifts", icon: "📦", text: "The AI slips more, and a wrong one costs £100." },
          text: "Second half: mostly big gifts. A wrong one costs £100, so checks pay more." },
  options: [ ...five options... ],
  openCase: { id: 2, title: "Unclear wish" } }
```

- `report` is how the sleigh stands: `aboard` right gifts, `wrong` gifts, `target`, `cost` so far
  and its `limit`, `tired` (the share of the working elves' time so far that tiredness took, 0 to
  100), `burnouts` so far, `goals` (as `run.goals`) and `causes` (where the wrong gifts aboard came
  from, see Causes).
- `next.text` is the one line on what changes in the second half; `next.cargo` its cargo.
- `options` is always these five, in this order, each `{ id, label, text, facts }` with `facts` at
  most three `{ label, value }`:

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

- `openCase` is `{ id, title }` for the first decision still waiting for an answer, or `null`; a
  decision can be answered while half-time is open.

## News

Every item has `id`, `t`, `kind` and `text`; some carry more. During play no item suggests
something only half-time sells.

| Kind          | Extra fields                                                                               | When                                                  |
| ------------- | ------------------------------------------------------------------------------------------ | ----------------------------------------------------- |
| `checked`     | `check: { wish, wanted, made, result, seconds, by }`                                       | A checker finished checking a gift                    |
| `loaded`      | `check: { wish, wanted, made, result }`, `cause`, `control`, `action`, `caseId` (optional) | A wrong gift landed on the sleigh                     |
| `consequence` | `about`, `facts: { seconds, checked, caught, estimatedAvoided, waiting, money }`           | A setting or decision reports what it did             |
| `case`        | `caseId`                                                                                   | A decision was raised                                 |
| `resolved`    | `caseId`, `option`, `outcome: { seconds, money, parcels }`                                 | A decision closed                                     |
| `bypassed`    | `count`                                                                                    | The player let waiting gifts through unchecked        |
| `update`      |                                                                                            | An update was installed on the toy machine            |
| `noticed`     | `by`: `"watcher"`, `"checker"` or `"sleigh"`                                               | The faulty update became known                        |
| `rolledBack`  |                                                                                            | The rollback finished                                 |
| `recalled`    | `count`                                                                                    | Wrong gifts came off the sleigh                       |
| `relaxed`     | `elf`, `station`                                                                           | Checkers, or elves on Assist, started to trust the AI |
| `trained`     |                                                                                            | Training was bought at half-time                      |
| `tired`       | `elf`                                                                                      | An elf burnt out                                      |
| `rested`      | `elf`, `station`                                                                           | A rested elf left cocoa for a station                 |
| `blocked`     | `station`                                                                                  | A station stopped because the next pile is full       |
| `lost`        | `count`                                                                                    | Letters were lost to a full pile                      |
| `behind`      | `station`                                                                                  | The pace first falls short and a station holds it up  |
| `milestone`   | `right`                                                                                    | The sleigh passed 25, 50, 75 or 110 right gifts       |
| `cleared`     | `queue`                                                                                    | A pile that was more than half full has been emptied  |
| `halftime`    | `right`, `wrong`                                                                           | Half-time began                                       |
| `chose`       | `option`, `outcome: { money, seconds, gained }`                                            | The player picked a half-time option                  |
| `departed`    | `right`, `wrong`, `target`, `stars`                                                        | The sleigh left; the game is over                     |

A `relaxed` item names the elf who trusts the AI most and what to do now, for example
`"Tinsel is trusting the AI and skipping checks. Send Tinsel for cocoa or swap in another elf."`
(on Assist: "trusting the AI's drafts and missing mistakes"). `elf` and `station` say who and
where. It always names the elf and station `vigilance.swap` names at that moment: it is said when
the prompt first names an elf, at most one every 20 seconds, and never in the first 20 seconds.
`vigilance.swap` says whether the drift is still there.

### A wrong gift says what to do now

A `loaded` item's `text` is the wrong gift and then one action open to the player at that moment,
for example `"Wrong gift: Jack got a full-sized galleon, not a toy pirate ship. Put Letters on Assist: an elf confirms each."`.
Its `control` is the control to highlight and `action` a few words naming the action, for a tag
on that control. Following the advice never sends a station back to working by hand:

| `control`      | When                                                          | Text                                                                      | `action`            |
| -------------- | ------------------------------------------------------------- | ------------------------------------------------------------------------- | ------------------- |
| `checking`     | A risky gift went out unchecked while checking was on a few   | `Check the risky ones.`                                                   | `Check more`        |
| `cocoa`        | A tired elf working by hand slipped                           | `Send tired elves for cocoa.`                                             | `Rest tired elves`  |
| `ai:0`, `ai:1` | The AI made the mistake on Automate at reading or toy making  | `Put Letters on Assist: an elf confirms each.`                            | `Drop to Assist`    |
| `checking`     | The player let it through unchecked                           | `Check them instead of letting them through: move an elf to Checking.`    | `Check them`        |
| `cocoa`        | An elf on Assist passed the wrong draft while trusting the AI | `Swap the elves at Toys: Pip had stopped checking the AI's drafts.`       | `Swap Pip`          |
| `cocoa`        | An elf on Assist passed it while tired                        | `Send tired elves for cocoa.`                                             | `Rest tired elves`  |
| `checking`     | Any other gift went out unchecked                             | `Check all for a while.`                                                  | `Check all for now` |
| `cocoa`        | A checker waved it through while trusting the AI              | `Swap the checkers: Tinsel had stopped checking properly.`                | `Swap Tinsel`       |
| `cocoa`        | A checker missed it while a checker was tired                 | `Rest the checkers: tired ones miss more.`                                | `Rest the checkers` |
| `ask`          | A sharp, rested checker missed a guessed wish                 | `Ask the child when a wish is unclear: checkers miss most wrong guesses.` | `Ask next time`     |
| `checking`     | A sharp, rested checker missed it                             | `Keep checking the risky ones: even sharp checkers miss 1 in 10.`         | `Keep checking`     |

The first that applies is used. Tiredness is named only when an elf at that station is tired
(red), and drift names the elf there who trusts the AI most. `ask` is a new `control`: there is
no control to outline until the next unclear wish, so the page shows only the line.

A wrong gift whose advice was given in the last 20 seconds goes aboard without a new line, so the
player is not asked twice for the same thing; it still shows on the sleigh.

`cause` is the cause id (see Causes). `caseId` is set only when
the faulty update's decision was still waiting for an answer as the gift went aboard.

A `resolved` item's `text` says what the answer did, with the time, money and parcels involved,
for example `"Amir wrote back: a cuddly bat."` or
`"Rolling back for £65: the toy machine stops 8 s."`. A `check` is a copy taken when the check finished.
`by` is `"elf"`. A `consequence` leaves out the facts that do not apply; `about` is `"checking"`,
`"bypass"`, `"tested"` or `"case"`.

## The end

`end` is set when the sleigh leaves:

```
{ stars: 2, goals: [ ...three goals with their final figures... ],
  right: 145, wrong: 3, lost: 0,
  costs: { ai: 141, checking: 126, halfTime: 100, fixing: 76, mistakes: 215, prevented: 900, total: 658, limit: 850 },
  headline: "Careful, but slow.",
  lesson: { title: "Checking in the right places", text: "Checks went where mistakes were likeliest and dearest." },
  assurance: { ... }, checkingAnswer: "Yes: £126 of checks stopped about £900 of wrong gifts.",
  practices: [ ...five practices... ], causes: [ ...up to three... ],
  blunders: [ { id: "pet-mouse", name: "pet mouse", icon: "🐭" } ], blunderTotal: 27 }
```

- `stars`: 0 to 3, one for each goal met. `goals`: the three goals as in `run.goals`, final.
- `right`, `wrong`: gifts delivered. `lost`: letters lost to a full pile plus unclear letters
  still undecided.
- `costs`: `{ ai, checking, halfTime, fixing, mistakes, prevented, total, limit }`. `fixing` is
  remakes, recalls and a rollback; `mistakes` what the wrong gifts delivered cost; `total` the
  final cost so far (the cost goal's figure); `prevented` an estimate of what the mistakes checking
  stopped would have cost; the page labels it as an estimate.
- `headline` is a few words without figures and `lesson` `{ title, text }` the one lesson under
  it. The lesson names one loss, and only a loss that cost a goal: the sleigh fell short, tiredness
  held it up, wrong gifts cost the Few mistakes goal or much of a broken cost limit, or the cost
  limit broke. The headline names the same loss: "Careful, but slow." (short), "Slow, and wrong."
  (short with more wrong gifts than allowed), "Slow, with too few checks." (short, and the dial
  reads too little), "Too tired to keep
  up." (tiredness), "Fast, but wrong." (wrong gifts on a full sleigh), "Too many wrong gifts." (wrong
  gifts, sleigh short), "Wrong gifts cost too much." (wrong gifts within the allowed number but
  over the cost limit) or "Over budget." (cost). "Christmas, carefully delivered." is for three
  stars, and the lesson is then a tip. A headline praises care only when the Few mistakes goal
  was not lost to too many wrong gifts and the dial does not read too little.
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

### Practices

`end.practices` is always these five, in this order, each
`{ id, name, used, actions, note }`; each action is `{ id, label, used, figure }`. `figure` is the
player's own figure for that action; `note` is `null` except on risk-based checking. Draw one
tile per practice and one line per action, with its figure.

| `id`            | `name`                                 | actions: `id`, `label`, example `figure`                                                                                                                                         | `note` example                                      |
| --------------- | -------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------- |
| `human-in-loop` | `Human in the loop`                    | `assist`, "Elves confirmed the AI's drafts", "Assist for 150 of 150 s"                                                                                                           | `null`                                              |
| `risk-check`    | `Risk-based checking`                  | `risky`, "Checked the risky ones", "150 s on the risky ones; 3 of 7 mistakes caught"                                                                                             | "Wrong gifts cost Santa trust: 2 reached children." |
| `escalate`      | `Ask a person when unsure`             | `asked`, "Asked the child about an unclear wish", "asked 1 of 2"                                                                                                                 | `null`                                              |
| `test-release`  | `Test before release, keep a way back` | `tested`, "Tested the update first", "the test passed" / "installed untested" / "no update installed"; `rolledBack`, "Rolled back a faulty update", "rolled back after 9 trains" | `null`                                              |
| `oversight`     | `Keep human oversight sharp`           | `trained`, "Trained the checkers not to just defer to AI", "4 checks skipped"; `rested`, "Gave the elves a cocoa break", "6 cocoa breaks, 1 burnout"                             | `null`                                              |

A practice's `used` is `true` when any of its actions was used. `assist` and `risky` count once
the setting ran for 10 seconds or more; `asked` once a child was asked; `tested` and `trained`
when bought at half-time; `rolledBack` when the faulty update was rolled back; `rested` when an
elf was sent for cocoa or cocoa for everyone was bought.

### Causes

A cause is `{ id, name, wrong, cost, control, fix }`: up to three, dearest first, in
`end.causes` (the whole game) and `choice.report.causes` (the first half). `wrong` and `cost` count
the wrong gifts it accounts for, `control` is what would have stopped them, and `fix` one short
sentence saying how, leaving out any part the settings already follow (`""` when they follow all
of it), and on the end screen any part that asks for more checks while the dial reads too much. The end screen and the half-time card may mention half-time options.

| `id`       | Wrong gifts from                              | `control`  |
| ---------- | --------------------------------------------- | ---------- |
| `guessed`  | unclear wishes the reader guessed             | `ask`      |
| `big`      | AI slips on big gifts that went out unchecked | `checking` |
| `misread`  | AI misreadings of everyday letters            | `ai:0`     |
| `misMade`  | AI slips making everyday toys                 | `ai:1`     |
| `waved`    | checkers who skipped or missed them           | `train`    |
| `faulty`   | the faulty update                             | `update`   |
| `tired`    | tired elves working by hand                   | `cocoa`    |
| `slip`     | ordinary slips by fresh elves working by hand | `checking` |
| `recalled` | wrong gifts brought back off the sleigh       | `checking` |

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
| `overCost`               | number  | `10`                         | Spent on extra checks (estimate, below); show it under that name                        |
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
  (never sent for one, or let through by the player), plus the recalls of such gifts. For each
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
  count when the Few mistakes goal was missed or they cost 30% of the cost limit or more. The
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
  else and are named so: "Lost to too few checks (estimate)" and "Spent on extra checks
  (estimate)". `text` reads, for example, "Too little checking: about £664 lost to too few checks,
  against about £44 on extra checks."
- A group is `{ id, name, icon, parcels, wrongMade, checked, caught, shipped, checkCost, prevented, shippedCost, shippedUnchecked, shippedUncheckedCost, verdict, text }`
  for `id` `"everyday"`, `"big"` or `"unclear"` (the two unclear letters; one that is also big
  counts as big), for example
  `{ id: "big", name: "Big gifts", icon: "📦", parcels: 7, wrongMade: 6, checked: 6, caught: 5, shipped: 0, checkCost: 12, prevented: 500, shippedCost: 0, shippedUnchecked: 0, shippedUncheckedCost: 0, verdict: "paid", text: "Checking 6 big gifts cost £12 and stopped about £500 of wrong gifts." }`.
  `verdict` is `"left exposed"`, `"cost more than it saved"` or `"paid"`. The unclear wishes'
  `text` counts asking: "1 of 2 asked; no wrong ones." or "0 of 2 asked; 1 wrong one cost £12.".
- `end.lesson` and the verdict agree: a "Too much checking" lesson shows only when the dial reads
  too much, "Too little checking" only when it reads too little, and "Checking in the right places"
  only with "about right".

## Behaviour the page relies on

- When the checking pile is full the line waits; a full pile never lets gifts through by itself.
  Gifts miss a check in two ways, both visible: the player calls `bypass()`, counted in
  `bypassed`, or relaxed checkers wave a gift through, counted in `vigilance.skipped`.
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
  checker catches 90 in 100, but only 30 in 100 on a guessed wish. Both miss more as they tire.
- `pace.projected` is smoothed over about fifteen seconds; a player action works it out afresh.
- Options that take no time close the decision at once: guess, roll back, keep running, bring
  back, leave. Ask counts down in `resolving`.
