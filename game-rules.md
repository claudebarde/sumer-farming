# Game rules

This is the living, player-facing reference for the game's implemented rules. Use it when explaining the game, preparing help text, or answering players' questions. Planned features are listed separately and are not promises of currently available gameplay.

## Starting your farm

### Optional fetch game

- Available from level 1: click the farm dog, then **Play Fetch** while the farmer is idle.
- Outside fetch, the dog follows the farmer toward a clear neighbouring tile, keeping roughly one tile away. It goes around buildings, fields, canals, and the river, or waits if no route exists. When the farmer stops (including to plant or harvest), the dog continues catching up before sitting beside him. Normal farm updates never teleport it.
- Fetch temporarily takes priority over following. If a round needs a different starting point, the dog walks there around obstacles before the run begins. It uses the standing pose while moving and sits when stopped.
- The dog runs along a randomly selected clear, straight route. Its stopping distance is hidden; each run lasts 6–8 seconds, with a visible slowdown during the final quarter.
- Aim the arrow from the farmer with the pointer and click to throw. On touchscreens, drag and release. Arrow keys adjust the aim and Space throws; Escape or **Stop playing** exits.
- The temporary stick takes 0.65 seconds to land. It must land ahead of the dog, close to its route, and be reached before the dog stops. Behind, sideways, and overly distant throws lose the round. Only one throw is allowed per round; replay is free.
- Fetch does not consume or grant goods, currency, happiness, or progression. Crops and brewing continue normally. Farm tile actions are blocked only while the fetch controls are open.
- Routes avoid buildings, fields, canals, ground items, the signpost, and canvas edges. Changes to the route or resizing cancel the round safely. Fetch is local entertainment; no score or round is persisted.

### Initial estate

- Start at **level 1 — First plot**, with a farm building, two barley bundles on the ground, empty inventory, and zero shekels.
- The estate has an 8 × 8 plot. Buildings, the road, canals, and the level signpost occupy space that cannot also be planted.
- The road crosses the sixth row from the top. Irrigation canals can cross it using a bridge.
- Barley is both a crop and its own seed: keep some for planting rather than consuming or selling everything.

## Farm levels

Click the signpost on the left side of the estate, immediately above the road, to see your current level and the next level's requirements.

The signpost tile is permanently reserved. No part of a building's footprint may overlap it, and fields or irrigation canals cannot be placed on it.

Leveling up is **manual**, not automatic. Meet every listed requirement, then press **Claim level**. The button stays disabled until the requirements and seed-safety check are satisfied. Required offerings are consumed when you claim the level, not while you are gathering them. Levels must be claimed in order.

### Playable levels

| Level reached | Requirements | Goods consumed on claim | Unlocks |
| --- | --- | --- | --- |
| 1 — First plot | Starting level | None | Irrigation, barley cultivation, farm storage |
| 2 — Grain keeper | Harvest at least 5 barley yourself; have 5 usable barley on the ground | 5 ground barley | First granary |
| 3 — Grain trader | Complete a granary; have 10 barley stored in granaries | 10 granary barley | Market entry and barley trading |
| 4 — River provider | Sell at least 5 barley; complete at least 50 lifetime crop harvests | None | Fishing, fish storage, and normal happiness management |
| 5 — Caring household | Have 3 stored fish; have fed the farmer at least 1 fish | 3 stored fish | Brewery construction and brewing supplies |
| 6 — Brewer | Complete a brewery; produce and collect or serve at least 2 beer | None | Beer trading |
| 7 — Trusted supplier | Produce at least 6 beer; sell at least 2 beer | None | Merchant requests |
| 8 — Growing estate | Fulfil at least 3 merchant requests | None | Second granary |

Unlocking a building gives permission to construct it; the level claim does not build it or pay its construction materials.

A successful level claim shows a congratulatory toast in the top-left corner with your new level, its name, and the unlocked features. It disappears after 8 seconds or can be dismissed manually.

### How requirements are counted

- Harvests, harvested barley, produced beer, fish fed, sales, and fulfilled requests are cumulative achievements. They do not reset at each level.
- Goods required as an offering must still be available in the specified location when you claim.
- Starting bundles and purchased barley do not count as barley you harvested yourself.
- A crop harvest currently produces 2 barley. Therefore, reaching the 5-barley harvest milestone requires at least 3 completed harvests.
- Beer counts as produced when you collect your brewed beer or serve it directly from a finished batch. Purchased beer does not count as production.
- Sales requirements count completed NPC or player-market sales, not unsold listings. Merchant deliveries are a separate achievement.
- Previously sold goods and completed deliveries are not consumed or charged again by a level claim.

### Protecting your planting seed

A barley offering is blocked if it would leave you with no usable barley **and** no already-planted barley field.

- For level 2, exactly 5 ground barley with no other seed and no planted crop is **not enough**. Keep a sixth barley, or plant a field first.
- For level 3, the same rule applies to the 10-barley offering: keep an eleventh usable barley somewhere outside the offering, or have a planted field.
- Spare seed can be on the ground, carried by the farmer, stored in the farm, or stored in a completed granary.
- Expired barley and barley delivered to a brewery do not count as spare seed.
- An already-planted field may be growing or ready to harvest. A sowing action that has not finished does not count yet.

### Levels 9–10: not yet playable

Level 8 is currently the highest claimable level.

- Level 9 previews two completed granaries, 50 harvested barley, and 12 produced beer. Its intended unlock is brewery expansion, which is not implemented.
- Level 10 is intended to introduce neighbourhood and cooperative systems. Its final requirements are not implemented.

