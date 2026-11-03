# Neighbourhood market presence

`POST /api/market/presence` accepts validated join, heartbeat and leave commands.
Development identity middleware supplies the player; neighbourhood and farmer
name are loaded server-side. Only named neighbours at level 10+ can participate.
Presence is presentation data, not economic or farm state.

The isometric market polls serially every 500 ms after each response. Remote
farmers interpolate along the market roads between reported positions, using the
approved farmer sprites, names and occlusion indicators. Remote actors have no
input handlers. Presence is scoped to the neighbourhood, with at most nine other
players visible.

Visits are keyed by player and random session UUID. Queries exclude self and
show one actor per player, using the newest live session. Heartbeats expire after
15 seconds. Leave tombstones prevent late requests resurrecting departed visits.
An old tab cannot close another tab's visit. Hidden tabs leave; returning creates
a fresh session. Failed requests retry; stale remote actors clear after 15 seconds
without a successful response. Trading remains independent.

## Two-computer local test

Run `npm run dev:lan` on the host computer. This starts a second development
server on IPv4 port 5174, leaving the normal localhost:5173 server available.
Use the Network URL printed by Vite on the second computer on the same trusted
Wi-Fi. Keep the host awake and the command running. Stop it with Ctrl+C after
testing. No tunnel, router port forwarding, public DNS or unrestricted
`allowedHosts` setting is required. This remains a development server with a
player selector, not production authentication; do not expose it to the internet.

On November 2, the unused `second` test player was prepared as level 10,
“Gudea”, in the `onboarding` player's neighbourhood (slot 2).
The existing `onboarding` farm and `primary` test farm were not modified.
Use `?devPlayer=onboarding` on the host and `?devPlayer=second` on the second
computer. Keep both game tabs visible during movement testing. Check both
players entering/walking, leaving, tab hiding/return, refresh, network-loss expiry
and duplicate tabs. Browser approval is recorded in Todoist, not this document.

Client request/visit IDs use `randomId`, which falls back to cryptographically
random UUID v4 bytes via `crypto.getRandomValues` on HTTP LAN origins where
`crypto.randomUUID` is unavailable. No Math.random fallback or global crypto
patch is used. Native UUID generation remains preferred on localhost/HTTPS.

Ziggurat regression tests use separate disposable database fixtures and can run
without changing the player's live project, resources, deadlines or rewards.
Three interested eligible neighbours are still required to open real fundraising;
preparing test neighbours does not register interest or bypass that rule.

For the November 2 ziggurat playtest, `third` (Ur-Nanshe) was added at level 10
in slot 3 of the same neighbourhood. Select him in the development-player menu
or open `?devPlayer=third`. Gudea and Ur-Nanshe were each provisioned locally with
165 clay, 15 reeds, 31 barley (including the one-seed reserve), 39 bread, 18 beer,
12 dates and 250 shekels. These are deliberate over-capacity test stocks, with
matching physical inventory allocations; normal storage limits are unchanged.
The ordinary account-creation fixtures still start with the normal economy.
No interest, donations, stage timers or rewards were triggered by this setup.
The onboarding player's inventory was not modified.
