# Ziggurat sprites

Artwork for the shared neighbourhood delivery donkey. The loaded walking preview was approved. Its toolbar toggle and scene loading have been removed; sprites and the animation helper remain available for future donation deliveries.

- `donkey-loaded-idle.png`: the original loaded donkey reference, preserved here as the project asset.
- `donkey-empty-idle.png`: matching donkey with empty packs.
- `donkey-{loaded,empty}-walk-front-01.png` through `04.png`: front-facing walking cycle.
- `donkey-{loaded,empty}-walk-back-01.png` through `04.png`: rear-facing walking cycle.

The walking frames follow the existing donkey's four-frame directional cycles. Mirror the appropriate cycle for the opposite horizontal direction, as with the existing donkey. Validate registration, scale and loop timing in an in-game preview before integration; do not crop individual frames independently.

Loaded frames represent the journey carrying donations. Empty frames represent fetching and returning the shared donkey. Loading and unloading transitions will be handled when the delivery animation is implemented.

`generation-prompts.json` records prompts and references for the generated variants. The original loaded idle source is `exec-276540a4-a3fc-451a-b2de-1f588f69169b.png` in the image-generation archive; that original is retained.

## Approved placement — October 27, 2026

The player approved the current `ziggurat-completed.png` and the position read
from the neighbourhood toolbar: column **-5**, row **-2**, footprint **4 × 4**.
Preserve the 384 × 384 display size and origin `(0.5, 0.84)`, without manual
screen offsets. Rendering uses the shared fixed location, not browser storage.
The placement button, coordinate output and green footprint were removed.
The completed display remains cosmetic pending implementation of construction.
Earlier-stage sprites should retain this canvas alignment and scale.

## Construction stage review

`ziggurat-site-test.png` previews the initial donation site: wooden stakes and
rope surrounding a transparent interior, with a clay tablet on a low stand.
The site and initial interest popup are approved. The map now always displays
this initial site using the shared placement, scale and default origin. The stage
selector has been removed; approved later-stage artwork is retained for future
construction integration. Donation gameplay is not enabled by this preview.
The generation prompt is saved alongside the sprite.

All four `*-tools-test.png` stages and the completed sprite have been visually
approved individually using the former Ziggurat stage selector at the same fixed
position, scale and origin. This comparison did not change saved construction
state or consume resources.
No automatic per-stage cropping is applied, so registration can be reviewed.

Lower-terrace registration correction: its base alpha contour is approximately
127 source pixels below the completed sprite on the shared 1254px canvas.
Use origin Y `0.84 + 127 / 1254` for this stage only (about 39 world pixels up
at 384px display size). Other stages retain origin Y `0.84`; scale and depth
stay unchanged. Reset the origin on each stage change.
