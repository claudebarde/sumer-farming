# Visiting other players’ homes

Implemented first version: 9 November 2026.

## Access and entry

Home visits unlock at level 10 for both the visitor and the owner. Homes are open
to **Everyone** by default, including existing homes without a saved preference.
Owners can choose **Private** in Customize home → Interior. There is no
neighbours-only restriction in this version.

Click a farmer’s name in a leaderboard or their farmhouse/label on the
neighbourhood map to open a profile. The profile shows name, level, neighbourhood,
badges and **Visit home**. Private or level-locked homes cannot be visited.

## Read-only visits

Visitors see the saved furniture arrangement, rotations, tabletop bowls and
selected wall tablet, even when the owner is offline. Their own farmer can walk
around locally. Furniture editing is unavailable; visits do not change either
player’s production or the owner’s resources, farmer or decorations. The shared
top bar, loading screen and interior renderer are reused. Back returns to the
profile and closing it returns to the originating view.

## Server boundaries

`/api/player-profile` exposes public identity only. `/api/player-home` checks both
levels and owner privacy before returning furniture and the wall tablet. It never
returns the owner’s full farm snapshot. Privacy changes save only to the current
player’s home, under a row lock. Exterior and furniture updates preserve privacy.
An open visit rechecks access every 15 seconds and when the tab becomes visible;
revoked or unavailable access closes the visit. Players are identified by UUID,
not their displayed names.

## Later possibilities (not implemented)

- Profile entry from characters in the shared market.
- Search for a friend by farmer name.
- Discover homes with random or recently decorated public homes.
- Limited appreciation reactions, without turning decoration into a spending contest.
- Live multiplayer inside homes.
