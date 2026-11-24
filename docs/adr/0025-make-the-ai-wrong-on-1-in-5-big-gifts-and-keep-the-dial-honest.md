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
  - Making a big gift again costs £45 (was £15). With fewer AI mistakes, automation everywhere with
    the riskiest gifts checked came within 0.2 of a star of the good plan. A mistake caught late is
    what should cost, so the remake price carries the difference.
  - Assist costs £1.50 a second per station (was £0.22), against £0.72 for Automate. On Assist the
    AI still drafts every gift and an elf spends its time confirming each one, so it costs more
    than the AI alone. Before, Assist was the cheaper and equally fast choice on everyday gifts, so
    keeping elves on Assist all game beat automating the routine first half, which taught players
    not to trust the AI even where it is as reliable as the elves.
  - The budget is £1,100 (was £900), because the dearer remakes and Assist on the big gifts also
    cost the good plan.
  - The Full sleigh target is 146 (was 145). Fewer wrong big gifts means more correct ones.
- The scripted good plan in `tests/balance-check.js` checks the riskiest gifts from the start (it
  checked a few in the first half). That is what a careful player does, and on Random the checkers
  come to trust the AI on the clean everyday gifts and wave big ones through after half-time.
- A game that lost a star to checking never reads "About right". Checking cost the budget star
  when that star was lost and checks that did not pay cost £100 or more: the dial reads "Too much".
  It cost the mistakes star when that star was lost and unchecked wrong gifts cost £100 or more
  beyond checking them: the dial reads "Too little". The larger figure decides when both hold. A
  game that lost every star for other reasons, such as a slow sleigh, may still read "About right".
  The answer under the dial never asks for fewer checks on a game that lost the mistakes star.
- The needle weighs the two losses against the budget instead of the game's spending, so a few
  pounds in a cheap game keep it near the middle.

## Consequences

Over 200 seeded games each: a first-timer on the good plan earns 2.00 stars, three in 28%, none in
9%, and the budget ends 12% of games. An expert earns three stars in 82%. Elves on Assist all game
earn 2.53 (expert) and 1.77 (first-timer) against 2.64 and 2.00. Automation everywhere earns 1.94
and 1.62, checking everything 1.03 and 1.19, checking a few 0.76 and 0.81. By hand untouched earns
nothing, Automate untouched nothing in 83% of games.

Assist all game stays only about 0.1 of a star behind for an expert, who moves elves well and
rarely runs short of money. A wider gap would need Assist to cost more again, which would also tax
the big gifts where Assist belongs.

The balance check plays 100 seeds (it played 40, whose averages moved by about 0.2 of a star
between seed ranges). It fails when the good plan falls behind Assist all game at either skill, and
when a game that lost a star to checking reads "About right". No star in at most 15% of
first-timer games and automation everywhere at three stars at most 60% as often as the good plan
stay loosened from 10% and 50%.
