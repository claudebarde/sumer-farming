# Mill production

Donkey return presentation uses the saved escort route in reverse (drop index to
pickup index), not a direct tween from the mill to an old grazing coordinate.
Only completion during the current visible farm visit animates the return.
Visibility reconciliation or reload after completion places the donkey at rest;
leaving during its return also settles it immediately. If a newly built building
blocks the old route, settle safely rather than crossing its footprint. This is
presentation-only and never defers server production or output availability.

## Implementation

The Mill reuses `FARM_BUILDING_DEFINITIONS`, footprint/access validation, the building placement store, construction commands/deadlines, sprite loader, shared tile popovers, and farmer movement queue. It is a 2×2 building costing 2 reed and 4 clay, with a two-minute construction time.

`MILL_RECIPES` defines temporary recipes: 2 barley → 1 Flour or 1 Brewer's Groats, both 5 minutes. Inputs are taken from carried barley, completed granaries, then farm inventory. Ground bundles must first be picked up or stored. Outputs use estate inventory rather than barley-capacity storage. No processed-grain market is added.

`start_milling` is submitted immediately when selected, before travel. The service locks the farm, advances lifecycle, validates version, level, Mill completion, resources and existing work, then deducts barley and persists a single nullable `farms.milling` job. It saves recipe quantities, a scheduled `startedAt` after a 10-second manual / 20-second donkey preparation allowance, and `completesAt` after the recipe duration. The farmer's collection/escort trip is presentation only. A hidden tab, interrupted animation or reload cannot postpone the saved job or spend inputs again. A rejected request consumes nothing. See [production timing](production-timing.md).

The existing farmer-availability check rejects physical work during milling. Fishing and brewery services also enforce this lock. The existing client command store rejects new tasks, market/fetch entry is blocked, and the farmer is hidden inside the Mill. Reload places him beside the active Mill before hiding him. On completion he becomes visible and queued work can resume.

`advanceFarmLifecycle` adds output to `farm.millGoods.pending[millId]`, updates lifetime `processedBarley`, clears the job and advances the version under the same farm row lock. Repeated reads cannot grant output twice. The client refreshes at the persisted deadline and retries on network failures; it never awards output locally. While waiting for confirmation it retains the busy state. The Mill uses `empty-mill.png` / `busy-mill.png` through the existing asset registry.

## Building upgrades

Mill building levels 2/3 unlock at estate levels 8/10; Bread Oven and Brewery levels 2/3 at estate levels 9/11. Building level 2 costs 100 shekels and takes five minutes; level 3 costs another 200 shekels and takes ten minutes. Production takes 100%/85%/70% of its base duration at levels 1/2/3, for both mill recipes and both workers, and for baking/brewing. Inputs and outputs do not change. Estate progression remains capped at 8 pending future requirements.

`game-data/buildingUpgrades.ts` contains the building-keyed upgrade configuration, per-tier estate gates, and pure level/deadline helpers. Optional `production.buildingUpgrades` history is keyed by building ID; legacy saves default to level 1. Completed deadlines determine the effective level without a background worker. Gates apply only when purchasing upgrades, preserving already purchased levels. Storage buildings are not enabled yet. `BuildingUpgradeContent` provides reusable popup controls and progress for the oven and brewery. Migration `0047_production-upgrade-levels.sql` permits future level-11 snapshots in persistence without enabling progression claims.

The `upgrade_building` service locks the farm and player, validates ownership, version, sequential target level, availability and balance, and atomically records the payment and upgrade history. Idempotency keys prevent duplicate charges. The mill cannot start an upgrade during production or start production during an upgrade. Finished goods remain collectible and the farmer remains available. The popup shows the current level, next cost/benefit, and upgrade progress/countdown. Apply migrations `0045_building-upgrades.sql` and `0046_building-upgrade-payments.sql` before using the feature against another database.

## Finished bags and delivery

