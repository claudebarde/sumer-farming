ALTER TABLE players ADD COLUMN points_started_at timestamptz NOT NULL DEFAULT now();
--> statement-breakpoint
CREATE TABLE point_awards (
  player_id uuid NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  source varchar(200) NOT NULL,
  action varchar(40) NOT NULL,
  points integer NOT NULL CHECK (points >= 0),
  rule_version integer NOT NULL,
  completed_at timestamptz NOT NULL,
  PRIMARY KEY (player_id, source)
);
--> statement-breakpoint
-- Historical one-time achievements consume eligibility, but award no backfill.
INSERT INTO point_awards (player_id, source, action, points, rule_version, completed_at)
SELECT DISTINCT f.player_id, 'building:' || b.type::text, 'firstBuilding', 0, 1, p.points_started_at
FROM farms f JOIN players p ON p.id=f.player_id JOIN farm_buildings b ON b.farm_id=f.id
WHERE b.completes_at <= p.points_started_at ON CONFLICT DO NOTHING;
--> statement-breakpoint
INSERT INTO point_awards (player_id, source, action, points, rule_version, completed_at)
SELECT f.player_id, 'palm:' || c.column::text || ':' || c.row::text, 'plantPalm', 0, 1, p.points_started_at
FROM farms f JOIN players p ON p.id=f.player_id JOIN farm_crops c ON c.farm_id=f.id
WHERE c.crop_key='datePalm' AND c.planted_at <= p.points_started_at ON CONFLICT DO NOTHING;
--> statement-breakpoint
INSERT INTO point_awards (player_id, source, action, points, rule_version, completed_at)
SELECT f.player_id, 'upgrade:' || b.type::text || ':' || (u->>'level'), 'buildingUpgrade', 0, 1, p.points_started_at
FROM farms f JOIN players p ON p.id=f.player_id JOIN farm_buildings b ON b.farm_id=f.id
CROSS JOIN LATERAL jsonb_array_elements(coalesce(f.production->'buildingUpgrades'->b.id::text, '[]'::jsonb)) u
WHERE (u->>'completesAt')::timestamptz <= p.points_started_at ON CONFLICT DO NOTHING;
