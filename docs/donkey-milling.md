# Donkey milling

## Rejected complete-frame trial

The eight- and sixteen-frame composite farmer/mill previews, including faster
playback and short frame blending, were rejected as too jerky. Preview controls,
asset loading and rendering code have been removed. Supplied artwork is retained
unused for reference. Keep the previously approved separate-part farmer/donkey
milling animations unchanged; a better solution is deferred to pre-release review.

## Isometric idle presentation

Wandering now uses `donkey/donkey-walk-front-01..04.png` and
`donkey/donkey-walk-back-01..04.png`. Screen-space vertical travel selects front
or back; both source sets face left and are mirrored for right travel. Preserve
the last facing during rests with frame 01. Each tile still takes 900ms, followed
by the existing 30-second pause after a whole stroll. All directional frames use
the full shared 1024px canvas, 256px preparation and 76px display, avoiding
per-frame crops and clipping of the rear-view ears/hooves. Reduced motion holds
frame 01. Legacy idle/walk imports now also come from `donkey/`; mill escort and
the approved `mill-active/` working poses retain their existing settings.

`isometricDonkey.ts` owns the pure allowed-tile and wandering state. The farm
scene prepares `donkey-idle-isometric.png` at 256px with the farmer's shared
0.15 RGB sharpening (preserving alpha and soft silhouette edges), displays
it at 76px with the shared feet anchor, normal depth sorting and daylight shadow.
Initial placement prefers free western ground just north of the main road,
centred on logical tile (-3,4), falling back to the nearest suitable ground.
The west-v2 cosmetic storage key ignores the previous market-side resting tile
once; subsequent reloads preserve the new resting position normally.
Ownership comes from saved inventory; no testing purchase or temporary donkey is
created. Donkey milling now uses the saved escort presentation described below.
Post-purchase market following remains separate.

## Isometric mill selectors and escort

Both Radix recipe selectors dispatch the selected worker. Shared availability
checks apply the donkey's 6-barley/3-bag recipe, ownership, level and storage cap.
The start request includes integer farmer/donkey positions and immediately reserves
ingredients through the existing server workflow. Stop wandering while submitting;
on failure, release the cosmetic pause without spending anything.
`donkeyMilling.ts` samples pickup/drop indices in the saved preparation path:
wait at pickup, follow 0.65 tile behind on the same path, disappear at the mill.
Farmer supply animation remains tied to the saved route and releases at startedAt.
Do not clear independent farmer walks or reposition him when donkey work finishes.
The mill uses donkey-mill-forward/backward.png with the same 5.6-second, 40-degree
eased lever arc as farmer work.
Each direction now alternates with its matching `-02.png` stride frame. Switches
at 2%, 50% and 75% of stroke distance select base/alternate/base/alternate. The
first step occurs around 250ms rather than nearly a second; later switches and
the end-of-stroke hold remain tied to eased movement, not a separate timer.
All four frames retain the full canvas, scale and direction-specific back anchor,
with no added body bounce. Reduced motion holds the original forward pose.
The current lever-length trial stretches its local X axis by 15%, leaving its
thickness and mill pivot unchanged. The farmer hand follows the longer reach,
but the donkey has been restored to its original radius for comparison: the
extra lever length extends beyond its back contact. Actor sizes and timing stay unchanged. The wider farmer
arc can extend the worker feet slightly beyond the footprint (under 8 world pixels).
Full 1024px frames are prepared at 256px with 0.15 sharpening and displayed at
76px. Replacement front/rear artwork uses upper-back
origins (448,320)/1024 forward and (512,385)/1024 backward; both align to the original, unextended lever reach. The lever
renders behind the donkey on the downward stroke and above it on the upward
stroke; this changes depth only, not either sprite's position. A separate donkey image avoids farmer
hit targets. Both replacement poses stay upright with zero rotation throughout
their strokes. The gradual 12-degree tilt trials and earlier constant 27-degree
trial are removed; the original replacement-artwork contact points remain fixed.
The roaming/walking donkey is unchanged. The work sprite
uses the shared 32×48 daylight shadow; idle redraws hide it.
Player acceptance: the directional donkey walking animation was tested and
approved, following approval of the farmer/donkey milling animations and real
donkey milling flow. Keep these settings. Both temporary donkey preview controls
and their state/scene hooks have been removed. Normal wandering preserves its
three-or-four-tile strolls and 30-second rests, hidden-tab/reduced-motion handling
and existing routes. Final mill-animation polish remains separately deferred;
this does not imply approval of unfinished market-following presentation.
The last observed job drives a 900ms/tile reverse escort on completion. Reload
after completion restores the saved resting tile; elapsed return time is never
replayed. Reduced motion/hidden tabs/blocked routes skip that cosmetic return.

Allowed cells are free non-arable ground or completed roads at or north of the
main road; loading points, sweeping tiles and market entrance are reserved.
Neighbour-only movement cannot jump obstacles. Ground is preferred to roads;
the existing 900ms step and 30-second rest are preserved. Each stroll now plans
three or four non-repeating adjacent tiles, using a shorter path if enclosed.
Validate each segment against refreshed obstacles/actors and carry leftover
frame time across tile boundaries. Rest only after finishing the whole stroll
or stopping at a blocked segment. Four walking frames
replace the initial whole-sprite sway, one cycle per step, returning to the idle
pose during rests. All five textures share the measured union alpha bounds
(70,82)–(1008,931), 256px preparation, the farmer's sharpening and 76px display.
Actor positions exclude new destinations. Snapshot redraws retain state, while
new obstacles invalidate affected positions/segments. Persist settled tiles in
per-farm localStorage, validate on restore, and tolerate unavailable storage.
No hidden-tab catch-up or economic command depends on movement. Reduced motion
disables wandering. Rendering is non-interactive and redraw-owned objects are
destroyed with the other scene children.

## Shared ownership and legacy presentation

- Ownership is an estate-inventory `donkey` with quantity one, purchased through the existing transactional NPC market service for 30 shekels. Both the service and UI enforce level 7. Storage capacity and a database check prevent multiple ownership; sales, listings, and inventory withdrawal are disabled. Normal market idempotency and farm version checks apply.
- `MillingJob.worker` is optional for backward compatibility: absent means farmer. `millRecipe` applies a multiplier of three to barley, output, and duration for donkey jobs. The start command validates ownership and chooses all recipe values server-side. Completion continues through the existing lazy lifecycle and mill-bag delivery path.
- `farmerProductionJob` and server availability checks exclude donkey jobs, so the farmer can bake, gather, harvest, or visit the market while a donkey mills. The mill itself still permits only one job.
- Production journeys are persisted with the start command and ingredients reserved immediately. Server timestamps own preparation and completion; escort and supply animations never gate production. `MainScene` presents fetching the donkey, leading it, entering the mill, collecting barley and delivering against that saved job.
- `createDonkey` owns the actor tween and cleanup. Market following tracks the farmer's previous road waypoint. A newly purchased donkey follows home; already-owned donkeys stay on the farm on later market visits. Reloading returns to the main scene with ownership intact.
- Idle farm movement uses adjacent free ground outside the arable plot, above the river. It excludes buildings, irrigation, objects, product stacks, and the farmer. The donkey is hidden during milling, while `donkey-mill.png` represents it inside the building. Failed trips release the actor back to grazing.
