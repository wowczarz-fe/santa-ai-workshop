---
status: accepted
---

# 0014: One sleigh in two halves, with one pause and three goals

Date: 2026-11-12

## Context

Six colleagues played the published build: four 60-second sleigh runs, each with its own cargo,
a break card after runs 1 to 3, twelve stars, a guided first run whose controls unlocked one card at
a time, and a points score. They found it too busy and stressful, could not say how the four runs
differed, read "Not now" on a walkthrough card as a bug because the controls behind it stayed
hidden, and did not know what to do after a wrong gift. They liked the look, the governance
choices at the break, the end screen's practices and the blunder collection. The user ruled that
the whole game becomes one sleigh (rework brief, rulings 1, 5, 6, 7 and 8).

Most of the old rules existed to make four runs differ or to pace a guided first run: four cargo
kinds, a rush, per-run targets and reports, a points score with clean-run bonuses, a judge case and
a repeated-mistake case to give later runs more to do, a three-step faulty-update incident, and a
verdict gate counting missed runs.

## Considered options

- Keep the four runs and shorten them. Rejected: the testers' complaint was the number of things
  to track, not the clock alone.
- One sleigh, two halves of 75 seconds, one half-time pause. Chosen, as ruled.
- Keep every cargo and pick two by seed. Rejected: the ruling asks for the pair with the clearest
  contrast, and a fixed pair lets the half-time card say one line about what changes.

## Decision

- One sleigh is filled over 150 seconds. At 75 seconds the rules stop and the half-time card
  (`view().choice`) shows how the sleigh stands and offers one governance change or none. The
  sleigh leaves at 150 seconds and the end screen follows. Gifts aboard stay aboard across
  half-time, so the one recall decision can reach anything on the sleigh.
- Cargo: everyday gifts in the first half (the plain mix, about one in five big), mostly big gifts
  (6 in 10) in the second. Big against everyday is the clearest change in what is at stake: the AI
  slips more on big gifts and a mistake costs £100 instead of £12, so the right amount of checking
  rises. The unclear and rush cargoes are removed. Letters arrive at 0.6 a second, then 1.1 a
  second from 15 seconds, in both halves; the old runs went up to 1.3 and, in the rush, 2.6.
- Three goals for the game, one star each, out of 3: Full sleigh (144 right gifts), Few mistakes
  (at most 3 wrong gifts aboard) and Within budget (cost so far at most £700, ADR 0015). The
  mistakes and cost goals count from 58 right gifts aboard. Points, clean-run bonuses and the old
  1-to-3 rating are removed; stars are the score.
- Half-time options: install the update (£40), test it first (£50), train the checkers (£100),
  cocoa for everyone (£50) or carry on (£0). All four old break options still make sense with one
  pause, so all stay, plus an explicit "carry on". Their prices go against the cost goal, so
  buying one is a trade: in the balance check the purchase decides the cost star in 6 of 40
  sensible games.
- Decisions during play are the two unclear letters (ADR 0016), the faulty update once it is
  known (one card: roll back or keep it running to the end) and one recall a game when five wrong
  gifts are aboard. The judge and repeated-mistake cases, the faulty update's "made" step and the
  re-asking of a kept update are removed. A game has two to four decisions.
- Guided mode is removed: no `guided` option, tutorial moments, unlock flags, `acknowledge` or
  `skipGuidance`. Every control works from the first second; the page runs its own tour before the
  clock starts.
- A wrong gift's news line names one action open at that moment and carries the control to
  highlight (`"checking"`, `"ai:0"`, `"ai:1"` or `"cocoa"`), picked from what would have stopped
  that mistake: check the risky ones when a risky gift went out unchecked, cocoa when a tired elf
  slipped, the AI one step down at the station that made it, else check all, else rest the
  checkers. The brief named only checking and the AI levels; cocoa is added because a tired elf's
  slip is stopped by neither. No line during play mentions training or the update.
