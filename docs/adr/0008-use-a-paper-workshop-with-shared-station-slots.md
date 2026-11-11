---
status: accepted
---

# Use a paper workshop with shared station slots

## Context

The approved papercut direction gives the workshop a coherent visual identity. The live game still needs six truthful queues, staffing choices and the costs of assurance, with every elf movable and every control reachable.

## Considered options

- Fork the game for each visual direction. This would duplicate actions, evidence and pause behavior.
- Copy the static mockup as a new game. Its illustrative counts and choices would diverge from the rules.
- Stack all stations vertically on phones. That separates the production line and makes moving elves harder.

## Decision

Keep the existing rules and stable interactive elements. The opening card selects paper or polished presentation with `?look=paper|polish`; paper is the default and replay retains the choice. Both use the same page script and DOM. The art helpers supply illustration strings and symbol names, while the shared renderer owns all state and controls. Put each station in shared subgrid rows for its heading, scene and queues, decorative conveyor, elf floor and controls. The paper artwork lives in a small plain-script art helper; the paper stylesheet supplies the approved palette and materials. Scenery receives no pointer input. Queue quantities and marks come from the public rules view.

Use large elves for ordinary crews and a denser two-row arrangement when five or more share a station. Cocoa remains destination three and accepts all elves. On phones, page sideways through stations using a visible selector; decision cases use a bottom sheet. Tutorial and manual pause behavior stays with the existing page logic.

Keep one visible information button per station, listing every supplied lever option, cost and risk for touch users. Primary controls retain hover and keyboard-focus descriptions. Hover help starts only after deliberate pointer movement, so closing a dialog does not open information under a stationary pointer. Keep the assurance report, five real-world practice tiles and expanded money account. Show textual names whenever an illustrated toy is unavailable. Preserve script-tag loading so the game still opens from disk.

## Consequences

Station floors and controls align on desktop while all six queues remain available. Phone users can switch stations without traversing a long vertical list. Layout checks must include eight elves at one station, cocoa, queue counts, actual tap and drag movement, and decision cards at narrow widths.
