ALTER TABLE "farms" ADD COLUMN "sleep" jsonb DEFAULT '{"history":[],"session":null}'::jsonb NOT NULL;
