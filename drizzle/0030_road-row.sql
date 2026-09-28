-- Never silently remove player crops, buildings, or loose goods for the road.
DO $$
DECLARE obstacle record; destination record;
BEGIN
  IF EXISTS (SELECT 1 FROM farm_buildings WHERE row IN (4, 5))
    OR EXISTS (SELECT 1 FROM farm_crops WHERE row = 5)
    OR EXISTS (SELECT 1 FROM farm_ground_items WHERE row = 5) THEN
    RAISE EXCEPTION 'Clear crops, buildings and loose goods from road row 5 before applying this migration';
  END IF;

  -- Bush clearance requested by the player; retain all harvestable resources.
  DELETE FROM farm_objects WHERE row = 5 AND type = 'bush';
  FOR obstacle IN SELECT * FROM farm_objects WHERE row = 5 ORDER BY id LOOP
    SELECT c AS col, r AS row INTO destination
    FROM generate_series(-4, 11) c CROSS JOIN generate_series(0, 9) r
    WHERE r <> 5 AND NOT (c BETWEEN 0 AND 7 AND r BETWEEN 0 AND 7)
      AND NOT EXISTS (SELECT 1 FROM farm_objects o WHERE o.farm_id = obstacle.farm_id AND o."column" = c AND o.row = r)
      AND NOT EXISTS (SELECT 1 FROM farm_improvements i WHERE i.farm_id = obstacle.farm_id AND i."column" = c AND i.row = r)
      AND NOT EXISTS (SELECT 1 FROM farm_ground_items g WHERE g.farm_id = obstacle.farm_id AND g."column" = c AND g.row = r)
    ORDER BY abs(c - obstacle."column") + abs(r - obstacle.row), r, c LIMIT 1;
    IF NOT FOUND THEN RAISE EXCEPTION 'No free tile to relocate road object %', obstacle.id; END IF;
    UPDATE farm_objects SET "column" = destination.col, row = destination.row WHERE id = obstacle.id;
  END LOOP;
END $$;
