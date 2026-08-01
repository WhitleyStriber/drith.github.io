---
title: "The crystal is the objective"
date: 2026-07-11
build: 0.4.4
tags: [design, world]
description: >-
  Outposts stopped being flags on a map and became buildings on top of a
  crystal you're forbidden to touch — and the moment you can touch it, the
  whole match changes shape.
---

For a long time an outpost was a capture point with a health bar. It worked,
and it was boring, because there was no reason to care about *this* outpost
over the one 400 metres north.

Now every outpost sits on a Drith — a crystal formation growing up from the
planet's core to just below the surface. The crystal powers the turrets, the
shields, the extraction rigs. It is the reason the building exists.

## Capture, don't destroy

The corps don't want your enemy's outpost gone, they want it *theirs*. A
destroyed Drith is money burned. So the Accord makes crystal damage a Class 7
violation and CLARIS enforces it above everything else: put ordinance into the
subsurface structure and every turret in the sector — both sides — turns on
you.

That single rule does an enormous amount of work:

- It makes the fight territorial instead of annihilative. You're flipping a
  flag, not levelling a building.
- It gives CLARIS a personality. She has one line she won't let you cross, and
  she means it.
- It puts a loaded gun on the table for later. The player *can* break the rule.

## The moment it turns

Late game, you learn the crystals aren't just power. They're nodes. Every one
you keep online is a node in a network you didn't know you were building.

Shattering one is permanent. That territory is dead ground for the rest of the
campaign — no Ala, no income, no reason to go there. CLARIS goes hostile. Every
corp marks you. And the network gets weaker.

The game does not tell you whether that was correct.

> ...Thank you.

That's the whole line she says when you do it. Quiet, almost relieved, and then
the bounties come in.

## Implementation notes

The crystal is a separate entity under the base, with its own damage channel
that normal weapons literally cannot route to — you need a specific ordinance
class, which is itself blueprint-gated. That keeps accidental violations at
zero, which matters a lot when the penalty is "the entire sector kills you."

Sector state now tracks a `dead` flag per territory. Dead ground stops
spawning extraction, stops paying, and gets a different ambient palette: the
green schematic light drains out and the whole area goes grey and quiet. It
should feel like something you did.
