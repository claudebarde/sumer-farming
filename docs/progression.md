# Farm progression

Isometric material-drop presentation defers the client readiness claim until the
walking/reach duration finishes. The drop command remains persisted immediately;
animation does not gate inventory persistence. A farm-scoped notification-store
flag blocks checks during the transfer and triggers a check when released, even
without another snapshot or click. Failure clears the flag; player changes reset
it; reload uses the already-committed ground stock. Carried goods never count and
dropped goods are not duplicated into stored inventory.

Level-5 harvest tracking: claiming level 5 atomically records
`progressionStats.level5Baseline.harvests`. The level-6 requirement subtracts it
from lifetime harvests, clamped to zero. Legacy level-5 saves initialize this
optional JSON field once under the farm lock before advancing work; historical
entry counts are unavailable, so those saves start at zero on first load after
the update. Reloading preserves progress. No SQL migration or lifetime reset is
needed. UI evaluation and server claim validation share the same calculation.

Building-readiness notifications cover all unlocked building types without an existing instance: granary (2), mill (5), brewery/bread oven (6), warehouse/shrine (8). `readyBuildings` checks material costs against stored inventory and ground stacks, including jars/tools but excluding carried goods. The next progression building takes notification priority. The client checks visible snapshot updates and claims via `POST /api/notifications/building-ready`. The server rechecks under the farm row lock and appends to `progressionStats.buildingReadyAnnounced`. Every server snapshot prunes flags for buildings no longer ready, so destruction, pickup or material spending re-arms them even if a browser misses the shortage. Concurrent tabs/devices get at most one successful claim per ready period. Client toast IDs include farm version to allow later readiness episodes. Cosmetic flags do not increment economic version or spend goods. A lost response after a committed claim can omit the cosmetic toast rather than duplicate it on retry; economic gameplay is unaffected. No SQL migration is needed.

Level-1 introductory objectives persist as optional `builtFirstCanal` and `plantedFirstBarley` flags in progression stats. Lazy lifecycle reconciliation records completed river-connected canals and finished sowing (including batch planting) before removal/harvesting; the flags never revert. Existing planted barley or lifetime harvests provide evidence of the prior irrigation/planting loop for legacy saves. Construction and sowing still in progress do not count. No schema migration is required for these additive JSON fields.

The signpost occupies estate tile `(0, 4)`, just above the road. This tile is reserved against cultivation, buildings and resource actions. Its dialog shows requirements and a manual claim button. All information precedes the action button.

Its gold label shows the current farm level, replaced by `+` whenever `evaluateProgression(...).canClaim` is true. Snapshot updates and the existing one-second readiness check refresh the label, including the seed safeguard and maximum playable level.

| Reach | Requirements | Offering consumed | Unlock |
| --- | --- | --- | --- |
| 2 | Complete a river-connected canal; plant a barley field; harvest 5 barley yourself; have 5 on the ground | 5 ground barley | First granary |
| 3 | Complete a granary; have 10 barley in granaries | 10 granary barley | Barley market |
| 4 | Sell 5 barley; finish 50 crop harvests during level 3; have a full granary and ground barley or an already-planted field | 15 barley from the full granary | Fishing |
| 5 | Store 3 fish and 15 barley in completed granaries; feed the farmer a fish; retain spare seed or a planted field | 3 stored fish and 15 granary barley | Mill and barley processing |
| 6 | Complete a Mill; harvest 50 crop plantings during level 5; process 4 barley using either recipe; hold 2 processed goods in any combination | 2 Flour / Brewer's Groats combined, Flour first | Brewery, Bread Oven, brewing supplies, bread making, beer and bread trading |
| 7 | During level 6, produce 15 bread or beer combined; sell 10 bread or beer combined; hold 5 stored bread/beer combined | 5 bread/beer combined, bread first | Merchant requests; each granary automatically stores 20 barley instead of 15; mill donkey (30 shekels, NPC Baking market) |
| 8 | Fulfil 3 merchant requests; store 20 barley in a completed granary; purchase a mill donkey; retain spare seed or a planted field | 20 granary barley | Warehouse; Small shrine (1×1, offerings slow happiness decay) |

