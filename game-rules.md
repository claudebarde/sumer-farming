# Game rules

This is the living, player-facing reference for the game's implemented rules. Use it when explaining the game, preparing help text, or answering players' questions. Planned features are listed separately and are not promises of currently available gameplay.

## Starting your farm

Farm and market shadows subtly follow your device's local time. The sun travels
east through north to west between 08:00 and 20:00, with the shortest shadows at
14:00. Directional shadows fade in/out over the first/last half-hour; at night,
only faint contact shadows remain. This is cosmetic: sprites, production and
gameplay are unchanged. The temporary Shadows selector previews Morning (09:00),
Midday (14:00), Evening (19:00) and Night (22:00); Local time restores your clock.
Reloading returns to Local time, and returning to the tab uses the current time.
Buildings use flattened shadows shaped from their visible
artwork in morning and evening. Around midday, these become shallow contact
ovals beneath the buildings, extending slightly to the sides and south.
Characters and small objects retain their existing simple oval shadows.
The mill uses simple morning ellipses with the same sun-based length scale as
other shadows, retaining its midday contact ovals and evening silhouettes.
The mill shadow uses its stone body and visible idle bags; the bowl and moving
lever are excluded. Its bags' shadow disappears when the bags are hidden during work.

The former level-signpost tile beside the farm is ordinary ground. Roads, canals
and other ground actions follow their usual rules there; it is no longer reserved.

Clay and reeds can be dropped onto an existing pile of the same material, up to
five units per tile. Each drop adds one unit; mixed piles and barley stacking are
not allowed. Every clay or reed pile shows a small quantity-only chip, including
`1` for a single item, to indicate that it can be stacked. Picking up or
destroying materials removes one unit, removing the pile when its last unit is gone.
Picking up or destroying clay and reeds requires empty hands. Those buttons are
hidden while carrying any item; dropping onto a matching pile remains available.

At level 6, Manage → Build Bread Oven uses the shared isometric placement and
confirmation flow. It needs a free 2×2 footprint beside a connected completed road
with loading access, 4 reeds, 6 clay and 2 stored baking tools. Construction takes
three minutes, with the existing farmer pickaxe animation, semi-transparent oven
and progress bar. Its saved timer continues offline. This isometric migration
currently covers construction and the completed building popup; baking controls
and the busy oven animation are not yet connected in this view.

The farm building popup shows **Claim level [number]** only when all requirements
and offerings for the next level are ready. It uses the same claim, offering costs,
unlock toast and celebration as the farm level dialog; otherwise the button is hidden.

In the isometric farm, after 10 seconds without input, an idle, empty-handed farmer
anywhere on the reachable map walks to the nearest of the farm's two front road
tiles and sweeps, alternating between both tiles. Mouse movement, clicks, keyboard
input or scrolling stops sweeping immediately. It is cosmetic: no resources,
rewards or saved work timers change. The dog walks off the two sweeping tiles and
keeps clear while sweeping continues. It does not run while the page is hidden or
reduced motion is enabled. Sweeping begins only after he arrives; if there is no
clear route, he waits and retries rather than teleporting. Sweeping takes priority
over the older idle strolling behaviour whenever the front road tiles are reachable.

After 20 seconds without player input, the dog wanders within three tiles of the
farmer's current position, including while the farmer works. It uses its normal
walking speed, pauses for 2–6 seconds, and avoids obstacles, crops, ground items
and the farmer's work area. Mouse movement, clicks, keyboard input, scrolling or
touch ends wandering and restores following, keeping clear of ongoing work.
The dog uses position-based depth sorting like the farmer: visible in front of
buildings and hidden when behind them. He still walks around their footprints.
Blocked routes are retried without teleporting. Wandering is cosmetic, resets
when leaving the scene, and is disabled while hidden or with reduced motion.

In the isometric farm, click the farmer to see his saved name, **Happiness** and
**Next meal** meters, whether or not he is carrying goods. Happiness is the
existing wellbeing measure; there is no separate health statistic. Carried goods
are listed beneath the meters, with available storage actions below.

Idle strolling is also available in the isometric farm. It pauses while a tile
popup or placement/field selection is open and is disabled by reduced-motion
preferences. It avoids crops and dropped goods as well as impassable tiles;
this does not change where the player may explicitly direct the farmer to walk.

Gathered clay and reeds remain carried cargo until dropped or deposited. In the
isometric view, a material drop's readiness toast waits until the farmer finishes
walking and placing the pile, then checks supplies automatically—no further click
is needed. Dropping does not also add the same material to stored inventory.

When you have enough construction materials for an unlocked building type you have not built, a **Ready to build…** toast appears. This covers the granary, mill, brewery, bread oven, warehouse and small shrine, including any required brewing jars or baking tools. Stored materials and ground stacks count; carried goods must first be deposited or dropped. Completed buildings and those under construction do not trigger it. Each building is announced once while its materials remain sufficient, remembered across reloads/devices. If available materials fall below its cost, the notification re-arms and appears again when supplies become sufficient. It confirms material availability, not valid placement or farmer availability; normal construction rules still apply. On the farm screen, **Open Build** opens the Build tab in Manage estate.

When idle and empty-handed, the farmer waits 60–120 seconds before a slow one-tile stroll. He follows roads, or takes safe short steps toward a nearby road, staying within two tiles of where he last finished a task. He avoids buildings, crops, reeds, the river and the resting porter. If no safe nearby route exists, he stays put. New work interrupts the stroll immediately; carrying goods or waiting on a delivery prevents wandering. This is cosmetic, with no happiness or production effects. The same browser remembers each farm's idle position; returning after an absence allows at most one small repositioning, without replaying missed walks. This cosmetic position is not synchronized between devices, and saved work always takes precedence.

While working toward level 2, **Build an irrigation canal** and **Plant your first barley field** receive green checks when a river-connected canal is completed and barley sowing finishes. Both achievements are permanent; removing the canal or harvesting the field does not undo them. Existing planting/harvest progress counts too. The usual harvest and barley-offering requirements remain unchanged.

Before entering an unnamed farm, choose a farmer name from the male names (Gudea, Ur-Nanshe, Meskalamdug, Lugalzagesi, Amar-Suen) or female names (Baranamtara, Geme-Bau, Enheduanna, Geme-Ninlila, Ninkalla). The name is saved separately from the player/account name and appears centered beneath the farmer portrait in **Manage estate → Farmer**. Happiness is shown by the meter below, without a mood emoji beside the name. The tab itself is still called **Farmer**. Names need not be unique between players. The existing primary farmer is named **Meskalamdug**. Unnamed existing farms also receive the name-selection step, without losing their city or progress.

Naming does not alter sprites, abilities, happiness, or resources. Renaming, appearance customization, biography, and personality options are planned, not playable yet.

Players without a saved home choose a city on the Sumer map before entering their farm. Neighbourhood assignment is automatic: join a public neighbourhood in that city with fewer than 10 players, or create a new public neighbourhood if none has space. A new public neighbourhood may initially have one player and will welcome subsequent arrivals. Each neighbourhood contains at most 10 players from the same city. City and membership persist across reloads; selecting a different map marker does not relocate the estate.

Onboarding does not offer neighbourhood selection, player-created neighbourhoods, or invitation codes. Automatic assignment costs no shekels. Existing memberships are preserved.

The **Sumer** button below **Manage** opens the map for established players. The home city has a green ring and the footer shows the saved city and neighbourhood. **Back to your farm** returns without spending resources. The existing primary development player's estate has been assigned to Lagash; other unassigned players choose for themselves.

Planned, not playable yet: later in the game, a player can propose a private neighbourhood and invite friends through a link. The founder stays in their current neighbourhood until the first invited friend creates an account and joins; then both move together into the new private neighbourhood. Two players are sufficient for this invitation-based founding, with the same-city rule and maximum of 10 still applying. This replaces the earlier four-member founding deadline; no solo private neighbourhood is activated. Relocation fees (shekels or real money, undecided), neighbourhood activities and Sumer-wide trading remain planned. Private neighbourhoods will not be isolated from future Sumer-wide activities. Current identity selection remains development-only, not production authentication.

For local testing, the header's test-player selector lists saved farmer names only.
Unnamed players are omitted until their name is confirmed. The separate
`?devPlayer=onboarding` playthrough starts with the normal level-1 economy and the
name/city onboarding screens; it does not reset any existing farm. The selector
updates after naming, and switching players preserves each farm's progress.

A one-tile-high strip of decorative ground above the farm's first row gives characters room to remain fully visible on top-row roads. This strip cannot be selected, built on, or used for walking; it does not add playable land or change existing tile coordinates.

The farm view scrolls vertically when it does not fit on screen, ending after three rows of desert beyond the river. Use the mouse wheel, trackpad, scrollbar or a vertical touch swipe. Ground beyond the river is scenery only, not selectable or walkable by the farmer or porter. Scrolling does not expand the estate. The market keeps its existing screen-sized view.

### Optional fetch game

In the isometric farm, the dog follows, sits roughly one tile from the farmer,
and faces the mouse while sitting. Its legs animate during walking. Fetch remains
deferred in this view; the fetch controls described below are legacy flat-view only.

