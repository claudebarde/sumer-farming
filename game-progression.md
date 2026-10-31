# Features and economy by estate level

Last reviewed: 29 October 2026.

This is the editable design reference for what each estate level introduces.
It contains both current unlocks and future planning; it is not player-facing UI
copy and does not change the game's unlocks.

- **Implemented**: available in the code at a reachable level. This does not imply
  that every feature has completed player acceptance testing.
- **Configured, locked**: code defines the unlock, but that estate level cannot yet
  be reached.
- **Approved, planned**: agreed direction, not yet playable.
- **Proposed**: a discussion starting point, not an approved commitment.
- **Undecided**: the feature or its level still needs a decision.

An estate level unlocks permission to build or use a feature. It does not
necessarily grant a free building, animal, upgrade or item. Existing features
remain available at subsequent levels.

## Sources and maintenance

[PROJECT.md](PROJECT.md) governs the architecture and economic direction.
[game-rules.md](game-rules.md) describes playable rules and level-up requirements.
[Ziggurat rules](game-rules/ziggurat.md) hold the detailed cooperative rules.

Check these implementation sources when updating current unlocks:

- [Level names, cap and market gates](src/game-data/progression.ts)
- [Production building upgrades](src/game-data/buildingUpgrades.ts)
- [Crops](src/game-data/crops.ts), [buildings](src/game-data/buildings.ts),
  [shrine](src/game-data/shrine.ts) and [happiness](src/game-data/household.ts)
- [Neighbourhood and ziggurat services](src/server/services/ziggurat.ts)

Keep approved decisions separate from suggestions. When a feature becomes
playable, update its status here and its rules in game-rules.md in the same task.
Do not use this document as an implementation checklist; explicitly requested
tracked work belongs in Todoist. Exact recipes, prices and timings belong in the
rules and configuration rather than being duplicated throughout this roadmap.

## Levels 1–9: implemented foundation

| Estate level | Features becoming available | Economic role |
| --- | --- | --- |
| 1 — First plot | Barley planting and harvesting, irrigation, farm storage, household feeding, ground-resource collection and road building; farm dog and fetch | Learn the planting seed, harvest, food and storage cycle. |
| 2 — Grain keeper | First granary, with capacity for 15 barley | Retain surplus and prepare goods for trade. |
| 3 — Grain trader | Market access, barley buying and selling, player trading and leaderboard access | Turn surplus into shekels and buy needed supplies. |
| 4 — River provider | Fishing, fish storage and fish treats; normal happiness management | Balance food, farmer care and production. |
| 5 — Caring household | Mill; barley into flour or brewer's groats; flour and groats trading at the baking and beer stands; hired porter | Introduce processing and paid delivery assistance. |
| 6 — Brewer or Baker? | Bread oven and brewery, production supplies, bread and beer production/trading/treats | Choose how to allocate barley between seed, meals, sales and processed goods. |
| 7 — Trusted supplier | Merchant boat requests; mill donkey; automatic granary upgrade to building level 2 with 20-barley capacity; neighbourhood map and local rankings, including viewing ziggurat contributions | Introduce contracts, labour assistance and neighbourhood identity. |
| 8 — Growing estate | Warehouse, split storage deliveries, small shrine and offerings; mill upgrade to building level 2 | Expand logistics, introduce offerings and improve processing efficiency. |
| 9 — Established producer | Date palms, tending, date harvesting/storage/treats; fruit and vegetable stand with dates buying and selling; bread oven and brewery upgrades to building level 2 | Add a perennial crop and another source of income. |

The produce stand's other displayed fruits and vegetables are decorative; they
are not playable crops. The granary's level-7 improvement is automatic. Production
building upgrades require a separate paid upgrade.

## Level 10: core systems and community

Level 10 is the intended point where most core farm and social systems become
available. Later levels should deepen those systems with crops, animals, recipes,
buildings and specialisation. This is a product direction, not a claim that every
planned level-10 feature is already implemented.

| Feature | Status | Scope or decision still needed |
| --- | --- | --- |
| Mill upgrade to building level 3 | Implemented | Uses the approved upgrade presentation and mill artwork. |
| Barley withering | Implemented | Applies only to barley planted from level 10: 1 barley yield after 24 hours ripe; automatic clearing after 48 hours ripe. |
| Shared market presence | Implemented | Level-10 neighbours visiting together see each other's farmers; multi-player acceptance testing remains separate. |
| Level-10 badge | Implemented | Replaces the beginner badge. |
| Ziggurat interest and cooperative construction | Implemented | Three interested level-10 neighbours open fundraising; four material-funded construction stages. Lower-level neighbours can observe. |
| Construction contribution ranking and Patron rewards | Implemented | Points, tied-winner rewards, badge and placeable miniature; visual reward acceptance testing remains separate. |
| Ziggurat festivals | Approved, planned | Completed ziggurat required; begin with a crop-growth festival. Funding, duration and exact benefits still need agreement. |
| Sesame crop | Implemented | Buy a basket for 3 shekels at level 10; plant one to harvest three. Growth takes 60 minutes (15 seedlings, 20 leafy, 25 flowering). Saved planting, harvesting and warehouse delivery continue offline. Warehouse capacity is 12 baskets, with no mandatory seed reserve. Sell stored sesame at the produce stand for 1 shekel per basket. Oil production remains unavailable. |
| Oil workshop: sesame → oil | Approved direction; unlock level undecided | Level 10 is recommended, but has not been approved. The approved recipe uses three sesame baskets per jar; packaging, costs, timings and oil uses remain undecided. |

