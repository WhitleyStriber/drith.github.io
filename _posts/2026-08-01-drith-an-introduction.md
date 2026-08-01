---
title: "An introduction to Drith"
date: 2026-08-01
description: >-
  What the game is, how it plays, what's working so far, and how to get into
  the pre-alpha.
---

I've been working on this game on and off for about 3 years, and properly for
the last year and a half.

I jumped from Unity, to UE5, to Godot. First VR, then first person, now 3rd
person. It took a long time to land on the right engine and workflow, but
that's sorted now and the game is finally coming together.

## Inspirations

I've had the idea since I was playing on CRTs in my parents basement around
2004-2008. A lot of it came from Ratchet and Clank: Up Your Arsenal and Ratchet:
Deadlocked, which ironically is the same name as Valve's upcoming MOBA hero
shooter.

In 2023 I spent most of the year just playing games. I replayed a bunch of
classics like Kingdom Hearts 2, the Pokemon games, Final Fantasy 11, Ape Escape
and Ico. I asked my friend Richard in a Discord what I should play next and he
said KH2. The combat in that game is what made me commit to this properly.

## How it plays

- You get dropped in with nothing.
- Base blueprints are found in the small monuments, so that's your first stop.
- Then you put down a base. Caldera is crawling with enemies that don't stop
  coming, so without somewhere to fall back to you won't last long.
- From there you push out further. There's 12+ monuments and they're the places
  worth going, which means everyone else is going to them too.
- Be careful out there. Other players are crawling the same monuments you are,
  and that's usually where PvE turns into PvP.
- Then you come back, reinforce what you've got, and go out again.
- On top of that there's classes, melee, guns and magic skill trees, so you can
  specialise into something that plays differently.

## What's working

- Base building
- The wardeck, where you stage loadout changes and commit them in one swap
- Melee and ranged weapons
- Magic and the skill trees
- Classes and loadouts
- Enemy AI, with a director that ramps up pressure
- Netcode, which is what PvP runs on
- Vehicles and mounts
- Loot, crafting, blueprints and shops
- Monuments, water and environment FX

The base side is the most finished part of the project and the world is the
least, so that's where most of the next stretch is going. Right now I'm mostly
polishing instead of adding: physics, 3d models, textures, and a bunch of random
bugs.

## Playing the pre-alpha

This is a **pre-alpha**. It's rough, there are bugs I know about and plenty I
don't, and things will change or get torn out.

It runs on a server I host myself, so it's only up when I've got it running. The
Play button will show you the access code, or tell you the server is offline.

{% if site.beta_download and site.beta_download != "" %}
1. Grab the build: [download]({{ site.beta_download }})
{% else %}
1. Grab the build (link going up shortly)
{% endif %}
2. Unzip it.
3. Launch it with the access code:

```
Drith.exe --connect-ip=ACCESS_CODE
```

If the code has no port on the end, it falls back to 27015. There's no join
screen yet, so the launch flag is the way in for now.

## The story

There is one, but a lot of it is very early. I've never written a story before,
so anything I post about it is a first draft and I'll probably change it.

## Release

Before 2030, and at the rate I'm going I should hit that. I'd rather say 202X
than give a date I have to walk back.
