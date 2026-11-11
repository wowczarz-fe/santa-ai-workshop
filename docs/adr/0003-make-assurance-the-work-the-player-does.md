---
status: proposed
---

# 0003: Make assurance the work the player does

## Context

Wiktor played the staged game (ADR 0002) on 2026-11-11. The clock kept him busy and he enjoyed
moving elves between piles while watching their tiredness. He never looked at the sleigh or opened
a parcel, and it was still unclear how to play or why things happened. He also found "more AI means
more mistakes" too simple a picture of AI.

The cause is in the design. Piles and tiredness are visible, grow, and can be acted on at once.
Mistakes were sealed in parcels and the assurance controls were levers set once. A sensible player
manages throughput and ignores quality.

## Considered options

- Add warnings and counters for mistakes. Rejected: it gives the player one more thing to watch
  without giving them anything to do about it.
- Limit tiredness to checkers so it stops competing for attention. Rejected by Wiktor: tiredness was
  the part he enjoyed.
- Split the run into shifts with a calm report between them. Rejected: the clock is the part that
  works.
- Turn assurance into piles that need elves, and make the AI level say where the human is. Chosen.

## Decision

Assurance work shows up as piles the player staffs, inside the three existing stations:

- At reading, unclear letters form their own pile and wait for an elf to ask the child. With asking
  off, whoever reads the letter guesses.
- At dispatch, parcels picked for checking form a checking pile, separate from the parcels going
  straight through. When the checking pile is full the line waits. Letting the waiting parcels
  through unchecked is a deliberate action that shows how many parcels it covers.
- A suspect batch from the faulty update is a pile waiting to be remade.

The AI level at reading and at making toys says where the human is:

- By hand: an elf does the work. Mistakes rise as that elf gets tired.
- Assist: the AI drafts and an elf confirms each one. It needs elves, and how well they confirm
  depends on how tired and how trusting they are.
- Automate: the AI works alone. It needs no elves, which frees them for checking or a break. Elves
  left at an automated station do a named job: at reading they ask children about unclear letters,
  at toys they watch the machine and notice a faulty update sooner.

What the AI gets wrong depends on what it is given. Reading is as good as a fresh elf on clear
wishes and confidently wrong on unclear ones. Toy-making is steadier than a tired elf until an
update makes the same wrong toy many times. So automating lowers mistakes in one place and raises
them in another, and the levers describe where mistakes come from instead of quoting one rate.

Checkers relax after a long run of clean AI-made parcels: they spend less time on each check and
skip some. The page shows that behaviour. Training is a lasting fix that costs time and money, and
a case the player investigates restores attention.

Rarely, a checker brings a case to the player, pinned on the line. The options fit the evidence: an
unsure checker asks the player to judge one toy against its wish; an unclear wish for a big gift
offers asking the child or accepting the AI's reading; the same wrong toy turning up twice offers
investigating or holding the parcels made since. Each option shows its time, money and how many
parcels it covers. At most one case is open and one waiting. This replaces opening parcels by hand.

Every assurance decision reports back where the player is looking, one line at a time: what it took,
what it caught, the estimated loss avoided and what it left waiting.

The first time each decision matters, the game shows a short card at that control and the page
stops the clock. The player acts or continues, and the clock resumes. Each decision is explained
once.

Three versions ship side by side so Wiktor can compare them: piles only; piles with cases brought to
the player; and the same with a calmer pace. The version is chosen on the opening card.

## Consequences

The enjoyable loop (move elves, watch piles and tiredness) is now also the assurance loop, so the
article's argument is made by playing and not by reading. The interface between the rules and the
page grows: queues, vigilance, cases and tutorial moments. The three versions are options on one
set of rules, to be removed once one is chosen. The scripted balance check has to cover each
version.