- Each elf in `view()` gains `energy` (100 fresh, 0 at burnout) and `mood` (`fresh`, `tiring`,
  `tired`, `spent`), set where the mechanics change: elves slow past tiredness 30 and slip past 50.
  Elves start a little apart in tiredness so a station's elves do not all burn out at once, and
  they tire faster than before, so one never rested burns out about once every 100 seconds.
- Elves confirming AI drafts on Assist come to trust the AI the way checkers do: each clean draft
  they confirm counts half a clean checked gift towards their own drifting and not-looking states,
  and a drifting confirmer passes more wrong drafts. Training at half-time keeps both sharp. Tired
  confirmers and checkers miss twice as much as before (2 in 100 more per point of tiredness past
  50). Without this, Assist left alone met both the mistakes and the cost goal in every game.
- The end screen keeps the headline, lesson, checking dial, `checkingAnswer` and blunders. The
  per-run table goes. The practices move into the rules (`end.practices`), each with the player's
  own figure; training reads "Trained the checkers not to just defer to AI", and risk-based
  checking carries one line linking wrong gifts to trust in Santa. Wrong gifts decide the headline
  when the mistakes goal was missed or they cost 30% of the cost limit; the gate that counted runs
  with a missed mistakes goal goes.

ADRs 0005, 0009 and 0011 are superseded. ADR 0010's goals and ADR 0012's comparison of losses
carry over to the whole game.

## Consequences

Balance over 40 seeds (`node tests/balance-check.js`), stars per game as mean and the count of
games with 0/1/2/3 stars:

| Scripted player                                                                                                 | Stars | 0/1/2/3    |
| --------------------------------------------------------------------------------------------------------------- | ----- | ---------- |
| Everything on Automate, untouched                                                                               | 0.00  | 40/0/0/0   |
| Everything on Assist, untouched                                                                                 | 1.02  | 6/27/7/0   |
| By hand, untouched                                                                                              | 0.00  | 40/0/0/0   |
| Sensible: AI reads, elves confirm toys, risky checks, moves and rests elves, answers decisions, buys one option | 2.05  | 5/5/13/17  |
| The same, checking everything                                                                                   | 1.13  | 13/9/18/0  |
| The same, checking a few                                                                                        | 0.28  | 32/5/3/0   |
| The same, both stations on Automate                                                                             | 1.00  | 19/7/9/5   |
| The same, never resting                                                                                         | 0.97  | 14/13/13/0 |

The sensible player earns two stars or more in 75% of games and three in 42%. Checking everything
holds the sleigh up (Full sleigh met in 5% of games) and meets the cost goal in half; checking a
few loses the mistakes star in 95%. A sensible game sees 2.3 decisions on average. An elf by hand
never rested burns out 1.5 times a game, the first time at 84 seconds on average.

The game is shorter and calmer, and one pause carries all the governance choices. The cost of one
pause is that a problem in the first half (relaxed checkers, a tired line) can only be bought out
at half-time; the wrong-gift lines point at what can be done now instead. The balance rests on the
Full sleigh target sitting just under what a sensible player manages (145 right gifts on average),
so a change to speeds or letter rates needs the balance check run again.

## Follow-up: tuned for first-time players

Date: 2026-11-12

The figures above were tuned against a scripted player who reacts at once and plays near
perfectly, and it still ended 13% of games with no star. Real players open the game once, after
the tour. The balance check gains two slower scripts, each with its own seeded sloppiness:

- `firstTimer`: sets both stations to Assist and checking to the risky ones 4 to 18 seconds in,
  looks at the screen every 2 to 4 seconds, turns reading up to Automate once letters pile up,
  moves one elf about every 20 seconds to where the page or the fullest pile points, rests elves
  that show red but misses one time in four, answers a decision 5 to 10 seconds late (mostly
  asking, rolling back and fetching back) and picks a half-time option on a hunch.
- `careless`: the same, but checking stays on a few, unclear wishes are guessed, other decisions
  are answered at random and nobody is rested.

Changes: the Full sleigh target goes from 144 to 130 right gifts, so the mistakes and cost goals
count from 52, and the cost limit from £700 to £740. The workshop itself is unchanged.

