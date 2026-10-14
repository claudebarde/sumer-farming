MILL ACTIVE LAYERS — ALIGNMENT REVIEW SET

This set includes every requested separate PNG, but it is NOT a finished,
geometrically consistent animation rig. Review the limitations below before use.

FILES
mill-active-base.png: 1024 x 1024, transparent. Horizontal lever removed;
vertical spindle retained. Original artwork retained outside the repair area.
mill-lever-01.png through 08: 1024 x 1024, transparent directional layers.
farmer-mill-push-01.png through 04: 512 x 512, transparent, empty hands.
mill-assembled-preview.png: labelled four-position assembly for review only.
lever-review.png and farmer-review.png: additional review sheets.
alignment.json: export anchors, intended lever endpoints, approximate hand points.
prompts.json: prompt set, generated with the built-in image generation tool.

ALIGNMENT
Mill/lever pivot: (550, 505), measured from the upper-left corner.
Lever working-end ellipse: radii (365, 182.5); 45-degree ground-plane intervals.
Lever order: right, lower-right, down, lower-left, left, upper-left, up, upper-right.
Farmer anchor: (256, 450), shared foot-contact baseline in a 512 x 512 canvas.
Farmer directions: down, left, up/rear, right.
All four farmers received the same export scale; baseline/torso registration
uses translations. The preview uses the same 1.35 display scale for all farmers.

KNOWN LIMITATIONS
1. Hand placement does not reliably meet the lever in all views. The side views
   have grips at different heights; the rear pose spreads its hands too widely.
   Changing the whole sprite's position cannot fix both hands simultaneously.
2. The assembled preview also shows worker feet overlapping the masonry or
   sacks. These are provisional grip-based placements, not a validated circular
   route. The poses need refinement before defining the final movement path.
3. Lever axes/endpoints are registered to a common projected ellipse, but the
   independently generated wood shapes, rope attachment, thickness and shading
   are not perfectly consistent. Up/down views can read like vertical posts
   when assembled and need stronger foreshortening cues.
4. Farmer head/body shapes and apparent working height vary subtly between
   views despite uniform export scale. These are directional pose drafts.
5. The base preserves the original sprite's existing contact shading. No new
   ground shadow was added to the separate farmer or lever layers.

The inactive source sprite was not overwritten. No donkey was generated.
Refine grip geometry, route clearance, and lever continuity before treating
these images as a production animation.
