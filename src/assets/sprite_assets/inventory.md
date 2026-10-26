# Sprite asset inventory

The flat-map artwork audit removed 64 unused root PNGs, followed by six images
whose consumers now use the existing isometric/newer artwork. Unused registry
entries and retired dog, porter, market visitor, and chariot renderers were also
removed. Production artwork under `pngs/v2/` remains in use; only verified unused experiments and review sheets are removed.

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

## Approved isometric resource artwork

On October 26 the eight approved generated replacements were promoted from
`-test.png` to the canonical PNG master filenames below, replacing the old artwork.
Every runtime consumer now uses an adjacent lossless WebP copy. The previous
PNG files and previous shekels/baking-tools WebP copies have been superseded;
git history retains the old artwork. All eight new masters are 1254×1254 with alpha.
The water resource is now a droplet; it is not used for river terrain.

- `wheat-sheaf.png`: harvested barley bundle, inventory and balance icons.
- `wooden-baking-tools.png`: construction and market baking tools.
- `brick-pile.png`: clay resource and action icons.
- `reed-bundle.png`: harvested reeds and resource actions.
- `water.png`: collected water and recipe requirements (not a river tile).
- `shekels.png`: currency balances and trade rewards.
- `fish.png`: fish icons and river fish texture.
- `reeds-plant.png`: reeds growing on the map (not harvested bundles).

`farmSprites.ts` contains shared artwork still referenced by the client.
`manifest.json` and `manifest.csv` describe the approved root PNG masters; they are not runtime loaders or exhaustive v2 inventories.
The historical contact sheets, abandoned 8/16-frame mill experiments, their ZIP archives,
and unused mill/farm comparison sheets have been removed; git history retains them.

Runtime glob imports load dog-walking and lyre-procession frames only from
`pngs/v2/isometric-test/`. This folder name is historical: it contains production
assets and must not be treated as an unused test directory.

## Production action icons

`BuildingActionIcon.tsx` uses the eight 144px PNG copies in
`pngs/v2/isometric-test/icons/optimized/`. They preserve the original full canvas,
transparency and aspect ratio, with four source pixels per 36px UI pixel.
The full-resolution originals remain in the parent folder for future editing.
Do not import those masters into the UI. Regenerate a production copy on macOS with:

```sh
sips -Z 144 path/to/icons/name.png --out path/to/icons/optimized/name.png
```

The eight production files total about 181 KiB instead of 19.7 MiB.

## Lossless production sprites

Large statically imported sprites use adjacent `.webp` production copies. Their
original PNG masters are retained for editing. The first batch contains 115
images, reduced from 100.5 MiB to 57.4 MiB. All 115 copies were decoded and
verified to have identical RGBA pixels and dimensions to the originals.
No crop bounds, alpha masks, sharpening, texture preparation or animation timing
was changed. The six dog walking frames and eight musician walking frames also
use lossless WebP copies, verified for identical RGBA pixels and dimensions.
Their glob loaders select only WebP (not both formats), retaining the original
frame order and texture keys. This second batch reduces 2.06 MiB to 1.15 MiB.
The dog sitting image remains PNG.

To regenerate a copy with libwebp (the initial batch used cwebp 1.6.0):

```sh
cwebp -lossless -exact -m 6 -metadata icc source.png -o source.webp
```

Keep the full frame and ICC profile; do not use lossy, near-lossless or resize
options for these registered sprites. Verify decoded RGBA equivalence after
regeneration, including transparent pixels. Recheck the rendered game if the
master artwork itself changes.

## Preview artwork cleanup

Removed 18 unused preview PNGs/GIFs for terrain, roads, canals, farmer actions,
dog/musician walks and the retired merchant caravan (about 10 MiB). No code,
test or documentation references remained, and the runtime glob loaders select
walking WebP frames only. Git history retains the previews. Original PNG masters
and their lossless production WebP copies remain intact.
