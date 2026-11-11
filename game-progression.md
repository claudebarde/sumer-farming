# Features and economy by estate level

Last reviewed: 5 November 2026.

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

## Top-bar level icons

When discussing each new estate level, also agree on its top-bar icon. Reuse an
existing item, building or animal unlocked or upgraded at that level; do not
create new artwork by default. The icon follows the saved estate level and is
separate from earned badges.

| Level | Approved icon |
| --- | --- |
| 1 | Barley bundle |
| 2 | Granary |
| 3 | Barley market stand |
| 4 | Fish |
| 5 | Flour bags |
| 6 | Bread basket |
| 7 | Donkey |
| 8 | Warehouse |
| 9 | Grown date palm |
| 10 | Oil jar |
| 11 | Date and sesame porridge |

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
| Sesame crop | Implemented | Buy a basket for 3 shekels at level 10; plant one to harvest three. Growth takes 60 minutes (15 seedlings, 20 leafy, 25 flowering). Saved planting, harvesting and warehouse delivery continue offline. Warehouse capacity is 12 baskets, with no mandatory seed reserve. Sell stored sesame at the produce stand for 1 shekel per basket. Oil production is available in the oil mill. |
| Oil mill: sesame → oil | Implemented; visual testing pending | Unlocks at level 10. Costs 2 reeds and 4 clay; 2-minute construction. Farmer: 3 sesame + 1 empty jar → 1 oil in 5 minutes. Donkey: triple batch in 15 minutes. Three-jar supply capacity; porter restocking. Warehouse stores 10 oil. Buy and sell oil at the produce stand for 8 shekels per jar from level 10. |

Ziggurat construction and festivals are optional bonuses. They must never block
estate levelling or individual progression. There is no permanent ziggurat
happiness bonus. See the detailed ziggurat rules for contribution and festival
eligibility decisions.

## Reaching level 11 — implemented November 5, 2026

| Objective | Approved target |
| --- | --- |
| Completed oil mill | 1 |
| Flour mill upgrade | Building level 3 |
| Sesame fields harvested during level 10 | 12 fields |
| Sesame oil produced during level 10 | 12 jars |
| Stored oil for the level-up offering | 5 jars |
| Stored dates for the level-up offering | 4 baskets |

The offering consumes 5 oil jars and 4 date baskets once when claiming level 11.
Purchased goods can supply the offering; harvest and production objectives count
the player's completed work. Production is measured in jars, not batches.
The kitchen unlocks after reaching level 11 and is not a prerequisite for reaching it.
Ziggurat participation and completion remain optional.

For existing saves, credit verifiable saved history. If a counter cannot be recovered
reliably, start that counter at zero; do not infer production from current stock or purchases.
The player explicitly accepts this fallback for their own farm.

Read-only local history check on November 5: Lugalzagesi has 39 distinct
harvestSesame point receipts and 9 oil-mill completion receipts representing
21 jars (farmer batches yield 1; donkey batches yield 3). Both activities unlock
at level 10. These records can satisfy the two activity targets when implemented.
This check did not change inventory, progression, points or the playable level cap.
Older unrecorded work is not needed to reach either target.

## Levels 11–20: proposed progression for discussion

The level-11 indoor kitchen and production upgrades below are configured in code.
The playable cap is level 11. The approved objectives and offering above are enforced by the server and shown in the level popup.
Level 11 uses the kitchen to give players an optional use for their sesame oil.
Cedar resin and the scented-oil workshop are deferred to a later, undecided level.
Sheep and their first processing chain remain approved for level 12; the care loop,
recipes and buildings still need agreement. Other level assignments remain proposals.
Flax is retained as a later idea, without an approved unlock level.