Each Mill accumulates separate Flour and Brewer's Groats counts in one full-tile stack on the bottom-left tile inside its footprint, drawn with `flour-bags.png` above the building sprite. Bread baskets and beer jars use the same placement. The chip above the bag shows the sum; the standard item popup shows each count and a **Store** button. Rendering position is independent from pickup: the farmer uses the building's road loading tile (or the existing adjacent-access fallback for legacy buildings), never the product tile inside the building. Surrounding roads remain clear. Stored and pending goods are distinct: pending bags cannot be offered to level up or spent from Resources. Further milling can continue without collecting earlier batches.

Store sends the farmer to the Mill. On arrival, `mill_delivery/pickup` moves only the quantities that fit each resource's independent estate capacity into a persisted delivery. Remaining bags stay visible at the Mill. The farmer walks to the farm; `mill_delivery/store` credits inventory and clears delivery atomically. If storage fills in transit, excess is restored to pending stock. Flour and groats each hold 10 before the warehouse and 20 with a completed warehouse; neither uses barley capacity. Normal hands must be empty before pickup. Other physical work is blocked during delivery and reload resumes the trip. Version checks and persisted delivery prevent duplicate credits. Legacy inventory is never truncated.

## Progression and compatibility

Level 5 unlocks the Mill, not the Brewery. The level-6 claim requires a completed Mill, 5 lifetime harvested barley, 4 lifetime processed barley and 2 held processed goods. Flour-only, Brewer's-Groats-only and mixed production all qualify. The claim consumes two processed goods, using Flour first, to retain the game's consumption-on-level-up rule.

Level 6 unlocks the existing Brewery, supplies and beer trading. The Bread Oven is explicitly upcoming, not a working unlock. Existing barley-based brewing remains unchanged; Flour → Bread and Brewer's Groats → Beer are follow-up work. Existing buildings, inventories and attained levels are retained. Existing level-5 farms with a Brewery must reach level 6 to use it under the new unlock gate; they can build the Mill without rebuilding or losing their Brewery.

Migration `0033_mill-production.sql` adds a building enum value and nullable job column, and backfills a zero processed-barley counter without resetting progress. Old snapshot payloads default missing job/counter fields. Apply with `npx drizzle-kit migrate` before running this code against another database.

## Changed files for this feature

- Data: `src/game-data/{milling,buildings,inventoryItems,progression}.ts`
- Domain: `src/game-core/farm/{milling,progression,commandUnlock}.ts`
- Schemas: `src/schemas/{farm,gameCommands,progression}.ts`
- Server: `src/server/index.ts`, `src/server/db/schema.ts`, `src/server/services/{milling,farmLifecycle,farmSnapshot,farmerAvailability,fishing,brewerySupplies,claimFarmLevel}.ts`
- Database: `drizzle/0033_mill-production.sql`, `drizzle/meta/0033_snapshot.json`, `drizzle/meta/_journal.json`
- Client: `src/client/components/{MillContent,Canvas,FarmerPanel,FarmLevelDialog}.tsx`, `src/client/stores/farmerCommandStore.ts`, `src/client/game/phaser/{types,game,farmerArrival}.ts`, `src/client/game/phaser/scenes/MainScene.ts`
- Assets: `src/assets/farmSprites.ts`, `src/assets/sprite_assets/{manifest.json,manifest.csv,inventory.md}`; uses the two supplied Mill PNGs
- Tests: `tests/server/{milling,progression}.test.ts`, `tests/client/{farmerPanel,marketScope}.test.ts`
- Documentation: `game-rules.md`, `docs/progression.md`, `docs/milling.md`; follow-up tasks are tracked in [Sumer Farm Tracker](https://app.todoist.com/app/project/6hgM5pCFx353hh8f).

## Manual checks

Build a Mill on a valid 2×2 footprint; check its idle artwork and construction lock. Run each recipe and check walking, busy artwork, hidden farmer, output counts and farmer return. Try physical actions, fetch and market travel while occupied. Reload during a job, wait offline past completion, then reopen and ensure one output award. Check either specialization can claim level 6, unavailable Brewery/beer stand at level 5, and preserved old buildings/stocks after migration. Inspect popup placement/progress on narrow screens and after resizing. Test a temporarily unavailable network at completion: the lock should clear after the refresh succeeds.
