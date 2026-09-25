# Fishing prototype

One ambient fish continuously roams the river with smooth random turns, speed
changes and pauses. Selecting **Go fishing** attracts it to the chosen area while
the farmer walks over; simply opening a river popup or collecting water does not.
On session start it blends into the authoritative catch path over 1.2 seconds;
casts during this approach show a brief wait message instead of evaluating an
invisible target. Cancelling blends back to roaming. After a catch, a replacement
enters from either river edge after three seconds. Ambient motion is client-only
and never grants resources or changes server catch rules.
The fish also follows a gentle four-second vertical sine wave in every movement
mode. Its full sprite stays inside the river row with a small bank margin. Casts
still test horizontal aim; the hook lands at the wave's predicted vertical position.

Click a river tile with empty hands, then **Go fishing**. The farmer walks to the
north bank, switches to `farmer-fishing.png`, and a four-tile fishing area appears
in the river. Click/tap ahead of the swimming fish to cast. Arrow keys position a
keyboard aim marker; Space casts. The hook takes 400ms to land. Misses cost no
resources and casts have a two-second recovery. Stop fishing cancels freely.

A seeded sequence of smooth waypoints produces pauses, changes in direction,
and varying speed. The server evaluates the fish position at landing time rather
than accepting a client-supplied success flag or clock. This is a first playable
prototype, not an anti-bot system: the shared movement model is inspectable by a
determined client. Difficulty should be playtested; a 20–45-second typical catch
is a design aim, not a guaranteed timer.

A catch ends the session and gives the farmer exactly one fish, using
`farmer-with-fish.png`. The only physical actions available are **Store fish** at
the farm and **Release fish** at the river. Other physical services reject actions
under the farm row lock while fishing or carrying fish. Farm fish capacity is five,
separate from barley, and enforced by a database constraint. Fish cannot be
withdrawn, sold, dropped, or delivered to other buildings in this version.

In Resources, **Give one fish to the farmer** consumes one stored fish for +10
happiness (capped at 100). Fish and beer share a single 24-hour treat cooldown;
the existing `last_beer_at` timestamp now records either treat, preserving existing
beer cooldowns without a migration. Full happiness or a cooldown never consumes
stock. Fish treats leave automatic barley rations and hunger unchanged.

Sessions survive refresh and do not catch fish automatically while away. A resumed
session restores the farmer at its riverbank. Carried and stored fish persist;
spoilage is not implemented. Market trading of existing other goods remains
independent of physical farmer activity.

Tuning: `src/game-data/fishing.ts` (capacity, cast timing, catch radius) and
`src/game-core/farm/fishing.ts` (movement). Migration: `0028_fishing.sql`.
Tests: `tests/server/fishing.test.ts`.