| Estate level | Suggested additions | Status | Economic purpose |
| --- | --- | --- | --- |
| 11 | Indoor kitchen using sesame oil; bread oven and brewery upgrades to building level 3 | Indoor kitchen: available from Furniture; no outdoor construction or road required. Four 30-second meals, automatic consumption and temporary benefits implemented; see game-rules.md. Upgrades: available. Scented-oil workshop deferred to a later level. | Give sesame oil an optional recurring use in farm meals before introducing livestock. |
| 12 | Introduce sheep and processing: purchasing/caring for sheep, collecting wool and turning it into a saleable product | Level and sheep-processing direction: approved, planned. Sheep pen and a combined spinning/weaving workshop producing cloth: proposed implementation | Introduce livestock with an immediate processing outlet. Decide feed, care, yields, storage and buyers together. |
| 13 | Potter's workshop producing empty jars from clay | Proposed | Let players manufacture packaging that they currently buy; retain buying as an alternative. |
| 14 | Paid warehouse specialisation: +50% capacity for two different resources; reed workshop producing baskets or mats remains a separate proposal | Warehouse direction approved, not implemented; reed workshop proposed | Let players expand storage for their preferred production. Material and shekel costs remain to be balanced. |
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

- Level 11: sesame → oil → kitchen meals (implemented; see game-rules.md).
- Later level, not yet assigned: sesame oil + NPC-market cedar resin → scented oil.
- Sheep and processing at level 12; proposed chain: sheep → wool → cloth → possible later garments.
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

1. Verify the level-10 oil mill construction and production in the interface.
2. Implement the approved level-11 objectives and offering, then test the four approved kitchen meals and benefits. Keep scented oil for a later level. NPC oil trading is already implemented.
3. Design the approved level-12 sheep and processing flow, including care, wool collection and the first processed product.
4. Review the proposed level 11–20 sequence one level at a time before treating any
   of its suggestions as approved features.
5. Set future level-up requirements after the relevant economy is agreed; do not
   make a proposed building or cooperative milestone a requirement prematurely.

## Later level: scented oil and cedar (deferred; unlock level undecided)

On November 5, 2026, the player deferred this chain from level 11. Cedar resin
imports and the sesame oil → scented oil workshop remain a future direction,
with no assigned unlock level. The level-11 kitchen takes priority.
The market stand, building, quantities, times, prices, benefits and top-bar icon
remain undecided. Recipes are game-design adaptations, not exact reconstructions
of ancient recipes. Filled lamps remain an alternative future use, not the chosen
future scented-oil direction.

| Candidate | Proposed manufacturing chain | Possible demand | Tradeoff |
| --- | --- | --- | --- |
| Scented oil / perfume oil (chosen direction) | Sesame oil + NPC-market cedar resin → scented oil in an oil/perfume workshop | Farmer-care consumable, merchant orders and optional shrine/festival offerings | Strong historical fit; requires an aromatic ingredient and a defined repeat use. Avoid modern alcohol-based perfume or distillation. |
| Filled clay oil lamp | Clay lamp + wick + sesame oil → ready-to-use lamp; initially purchase lamp shells/wicks, with local pottery later | Household lighting, merchant orders or optional festival supplies | Clear visual product and repeat oil demand, but adds packaging inputs and the evidence is later than early Sumer. Do not quietly move the proposed level-13 pottery unlock earlier. |

Historical basis and limits:

