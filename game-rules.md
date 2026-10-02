# Game rules

This is the living, player-facing reference for the game's implemented rules. Use it when explaining the game, preparing help text, or answering players' questions. Planned features are listed separately and are not promises of currently available gameplay.

## Starting your farm

### Optional fetch game

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

- Start at **level 1 — First plot**, with a farm building, two barley bundles on the ground, empty inventory, and zero shekels.
- The estate has an 8 × 9 plot, extending one row toward the river. Buildings, roads, canals, and the level signpost occupy space that cannot also be planted.
- The road crosses the sixth row from the top. Irrigation canals can cross it using a bridge.
- The default farm sits immediately right of the level signpost, above the road. The farmer starts on the road at the farm entrance; farm deliveries use this entrance too. Keep this entrance clear of other buildings' loading points and canals.
- Click an empty ground or arable tile beside the main road or a player-built branch and choose **Build road**. Dirt roads are free and take five seconds of work after the farmer arrives. The server saves the completion time and reloading resumes unfinished work. Every new tile must share an edge with a completed road (diagonal contact is not enough). Roads stay within the farm map and cannot cross the river or replace fields, canals, buildings, scenery, or ground items.
- New buildings must border a road and reserve one exclusive, unoccupied road tile as their loading point. Placement highlights this tile. Finished flour, groats, beer, and bread appear there until collected; loading points remain walkable. New canals cannot replace loading points or player-built roads.
- Finished goods keep their loading tile. When production completes, a farmer standing there is placed on the nearest free connected road tile before being shown. Collection also stops beside the goods instead of standing on the flour/groats bags, beer jars, or bread basket.
- The farmer prefers connected roads, including for deliveries, but can leave them to reach fields and existing buildings. Buildings from older saves remain usable without road access and retain their existing output-placement fallback.
- Barley is both a crop and its own seed: keep some for planting rather than consuming or selling everything.

## Farm levels

Click the signpost on the left side of the estate, immediately above the road, to see your current level and the next level's requirements.

The signpost displays the current farm level in gold. The number changes to a large golden **+** when the next level can be claimed, including the spare-seed safety check. After claiming, it shows the new level number (or **+** if the following level is already ready); if requirements are no longer met, it returns to the current level number.

The signpost tile is permanently reserved. No part of a building's footprint may overlap it, and fields or irrigation canals cannot be placed on it.

Leveling up is **manual**, not automatic. Meet every listed requirement, then press **Claim level**. The button stays disabled until the requirements and seed-safety check are satisfied. Required offerings are consumed when you claim the level, not while you are gathering them. Levels must be claimed in order.

### Playable levels

| Level reached | Requirements | Goods consumed on claim | Unlocks |
| --- | --- | --- | --- |
| 1 — First plot | Starting level | None | Irrigation, barley cultivation, farm storage |
| 2 — Grain keeper | Harvest at least 5 barley yourself; have 5 usable barley on the ground | 5 ground barley | First granary |
| 3 — Grain trader | Complete a granary; have 10 barley stored in granaries | 10 granary barley | Market entry and barley trading |
| 4 — River provider | Sell at least 5 barley; complete at least 50 lifetime crop harvests; have a full granary (15 barley), plus at least 1 unexpired ground barley or an already-planted barley field | 15 barley from the full granary | Fishing, fish storage, and normal happiness management |
| 5 — Caring household | Have 3 stored fish and 15 barley in completed granaries; have fed the farmer at least 1 fish; retain spare seed or an already-planted barley field | 3 stored fish and 15 granary barley | Mill and barley processing |
| 6 — Brewer or Baker? | Complete a Mill; harvest 100 crop plantings over your lifetime (double the level-4 target); process 4 barley into either output; hold 2 processed goods in any combination | 2 Flour or Brewer's Groats, combined (Flour used first) | Brewery, Bread Oven, brewing supplies, bread making, beer and bread trading |
| 7 — Trusted supplier | During level 6, produce at least 15 bread or beer combined and sell at least 10 bread or beer combined | None | Merchant requests, 20-barley capacity per granary, and the mill donkey (30 shekels) |
| 8 — Growing estate | Fulfil at least 3 merchant requests; have 20 barley stored in a completed granary; purchase a mill donkey | None | Second granary |

