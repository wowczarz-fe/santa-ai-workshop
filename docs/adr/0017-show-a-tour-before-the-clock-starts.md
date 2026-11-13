---
status: accepted
---

# 0017: Show a tour before the clock starts, with every control there from the start

Date: 2026-11-12

Replaces the guided first run of 0002.

## Context

Since 0002 the first run was guided: controls stayed hidden until a walkthrough card brought them
in during play, and each card had "Not now" and "Skip walkthrough". Six colleagues played the
published build and:

- read the hidden controls as a bug. After "Not now" a control they had just been told about was
  still missing, so the game looked broken.
- did not notice the clock. It ran between cards, so they lost time while reading what to do.
- asked to be told what each part does before play starts, not in the middle of it.

## Considered options

- Keep the guided run and stop the clock between cards. Rejected: the hidden controls stay, and
  they were the main complaint.
- Put all the explanation on the opening card. Rejected: words away from the controls they
  describe, and the opening card is meant to be short.
- A short tour on the real play screen with the clock stopped, then the game as normal. Chosen.

## Decision

- The game is always built with every control visible and usable from the first second
  (`new Workshop({ seed })`). The page has no locked or "unlocks later" states and no walkthrough
  cards during play.
- With "Show the walkthrough" ticked, "Open the workshop" starts a tour of four steps: the elves,
  the AI switch at Letters, the checking switch and cocoa. Each step outlines the real control and
  shows a title and one line with one tip, in line with the game's message: more AI is faster and
  makes more mistakes, checks cost time and money so match them to the stakes, tired elves slip.
- Each step has Next (the last says Start), one Skip ends the tour, and the card says "Clock
  stopped" with "1 of 4". The clock starts only when the tour ends. Enter goes on, Escape skips,
  and focus moves to each step. On a phone the page scrolls the control into view first and the
  card sits clear of it.
- The tick works as before: ticked on a first visit, unticked once a game has ended (stored as
  `workshop-walkthrough-finished`).
- The header's Walkthrough button shows the same tour again during play, with the clock stopped.
  Before it restarted the game in guided mode.

## Consequences

The rules lose guided mode: no `guided` option, `moment`, `unlocked`, `acknowledge` or
`skipGuidance`. The tour lives entirely in the page and needs nothing from the rules.

A first-time player now meets every control at once, so the first seconds of play are busier than
before. The tour is the only teaching before the clock starts; during play the game teaches
through its messages, such as what a wrong gift should make the player change.
