---
status: accepted
---

# 0013: Name tiredness when it held the line up

Date: 2026-11-11

## Context

ADR 0012 picks the end screen's headline, lesson and dial verdict from one comparison of the
game's losses. A second review of it found that tiredness was never named, even when it decided
the game.

- A test player who never rests got "Checking was the bottleneck: move an elf to checking" in 19
  of 20 games. It scores 3.9 stars against 7.8 for the same player resting at 60, so its loss
  came from not resting, and the fix it was given would not have helped.
- The break card's tired line used the average tiredness of all eight elves as the sleigh left.
  Idle elves sit at 0, so a lazy Automate player whose two checkers burnt out averaged 13 to 21
  and never saw the line, while its sleigh left with 3 of 48 gifts.

## Considered options

- A separate "tired" loss in the comparison of losses. Rejected: tiredness costs nothing by itself;
  it costs gifts by slowing a station, and those gifts are already counted as held or lost.
- Name tiredness as the reason a station held the line up, measured as the share of that station's
  working time it took. Chosen.

## Decision

- The rules count, for each station, the elf-seconds of work and the part tiredness took: the slower
  work of a tired elf and all of a burnt-out elf's time. Idle elves do not count.
- When tiredness took a quarter or more (`TIRED_SHARE`) of the working time at the station that
  held the line up (checking for held gifts, the station that held gifts back longest for lost
  letters), the headline is "Too tired to keep up.", the lesson says to rest them, and a bottleneck
  verdict's text says "Tired checkers held back ... rest them with cocoa before they burn out."
  Over 20 seeds, players resting at 60 lose about a tenth of their time to tiredness and players
  who never rest about half, so the threshold separates them cleanly.
- The break card's `report.tired` becomes the same share for the run that just left, with
  `report.burnouts`. When the sleigh was short and the share is 25 or more, the card's one line
  under the goals names it in place of the wrong-gift cause. When a decision is waiting, that line
  stays and carries the share as a short figure instead.

## Consequences

- The never-resting player now gets the tiredness verdict in 19 of 20 games; the sensible player
  still gets "Checking was the bottleneck" in 15 of 20, because its checkers are rested. Whether
  that verdict should be so common for sensible play is open: it reflects a real staffing limit
  at checking, but the user may prefer a gentler message when the game was otherwise well played.
- No balance figure moved; only lesson titles changed in `tests/balance-check.js` output.
