---
status: accepted
---

# 0005: Four sleigh runs with one choice between them

## Context

Wiktor played the one-screen build (ADR 0003) on 2026-11-11. He liked the simpler screen and
moving elves, but the mechanics still felt complex, he could not tell whether his actions helped,
and letters kept piling up whatever he did. Decisions had an obvious answer, so he "just clicked the
rational ones". He asked for progress and actions to feel clearer and more rewarding, suggested
borrowing from existing games, and wants the game to be "addictive almost".

Three causes. Letters arrived faster than any by-hand staffing could read from the first second, so
the first move could not work. The only goal was 155 gifts four minutes away, with nothing to
celebrate on the way. And AI updates and training interrupted play as cards the player answered
while busy.

## Considered options

- Keep one continuous run and add milestones and effects. Rejected: it rewards progress but leaves
  the strategic decisions arriving mid-rush, where they get the quickest answer and not the best
  one.
- Separate levels with a results screen each. Rejected: it breaks the clock, which is the part
  Wiktor said works, and makes one game too long for a campaign link.
- One clock with four sleigh runs inside it and one choice at each break. Chosen. It borrows the
  short rounds with stars of kitchen-rush games and the pick-one-upgrade pause of transit-map
  games.

## Decision

The four minutes hold four sleigh runs of a minute each. Each run has its own target, and the
targets add up to the game's target of 236. When a run leaves, its gifts are delivered for good and the run earns one to
three stars; a run with its target met and no wrong gift earns a bonus.

After each of the first three runs the clock stops for one choice. The player sees how the run went,
including a slip for each wrong gift naming what let it through, and picks exactly one of: install
an AI update now, test it first, train the checkers, or cocoa for every elf. Each option shows what
it gives, what it risks and what it costs, and which is best depends on those figures and on the
state of the workshop. AI updates and training happen only here. A faulty update that was installed
shows up in the next run and is handled through incident decisions.

Letters arrive slowly in the first run and faster in each later one, so the first thing the player
does visibly works and each control arrives as the answer to a pile that has started to grow. Every
pile shows whether it is growing or shrinking, and one station is marked as the thing that most
needs the player.

Points are the one number to beat: up for each right gift, down for each wrong one by its cost, plus
bonuses, stars and a share of the budget left. The seed changes on every play, so the updates on
offer differ from game to game. The page keeps the best score and a collection of the absurd AI
toys found so far.

## Consequences

The real-time part is the part Wiktor enjoys (elves, piles, tiredness), and the assurance decisions
with the most weight are made calmly, one at a time, with their figures in view. A wrong gift is
tied to its cause within a minute instead of at the end. Recall only reaches the sleigh that has
not left, which gives the run its urgency.

The break pauses the game three times, which a player who wants pure flow may dislike; it is one
card, not a results screen. Scripted balance now has to hold per run as well as per game. The three
test builds from ADR 0003 are no longer offered on the page.
