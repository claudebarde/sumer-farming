# Saved-farm isometric checkpoint

Reed/clay gathering is playable through contextual source popups. The existing
start_gather_resource command is submitted immediately with keepalive. A local
approach walks onto the selected source tile, then reuses harvest (reed) or build
(clay) textures. Gathering's ten-second server deadline includes the approach;
no animation callback completes the job. Farm lifecycle settles it into one held
material on reads/actions, releasing the reservation without auto-deposit. The old
complete command is safe to retry after settlement. Polling/deadline/visibility
refresh reconciles completion; reload starts on the source tile instead
of replaying travel. Existing item images overlay the farmer's hands and label
his cargo. Generic ground transfer presentation now supports barley/reed/clay;
server drops validate empty arable ground, preserve quantities and clear legacy
material delivery reservations. Dropped materials can be picked up or consumed
by construction. Fishing/dog/scenery-clearing migration remains separate.
Dropped reed/clay sprites use origin (0.5, 0.71875), halfway between the original
120/128 foot anchor and the tested 0.5 centre anchor. Their ground labels are hidden;
carried-material chips remain visible. Ground barley now uses the same approved
0.5/0.71875 anchor as reeds and clay; carried sprites are unchanged.
This is now the default for every dropped item, via shared `GROUND_ITEM_ORIGIN`,
including future goods. The position is approved; no further positioning trial is pending.
Gathering routing permits entering only the selected reed source, without making
other reeds, rocks, buildings or canals walkable. Construction still uses adjacent
work positions; this adjustment is limited to resource collection.

Clay-collecting visual trial: while stationary and using the pickaxe, shift the
64px farmer and his shadow down 14 world pixels, equivalent to using the approved
ground-item origin (0.5, 0.71875) instead of 120/128. Apply only during clay work;
walking, reeds, carried goods, saved tile position and timers remain unchanged.

Market entry: `market-isometric-test.png` uses the approved building
texture pipeline and a 232px square display, with its visible bottom anchored at
5/6 of the source frame. A 2×2 reference footprint at (10,3)–(11,4) places it at the
right end of the main road, within the world edge. It participates in building
depth/hidden-farmer detection and reserves its footprint for local walking.
Clicking it opens the React travel popup; an idle, empty-handed level-3 farmer
walks to (10,5) before switching to `isometric-market`. A blocked route never
switches scenes. The farm sleeps (not destroyed), preserving its camera and
farmer position while snapshot polling and server simulation continue.

