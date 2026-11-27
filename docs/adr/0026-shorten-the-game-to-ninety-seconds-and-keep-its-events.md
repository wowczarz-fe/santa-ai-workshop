---
status: accepted
---

# 0026: Shorten the game to 1:30 and keep its events

Date: 2026-11-27

## Context

An outside reviewer found that the game lasted too long for how little there was to do. The user
decided to cut the clock from 2:30 to 1:30 and keep the game as it plays now, only denser: the same
decisions, cocoa breaks, drift warnings and half-time, at a faster pace. Elves and the AI keep the
seconds they take per gift, so the game does not turn frantic.

## Decision

- Each half lasts 45 seconds (was 75). Letters still arrive at 0.6 and then 1.1 a second, the
  faster rate from 9 seconds in (was 15), and stop 8 seconds before the end (was 15), a second
  more than a straight cut so that a good game fills the sleigh about as often as before. The first
  big gift comes 5 seconds into the second half (was 8), and each half's unclear letter 7 to 24
  seconds in (was 12 to 40).
- Every timer that sets how often something happens is cut to about 0.6 of its old length, so it
  happens about as often per game:
  - Tiredness builds 1.67 times as fast (`WORK_STRAIN` 1.08, `CHECKER_STRAIN` 0.17,
    `PRESSURE_STRAIN` 0.33, idle recovery 0.2 a second). A burnout keeps an elf off for 9 seconds
    (was 15) and a cocoa break from tired takes about 2 seconds (was 3).
  - Checkers start to drift after 5 clean AI gifts and stop looking after 12 (was 8 and 20). A
    caught mistake takes 6 off that count (was 10). Drift lines wait 12 seconds at the start and
    between lines (was 20).
  - A wrong-gift line waits 12 seconds before it repeats advice (was 20), the checking report
    comes every 27 seconds (was 45) and a setting counts as used after 6 seconds (was 10).
  - A tested update goes in 12 seconds into the second half (was 20), a rollback stops the toy
    machine for 5 seconds (was 8) and a recall keeps the checkers busy for 12 seconds at most (was
    20).
- The goals and money follow the shorter game. The Full sleigh needs 89 correct gifts (was 146)
  and the budget is £610 (was £1,000), a little over 0.6 of it because a wrong big gift (£100) or a
  big remake (£40) is a larger share of a smaller budget. One-off prices scale with the budget:
  the half-time update £25, tested update £30, training £60, cocoa for everyone £30 (were £40,
  £50, £100, £50), a rollback £40 (was £65) and a recall at least £25 more than its gifts cost
  aboard (was £40). Prices per gift and per second stay, because the number of gifts and seconds
  already scales.
- Minimal mistakes allows 1 wrong gift aboard (was 2). Mistakes happen per gift, so a shorter
  game has about 0.6 as many, and 1 of them is as hard to stay within as 2 were at 2:30.
- The checking dial's floor for "a star lost to checking" is £60 (was £100), in step with the
  budget.

## Consequences

Over 200 seeded games each (2:30 figures from ADR 0025 in brackets): a first-timer on the good
plan earns 2.02 stars (1.96), three in 34% (28%), none in 10% (11%), and the budget ends 14% of
games (14%). An expert earns three stars in 74% (82%). Elves on Assist all game earn 2.73 for an
expert and 1.84 for a first-timer against 2.67 and 2.02 on the good plan (2.64 and 1.83 against
2.63 and 1.96). Automation everywhere earns 1.90 and 1.51 (1.76 and 1.46), checking everything 1.23
and 1.17 (1.02 and 1.14), checking a few 1.12 and 1.13 (0.69 and 0.69). By hand untouched earns
nothing, Automate untouched nothing in 82% of games (89%).

A first-timer earns three stars more often than the 10 to 25% aimed for, as at 2:30. With fewer
gifts luck counts for more: checking a few loses less than before, and Automate untouched fills
the sleigh with at most 1 wrong gift in about 1 game in 100, when the AI happens to get nearly all
its 20 or so big gifts right.

Decisions, cocoa breaks, burnouts, drift lines and the faulty update happen about as often per
game as before, so about 1.67 times as often per minute. Wrong-gift lines happen about two thirds
as often per game, recall decisions about four fifths as often and caught-gift lines about 0.6 as
often, because a mistake is a chance per gift and the game holds 0.6 as many gifts. Keeping them would need the AI and the elves to make
more mistakes per gift, which would change the story of ADR 0025, so it is left for the user to
decide.

The balance check allows at most one call on a first-timer's attention every 9 seconds in each
half (was 15), since the same calls now come in 45 seconds. Its scripted first-timer moves an elf
every 9 to 15 seconds (was 15 to 25), follows "check all" advice for 12 seconds (was 20), and keeps
a faulty update with under 12 seconds left (was 20). How fast it looks and answers stays, since that
is the player, not the game. Two limits are loosened for the noise of a shorter game: Automate
untouched may earn three stars in at most 2 of 100 games (was never), and the budget may end at
most 17% of a first-timer's games on seeds 1 to 100 (was 15%).
