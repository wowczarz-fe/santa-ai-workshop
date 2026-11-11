---
status: accepted
---

# 0009: Give each sleigh run a different cargo

## Context

After the retune in ADR 0007 the user reported that he almost always automated toy-making once and
then only moved elves. A sweep agreed: one fixed set-up (automate both stations, check the risky
ones, every elf on checking) earned all twelve stars with no further play.

The article the game accompanies argues that there is no one-size-fits-all level of assurance: the
right level depends on what the AI is used for and on what a failure costs. A game in which every
sleigh run carries the same mix of gifts cannot make that point.

## Considered options

- Raise the run targets until the fixed set-up falls short. Rejected: the player would still set
  up once, only with less margin.
- Random events during a run that force a change. Rejected: they read as bad luck, not as a
  decision the player could have prepared for.
- Give each sleigh run a different cargo, announced at the break before it. Chosen.

## Decision

Run 1 carries everyday gifts, so the guided walkthrough is unchanged. Runs 2 to 4 carry, in an
order drawn from the seed, one each of:

- big gifts, where the AI slips more and a wrong gift costs the big price;
- letters from little ones, where most wishes are unclear and automated reading guesses;
- a rush, with about twice the letters.

Cargo sets the mix of wishes, the letter rate and that run's target. The break card names the
cargo of the run about to start, with one sentence a player can act on. The single mid-game rush
in the old letter ramp is replaced by the rush cargo.

To let the cargoes favour different set-ups, asking a child takes 5 seconds (was 15), remaking a
caught parcel takes 10 (was 5.3), and the AI is wrong more often on unclear wishes and big gifts.

## Consequences

Measured over six seeds, the best set-up differs for big gifts, unclear letters and the rush, and
the old winning fixed set-up averages nine stars instead of twelve. The gain from adapting is
small: a player who switches to the best set-up for each cargo scores about 2% more than the best
single compromise, where 12% was the aim. The cause is structural. With both stations automated,
elves have nothing useful to do except check, so checking lightly frees nobody for other work and
checking capacity is rarely scarce. Closing that gap needs a rule change that gives elves
productive work beside the machine, which is left for a later decision.

The four targets now total about 190 to 206 depending on the order, down from 236, and the last
run's target is scaled because letters stop before it ends. No fixed set-up now reads "about
right" on the end-of-game dial.
