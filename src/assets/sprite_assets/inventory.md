# Ancient Sumer Sprite Asset Inventory

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

Total PNG assets: 48

`farmSprites.ts` registers runtime textures; `manifest.json` and `manifest.csv`
catalog the PNG files. `contact-sheet.png` is the original generation preview,
not a current catalog (it does not include market, market-sign, or fishing assets).
