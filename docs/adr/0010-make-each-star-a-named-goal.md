---
status: accepted
---

# 0010: Make each star a named goal: full sleigh, right gifts, within budget

## Context

The user played the cargo build (ADR 0009) on 2026-11-11 and reported three things. He usually got
a "too little checking" verdict at the end. He could not tell how to limit mistakes. And because
the stars seemed to reward the gift target, he prioritised speed.

All three had a cause in the rules or the page. Stars did fall when wrong gifts went aboard, but
the top bar only showed gifts against the target, so nothing during play said that correctness was
scored. The controls that limit mistakes were never linked to the mistakes they stop. And after
the cargo retune the end-of-game dial read "too little" even for the best scripted player.

The game also showed two scores, points and stars, on top of the target, the budget and the
account.

## Considered options

- Keep the stars and add a warning when wrong gifts pile up. Rejected: a warning is one more thing
  to read, and the score would still point at speed.
- Subtract points for wrong gifts and keep points as the headline. Rejected: nobody can tell what
  moved a points total.
- Give each of the three stars a name and a visible limit. Chosen.

## Decision

Each sleigh run has three goals worth one star each, shown live during the run:

- Full sleigh: the right gifts aboard reach the run's target.
- Right gifts: wrong gifts aboard stay within a limit of one for every twelve gifts of target,
  at least one. Every wrong gift counts as one, so the figure on the page is the number a player
  can see aboard; the dearer big gifts already cost more in points and in the bill.
- Within budget: money spent in the run stays within an allowance of £300 plus £4 for each gift
  of target.

The second and third only count once the sleigh holds two thirds of its target, so an idle
workshop earns nothing. Stars are the score the player steers by; points stay in the rules as a
tie-break and leave the top bar.

Every wrong gift that goes aboard names its cause and the control that would have stopped it, and
the break report lists the costliest causes of the last run with one sentence each on the fix.

The end-of-game dial counts as under-checking only the avoidable part of unchecked wrong gifts:
what they cost beyond what checking that kind of gift would have cost. "About right" now runs
from 0.2 to 0.8 on the dial.

## Consequences

Speed, quality and cost are each a visible target, which is the article's balancing act stated as
a score. Over six seeds the scripted player who sets up for each cargo earns about 8 stars and
reads "about right" every time; automating with few checks loses the right-gifts star on most
runs and reads "too little"; checking everything with two checkers never fills a sleigh and reads
"too much"; a hands-off game earns about one star.

A full sleigh is now the hardest of the three for a good player (met on 15 of 24 runs), so the
cargo targets may need lowering after play. The "about right" band is wide, which makes the
verdict kinder and less precise. With both stations automated, elves still have nothing useful to
do except check (ADR 0009), so the trade-off between output and checking remains weaker than the
score suggests.
