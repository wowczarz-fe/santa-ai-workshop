---
status: accepted
---

# 0018: Draw the one-sleigh game on a simpler play screen

Date: 2026-11-12

## Context

ADRs 0014 to 0016 turned the rules into one sleigh in two halves, one cost figure and unclear
wishes as decisions. The page still drew four runs: departure doors in the header, stars per run on
the sleigh, "Money left" beside the clock, a standing "Ask the child" switch with its own pile, a
break card after each run and a per-run table on the end screen. Testers had called the play screen
too busy, so every element kept on it needs a reason.

## Decision

- Top bar: the Few mistakes goal, the cost goal shown as "Cost so far" (spent against the limit, the
  game's one money figure), the clock, the Decide cue and Pause. The clock counts down the half under
  way and a small word beside it says which: "1st half", "2nd half", or "Half-time" while the card
  is up. Two segments were considered; the word reads at once and needs no legend.
- An unclear wish is a Decide card like any other: the rules' sentence with the child and the wish,
  one chip for what is at stake (the first of the rules' primary facts, "Gift: £12 if wrong"), and
  two options whose chips carry the figures: the wait in seconds for asking, the chance of a wrong
  gift for guessing. The card closes on an answer. Asking says at once when the answer comes; the
  cue counts it down and the rules' own line says what the child wrote back.
- Half-time card: the three goals as they stand, at most two lines (a decision still waiting, with
  Open it; then tiredness when it cost a quarter of the work or burnt an elf out, else the biggest
  cause of the wrong gifts), the one line on what changes in the second half, and the five options
  including Carry on at £0. The list of all causes and the costliest slip are gone. On a phone Carry
  on takes the last row whole.
- A wrong gift outlines the control its news line names for 5 seconds, with the line's action as the
  tag, taken from the rules' words up to the first colon. It replaces the rules' focus outline while
  it shows, so only one thing is outlined. For 4 seconds the line is not replaced by the result of
  the player's own move. On a phone the status line has two lines, so the action at its end shows.
- End screen: stars out of 3 with the three goals in the hero, then the practice tiles from
  `end.practices` with the player's figure under each action (shown on unused tiles too, on a
  phone as well), then the dial, causes, one account row (AI, checks, half-time, fixing, wrong gifts,
  cost of limit, mistakes stopped), "Was checking worth it?", the firm's offer and the blunders.
- The best result is stored as stars out of 3 under a new key, `workshop-best-stars`; the old best
  in points and stars out of 12 is removed rather than converted.

## Consequences

The header loses the doors, the top bar loses Money left, the reading station loses the switch and
its second pile, and the sleigh loses the run stars. The page draws every figure from `view()`, so
the rules can retune targets, limits, prices and the half length without a page change. The tag on
a wrong gift depends on the rules keeping the action as the last sentence of a `loaded` line.
