# Market scene prototype

Click the estate's market building to start walking toward it. After one second,
enter `MarketScene` regardless of how far the farmer has travelled (or whether a
route was available). Repeated clicks are ignored during this transition.
A road at row five
splits around a square. Corners use two cropped, rotated sections of the straight
road sprite overlapping at the center, like the composed T-junctions; no separate
corner artwork is needed. The top stand opens the barley market and the middle
stand opens the beer market. Both reuse the trading dialog's NPC/Player and
Buy/Sell flow, restricted to the stand's product (including listings and visible
trade history). The beer stand's NPC Buy tab also sells empty beer jars at
the configured price (currently 2 shekels) and brewing jars, with the existing
two-jar purchase limit. Player trading remains finished beer only. The legacy
general dialog is removed; the third stand is now decorative and noninteractive.
The brewery's empty-jar shortcut opens the Beer market. Requests
are now accessed through the visiting merchant chariot on the estate road.
All stands share artwork. The two-tile farm at the far left returns home.
The player's farmer appears on the road directly below the return-home farm,
at the same tile scale as on the estate. His carrying sprite
stays synchronized with the shared inventory state; this is a scene-local visual,
not a separate simulated farmer. Resizing preserves this placement.

The main scene remains active but invisible with input disabled, preserving
ongoing work deadlines. Queued travel waits until the visit ends. Farm-only HUD
and fishing keyboard input are hidden/disabled during the visit. Returning stops
the market scene and reveals the original farm rather than rebuilding it. The
farmer is placed on the road beside the market's current position, then any
interrupted travel resumes. Scene shutdown cancels the transition timeout.

Both scenes install DOM overlay isolation: HTML labels share Phaser's global
DOM container, so their visibility is synchronized before rendering even when
their owning scene is hidden. Newly created background labels are hidden
immediately, and listeners are removed on shutdown. Farm React popovers and the
Manage dialog are also suppressed during market visits.

Layout is recalculated on resize; narrow screens zoom the market to fit a minimum
ten-column layout. Ordinary screens use the same 64px tile size as the estate.
