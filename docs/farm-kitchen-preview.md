# Farm kitchen artwork preview

Generated with the built-in image generation tool on November 4, 2026, using
the former level-9 farmhouse as the edit reference. That superseded reference
and the abandoned attached-kitchen preview are no longer shipped. The prompt
below is retained as generation history.

The compact 1×1 kitchen and placement were approved on November 4, 2026.
Real construction now uses the standard Buildings drawer flow, unlocked at estate
level 11. The temporary Start/Stop button and trial renderer have been removed.
Cooking and its approved four-direction animation are now connected to saved meal jobs.

Assets: `kitchen/kitchen-single-tile-test.png` and
`kitchen/kitchen-single-tile-vertical-test.png`. The historical filenames are kept;
these are the approved assets, not an active test. The kitchen is independent
of the approved historical farmhouse stages.

Placement accepts all four adjacent completed connected road sides, including
free non-arable ground south of the main road. Standard server placement rules
protect occupied ground, arable tiles, roads, rivers and building access. Saved
loading-tile coordinates determine the road-axis orientation on every redraw.
`kitchenAppearance.ts` shares sprite registration between placement and built views.

Both source frames display at 128 × 85.33 world pixels with origin (0.5, 0.86)
and tile-centre +24px vertical registration. The approved shadow is the building
silhouette. Cost: 2 reeds + 4 clay; duration: 2 minutes; limit: one per estate.
The standard saved construction job owns timing and consumption, independent of
animation callbacks. See `game-progression.md` for the current level cap.

## Generation prompt

Edit this approved isometric farmhouse sprite into a kitchen-enabled farmhouse for the same farming game. Preserve building geometry, camera angle, scale, roof, doorway, blue striped awning, wooden ladder, palette and painted cartoon style exactly. Preserve original 1024 square framing and building ground registration. Add a compact outdoor cooking corner against the front-right corner by replacing the two large decorative jars with a low mud-brick hearth supporting a round terracotta cooking pot, a tiny wooden preparation surface with a bowl, and a few neatly stacked firewood pieces. These additions must fit in the space already occupied by the two jars, stay within the building's existing silhouette footprint, leave the doorway unobstructed and not spread out beyond the building. No person, no text, no scenery or ground tile, no cast shadow, no smoke or large flames. Full isolated sprite on genuinely transparent background. Crisp detailed edges matching reference.

## Cooking animation (approved November 5)

The real cooking job presents the farmer on the saved connecting road tile, facing the pot, using the
idle plus three cooking frames in a 0–1–2–3–2–1 loop (260 ms per frame). All frames
share crop bounds, foot registration, normal farmer size and sharpening.
Flames flicker at both sides of the pot base and four staggered steam puffs rise
above it. Reduced motion holds the idle pose and steady flames without steam.
Animation samples the saved cooking start timestamp after the supply journey.
Flames, steam and hand motion stop at completion; reloads and hidden tabs never
restart or delay the job. Ingredients and automatic meal consumption remain
server-owned. The Start/Stop control and temporary direction examples are removed.

### Kitchen base registration correction

The full 128 × 85.33 frame and origin stay unchanged. Position now aligns the
artwork's ground-contact centre (horizontal: 50% x / 67% y; vertical: 49% x /
67% y) with the tile centre rather than anchoring the transparent lower margin
to the tile's front tip. This applies to placement and completed kitchens.
Cooking effects follow the kitchen translation; farmer road position, reach,
frame timing and flame offsets remain unchanged for the first visual review.

After approval of the centred kitchen, the cooking worker stands 0.42 tile
from the connecting road's centre toward the kitchen. His feet remain inside
the road tile, near its kitchen-facing edge; his shadow follows the same anchor.
Kitchen registration, scale, flame positions and frame timing are unchanged.

### Approved directions

Road NW and Road NE use the approved front-view idle and three hand-motion
frames, mirrored toward the pot. Road SE and Road SW retain the rear-view frames.
Each set shares its crop and foot registration with the same sharpening and
frame timing. Far-side workers render behind the kitchen; near-side workers
remain above the flames. The saved connecting road selects the direction automatically.

The front-view NW/NE worker uses a 0.70-tile visual reach toward the kitchen
instead of 0.42, bringing his hands closer to the pot. His shadow follows him;
the saved road tile and SE/SW placement are unchanged.
