# Clay carrying sprite

## Walking frames

Created with the built-in image generation tool. Saved alongside the approved idle sprite:

- `farmer-carry-clay-walk-01.png`
- `farmer-carry-clay-walk-02.png`

The player-supplied replacement walking frames are wired into clay carrying, ground pickup and storage trips. The idle sprite is used while standing with clay. The old separate clay-pile overlay is removed.
Walking alternates the two frames with the same distance cadence as bread carrying.
Match a shared head/torso scale and baseline when preparing textures; do not
independently fit each frame's changing leg bounds.

### Frame 01 prompt

Use case: identity-preserve. Generate ONE transparent walking animation frame for the clay-carrying farmer in image 1. Image 1 is the authoritative character and cargo reference: preserve exactly his face, headband, hair, beard, body proportions, colors, wicker basket, brick count and arrangement. Keep the head, torso, arms and basket in the exact same canvas position and scale as image 1, on a 1254 x 1254 square transparent canvas. Image 2 is only a walking leg-pose guide, NOT a cargo or face reference. Change only the lower kilt and legs to a right-facing walking stride: near leg (on viewer's left) bent back with heel lifted, far leg extended forward toward screen right with foot planting. Both hands firmly support the basket of clay bricks, no bread. Preserve the approved elevated three-quarter view, full body, same foot ground baseline, margins, crisp rounded illustrated outlines and soft shading. No added props, text, floor, shadow, motion blur, ghosting, or extra limbs. This is frame 01 of a looping walk; upper body must remain stable.

### Frame 02 final prompt

Edit the provided clay-carrying farmer to make the opposite walking step. Preserve EVERYTHING above the knees exactly, particularly head/face/basket/bricks and position on transparent square canvas. Critical change: the leg on the LEFT SIDE OF THE IMAGE must now be the straight supporting leg, descending toward the BOTTOM LEFT with a large planted foot near x450,y1160 on a 1254 square. The leg on the RIGHT SIDE OF THE IMAGE must be lifted with its knee bent, foot tucked upward behind toward x660,y1060. The foot on the RIGHT must NOT be extended forward toward the bottom-right. This is a deliberate reversal of the leg pose in previous attempts. Two legs and two feet only. Keep face and whole torso facing right exactly as reference. Same beautiful soft illustrated style, identical clothing, true transparent background, no shadow, no text. Single full body frame.

Generated with the built-in image generation tool for visual review; not wired into gameplay yet.

Output: `src/assets/sprite_assets/pngs/v2/isometric-test/clay/farmer-carry-clay-idle-test.png`

References: `bread-oven-active/farmer-carry-bread-idle.png` (edit target) and `pngs/brick-pile.png` (brick appearance).

## Prompt

Use case: precise-object-edit. Create a transparent PNG game sprite by editing image 1, the approved idle farmer carrying a bread basket. Replace ONLY the bread inside his wicker basket with a modest stack of rectangular ochre clay bricks matching the shape, color and illustrated texture in image 2. About five or six readable bricks, securely sitting INSIDE the basket with a few above its rim, not floating or pasted on top of the farmer. Preserve the wicker basket shape and size and both hands supporting it. Preserve EXACTLY the farmer identity, friendly face, eyes, beard, hair, cream headband, skin color, white kilt, bare feet, body proportions, standing pose, three-quarter orientation facing right, image framing, character scale and foot baseline from image 1. Full body visible with same margins. Match the clean rounded illustrated style and soft shaded outlines of image 1; crisp high resolution, not pixel art. No text, number, label, ground tile, scenery or cast shadow. Genuine transparent background. Output one single idle clay-carrying farmer sprite, not a sprite sheet.
