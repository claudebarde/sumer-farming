# TODOs

## Next priority

- [x] Add brewery construction and NPC-market brewing jars.
- [x] Implement the barley-to-beer recipe, one-hour brewing, countdowns, and collection into estate inventory.
- [x] Add beer sales to the NPC market at 5 shekels per filled jar (NPC merchants do not sell beer), plus player listings and purchases from estate inventory.

## Later

- [ ] Design an introductory harvest that teaches irrigation correctly: consider ready-to-harvest starter fields with a river-connected canal, without implying barley can be planted anywhere. Keep normal growth at 30 minutes; use the two starting ground bundles until this is designed.
- [x] Add NPC delivery requests: three personal requests per 24-hour window, followed by a 48-hour break; server-validated atomic deliveries and ledger rewards, with brewery-gated beer requests.
- [ ] Add scheduled river trading boats: show a boat on the river during announced arrival windows, letting players interact with its crew to sell or barter barley, beer, and later goods. Give each visit limited, varying demand and clear prices or exchange terms so it removes surplus without replacing the player market. Display the next arrival and departure times; offer several windows across the day so participation does not depend on one timezone. Define schedules, demand limits, and rewards before implementation; validate availability and settle trades atomically on the server.