The market reuses prepared textures, with a main road at row 5 splitting into a
rectangular loop (columns 0–9, rows 5–11). The 8×5-tile interior accommodates
two 2×2 stands at (2,8) and (5,8), with merchants facing the lower
road. Connected road masks supply the corners and T junctions. Road-only BFS
routes allow walking around either branch and returning home without cutting
through the interior; rerouting finishes the current step without snapping.
The terrain extends to row 13, keeping a margin beyond the loop, with
a farmhouse at (-3,3)–(-2,4) beside the left end. Its return popup walks the
farmer along the road to (-2,5) before waking the farm. Road clicks allow local
walking at the same 180ms/tile; pan, zoom, Fit and popup arrows work in both
scenes. The barley stand sits beside the road at
(2,2), moved one row back from the road, using `market-barley-isometric.png` at 232px with the approved building
texture preparation. A separate, stationary 64px `farmer-idle` image acts as a
placeholder merchant in front at (3,4.5), beside the road. His depth is in front
of the stand, leaving his whole body visible. Both sprites use pixel-perfect
hit targets and open the shared `MarketDialog` for barley after the farmer's
arrival. The original flat-map dialog, including quotes, NPC
commands, player listings and history, was extracted from `Canvas.tsx` and is
mounted by both views. Isometric snapshots publish to `farmStore`; its subscription
feeds trade results back into the local farm snapshot/renderer with version guards.
Neighbour presence is not implemented yet. The beer stand uses
the same shared renderer, size, ground anchor and merchant offset at origin (5,2),
with its merchant at (6,4.5). Both beer click targets walk to the merchant, then open the shared
`MarketDialog` with scope `beer`: NPC/player Buy/Sell, listings, history and snapshot
synchronization match the flat market. Access starts at level 5 for groats, with
beer and brewing supplies at level 6; locked popups show the unlock level.
A three-column pitch leaves one tile between the two 2×2 footprints.
The baking stand uses `market-baking-isometric.png` and the same renderer at
(2,8), with its stationary merchant at (3,10.5), facing the lower road. Both
click targets open the shared `MarketDialog` with scope `bread`, using the existing
NPC/player Buy/Sell tabs and inventory synchronization. Stand access starts at level
5; per-item unlocks remain unchanged. Below level 5, the contextual popup shows
the unlock level. The (5,8) slot stays empty.
Stand and merchant clicks now queue road-only travel at the shared 180ms/tile
pace to (3,5) for barley, (6,5) for beer, or (3,11) for baking. Only exact arrival
publishes the stand selection to React (which retains the existing unlock checks).
The farmer becomes idle and faces the merchant before the dialog opens. A new
stand/road/return selection cancels or replaces pending interaction; rerouting
finishes the current step without snapping. Sleep/wake/shutdown discard pending
interactions. Already at the entrance opens on the next update; unreachable
entrances never open. No purchases, sales or production are gated on animation.
These scene transitions are presentation-only and never gate economic jobs.
Merchants now track the local farmer within a 3-tile radius using projected
world-space X (independent of zoom/pan). A 12px neutral half-width and 250ms
sustained direction change prevent flip jitter. Only the idle sprite's flipX
changes; position, scale, depth and click targets stay intact. Pending turns
reset on wake and merchant references clear on shutdown; no server state or
economic timing depends on this presentation behavior.

Merchant greeting trial: one reusable Phaser Graphics/Text container above the
nearest merchant, cream/brown with a pointer, 300ms subtle back-out reveal and
250ms fade-out. Text uses 2× resolution; reduced motion skips the scale bounce.
Pure `merchantGreeting.ts` handles 3-tile entry, 3.5-tile exit hysteresis,
four-second display and independent eight-second per-merchant cooldowns. Changing
nearest merchant replaces the bubble immediately; barley cannot silence the adjacent
beer merchant when the player walks between stands quickly. A merchant must be left
before repeating. Wall-clock age skips expired greetings after tab absence.
Trading/selection/return travel suppress bubbles; wake resets the visit, sleep
hides them, shutdown releases references. Non-interactive art never blocks clicks.
Barley: “Buying or selling barley?” Baking: “Fresh bread today!” Beer: “Care for a beer?”
These are presentation-only trial greetings, including at level-locked stands.

Hidden farmer marker trial: a code-drawn golden downward arrow with brown outline
sits above the farmer, above building depth, with a 5px/900ms bounce and 120ms fade.
Only buildings drawn in front trigger it, using a 16×20 grid of opaque farmer
samples against cached building alpha masks (transparent padding is ignored).
It remains while stationary behind a building; crops/scenery never trigger it.
World-space bounds keep detection independent of camera pan/zoom. Cached masks
avoid per-frame canvas readback; marker opacity survives scene redraws. Reduced
motion uses a static arrow without fades. Buildings never change opacity.

Planting and harvesting start from contextual tile/farm popups, not the top toolbar.
The toolbar retains zoom and Fit, with no manual Refresh button. Shared selection, confirmation, cancellation
and active-job controls remain in use by the popup workflow.

