---
status: accepted
---

# 0016: Unclear wishes become decisions

Date: 2026-11-12

## Context

Asking a child about an unclear wish was a standing switch ("Ask the child", `setAsk`) with its
own asking pile at reading, and a cargo of little ones' letters made most wishes unclear for a
whole run. Testers asked for the switch to go. Asking is still the game's "escalate to a person
when unsure" step, and the end screen credits it as an assurance practice (rework brief, ruling 2).

## Considered options

- Keep asking as a switch and hide it. Rejected: a hidden rule the player cannot see.
- Turn each unclear letter into a decision with two options. Chosen, as ruled.
- Let an unanswered decision fall back to guessing after a while. Rejected: decisions never
  resolve on their own; an unclear letter still undecided when the sleigh leaves is lost.

## Decision

- Two unclear letters a game, one in each half, at a time drawn by seed 12 to 40 seconds into the
  half, from a pool of ten children and wishes (Timmy's little train, Ava's paint, Leo's mouse,
  Oliver's rocket, Amir's bat, Sam's shades, Poppy's sweets, Ethan's snow, Nina's guitar, Lena's
  car). Three of them are big gifts. All other letters are clear.
- Each raises a "Decide" card (`kind: "unclear"`) as it arrives, with the child's name and wish.
  "Ask the child": the letter waits 10 seconds for the answer and the gift comes out right; no elf
  leaves its station. "Let the reader guess": the letter goes on at once and the reader guesses,
  wrong about 1 in 3 by hand and about 2 in 3 with the AI reading, which guesses confidently; an
  elf confirming the AI's guess cannot tell either. A guessed gift counts as risky for checking,
  but a checker catches only 3 in 10 wrong guesses. The card shows the AI's guess odds, not the AI's
  reading: the choice is between time and risk, not a puzzle the player solves by looking.
- The unclear cargo, the standing switch, the asking pile (`clarify`), `setAsk`, the `ask` action
  and the 9-second hand reading of unclear wishes are removed. The unclear-big case that showed the
  AI's reading is replaced by this card.
- The end screen's "Ask a person when unsure" practice shows the player's figure, "asked N of 2",
  and counts as used once a child was asked.

## Consequences

The decision teaches escalation where it happens, one letter at a time, at a cost in time the
player can see. With the AI reading, guessing loses about two gifts in three: a sensible player
who always asks earns 2.05 stars against 1.52 for one who always guesses (40 seeds). Asking is the
only way to make an unclear wish safe, so a wrong guess's news line points at the reading level
(by hand guesses better) rather than at a control that does not exist. A player who never opens a
Decide card loses both letters.
