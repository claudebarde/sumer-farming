# Sprite asset inventory

The flat-map artwork audit removed 64 unused root PNGs, followed by six images
whose consumers now use the existing isometric/newer artwork. Unused registry
entries and retired dog, porter, market visitor, and chariot renderers were also
removed. Production artwork under `pngs/v2/` remains in use.

## Replaced artwork

| Removed root image | Replacement under `pngs/` |
| --- | --- |
| `bread-basket.png` | `v2/isometric-test/bread-oven-active/bread-basket-isometric.png` |
| `beer-jars.png` | `v2/isometric-test/brewery/beer-jars-full-isometric.png` |
| `flour-bags.png` | `v2/isometric-test/mill-active/mill-flour-bags-isometric.png` |
| `donkey-1.png` | `v2/isometric-test/donkey/donkey-idle-isometric.png` |
| `empty-mill.png` | `v2/isometric-test/mill-isometric.png` |
| `farmer-stand-staff-1.png` | `v2/farmer-idle-approved-design.png` |

Construction requirements use `brewery/brewery-left-bottom-jar.png` for brewing
vessels, matching the market's brewing-vessel image instead of finished beer.
Groats continue to use their dedicated icon rather than flour bags.

## Retained root artwork

These eight images still have consumers and no equivalent replacement asset:

- `wheat-sheaf.png`: harvested barley bundle, inventory and balance icons.
- `wooden-baking-tools.png`: construction and market baking tools.
- `brick-pile.png`: clay resource and action icons.
- `reed-bundle.png`: harvested reeds and resource actions.
- `water.png`: collected water and recipe requirements (not a river tile).
- `shekels.png`: currency balances and trade rewards.
- `fish.png`: fish icons and river fish texture.
- `reeds-plant.png`: reeds growing on the map (not harvested bundles).

`farmSprites.ts` contains shared artwork still referenced by the client.
`manifest.json` and `manifest.csv` retain available historical metadata for the
remaining root files; they are not runtime loaders or exhaustive v2 inventories.
`contact-sheet.png` is a historical generation reference, not a current catalog.

Runtime glob imports load dog-walking and lyre-procession frames only from
`pngs/v2/isometric-test/`. This folder name is historical: it contains production
assets and must not be treated as an unused test directory.