The farm-only Manage button sits at the top right and opens the same Radix estate
drawer shell, Resources tab and Farmer/Porter panels as the flat farm, extracted
into `EstateManagementContent`. Isometric snapshots and existing farmStore
subscriptions keep counts and command results synchronized. The flat renderer
supplies its existing Build controls; both views reuse `EstateBuildingCard` for
granary/mill presentation, also used by the isometric brewery, bread oven, warehouse and small shrine cards. All six existing building types now have catalogue artwork. The isometric catalogue uses the new artwork, live
material counts, existing descriptions and level/building limits. Its Build buttons
are disabled for unmigrated types. Granary Build opens real placement with level,
ownership, material and farmer-availability gates.
Building popups now offer demolition for eligible player-built buildings via a
separate Radix Dialog. The shared `buildingDemolitionReason` hides unsafe actions;
`destroy_building` validates ownership/version and the refreshed lifecycle under
the farm row lock before removing a row and its building-owned state. No refund
is made. Stored barley, output, jobs and warehouse capacity are protected. The
initial farm has no demolishable building row. Production/payment history outside
the target building is preserved. Granary rebuilding is available at full cost.
The granary placement presentation was approved on 2026-10-11. The temporary
toolbar toggle and React-only test state/Escape listener have been removed.
Retain `isometricBuildingPlacement.ts`, its tests and the scene preview methods as
the tested baseline for the real drawer workflow: a tinted granary ghost and
four-cell red/green footprint, with a yellow loading tile when valid. The spatial
test uses shared placement/access validators, retaining saved obstacles and
reserved loading tiles while bypassing economy/ownership gates. Pointer hover
and ground-projected taps move it (not building sprite hit areas). The ghost gently
pulses unless reduced motion is requested. Granary rendering uses the existing
240×240 display size, bottom-centred origin and footprint-front Y offset of -12.
Manage → Build granary activates the real validator-backed preview. Clicking locks
the target; confirmation sends build_granary immediately, with request locking and
version checking. Cancel/Escape spends nothing. The farmer walks to the loading tile
and uses construction poses; the persisted two-minute deadline advances independently
of animations. A progress bar marks unfinished granaries. Reload resumes ongoing
work or shows the completed building without replaying its approach. Other building
types still require migration. The spatial-only mock is used only by tests.
The readiness event opens the Build tab; modal
overlay, Escape, close button and trigger focus restoration are preserved.

Isometric farm/test headers no longer offer the Flat farm selector option, and
isometric popups/drawer contain no flat-farm fallback links. Legacy routing/code
remains until the separate retirement task; this is not a default-route change.

Farm/granary barley chips bounce for 420ms when their displayed quantity increases,
with a small scale overshoot and 4px lift. Per-building count/time state survives
scene redraws; initial loads, unchanged snapshots and decreases do not trigger it.
Zero counts are tracked even while hidden, so the first deposit also bounces.
Manual deposits retain old counts until the existing handoff completes; the bounce
starts with the displayed increase. Reduced-motion preference disables the effect.
No server timing or inventory changes depend on this presentation.

Ripe barley uses a +3 ground-depth bias, above the farmer's +1/+2 offsets at the
same anchor. This keeps stalks in front when he stops in a ripe field, rather than
switching him above the crop at arrival. The bias is smaller than a 24px cardinal
ground-depth step, preserving ordering with neighbouring tiles. Other crop stages,
building opacity, sprite positions and harvesting visibility are unchanged.

Ground barley bundles use the approved reed/clay origin (0.5, 0.71875) at their
tile centre, lowering the 52px sprite by 11.375 world pixels relative to the old
120/128 foot anchor. Pixel-perfect bundle hits carry the owning tile coordinate, so clicking
the grains opens that tile even where artwork extends across a diamond edge.
Other ground items and farmer carrying sprites retain their existing placement.

After a reported facing regression, manual delivery now retains a separate
building-facing target throughout handoff and idle, recalculating it on redraw
instead of trusting a cached last-walk direction. Apply flip after texture/size
changes; clear the target for a new movement/action. A scene-level regression
exercises leftward approach, rightward farm unloading, idle texture, command
unlock, snapshot refresh and stale movement-facing state. Source idle/carry/walk
artwork was inspected and all face screen-right unflipped.

Building handoffs use projected screen-space facing rather than the final walking
segment. Manual Store barley retains its destination building, turns on arrival
before the 600ms unloading gesture and retains that facing after completion.
Seed collection and automatic granary deliveries turn toward their source/target
in the last 150ms of approach without changing saved deadlines. Square farm/granary
footprint centres share their origin's screen X; vertically aligned cases preserve
the previous direction because current sprites only offer left/right facing.

