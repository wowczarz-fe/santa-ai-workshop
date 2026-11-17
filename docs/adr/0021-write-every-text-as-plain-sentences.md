---
status: accepted
---

# 0021: Write every text as plain sentences

Date: 2026-11-17

## Context

Earlier rounds cut the game's texts down to save words, some under a five-word limit: "installs
at 20 s if it passes", "every elf half as tired", "Elves confirm each". Players and reviewers
then reported that much of the wording, above all in the pop-up boxes and tips, read as "very
broken English". The readers are busy professionals, many of them not native speakers, reading
while a clock runs.

Every text a player can read was listed (374 entries, 815 texts), three editors proposed a
rewrite against one style sheet, and the proposals were published on a review page. The user
approved all of them: "I am fine with all edits can you implement and deploy?"

## Considered options

- Keep the fragments and fix only the worst. Rejected: the fragments were the cause, and the
  complaint was about the wording as a whole.
- Let each developer reword texts as they went. Rejected: it is how two names for one thing and
  three styles of chip arose.
- One inventory, one style sheet, one reviewed list of final texts that both the rules and the
  page follow. Chosen.

## Decision

All player-facing text is complete, plain British English. The fragment style is withdrawn. The
rules of the style sheet, in brief:

- A text that explains, advises or reports is one or more complete sentences, with articles and
  verbs. This covers pop-ups, news lines, card texts, lessons and end-screen notes.
- Headings, labels, buttons and chips may be phrases, but each is grammatical and clear when read
  cold ("Costs £40 more", "Not counted as a mistake"). A chip is about four words.
- One idea per sentence. No semicolons, no colon bolting two clauses together, no brackets.
- Texts stay short: a news line is one sentence of about 14 words, a pop-up one or two short
  sentences.
- Figures keep their meaning. Sentences say "seconds"; "s" is left to counters.
- One name for each thing: the stations, the AI levels, the checking levels, everyday and big
  gifts, the budget, a cocoa break, an upgrade, Santa's reputation. Elves at Checking are
  checkers. "The AI" always has its article.
- Nothing says or implies that more AI means more mistakes in general (ADR 0019).
- Texts read out by screen readers get the same care as texts on screen.

The rules send each text in the form the player reads, so the page adds no capital or full stop
to a sentence. Where the page builds a sentence around a clause from the rules, the clause and
the frame are listed in `docs/ARCHITECTURE.md` under Texts, with the four places where the page
reads words out of a rules text.

Defects found on the way are fixed with the wording: counts of one agree with their verb ("1
letter was lost"), a tested update whose result has not come in reads "The test was still
running" where it read "the test null", and checkers who trust the AI before skipping any check
have a line of their own where it read "waved 0 AI gifts through".

## Consequences

- `tests/wording-check.js` fails on a semicolon, on "s" for seconds outside the practice
  figures, and on any of about 140 clipped wordings that the copyedit replaced, so they cannot
  come back unnoticed.
- The half-time options carry the checkers' state and the elves' energy as sentences in their
  `text`, no longer as facts of their own, so the page has nothing to assemble there.
- Several texts are longer than before. The page has to fit them: the half-time lines, the chips
  on the reputation card and the practice figures most of all.
- No rule, number or balance figure changed: the scripted games give the same table as before.
- A new text is written to the style sheet and added to the inventory, not cut to fit a space.
