# Ancient Sumer Sprite Asset Inventory

## Farm dog

- dog-on-four (1254×1254, displayed at 0.75×0.75 tiles; standing/running fetch pose with a temporary bobbing animation)
- dog-sitting (1254×1254, displayed at 0.75×0.75 tiles; idle and stopped fetch pose)
- The fetch stick and aiming arrow are temporary Phaser graphics, not PNG assets.

## Extracted existing assets

- Terrain tiles: ground, ground-grass, canal-horizontal, canal-vertical, canal-corner, canal-intersection-a, canal-intersection-b, water, mud-road-horizontal, ground-fence-tile, field-plowed, field-seeded, field-wheat-ripe
- Standalone objects: wheat-sheaf, reed-bundle, brick-pile, palm-tree, bush, reeds-plant, rocks, fence, signpost
- Buildings: farm, granary
- Farmer poses: farmer-stand-staff-1 through farmer-stand-staff-6; farmer-walk-1 through farmer-walk-4; farmer-plant-1 through farmer-plant-4; farmer-harvest-1 through farmer-harvest-2; farmer-carry-wheat-1 through farmer-carry-wheat-2

## Newly generated assets

- brewery (512×512, 2×2 building)
- market (512×512, 2×2 building; opens the market dialog on click/tap)
- market-sign (256×256, 1×1; legacy artwork, replaced on the canvas by market)

The original signpost artwork is also retained, but is not used as the market entrance.

- farmer-fishing (256×256, 1×1; farmer using a rod)
- farmer-with-fish (256×256, 1×1; farmer carrying one fish)
- fish (256×256, 1×1; swimming fishing target)

- horizontal-bridge-over-irrigation-canal (1254×1254, 1×1; road crossing over irrigation)

The horizontal mud road spans row index 5. Irrigation on that row uses the bridge
texture while retaining its canal connections and normal construction rules.

- mud-road-90-deg (1254×1254, 1×1; rotated corners of the market square)
- market-stand (512×512, 2×2; shared artwork for market stands)

- `merchant-chariot.png`: user-supplied 512×256 merchant and chariot, displayed at 3×1.5 tiles with its wheels/feet anchored to the estate road's centerline for periodic request visits.

Total PNG assets: 52

`farmSprites.ts` registers runtime textures; `manifest.json` and `manifest.csv`
catalog the PNG files. `contact-sheet.png` is the original generation preview,
not a current catalog (it does not include market, market-sign, or fishing assets).