Unlocking a building gives permission to construct it; the level claim does not build it or pay its construction materials.

For level 4, the ground barley or planted field is retained. Farm-stored or carried barley does not satisfy this specific safeguard, and a field still being sown does not count yet.

Design rule going forward: every level-up must consume resources. Levels 2–6 currently do; offerings for levels 7–8 still need to be chosen and implemented. Their current costs above remain unchanged until then.

A successful level claim shows a congratulatory toast in the top-left corner with your new level, its name, and the unlocked features. It disappears after 8 seconds or can be dismissed manually.

### How requirements are counted

- Level 8 checks current granary stock and permanent donkey ownership when claimed, alongside lifetime merchant requests. Farm storage, carried barley, ground barley, and unfinished granaries do not count toward the 20 barley. Claiming keeps the barley and donkey. Existing level-8 farms keep their level.

- Lifetime totals are retained for harvests, harvested barley, production, fish fed, sales, and fulfilled requests. **Level 7 is the exception:** its production and sales requirements count only progress made during level 6, excluding the totals recorded when level 6 was claimed. Bread and beer can be mixed freely. Other levels keep their existing counting rules.
- Existing level-6 saves without a level-entry record start these two counters at zero when first loaded after this update; their lifetime totals and inventory are preserved. This one-time reset avoids treating older lifetime activity as current-level progress.
- Goods required as an offering must still be available in the specified location when you claim.
- Starting bundles and purchased barley do not count as barley you harvested yourself.
- A crop harvest currently produces 2 barley. Therefore, reaching the 5-barley harvest milestone requires at least 3 completed harvests.
- Bread and beer count as produced when their production batch completes, even before delivery to the farm. Purchased goods do not count as production.
- Sales requirements count completed NPC or player-market sales, not unsold listings. Merchant deliveries are a separate achievement.
- Previously sold goods and completed deliveries are not consumed or charged again by a level claim.

### Protecting your planting seed

A barley offering is blocked if it would leave you with no usable barley **and** no already-planted barley field.

- For level 2, exactly 5 ground barley with no other seed and no planted crop is **not enough**. Keep a sixth barley, or plant a field first.
- For level 3, the same rule applies to the 10-barley offering: keep an eleventh usable barley somewhere outside the offering, or have a planted field.
- For levels 2–3, spare seed can be on the ground, carried by the farmer, stored in the farm, or stored in a completed granary.
- Level 4 specifically requires at least one unexpired ground barley or an already-planted field, in addition to the full granary offering.
- Expired barley and barley delivered to a brewery do not count as spare seed.
- An already-planted field may be growing or ready to harvest. A sowing action that has not finished does not count yet.

### Levels 9–10: not yet playable

Level 8 is currently the highest claimable level.

- Level 9 previews two completed granaries, 50 harvested barley, and 12 produced beer. Its intended unlock is brewery expansion, which is not implemented.
- Level 10 is intended to introduce neighbourhood and cooperative systems. Its final requirements are not implemented.

These future levels cannot be claimed yet, even if their previewed milestones have been met.

## Barley, irrigation, and storage

