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

Keep the existing rules and stable interactive elements. A plain address opens the paper presentation. Keep the look chooser hidden and retain `?look=paper|polish` for direct access to either presentation. Replay retains the choice. Both use the same page script and DOM. The art helpers supply illustration strings and symbol names, while the shared renderer owns all state and controls. Put each station in shared subgrid rows for its heading, scene and queues, decorative conveyor, elf floor and controls. The paper artwork lives in a small plain-script art helper; the paper stylesheet supplies the approved palette and materials. Scenery receives no pointer input. Queue quantities and marks come from the public rules view.

Use large elves for ordinary crews and a denser two-row arrangement when five or more share a station. Cocoa remains destination three and accepts all elves. On phones, page sideways through stations using a visible selector; decision cases use a bottom sheet. Tutorial and manual pause behavior stays with the existing page logic.

Keep one visible information button per station, listing every supplied lever option, cost and risk for touch users. Primary controls retain hover and keyboard-focus descriptions. Hover help starts only after deliberate pointer movement, so closing a dialog does not open information under a stationary pointer. Keep the assurance report, five real-world practice tiles and expanded money account. Show textual names whenever an illustrated toy is unavailable. Preserve script-tag loading so the game still opens from disk.

Quiet decorative snow sits behind the workshop and opaque information panels. It receives no pointer input and stops when reduced motion is selected. Real parcel arrivals follow the queues and settle into their piles when the clock stops.

## Quiet running screen

Show only the wrong-gift count and a short result of the player's latest action in the status strip. Keep full news and action feedback in a visually hidden live region. Move movement help into the header. Station switches retain their labels and information pop-ups while captions, milestone banners, free-elf instructions and the lost-letter line give way to the workshop itself. Keep staffing warnings, wrong-gift evidence and the attention-drift tag.

Use drawn stars for the end rating. Keep the checking dial below the practice tiles. This presentation pass retains the game length and the one-star outcome of an unattended game.

## End-screen reading order

Lead with the result, then real-world practices, the checking dial and Frontier's offer with both links. Follow with costliest causes, the money account and the blunder collection. Remove the separate checking-worth card and gift-kind disclosure: the dial and account already carry the trade-off. Both presentations use this order on desktop and phone.

## Budget and reliability

Show the rules' remaining budget in the running header, with a labelled low state. Desktop figures use the space released by the quieter status strip; phone figures stay compact. A budget ending shows the rules' headline, lesson, star count and time remaining. Unaffordable choices show their reason beside the disabled option.

Place a two-row reliability table after the practices and before the dial. It reports the player's everyday and big-gift jobs: letters read and toys made, before checking, with AI drafts counted as AI and manual work as elves. Show raw wrong counts out of jobs and “None made” for an empty sample. The dial remains beside the Frontier offer in the reading order. The walkthrough explains that everyday reliability matches a fresh elf while big gifts need a person.

## Shared typography

Use self-hosted Roboto 400, 500 and 700 for interface text. Headings and display figures prefer locally installed Franklin Gothic Medium Cond or Franklin Gothic Medium, then the bundled Roboto Condensed 500. One body and one heading custom property govern both looks, including inline SVG labels. Changing numbers use tabular figures. Fonts load from local WOFF2 files with swap display, so the game also works from disk. The bundled Fontsource 5.3.0 files carry their original SIL Open Font License 1.1 texts and source details beside the assets.

## Consequences

Station floors and controls align on desktop while all six queues remain available. Phone users can switch stations without traversing a long vertical list. Layout checks must include eight elves at one station, cocoa, queue counts, actual tap and drag movement, and decision cards at narrow widths.
