# Road alignment revision

Generated using the built-in image tool. Road reference: `../roads/road-ne-sw.png`.
Selected assets: `kitchen-horizontal-road-aligned-test.png` and
`kitchen-vertical-road-aligned-test.png`. Originals retained for comparison.
Target ground projection is 2:1, with edges at +/-26.565 degrees and vertical
legs. Final in-map parallelism and scale still need visual verification.
The horizontal revision has residual background haze above the pot, so it is
not yet a clean production cutout. Road connection remains required in planned
placement; no placement or gameplay implementation changed in this artwork task.

## Initial horizontal prompt

Precise perspective correction to image 1, the HORIZONTAL kitchen. Image 2 is ONLY the road projection reference, do not include road in output. Rebuild kitchen in strict 2:1 dimetric orthographic projection matching the diamond road tile: all straight world-ground edges have slopes +0.5 or -0.5 (26.565 degrees to image horizontal), all vertical supports remain truly vertical. In particular the stove front bottom edge and the table front apron edge must run down-right at +26.565 degrees, parallel to the corresponding road diamond edge, not the current shallow 18 degree angle. Table side edges run up-right at -26.565 degrees. Stove and table rest on the same plane, adjacent two equal tiles ONE ROW by TWO COLUMNS, stove upper-left, table lower-right. Preserve approved pot, bowl, wooden utensils, arched fuel opening, logs, palette and illustrated style. Working face accessible along long lower-left side for an adjacent road. Correct geometry, do not rotate entire sprite in image plane. Remove ALL brown glow and halo. Genuinely transparent background, no floor, road, cast shadow, gradient, glow, people or text. Full sprite clean cutout with margins.

## Initial vertical prompt

Correct only the perspective of image 1 VERTICAL kitchen using image 2 road tile as exact ground projection reference. Keep stove upper-right, table lower-left. TWO ROWS by ONE COLUMN footprint. Strict 2:1 orthographic dimetric grid: long working-side edges run from lower-left to upper-right at -26.565 degrees (slope -0.5), cross edges at +26.565 degrees (slope +0.5). The stove base and table apron must parallel the straight edges of the road tile. Currently the receding edges are too steep: reduce their slope to match the road. All table legs and stove upright edges remain vertical; do NOT tilt the sprite. Preserve pot, stone supports, arched opening facing lower-right, logs, bowl and utensils, approved proportions and painted warm cartoon style. Keep road-access working side unobstructed. Do not draw road, tile, people, labels or floor. Remove glow/halo completely; output actual transparent background, no background illumination or shadow. Full isolated sprite with clean edges and generous margins.

## Selected vertical follow-up

Precision correction: this sprite was flattened too much. Increase all ground-plane slopes from about 0.4 to exactly 0.5, matching a 2:1 isometric diamond. Table long right apron and stove bottom right edge both rise 1 pixel per 2 pixels rightwards. Table front short edge falls 1 pixel per 2 pixels rightwards. Keep vertical legs vertical. Preserve all objects and style and transparent background. No glow or shadows. Keep pot round in this correct isometric camera rather than flattened. Same vertical orientation stove upper-right and table lower-left.

## Selected horizontal follow-up

Create matching opposite orientation of THIS clean transparent kitchen. Reflect the arrangement so stove is upper-left and table is lower-right, then correct lighting to remain from upper-left. Preserve the exact 2:1 dimetric projection of this image, all front base and table apron lines descend at 26.565 degrees to right and other edges ascend at26.565. Vertical legs remain vertical. Match identical pot, hearth, firewood, utensils, table proportions, appearance. Horizontal one row two columns kitchen. Keep background genuinely transparent as here. No halo, no glow, no shadows, no floor. Same clean cutout framing.