These future levels cannot be claimed yet, even if their previewed milestones have been met.

## Barley, irrigation, and storage

- Planting consumes 1 barley seed. Sowing takes 10 seconds, growth takes 30 minutes, and harvesting takes 10 seconds. A completed harvest yields 2 barley.
- Clicking growing barley shows a small horizontal progress bar beneath its description, indicating progress from planting to harvest readiness.
- Planting requires suitable irrigated ground. Connect canals to the river; an isolated canal does not provide a working water supply.
- Canal construction and removal each take 5 seconds.
- Exposed barley on the ground or carried by the farmer perishes after **3 days**. Store it to protect it.
- The farmer can carry up to 2 barley at once.
- The farm stores 5 barley. Each completed granary adds 15 storage, giving 20 total with one granary and 35 with two.
- The brewery's barley supply is separate from general storage and cannot be used as a substitute granary.

## Buildings

Both buildings below occupy a 2 × 2 footprint and require suitable free space.

| Building | Materials | Construction time | Availability |
| --- | --- | --- | --- |
| Granary | 2 reeds + 3 clay | 2 minutes | First at level 2; second at level 8; maximum 2 |
| Brewery | 4 reeds + 6 clay + 2 brewing jars | 3 minutes | Level 5 |

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

### Fish and beer treats

| Treat | Happiness boost | Cooldown after giving it | First available |
| --- | --- | --- | --- |
| 1 stored fish | +10 | 8 hours | Level 4 |
| 1 beer | +15 | 24 hours | Level 5, once beer is available |

- Fish and beer have **independent cooldowns**. Giving one does not delay the other.
- The first fish treat has no initial waiting period. Its cooldown begins when you actually give a fish.
- Treats are consumed when given and never raise happiness above 100. At full happiness or during a cooldown, the action does not consume goods.
- Treats do not remove hunger or reset the automatic barley-ration schedule.
- Give stored treats through Resources. The brewery also supports giving beer, including beer from a ready batch.
- During a cooldown, the button displays the remaining wait time.

## Fishing

- Fishing unlocks at level 4. Click the river with the farmer's hands empty and choose **Go fishing**.
- The farmer walks to the river. Aim ahead of the moving fish and click/tap to cast; keyboard controls use arrow keys to aim and Space to cast.
- The cast lands after 400 milliseconds. There is a 2-second recovery between casts. Missing costs no resources.
- Fish change direction and speed. Catching is an active minigame, not a guaranteed completion timer.
- A successful catch gives the farmer 1 fish and ends the session. Bring it to the farm to store it, or release it at the river.
- A carried fish cannot be dropped on the ground or delivered to the granary or brewery. Store or release it before other physical work.
- The farm holds up to **5 fish**, separately from barley storage.
- Fishing does not catch fish automatically while you are away. Stored fish currently do not spoil and cannot be sold or withdrawn.

## Brewing beer

Brewing unlocks at level 5.

**Recipe:** 2 barley + 2 water loads + 2 empty beer jars → 2 filled beer jars in **1 hour**.

- Deliver ingredients and start the batch through the brewery popup.
- Each brewery can hold at most 2 barley, 2 water loads, and 10 empty beer jars.
- Brewing jars are permanent brewing equipment used to construct the brewery, not the empty packaging jars consumed for every batch.
- Collect finished beer into estate inventory before starting another batch. Beer served directly from the ready batch reduces the amount left to collect.
- The brewing timer disappearing is the visual cue that the batch is ready; there is no floating “Beer ready” label.
- Filled beer in estate inventory can be given to the farmer, sold once beer trading unlocks, or used in merchant requests once those unlock.

## Markets and shekels

- Market entry unlocks at **level 3**. Before then, clicking the building keeps you on the farm and shows the unlock message. The ground-barley Sell button is also disabled before level 3.
- The barley stand handles barley. The beer stand handles beer and NPC brewing supplies.
- Brewing supplies unlock at level 5; filled-beer trading unlocks at level 6.

### NPC prices

Prices below are from the player's perspective.

| Item | Buy from NPC | Sell to NPC |
| --- | --- | --- |
| Barley | 2 shekels each | 1 shekel each |
| Brewing jar | 6 shekels each | Not available |
| Empty beer jar | 2 shekels each | Not available |
| Filled beer jar | Not available | 5 shekels each |

The brewing-jar purchase section is hidden when the player already has the two required jars; buying extras beyond the current requirement is not allowed. Empty beer jars are bought from the beer stand's NPC Buy tab.

Players can also list barley and filled beer for other players to buy. Listings are not completed sales until someone purchases them. Brewing equipment and empty jars are not available for player listings in this version.

The ground-barley Sell button is currently a placeholder, not a working shortcut. Use the barley market for actual sales after unlocking it.

Market stand dialogs cannot open before their unlock level. The barley stand opens at level 3; the beer stand opens at level 5 for brewing supplies, with beer trading available at level 6. Clicking a locked stand shows its unlock level in the white communication bubble at the bottom of the canvas instead of opening its dialog. The stand's label stays unchanged.

## Traveling merchant requests

- Merchant requests unlock at level 7 and are accessed through the chariot on the estate road, not through the market stands.
- The chariot takes 15 seconds to arrive, stops near the estate's centre, and offers three requests during a **24-hour window**. There is then a **48-hour break** before the next request window.
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
