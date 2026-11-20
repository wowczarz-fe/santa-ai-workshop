---
status: accepted
---

# 0024: Rename goals and checking levels after an outside review

Date: 2026-11-20

## Context

An outside reviewer read every text of build takeover20 on the text feedback page and sent 70
suggestions. Many touched names that appear all over the game: the gifts the sleigh needs, the
mistakes goal, the checking levels and one elf. ADR 0021 asks for one name for each thing, so a
name changed in one place has to change everywhere.

## Considered options

- Apply only the flagged texts. Rejected: the same thing would then go by two names.
- Rename the stations as well (Reading letters, Making toys, Final quality check). Rejected: the
  short names fit the column headings, the phone tabs and the sentences that name a station.
- Apply the renames to every text, decide the other suggestions one by one. Chosen.

## Decision

- A gift that matches the wish is a correct gift ("145 correct gifts"). "Right" stays where it
  means something else: "About right" on the checking dial, a pick that was right.
- The goals are Full sleigh, Minimal mistakes and Within budget, in sentence case like every
  label. The budget goal reads "spend less than the £900 budget".
- The checking levels are Random, Riskiest and All, with no quote marks.
- The eighth elf is Candy.
- A gift that does not match is still a wrong gift, never an incorrect one.
- No emoji, as the copyedit's style sheet and the user ask.
- "try using AI", "flagged by AI", "Let elves and AI decide" and "Fully AI automated" drop the
  article ADR 0021 asks for before AI. The user chose these wordings.

The half-time card gains a line under its title, "Check your progress.", the end screen's
practice tiles take the user's own names, and the toy machine loses its "AI" badge.

## Consequences

- `tests/wording-check.js` bans the replaced wordings in the rules' texts, and reads
  `game/game.js` and `game/index.html` for the page's own, so the old names cannot come back.
- Some labels grew. The decision cue shows the card title only when the cue is wide enough, and
  the mistakes figure puts "wrong gifts" on its own line in narrow tiles.
- No rule or balance figure changed.