- Available from level 1: click the farm dog, then **Play Fetch** while the farmer is idle.
- Clicking the dog opens a standard popup anchored to him, with a close button and **Play Fetch** action. It stays within the canvas edges. During a round, the separate gameplay controls show aiming instructions and **Stop playing**.
- Outside fetch, the dog follows the farmer toward a clear neighbouring tile, keeping roughly one tile away. It goes around buildings, fields, canals, and the river, or waits if no route exists. When the farmer stops (including to plant or harvest), the dog continues catching up before sitting beside him. Normal farm updates never teleport it.
- Fetch temporarily takes priority over following. If a round needs a different starting point, the dog walks there around obstacles before the run begins. It uses the standing pose while moving and sits when stopped.
- While sitting, the dog faces the mouse: left when the cursor is left of the dog, and right when it is right. Walking and fetch keep their movement-facing behaviour. Touch input does not trigger this cosmetic effect; a mobile idle animation is not implemented yet. Random idle turning has been removed.
- The dog runs along a randomly selected clear, straight route. Its stopping distance is hidden; each run lasts 6–8 seconds, with a visible slowdown during the final quarter.
- Aim the arrow from the farmer with the pointer and click to throw. On touchscreens, drag and release. Arrow keys adjust the aim and Space throws; Escape or **Stop playing** exits.
- The temporary stick takes 0.65 seconds to land. It must land ahead of the dog, close to its route, and be reached before the dog stops. Behind, sideways, and overly distant throws lose the round. Only one throw is allowed per round; replay is free.
- Fetch does not consume or grant goods, currency, happiness, or progression. Crops and brewing continue normally. Farm tile actions are blocked only while the fetch controls are open.
- Routes avoid buildings, fields, canals, ground items, the signpost, and canvas edges. Changes to the route or resizing cancel the round safely. Fetch is local entertainment; no score or round is persisted.

### Initial estate

In the isometric view, the farmhouse appearance evolves with the claimed farm
level: low open walls at levels 1–2, a simple roofed home at level 3, a striped
doorway awning at levels 4–8, and the
finished farmhouse from level 9 onward. The change is cosmetic: its 2 × 2 footprint,
entrance, storage rules and interactions remain unchanged. The market's return-to-farm
building uses the same stage. Intermediate visual upgrades are not implemented yet.

- Start at **level 1 — First plot**, with a farm building, two barley bundles on the ground, empty inventory, and zero shekels.
- Farmland is **8 tiles wide and 4 tiles deep**, entirely south of the main road and extending to the riverbank. There is no arable ground north of the road. Roads, canals and existing buildings occupy space that cannot also be planted. Gradual farmland expansion through farm levels is a future idea, not an implemented rule.
- The road crosses the sixth row from the top. Irrigation canals can cross it using a bridge.
- The default farm sits immediately right of the level signpost, above the road. The farmer starts on the road at the farm entrance; farm deliveries use this entrance too. Keep this entrance clear of other buildings' loading points and canals.
- Click a ground or arable tile beside the main road or a player-built branch and choose **Build road**. Dirt roads are free. The farmer walks from his current position to a reachable tile beside the site at his normal 180 ms per tile, then works with his pickaxe for five seconds. The server saves the approach route and completion time; reloading resumes elapsed travel or unfinished work instead of restarting it. Every new tile must share an edge with a completed road (diagonal contact is not enough). Roads stay within the farm map and cannot cross the river or replace fields, canals, buildings, reeds, or ground items.
- Completed player-built roads offer **Destroy** when the farmer is available and empty-handed. The main road is permanent. Removal is refused with an explanatory toast if any remaining road would lose its edge-connected route to the main road, or if a building would lose its reserved loading tile. The server checks these rules too. The farmer walks to the road, then uses his pickaxe for five seconds; saved removal completes even after reloading. Free roads provide no refund.
- Roads and irrigation canals can replace decorative rocks and bushes/trees: construction clears that scenery permanently. Reeds still block both, as do planted crops (including date palms). Normal connectivity and other placement requirements still apply; failed construction does not clear scenery.
- Newly created farms start with 6–8 randomly placed decorations, including at least 3 rocks and 3 bushes, plus two riverbank reed sources. All occupy distinct non-arable tiles above the river, avoiding the main road and permanent buildings. Reeds, bushes and rocks cannot occupy farmland. On existing farms, scenery displaced by the expanded southern farmland moves to vacant non-arable ground; reeds remain beside the river. Existing goods, buildings and work are preserved; cleared scenery does not respawn.
- New buildings can occupy ordinary **non-arable ground on either side of the main road**. Every tile of their footprint must be non-arable, empty and inside the map; even partial overlap with farmland, roads or water is forbidden. A free 2×2 footprint must border a completed connected road, reserving one exclusive, unoccupied road tile as its loading point. Placement highlights this tile. Loading points remain walkable. New canals cannot replace loading points or player-built roads. Existing saved buildings are not moved by this placement rule.
- Finished flour/groats bags, beer jars, and bread baskets appear in the bottom-left tile inside their producing building's 2×2 footprint, drawn above the building with their quantity chip. They do not occupy surrounding road tiles. The farmer collects them from the building's road loading tile rather than walking onto the goods or into the building.
- The farmer prefers connected roads, including for deliveries, but can leave them to reach fields and existing buildings. Buildings from older saves remain usable without road access and retain their existing output-placement fallback.
- Barley is both a crop and its own seed: keep some for planting rather than consuming or selling everything.

## Farm levels

In the isometric farm, the **Farm level N** button at the top opens the level dialog with current progression, next-level requirements, unlocks and the claim button. The farm popup also shows its current level. The granary popup shows its own building level, independently of farm progression. Neither an estate-level signpost nor a pennant is used in the isometric view. This display does not add granary upgrades or change storage capacity rules.

Legacy flat view only: click the signpost on the left side of the estate, immediately above the road, to open the same level dialog. The following signpost presentation remains specific to that legacy view.

The signpost displays the current farm level in gold. The number changes to a large golden **+** when the next level can be claimed, including the spare-seed safety check. After claiming, it shows the new level number (or **+** if the following level is already ready); if requirements are no longer met, it returns to the current level number.

The signpost tile is permanently reserved. No part of a building's footprint may overlap it, and fields or irrigation canals cannot be placed on it.

Leveling up is **manual**, not automatic. Meet every listed requirement, then press **Claim level**. The button stays disabled until the requirements and seed-safety check are satisfied. Required offerings are consumed when you claim the level, not while you are gathering them. Levels must be claimed in order.

### Playable levels

| Level reached | Requirements | Goods consumed on claim | Unlocks |
| --- | --- | --- | --- |
| 1 — First plot | Starting level | None | Irrigation, barley cultivation, farm storage |
| 2 — Grain keeper | Complete a river-connected irrigation canal; plant your first barley field; harvest at least 5 barley yourself; have 5 usable barley on the ground | 5 ground barley | First granary |
| 3 — Grain trader | Complete a granary; have 10 barley stored in granaries | 10 granary barley | Market entry and barley trading |
| 4 — River provider | Sell at least 5 barley; complete at least 50 crop harvests during level 3; have a full granary (15 barley), plus at least 1 unexpired ground barley or an already-planted barley field | 15 barley from the full granary | Fishing, fish storage, and normal happiness management |
| 5 — Caring household | Have 3 stored fish and 15 barley in completed granaries; have fed the farmer at least 1 fish; retain spare seed or an already-planted barley field | 3 stored fish and 15 granary barley | Mill, barley processing and hired porter |
| 6 — Brewer or Baker? | Complete a Mill; harvest 50 crop plantings during level 5; process 4 barley into either output; hold 2 processed goods in any combination | 2 Flour or Brewer's Groats, combined (Flour used first) | Brewery, Bread Oven, brewing supplies, bread making, beer and bread trading |
| 7 — Trusted supplier | During level 6, produce at least 15 bread or beer combined and sell at least 10 bread or beer combined; have 5 stored bread/beer combined | 5 bread/beer in any combination (bread used first) | Merchant requests, 20-barley capacity per granary, and the mill donkey (30 shekels) |
| 8 — Growing estate | Fulfil at least 3 merchant requests; have 20 barley stored in a completed granary; purchase a mill donkey; retain spare seed or an already-planted barley field | 20 granary barley | Warehouse and Small shrine |
| 9 — Established producer | Complete a warehouse; during level 8, harvest 100 barley and produce 30 beer/bread combined; store 10 bread or 10 beer | 10 bread, otherwise 10 beer (not mixed) | Date palms, dates treats, and bread oven and brewery upgrades to building level 2 |

Unlocking a building gives permission to construct it; the level claim does not build it or pay its construction materials.

For level 4, the ground barley or planted field is retained. Farm-stored or carried barley does not satisfy this specific safeguard, and a field still being sown does not count yet.

Every playable level-up consumes resources. Reaching level 7 consumes 5 stored bread/beer in any combination, taking bread first and beer for the remainder. Pending, carried and listed goods do not count. Existing farms at level 7 or higher are not charged retroactively; retries do not consume the offering again.