- Planting consumes 1 barley seed. Sowing takes 10 seconds, growth takes 30 minutes, and harvesting takes 10 seconds. A completed harvest yields 2 barley.
- **Plant multiple fields** appears on empty arable ground when at least two empty, irrigated fields are available. Select any eligible fields (they need not touch), then confirm. Yellow stripes mark available fields; selected fields are green. Once all available carried and stored seeds are assigned, remaining fields turn red and cannot be selected until another is deselected.
- Each selected field reserves 1 barley, using carried barley first and stored barley only for the shortfall. With no other task underway and either empty hands or carried barley, the farmer collects any additional seeds from a stocked granary or otherwise the farm. If carried barley is sufficient, he goes directly to the fields. Each field takes 10 seconds plus travel and starts growing independently. The carry chip includes unused seeds and any excess carried barley. Other farmer actions and market visits are blocked during the job.
- Batch planting and reserved seeds survive reloads. The full planting queue continues while the tab is hidden or closed: server deadlines account for seed collection, travel and 10 seconds of sowing per field. On return, completed fields have already grown for the elapsed time since their individual planting deadlines; unfinished work resumes with only its remaining time. Travel is estimated along the farm roads at the farmer's speed when the batch starts (the initial collection trip is estimated from the farm). **Stop after this field** finishes any active sowing and returns unused carried seeds to the farmer (with their original expiry), and unused stored seeds to storage; stopping before sowing returns all unused seeds immediately.
- Clicking growing barley shows a small horizontal progress bar beneath its description, indicating progress from planting to harvest readiness.
- Planting requires suitable irrigated ground. Connect canals to the river; an isolated canal does not provide a working water supply.
- Canal construction and removal each take 5 seconds.
- Exposed barley on the ground or carried by the farmer perishes after **3 days**. Store it to protect it.
- When carrying barley, the farm popup shows only the storage action; taking barley out is shown only with empty hands. Storage remains disabled if the farm is full.
- Ordinary pickups allow up to 2 barley at once. **Harvest multiple fields** allows selecting up to **4 ripe fields**, not necessarily adjacent. Yellow stripes mark candidates and green stripes mark selected fields. Once four are selected, remaining ripe fields turn red; deselecting a field turns those candidates yellow again.
- Multi-field harvesting starts with empty hands. The farmer visits each field and harvests for **10 seconds per field plus travel**, accumulating **2 barley per field** in his hands (up to **8 barley**). The carried-item chip updates after each harvest. The barley is not automatically stored: deliver it to the farm or granary afterwards.
- The whole harvest queue continues while the tab is hidden or closed, using server deadlines for travel and each field. Returning catches up completed harvests and resumes unfinished work with its remaining time. Harvested barley and achievement counts are credited once; its expiry starts at the first completed harvest, not when the player returns. **Stop after this field** also remains effective while away.
- Harvest batches survive reloads. The current field's timer continues offline; subsequent travel and harvesting resume with the game open. **Stop after this field** finishes the active harvest and keeps its barley carried, leaving the remaining fields untouched. Other farmer tasks are blocked during the batch. Happiness-based carrying capacity is not implemented yet.
- The farm stores 5 barley. Each completed granary stores 15 barley before level 7, then automatically increases to 20 at level 7, with no rebuilding or extra cost. Total storage is 25 with one granary at level 7 and 45 with two at level 8. The upgrade applies to existing and future granaries.
- The brewery's barley supply is separate from general storage and cannot be used as a substitute granary.

## Buildings

All buildings below occupy a 2 × 2 footprint and require suitable free space.

| Building | Materials | Construction time | Availability |
| --- | --- | --- | --- |
| Granary | 2 reeds + 3 clay | 2 minutes | First at level 2; second at level 8; maximum 2 |
| Mill | 2 reeds + 4 clay | 2 minutes | Level 5 |
| Brewery | 4 reeds + 6 clay + 2 brewing jars | 3 minutes | Level 6 |
| Bread Oven | 4 reeds + 6 clay + 2 baking tools (6 shekels each at the NPC Baking market) | 3 minutes | Level 6 |

Storage bonuses and completed-building milestones apply only after construction finishes. Reeds and clay each take 10 seconds to gather.

To clear unwanted materials from arable tiles, click a ground reed bundle or clay pile and choose **Destroy**. This immediately and permanently removes the selected pile's entire quantity, with no refund or transfer into storage. Resource totals update accordingly. Other piles and separately stored or carried materials are not removed. River reed plants are not destroyed by this action.

## Farmer happiness and feeding

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

Manage estate has a Farmer tab with Happiness and Next meal round meters, mood and meal guidance, and fish/bread/beer treat actions. Fish unlocks at level 4; bread and beer at level 6. Treats require stock, happiness below 100%, and their independent cooldowns to be complete. Cooldown buttons remain visible even when stock is empty. Resources is a read-only inventory grouped by type, with no feeding controls.

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

