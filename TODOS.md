# TODOs

## Next priority

- [ ] Choose and implement resource offerings for level-ups to levels 7–8 (and future levels): every level-up must consume resources. Level 6 now consumes 2 processed goods in any combination.
- [ ] Level 6 processing: implement the Bread Oven and Flour → Bread; adapt the preserved Brewery recipe to Brewer's Groats → Beer, including compatibility for existing batches and stocks.

- [x] Add brewery construction and NPC-market brewing jars.
- [x] Implement the barley-to-beer recipe, one-hour brewing, countdowns, and collection into estate inventory.
- [x] Add beer sales to the NPC market at 5 shekels per filled jar (NPC merchants do not sell beer), plus player listings and purchases from estate inventory.

## Later

- [ ] Show a small progress bar above each building under construction on the canvas, with the remaining construction time. Keep it updated as construction progresses and remove it when the building is complete.
- [ ] Start new players without a prebuilt farm building and guide them through collecting reed and clay, then placing and constructing their first farm. Use this opening tutorial to teach material gathering and building before normal farming progression begins; ensure the required resources are accessible without an existing farm.
- [ ] Generate PNG resource images for shekels, beer (filled beer jars), brewing jars, and empty beer jars, matching the existing art style. Register them in the sprite inventory/manifests and add thumbnails to the Resources panel.
- [x] Remove the legacy general market dialog after the new NPC Requests flow is implemented. Brewing jars are available at the Beer market, the brewery's empty-jar purchase shortcut opens that market, and the third stand no longer opens a general dialog.
- [ ] Design an introductory harvest that teaches irrigation correctly: consider ready-to-harvest starter fields with a river-connected canal, without implying barley can be planted anywhere. Keep normal growth at 30 minutes; use the two starting ground bundles until this is designed.
- [x] Add NPC delivery requests: three personal requests per 24-hour window, followed by a 48-hour break; server-validated atomic deliveries and ledger rewards, with brewery-gated beer requests.
- [x] Move NPC requests to a scheduled merchant chariot on the estate road, with arrival/departure animations and a requests-only dialog while stopped.
- [ ] Add scheduled river trading boats: show a boat on the river during announced arrival windows, letting players interact with its crew to sell or barter barley, beer, and later goods. Give each visit limited, varying demand and clear prices or exchange terms so it removes surplus without replacing the player market. Display the next arrival and departure times; offer several windows across the day so participation does not depend on one timezone. Define schedules, demand limits, and rewards before implementation; validate availability and settle trades atomically on the server.

## Future — locations and progression

- [ ] Add a leaderboard ranking players by available goods, shekel balances, and other defined measures of prosperity.
- [ ] Build a neighbourhood map so players can see who their neighbours are.
- [ ] Offer starting-location choices among known Sumerian cities, including Nippur, Ur, and Lagash.
- [x] Implement the farm-level signpost: requirements, manual level claims, consumed offerings, seed protection, and server-enforced unlocks through level 8.
- [ ] Complete levels 9–10 when brewery expansion and neighbourhood/cooperative systems are implemented; playtest and rebalance the introductory progression.

## Future — community and social systems

- [ ] Add cooperative construction projects where multiple players contribute to a temple, city wall, wharf, or another shared building.
- [ ] Make community buildings unlock real gameplay systems, rather than serving only as decoration.
- [ ] Introduce merchant caravans as cooperative missions.
- [ ] Create social market days where each player can choose to run a stand.
- [ ] Allow players to organize religious festivals.
- [ ] Add a scribe board showcasing neighbours' accomplishments.
- [ ] Support persistent relationships between individual players, including trading relationships and gift giving.
- [ ] Introduce occasional district problems for players to respond to together.