Every successful level claim in either the isometric or legacy flat farm shows a congratulatory toast in the top-left corner with your new level, its name, and a short summary of unlocked features. It appears alongside the isometric procession without blocking play, disappears after 8 seconds, or can be dismissed manually. Reloading does not replay level-up toasts.

In the isometric farm, a successful claim also closes the level dialog and starts
a single celebratory procession: five evenly spaced lyre musicians cross the main
road from left to right in about 18 seconds. From the leader, positions 1, 3 and 5
are male and positions 2 and 4 are female. They do not block tiles, intercept clicks
or interrupt the farmer. Leaving the farm ends the procession; returning or
reloading does not replay it. There is no music yet; future music will respect
the game's sound settings.

### How requirements are counted

- Level 8 checks current granary stock and permanent donkey ownership when claimed, alongside lifetime merchant requests. Farm storage, carried barley, ground barley, and unfinished granaries do not count toward the 20-barley offering. Claiming consumes 20 granary barley and keeps the donkey. Retain spare seed or an already-planted barley field, as with other barley offerings. Existing level-8 farms keep their level and are not charged retroactively.

- Lifetime totals are retained for harvests, harvested barley, production, fish fed, sales, and fulfilled requests. Level 4 counts only crop harvests completed during level 3; level 6 counts only crop harvests completed during level 5; level 7 counts only production and sales during level 6; level 9 counts only barley harvested and bread/beer produced during level 8. Bread and beer production can be mixed freely.
- The level-4 crop-harvest counter starts at zero when entering level 3 and increases once per harvested field, not per seed planted or unit of barley. Existing level-3 saves without an entry baseline start at zero on their first load after this update; earlier history cannot be reconstructed. Reloading does not reset it. The level-6 requirement similarly counts 50 fields harvested during level 5. Existing level-5 saves without a baseline start at zero on first load after this update; reloads preserve subsequent progress.
- Level 9 requires 100 barley (not 100 fields) harvested and 30 bread/beer produced after the level-7-to-8 claim. Existing level-8 saves without a baseline start the missing counter on their first load after this update; historical level-8 totals cannot be reconstructed. Adding the production baseline preserves existing barley progress and lifetime totals. The offering requires 10 of one kind in shared estate stock: bread is used first if at least 10 are available, otherwise beer. Pending or carried goods do not count toward the offering, and 5 bread plus 5 beer is not enough. Only the food offering is consumed; the warehouse is kept.
- Existing level-6 saves without a level-entry record start these two counters at zero when first loaded after this update; their lifetime totals and inventory are preserved. This one-time reset avoids treating older lifetime activity as current-level progress.
- Goods required as an offering must still be available in the specified location when you claim.
- Starting bundles and purchased barley do not count as barley you harvested yourself.
- A crop harvest currently produces 2 barley. Therefore, reaching the 5-barley harvest milestone requires at least 3 completed harvests.
- Bread and beer count as produced when their production batch completes, even before delivery to the farm. Purchased goods do not count as production.
- Sales requirements count completed NPC or player-market sales, not unsold listings. Merchant deliveries are a separate achievement.
- Previously sold goods and completed deliveries are not consumed or charged again by a level claim.

### Protecting your planting seed

- NPC barley sales and new player-market barley listings must leave at least **1 barley in estate storage** (farm, completed granary or warehouse combined), at every level, even with planted fields or enough shekels to buy more. Carried, ground, planted and already-listed barley do not replace this reserve. Selecting all stored barley disables confirmation with **You must keep 1 barley in your farm**; the server also rejects the sale/listing. This restriction protects against selling the last planting seed; it does not reserve barley against other uses such as meals or production. Existing listings are not cancelled.

A barley offering is blocked if it would leave you with no usable barley **and** no already-planted barley field.

- For level 2, exactly 5 ground barley with no other seed and no planted crop is **not enough**. Keep a sixth barley, or plant a field first.
- For level 3, the same rule applies to the 10-barley offering: keep an eleventh usable barley somewhere outside the offering, or have a planted field.
- For levels 2–3, spare seed can be on the ground, carried by the farmer, stored in the farm, or stored in a completed granary.
- Level 4 specifically requires at least one unexpired ground barley or an already-planted field, in addition to the full granary offering.
- Expired barley and barley delivered to a brewery do not count as spare seed.
- An already-planted field may be growing or ready to harvest. A sowing action that has not finished does not count yet.

### Levels 10–11: not yet playable

Level 9 is currently the highest claimable level.

- Level 10 is intended to introduce neighbourhood and cooperative systems. Its final requirements are not implemented.
- Level 11's final progression requirements are not implemented.

These future levels cannot be claimed yet, even if their previewed milestones have been met.

## Barley, irrigation, and storage

Seed collection uses the same walking pace as field-to-field planting travel,
including any applicable farmer wellbeing modifier. Short collection trips keep
their remaining collection time as a stationary pause at storage, not a slower
walk. Carrying some barley already does not change the travel speed.

- Batch planting uses the same happiness tiers as harvesting: **4 fields at 0–50%, 6 at above 50–90%, and 8 above 90%**. The available seed supply can reduce this limit. Selection and server validation both enforce it; unselected fields turn red when either limit is reached. Happiness is checked when starting the batch, so later changes do not shrink an accepted queue. Existing planting queues are preserved. This is a per-batch limit, not a limit on the estate's total planted fields.

The isometric harvest selection counter displays selected fields out of the
smaller of the happiness-based capacity and the number of currently ripe,
harvestable barley fields. For example, capacity 6 with 4 ripe fields shows
`1 / 4 fields` after selecting one. Once harvesting starts, progress uses the
accepted batch's total instead; the server's happiness limits are unchanged.

- Planting consumes 1 barley seed. Sowing takes 10 seconds, growth takes 30 minutes, and harvesting takes 10 seconds. A completed harvest yields 2 barley.
- **Plant barley** opens field selection, including when only one empty irrigated field is available. It replaces the separate single-field planting button and is hidden on unirrigated tiles, even if other fields can be planted. Select one or more eligible fields (they need not touch), then confirm. Yellow stripes mark available fields; selected fields are green. Once all available carried and stored seeds are assigned, remaining fields turn red and cannot be selected until another is deselected.
- Each selected field reserves 1 barley, using carried barley first and stored barley only for the shortfall. With no other task underway and either empty hands or carried barley, the farmer collects any additional seeds from a stocked granary or otherwise the farm. If carried barley is sufficient, he goes directly to the fields. Each field takes 10 seconds plus travel and starts growing independently. The carry chip includes unused seeds and any excess carried barley. Other farmer actions and market visits are blocked during the job.
- Batch planting and reserved seeds survive reloads. The full planting queue continues while the tab is hidden or closed: server deadlines account for seed collection, travel and 10 seconds of sowing per field. On return, completed fields have already grown for the elapsed time since their individual planting deadlines; unfinished work resumes with only its remaining time. New batches save road-preferred routes from the farmer's current position to seed storage and then between fields, at his speed when the batch starts. The animation follows these same routes and deadlines rather than restarting a separate walk after each sync. **Stop after this field** finishes any active sowing and returns unused carried seeds to the farmer (with their original expiry), and unused stored seeds to storage; stopping before sowing returns all unused seeds immediately.
- Clicking growing barley shows a small horizontal progress bar beneath its description, indicating progress from planting to harvest readiness.
- Planting requires suitable irrigated ground. Connect canals to the river; an isolated canal does not provide a working water supply.
- Canal construction and removal each take 5 seconds.
- Select a completed canal and choose **Destroy** to have the farmer approach and
  use his pickaxe to remove it. The farmer must be idle and empty-handed. The
  button is hidden while any cardinally adjacent field contains crops (sown,
  growing or ripe), or if removal would disconnect another canal from the river.
  These crop/connectivity checks are also enforced by the server. Removal uses
  saved timestamps and completes even if the page is closed or reloaded.
