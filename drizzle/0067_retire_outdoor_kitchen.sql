-- Indoor kitchens replace the retired outdoor building. No refunds requested.
-- Preserve indoor cooking jobs and every existing furniture layout.
UPDATE farms
SET production = jsonb_set(production, '{cooking}', 'null'::jsonb),
    version = version + 1, updated_at = now()
WHERE production->'cooking' IS NOT NULL
  AND production->'cooking' <> 'null'::jsonb
  AND NOT (production->'cooking' ? 'interior');
--> statement-breakpoint
UPDATE farms SET version = version + 1, updated_at = now()
WHERE id IN (SELECT farm_id FROM farm_buildings WHERE type = 'kitchen');
--> statement-breakpoint
DELETE FROM farm_buildings WHERE type = 'kitchen';
