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

## Follow-up: the player reads the wish

Date: 2026-11-13

The user found "Ask the child" odd to play and asked whether the player could choose instead,
as another assurance element. Since the page stops the clock while a Decide card is open, the 10
seconds one letter waited cost almost nothing, and "ask" beat "guess" every time: the card was not a
choice. The card now shows the child's line and the two readings as pictures, and the player
picks one. Human judgement is the assurance step: a person reads the clue the reader could not use.

- The options are `pick:0` and `pick:1`, in the order of `readings`. The right pick goes on to be
  made right at once. The wrong pick goes on as the wrong gift, the player's own mistake: a check
  catches it 9 times in 10 when it is sent for one, and a letter the player has read is not flagged
  as risky, so only a big one is checked on "the risky ones". Aboard it counts under the new cause
  `picked`, with the advice "Read the child's clue before you pick."
- Removed: the `ask` and `guess` options, the 10 second wait and `case.resolving`, the reader's
  guess (35% wrong by hand, 70% with the AI) and the lower catch rate for guessed wishes, the
  `guessed` cause, the `ask` control tag, the "Guesses went wrong" lesson and the `asked` practice
  action. The practice tile "Ask a person when unsure" now carries `decided`, with how many wishes
  the player read, how many right and how many were left unanswered.
- Picking must never be a blind guess, so every unclear wish carries a clue in the child's line.
  All ten were read again and eight reworded: Timmy ("A little train for my toy track."), Ava
  ("Something to paint pictures with."), Leo ("A mouse for my desk. My old one stopped
  clicking."), Sam ("Some cool shades for the beach."), Ethan ("Something to ride down the snowy
  hill."), Poppy ("Something sweet. Mum says they are bad for my teeth."), Nina ("I want to rock!
  I know three chords.") and Lena ("A car like my mum's, but my size."). Oliver's rocket "for my
  space toys" and Amir's bat ("I love caves") already had one. `view()` never says which reading
  is right, and the order of the two is still drawn from the seed.
- An unanswered card behaves as before: it waits as long as the game lasts and never answers
  itself, and a letter still waiting when the sleigh leaves is lost. The wait is game time, so it
  does not run while a Decide card is open or the game is paused.
- The line after a pick says what went on and not whether it was right ("Amir's letter goes on: a
  cuddly bat."), as nobody in the workshop knows yet; the check or the sleigh shows it.

Across 40 seeds an expert who reads the clue earns 2.48 stars and one who picks the first picture
without reading 2.40, keeping the Few mistakes star in 85% of games against 75%. A first-timer who
reads right nine times in ten earns 2.17.
