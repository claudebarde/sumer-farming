CREATE TABLE neighbourhoods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  city varchar(20) NOT NULL CHECK (city IN ('nippur','adab','shuruppak','umma','uruk','lagash','ur','eridu')),
  name varchar(50) NOT NULL,
  private boolean NOT NULL DEFAULT false,
  invite_code uuid NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE neighbourhood_members (
  player_id uuid PRIMARY KEY REFERENCES players(id) ON DELETE CASCADE,
  neighbourhood_id uuid NOT NULL REFERENCES neighbourhoods(id) ON DELETE CASCADE,
  slot integer NOT NULL,
  CONSTRAINT neighbourhood_slot_unique UNIQUE(neighbourhood_id, slot),
  CONSTRAINT neighbourhood_slot_range CHECK (slot BETWEEN 1 AND 10)
);
-- One-time placement of the existing primary development player, not a new-player default.
WITH home AS (
  INSERT INTO neighbourhoods(city, name)
  SELECT 'lagash', 'Lagash neighbourhood 1'
  WHERE EXISTS (SELECT 1 FROM players WHERE id = '00000000-0000-4000-8000-000000000001')
  RETURNING id
)
INSERT INTO neighbourhood_members(player_id, neighbourhood_id, slot)
SELECT '00000000-0000-4000-8000-000000000001', id, 1 FROM home;