| Scripted player                   | Stars before | 0/1/2/3 before | Stars after | 0/1/2/3 after |
| --------------------------------- | ------------ | -------------- | ----------- | ------------- |
| Everything on Automate, untouched | 0.00         | 40/0/0/0       | 0.00        | 40/0/0/0      |
| Everything on Assist, untouched   | 1.02         | 6/27/7/0       | 1.10        | 3/30/7/0      |
| By hand, untouched                | 0.00         | 40/0/0/0       | 0.00        | 40/0/0/0      |
| Sensible                          | 2.05         | 5/5/13/17      | 2.45        | 0/6/10/24     |
| The same, checking everything     | 1.13         | 13/9/18/0      | 1.48        | 8/10/17/5     |
| The same, checking a few          | 0.28         | 32/5/3/0       | 1.02        | 2/35/3/0      |
| The same, both stations Automate  | 1.00         | 19/7/9/5       | 1.65        | 0/23/8/9      |
| The same, never resting           | 0.97         | 14/13/13/0     | 1.00        | 13/14/13/0    |
| First-timer                       | 1.65         | 4/6/30/0       | 1.73        | 3/5/32/0      |
| Careless first-timer              | 1.10         | 10/16/14/0     | 1.13        | 9/17/14/0     |

The sensible player now fills the sleigh in every game and earns three stars in 60%. Lazy play
still loses through the same mechanisms: checking everything holds the sleigh up or goes over the
limit in 83% of games, checking a few loses the mistakes star in 95%, Automate untouched earns
no star and Assist untouched one in most games, never three.

A first-timer earns two stars in 80% of games and none in 8%, but never three. A slow first game
is cheap and makes few mistakes, so it meets the mistakes and cost goals easily; what it lacks is
pace (88 right gifts on average, about 100 in its best tenth of games). Checking everything
delivers 119 to 136 in most games, so no Full sleigh target can reward a first game without also
rewarding checking everything; keeping too much checking a losing choice was put first. Filling
the sleigh is what a second game rewards, worth about one star (1.73 to 2.45).

What asks for a first-timer's attention (decisions, burnouts and wrong-gift lines, plus the
half-time card): about 4 things in the first half and 7 in the second, one every 11 seconds at
the busiest, so the pace was left alone.

The first-timer script showed that a full straight-through pile could stop the line for up to 20
seconds with nothing pointed at, in 18 of 40 games. `focus` now puts a stopped line or a full pile
first and names what would free it, with the values the page already handles: another elf at the
station holding the rest up, the AI at a station worked by hand, or checking fewer while every gift
is checked. With it the first-timer averages 1.65 stars (3/8/29/0) and the careless one 1.02
(12/15/13/0); the figures above were taken before.

## Follow-up: strategies compared at the same skill

Date: 2026-11-12

The page developer played the real page with a reasonable strategy and reached 79 to 91 right
gifts, far from 130: the Full sleigh, the first goal on screen, was out of a person's reach. It
sat there only because an expertly played check-everything strategy would otherwise fill the
sleigh, which compared strategies at different skill. The balance check now plays each strategy at
two skills: an expert (the old sensible script) and a first-timer (the earlier script). The good
strategy is reading on Automate, toys on Assist and the risky ones checked; the others check
everything, check a few, put everything on Automate, never rest, or leave everything untouched.

Changes:

- Checking everything now loses through its cost. A gift sent for a check costs £4 (was £2), paid
  as it joins the checking pile whether or not a checker then looks at it properly, so drifting
  checkers no longer make checking everything cheap. The cost limit is £850 (was £740).
- The Full sleigh target is 108 right gifts (was 130), where a first-timer on the good strategy
  fills the sleigh in about four games in ten. The mistakes and cost goals count from 70% of it,
  76 right gifts (was 40%), so a slow sleigh earns nothing for being cheap and clean; this is what
  makes never resting cost a first-timer a star.
