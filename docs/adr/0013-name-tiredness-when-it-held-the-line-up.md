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
  still got "Checking was the bottleneck" in 15 of 20, because its checkers are rested.
- No balance figure moved; only lesson titles changed in `tests/balance-check.js` output.

### Follow-up: the bottleneck must be material

The bottleneck verdict scolded good play: over 24 seeds the sensible player read it in 18 games,
9 of them with 8 or more stars. The raw count of held gifts overstates the loss, because a gift
held at one departure usually rides the next sleigh: the sensible player's held gifts were 18 to
70% of the target, while it fell short by 1 to 30%.

- Held gifts now count only when the gifts they could have cost, the smaller of their number and
  the shortfall, reach 15% of the target (`LATE_SHARE`). Otherwise the comparison falls through
  to the next loss, and the dial reads from its position. The loss's amount is unchanged.
- A gate on the raw held count at 10 or 15% changed nothing. Pricing held gifts at the capped
  count instead of gating them was rejected: wrong gifts then outweighed them in never-resting
  games 50% short, which read "about right".
- 15% is where the games turn: games where checking could have cost 10 to 15% of the target
  averaged 7.8 stars, 15 to 20% 6.4, and 20 to 30% 5.7. At 10% the sensible player still read
  "bottleneck" in 4 of its 14 games of 8 or more stars; at 20% the careful player lost it in games
  36 to 38 gifts short.

Verdicts over 24 seeds, before and after (stars and points unchanged in every game):

| Player                             | Before                  | After                   | After, games of 8+ stars |
| ---------------------------------- | ----------------------- | ----------------------- | ------------------------ |
| Test sensible (7.9 stars)          | bottleneck 18, right 6  | right 15, bottleneck 9  | right 12 of 14           |
| Test careful (7.7)                 | bottleneck 18, right 6  | right 13, bottleneck 11 | right 9 of 11            |
| Test neverRests (3.8)              | tired 23, right 1       | tired 22, right 2       | right 1 of 1             |
| Test checkEverything (4.5)         | too much 24             | too much 24             | none                     |
| Test checkFew (6.5)                | too little 21, right 3  | unchanged               | right 3 of 5             |
| Lazy Automate, cocoa (1.3)         | too little 24           | unchanged               | none                     |
| Lazy Assist, cocoa (6.4)           | right 14, too little 10 | unchanged               | right 3 of 4             |
| Active, Assist both (9.7)          | right 21, too little 3  | unchanged               | right 20 of 23           |
| Active, set up by cargo (10.0)     | right 24                | unchanged               | right 23 of 23           |
| Careful, never moves, asks (4.0)   | right 17, tired 7       | unchanged               | none                     |
| Careful, never moves, no ask (3.8) | tired 17, right 7       | unchanged               | none                     |

- Where the bottleneck no longer wins, the sensible player's headline became "Fast, but wrong." in
  8 games and "Too slow for the letters." in 3; the next section gates those too.
- The careful player who asks children and never moves an elf reads "about right" in 17 of 24
  games, before and after: its losses are letters lost while the asking station holds the line,
  and its headline is "Too tired to keep up." in 23.
- The active Assist player read "Too slow for the letters." in 13 of 24 games, 12 of them with 9
  or more stars, from letters lost in games 2 to 8 gifts short.

### Follow-up: every negative headline must be material

The headline still scolded good play: 34 of the 66 games with 9 or more stars, over the same 24
seeds and players, got a negative headline.

- Lost letters pass the same gate as held gifts: the smaller of their number and the shortfall
  must reach 15% of the target (`LATE_SHARE`). 10% left one more game of 9 or more stars negative.
- Wrong gifts count when the mistakes goal was missed in two runs or more (`WRONG_RUNS`), or when
  they cost 30% of the whole budget or more (`WRONG_SHARE`, £540). Two runs alone let three
  checkFew games of 7 or 8 stars with £670 to £1,080 of wrong gifts read as good; budget shares of
  20 or 25% alone turned 7 to 14 games of 9 or more stars negative. Wrong gifts in games of 9 or
  more stars cost £0 to £1,136, £236 in the middle one, and only four reach £540.
- The headline, the dial and the lesson follow the largest loss that passes its gate. With none,
  the headline is "Christmas, carefully delivered." for a rating of 3 and otherwise "A good
  Christmas.", and the lesson names the largest loss as a tip for next time. The dial changed in
  none of the 264 games.

Headlines over 24 seeds and the same 11 players, by stars (stars and points unchanged):

| Stars            | Before                                                                                     | After                                                                    |
| ---------------- | ------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------ |
| 9 or more (66)   | carefully delivered 32, too slow for the letters 16, fast but wrong 15, careful 2, tired 1 | carefully delivered 32, a good Christmas 29, fast but wrong 3, careful 2 |
| 6 to 8 (69)      | fast but wrong 31, tired 19, careful 15, too slow for the letters 4                        | fast but wrong 22, tired 19, careful 15, a good Christmas 13             |
| 5 or fewer (129) | tired 69, fast but wrong 36, careful 24                                                    | unchanged                                                                |

- 61 of 66 games with 9 or more stars now get a positive headline; no game with 5 or fewer does.
  The five left are three games with £548 to £1,136 of wrong gifts and two games 37 gifts short
  while checking held gifts back.
- neverRests reads "Too tired to keep up." in 23 of 24 (its game of 10 stars reads "A good
  Christmas."), lazy Automate "Fast, but wrong." in 24, checkEverything "Careful, but slow." in 21
  as before.
- `tests/balance-check.js` output did not change.
