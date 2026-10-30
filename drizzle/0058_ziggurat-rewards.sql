ALTER TYPE farm_object_type ADD VALUE IF NOT EXISTS 'miniatureZiggurat';
--> statement-breakpoint
CREATE TABLE ziggurat_rewards (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 player_id uuid NOT NULL REFERENCES players(id) ON DELETE CASCADE,
 neighbourhood_id uuid NOT NULL REFERENCES neighbourhoods(id),
 awarded_at timestamptz NOT NULL,
 object_id uuid REFERENCES farm_objects(id) ON DELETE SET NULL,
 CONSTRAINT ziggurat_reward_once UNIQUE(player_id, neighbourhood_id)
);
