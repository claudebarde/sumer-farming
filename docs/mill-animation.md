# Mill animation v1

Player-approved baseline, 2026-10-13. Retained in
`src/client/game/phaser/millAnimation.ts`; no mock building or test control remains.
This is a saved presentation module, not yet real production integration.

## Approved artwork and layout

All assets are in `src/assets/sprite_assets/pngs/v2/isometric-test/mill-active/`:

- `mill-active-base.png`: shared base, 160px square display frame.
- `mill-lever-01.png`: separate lever in both states.
- `mill-active-bowl.png`: always visible beneath the flour outlet.
- `mill-active-bags.png`: right side, visible only while idle.
- `farmer-mill-push-01.png` and `farmer-mill-push-03.png`: front and rear worker poses,
  88px square display frames, registered by their hand grips.

Base size, position and origin never change between idle and active. The bowl is
25px wide, the bags 43px wide; their source aspect ratios are preserved. Coordinates
are relative to the centre of the mill's 2×2 footprint. Whole-frame downsampling
and the existing building sharpening pipeline preserve registration and clarity.
Original alternative artwork is retained on disk but is not loaded by this module.

The lever eases through 40 screen degrees south and back north over 5.6 seconds.
It layers in front of the front-facing farmer on the southward push, behind his
rear-facing pose on the return. Ten fading flour flecks fall into the bowl.
Different grip heights cause a small stance change at the turn; no full walking
cycle or donkey animation is included in this approved version.

## Integration contract

Preload `MILL_ANIMATION_SOURCES` with `source-` prefixed texture keys, then call
`prepareMillAnimation`. Call `renderMillAnimation` with the owning scene, reusable
images (or null to create them), the real building's footprint origin and elapsed
animation milliseconds. Null elapsed means idle: hide worker/flour, restore bags,
reset the lever. No hardcoded test location is retained.

When connecting to production, the scene must own elapsed time and object cleanup,
pause motion while asleep, and freeze elapsed time for reduced-motion preferences.
Recreate images after scene-wide destruction and keep the real farmer from being
rendered twice. Animation must never trigger or delay authoritative production.
Regression tests preserve the approved timing, grips, layering and stable layout.

The real isometric mill placement preview and built mill now use this composite
in its idle state, preserving the same size and registration. Construction uses
the shared pickaxe work animation at the loading tile. Farmer production now
samples the saved milling journey for collection, then runs this composite from
the saved work start until completion. The separate walking farmer is hidden
during lever work. Reduced motion freezes the pose but not the production bar.

Finished output uses the shared `buildingOutputTile` helper: the
lower-left tile inside the mill's 2×2 footprint, projected into isometric space.
Its quantity label follows the bags. The new `mill-flour-bags-isometric.png` artwork
is prepared at 96px with 0.45 sharpening and LINEAR filtering (74px display frame).
The larger frame compensates for transparent margins, matching approximately the
visible size and height of the idle bags without stretching the artwork. The
quantity chip sits 42px above the anchor to clear the taller bags.
The bags sit 16 world pixels below that tile's centre, near the lower-left edge
of the mill, regardless of the road or loading tile's position. This is separate from the decorative
idle barley bags; it retains the approved ground-item anchor.

Prop sharpness trial: progressively downsample the bowl to 64px and bags to 96px
on their longest side, then apply 0.45 RGB sharpening with alpha preserved and
LINEAR filtering. Display size, position and other mill parts remain unchanged.
Previously both used the default 256px cap and 0.35 sharpening; omit the prop
options in `prepareMillAnimation` to restore that baseline.

Flour carrying uses `farmerFlourCarry.ts`: the two supplied walking frames
alternate every 35 world pixels (the default walk's 70px complete cycle), with
the supplied idle pose when stopped. Both walking exports share fixed bounds;
the separately cropped idle export is normalized to the same 64px actor frame
and foot baseline through the approved sharpened farmer pipeline. Saved mill
deliveries select these textures, for either flour or groats. Bag selection uses
the lower-left footprint tile and a yellow overlay beneath the bag sprite.
Store walks to the loading tile empty-handed, submits the existing pickup
command, then walks with bags and submits the store command on arrival. These
are existing delivery commands, not animation-gated production. Interrupted
carried deliveries can resume via Store bags on the farmer or farm popup.
