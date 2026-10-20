# Farmer idle presentation

On tab hide, the isometric scene records wall-clock time only if sweeping is
eligible (idle, empty-handed, no task travel, selection, placement or reduced
motion). On return after at least ten seconds it rechecks eligibility and a clear
route, then starts a sweep plan at the first front-road tile without replaying
the approach. It cancels the older idle controller and updates the farmer's
logical presentation cell before rendering. Short absences keep normal idle
behaviour. No hidden animation or server command is needed. Visibility changes
do not start the two-second input-stop deadline; actual input still does, and
gameplay actions retain immediate cancellation.

Isometric sweeping alternates facing between the two front-road tiles: each
stationary pass faces toward the next tile, then the farmer walks there and
turns for the next pass. The four-frame motion, dwell and walking speed stay
unchanged. Mirror the off-centre sweeping foot origin with the artwork so
changing direction does not shift the farmer away from his tile or shadow.

`src/client/game/phaser/farmerIdle.ts` owns bounded route selection, wall-clock rest periods, interpolation and optional local persistence. MainScene supplies current world obstacles and authoritative availability, renders the normal road-aligned walking sprite, updates the validated worker-location hint, and cancels idle presentation before processing player commands.

The controller takes one cardinal step after 60–120 seconds, at 1.8 seconds per tile. A fixed anchor limits all subsequent idle destinations and routes to Manhattan distance two. Road starts only select connected road neighbours; off-road starts use a bounded breadth-first search to return toward a reachable road. Buildings (including the default farm and market), crops, scenery, canals outside the main-road bridge, goods and the river are excluded. A stopped porter's location is not a destination.

The per-farm localStorage record contains integer position/anchor, next movement deadline and snapshot version. It is cosmetic, untrusted input: schema, current obstacles, bounds, radius and farm version are checked before restoration. Authoritative work or queued commands discard it. Storage failure does not prevent play. No server action is issued and no economic phase waits for an idle animation.

On hide, scene cleanup or resize, finish at the adjacent destination rather than retaining fractional coordinates. Hidden updates do not advance strolling. On return/reload, reconcile at most one due step by snapping before ordinary rendering; schedule another full rest rather than replaying elapsed steps. Position continuity is local to the browser, not a cross-device guarantee. Existing offline work reconciliation overrides stale saved positions.