- Elves tire more slowly: 0.65 a second at work (was 1.1), 0.1 more at checking (was 0.3) and 0.2
  more under full piles (was 0.75). A first-timer who rests elves when they turn red sees 0.8
  burnouts a game (was 3.6). A wrong-gift line no longer repeats the same advice within 20 seconds.
- Wrong-gift advice never sends a station by hand: Automate steps down to Assist, a slip on Assist
  points to checking, and cocoa when the elf was tired. A script that does what every line says
  scores 2.00 stars against 1.98 for one that ignores them.
- The end screen agrees with itself. The lesson names one loss, and only a loss that cost a goal;
  the headline names the same loss; a lesson about checking too much or too little puts the dial on
  that side; and the dial never reads too much checking when checking stayed on a few all game.
  Before, an untouched by-hand game read "Too tired to keep up." over "By hand is careful but slow"
  with the dial at "Too much checking", and a one-star game over the cost limit read "A good
  Christmas.".
- While the half-time card is up, `run` shows the first half over (half 1, 0 seconds left).
  Unclear-wish decisions carry `stake` and wrong-gift lines `action`.

Stars over 40 seeds, mean and share of games with 0/1/2/3 stars, then the share meeting Full
sleigh, Few mistakes and Within budget, and right gifts aboard on average:

| Player                     | Before | 0/1/2/3 %   | After | 0/1/2/3 %  | Full/Mistakes/Cost % | Right |
| -------------------------- | ------ | ----------- | ----- | ---------- | -------------------- | ----- |
| By hand, untouched         | 0.00   | 100/0/0/0   | 0.00  | 100/0/0/0  | 0/0/0                | 43    |
| Automate, untouched        | 0.00   | 100/0/0/0   | 0.90  | 10/90/0/0  | 90/0/0               | 113   |
| Assist, untouched          | 1.10   | 8/75/18/0   | 0.40  | 60/40/0/0  | 0/0/40               | 94    |
| Expert, good strategy      | 2.45   | 0/15/25/60  | 2.30  | 0/25/20/55 | 100/65/65            | 146   |
| Expert, check everything   | 1.48   | 20/25/43/13 | 1.63  | 0/43/53/5  | 100/57/5             | 133   |
| Expert, check a few        | 1.02   | 5/88/8/0    | 1.10  | 0/90/10/0  | 100/5/5              | 138   |
| Expert, all Automate       | 1.65   | 0/58/20/23  | 1.52  | 0/58/33/10 | 100/33/20            | 144   |
| Expert, never resting      | 1.00   | 33/35/33/0  | 1.90  | 3/40/23/35 | 98/40/53             | 118   |
| First-timer, good strategy | 1.65   | 8/20/73/0   | 1.98  | 8/15/50/28 | 38/78/83             | 104   |
| First-timer, check all     | 1.32   | 20/28/53/0  | 1.07  | 25/43/33/0 | 30/48/30             | 100   |
| First-timer, check a few   | 0.65   | 48/40/13/0  | 1.40  | 0/73/15/13 | 100/20/20            | 130   |
| First-timer, all Automate  | 1.02   | 20/58/23/0  | 1.75  | 0/43/40/18 | 83/65/28             | 119   |
| First-timer, never resting | 1.43   | 23/13/65/0  | 1.27  | 25/25/48/3 | 5/50/73              | 84    |
| Careless first-timer       | 1.02   | 30/38/33/0  | 0.82  | 33/53/15/0 | 53/15/15             | 108   |

Both extremes lose at both skills: checking everything breaks the cost limit in 70% of first-timer
games and 95% of expert games, and checking a few loses the mistakes star in 80% and 95%. A
first-timer's attention is asked for once every 28 seconds in the first half and every 16 in the
second (decisions, burnouts, wrong-gift lines and the half-time card).

Two targets were given up, because they pull the mistakes and cost lines in opposite directions: a
first-timer on the good strategy earns three stars in 28% of games (asked 10 to 25%), and the
expert in 55% (asked 60% or more). The first-timer rows were put first. Never resting costs a
first-timer 0.7 of a star but an expert only 0.4, as an expert who never rests still fills the
lower target. The expert is only 0.3 of a star ahead of a first-timer: the mistakes and cost goals
are fixed amounts, and a faster sleigh carries more chances of both.

