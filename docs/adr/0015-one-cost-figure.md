---
status: accepted
---

# 0015: One cost figure that counts up

Date: 2026-11-12

## Context

The game showed two money figures: the whole game's "Money left" from a budget of £1,800, and a
per-run allowance for the Within budget star. Testers found the two confusing, and the game carried
on when money ran out: paid one-off actions stopped with an "out of money" reason, while wages, AI
and checks kept costing. Elves' wages were most of the bill and the player could not change them.
The user ruled one money figure: cost so far, counting up, with one star for staying at or below a
stated figure, and nothing ever unaffordable (rework brief, ruling 3).

## Considered options

- Keep money left and drop the per-run allowance. Rejected: a figure that runs down invites
  "what happens at zero", which is the confusion the testers reported.
- Cost so far counting up, against one limit for the whole game. Chosen, as ruled.

## Decision

- `view().cost` is `{ spent, limit }`. `spent` is everything spent so far plus what the wrong gifts
  aboard will cost when the sleigh leaves. It is the figure of the Within budget goal and of the
  end screen's `costs.total`.
- What counts: the AI's running cost (£0.22 a second per station on Assist, £0.72 on Automate),
  checks (£2), the half-time purchase (£40 to £100), fixing (remakes £3, a recall £20 plus £40 a
  gift, twice that for a big one, a rollback £65) and wrong gifts aboard (£12, or £100 for a big
  gift). Asking a child costs time only.
- Elves' wages are removed. They were the same in every game and hid the costs the player decides.
- The limit is £700. A sensible game costs £630 on average (AI £141, checks £126, half-time £73,
  fixing £76, wrong gifts £215) and meets it in 68% of games; checking everything costs £739 and
  meets it in half; Automate left alone costs about £2,900.
- Removed: the £1,800 budget, money left, the per-run allowance, the "money ran out" news item and
  lesson, every "out of money" reason on an option, the "Spent more than Santa had" lesson (now
  "Over the cost limit") and the end screen's `costs.people` and `costs.budget`.

## Consequences

The top bar has one money figure and it only goes up, except when a recall takes wrong gifts off
the sleigh. Because wrong gifts count at their price, the cost goal and the mistakes goal often
fall together in a bad game; the cost goal alone is decided by what the player buys, which is
where the half-time purchase and the checking level become a trade. A page that showed money left
must show cost so far against the limit instead.
