---
title: "Every edit is a staged swap"
date: 2026-06-20
build: 0.4.1
tags: [systems, wardeck]
description: >-
  Rewriting the base armament terminal so nothing commits instantly — mount,
  upgrade and eject all stage first, then land together as one vulnerable
  base swap.
---

The old loadout screen applied changes the moment you clicked. Mount a cannon,
it was mounted. Eject a module, gone. It was responsive and it was completely
wrong for a game where the base is the thing everyone is shooting at.

So the WARDECK now stages everything.

## What staging means

Every edit — click-mount, drag-drop, upgrade, Oumo attach, ECS install or
eject — writes into a pending set instead of the base. The display reads
through an `effective_*()` layer that overlays staged values on top of what's
actually bolted on, so the panel shows you the future while the base still
lives in the present.

Nothing lands until you hit the green **ATTACH**. That kicks off a timed base
swap: a progress bar, a window where your hardpoints are offline, and a very
real chance that whoever is watching your sector picks that exact moment.

## Why it's better

- **The cost is legible.** Changing three weapons costs one swap window, not
  three. Batch your work.
- **CANCEL is free.** Browse the whole arsenal, stage a full rebuild, throw it
  away. The panel stops being a place you're afraid to open.
- **It reads as a decision.** The top bar shows a stacked thumbnail per pending
  change plus the swap time. You're looking at a bill before you pay it.

## The parts that fought back

Rendering "what would this look like" turned out to be most of the work. Hover
a card in the arsenal shelf and the right-hand detail has to show *that*
weapon — a look, not a commit — then revert cleanly when the cursor leaves.
Clearing the hover has to fall back to the staged value if there is one, and
only then to the mounted one. Three layers deep, and every one of them can be
empty.

The other snag: Mk levels. They used to render as "MK 3" text, which meant
reading a number and then doing math about how many were left. They're pips
now — filled for earned, hollow for remaining. You count instead of read.

> CLARIS reminder: hardpoint reconfiguration leaves this structure at reduced
> defensive capacity. Recommend a secured perimeter.

Next up: the swap window needs teeth. Right now it's a timer. It should be a
fight.
