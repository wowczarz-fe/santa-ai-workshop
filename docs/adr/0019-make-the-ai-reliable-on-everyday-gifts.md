---
status: accepted
---

# 0019: Make the AI as reliable as a fresh elf on everyday gifts, and poor on big ones

Date: 2026-11-13

## Context

In the game the AI was always less reliable than a person: a fresh elf got 1 job in 200 wrong, the
AI 2 to 3 in 100 on everyday gifts and 15 to 45 in 100 on big ones. The tour said it outright:
"more AI is faster, but makes more mistakes". Outside feedback called that too simplistic, and the
user agreed: "we don't want the simplistic message AI makes mistakes or is stupid, currently it is
REALLY GOOD already". The user also asked for "nice but clear comms" about it.

The user's own play raised a second point in the same round: a tired elf's slip showed the wanted
toy "in the wrong size", which looked like the right gift, so the player could not see what had
gone wrong.

## Considered options

- Keep the rates and only soften the words. Rejected: the words would then say something the
  rules do not do.
- Make the AI as good as a fresh elf everywhere. Rejected: nothing would be left for people to
  do, and the game's point is where oversight belongs.
- Make the AI as good as a fresh elf on everyday gifts and keep it poor on big, unusual ones.
  Chosen by the user.

## Decision

- On everyday gifts the AI's error rate equals a fresh elf's, at reading and at making (1 job in
  200). It never tires; elves still slip more as they tire. On big gifts the AI stays poor: about
  1 in 7 misread and about 1 in 2 made wrong.
- The first half carries everyday gifts only (it carried about one big gift in five before), so
  automating is right there. The second half carries 6 big gifts in 10, the first of them 8
  seconds in, so a player who has read the half-time card has time to put people on them. Each
  half's unclear letter fits its cargo: the first half's is never a big gift.
- Every text the rules hand the page says where the AI is reliable and where it is not, and none
  says or implies that more AI means more mistakes in general:
  - cargo lines: "The AI matches a fresh elf here. A wrong one costs £12." and "The AI gets many
    of these wrong, and each costs £100.";
  - the half-time line: "Big gifts come next. The AI gets many of these wrong, and each costs
    £100.";
  - each AI level's information carries two figures by kind of gift (`levers.ai0[].everyday` and
    `.big`), for example "about 1 in 200 wrong, same as a fresh elf" and "about 1 in 2 wrong";
  - a wrong-gift line asks for Assist only for a big gift ("Big gifts need a person: put Toys on
    Assist."), and a rare slip on an everyday gift asks for nothing ("Keep going: on everyday
    gifts the AI slips as rarely as a fresh elf.");
  - causes and lessons name the kind of gift: "Big gifts need a person", "Rare AI slips making
    everyday toys" (with no fix to offer).
- `end.reliability` gives the player's own figures for the end screen: jobs done and done wrongly,
  by kind of gift, by the AI and by the elves, counted before any confirmation or check.
- An elf's slip by hand is a mix-up: the child gets another child's toy of the same kind, drawn
  per parcel from the seed, never the toy asked for. "In the wrong size" and `made.base` are gone.
  A mix-up is not one of the AI's blunders.
- A caught mistake now takes 10 clean gifts off the trust of the elves who caught it (it was 5).
  Checkers drift on the clean everyday gifts of the first half; with the old figure they then
  waved half the big gifts through for the rest of the game.

## Consequences

The story of a game changes: automate the routine first half, then decide where people go when
the cargo changes. The good plan in `tests/balance-check.js` is now Automate at both stations
with a few checks in the first half, then elves confirming the toys and the risky ones checked.
An expert on it earns three stars in 93% of 40 seeded games; a first-timer earns 2.08 stars on
average, three in 28% and fills the sleigh in 40%.

Throughput is easier, because the AI can take the whole first half, so the Full sleigh target
rose from 110 to 145 right gifts of about 149 letters, and the mistakes and budget stars count
from 102 aboard. Nearly every letter has to become a right gift.

Never resting elves now costs little (0.18 of a star for a first-timer, 0.10 for an expert, where
it cost about a star and half a star), because on the good plan the elves stand idle through the
first half and rest by themselves. The balance check reports it as a warning. Assist on everyday
gifts buys almost nothing; it is the tool for big gifts.

`tests/wording-check.js` fails on the old framing in any string of `view()`, and
`tests/slip-check.js` checks the mix-ups.
