---
status: accepted
---

# 0007: Make automation the fast, risky option so checking decides the result

## Context

The user played the four-run build (ADR 0005) on 2026-11-11. He automated reading and toy-making,
moved elves to checking and checked every parcel, and the result stayed far below the target
whatever he changed. He reported that his actions had no visible effect.

A sweep of fixed set-ups over three seeds confirmed it. With both stations automated, every
checking level and every placement of the eight elves delivered 133 to 142 right gifts against a
target of 236. Two numbers caused this:

- The toy machine alone made 37 toys a minute. Three elves on assist made 69. Automating toys
  made the machine the slowest step on the line, so nothing done at checking could matter.
- Unchecked automation shipped about 5% wrong gifts, so the three checking levels had almost
  nothing to catch and looked the same.

The best fixed set-up was assist at both stations with default staffing, which is close to
touching nothing. That contradicts the article: AI brings real gains, and the right amount of
assurance sits between too little and too much.

## Considered options

- Explain the existing numbers better on the page. Rejected: the rules themselves gave the player
  no reason to choose between checking levels.
- Lower the target to what automation could reach. Rejected: the result would still not respond to
  checking or staffing.
- Retune so that automation is the fastest option and carries real risk, and checking capacity is
  what limits a fully automated line. Chosen.

## Decision

Automating a station is the fastest way to run it and the riskiest. Once both stations are
automated, the checking level and the number of checkers decide the result.

The sweep (`node` over fixed set-ups, seeds 1 to 3, a rest at each break) must keep this shape:

| Set-up                                            | Right | Wrong | What the player sees                     |
| ------------------------------------------------- | ----- | ----- | ---------------------------------------- |
| By hand, default elves                            | 101   | 1     | Far short: AI is a real gain             |
| Automate both, check a few, all elves checking    | 246   | 21    | Fast, many wrong gifts, money runs out   |
| Automate both, check all, two checkers            | 59    | 3     | The checking pile jams the line          |
| Automate both, check all, all elves checking      | 209   | 6     | Safe, but checkers burn out and it costs |
| Automate both, check the risky ones, all elves    | 265   | 7     | Best score                               |
| Automate both, check the risky ones, two checkers | 95    | 6     | Too few checkers                         |

The numbers that changed: the toy machine makes 80 toys a minute (a toy every 0.75 seconds, was
1.6); a check takes an elf 4.5 seconds (was 2.9) and tires them faster; the AI's mistake rates on
toys, big gifts and unclear wishes rose; a caught mistake keeps checkers careful for longer; the
budget rose from 1,400 to 1,800 so a fast, well-checked line can be paid for.

## Consequences

The player's choices now move the result by a factor of four. A fixed "automate both, check the
risky ones, everyone on checking" set-up earns all twelve stars without further play, so the game
currently rewards finding one good set-up more than managing it; raising the run targets or making
elves need rotation would restore that. On seeds outside the three tuned ones, checking everything
ties with checking the risky ones on wrong gifts instead of beating it. The scripted balance check
was loosened on stars (two to three a run) to match.
