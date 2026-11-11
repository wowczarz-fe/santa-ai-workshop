---
status: proposed
---

# 0002: Keep the original workshop, stage it and make it readable

## Context

Testers of the original game (`game/`) could not tell what to do first, had too many places to look,
saw no effect from the AI levers and did not take away the assurance lesson. Four stripped-down
prototypes were then started, each built around one mechanic (`docs/PROTOTYPE-BRIEF.md`). On
2026-11-11 Wiktor played one of them, found it a simplistic guessing game, could not get a second
one to run, and rejected the direction: the prototypes lost the point of the original, which is to
promote Frontier's AI assurance practice through a workshop where automation and checking have to
be balanced.

A first version of this decision then cut the original down to about five player actions. Wiktor
pushed back the same day: the game needs some complexity, because the AI risks it exists to show
only appear when several things pull against each other. Reading the tester feedback again supports
him. Testers asked for the budget, the levers and the goal to be explained and made visible. The
only things they asked to remove were Workshop Wireless, the ticker and morale.

The game has six points to make:

1. Speed and quality: automation raises output and produces mistakes.
2. Human oversight: checking needs time and people, and tired people check worse.
3. Bottlenecks: making gifts faster is useless if checking or dispatch cannot keep up.
4. Ambiguity and judgment: Timmy's "little train" needs a question back.
5. Mistakes at scale and the response: a faulty AI update spoils a batch; rolling back stops new
   mistakes, quarantine and recall deal with the ones already made.
6. Constraints and consequences: time, budget, queues, missed gifts and wrong deliveries all count.

The game ships with an article, and the article's outline is the guiding principle for what the
game must let a player feel:

- AI adoption is a balancing act. AI brings real gains; it also brings unreliable output and lost
  trust; governance and assurance reduce those risks and cost money, time and flexibility.
- Too little governance is risky and too much is costly. The right level is an economic
  optimisation, not a compliance exercise.
- There is no one-size-fits-all answer. It depends on what the AI is used for and on how likely and
  how costly a failure is.
- Deciding where assurance adds the most value needs evidence, and economics supplies it.

## Considered options

- Four single-mechanic prototypes. Rejected by Wiktor: the one he played read as a guessing game,
  and none showed automation, checking and incident response working against each other in one
  workshop.
- Keep the original and add a tutorial. Rejected because a tutorial in front of the game explains
  every control before the player has a reason to care about any of them.
- Cut the original to about five actions with no budget, no fatigue decisions and no reviewer
  training. Rejected by Wiktor as oversimplified: it drops point 6's budget, half of point 2, and
  the cost argument that the accompanying article makes.
- Keep every system that carries one of the six points, remove only what carries none, and reveal
  the systems one at a time inside a single run. Chosen.

## Decision

`game/` stays the game. A system stays if it makes one of the six points. The player's difficulty
is handled by when and where things appear, not by removing them.

The player has these decisions, and each is tied to a point:

- Move elves between the three stations: read letters, make toys, check and dispatch (3).
- Send a tired elf for cocoa before it burns out. A burnt-out elf walks off for much longer, and
  tired checkers miss more mistakes (2).
- Set how much the AI does at reading letters and at making toys: by hand, assist, automate. More
  AI is faster, makes more mistakes and costs more (1, 6).
- Set how much is checked at dispatch: spot-check, check the risky ones, check everything. A checked
  parcel takes a checker about eighteen times as long as an unchecked one, so checking everything
  jams dispatch (2, 3).
- Ask the child when a wish is unclear. Reading slows down; fewer wrong toys get made. Timmy's
  little train is the example: with asking on he gets a model train, with it off the AI builds a
  locomotive (4).
- Open one waiting parcel and judge the toy against the wish, then ship it or send it back to be
  remade. It occupies a checker for three seconds and costs money (2, 4).
- Train the checkers. Late in the run checkers start waving through whatever the AI made; trained
  checkers keep checking properly. Training costs money and can be bought before it is needed (2).
- During the faulty AI update: roll back (the toy line stops for eight seconds, new toys are safe)
  and quarantine (suspect parcels waiting at dispatch go to rework, and dispatch waits for them)
  (5).
- Once a wrong gift is aboard: recall (the wrong gifts come back off the sleigh for rework, which
  ties up the checkers) (5).

Budget stays (6). Elves, AI, the player's own checks, training and the incident responses all cost
money, and a paid action is unavailable when the money has run out. The goal stays one number, 155
right gifts by departure. The budget is the constraint on how the player gets there, shown as one
figure in the workshop. The end screen breaks the spending down into people, AI, checking, fixing
mistakes, and what the wrong gifts that were delivered cost, so the player can see what the
checking cost against what the mistakes cost. That comparison is the article's argument.

Gifts differ in what a mistake costs. Most are everyday gifts; some are big ones, such as a
bike, and a wrong big gift costs several times as much. The middle checking setting checks the big
gifts, the unclear wishes and the parcels the AI was unsure about, so "check the risky ones" means
both how likely a mistake is and how much it would cost. This is the article's proportionality
point, made without another control.

The trade-off is visible while playing. Each lever position shows what it does at the current
staffing: gifts a minute, mistakes in a hundred, cost a minute. A quiet warning appears when the
current pace will leave Santa short at departure, and it names the station holding things up.

The end screen is an economic account: what was spent on people, AI, checking and fixing, what the
delivered wrong gifts cost, and what the mistakes that checking caught would have cost. The lesson
is drawn from that account in the article's terms: too little, too much, or proportionate.

A short card opens the game before the guided run: why Santa turned to AI, the goal, and the
trade-off in one sentence each, then Start.

These leave the game, because they make none of the six points or a tester asked for them to go:

- Morale, strikes and cocoa deals. Tiredness and burnout carry the point on their own.
- Buying storage and throttling letters.
- Emergency stop and hold dispatch as separate buttons. Rolling back stops the toy line and
  quarantine holds dispatch.
- Losing the run early. A full station blocks the one before it, and letters arriving at a full
  pile are lost and counted. The run always lasts its full time and the consequences show in the
  result.
- The ticker, Workshop Wireless and the event log. One status line sits in the workshop.

A wrong gift stays hidden until a checker opens the parcel or it lands on the sleigh; then it is
shown at once, and the sleigh carries two live counts, right gifts and wrong gifts. Showing the
truth on loading is a deliberate simplification: it gives the player the feedback on their levers
that testers asked for, at the price of realism. Parcels the AI was unsure about carry a warning
mark, and so does every parcel made during the faulty update once the update is known. The mark
means suspect, not wrong: some marked parcels are fine.

The first run is guided: controls unlock in order as the run goes on (elves, then the AI levers,
then asking, then checking, then the incident controls, then training), each with one sentence. It
is one continuous run, not separate levels. Later runs start with everything unlocked.

The end screen gives one lesson chosen from what the player did.

## Consequences

The game keeps about ten decisions, so its difficulty now rests on the guided run and on the page
showing each decision at the station it belongs to. If first-time players are still lost, the next
step is to slow the unlocks, not to remove systems. Each system unlocks separately, so one that
turns out to confuse more than it teaches can be switched off without touching the others.

Nobody has checked which parts of the original made it fun: testers called it fun and confusing in
the same breath, and neither Wiktor nor the agents have played it to the end. The first playable
build is the test.

Player-controlled inspection stays although one tester would remove it, because Wiktor liked
judging a gift against a wish as a moment inside the game. The numbers in `workshop.js` were tuned
with morale and strikes in place and need re-tuning; nothing checks the balance except scripted
runs and playing.
