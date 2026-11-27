---
status: accepted
---

# 0027: Three unclear wishes a game

Date: 2026-11-27

## Context

Shortening the game to 1:30 (ADR 0026) left a first-timer about 3 decision cards a game. The user
decided the shorter game needs more to do and chose a third unclear wish over other cards. ADR 0016
and ADR 0026 set two unclear letters, one in each half.

## Decision

- Three unclear letters a game, from three different children, at seeded times: one 6 to 16
  seconds in, one 26 to 37 seconds in and one 7 to 24 seconds into the second half.
- The extra letter goes in the first half because that half asked for less: about 1.3 cards and
  one call on the player every 17 seconds, against 1.7 cards and one call every 12 seconds after
  half-time, where the faulty update and most recalls fall.
- The two first-half windows do not overlap, so the letters come at least 10 seconds apart. The
  late one ends 8 seconds before half-time, so its card is answered before the half-time card. The
  second-half window is unchanged: it opens 2 seconds after the first big gift and closes 13
  seconds before letters stop.
- The first half's letters are never big gifts. Seven of the ten unclear wishes are everyday ones,
  so the first two always find one.

## Consequences

Over seeds 1 to 100, a first-timer on the good plan meets 4.1 cards a game (3.0), 2.4 of them in
the first half (1.3), which asks for one thing every 12 seconds in each half. Reading the extra
letter adds about one gift, so the sleigh is full more often (48% against 35%), and a wrong reading
costs the Minimal mistakes star more often (kept in 69% against 79%). The first-timer earns 2.01
stars (1.99), three in 35% (30%). An expert earns 2.65 (2.67), three in 75% (71%).

An expert can now meet six decisions, three letters, the faulty update and two recalls, so the
balance check allows two to six.

The extra letter's random draws reshuffle every seeded game, and two limits that ADR 0026 left at
their edge now miss by one game in 100: Automate untouched runs out of money in 73% (at least 75%)
and the budget ends a first-timer's game in 16% (at most 15%). Over seeds 101 to 250 both read the
same with two letters as with three (74% and 11%), so the change itself does not move them. The
two pull the budget opposite ways, so no budget change fixes both, and the user decides the tuning.