### Fish and beer treats

| Treat | Happiness boost | Cooldown after giving it | First available |
| --- | --- | --- | --- |
| 1 stored fish | +10 | 8 hours | Level 4 |
| 1 beer | +15 | 24 hours | Level 6, once beer is available |
| 1 bread | +15 | 12 hours | Level 6, stored bread |

- Fish and beer have **independent cooldowns**. Giving one does not delay the other.
- The first fish treat has no initial waiting period. Its cooldown begins when you actually give a fish.
- Treats are consumed when given and never raise happiness above 100. At full happiness or during a cooldown, the action does not consume goods.
- Treats do not remove hunger or reset the automatic barley-ration schedule.
- Give stored treats through the Farmer tab. The brewery also supports giving beer, including beer from a ready batch.
- During a cooldown, the button displays the remaining wait time.

## Fishing

- Fishing unlocks at level 4. Click the river with the farmer's hands empty and choose **Go fishing**.
- Before level 4, the Fish treat block in the Farmer tab uses the disabled-button colours and shows its unlock level. It returns to its normal colours when unlocked.
- The farm popup shows its stored fish count only from level 4 onward.
- The farmer walks to the river. Aim ahead of the moving fish and click/tap to cast; keyboard controls use arrow keys to aim and Space to cast.
- The cast lands after 400 milliseconds. There is a 2-second recovery between casts. Missing costs no resources.
- Fish change direction and speed. Catching is an active minigame, not a guaranteed completion timer.
- A successful catch gives the farmer 1 fish and ends the session. Bring it to the farm to store it, or release it at the river.
- A carried fish cannot be dropped on the ground or delivered to the granary or brewery. Store or release it before other physical work.
- The farm holds up to **5 fish**, separately from barley storage.
- Fishing does not catch fish automatically while you are away. Stored fish currently do not spoil and cannot be sold or withdrawn.

## Milling barley

### Manual milling

The Mill unlocks at level 5 and occupies 2×2 tiles. Each milling job consumes 2 barley and produces either 1 Flour or 1 Brewer's Groats after 5 minutes. The farmer visits a completed granary with barley by preference, otherwise the farm if it has barley, then carries the barley to the Mill. This single collection stop represents combined storage even when the granary has only one barley. Barley is deducted only when production starts at the Mill: carried barley first, then completed granaries, then farm storage. Carrying one barley means only one additional barley is taken from storage. If both required barley are already carried and storage is empty, the farmer goes straight to the Mill. Exposed ground barley must be picked up or stored first. Both outputs wait at the Mill until collected and delivered to the farm building.

Choose one recipe per job. The farmer walks to the Mill, then works inside it for the entire job. The busy Mill sprite indicates occupied labour: other farmer-dependent tasks, market visits, and fetch are unavailable until completion. Milling persists across reloads and completes while offline. Finished Flour and Brewer's Groats accumulate separately in a shared bag stack beside the Mill, with a chip showing the total count. Click the stack and choose **Store**: with empty hands, the farmer collects all bags and delivers them to the farm building, just like finished bread and beer. No granary is required. Only on delivery are the goods added to Resources and available for level offerings, trading, or production. Further batches can be made before collecting. Delivery survives reloads and does not use barley storage capacity. Flour and groats are traded at their respective markets; baking and brewing unlock at level 6.

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
- After purchase the donkey waits beside the farmer in the market and follows him along the road when returning home. On the farm it grazes between free tiles outside the 8×9 arable plot, avoiding the river, buildings, objects, and goods. It rests for 30 seconds before its first grazing move and after each move finishes.
- Manual milling remains available. **Use donkey · Flour** and **Use donkey · Brewer's Groats** each process **6 barley into 3 bags in 15 minutes**. This triples batch size and duration, not output per minute or yield per barley.
- The farmer fetches the donkey, leads it to the mill, then collects barley from storage and delivers it. The donkey disappears inside the mill and the donkey-powered mill sprite shows production in progress.
- Once production starts, the farmer is free for other work, including baking or visiting the market. Only one milling job can run at a time. Before production starts, finish leading and supplying the donkey before visiting the market.
- Ownership and active jobs survive reloads. The donkey returns to grazing when its job finishes. Finished bags still wait beside the mill and must be collected and delivered to the farm before becoming usable resources.

