ALTER TABLE ziggurat_projects ADD COLUMN later_stages jsonb NOT NULL DEFAULT '{}';
ALTER TABLE ziggurat_donations ADD COLUMN stage integer NOT NULL DEFAULT 0;
ALTER TABLE ziggurat_donations ADD COLUMN requested_materials jsonb;
ALTER TABLE ziggurat_donations ADD COLUMN accepted_materials jsonb;
ALTER TABLE ziggurat_donations DROP CONSTRAINT ziggurat_donations_requested_clay_check;
ALTER TABLE ziggurat_donations ADD CONSTRAINT ziggurat_donations_requested_clay_check CHECK (requested_clay BETWEEN 0 AND 60);
ALTER TABLE ziggurat_donations DROP CONSTRAINT IF EXISTS ziggurat_donations_points_check;
ALTER TABLE ziggurat_donations DROP CONSTRAINT IF EXISTS ziggurat_donations_check2;
ALTER TABLE ziggurat_donations ADD CONSTRAINT ziggurat_donations_points_check CHECK (points > 0);
