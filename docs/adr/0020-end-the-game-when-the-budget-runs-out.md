---
status: accepted
---

# 0020: End the game when the budget runs out

Date: 2026-11-13

## Context

Money was only a star (ADR 0015): the cost so far counted up against a limit of £850, and a
player could spend £3,000 with nothing happening. Outside feedback asked for the financial side
to matter more: stop using the AI when the budget runs low, or stop the game when the money is
gone. The user chose: "game ends (automatically 2 stars are max because of the abrupt end)".

## Considered options

- Switch the AI off when the budget runs out. Rejected: the AI is the cheap part of the bill
  (about £170 a game). The money goes on wrong gifts, recalls and checks, and a player forced to
  work by hand only loses slowly.
- Keep money as a star only. Rejected by the user.
- End the game the moment the budget is gone. Chosen by the user.

## Decision

- The cost limit is a budget of £900. `view().cost` is `{ spent, limit, left, low }`: `left` counts
  down to 0 and `low` turns `true` at a quarter of the budget or less, with one `budgetLow` news
  item ("Budget running low.").
- The game ends the moment the cost so far reaches the budget, on the one event that took the last
  of it. The sleigh leaves with what is aboard. `end.reason` is `"budget"` (`"time"` otherwise) and
  `end.leftAt` the seconds that were left on the clock.
- A game the budget ended has lost the Within budget star, so it earns two stars at most. Full
  sleigh and Few mistakes are judged as usual on what is aboard. The Within budget goal is now
  "some of the budget left": a game that reaches the end of the clock with 102 right gifts aboard
  has it.
- Its headline is "Out of money." and its lesson one sentence naming where most of the budget
  went, for example "Wrong big gifts took £400 of your £900 budget." Wrong gifts and the cost of
  putting them right are weighed together against the checks and against the AI's running cost.
- Nothing the player chooses ends the game by itself. A half-time option, a recall or a rollback
  whose price would take the last of the budget is unavailable, with
  `why: "not enough budget left"`; half-time options now carry `available` and `why`.
- Money already committed when the budget ends: what was paid stays paid, work not finished is not
  charged, and gifts still in the workshop miss the sleigh, those being remade after a recall
  among them. Gifts such a game did not reach are not counted against the checkers.
- Remaking a big gift costs £15 (an everyday gift £3). Without it, automation everywhere with
  every big gift checked cost about the same as putting people on the big gifts.

This replaces two parts of ADR 0015: the cost no longer only counts up against a limit that
nothing enforces, and an option can again be unaffordable.

## Consequences

Every wrong big gift (£100) and every recall now threatens the game itself, mostly in the second
half. In 40 seeded games each: Automate left alone runs out of budget in every game, about 30
seconds after half-time, with no star (it earned one star in 85% of games before, which the user
had accepted and this overturns). A first-timer on the good plan runs out in 10% of games, an
expert in 5%. An expert who checks everything runs out in every game, one who automates
everywhere and checks the risky ones in 63%, one who checks only a few in 60%.

A first game that goes badly can end after about 100 seconds with "Out of money." The low-budget
state and its news line are the warning. The lessons "Over the cost limit" and the headline "Over
budget." are gone, and a time-ended game is never over the budget, so "Too much checking" is now
only a lesson about a slow sleigh.

`tests/budget-check.js` plays seeded games on five plans and checks that the game runs only while
budget is left, ends on the event that crossed it, caps the stars at two and never offers a choice
the budget cannot cover.
