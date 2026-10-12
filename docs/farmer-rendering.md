# Farmer rendering comparison

## Approved baseline — October 9, 2026

The player approved the progressive-downsampling version: sharper lines and more
visible details. Preserve this baseline while testing further refinements.

- Source: `src/assets/sprite_assets/pngs/v2/farmer-idle-refined.png` (large source).
- Find visible bounds with alpha greater than 16; crop transparent padding.
- Halve the cropped image until its height is at most 224 pixels.
- Use Canvas 2D high-quality smoothing at every reduction.
- Prepare a 128×128 texture. Fit the character within 112×112 pixels, center
  horizontally, and place the feet at texture y=120.
- Display in the existing 64×64 actor frame: maximum visible height 56 pixels,
  feet at y=60. Use Phaser LINEAR texture filtering.
- Leave all other sprites, camera settings and scene filtering unchanged.

## Current trial — awaiting visual approval

After preparing the texture, apply a mild 0.15 unsharp adjustment to RGB using
the average of four neighbouring pixels. Preserve alpha and skip translucent
edges and pixels beside transparency to avoid outline fringes. Runs only when
the texture is created, not every frame. Walking/work artwork is unchanged.

To restore the approved baseline, set `FARMER_SHARPEN_AMOUNT` to `0` in
`src/client/game/phaser/farmerTexture.ts`. No image regeneration is required.
