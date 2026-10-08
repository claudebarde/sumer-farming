# City residence and onboarding

`CityOnboarding` bootstraps the existing development identity, reads `/api/residence`, and gates the farm behind city selection when membership is absent. The browser never chooses an authoritative neighbourhood ID or slot. This uses the existing development-only identity middleware; public anonymous/account authentication remains unimplemented.

`SumerScene` releases its store and resize subscriptions on both scene shutdown and destruction. Destroying the onboarding Phaser game can bypass shutdown (for example during a React remount); stale listeners must never redraw a disposed camera. Cleanup removes both lifecycle handlers, allowing a stopped scene to restart with exactly one subscription.

`POST /api/residence` accepts only a validated `settle` intention with the selected city. The former `found` and `join` commands are rejected by the shared schema. `chooseResidence` serializes assignments with a transaction-scoped PostgreSQL advisory lock, checks existing membership first, and stores one numbered slot in a neighbourhood. The unique slot constraint and range 1–10 enforce capacity independently of application checks. Automatic assignment uses the oldest public neighbourhood with a free slot in the chosen city, creating one when needed. New public groups can start with one member and receive later arrivals. Legacy private memberships remain intact but are excluded from automatic assignment. The map no longer displays creation controls or invitation codes.

Membership determines city through the neighbourhood foreign key, preventing mismatched player/group cities. Retries never create a second membership. Once assigned, a player cannot change residence through onboarding. Existing farm actions require membership at the HTTP boundary; no resource balances or farm layouts change on assignment.

Migration 0048 assigns only an already-existing primary development identity to Lagash. It does not set a default city for future players. Apply via the existing Drizzle migration workflow. The development farm reset preserves player membership, just as it preserves identity; use the unassigned second identity to preview onboarding without resetting the primary farm.

## Agreed future private founding (not implemented)

Private founding is a later-game invitation flow, not an onboarding choice. A founder remains in their current group while inviting friends by link. Once the first invited friend has created an account and accepted, activate the private group and move both players together atomically. Minimum founding membership is two, maximum capacity is ten, and all members must share a city. This replaces the four-member deadline/failed-founder relocation proposal. Pending invitations must not create an active solo private group. Unlock level, invitation expiry and relocation fee currency/amount are undecided. Private groups remain connected to future Sumer-wide trading and activities.

Invitation activation, relocation, neighbourhood activities, and cross-city gameplay are not implemented. The current neighbourhood table deliberately stores only city, name, privacy, legacy invite code, and creation time. Membership count is computed, not maintained as a mutable counter.

Tests cover schema validation (including rejection of retired commands), persisted residence, retry safety, legacy privacy preservation, same-city automatic placement, concurrent assignment and overflow, city-only map controls, and the HTTP onboarding gate. Residence service tests create and remove an isolated PostgreSQL schema, never modifying interactive player memberships.
