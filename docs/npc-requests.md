# NPC delivery requests

Click the stopped merchant chariot on the estate road to open its requests-only
dialog. The Requests tab has been removed from the market dialog; the merchant
does not offer ordinary buying or selling yet.

Loading the estate fetches the persistent personal schedule. For a new board,
the chariot enters for 15 seconds before its first opening: 24 hours open, then
48 hours closed. Existing boards retain their original timestamps. Completing requests does not bring
forward the next window. Missed windows do not accumulate; expiry has no penalty.

The chariot travels from fully offscreen left to the center of the 8×8 plot,
staying on road row 5. It stops for the entire request window, then travels to
fully offscreen right over 15 seconds, past the market. The next arrival happens
in the final 15 seconds before the next scheduled opening. Clicking during travel
shows only “Merchant chariot”; expiry closes the requests dialog. Travel position
is derived from server timestamps, so reloads, hidden tabs, and offline periods
do not restart or extend a visit. The visitor is estate-scene-only.

Each window has three requests, fulfilled once each, with no acceptance step or
farmer journey. Starter requests require 3, 2, and 4 barley for 5, 3, and 6 shekels.
With a brewery completed before a window opens, requests are 3 barley for 5,
2 beer for 12, and 4 barley + 2 beer for 18. A brewery completed during a window
unlocks beer requests next time; it does not replace the current offers.

Only farm/completed-granary barley and estate beer count. Ground goods, carried
goods, brewery supplies, uncollected beer, and player-market escrow do not count.
The interface warns if delivery leaves less than one barley for a ration.

`src/game-data/npcRequests.ts` contains the rewards, quantities, and timing.
`src/game-core/market/npcRequests.ts` contains pure timing and stock checks.
`src/server/services/npcRequests.ts` locks the farm, advances lifecycle, verifies
the current window/version/stock, removes every ingredient, awards shekels, records
a `request_reward` ledger entry, and marks completion in one transaction. Retries
and concurrent deliveries cannot pay twice. The ledger, history, and toast identify
the customer rather than pretending a mixed delivery has a per-item price.

Migration: `0027_npc-requests.sql`. Boards belong to farms and cascade on farm
deletion. The API always resolves the player from existing server middleware;
clients cannot submit a target player ID. Public authentication remains a separate
prerequisite for public deployment, as with the other market endpoints.

Tests: `tests/server/npcRequests.test.ts`, including true concurrent connections,
expiry/renewal, stock isolation, partial-delivery prevention, and reward history.
