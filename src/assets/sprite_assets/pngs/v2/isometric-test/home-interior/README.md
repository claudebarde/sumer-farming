# House interior artwork

- `courtyard-empty.png`: live empty architectural background, based on the approved furnished house.
- `courtyard-interior.png`: preserved furnished reference, not loaded by the interior view.
- `furniture/`: separate transparent PNG masters recreated from that reference. These are artwork only, not player inventory or placeable objects yet.

## Furniture

| File | Contents |
| --- | --- |
| reed-bed.png | Reed bed with pillow and striped blanket |
| wooden-stool.png | Round wooden stool |
| reed-mat.png | Rectangular woven floor mat |
| wooden-table.png | Bare low wooden table |
| clay-bowl.png | Individual shallow bowl |
| woven-basket.png | Open woven basket |
| plain-jar.png | Unpainted terracotta pot |
| painted-jar.png | Terracotta storage jar with zigzag band |

Repeated baskets, bowls and jars can reuse these masters at suitable sizes. Their canvases are not a common physical scale; calibrate display sizes against the farmer during placement implementation. No furniture is baked into the live empty house.

The empty shell preserves the source framing, architecture and painted wall border. Walkable floor geometry and foreground wall occlusion are defined separately in code.

Click-to-walk now uses `HomeInteriorScene` and the artwork-coordinate floor polygons in `interiorNavigation.ts`. Runtime wall cutouts preserve occlusion; no altered source image is needed. Furniture placement and interactions remain pending movement approval.

Wall silhouettes are traced in `interiorWalls.ts`, separately from navigation. Preserve the concave corners at the courtyard entrance and room returns: enclosing them in a broad polygon repaints floor over the actor. Doorway lanes constrain the farmer’s foot anchor to the opening centre, with an 8-pixel routing grid. Regression tests cover floor pixels outside wall masks and routes through both openings in both directions.

The two doorway headers also have passage-only occlusion caps: while the farmer crosses beneath a lintel, the upper portion must not reappear above the beam as a disconnected head. These caps are inactive for farmers standing in the courtyard or rooms.
