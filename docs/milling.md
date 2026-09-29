# Mill production

## Implementation

The Mill reuses `FARM_BUILDING_DEFINITIONS`, footprint/access validation, the building placement store, construction commands/deadlines, sprite loader, shared tile popovers, and farmer movement queue. It is a 2×2 building costing 2 reed and 4 clay, with a two-minute construction time.

`MILL_RECIPES` defines temporary recipes: 2 barley → 1 Flour or 1 Brewer's Groats, both 5 minutes. Inputs are taken from carried barley, completed granaries, then farm inventory. Ground bundles must first be picked up or stored. Outputs use estate inventory rather than barley-capacity storage. No processed-grain market is added.

The farmer first visits a completed granary with any barley, otherwise the farm if it has barley, then carries a visual two-barley bundle to the Mill. A single collection stop represents combined storage, even if the granary has only one barley. Carried barley counts toward the two required; if no storage has barley and both are already carried, the farmer goes straight to the Mill. This trip does not mutate inventory. Only on arrival at the Mill does `start_milling` submit the command. The service locks the farm, advances lifecycle, checks version, level, Mill completion, resources and existing work, then deducts barley and persists a single nullable `farms.milling` job. It stores the building, recipe, timestamps and quantities so later balance changes cannot alter an active job. Interrupted trips consume nothing, and failure clears the temporary carrying visual.

The existing farmer-availability check rejects physical work during milling. Fishing and brewery services also enforce this lock. The existing client command store rejects new tasks, market/fetch entry is blocked, and the farmer is hidden inside the Mill. Reload places him beside the active Mill before hiding him. On completion he becomes visible and queued work can resume.

`advanceFarmLifecycle` adds output to `farm.millGoods.pending[millId]`, updates lifetime `processedBarley`, clears the job and advances the version under the same farm row lock. Repeated reads cannot grant output twice. The client refreshes at the persisted deadline and retries on network failures; it never awards output locally. While waiting for confirmation it retains the busy state. The Mill uses `empty-mill.png` / `busy-mill.png` through the existing asset registry.

## Finished bags and delivery

Each Mill accumulates separate Flour and Brewer's Groats counts in one full-tile stack on a free surrounding tile, drawn with `flour-bags.png`. Placement prefers the front of the Mill, excludes occupied tiles and the river, and searches farther out if immediate neighbours are full. The chip above the bag shows the sum; the standard item popup shows each count and a **Store** button. The farmer walks onto the bag tile for pickup. Stored and pending goods are distinct: pending bags cannot be offered to level up or spent from Resources. Further milling can continue without collecting earlier batches.

Store sends the farmer to the Mill. On arrival, `mill_delivery/pickup` atomically moves the whole stack into a persisted delivery containing both counts and the chosen completed granary ID. The bag disappears and the farmer walks to the granary. On arrival, `mill_delivery/store` credits both inventory entries and clears the delivery atomically. This does not consume granary barley capacity. Normal hands must be empty before pickup. Other physical work is blocked during delivery; reload resumes the trip, and clicking a granary offers Store to retry an interrupted delivery. Version checks and the persisted delivery prevent duplicate credits. Existing inventory remains untouched by migration `0034_mill-output-bags.sql`.

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
- Documentation: `game-rules.md`, `docs/progression.md`, `docs/milling.md`, `TODOS.md`

## Manual checks

Build a Mill on a valid 2×2 footprint; check its idle artwork and construction lock. Run each recipe and check walking, busy artwork, hidden farmer, output counts and farmer return. Try physical actions, fetch and market travel while occupied. Reload during a job, wait offline past completion, then reopen and ensure one output award. Check either specialization can claim level 6, unavailable Brewery/beer stand at level 5, and preserved old buildings/stocks after migration. Inspect popup placement/progress on narrow screens and after resizing. Test a temporarily unavailable network at completion: the lock should clear after the refresh succeeds.