The farmer sprite is interactive only while carrying barley; otherwise clicks pass
through his artwork to the underlying tile or building, avoiding name-only popups.
An open farmer popup is hidden if a snapshot empties his hands. His
pixel-hit-tested popup is anchored above his head and
named from his profile. Store barley selects a reachable completed granary that
fits the load, then the farm, then a partial-space granary/farm fallback. Full
stores show the requested disabled No storage available exception. Busy actions
remain hidden. Warehouses are excluded from this shortcut. Existing versioned
deposit commands commit immediately with keepalive; the local carried walk/reach
presentation retains old carry and storage-chip values until arrival. Snapshot
redraws preserve this presentation; absence catches up and reload uses committed
state. Errors refresh without auto-retrying; no animation callback gates storage.

Tile popups reveal with a 240ms scale/fade bounce (94% → 102.5% → 99.5% → 100%),
pivoting at Radix's arrow-aware transform origin. Only the content animates, not
the positioning wrapper. A tile-coordinate key restarts entry when the clicked
target changes, but not during camera movement, clock ticks or snapshot updates.
Reduced-motion users get an immediate reveal. Closing stays immediate.

Contextual popup actions now render only when available, using the model's shared
`actions` flags. Blocker paragraphs and unavailable buttons are omitted. The outer
Radix content allows overflow; only `.popupBody` scrolls, keeping the 20×10 arrow
visible and anchored to the selected tile. Top placement is preferred; Radix retains
viewport collision handling on constrained screens. PROJECT.md records this rule
for future contextual popups; backend validation and submission locks remain intact.

River tiles use `river-water-isometric.png` (1024×512 alpha), through the approved
full-frame terrain preparation and LINEAR filtering, displayed at 96×48. One
non-interactive Graphics layer adds two short white wave strokes per diamond,
with staggered 5.33–7.13 second cycles, 28–70% body opacity and two-pixel strokes.
They now travel 16 pixels strictly screen-left to screen-right per cycle, at 150%
of the previous oscillation's average travel speed. Brief smooth fades at each end
hide recycling without visible backwards motion. The initial subpixel/22%-opacity
trial was too faint at gameplay zoom. Strokes stay inside the water footprint and
below scenery/actors.
Animation time survives snapshot redraws; hidden-tab deltas are capped, and the
OS reduced-motion preference switches to faint static strokes. No game rules change.

Canal starts now select the shortest reachable cardinal-neighbour route, excluding
the excavation tile. After server acceptance, a local wall-clock approach at
180ms/tile precedes the existing work pose; the arrival tile overrides the default
work position with no lean offset, avoiding a second positional jump. Snapshot
redraws retain the route. The saved five-second deadline is unchanged; if it elapses
before a long approach finishes, the farmer arrives without replaying completed
work. Hidden-tab elapsed time catches up; reload uses the existing saved-job pose.
Road construction retains its previous presentation in this slice.

Ground-barley pickup uses the existing immediate server command (with keepalive),
then a local timestamp-based presentation: obstacle-aware route at 180ms/tile,
600ms reaching motion using a small dip of the existing sprite, then carried pose.
The selected ground pile and previous carry count are retained visually until
arrival/reach completion. Controls stay locked during this short presentation;
no request or economy change depends on an animation callback. Hidden-tab elapsed
time skips finished movement; reload displays the committed state without replay.
Unreachable targets are rejected before sending the command. No new sprites needed.
Dropping uses the same route/timing in reverse: retain the pre-drop carried count
and hide the newly committed ground item until the placing motion ends. Then show
the authoritative remainder and ground pile. Both commands use keepalive and never
depend on animation callbacks; failed requests do not start a transfer animation.

Select **Isometric farm (preview)** to inspect the selected player's actual snapshot
and plant or harvest barley. **Flat farm** retains the other gameplay actions. **Isometric test** preserves the isolated
art/animation sandbox. Switching views preserves the selected development player.

The preview reads the same snapshot API as the flat view, refreshing every 30 seconds
while visible and on visibility restoration; active batches also refresh
each second and at the saved phase deadline. Server lazy simulation runs normally.
Planting uses the existing start/stop commands and version checks. It never resets a save.