- Exposed barley on the ground or carried by the farmer perishes after **3 days**. Store it to protect it.
- The farm popup has no manual barley-withdrawal button. It shows a storage action when carrying barley, disabled if the farm is full; task-driven collection from farm storage remains available.
- Ordinary pickups allow up to 2 barley at once. **Harvest multiple fields** allows **4 ripe fields at happiness 50% or below, 6 above 50% through 90%, and 8 above 90%**, not necessarily adjacent. The compact selection panel shows the selected count/limit and time estimate; its **Info** button opens a dialog with current happiness, capacity tiers, selection instructions, and harvesting details. Yellow stripes mark candidates and green stripes mark selected fields. At the limit, remaining ripe fields turn red; deselecting below the limit turns those candidates yellow again.
- Multi-field harvesting starts with empty hands. The farmer visits each field and harvests for **10 seconds per field plus travel**, accumulating **2 barley per field** in his hands (up to **8, 12, or 16 barley**, according to the batch's limit). The carried-item chip updates after each harvest. After the final field, he automatically walks to a completed, reachable granary and deposits as much as fits on arrival. If barley remains and the farm has space, he continues to the farm and deposits what fits there. Any remaining surplus stays in his hands at the final delivery stop until the player chooses another action; he does not automatically continue to the warehouse. Capacity is checked again on each arrival. If no granary is available, he keeps the harvested barley. Both delivery legs are saved on the server and continue while away; animation callbacks cannot deposit early or twice. Stopping during a field finishes that field and delivers the barley already harvested.
- The whole harvest queue continues while the tab is hidden or closed, using server deadlines for travel and each field. Returning catches up completed harvests and resumes unfinished work with its remaining time. Harvested barley and achievement counts are credited once; its expiry starts at the first completed harvest, not when the player returns. **Stop after this field** also remains effective while away.
- The server locks the harvest limit using current happiness when the batch starts. Later happiness changes, including while offline, do not shrink or expand that accepted batch or discard carried barley. Existing saved batches keep their original four-field limit. Harvest batches survive reloads and continue offline. **Stop after this field** finishes the active harvest and keeps its barley carried, leaving the remaining fields untouched. Other farmer tasks are blocked during the batch.
- The farm stores 5 barley. The completed granary stores 15 barley before level 7, then automatically increases to 20 at level 7, with no rebuilding or extra cost. The warehouse adds another 20 barley, for 45 total storage at level 8 once constructed. Only one granary and one warehouse can be built.
- The brewery's barley supply is separate from general storage and cannot be used as a substitute granary.

## Date palms (level 9)

- Click empty, river-irrigated arable ground and choose **Plant date palm**. Each permanent, one-tile palm costs **25 shekels**, with an initial maximum of **2 palms**. The farmer needs empty hands and no other task underway. Planting takes 10 seconds plus travel; payment and the accepted job are saved immediately.
- The sapling takes **24 hours after planting** to mature; its first **2 baskets of dates** are ready at that point. After harvesting, the same tree takes **12 hours** to ripen its next 2 baskets. Replanting is unnecessary. Unpicked ripe fruit waits without spoiling and does not accumulate additional batches. A basket, not an individual date, is the inventory unit; the dates-basket sprite represents it.
- The popup shows maturity/ripening progress and remaining time. Saplings, bare palms and fruiting palms use distinct sprites.
- Harvest **one palm at a time**, taking 10 seconds plus travel and automatic delivery to the **warehouse only**. Each harvest collects exactly **2 baskets**, reserving both storage slots before starting. A completed, reachable warehouse with at least 2 free slots is required. With fewer than 2 free slots—including when there is only one—the button is disabled and reads **No storage space**; the server also rejects the action. There are no partial harvests, multi-palm queues or happiness-based barley field limits for palms. Finish delivery before selecting another palm.
- The warehouse stores **5 baskets of dates**, separately from other goods. Neither the farm nor the granary stores dates. Resources shows baskets; only the warehouse popup shows their stock/capacity. There is no ground-dropping or manual storage step. Existing stock is preserved rather than truncated if it exceeds the new limit; consume it before harvesting again.
- Planting, growth, harvest and delivery continue while away. Saved server times, not animation completion, determine progress. Dates are credited once when the delivery arrives. Barley batch planting/harvesting and barley progression totals exclude palms.
- In **Manage estate → Farmer**, one stored basket of dates gives **+10 happiness**, capped at 100, with an independent **8-hour cooldown** (matching fish). It does not replace the automatic barley meal and does not count as feeding fish.
- Dates trading, sale prices, date recipes, and automatic porter harvesting are **not implemented**. Existing level-9 entry requirements are unchanged.

## Buildings

### Destroying buildings

- In the isometric farm, a completed player-built building's popup offers **Destroy the building** when demolition is safe. The starting farm cannot be destroyed.
- A confirmation dialog asks **Are you sure you want to destroy [building name]?** Cancel leaves everything unchanged. Confirming removes the building immediately, frees its footprint/loading tile, and returns no construction materials or upgrade payments. Rebuilding requires paying the normal costs again.
- Granaries and warehouses must contain zero barley. Uncollected finished goods must be collected first. Buildings under construction or upgrade cannot be destroyed; active farming/production work and deliveries must finish first.
- Warehouse removal must not reduce capacity below existing shared stocks. All dates must be used or removed first if this is the only warehouse. No stored inventory is silently discarded.
- Unused supplies inside an idle brewery are lost with it. Destroying a shrine ends its blessing. Both losses are stated in the confirmation dialog.
- The server checks ownership, the latest farm version, storage and work state again on confirmation. The initial farm and other players' buildings cannot be removed through the API.
- Granaries, mills, bread ovens and breweries can be built through Manage → Build in the isometric farm, paying the full construction cost. The mill unlocks at level 5, occupies 2×2 tiles and costs 2 reed and 4 clay; construction takes 2 minutes. The brewery unlocks at level 6, occupies 2×2 non-arable tiles and costs 4 reed, 6 clay and 2 stored brewing jars (not empty beer jars); construction takes 3 minutes. Its button checks materials, farmer availability and existing ownership like the bread oven. Choose a green placement beside a completed connected road, then confirm. Cancelling placement spends nothing. The farmer walks to the loading tile and works with his pickaxe; the saved construction timer continues after reloading. Brewery production controls and active artwork in the isometric view remain a separate migration step; other building placement remains planned.

Buildings occupy a 2 × 2 footprint, except the Small shrine (1 × 1). All require suitable free space.

Every player-built building, including the shrine, must border a completed road connected to the main road and have a free loading tile. Diagonal contact, disconnected road fragments, and unfinished roads do not qualify. Placement previews turn red whenever any requirement is unmet, including missing road access. This is the default rule for future buildings unless an explicit exception is introduced.

| Building | Materials | Construction time | Availability |
| --- | --- | --- | --- |
| Granary | 2 reeds + 3 clay | 2 minutes | Level 2; maximum 1 |
| Mill | 2 reeds + 4 clay | 2 minutes | Level 5 |
| Brewery | 4 reeds + 6 clay + 2 brewing jars | 3 minutes | Level 6 |
| Bread Oven | 4 reeds + 6 clay + 2 baking tools (6 shekels each at the NPC Baking market) | 3 minutes | Level 6 |
| Small shrine (1×1) | 2 reeds + 4 clay | 2 minutes | Level 8; maximum 1 |
| Warehouse | 4 reeds + 6 clay | 3 minutes | Level 8; maximum 1 |

Storage bonuses and completed-building milestones apply only after construction finishes. Reeds and clay each take 10 seconds to gather.

Every building under construction shows a small blue progress bar at the bottom of its footprint. The filled portion shows elapsed construction time and the unfilled portion shows the time remaining. It uses saved construction timestamps, resumes correctly after reloads, stays behind the farmer, and disappears when construction finishes.

### Production building upgrades

Building levels are separate from estate levels. The Mill, Bread Oven and Brewery support building levels 1–3. Existing buildings without upgrade history and newly built buildings start at building level 1.

| Building | Estate level required for building level 2 | Estate level required for building level 3 |
|---|---:|---:|
| Mill | 8 | 10 |
| Bread Oven | 9 | 11 |
| Brewery | 9 | 11 |

Estate progression currently stops at level 9, making level-2 bread oven and brewery upgrades available. Level-3 building upgrades remain locked in normal play until estate levels 10–11 and their requirements are implemented. Previously purchased mill upgrades, including upgrades already in progress, are retained regardless of the new gates.

| Mill level | Upgrade price | Upgrade time | Farmer batch | Donkey batch |
|---|---:|---:|---:|---:|
| 1 | — | — | 5 minutes | 15 minutes |
| 2 | 100 shekels | 5 minutes | 4m 15s | 12m 45s |
| 3 | 200 additional shekels | 10 minutes | 3m 30s | 10m 30s |

All three buildings use the same upgrade prices and times above. Level 2 reduces base production time by 15%; level 3 reduces it by 30%, not cumulatively. Bread baking takes 5m / 4m 15s / 3m 30s, and beer brewing takes 15m / 12m 45s / 10m 30s at building levels 1/2/3.

Upgrade sequentially, with one building upgrade per estate at a time. Pay upfront; the farmer remains available. Finish the building's current production before upgrading. During an upgrade no new production can start there; finished goods can still be collected. Ingredients and output quantities are unchanged. The footprint and road access are unchanged.

Each production building popup shows its current level and an upgrade button, disabled when requirements or funds are missing. Locked upgrades show the required estate level. During an upgrade it shows construction progress and remaining time instead of production controls. Upgrades persist through reloads and finish offline; improved production times apply only to jobs started after completion. Level 3 is the current maximum. Storage-building upgrades remain planned.

### Estate storage and warehouse

Bread baskets and finished beer jars show a disabled **No storage space** button when their resource's total estate storage is full, including capacity reserved for porter deliveries. If any space remains, **Store** stays available for a partial collection, subject to the farmer being available.

The same rule applies to flour and groats at the mill. For mixed stacks, **Store** remains available if either resource present can fit; it shows **No storage space** only when none of the available bags can be stored.

The warehouse uses four free non-arable ground tiles (2×2) and a connected road, just like other large buildings. It replaces the second granary unlock. Existing second granaries convert in place, retaining their barley and construction progress.

| Resource | Before warehouse | With completed warehouse |
| --- | --- | --- |
| Bread, beer, flour, groats | 10 each | 20 each |
| Reed, clay | 6 each | 16 each |
| Barley (at level 7+, including completed granary) | 25 total | 45 total |
| Fish | 5 | 5 |
| Baskets of dates (level 9) | 0 | 5 |

Each resource has its own limit: bread never uses flour or material space. Equipment and empty jars remain separate. Existing stock above a new limit is preserved; use or sell it before adding more.

Resources shows one usable stored total per resource, without capacities or location breakdowns. Barley combines the farm, completed granary and completed warehouse; carried barley, ground bundles, production reservations and uncollected output are excluded.

Farm and warehouse popups use matching compact stock/capacity tables: bread, beer, flour and groats in one; barley, reed and clay in the other. Fish appears only at the farm from level 4; date baskets join the warehouse's second table from level 9, with capacity 5 and no farm allocation. Barley uses each building's persisted stock. Other shared goods are allocated warehouse-first (10 slots per resource), with the remainder at the farm. Spending shared goods reduces farm overflow first; no manual transfers are needed. An unfinished warehouse holds none of these shared goods. Existing over-cap stocks remain visible rather than being truncated. The warehouse popup is read-only; the farm retains contextual delivery actions.

Storage deliveries animate visits to available buildings in this order: barley goes to the granary, then warehouse, then farm; flour, groats, bread, beer, reed and clay go to the warehouse, then farm. Only completed buildings contribute storage. Split loads continue to the next building, with remaining production cargo retained between stops and across reloads. Fish remains farm-only. References below to delivering goods to the farm mean estate storage, using these priorities.

Starting a reed or clay gathering action reserves one storage slot for that material during gathering. Gathering is unavailable when no unreserved storage slot is free. Gathering completes from saved time even while away, leaves one material in the farmer's hands, and releases the reservation; it does not credit inventory automatically. In the isometric farm, click riverbank reeds to **Collect reeds**, or empty ground immediately above the river to **Collect clay**. The farmer approaches the source and uses harvesting movements for reeds or the pickaxe for clay. Once finished, select any empty ground tile (arable or non-arable) to **Drop reeds** or **Drop clay**; he walks there before the visual drop. Materials can be picked up again, and dropped piles count toward construction materials. Material drops never expire and cannot occupy water, roads, crops, canals, scenery, buildings or another ground item, or lie outside the map. Barley drops still require arable ground. Resources shows only the stored total, without an outside counter. Construction consumes stored materials first, then ground piles. All current buildings, including the warehouse, fit within the initial 6-reed and 6-clay limits. The old flat interface still directs a deposit after gathering; isometric gathering leaves the drop decision to the player.

When all material storage slots are occupied or reserved, the ground popup disables clay collection and displays **Clay storage is full**, and the river-reeds popup disables reed collection and displays **Reed storage is full**. Each check uses that resource's independent capacity, including completed warehouse capacity.

The farm remains the delivery point for materials and processed goods after building a warehouse. Finished products stay at their building until collected. Collection takes only what fits in the relevant resource's storage; remaining goods keep their sprite and chip. If space changes during delivery, excess goods return to the building's pending stock. Market purchases and listing returns also require storage space.

To clear unwanted materials from ground tiles, click a dropped reed bundle or clay pile and choose **Destroy reeds** or **Destroy clay** in its popup. This immediately and permanently removes one unit, with no refund or transfer into storage; the pile disappears when empty. Resource totals update accordingly. Other piles and separately stored or carried materials are not removed. River reed plants are not destroyed by this action.

In the isometric map, **Collect clay** is offered only on empty non-arable
riverbank ground, not on arable tiles beside the river.

## Farmer happiness and feeding

While the farmer is busy, clicking tiles still shows their normal descriptions, stocks and progress. All tile-popup action buttons and production selectors are hidden. The popup close button remains visible and usable. Actions reappear with their normal availability when the farmer finishes; independent donkey and porter work does not itself make the farmer busy.

Click the farmer to see happiness and the next-ration indicator. Hunger and happiness are related but separate: a treat improves happiness without replacing a barley ration.

During empty-handed travel the farmer uses a walking sprite and returns to his standing pose when movement finishes. He faces left or right to match his travel direction, keeping his last facing direction when moving vertically or stopping. Carrying, fishing, and work actions retain their specialized poses.

### Mood tiers

| Happiness | Mood |
| --- | --- |
| 70–100 | Happy |
| 40–69 | Content |
| 0–39 | Unhappy |

Happiness cannot exceed 100 or fall below 0.

### Levels 1–3: introductory protection

- Happiness cannot fall below **70 (Happy)**.
- Happiness above 70 can still decay, but stops at the protected floor.
- Barley shortages do not lower happiness or slow the farmer during these levels.
- Automatic barley feeding continues normally; protection does not make food free.
- Existing introductory farms below 70 are restored to the floor when their state next refreshes.

### Level 4 onward: normal happiness management

Normal decay begins when level 4 unlocks fishing. The happiness clock starts fresh at that claim; time spent in the protected levels does not create a penalty afterward.

Manage estate has a Farmer tab with Happiness and Next meal round meters, mood and meal guidance, and fish/bread/beer/dates treat actions. Fish unlocks at level 4; bread and beer at level 6; dates at level 9. Treats require stock, happiness below 100%, and their independent cooldowns to be complete. Cooldown buttons remain visible even when stock is empty. Resources is a read-only inventory grouped by type, with no feeding controls.

In the isometric farm, **Manage** at the top right opens the estate drawer with
Resources and Farmer controls. The Build tab previews the granary, mill, brewery, bread oven, warehouse and small shrine with
their artwork, descriptions, material requirements and level locks. Building
placement is available for the granary; other Build buttons remain disabled pending migration.
The isometric interface contains no links or selector option to switch
to the flat farm.

Granary building-placement interface: a green building and footprint
indicate a valid location, red indicates a blocked location, and yellow marks the
loading tile. This presentation has been tested; the temporary test button has
been removed. Choose a location, then confirm **Build granary**. Construction costs
2 reed and 3 clay and takes 2 minutes, continuing while away or after a reload.
Normal level, material, ownership and farmer-availability requirements apply.
Cancel or Escape exits placement without spending materials.

- Above 50, happiness loses 1 point every **12 minutes**.
- At or below 50, it loses 1 point every **6 hours**.
- Without food or treats changing the score, 100 drops to 50 in 10 hours, then to 49 after another 6 hours.
- Decay continues while offline. Refreshing or reopening the game does not restart the clock.
- An Unhappy farmer walks at 90% of normal speed. Hunger makes movement take 1.75 times as long. If both apply, only the stronger slowdown is used; they do not multiply together.

### Automatic barley rations

- After cultivation begins, the farmer automatically needs **1 stored barley every 24 hours**.
- Rations use barley in the farm or completed granaries, not ground bundles, carried barley, or brewery supplies.
- A consumed ration adds **10 happiness**, capped at 100.
- Without stored barley, the farmer becomes hungry. Missed rations do not build up a debt that must all be repaid later.
- From level 4, a food shortage can lower happiness to 50, but the shortage itself cannot lower it further or create an Unhappy mood. Independent natural decay can still take happiness below that point over time.
- Feeding does not instantly erase all lost happiness; it adds its normal boost.

Treat buttons show “The farmer is busy” when clicked during farmer work, without spending a treat. Feedback appears beside the corresponding treat. When no fish are stored, the fish button reads “No fish available”; an active cooldown still takes priority.

### Farmer treats

| Treat | Happiness boost | Cooldown after giving it | First available |
| --- | --- | --- | --- |
| 1 stored fish | +10 | 8 hours | Level 4 |
| 1 beer | +15 | 12 hours | Level 6, once beer is available |
| 1 bread | +15 | 6 hours | Level 6, stored bread |
| 1 basket of dates | +10 | 8 hours | Level 9 |

- Fish, beer, bread and dates have **independent cooldowns**. Giving one does not delay the others.
- The first fish treat has no initial waiting period. Its cooldown begins when you actually give a fish.
- Treats are consumed when given and never raise happiness above 100. At full happiness or during a cooldown, the action does not consume goods.
- Treats do not remove hunger or reset the automatic barley-ration schedule.
- Give stored treats through the Farmer tab. The brewery also supports giving beer, including beer from a ready batch.
- During a cooldown, the button displays the remaining wait time.

### Market leaderboard

Switch between **Your neighbourhood** and **All Sumer** using the two tabs at the top, styled like the market Buy/Sell tabs. The **Rank by** selector and Refresh button apply to the selected tab; switching tabs retains the chosen ranking metric.

The signpost to the right of the beer stand opens the leaderboard once you can enter the market (level 3). Choose **Your neighbourhood** or **All Sumer**, then rank by estate level, available shekels (excluding market-order reservations), or lifetime barley harvested. Harvesting counts barley earned from fields, not purchases or current stock; spending or donating goods does not reduce that total.

Each view shows up to ten named farmers with a saved neighbourhood, including offline members, with their portrait, farmer name, city and neighbourhood. Private neighbourhood members can appear globally, but invitation codes and account names are never shown. Your row is highlighted; if outside the top ten, your own rank is shown below. Equal scores share a competition rank (1, 1, 3); a stable internal ordering limits ties at the cutoff to ten displayed farmers.

Rankings use the latest saved server progress when opened, changed or refreshed; they are not a live feed. Unreconciled offline work appears after the farm next updates. Opening the board does not advance anyone's farm. There are no ranking rewards, seasons or combined prosperity score yet. The current development-player limitation still applies; this is not production authentication.

## Fishing

- Fishing messages and **Stop fishing** use the shared lower action container. The marked area is red while preparing or cooling down, and green when ready to cast. Short countdowns show the fish's approach and the retry cooldown; clicks outside the area prompt you to tap inside it. Reduced-motion settings do not prevent fishing from becoming ready.

- The isometric river is two rows wide, extended one row south. The farm-side bank, farmland and irrigation connections remain unchanged. The ambient fish gently swims north and south between both rows while roaming east and west, staying inside the banks.

- Isometric fishing: from level 4, **Go fishing** on either river row walks the empty-handed farmer to the nearest reachable farm-side bank tile to the selected water. He casts once on arrival; the fish swims into the marked area. Once it arrives, tap ahead of the fish in that area to cast, or use arrow keys to aim and Space to cast. Each attempt animates the rod, including retries after a miss. The existing server rules decide catches after 0.4 seconds and enforce the 2-second retry cooldown. A catch ends fishing and leaves the farmer visibly holding 1 fish. Click the farm to **Store fish**, or the river to **Release fish**; he walks there to deliver it. **Stop fishing** cancels without a catch. Reloading restores an active session without replaying the arrival cast. River tiles stay opaque and the fish stays at 75% opacity.

- Fishing unlocks at level 4. Click the river with the farmer's hands empty and choose **Go fishing**.
- Before level 4, the Fish treat block in the Farmer tab uses the disabled-button colours and shows its unlock level. It returns to its normal colours when unlocked.
- Resources shows usable stored totals. The farm popup shows its own quantities/capacities; contextual fish-delivery controls also show available fish space.
- The farmer walks to the river. Aim ahead of the moving fish and click/tap to cast; keyboard controls use arrow keys to aim and Space to cast.
- The cast lands after 400 milliseconds. There is a 2-second recovery between casts. Missing costs no resources.
- Fish change direction and speed. Catching is an active minigame, not a guaranteed completion timer.
- A successful catch gives the farmer 1 fish and ends the session. Bring it to the farm to store it, or release it at the river.
- A carried fish cannot be dropped on the ground or delivered to the granary or brewery. Store or release it before other physical work.
- The farm holds up to **5 fish**, separately from barley storage.
- Fishing does not catch fish automatically while you are away. Stored fish currently do not spoil and cannot be sold or withdrawn.

## Milling barley

Production times in the milling, brewing and baking descriptions below are for building level 1. Completed building upgrades reduce those times as listed under **Production building upgrades**; batch inputs and outputs stay the same.

**Production never waits for animations.** Once the server accepts a production
action, it immediately reserves/consumes the ingredients and saves its schedule.
Manual milling and baking include the time to walk the saved supply route at normal
walking speed (including the farmer's happiness/hunger modifier at departure). Donkey milling also includes fetching and leading the donkey to
the Mill. Recipe time starts at the saved arrival time, without an extra wait.
Already-supplied breweries start immediately. Switching tabs, closing the game or
reloading does not pause an accepted job: returning shows the elapsed progress or
finished goods, without waiting for missed animations. The farmer is occupied
during preparation; donkey milling releases him automatically once the supply trip ends.
The oven and mill remain visually idle during preparation. Their busy sprites and
production bars appear after the farmer/donkey arrival is shown or reconciled to
the building when catching up. This visual transition never delays saved production.
Wait for confirmation that the job was saved; rejected or unsent requests cannot
start offline.

### Manual milling

Flour and groats each reserve their own estate storage space. Stored stock,
finished bags waiting across all mills, bags being delivered by the farmer or
porter, and the full output of an accepted milling job together cannot exceed
**10 per resource with the farm alone**, or **20 with a completed warehouse**.
For example, 3 stored flour leave room for at most 7 flour bags outside storage;
groats have a separate allowance. A new batch requires room for its entire output
(1 bag with the farmer, 3 with the donkey). Unavailable recipe buttons are hidden.
Market purchases and cancelled sale listings cannot take these reserved spaces,
and warehouse removal cannot strand reserved mill goods. Collecting bags moves
their reservation into storage rather than freeing space; using or selling stored
goods frees space. Existing saves above the limit retain their goods, but cannot
produce or buy more of that resource until enough space is available.

In the isometric farm, a completed mill offers **Make flour**, followed by
**Make groats**, when the farmer is available and empty-handed. If combined
completed storage has fewer than 2 barley, both are replaced by the disabled
**You don't have enough barley** button. The saved trip visits stocked granaries
before farm storage when topping up. On arrival, the farmer pushes the lever and
a small progress bar shows milling progress. Finished batches display the existing
bag sprite with their total count; the popup lists flour and groats separately.
Click the bags to highlight their silhouette with a warm yellow outline and choose **Store**.
Selected barley bundles, reeds and clay lying on the ground use the same yellow
silhouette outline instead of highlighting the tile underneath.
The farmer walks empty-handed to the mill's loading tile, collects the bags,
then carries them to storage and faces the building while unloading. With only
the farm available, he delivers there. Existing warehouse-first storage allocation
is preserved when a warehouse exists, with a farm stop for any remaining bags.
An interrupted delivery remains saved; **Store bags** in the farmer or farm popup
resumes it. Pending bags become usable inventory only when delivered.

The Mill unlocks at level 5 and occupies 2×2 tiles. Each milling job consumes 2 barley and produces either 1 Flour or 1 Brewer's Groats after 5 minutes, plus preparation. The farmer visually visits a completed granary with barley by preference, otherwise the farm if it has barley, then carries the barley to the Mill. If the granary has too little barley, the farmer collects what it has and then visits the farm for the remainder before going to the Mill. Barley is deducted when the server accepts the job: carried barley first, then completed granaries or warehouses, then farm storage. Carrying one barley means only one additional barley is taken from storage. If both required barley are already carried and storage is empty, the farmer goes straight to the Mill. Exposed ground barley must be picked up or stored first. Both outputs wait at the Mill until collected and delivered to the farm building.

Choose one recipe per job. The farmer walks to the Mill, then works inside it for the entire job. The busy Mill sprite indicates occupied labour: other farmer-dependent tasks, market visits, and fetch are unavailable until completion. Milling persists across reloads and completes while offline. Finished Flour and Brewer's Groats accumulate separately in a shared bag stack over the Mill's bottom-left footprint tile, with a chip showing the total count. Click the stack and choose **Store**: with empty hands, the farmer collects the bags that fit in storage and delivers them to the farm building, just like finished bread and beer. Remaining bags stay at the Mill. No granary is required. Only on delivery are the goods added to Resources and available for level offerings, trading, or production. Further batches can be made before collecting. Delivery survives reloads and uses each resource's independent estate capacity, not barley storage. Flour and groats are traded at their respective markets; baking and brewing unlock at level 6.

## Brewing beer

Brewing unlocks at level 6 and consumes Brewer's Groats rather than raw barley.

**Recipe:** 2 stored Brewer's Groats + 2 water loads + 2 empty beer jars → 2 filled beer jars in **15 minutes**. Groats are deducted from estate inventory when brewing starts.

- Deliver water, stock jars, and start the batch through the brewery popup. Groats come directly from estate inventory.
- Each brewery can hold at most 2 water loads and 10 empty beer jars.
- Brewing jars are permanent brewing equipment used to construct the brewery, not the empty packaging jars consumed for every batch.
- Collect finished beer into estate inventory before starting another batch. Beer served directly from the ready batch reduces the amount left to collect.
- The brewing timer disappearing is the visual cue that the batch is ready; there is no floating “Beer ready” label.
- Filled beer in estate inventory can be given to the farmer, sold once beer trading unlocks, or used in merchant requests once those unlock.

## Donkey-powered milling (level 7)

- Buy one donkey for **30 shekels** in the baking stand's **NPC Buy** tab. Ownership is permanent; donkeys cannot be sold or listed in the player market. Each farm can own at most one.
- After purchase the donkey waits beside the farmer in the market and follows him along the road when returning home. On the farm it grazes between free non-arable tiles, avoiding the river, buildings, objects, and goods. It rests for 30 seconds before its first grazing move and after each move finishes.
- Manual milling remains available. **Use donkey · Flour** and **Use donkey · Brewer's Groats** each process **6 barley into 3 bags in 15 minutes**. This triples batch size and duration, not output per minute or yield per barley.
- The farmer fetches the donkey, leads it to the mill, then collects barley from storage and delivers it. The donkey disappears inside the mill and the donkey-powered mill sprite shows production in progress.
- While being led to the mill, the donkey trails slightly behind on the same route: behind horizontally, above the farmer when walking down, and below him when walking up. This spacing is visual only and does not change production timing.
- If milling finishes while you are watching the farm, the donkey walks back along its escort route to its resting tile. If it finishes while you are away, it appears at rest when you return, without replaying the journey. Production never waits for this animation.
- Once the saved preparation route ends, the farmer is free for other work, including baking or visiting the market, even if the trip animation was paused or skipped. Only one milling job (including preparation) can run at a time.
- Ownership and active jobs survive reloads. The donkey returns to grazing when its job finishes. Finished bags still wait over the mill's bottom-left footprint tile and must be collected and delivered to the farm before becoming usable resources.

## Baking bread

The Bread Oven unlocks at level 6. Each batch uses **2 stored Flour → 2 Bread in 5 minutes**.
The farmer visually collects flour from the farm building and carries it to the oven. Flour is deducted
when the job is accepted, and baking starts when the saved supply route reaches the oven. The farmer disappears inside and stays occupied
for the entire batch: other physical tasks, market visits, and fetch are unavailable. The oven
uses its busy sprite and shows production progress, returning to its idle sprite when finished.
The job persists across reloads and completes while offline.

Finished bread appears as a basket with a count over the bottom-left tile of the oven, while the farmer
reappears outside the building. Click the basket and choose **Store**
to collect and deliver it to the farm. Bread is added to Resources only upon delivery.

Unlike baking, **15-minute beer brewing does not occupy the farmer**. Start beer first, then bake
or perform other tasks while it brews.

## Markets and shekels

The small signpost on the ground immediately right of the beer stand opens the **Leaderboard** with neighbourhood/global rankings (see Market leaderboard above). Leaving the market closes the dialog. Ranking rewards are not implemented.

The market is a shared neighbourhood social space. Neighbours visiting at the same time appear with their farmer names and walk along the roads as they visit stands. Only visitors from your own neighbourhood appear, including private neighbourhoods; offline players are not simulated. Updates have a small network delay. Returning to the farm or hiding/closing the tab removes the visitor; a lost connection expires within about 15 seconds. Multiple tabs do not create duplicate farmers. Presence does not change inventories, prices or the scope of trading. This currently uses the game's development identities; production authentication remains future work.

### Hired porter

- A newly hired porter starts on the road beside the market building. Reloading preserves his saved position or current delivery instead of adding an extra market approach.
- The porter stands and walks at the same height on roads as the farmer.
- The porter is drawn in front of building sprites and the level signpost, including its number.
- Moving farmers and porters may pass through each other without waiting. Only when both stop and overlap does one move to a free neighbouring road tile, at the normal road walking height. The worker already standing there moves when possible and stays in his new position until his next task. Characters never step upward onto building sprites to make room; if no safe neighbouring road tile exists, they stay put. This visual separation does not spend goods or alter production timers.
- The porter uses the farmer's normal walking pace, including the approach from the market. Hunger and happiness slowdowns remain specific to the farmer.

- From level 5, hire a porter through **Manage estate → Farmer** for **20 shekels paid upfront**, covering **24 real-world hours**. Hiring works while the farmer is busy. There is no automatic renewal or additional charge; the remaining hire time is shown in the panel.
- He automatically collects finished flour, groats, bread and beer, including existing output when hired. He does not harvest, gather materials, handle fish or take items from the farmer's hands. He works independently and does not change happiness or harvest limits.
- He walks to each producer's loading point, then delivers to the completed warehouse first and farm second. Each trip carries one product type to one destination; overflow waits for another trip. He uses `porter-idle.png` while waiting or approaching goods and `porter-busy.png` while carrying them.
- Booking a trip reserves its goods and storage slots. The farmer cannot collect those same goods, and purchases or other deliveries cannot consume the reserved capacity. Goods become usable only on arrival. When storage is full, the porter waits and automatically tries again after space becomes available.
- Trips, hire expiry and production completion use saved timestamps. Collection continues while away and catches up on return, including products that finished during the hire. Nothing that first becomes ready after the hire expires is booked. A trip booked before expiry finishes even after expiry; no further trips start.
- Hire fees are recorded in transaction history. Payment and hiring are atomic, and retrying the same hire cannot charge twice. Only one porter can be hired at a time; renewal is available after the hire and any last delivery finish. Manual collection remains free.

The farmer must unload carried items before entering the market scene. This includes
processed-grain deliveries and barley being carried to the Mill. Clicking the market
while carrying goods keeps the farmer on the farm and shows “Unload your items before
going to the market.” in the bottom message bubble. Stored inventory does not block entry.

- Market entry unlocks at **level 3**. Before then, clicking the building keeps you on the farm and shows the unlock message. The ground-barley Sell button is also disabled before level 3.
- The barley stand handles barley. The beer stand handles beer and NPC brewing supplies. The baking stand handles bread, using `market-bread-stand.png`.
- Click an unlocked stand to walk along the market roads to its stopping point; the trade dialog opens on arrival. Clicking another stand while walking changes the destination after the current step. Returning to the farm also follows the roads. Locked stands show their unlock message without starting a trip.
- Buying or selling filled beer and bread in either NPC or player markets unlocks at **level 6**, matching Brewery and Bread Oven construction. This includes buying player listings and creating sell listings. Reaching the level is sufficient; owning the building is not required. The API enforces the same item-level restriction as the interface.

### NPC prices

Sale quantity controls stop at the currently available stored stock, for both NPC
sales and player-market listings. You can still lower the quantity at the limit.
With no stock, both the quantity control and sale button are disabled. Stock
updates automatically cap an existing selection; carried or uncollected goods
do not increase the sale limit.

Prices below are from the player's perspective.

| Item | Buy from NPC | Sell to NPC |
| --- | --- | --- |
| Barley | 2 shekels each | 1 shekel each |
| Brewing jar | 6 shekels each | Not available |
| Empty beer jar | 2 shekels each | Not available |
| Filled beer jar | 8 shekels each | 8 shekels each |
| Flour / Brewer's Groats | 4 shekels each | 3 shekels each |
| Bread | 5 shekels each | 5 shekels each |
| Mill donkey (level 7, one per farm) | 30 shekels | Not available |

The brewing-jar purchase section is hidden when the player already has the two required jars; buying extras beyond the current requirement is not allowed. Empty beer jars and filled beer jars are bought from the beer stand's NPC Buy tab. Filled beer purchases unlock at level 6 and go directly into estate inventory, without using barley storage or counting as beer produced.

Players can also list barley, filled beer and bread for other players to buy. Listings are not completed sales until someone purchases them. Bread and beer share a five-shekel initial suggested listing price; players choose their own asking prices and market suggestions respond to listings. Only bread already delivered to estate inventory can be sold or listed, not baskets waiting at the oven or in transit. Bread does not use barley storage. Brewing equipment and empty jars are not available for player listings in this version.

The ground-barley Sell button is currently a placeholder, not a working shortcut. Use the barley market for actual sales after unlocking it.

Market stand dialogs cannot open before their unlock level. The barley stand opens at level 3; the beer and baking stands open at level 5 for groats and flour trading. Finished beer, bread, and their production supplies remain unavailable until level 6 in all Buy/Sell tabs. Each stand has NPC and player-market Buy/Sell tabs scoped to its goods. Clicking a locked stand shows its unlock level in the white communication bubble at the bottom of the canvas instead of opening its dialog. The stand's label stays unchanged.

Market goods show their unit price, your available stock and shekels, and a live preview of balances after the selected transaction. Stored tradable stock excludes goods already reserved or carried. NPC purchases add stock and spend shekels; sales subtract stock and earn shekels. Player listings reserve stock immediately but earn nothing until sold, so their preview distinguishes listing creation from potential proceeds. Player purchases preview each listing's actual price. Previews do not bypass stock, storage, funds or unlock validation.

Clicking the estate's market building makes the farmer walk to the road tile beside it before entering the market scene. Clicking the farm building in the market likewise waits for arrival at its adjacent road entrance before returning home. Scene changes are based on arrival, not a fixed timer; a blocked route does not transport the farmer.

In the isometric preview, click the market building and choose **Go to the market**.
The farmer walks there before the scene changes. The market currently contains
a main road that splits into a walkable rectangular loop, a farm building at its left end and decorative barley,
beer and baking stands, each with a stationary placeholder merchant in front beside the road.
The baking stand sits inside the loop beside the lower road, with space for one more future stand.
Merchants stay beside their stands and turn left or right towards a nearby farmer
after a short pause. They hold their direction when he is directly in front of
them or far away; this is visual only and does not affect trading.
Approaching a merchant within three tiles reveals a short greeting above the nearest
merchant for four seconds. Only one bubble appears at a time; each merchant has an
independent eight-second cooldown and requires leaving and approaching again to repeat.
Approaching a different merchant replaces the previous bubble without waiting for
the previous merchant's cooldown.
Opening a trading dialog dismisses the greeting. These greetings do not change
stand unlock levels or interrupt walking.
Click the barley, baking or beer stand, or its merchant, to walk along the road
to the tile in front of that merchant. The farmer stops and faces him before the
same NPC/player Buy/Sell dialog used in the flat market opens. Clicking another
stand redirects the walk; clicking a road tile cancels the pending interaction.
Existing prices, storage limits, listing
rules and the one-barley reserve still apply. Baking opens at level 5 for flour;
bread and baking tools unlock at level 6, and the donkey at level 7, as in the flat
market. The beer stand opens at level 5 for brewer's groats, with beer and brewing
supplies available at level 6. Below level 5, baking and beer popups show their
unlock level instead. Click the farm building
and choose **Go back to the farm** to return after walking to its entrance.
Market entry still requires level 3, an available farmer and empty hands. Farm
timers continue while visiting. Isometric neighbour visibility is not implemented
yet; use the flat market for that feature.

## Traveling merchant requests

- Merchant requests unlock at level 7 and are accessed through the chariot on the estate road, not through the market stands.
- The chariot takes 15 seconds to arrive, stops on the road immediately outside the arable plot's right edge, and offers three requests during a **24-hour window**. There is then a **48-hour break** before the next request window.
- Clicking a moving chariot only shows its name. Click while it is stopped to open requests.
- Each request can be fulfilled once per visit. The required goods are consumed and the shekel reward is granted together.
- Completing every request early does not bring the next visit forward. Missing a visit has no penalty, and missed requests do not accumulate.
- Deliveries use barley stored in the farm or completed granaries and beer collected into estate inventory. Ground goods, carried goods, brewing ingredients, uncollected beer, and goods committed to player listings do not count.
- The merchant currently offers requests only, not ordinary buying or selling.

With a completed brewery at the start of the window, the requests are:

| Customer | Delivery | Reward |
| --- | --- | --- |
| Neighbouring household | 3 barley | 5 shekels |
| Tavern keeper | 2 beer | 12 shekels |
| Feast organiser | 4 barley + 2 beer | 18 shekels |

A no-brewery fallback offers 3, 2, and 4 barley for 5, 3, and 6 shekels respectively. The request set is fixed for that visit. Normal level progression already requires a completed brewery before merchant requests unlock.

## Small shrine (level 8)

Build one **Small shrine** per farm at level 8. It occupies one empty non-arable ground tile beside a connected road, costs **2 reeds and 4 clay**, and takes **2 minutes** to build.

- Choose **Offer 2 bread** or **Offer 2 beer**. With empty hands, the farmer walks to the farm building, collects the chosen goods, and carries them to the shrine. The offering is charged and its blessing begins when delivery succeeds. Reloading before delivery cancels the uncharged trip; choose the offering again.
- The blessing slows natural happiness decay by **25% for 12 hours**, including time offline. It does not restore happiness, replace barley meals, prevent hunger, or change treat cooldowns.
- Only one blessing can be active. Further offerings are disabled until it expires; blessings cannot stack or be extended early.
- The shrine shows its offering sprite while blessed and its empty sprite after expiry. The shrine popup and Farmer tab show the remaining blessing time.

## Quick answers

Item-action popups are limited to five ground-tile widths, with text and button
labels wrapping inside them. On smaller screens they shrink to fit the viewport.
Full dialogs, such as the market and level requirements, use their own layouts.

**Why can't I claim a level even though I have enough offering goods?**
Every requirement must be met, including cumulative achievements and the spare-seed check. Check the signpost for the missing condition.

**Does leveling up automatically give me a granary?**
No. It unlocks construction. You must still gather the building materials and build it.

**Why does happiness stop at 70?**
Levels 1–3 protect the farmer while you learn. Normal happiness management begins with fishing at level 4.

**Can hunger alone make the farmer Unhappy?**
No. Its direct happiness penalty stops at Content. From level 4, independent natural decay can eventually produce an Unhappy mood.

**Does giving beer prevent me from giving fish?**
No. Their 24-hour and 8-hour cooldowns are separate.

**Can I progress while offline?**
Crop growth, brewing, construction, happiness, and merchant schedules use elapsed time. Fishing requires active play, and level claims require your button press.

## Isometric preview — barley planting and harvesting available

In **Isometric farm (preview)**, choose **Plant barley**, select the highlighted
irrigated fields, then confirm **Plant barley**. The usual seed costs, happiness-based
field limit and farmer availability apply. The farmer collects any needed stored
seeds, walks to each field and sows it. Accepted planting continues while away;
reloading shows the current saved progress, not a restarted animation.

Choose **Harvest barley**, select ripe fields and confirm. The same happiness-based
field limit and empty-hands requirement apply. The farmer walks between fields,
harvests each one and automatically takes the barley to a reachable completed
granary. Only what fits is deposited; if barley remains and the farm has room,
he continues there and stores what fits. Any further surplus remains in his hands.
If no granary is reachable, he stays at the final field with the harvest.
Accepted harvesting and delivery continue while away, without replaying completed
work on return.

Tap a tile or building for its popup. Crop popups start planting/harvest selection;
farm and storage popups show current stocks.
Once sowing or harvesting starts in the isometric view, its panel shows progress without a stop
button. You can still cancel field selection before starting.
Sowing and harvesting share the same work display: action name, completed fields
out of the selected total (excluding the current unfinished field), and a circular
percentage meter. Total work time is the per-field duration multiplied by the
selected total; walking is excluded. Harvesting switches to “Storing barley…”
during delivery, retaining the completed-field count and work meter.
Isometric tile popups show only actions currently available for the selected target,
without disabled alternatives or their blocker messages. A small pointer identifies
the selected tile; unavailable actions reappear when their conditions are met.
While carrying barley and idle, choose
**Store barley** from the farmer's own popup to deliver it. A reachable completed
granary with room for the whole load is preferred, then the farm. If neither fits
the whole load, he stores what fits (granary first) and retains the surplus.
He walks carrying the barley to the loading point, then deposits it. Storage and
carrying chips change together at the end of the delivery animation. Accepted
deposits are saved independently of animation and survive leaving/reloading.
If both stores are full, the farmer popup shows a disabled **No storage available**
button, an explicit exception to hiding unavailable popup actions. Warehouses are
not destinations for this shortcut.

A completed granary's popup also offers **Store barley** while the farmer is idle,
carrying barley, and that granary has space. This delivers to the selected granary
only, storing as much as fits and leaving any surplus in the farmer's hands.

While carrying barley and idle, choose
**Drop barley** on an empty arable tile to place one barley there, using the existing
ground-barley expiry rules. Repeat on another empty tile to unload more barley.
The farmer walks to that tile carrying the barley, makes the placing motion, then
the ground bundle appears and his carried count decreases by one. Any remaining
barley stays in his arms. The accepted drop is saved even if you leave or reload.
Choose **Pick up barley** on a ground bundle to collect one barley at a time,
up to the farmer's two-item carrying capacity. He must be idle and not carrying
another kind of good. Carried barley can be used for planting or dropped elsewhere;
picking it up does not reset its expiry. In the isometric view, the farmer walks
to the selected bundle at the normal pace, briefly reaches down, then carries it.
The bundle stays visible until that movement finishes. Accepted pickups are saved
independently of the animation; leaving or reloading never cancels the collection.
When the farmer is not carrying barley, clicks through his sprite select the tile
or building beneath it rather than opening an empty farmer popup.
**Walk here** on ground or crop tiles moves the farmer locally. He can cross crops
at any growth stage without damaging or harvesting them. Buildings, scenery and
water remain obstacles (completed road bridges allow canal crossings); drag to pan.
Other popup actions, including manual storage
transfers for goods other than carried barley, building construction, gathering,
production and trading, still use **Flat farm**.
**Build road** is available on suitable ground above the river next to the main
road or a completed branch. The farmer must be idle and empty-handed. Rocks and
bushes are cleared; reeds, crops, ground goods, buildings and canals block new roads.
Construction takes five seconds and continues while away. The progress marker
becomes a finished road, with neighbouring road tiles automatically choosing
straight, corner, T-junction or crossroads artwork. Road removal still uses **Flat farm**.
During road or canal construction, the farmer performs a pickaxe work animation
beside the tile. It follows the saved timer and never delays completion while away.
When starting a canal in the isometric view, he first walks to reachable ground
beside the construction site at his normal pace, then works from that position.
Travel is shown within the existing construction schedule, not added to its timer.
**Build irrigation canal** is available on suitable ground above the river, including
rocks and bushes that construction clears. Reeds, crops, ground goods, buildings,
loading tiles and existing roads block placement. Connect to the river or an
adjacent completed canal, with the farmer idle and empty-handed. Construction
takes five seconds, shows a trench/progress bar, and continues while away. On
completion the canal fills with water and eligible neighbouring fields can be planted.
Canal removal is not yet available in the isometric interface.

## Maintaining this reference

- Update the relevant sections whenever an implemented rule, requirement, price, timer, capacity, or unlock changes.
- Describe current behaviour in plain language. Keep planned systems explicitly marked as unavailable.
- Verify changes against the implementation and tests; if this document and the code disagree, resolve the discrepancy rather than silently presenting a planned rule as live.
- Keep technical implementation notes in `docs/`; this file is the consolidated player-facing explanation.

Implementation references: [progression](src/game-core/farm/progression.ts), [level unlocks](src/game-data/progression.ts), [happiness](src/game-core/farm/wellbeing.ts), [feeding and decay constants](src/game-data/household.ts), [crops](src/game-data/crops.ts), [buildings](src/game-data/buildings.ts), [storage](src/game-data/storage.ts), [brewing](src/game-data/brewing.ts), [fishing](src/game-data/fishing.ts), [NPC prices](src/game-data/marketItems.ts), and [merchant requests](src/game-data/npcRequests.ts).
