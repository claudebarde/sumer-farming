# Porter implementation

The porter is independent of farmer commands and availability.

- `src/game-data/porter.ts`: price, duration, schemas and reservation lookup.
- `src/game-core/farm/porter.ts`: pure routing, scheduling, expiry and catch-up.
- `src/server/services/porter.ts`: transactional, idempotent hiring and payment.
- `src/server/services/porterLifecycle.ts`: applies pure results under the farm lock.
- `src/client/game/phaser/porter.ts`: timestamp-driven sprite presentation and refresh; installed and disposed by MainScene.
- `src/client/components/PorterPanel.tsx`: hire action and countdown.

State lives in the existing production JSON. No porter state migration is needed for older farms. Migration 0044 adds the payment ledger transaction type and updates its constraints.

Booked goods move out of pending output into `production.porter.job`. This simultaneously reserves that quantity of storage. Inventory is credited once the persisted trip deadline passes. Market storage checks and farmer collection/deposit checks subtract porter reservations. Scheduling also respects existing farmer production cargo.

Farm lifecycle supplies actual readiness timestamps for newly completed production before porter catch-up, preventing post-expiry production being collected retroactively. Saved road-preferred paths drive both deadlines and the actor position; a blocked path leaves output unclaimed. The current trip finishes after expiry, but no new trip is accepted.

Shared goods retain the game's warehouse-first virtual allocation (not a per-building inventory ledger). Each porter trip handles one resource and one destination, capped by that destination's remaining capacity.
