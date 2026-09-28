# Happiness over time

The server advances happiness lazily, including offline time:

- Levels 1–3 protect happiness at a minimum of 70 (Happy). Barley shortages do not lower it or slow walking, but automatic feeding still consumes stored barley normally.
- From level 4, fishing and normal happiness management unlock together. The decay clock starts fresh at the claim, without retroactive penalties. The level dialog explains fish treats; their eight-hour cooldown begins only after feeding a fish.
- Existing low-level farms below 70 are restored to the floor on their next server reconciliation.

- Above 50: lose one point every 12 minutes (100 to 50 in ten hours).
- At or below 50: lose one point every six hours, stopping at zero.
- Automatic barley rations still add 10; beer adds 15 and fish adds 10.
- Beer has a 24-hour cooldown; fish has an independent eight-hour cooldown.

Rations are applied chronologically at their deadlines. Partial decay intervals
are persisted so polling does not postpone decay. A ration or treat starts a new
decay interval. Food shortages directly cap happiness at 50, never below it;
independent natural decay can eventually make the farmer unhappy.

Migration 0029 starts the decay clock at migration time for existing farms,
preserving their current score without retroactive penalties. Rates live in
`src/game-data/household.ts`.
