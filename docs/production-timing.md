# Production is independent of presentation

Golden rule: a start command is sent immediately, before any movement, tween or
arrival callback. The server reserves inputs and writes start/completion timestamps
in the same transaction. Production completion is settled lazily by
`advanceFarmLifecycle`, exactly once under the farm lock. No background browser
timer, server daemon or second "arrived" request is required.

`IsometricFarm.tsx` submits manual milling, donkey milling, baking and brewing
commands before their visual trips. `planProductionJourney` computes
and persists a road-preferred route, supply pickup index and donkey pickup/drop
indices. Travel uses `WORKER_MOVE_DURATION_PER_TILE` with the farmer's departure-time
happiness/hunger multiplier saved as `stepDurationMs`. Validated position hints
select the initial farmer/donkey positions; unreachable hints fall back to the farm.
The client cannot supply durations, routes or economic timestamps.
`startedAt` is the scheduled production start (possibly in the
future), not the button-click time. `completesAt` includes preparation and recipe
time. Existing jobs with past starts remain compatible; no migration is needed.

The farmer is unavailable throughout manual milling/baking, and during donkey
preparation only. Both server availability and client actions enforce that rule.
The client interpolates the saved path directly from elapsed time. There is no
independently timed preparation tween or fixed allowance to wait out on arrival.
Canvas busy sprites and production bars are presentation-only: they remain idle
during preparation and while the local arrival presentation is pending. At the
deadline, reconcile the actor to the building before revealing busy visuals.
Restored jobs use their saved start time; no arrival request gates production.
Visibility restoration reconciles the presentation deadline and refreshes saved
state; it never restarts the production clock. Reloading does not recreate the
start command. Start requests use fetch keepalive, but only server acceptance
guarantees persistence (offline/rejected requests cannot create a job).

Audit: manual milling, donkey milling, flour delivery before baking and the walk
before starting brewing previously gated production. All now submit immediately.
Production completion already used server timestamps. Building upgrades already
submit directly from their popups. Batch field work has its own saved/lazy
schedule. Separate interactive gathering, finished-goods collection/delivery and
construction travel are not manufacturing starts and are not redesigned here.

Regression tests must advance server time without any Phaser callback or second
start call, test reload/catch-up during preparation and after completion, and prove
no duplicate spending or output. New production flows must follow this pattern.

Porter hiring records the validated market-road position. Deliveries animate the
saved path and pickup/completion timestamps directly, including after reload;
there is no additional client-only market approach. Idle separation remains a
cosmetic offset; starting another trip reconciles it to the saved position.
Existing hired porters keep their persisted position instead of being moved on reload.

Batch harvesting ends with a persisted `delivering` phase in the existing batch
slot: granary ID, road-preferred path, departure and arrival timestamps. The farm
lock protects the arrival deposit; capacity is checked then, surplus remains
carried, and no warehouse/farm overflow is automatic. No reachable completed
granary means the batch ends with the barley carried. The scene interpolates this
saved route and only requests reconciliation at arrival, never a separate deposit.
`lastHarvestDelivery` records the result and destination for catch-up positioning
and idempotent late callbacks. Reload and background catch-up require no animation.

New planting and harvesting batches also persist `travelPaths`, `collectionPath`
and `travelStartedAt`. The client submits its current farm-local position as a
hint, validated for reachability by the server. Both collection and inter-field
movement sample the saved path between `travelStartedAt` and `nextStepAt`;
snapshot changes do not start a competing tween. The lifecycle advances the
departure timestamp and shifts paths alongside `travelMs`. Early arrival requests
cannot skip saved travel. Legacy jobs without paths retain their previous visual
fallback and offline deadlines; no database migration is needed for these optional
JSON fields.