Shared projection is in `isometricProjection.ts`: saved integer row/column coordinates
remain unchanged, tiles are 96×48 world pixels, and picking first removes the camera
transform. Building footprints use shared building definitions. Ground anchors determine
sprite depth. Pan by dragging; zoom with the toolbar; Fit restores the whole world.

This checkpoint renders terrain, roads/canals, saved crops, buildings, scenery and
ground items. Farm/granary and barley/scenery have isometric art; higher-level buildings
and reeds retain provisional flat sprites. Barley retains approved 112px sown / 98px
growing and ripe presentation, ripe offset (-4,+2), and 0.6 sharpening.
The granary displays at 240px versus the farm's 232px to compensate for its larger
transparent margins. After the 256px size trial, it was reduced 6.25% and its bottom
offset changed from +5px to -12px to inset its rounded decorative base within the
2×2 diamond. Proportions, saved footprint and depth anchor are unchanged.
Granary outline trial: progressively downsample the full source frame to 256px
before upload, with high-quality smoothing, 0.35 opaque-RGB sharpening and linear
filtering. Keep alpha edges intact. This does not change other artwork or source PNGs.

The farmer now appears in the approved idle sprite at the reserved home-road spawn
(column 1, row 5). This is a display-only placement, not a claim about his active job
or last position in the flat view: idle coordinates are not persisted in the snapshot.
It uses the existing 128px prepared texture, 0.15 sharpening, linear filtering and
64px display size with feet anchored at 120/128. Refreshes retain one farmer.

Tap a tile to open its interaction popup; choose Walk here on reachable ground or crops. Uses the approved six-source,
ping-pong walk cycle (one frame per seven world pixels), 180ms per cardinal step
using the shared `WORKER_MOVE_DURATION_PER_TILE` constant from flat gameplay,
shared frame crop and the same sharp rendering. Crops can be crossed without changing them. Buildings, scenery, canals
without completed road bridges, and the river/beyond are blocked. Dragging pans
without walking. A walk finishes before another destination can be chosen.
Snapshot/selection redraws preserve the current segment and position. Reloading
starts at home; this is local presentation only, not authoritative work or travel.

The rejected farm-level pennant trial has been removed. The toolbar's Farm level N
button is accompanied temporarily by Test procession: five decorative lyre players
cross the main road left-to-right using four staggered walk frames over about 18s.
Counting from the leader, positions 1/3/5 use the male frames and 2/4 use the
female frames, with identical framing, scale, baseline and animation timing.
No click targets, collision occupancy, commands, sound or level-claim trigger are
added. Repeated tests restart rather than stack; redraws retain elapsed time and
sleep/shutdown clears the preview. Source frames retain common 512px framing and
the approved sharp character pipeline. This is not yet a progression reward.
Musicians always render above every building sprite (including the market),
recomputing the depth floor after redraws. This procession-only exception prevents
corner clipping; normal farmer/dog depth sorting and building appearance are unchanged.

The toolbar's Farm level N
button remains the progression entry point. Farm evolution uses the supplied
1024px transparent level-01/03/04/09 assets at levels 1–2/3/4–8/9+, with full-frame
progressive downsampling/sharpening and the unchanged 232px size, origin and depth.
Do not independently crop stages. Stock-chip heights follow the shorter stages;
market return art refreshes on wake. The isolated art sandbox is unchanged.

The toolbar's Farm level N
button opens the shared FarmLevelDialog with the same flat-view styling, live
requirements, offering checks and authoritative claim command. Shared farm-store
updates reconcile claims immediately into the isometric scene. Location changes
and unmount close the dialog; the market retains its location label.

The active sowing panel shows “Sowing barley...”, completed/selected fields, and
the existing flat-view circular meter styling with a percentage. Its denominator
is barley sowingDurationMs × the original selected count; only completed work and
elapsed sowing on the current field contribute, not collection/walking. It samples
the same saved schedule as the farmer animation, so reload/absence and snapshot
refreshes do not reset progress. A field leaves the server's remaining list when
work starts, so the active sowing field is subtracted from the completed count.
The active sowing panel is informational only; it has no stop button. Selection
confirmation/cancellation and harvesting controls are unchanged.

