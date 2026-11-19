---
status: accepted
---

# Route wishes by missing context

The wish-routing prototype needs to show why limited human checking belongs on some
requests while AI can handle others quickly.

## Considered options

- Four independent meters make the outcome harder to explain and split attention.
- A fixed risky category teaches players a label rather than how new evidence changes a decision.
- Generating faults when a player clicks changes the scenario between strategies.

## Decision

Use a 90-second postbag with a single goal of 24 correct gifts delivered. AI takes two
seconds per wish and Pip takes seven seconds to ask and check. Missing details and fit
checks make AI errors more likely. Replies supplied with later wishes make formerly
ambiguous requests suitable for AI. Fitted gifts that arrive wrong require four seconds
of AI return handling, making their consequences visible through lost capacity.

Generate the complete wish schedule and fault draws at the start from a fixed default
seed, overridable through the address. Routing choices do not consume randomness. Reveal
gifts on delivery and choose the closing lesson from routing decisions.

## Consequences

Players can compare strategies against the same incoming work. Every gift counts once;
the opportunity cost of unnecessary checks and returns reduces the number delivered.
The probabilities are illustrative game rules. Explicit letter cues let first-time
players make informed choices while managing a growing queue.