## Follow-up: drift that can be fixed during play

Date: 2026-11-12

A first-timer playtest found the drift lines arriving 9 seconds in, in words a newcomer could not
read, naming nothing that could be done before half-time. The user ruled that drift gets an action
open during play.

- Each elf now keeps its own trust in the AI, and a station drifts by the average of its elves. A
  cocoa break, a burnout or a move to another station starts an elf's trust afresh, so swapping in
  a rested elf pulls a drifting station back; training at half-time stays the lasting cure. The
  line says what is happening and what to do ("Checkers are trusting the AI and skipping checks.
  Swap in a rested elf.") and never comes in the first 20 seconds.
- A clean AI draft now adds a whole clean gift to each confirmer's trust (was half). Drift used to
  be one count shared by both Assist stations; per station it built up half as fast, and a
  first-timer checking a few lost the mistakes star in only 40% of games.
- An elf on cocoa walks back to the station it came from once fully rested, at least 3 seconds
  after sitting down. This was chosen over a "send them back" hint and an end cause because it
  removes the problem: no elf is left on a break.

The goal lines are unchanged. Rows that moved by more than 0.2 of a star: the first-timer checking
everything rose from 1.07 to 1.50 (its checkers, rested now and then, look at every gift properly,
which is slower and holds the sleigh up: it fills it in no game, but breaks the cost limit in only
32%), and the expert who never rests fell from 1.90 to 1.57. The first-timer on the good strategy
rose from 1.98 to 2.15 (three stars in 30%), and the expert fell from 2.30 to 2.20 (55%). Checking
everything still loses a star in every first-timer game, now through the held-up sleigh more than
the cost; the check that it breaks the cost limit in most games is kept for the expert only.

## Follow-up: an honest dial, named drift and rested elves that go where needed

Date: 2026-11-13

A second playtest found the end screen still contradicting itself and the drift prompt vague. The
user ruled that the dial is an honest measure of checking by its own two figures and is never
moved to fit the headline; this replaces the earlier rule that held the dial inside the verdicts
allowed for the headline's loss.

- The dial reads its two figures. When one is three times the other and at least £100, it reads
  that side whatever the rest of the bill. On three stars it reads "about right", as neither too
  much nor too little checking cost a star. The words follow it: the checking answer goes the same
  way and never starts "No" on three stars; a checking lesson shows only on the dial's side; a
  headline praises care only without too many wrong gifts or too few checks ("Slow, and wrong.",
  "Slow, with too few checks."). The by-hand lesson is now "By hand is too slow".
- Drift lines and the new `vigilance.swap` name the elf who trusts the AI most at the drifting
  station. Wrong-gift advice names the true cause: tiredness only when an elf there is tired,
  drift with the elf's name, and otherwise that even sharp checkers miss 1 in 10, or that checkers
  miss most wrong guesses. An ordinary slip by a fresh elf is a cause of its own (`slip`).
- A fully rested elf goes to the station that needs an elf, else home, and says where it went; a
  need answered by one elf is left to it for 5 seconds.
- The straight-through pile is the waiting-to-load pile in every line, as on the page.

No goal line changed and no row of the balance table moved by more than 0.2 of a star (the
first-timer checking everything rose from 1.50 to 1.65, the first-timer following the advice from
2.15 to 2.27).

## Follow-up: last playtest fixes

Date: 2026-11-13

- One drift prompt at a time: `vigilance.swap` keeps naming its elf while that elf stays and the
  station still drifts, and a drift line is said only for that elf and station.
- Checks paid for but waved through by trusting checkers are checking not done properly, not too
  much checking. A game that lost the Few mistakes goal never reads "too much" or advises fewer
  checks; its answer reads "Not as run: ..., because trusting checkers waved 3 wrong gifts
  through." Cause advice never asks for more checks while the dial reads too much.
- A rested elf goes home unless home clearly does not need it (two elves left and piles under
  half full, and for Checking a To check pile that is not growing).
- The over-checking figure is "Lost to too many checks (estimate)", with its parts `overChecks`
  and `overHeld` in `view()`.
- The Full sleigh target is 110 (was 108): with rested elves going home the first-timer's
  three-star share rose to 33%, and 110 brings it back to 30% while it still fills the sleigh in
  35% of games. No other row moved by more than 0.2 of a star.

## Follow-up: no letting gifts through unchecked

Date: 2026-11-13

The user ruled that the "let through" control ("Skip N checks"), which let the gifts waiting for a
check go to the sleigh unchecked, goes: it was no longer used. A full checking pile stops the line
and `focus` names what frees it, another elf at Checking or checking fewer. Removed from the
rules: the `bypass()` call, the `bypass` action, `view().bypassed`, the `bypassed` news item and
parcel exit, the "Let through unchecked" lesson and cause, and the advice line for a gift let
through.

## Follow-up: recall at the reputation limit

Date: 2026-11-13

The user could lose the Few mistakes star at four wrong gifts but the recall only appeared at
five. Raise it as soon as the limit is exceeded, including during a faulty update, at most twice
per game. Bring back the excess gifts, most expensive first, so the price and checker time buy a
specific improvement: getting back within the mistakes limit. Leaving them keeps the star lost.
After leaving, a second decision needs a newly arrived wrong gift. This avoids repeating the same
question without delaying a new failure. If time is too short to finish, show the consequence and
the unavailable recall's reason. Record a completed recall as a response practice on the end
screen. The normal minimum of right gifts still applies before the star counts.

The page stops the clock while a Decide card awaits an answer, just as it does for the tour and
half-time, and preserves manual pause. Asking the child resumes the wait after the choice. This
gives the player time to compare the price, checker time and star without losing production while
reading. Keeping the old five-gift trigger or deleting recall were rejected: neither lets a player
respond when Santa's reputation first crosses the stated limit.

The paper presentation uses one total timer, a single sleigh card with its count and cargo, and
pictures of the two possible readings on an unclear-wish card. The half-time card omits the
minimum-load explanation; the end screen explains a star that never began counting. Queue heaps
come from actual parcels, with at most 18 drawn and the count giving the full total. Permanently
full decorative props are removed. Real arrivals animate for 460 ms, at most three per station;
pausing the clock freezes them and reduced-motion preferences suppress movement. These choices
make the visible piles and changes reflect what the player actually caused.

The scripted expert now reads the recall option's visible star trade, buying back the mistakes
star when it does not lose the budget star, before comparing cash saved. Across 40 seeds the
sensible expert earns 2.50 stars on average and three stars in 24 games; automating both stations
earns 1.68 and three stars in 7 games. The earlier absolute benchmark of at most 15% three-star
automation games is now a printed balance warning (17.5% with recall). The requirement that those
strategies score at least half a star below the sensible strategy remains blocking. Game prices,
rates and risks stay as they were; this round makes recovery available at the stated limit.

## Follow-up: a recall costs more than leaving

Date: 2026-11-13

A recall was cheaper than the gifts it took off the sleigh (£186 against the £200 they counted)
and saved the Few mistakes star as well, so nobody would leave them: the card was not a choice.
The user ruled that the player decides and that the recall must cost real money. A recall now
costs half as much again as its gifts count aboard, and at least £40 more than that, remakes
included: £150 for one big gift, £300 for two, £52 for one everyday gift. The fixed £20 and the
per-gift £40 and £80 are gone. Leaving costs nothing more and keeps the star lost. Each option
carries `money`, `instead` and `extra`, so the card can show the net effect ("£50 more",
"nothing more") beside the star, and the recall says when its extra cost loses the budget star.
The scripted players bring gifts back only when that saves the mistakes star without losing the
budget star. Fixing a mistake after it has shipped now costs more than checking it would have.
