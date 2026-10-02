# Farm progression

The signpost occupies estate tile `(0, 4)`, just above the road. This tile is reserved against cultivation, buildings and resource actions. Its dialog shows requirements and a manual claim button. All information precedes the action button.

Its gold label shows the current farm level, replaced by `+` whenever `evaluateProgression(...).canClaim` is true. Snapshot updates and the existing one-second readiness check refresh the label, including the seed safeguard and maximum playable level.

| Reach | Requirements | Offering consumed | Unlock |
| --- | --- | --- | --- |
| 2 | Harvest 5 barley yourself; have 5 on the ground | 5 ground barley | First granary |
| 3 | Complete a granary; have 10 barley in granaries | 10 granary barley | Barley market |
| 4 | Sell 5 barley; finish 50 crop harvests; have a full granary and ground barley or an already-planted field | 15 barley from the full granary | Fishing |
| 5 | Store 3 fish and 15 barley in completed granaries; feed the farmer a fish; retain spare seed or a planted field | 3 stored fish and 15 granary barley | Mill and barley processing |
| 6 | Complete a Mill; harvest 100 crop plantings over your lifetime (double the level-4 target); process 4 barley using either recipe; hold 2 processed goods in any combination | 2 Flour / Brewer's Groats combined, Flour first | Brewery, Bread Oven, brewing supplies, bread making, beer and bread trading |
| 7 | During level 6, produce 15 bread or beer combined; sell 10 bread or beer combined | None | Merchant requests; each granary automatically stores 20 barley instead of 15; mill donkey (30 shekels, NPC Baking market) |
| 8 | Fulfil 3 merchant requests; store 20 barley in a completed granary; purchase a mill donkey | None | Second granary; Small shrine (coming soon, not yet buildable) |

Level-8 readiness uses current completed-granary stock and the permanent `donkey` inventory entry (only acquired through purchase). Both the dialog and transactional server claim use `evaluateProgression`; no additional counter or migration is needed. Neither resource is consumed on claim. Existing level-8 saves remain level 8.

Achievement counts remain cumulative except for the level-7 requirements. Claiming level 6 atomically stores combined bread/beer production and sales baselines in `progressionStats.level6Baseline`. Level-7 evaluation subtracts these baselines from lifetime totals (clamped to zero). Completed sales and requests are counted from the server ledger; production is credited once when a batch completes, not on delivery. Purchases do not count as production.

Legacy level-6 saves have no level-entry history. Under the farm row lock, lifecycle advancement initializes a baseline once, before processing new completions or actions. Existing production/sales therefore begin at zero for these requirements, without deleting lifetime stats, transactions, or inventory. No SQL schema change is needed for this optional JSON field. Other levels' requirements are unchanged.

For barley offerings, at least one usable barley must remain outside brewing storage, unless an already-planted barley field exists. Thus 5 ground barley alone cannot pay the level-2 offering: the player needs a sixth usable barley or an existing planted field. Expired bundles do not count. The same protection applies to the level-3 and level-5 offerings. Level 5 consumes fish and granary barley together in the claim transaction.

Claims lock the farm and validate requirements and the expected level/version in one transaction. Goods are deducted atomically. Retrying a successful claim cannot deduct again or advance another level. Unlocks are validated by the command API, not just hidden in the UI.

Level 4 requires a single completed granary with 15 barley. Its seed safeguard accepts only unexpired ground barley or an already-planted barley field; farm-stored or carried seed does not qualify. The reserve is not consumed. All future level-ups should consume resources; levels 7–8 still await offering amounts and implementation (tracked in TODOS.md).

Levels 9–10 remain upcoming, pending brewery expansion and community systems. Level 9 previews two granaries, 50 harvested barley and 12 produced beer, but cannot be claimed yet.

Both local development identities start with zero shekels, empty inventory, two ground barley bundles, no improvements, and level 1. Use `node scripts/reset-development-farm.mjs --all` after backing up the local database. This resets both allowlisted development farms, balances and trade history, preserving player identities. It refuses remote hosts or a different database name. A browser reload creates fresh farms using the normal bootstrap.