Dog companion: six supplied 512px walking frames plus sitting idle, using shared
full-canvas framing and the approved progressive downsampling/sharpening pipeline.
Reuses planDogFollow in logical tile space (one-tile stopping distance, original
120px/s at 64px/tile pace, 150ms retry), projected into isometric world coordinates.
Sitting faces the mouse; movement faces travel. Pose state survives scene redraws
and snapshot refreshes; capped frame delta avoids hidden-tab catch-up jumps.
Buildings, crops, scenery, ground goods and canals block dog routes. No fetch UI,
commands or economy changes. The dog stays in the farm while visiting the market.

Remaining migration work: other synchronized work/animals, market/signpost
navigation, remaining popup actions, placement previews, and full obstruction
handling. No production or economic phase depends on this renderer.

## Authoritative barley planting

The approved road artwork is integrated into the saved farm; the temporary road
test scene, selector option and fixtures have been removed. Source PNGs are retained.
Road masks use clockwise NW/NE/SE/SW bits 1/2/4/8. Completed neighbours select the
straight, corner, T or approved composite X texture. Ground-plane rotations preserve
the 2:1 diamond; end caps are composed from the straight road and sandy corner quadrant.
All textures use full-frame preparation and 96×48 world footprints.
Non-arable ground now uses `v2/isometric-test/ground-non-arable.png` with the same
texture preparation and exact diamond size. It renders below scenery and construction,
outside the arable plot, excluding river, completed roads and canal tiles. This
changes only artwork; land eligibility and the inaccessible desert remain unchanged.
Arable ground uses `v2/isometric-test/ground-arable.png`, normalized from its
1774×887 source through the same full-frame preparation. It fills bare fields and
remains beneath crops; a brown underlay prevents green gaps at the irregular alpha
edges. Roads, canals, water and crop artwork keep their existing rendering.
Completed irrigation now uses the three PNGs in `v2/isometric-test/canals/`,
including the manually replaced `canal-nw-ne-se.png`, never the preview images.
The larger 1774×887 T source is normalized to the same 256×128 prepared texture
as straight/corner artwork. Canal masks reuse road orientation/composition;
river edges connect automatically, unfinished neighbours connect on completion,
and removed canals stop connecting at their destruction deadline. Completed
canals render above road tiles but below crossing overlays and actors. Unfinished
trenches, progress bars and pickaxe animation are unchanged. End caps and Xs are
composites; river-mouth and crossing artwork can be refined separately.
Build road uses the existing versioned `build_road` command, placement validation,
five-second server deadline, active polling, keepalive and duplicate-click guard.
Construction shows an earth patch/progress bar; neighbouring textures update on
completion. Road removal remains future migration.
Road and irrigation work now share the three `farmer-build-01/02/03` pickaxe poses,
in a 1–2–3–2 cycle at 350ms per pose. A fixed 432px frame preserves the foot baseline
and tool swing, using the approved sharpness pipeline. The farmer is placed on safe
adjacent ground during work; canal starts walk there first, while road starts
still use the immediate work-position placement.
Saved construction timestamps drive pose selection and stop it at completion,
including after reload/absence; no animation callback changes the farm.

Initial camera zoom is the fitted scale multiplied by 1.2² (two toolbar + presses),
subject to the existing zoom cap. Fit still restores the full-map framing.

Selection reuses `plantableFields`, `plantingSelectionLimit` and `togglePlantingField`.
Confirm submits `start_batch_planting` immediately, with the selected fields, current
farm version and preview farmer waypoint. The server reserves seeds and saves travel
paths/deadlines. Stop uses `advance_batch_planting` with action `stop`; no visual
callback ever advances economic phases. Start requests use keepalive for navigation.