## Baking bread

The Bread Oven unlocks at level 6. Each batch uses **2 stored Flour → 2 Bread in 5 minutes**.
The farmer collects flour from the farm building and carries it to the oven. Flour is deducted
only when the farmer arrives and baking starts. The farmer disappears inside and stays occupied
for the entire batch: other physical tasks, market visits, and fetch are unavailable. The oven
uses its busy sprite and shows production progress, returning to its idle sprite when finished.
The job persists across reloads and completes while offline.

Finished bread appears as a basket with a count on the oven's road loading tile, before the farmer
reappears on a nearby free road tile so they do not overlap. Click the basket and choose **Store**
to collect and deliver it to the farm. Bread is added to Resources only upon delivery.

Unlike baking, **15-minute beer brewing does not occupy the farmer**. Start beer first, then bake
or perform other tasks while it brews.

## Markets and shekels

The farmer must unload carried items before entering the market scene. This includes
processed-grain deliveries and barley being carried to the Mill. Clicking the market
while carrying goods keeps the farmer on the farm and shows “Unload your items before
going to the market.” in the bottom message bubble. Stored inventory does not block entry.

- Market entry unlocks at **level 3**. Before then, clicking the building keeps you on the farm and shows the unlock message. The ground-barley Sell button is also disabled before level 3.
- The barley stand handles barley. The beer stand handles beer and NPC brewing supplies. The baking stand handles bread, using `market-bread-stand.png`.
- Click an unlocked stand to walk along the market roads to its stopping point; the trade dialog opens on arrival. Clicking another stand while walking changes the destination after the current step. Returning to the farm also follows the roads. Locked stands show their unlock message without starting a trip.
- Buying or selling filled beer and bread in either NPC or player markets unlocks at **level 6**, matching Brewery and Bread Oven construction. This includes buying player listings and creating sell listings. Reaching the level is sufficient; owning the building is not required. The API enforces the same item-level restriction as the interface.

### NPC prices

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

Clicking the estate's market building makes the farmer walk to the road tile beside it before entering the market scene. Clicking the farm building in the market likewise waits for arrival at its adjacent road entrance before returning home. Scene changes are based on arrival, not a fixed timer; a blocked route does not transport the farmer.

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

## Planned: level-8 small shrine (not yet playable)

Level 8 lists **Small shrine (coming soon)** alongside the second granary. Shrine construction and offerings are not implemented yet.

The proposed 1×1 shrine would consume 2 bread or 2 beer per offering to slow happiness decay by 25% for 12 hours. Only one blessing could be active, with no stacking. It would complement happiness-restoring treats without preventing hunger. These are planned settings, not current game rules.

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

## Maintaining this reference

- Update the relevant sections whenever an implemented rule, requirement, price, timer, capacity, or unlock changes.
- Describe current behaviour in plain language. Keep planned systems explicitly marked as unavailable.
- Verify changes against the implementation and tests; if this document and the code disagree, resolve the discrepancy rather than silently presenting a planned rule as live.
- Keep technical implementation notes in `docs/`; this file is the consolidated player-facing explanation.

Implementation references: [progression](src/game-core/farm/progression.ts), [level unlocks](src/game-data/progression.ts), [happiness](src/game-core/farm/wellbeing.ts), [feeding and decay constants](src/game-data/household.ts), [crops](src/game-data/crops.ts), [buildings](src/game-data/buildings.ts), [storage](src/game-data/storage.ts), [brewing](src/game-data/brewing.ts), [fishing](src/game-data/fishing.ts), [NPC prices](src/game-data/marketItems.ts), and [merchant requests](src/game-data/npcRequests.ts).
