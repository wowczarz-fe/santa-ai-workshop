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
- Four numbers move so the strategies keep their order:
  - Making a big gift again costs £40 (was £15). With fewer AI mistakes, automation everywhere with
    the riskiest gifts checked came within 0.2 of a star of the good plan. A mistake caught late is
    what should cost, so the remake price carries the difference.
  - Assist costs the same as Automate, £0.72 a second per station (was £0.22). On Assist the AI
    still drafts every gift. Before, Assist was the cheaper and equally fast choice on everyday
    gifts, so keeping elves on Assist all game beat automating the routine first half, which taught
    players not to trust the AI even where it is as reliable as the elves.
  - The budget is £1,000 (was £900), because the dearer remakes and Assist on the big gifts also
    cost the good plan.
  - The Full sleigh target is 146 (was 145). Fewer wrong big gifts means more correct ones.
- The scripted good plan in `tests/balance-check.js` checks the riskiest gifts from the start (it
  checked a few in the first half). That is what a careful player does, and on Random the checkers
  come to trust the AI on the clean everyday gifts and wave big ones through after half-time.
- A game that lost a star to checking never reads "About right", judged by the raw figures (the
  goals count only once the sleigh is nearly full). Checking cost the budget when the budget ran
  out and checks that did not pay cost £100 or more: the dial reads "Too much". It cost the
  mistakes star when more than 2 wrong gifts went aboard and under-checking cost £100 or more: the
  dial reads "Too little". In such a game, wrong gifts that trusting checkers waved through or tired
  ones missed count as under-checking: checks paid for but not done properly. The larger figure
  decides when both hold. A game that lost its stars for other reasons, such as a slow sleigh, may
  still read "About right", but a needle that reads "About right" sits at least 0.05 inside both
  edges. The answer under the dial never asks for fewer checks on a game that lost the mistakes
  star.
- The needle weighs the two losses against the budget instead of the game's spending, so a few
  pounds in a cheap game keep it near the middle.

## Consequences

Over 200 seeded games each: a first-timer on the good plan earns 1.96 stars, three in 28%, none in
11%, and the budget ends 14% of games. An expert earns three stars in 82%. Elves on Assist all game
earn 2.64 (expert) and 1.83 (first-timer) against 2.63 and 1.96: level for an expert, who moves
elves well and rarely runs short of money, and behind for a first-timer. Automation everywhere
earns 1.76 and 1.46, checking everything 1.02 and 1.14, checking a few 0.69 and 0.69. By hand
untouched earns nothing, Automate untouched nothing in 89% of games.

With the AI alone at both stations, about 1 in 3 big gifts go wrong (1 in 7 misread, then 1 in 5
made wrong). Bringing that to 1 in 5 overall (for example 1 in 10 misread and 1 in 9 made wrong)
made Automate untouched earn a star in two games of three and left automation everywhere only 0.2
of a star behind, so it needs its own rebalance and is left for the user to decide.

The balance check plays 100 seeds (it played 40, whose averages moved by about 0.2 of a star
between seed ranges). It fails when a first-timer on the good plan falls behind Assist all game,
or an expert falls more than 0.1 of a star behind it, and when a game that lost a star to checking
reads "About right". No star in at most 15% of first-timer games and automation everywhere at
three stars at most 60% as often as the good plan stay loosened from 10% and 50%.
