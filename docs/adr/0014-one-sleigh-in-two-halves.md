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
