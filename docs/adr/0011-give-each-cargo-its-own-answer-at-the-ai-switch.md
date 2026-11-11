---
status: accepted
---

# 0011: Give each cargo its own answer at the AI switch, and drop watching

## Context

The user played the cargo build (ADR 0009) with the named goals (ADR 0010) on 2026-11-11. He
liked that each sleigh run differs, but could not see why full automation with elves watching
was the answer to everything. The sweep for ADR 0009 agreed with him: for big gifts and for the
rush the best set-up was to automate both stations and put the elves on checking, and only the
unclear letters called for Assist. The cargo changed how much to check and left the more
interesting choice, where the human sits, untouched.

"Watching the toy machine" was the job given to elves left at an automated toy station
(ADR 0003). It gave a small chance of spotting a faulty update sooner. On screen it read as the
game recommending that elves stand and watch.

## Considered options

- Let elves at an automated toy station feed the machine and add output. Rejected for now: it
  adds a rule to explain while the user is asking for fewer.
- Keep watching and explain it better. Rejected: the job's value was too small to be worth a
  sentence.
- Retune so that each later cargo is best served by a different AI level, and remove watching.
  Chosen.

## Decision

Each later cargo has a different best position of the AI switch:

- Big gifts: Assist at toys. An elf confirming each draft now catches 95% of the AI's slips
  (was 85%), and the machine alone slips on 45% of big gifts (was 30%).
- Unclear letters: Assist at reading, with the toy machine left to run. A checker now catches
  only 30% of mistakes on an unclear wish nobody asked about, because the checker cannot tell
  what the child meant either, so these have to be fixed at reading.
- The rush: Automate both, with enough elves on checking.

Elves at an automated toy station have nothing to do and are shown as free to move. Elves at
automated reading still ask children when asking is on. The walkthrough card for the toy AI
describes the trade instead of prescribing Automate: Assist is safer and needs elves; Automate
is faster and frees them.

## Consequences

Over six seeds a player who switches set-up for each cargo scores 13% more points and 14% more
stars than the best single fixed set-up, where the cargo change alone gave 2%. That player
averages 9.5 stars.

Three results are thin. On the rush, Assist at both stations trails Automate by a small margin,
so automation is better there without being clearly so. The switching player reads "about right"
on the end-of-game dial only after the "too little" line moved from 0.2 to 0.1, the second time
that line has moved to fit good play; the dial needs a firmer basis. And the comparison used
fifteen candidate set-ups, not the full grid.

A faulty update is now noticed only by elves confirming toys on Assist, by checkers, on the
sleigh or by an investigation.
