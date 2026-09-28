# Farm progression

The signpost occupies estate tile `(0, 4)`, just above the road. This tile is reserved against cultivation, buildings and resource actions. Its dialog shows requirements and a manual claim button. All information precedes the action button.

| Reach | Requirements | Offering consumed | Unlock |
| --- | --- | --- | --- |
| 2 | Harvest 5 barley yourself; have 5 on the ground | 5 ground barley | First granary |
| 3 | Complete a granary; have 10 barley in granaries | 10 granary barley | Barley market |
| 4 | Sell 5 barley; finish 3 crop harvests | None | Fishing |
| 5 | Store 3 fish; feed the farmer a fish | 3 stored fish | Brewery and brewing supplies |
| 6 | Complete a brewery; produce and collect/serve 2 beer | None | Beer trading |
| 7 | Produce 6 beer; sell 2 beer | None | Merchant requests |
| 8 | Fulfil 3 merchant requests | None | Second granary |

Achievement counts are cumulative. Buying barley or beer does not count as harvesting or brewing. Completed sales and requests are counted from the server ledger. Collected beer and beer served directly from a finished batch count once towards production.

For barley offerings, at least one usable barley must remain outside brewing storage, unless an already-planted barley field exists. Thus 5 ground barley alone cannot pay the level-2 offering: the player needs a sixth usable barley or an existing planted field. Expired bundles do not count. The same protection applies to the level-3 offering.

Claims lock the farm and validate requirements and the expected level/version in one transaction. Goods are deducted atomically. Retrying a successful claim cannot deduct again or advance another level. Unlocks are validated by the command API, not just hidden in the UI.

Levels 9–10 remain upcoming, pending brewery expansion and community systems. Level 9 previews two granaries, 50 harvested barley and 12 produced beer, but cannot be claimed yet.

Both local development identities start with zero shekels, empty inventory, two ground barley bundles, no improvements, and level 1. Use `node scripts/reset-development-farm.mjs --all` after backing up the local database. This resets both allowlisted development farms, balances and trade history, preserving player identities. It refuses remote hosts or a different database name. A browser reload creates fresh farms using the normal bootstrap.
