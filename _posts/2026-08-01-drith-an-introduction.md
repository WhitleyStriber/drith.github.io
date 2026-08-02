---
title: "An introduction to Drith"
date: 2026-08-01
description: >-
  What the game is, how it plays, what's working so far, and how to get into
  the pre-alpha.
---

Hi all. Short introduction and an update on where we are with Drith.

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
classics like the Pokemon games, Final Fantasy 11, Ape Escape and Ico. During
that time I was looking for something to play next, so I asked my friend Richard
in a Discord and he said Kingdom Hearts 2. That's the one that inspired me
enough to actually make this game.

## How it plays

- You get dropped in with nothing.
- Base blueprints are found in the small monuments, so that's your first stop.
- Then you put down a base. Caldera is crawling with enemies that don't stop
  coming, so without somewhere to fall back to you won't last long.
- From there you push out further. There's 12+ monuments and they're the places
  worth going, which means everyone else is going to them too.
- Be careful out there. Other players are crawling the same monuments you are.
  PvP is Rust styled, so you can lose everything you're carrying.
- Looting is a big part of it. Random drops, airdrops, and rare monsters that
  drop exclusive loot you can't get anywhere else.
- Then you come back, reinforce what you've got, and go out again.
- On top of that it's class based action: melee, guns, magic skill trees and
  ultimate abilities, so you can specialise into something that plays
  differently.

## What's working

- Base building
- The wardeck, where you stage loadout changes and commit them in one swap
- Melee and ranged weapons
- Magic, the skill trees and ultimate abilities
- Classes and loadouts
- Enemy AI, with a director that ramps up pressure, and rare spawns
- Netcode, which is what PvP runs on
- Vehicles and mounts
- Loot, airdrops, crafting, blueprints and shops
- Wipes, with stats tracked across them
- Monuments, water and environment FX

The base side is the most finished part of the project and the world is the
least, so that's where most of the next stretch is going. Right now I'm mostly
polishing instead of adding: physics, 3d models, textures, and a bunch of random
bugs.

## Wipes

The server wipes, and whoever comes out on top of a wipe walks away with illegal
gems. You spend those on exclusive skins and weapons that carry into the wipes
after it, so there's a reason to actually win one instead of just surviving it.

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

## Thanks

In absolutely no particular order at all, thanks to and grateful for:

<ul class="thanks">
  <li>Vince</li>
  <li>Columbine</li>
  <li>Kattin</li>
  <li>Diva</li>
  <li>Billie &amp; Benji</li>
  <li>Stella &amp; Zuko</li>
  <li>Kazu</li>
  <li>Coogan</li>
  <li>Indra</li>
  <li>Forgie &amp; Maddy</li>
  <li>Ryan</li>
  <li>Ange</li>
  <li>Richard</li>
  <li>Algeri</li>
  <li>Mabel the Cat</li>
  <li>Kevin &amp; Megan</li>
  <li>Walz</li>
  <li>Stew</li>
  <li>Windshield the Cat</li>
  <li>Megan</li>
  <li>Messi</li>
  <li>Keith (Columbine)</li>
  <li>Tori &amp; Arian</li>
  <li>Parisi</li>
  <li>Matt &amp; Tori</li>
  <li>Cameron</li>
  <li>Nick</li>
  <li>James</li>
  <li>Frost</li>
  <li>Mom &amp; Dad</li>
  <li>Meatball</li>
  <li>Harold</li>
</ul>