Level-8 readiness uses current completed-granary stock and the permanent `donkey` inventory entry (only acquired through purchase). Both the dialog and transactional server claim use `evaluateProgression`; no additional counter or migration is needed. The existing granary-offering transaction consumes exactly 20 barley on a successful claim, retaining the donkey and enforcing the spare-seed safeguard. Retries do not charge twice. Existing level-8 saves remain level 8 without a retroactive charge.

Achievement counts remain cumulative except for level-4 and level-6 crop harvests, the level-7 requirements and level-9 harvested barley and bread/beer production. Claiming level 3 atomically stores `progressionStats.level3Baseline.harvests`; level-4 evaluation subtracts it from lifetime harvests, clamped to zero. Legacy level-3 saves initialize this baseline once under the farm lock before advancing work because historical entry totals are unavailable. This additive optional JSON field needs no SQL migration. Planting alone does not increment harvest progress, and the level-6 target counts only harvests during level 5. Claiming level 6 atomically stores combined bread/beer production and sales baselines in `progressionStats.level6Baseline`. Level-7 evaluation subtracts these baselines from lifetime totals (clamped to zero). Completed sales and requests are counted from the server ledger; production is credited once when a batch completes, not on delivery. Purchases do not count as production.

Legacy level-6 saves have no level-entry history. Under the farm row lock, lifecycle advancement initializes a baseline once, before processing new completions or actions. Existing production/sales therefore begin at zero for these requirements, without deleting lifetime stats, transactions, or inventory. No SQL schema change is needed for this optional JSON field. Other levels' requirements are unchanged.

For barley offerings, at least one usable barley must remain outside brewing storage, unless an already-planted barley field exists. Thus 5 ground barley alone cannot pay the level-2 offering: the player needs a sixth usable barley or an existing planted field. Expired bundles do not count. The same protection applies to the level-3 and level-5 offerings. Level 5 consumes fish and granary barley together in the claim transaction.

Claims lock the farm and validate requirements and the expected level/version in one transaction. Goods are deducted atomically. Retrying a successful claim cannot deduct again or advance another level. Unlocks are validated by the command API, not just hidden in the UI.

Level 4 requires a single completed granary with 15 barley. Its seed safeguard accepts only unexpired ground barley or an already-planted barley field; farm-stored or carried seed does not qualify. The reserve is not consumed. All playable level-ups consume resources. Level 7 uses a `prepared_food` offering of 5 stored bread/beer combined, consumed bread-first inside the existing locked claim transaction. Production/sales requirements remain unchanged; pending or carried goods are excluded. Expected-level retries cannot spend twice, and existing higher-level farms incur no retroactive charge. Level 8 consumes 20 granary barley as described above. Future-level work is tracked in [Sumer Farm Tracker](https://app.todoist.com/app/project/6hgM5pCFx353hh8f).

Level 9 is playable: one completed warehouse, 100 barley harvested and 30 bread/beer produced combined during level 8, and 10 bread or 10 beer in estate inventory. The claim consumes exactly 10 bread if available, otherwise 10 beer; mixed stocks do not qualify. This unlocks level-2 bread oven and brewery upgrades. Levels 10–11 remain unclaimable pending their requirements.

The level-7-to-8 claim atomically records `progressionStats.level8Baseline.harvestedBarley` and `.produced` (combined bread/beer). Level-9 evaluation subtracts these from lifetime totals, clamped to zero. Legacy level-8 farms initialize missing baselines once under the farm lock during lifecycle advancement, before new completions or actions. Adding a missing production baseline preserves an existing harvest baseline. Historical level-8 totals cannot be reconstructed; missing counters start at first load. Optional JSON fields need no SQL schema migration. Stock consumption, expected-version validation and retry protection share the existing level-claim transaction.

Both local development identities start with zero shekels, empty inventory, two ground barley bundles, no improvements, and level 1. Use `node scripts/reset-development-farm.mjs --all` after backing up the local database. This resets both allowlisted development farms, balances and trade history, preserving player identities. It refuses remote hosts or a different database name. A browser reload creates fresh farms using the normal bootstrap.
