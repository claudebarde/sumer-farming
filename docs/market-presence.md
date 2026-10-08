# Neighbourhood market presence

`POST /api/market/presence` accepts validated join, heartbeat and leave commands.
The existing identity middleware supplies the player; neighbourhood and farmer
name are loaded server-side. Only named, settled players at level 3+ can join.
Presence is presentation data, not economic or farm state.

The scene polls serially every 500 ms after each response. Remote farmers follow
road paths between snapshots at 180 ms per tile; this is near-live polling, not
lockstep multiplayer. Coordinates are relative to the shared square, with the
responsive approach road normalized to three tiles. Resizing rebuilds sprites
without creating a new visit. Remote sprites have no input handlers.

Visits are keyed by player and random session UUID. Queries return only the same
neighbourhood, exclude self, and deduplicate multiple tabs using the newest live
session. Heartbeats expire after 15 seconds. Leave tombstones prevent late join or
heartbeat requests from resurrecting departed visitors. An old tab cannot close
another tab's visit. Hidden tabs leave; returning creates a fresh session.
Failed requests clear remote actors, show a reconnecting notice, and retry;
trading remains independent. Owner-scoped lazy cleanup removes day-old rows.

Apply migration `0050_market-presence.sql` before testing. Open two different
development players that are named, level 3+ and members of the same neighbourhood
in separate visible windows. Enter the market in both and visit different stands.
Check names, movement, return-home removal, resize and network-loss expiry.
No public multiplayer access is enabled: the existing development-only identity
boundary remains in place. Production authentication, WebSockets, chat, shared
economic market scoping and offline wandering are not implemented by this change.