`isometricPlantingPose` samples saved collection/travel/sowing schedules, including
elapsed phases between reads. This is visual prediction only: crop creation, seed
spending and progress remain server-owned. New snapshots reconcile without replaying
the collection leg. The approved planting cycle runs for sowing; carried seed count
appears over the farmer. Buildings retain their opacity while he walks past.
The carrying chip uses a cream capsule with a warm brown border, subtle shadow
and bold serif count; its bottom stays anchored 62 world pixels above the feet.
Text is rendered at double resolution and the capsule resizes with the quantity.
Planting selection and preview movement are disabled while submitting or working.
Older farm versions are ignored; failed commands are never automatically repeated.

## Harvesting and tile popups

Harvest selection uses the same ripe-field eligibility, happiness limit and
`start_batch_harvesting` / stop commands as the flat map. The server persists
travel, ten-second harvest phases and granary delivery. The isometric renderer
samples these timestamps, hides completed crops visually, updates carried barley
and uses the three v2 harvest poses from `v2/isometric-test/farmer-harvest-01.png`
through `03.png`, in a 1 → 2 → 3 → 2 cycle with 550ms frames. Equal 424px framing
windows align the feet without independently resizing the bending pose. These use
the approved 128px prepared textures, 0.15 sharpening, linear filtering and 64px
actor display size. The player approved this three-pose cycle. Both source sets are preserved; the flat scene retains its
original harvest artwork. Animation timing does not change server harvest timing.

The farm and each completed granary show rounded barley-count chips on their
visible roofs only when they contain barley (bottom anchors: footprint front Y minus 150px
for the farm and 145px for granaries). Farm stock comes from the snapshot inventory;
each granary shows only its own stored barley. Snapshot redraws refresh the counts.
Chips share the carrying-chip style, follow camera pan/zoom and do not intercept clicks.
Buildings never change opacity in response to farmer movement or overlap.
Completed buildings remain opaque; only unfinished construction uses 50% opacity.
No animation acknowledgment advances work. The approved walk cycle is retained
for empty-handed travel, with the rounded carrying chip displaying the load.
When carrying barley, two `v2/walking-test/farmer-carry-barley` poses alternate
every 35 world pixels (the same 70px full stride as normal walking). They share
424px framing, approved sharpening and the existing 180ms-per-tile movement.
The first pose remains visible when waiting with surplus; empty hands restore
the idle/normal walk. Work poses still take precedence during harvesting/sowing.
This also applies to carried barley seeds. Server timing and inventory rules are unchanged.

`harvestDeliveryPlan` is shared by server scheduling and visual prediction, keeping
granary choice, road-preferred routes and travel durations consistent. Storage
settlement is still server-owned. Granary surplus schedules a second saved leg
using shared `harvestFarmDeliveryPlan` when the farm has room. The delivery phase
uses a null granaryId for the farm (existing granary UUID saves stay valid).
Both arrival capacities are rechecked transactionally; the isometric renderer
predicts the same route, carry remainder and building-facing direction. Any further
surplus stays carried at the last stop. No reachable granary leaves the farmer at the final field. The saved
delivery marker restores his destination on reload, without replaying travel.

Tile popups are React/Radix, anchored to camera-projected tile coordinates with
viewport collision handling, Escape/close controls and the six-tile width cap.
Building art is pixel-hit-tested so clicking a roof selects that building rather
than an unrelated ground tile. Crop popups start field selection; farm/storage
popups show live stocks, reusing BuildingStorageTables. Unmigrated actions have no
flat-farm fallback links. Building placement, gathering, production and remaining
non-barley storage transfers are not migrated yet; market controls and manual barley
storage are described above. Irrigation construction
is now connected through `build_irrigation`, with version checks, duplicate-click
protection, keepalive and no automatic retry. Placement previews use existing location,
connection and scenery rules. Snapshot polling runs during construction and refreshes
at its deadline; a trench and progress bar become water at the saved completion time.
The shared pickaxe animation follows the canal approach walk; canal removal remains unmigrated.
The arable-ground
popup now supports Drop barley through the existing versioned `drop_carried_item`
command: one barley per empty tile, no optimistic inventory mutation or automatic
retry. Server snapshots update the ground bundle and carried count immediately.
