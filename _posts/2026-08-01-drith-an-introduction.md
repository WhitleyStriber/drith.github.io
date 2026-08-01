---
title: "An introduction to Drith"
date: 2026-08-01
description: >-
  3 years, 3 engines and a couple of false starts on perspective. What the game
  is, how it plays, and what's actually working right now.
---

I've been working on this game on and off for about 3 years, but I really dug my
heels in around a year and a half ago and it's been the main thing I do since.

It took a while to get here. I jumped from Unity, to UE5, to Godot. First VR,
then first person, now 3rd person. It took a long time to figure out the best
workflow, engine and dev environment, but I've finally found solid ground and
planted what has now become a small plant.

## Inspirations

I've had the idea for this game since I was playing on CRTs in my parents
basement around 2004-2008. A lot of it was inspired by Ratchet and Clank: Up
Your Arsenal and Ratchet: Deadlocked, which ironically is the same name as
Valve's upcoming MOBA hero shooter.

What made me really pull the plug on committing to it was just playing a bunch
of video games all year in 2023. I went back and replayed a lot of classics like
Kingdom Hearts 2, the Pokemon games, Final Fantasy 11, Ape Escape and Ico. I
asked my friend Richard in a Discord which game I should play next and he said
KH2. Ever since then I was inspired greatly by the combat system in that game
and decided to just dive head first into this whole thing.

## How it plays

- You get dropped into the world with nothing.
- The first thing you have to do is put down a base. Caldera is crawling with
  enemies and they don't stop coming, so if you don't have somewhere to fall
  back to you aren't going to last very long.
- From there you push out to the monuments. There's 12+ of them spread around
  the world and they're the places worth going to, which also means everyone
  else is going to them.
- That's usually where PvE turns into PvP, because you both wanted the same
  monument.
- Then you come back, reinforce what you've got, and go out again.
- On top of all that there's classes, a melee system, a gun system and magic
  skill trees, so you can specialise into something that actually plays
  differently instead of just hitting harder.

## What's working right now

This isn't a wishlist, it's what's actually in the build:

- Base building, placing structures and the triggers behind it
- The wardeck, which is the base armament terminal where you stage loadout
  changes and commit them all at once as one swap
- Melee and ranged weapons, with impact and hit reactions
- Magic, the spell weapons and the skill tree UI behind them
- Classes and loadouts, the gear data and the logic that drives it
- Enemies, the mob AI plus a director and spawner that ramp up pressure
- Netcode for networked sessions, which is what PvP sits on
- Vehicles you can drive and mounts you can ride
- Loot tables, crafting, blueprints, pickups and shops
- The world itself, monument spaces, water, environment FX and warp triggers
- HUD for inventory, combat, base, shop, dialog, magic and zones

Some of it is a lot further along than the rest. The base and armament side is
the most finished thing in the project and the world is probably the least, so
that's where most of the next stretch is going.

Right now I'm mostly polishing instead of adding new stuff. Physics systems, 3d
models, textures, and a bunch of random bugs.

## How to play the beta

The beta runs on a server I host myself, so it's only playable when I've got it
running. The Play button on the front page (and at the bottom of this post) will
show you the access code when it's up, or tell you the server is offline when
it isn't.

{% if site.beta_download and site.beta_download != "" %}
1. Grab the build: [download]({{ site.beta_download }})
{% else %}
1. Grab the build (download link going up shortly)
{% endif %}
2. Unzip it wherever you want.
3. Hit Play, copy the access code, and launch the game with it:

```
Drith.exe --connect-ip=ACCESS_CODE
```

On Linux it's the same thing with the Linux binary:

```
./Drith --connect-ip=ACCESS_CODE
```

If the access code doesn't have a port on the end of it, the game falls back to
27015, which is what I run on. If it does have a port, it'll use that instead.

There's no proper join screen yet, so the launch flag is the way in for now.
That's on the list.

## The story

There is one, but I want to be upfront that a lot of the story elements are very
early works in progress. I've never written a story before, so anything I post
about that side is basically a first draft and I'll probably end up changing it.

## Where this is going

I'll post here when things land. Not on any kind of schedule, just whenever
there's something worth writing about.

The target is to get this out before 2030, and at the rate I'm developing I
believe I should be able to hit that. I don't want to narrow it down more than
that yet, I'd rather say 202X than give a date I have to walk back later.
