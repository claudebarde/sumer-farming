# Two-player market testing

Start the game with `npm run dev`. The header has a **Test player** selector.
You can also open two tabs at `/?devPlayer=primary` and `/?devPlayer=second`.
The choice belongs to the URL/tab; switching reloads the game to clear Phaser
and React state belonging to the previous player.

The primary player's existing farm is preserved. Test Player 2 gets its own
farm, 20 test shekels and 2 stored barley on first creation, alongside the normal
initial ground objects. These resources are development fixtures; ordinary
players still start with zero shekels. Refreshing never replenishes them.

## Trying a trade

1. As the primary player, store some harvested barley and list it in the market.
2. Open Test Player 2, select a quantity and buy that listing.
3. Reopen the primary player's market to see the sale proceeds and remaining
   listing quantity. Open market dialogs refresh every five seconds and on focus.
   The farm also checks for remote changes every fifteen seconds while visible.
4. You can buy part of a listing. Its owner can cancel the remainder if there is
   enough storage to return the goods.

Buy and Sell listings have separate server-paginated views, five rows at a time,
ordered by price, then oldest creation time, then ID. Use Previous/Next to browse.
Buy excludes your own listings; Sell shows only yours. Listings refresh after farm
version changes or with Refresh listings. The five-second quote refresh updates
market-wide statistics without reshuffling listing rows. Totals cover all open
orders, not just the visible page.

The server transfers shekels and escrowed goods in one transaction. It rejects
self-purchases, stale quantities/prices, insufficient funds/storage and conflicting
retries. Each trade links the buyer debit and seller credit in the shekel ledger.
The **average traded price (24h)** weights completed player trades by quantity;
NPC trades and unfilled asking prices do not count toward that figure.

## Extending the test setup

- `src/game-data/developmentPlayers.ts`: allowlisted names, stable IDs and keys.
- `src/server/development/fixtures.ts`: starting shekels and stored inventory for
  each identity. Keep barley within the starting farm's 5-unit storage capacity.
- `src/server/services/initialFarm.ts`: applies fixtures on first creation using
  the ordinary farm initialization workflow.

To add another independent scenario, add a new identity and matching fixture.
The selector automatically includes it. Changes to starting resources apply to
new players/farms; they do not overwrite existing saved progress.

The development header is accepted only in Vite development mode, and only
allowlisted keys are accepted. Production game/market routes remain unavailable
until real authentication replaces this identity resolver.

Run `npm run test:server` to test isolation, HTTP routing, settlement, retries,
invalid trades and concurrent purchases. Tests create and delete their own
temporary players; neither interactive development farm is reset.
