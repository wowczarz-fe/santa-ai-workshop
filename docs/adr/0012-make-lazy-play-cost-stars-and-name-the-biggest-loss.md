---
status: accepted
---

# 0012: Make lazy play cost stars, and name the biggest loss at the end

Date: 2026-11-11

## Context

A review of the polished look found that the stars and the end screen taught the wrong lessons.

- A player who set both stations to Assist, touched nothing and took cocoa at every break scored
  9.4 of 12 stars, against 9.6 to 10.0 for active play (16 seeds). Break cocoa made every elf
  fresh, so resting tired elves during a run never paid.
- The budget goal counted only money spent. Automate-and-walk-away earned its one star from the
  budget on nearly every first run while shipping 9 to 17 wrong gifts against 3 allowed, and every
  Assist player met it 93 to 100% of the time.
- The end dial counted gifts held up at checking as over-checking. A careful player who checked
  only the risky parcels but never moved an elf to checking was told "Too much checking", the
  opposite of what the game teaches.
- The lesson was picked mostly from what the wrong gifts cost, so a game lost to empty sleighs and
  piled-up letters was explained by four wrong gifts, and the headline was the same whatever
  happened.

## Considered options

- Retune elves or AI speeds so lazy play falls behind. Rejected: the reviewers' sweep showed every
  such change hurt active players as much as lazy ones.
- Cocoa at a break halves tiredness instead of resetting it, and wrong gifts aboard count against
  the run's budget goal. Chosen. The reviewers also proposed cutting the allowance from £300 to £150
  plus £4 a gift; see below.
- Keep the dial and add a sentence about bottlenecks under it. Rejected: two messages on one card,
  and the end screen must get shorter.
- One comparison of the game's losses, in its own money, that picks the dial verdict, the lesson
  and the headline together. Chosen.

## Decision

- Break cocoa halves each elf's tiredness. Mid-run cocoa is unchanged.
- The budget goal counts what the wrong gifts aboard will cost when the sleigh leaves, on top of
  the money spent. The allowance stays at £300 plus £4 for each gift of target. With wrong gifts
  counted, £150 met the four aims below just as well, but it dropped the sensible test player from
  7.8 to 6.8 stars and put it over budget on half its unclear-letter runs, because asking children
  costs money: a tight allowance punishes the very practice the game recommends there. Lazy players
  barely notice the base, since they lose the goal by not filling the sleigh.
- The end compares four losses, held and lost gifts at £6 each (half a wrong everyday gift) and
  only when the game fell short of its target:
  - wrong: what the wrong gifts delivered cost;
  - over: gifts the checking pile held back while every parcel was checked;
  - held: gifts the checking pile held back while only some parcels were checked;
  - lost: other letters lost to a full pile.
    A gift held back is one waiting at checking as a sleigh leaves, an order stuck behind a full
    checking pile, or a letter lost while checking was the station holding up the line.
- The dial no longer counts held-back gifts as over-checking unless every parcel was being checked.
  When "held" is the largest loss the verdict is a new one, "bottleneck": checking held back that
  many gifts, move an elf to checking when its pile fills. When "over" is the largest, the verdict
  is "too much" and the needle moves into that zone if the money alone left it short. The rules
  now give the dial's thresholds, and the verdict is read from the rounded position, so a dial
  drawn from them cannot show one verdict with the needle in another zone.
- The lesson follows the same comparison: the bottleneck or too-much text when those win, "Letters
  piled up" naming the station that held things up longest when lost letters win, and otherwise the
  causes of the wrong gifts. When the faulty update's trains that went aboard while its decision
  waited unanswered made half or more of the wrong-gift cost, the lesson says so. The headline is
  "Fast, but wrong.", "Careful, but slow.", "Too slow for the letters." or, for a rating of 3,
  "Christmas, carefully delivered."

## Consequences

Measured over 16 guided seeds before and after, with the reviewers' players, and over 20 seeds for
the test players:

| Player                                 | Before | After |
| -------------------------------------- | ------ | ----- |
| Lazy Automate, first break option      | 1.3    | 0.3   |
| Lazy Automate, cocoa at every break    | 4.1    | 1.3   |
| Lazy Assist, cocoa at every break      | 9.4    | 6.3   |
| Lazy Assist, cocoa also during the run | 9.4    | 8.2   |
| Active, Assist both all game           | 9.6    | 9.5   |
| Active, set up for each cargo          | 10.0   | 9.9   |
| Test player sensible (20 seeds)        | 8.1    | 7.8   |
| Test player checkFew (20 seeds)        | 7.5    | 6.5   |
| Test player bypassHeavy (20 seeds)     | 7.5    | 6.5   |

Lazy Assist with cocoa now trails active play by 3.2 to 3.6 stars, and resting tired elves during
a run is worth about 1.9 stars. No lazy player meets any goal on more than 64% of runs. On the six
seeds of the test table the sensible player still trails checkFew (6.7 against 7.3); over 20 seeds
it leads by 1.3, so the six-seed table is noise.

The balance check's floor for the sensible player drops from 8 to 7.5 stars, and the player who
sets up for each cargo must read "about right" on two of three seeds instead of all three: without
held gifts on the over side, its unchecked big-gift slips read "too little" on seed 1. That is an
honest reading, not a fault, but the dial's thresholds have now been fitted to good play three
times and still need a firmer basis.

The careful player of the review now reads "bottleneck" on 11 of 16 seeds and "Letters piled up" on
the rest. The page has to draw the dial's zones from `thresholds` and give the "bottleneck"
verdict its own look.
