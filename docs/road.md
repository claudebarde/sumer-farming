# Estate road

Row index 5 (the sixth canvas row) is a horizontal road across the whole canvas,
including eight formerly arable tiles. It uses `mud-road-horizontal.png`.
Planting, buildings overlapping that row, and dropping inventory there are
rejected. New scenery generation excludes the road. The market avoids it too.

Canals retain their normal construction, connectivity, and destruction rules.
On the road they render as `horizontal-bridge-over-irrigation-canal.png`, with
water flowing beneath the horizontal road. Road and bridge tiles remain walkable.
Destroying a crossing reveals the road again. Visitors are not implemented yet.

Migration 0030 removes road bushes and relocates other road objects to the nearest
free non-arable bank tile, preserving harvestable resources. It refuses to run
if crops, loose goods, or building footprints overlap the road: those require
an explicit relocation decision rather than silent deletion.