- [i₃.MesopOil, LMU: oils and fats in early Mesopotamia](https://www.i3-mesop-oil.gwi.uni-muenchen.de/topic/)
  describes anointing as a major use, scenting oils with aromatic substances,
  and oil offerings. It places its earliest oil-lighting references at Mari in
  the Middle Bronze Age. This supports a broader Mesopotamian lamp proposal,
  not an assertion that this exact product existed in early Sumer.
- [The Scents of Larsa, Cuneiform Digital Library Journal](https://cdli.earth/articles/cdlj/2014-1)
  studies Old Babylonian perfume production using sesame oil and aromatics.
  This is evidence from early second-millennium BCE southern Mesopotamia;
  distinguish it from earlier Sumerian evidence. Specific aromatic species and
  recipes need selection before artwork or implementation.
- [Milwaukee Public Museum: oil lamps](https://www.mpm.edu/research-collections/anthropology/anthropology-collections-research/mediterranean-oil-lamps/description-and-history-oil-lamps)
  explains the vessel, wick and fuel components and includes sesame among
  historical lamp fuels. Its broad Mediterranean coverage does not date a
  sesame-fuelled lamp specifically to Sumer.

Scented oil is the preferred starting point: it transforms the existing oil into
a distinct higher-value product and could connect household care with trade and
optional festivals. These consumers and benefits remain proposals, not unlocks.

### Cedar sourcing and later woodworking

Discussion recorded November 4; no later unlock level or forestry feature approved.

- When the deferred scented-oil chain is introduced, begin with imported cedar resin purchased from the NPC market.
- Later possibilities: continue importing resin/timber; let players grow cedar
  on their estate as an explicit historical simplification; or introduce a
  separate mountain forestry holding for cedar aromatics and timber.
- Cedar of Lebanon is naturally a mountain tree, not a southern Mesopotamian
  floodplain crop. A mountain holding would fit its habitat better than planting
  it beside barley. See [Oxford botanical reference](https://herbaria.plants.ox.ac.uk/bol/plants400/Profiles/CD/Cedrus).
- A later carpenter could turn timber into furniture such as stools, tables and
  chests. These are proposed game products: the [Met's cedar stool leg](https://www.metmuseum.org/art/collection/search/554333)
  is Egyptian evidence, while [Khorsabad's cedar doors and doorposts](https://archeologie.culture.gouv.fr/khorsabad/en/metal-decors)
  are Assyrian. [Gudea's inscriptions](https://etcsl.orinst.ox.ac.uk/cgi-bin/etcsl.cgi?text=t.2.1.7)
  attest imported cedar for Sumerian temple construction.
- Regular resin harvesting, collection technique, tree growth, felling/replanting
  and wood yields need research and design before implementation. Do not imply
  that a felled tree keeps yielding resin.

### Production and benefit proposals — awaiting approval

- **Building:** a small Perfumer's workshop, with vessels for warming/infusing oil
  and straining aromatics. Keep the oil mill focused on pressing seeds. This
  workshop could later support other scented oils; no modern distillation still.
- **Primary use:** a farmer-care consumable that temporarily slows ordinary
  happiness decay, distinct from the immediate happiness gain of food treats.
  Initial balance to discuss: one use gives 20% slower ordinary decay for 8 hours.
  It does not replace meals or remove missed-meal penalties. No stacking and no
  second use while active; offline time counts toward expiry.
- **Trade:** allow players to buy finished scented oil or manufacture it for sale;
  optional merchant demand supplies another outlet. Prices must account for the
  oil, purchased resin, labour and any container cost, with no NPC buy/sell exploit.
- **Later optional use:** shrine offerings or festival supplies. Do not make
  cooperative participation necessary to use the product or progress individually.
- The benefit above is a proposed game mechanic, not a claim about historical
  physiological effects. Decide benefits before recipe quantities, prices and
  construction costs. Container reuse/consumption and storage need decisions too.

## Level-11 farm kitchen — approved design

The level-11 kitchen is now furniture inside the house, using the approved
`kitchen-interior-matched.png` artwork. Players have one copy and can place,
rotate or put it away. Clicking it opens the recipe drawer; the farmer walks to
the table and cooks. No construction materials or road connection are required.
The outdoor kitchen and its construction option have been removed without refunds.
The four recipes, 30-second cooking times, automatic consumption and temporary
benefits remain implemented; see game-rules.md.

Kitchen meals approved November 5, 2026: oil-fried barley cakes (1 flour + 1 oil,
20% faster harvesting for 20 min); date cakes (1 flour + 1 dates, +2 planting
fields for 20 min); sesame cakes (1 flour + 1 sesame + 1 oil, 15% faster farmer
milling/beer preparation for 20 min); date and sesame porridge (1 groats + 1 dates
+ 1 sesame, 50% slower hunger for 1 hour). All take 30 seconds, consume automatically
and have no meal storage. One effect at a time; replacing a meal preserves already
accepted work. Unlock stays at level 11.

Level-11 top-bar icon: date and sesame porridge, replacing the kitchen sprite for better visibility (November 5; visual review pending).

## Level 14: paid warehouse resource improvements (planned)

Players will be able to purchase two storage improvements in their existing
warehouse, each increasing the base capacity of a different resource by 50%.
These are paid improvements, not automatic free capacity on reaching level 14.
The feature is approved in principle but is not playable yet.

Exact material and shekel costs remain undecided. Rounding fractional capacities,
upgrade duration, and whether/how choices can be reassigned need confirmation
before implementation. The proposed rounding-up examples are dates 5 → 8,
sesame 12 → 18, and oil 10 → 15; these are not yet final rules.
