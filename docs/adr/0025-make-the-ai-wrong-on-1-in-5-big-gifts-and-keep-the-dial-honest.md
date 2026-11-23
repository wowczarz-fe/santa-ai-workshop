---
status: accepted
---

# 0025: Make the AI wrong on 1 in 5 big gifts, and keep the dial honest

Date: 2026-11-23

## Context

ADR 0019 made the AI as reliable as a fresh elf on everyday gifts and left it poor on big ones:
about 1 in 2 big gifts made wrong. The user still found the message too simple ("AI is weak",
"gets many wrong") and set a new story: on routine work the AI is as reliable as your elves, much
faster and never tires. Its limit is big, unusual gifts, rare one-off requests it has seen few of,
where it can be wrong without noticing. Those mistakes cost most, so that is where an elf's
judgement goes.

In the same round the user finished a game with 0 stars while the end-screen checking dial sat at
the top of "About right". That game checked a lot, ran out of money and let 3 wrong gifts past
tired checkers. The rule "a game that lost the mistakes star never reads too much" (ADR 0014)
pinned the needle at the edge of "About right" although checks that did not pay had drained about
£200 of a budget that ran out. A by-hand game that lost £8 to checks could also sit at the same
spot, because the needle weighed losses against the game's own small spending.

## Decision

- The AI makes about 1 in 5 big gifts wrong (`RISK.aiMakeBig` 0.2, was 0.45). Misreading big
  letters stays at about 1 in 7. The Automate tooltip reads "gets about 1 in 5 big gifts wrong".
- Every player text follows the story and never calls the AI weak or poor: for example "The AI
  handles these as reliably as your elves, and much faster." and "Big, unusual gifts still need an
  elf's judgement." `tests/wording-check.js` bans the old framing.
- Three numbers move so the strategies keep their order:
  - Making a big gift again costs £40 (was £15). With fewer AI mistakes, automation everywhere with
    the riskiest gifts checked came within 0.2 of a star of the good plan. A mistake caught late is
    what should cost, so the remake price carries the difference.
  - The budget is £1,000 (was £900). The dearer remakes also hit the good plan through misread big
    letters caught at checking, and without the extra £100 the budget ended 13 to 15% of a
    first-timer's games.
  - The Full sleigh target is 146 (was 145). Fewer wrong big gifts means more correct ones, and the
    first-timer's three-star share rose to about 29%.
- A game that lost a star to checking never reads "About right". Checking cost the budget star
  when that star was lost and checks that did not pay cost £100 or more: the dial reads "Too much".
  It cost the mistakes star when that star was lost and unchecked wrong gifts cost £100 or more
  beyond checking them: the dial reads "Too little". The larger figure decides when both hold. A
  game that lost every star for other reasons, such as a slow sleigh, may still read "About right".
  The answer under the dial never asks for fewer checks on a game that lost the mistakes star.
- The needle weighs the two losses against the budget instead of the game's spending, so a few
  pounds in a cheap game keep it near the middle.

## Consequences

Over 200 seeded games each: a first-timer on the good plan earns 1.92 stars, three in 24%, none in
9%, and the budget ends 11% of games. An expert earns three stars in 76%. Automation everywhere
earns 1.76 (expert) and 1.46 (first-timer) against 2.52 and 1.92, checking everything 1.10 and
1.18, checking a few 0.77 and 0.79. By hand untouched earns nothing, Automate untouched nothing in
89% of games.

Elves confirming the toys all game now beat the good plan by about a quarter of a star (2.77
against 2.52): checkers on Random through the clean first half come to trust the AI and wave big
gifts through later. The balance check reports this as a warning until the good plan is chosen
again. Two of its limits were loosened to fit 40 seeds: no star in at most 15% of first-timer
games, and automation everywhere at three stars at most 60% as often as the good plan.

`tests/balance-check.js` fails when a game that lost a star to checking reads "About right".