Ziggurat construction and festivals are optional bonuses. They must never block
estate levelling or individual progression. There is no permanent ziggurat
happiness bonus. See the detailed ziggurat rules for contribution and festival
eligibility decisions.

## Levels 11–20: proposed progression for discussion

Only the level-11 production upgrades below are currently configured in code.
The playable cap remains level 10; requirements and offerings for levels 11–20
are not implemented. All other level assignments in this table are proposals.
The approved direction is to explore sheep about one or two levels after sesame;
flax is retained as a later idea, without an approved unlock level.

| Estate level | Suggested additions | Status | Economic purpose |
| --- | --- | --- | --- |
| 11 | Bread oven and brewery upgrades to building level 3; introduce a sheep pen, purchasing sheep, animal care and collecting/selling wool | Upgrades: configured, locked. Sheep: proposed here, with level 12 as an alternative | Improve existing production and introduce productive livestock. Raw wool must have a market outlet immediately. |
| 12 | Textile workshop turning wool into saleable cloth, with spinning and weaving combined initially | Proposed | Give livestock a processing chain without requiring several new buildings at once. |
| 13 | Potter's workshop producing empty jars from clay | Proposed | Let players manufacture packaging that they currently buy; retain buying as an alternative. |
| 14 | Reed workshop producing baskets or mats | Proposed | Add uses for reeds beyond construction. Decide useful demand before adding output recipes. |
| 15 | Flax cultivation and linen recipes in the textile workshop | Proposed; flax retained as a later idea | Let crop growers and sheep keepers supply different textiles through a shared workshop. |
| 16 | One additional food crop, such as onions or chickpeas, after historical and gameplay review | Proposed | Expand the existing produce market with a useful ingredient rather than several disconnected crops. |
| 17 | Additional food or oil-processing recipes using existing ingredients | Proposed | Increase demand for earlier crops. Select recipes and consumers before deciding whether another building is necessary. |
| 18 | Larger optional merchant orders for processed goods and mixed products | Proposed | Provide demand for oil, textiles and craft goods without requiring every estate to produce everything itself. |
| 19 | Further warehouse or delivery improvements, based on observed storage and labour limits | Proposed | Support larger trade volumes without making logistics entirely automatic. |
| 20 | Regional trade opportunities and optional specialisation in food, textiles or crafts | Proposed | Connect established production chains to broader buyers; define scope before committing to a world map or new trading system. |

A level does not need a new building every time. Recipes, customers, upgrades and
new uses for existing goods can provide meaningful progression while keeping the
estate readable and manageable.

## Proposed economy across levels 10–20

Existing chains remain useful:

- Barley → flour → bread.
- Barley → brewer's groats → beer.
- Date palms → dates for food, trade and offerings.

New branches under consideration:

- Sesame → oil → later recipes or other uses, to be agreed.
- Sheep → wool → cloth → possible later garments.
- Flax → linen, sharing the textile workshop.
- Clay → jars, supplying production packaging.
- Reeds → baskets or mats, with their uses defined before implementation.

Design principles for reviewing these branches:

- Every new raw material needs an immediate use or sales outlet, even if its
  processing building arrives later.
- Players should be able to buy inputs instead of owning every production chain.
- Processed goods need buyers or recurring uses; more item types alone do not
  create a functioning economy.
- Animal feed, seed, household food, trade and cooperative donations should create
  choices without leaving players unable to continue playing.
- Introduce livestock with a small care-and-production loop before adding breeding,
  milk, meat or multiple animal species.
- Prices, yields and production times need balancing against storage limits and
  labour, rather than assuming that every later product is automatically profitable.
- Cooperative participation must remain optional for individual progression.

## Next decisions

1. Confirm the oil workshop's unlock level: level 10 or later.
2. Define the sesame cycle and oil's initial uses, storage and market outlet.
3. Choose level 11 or 12 for sheep, and agree their care and wool collection flow.
4. Review the proposed level 11–20 sequence one level at a time before treating any
   of its suggestions as approved features.
5. Set future level-up requirements after the relevant economy is agreed; do not
   make a proposed building or cooperative milestone a requirement prematurely.
