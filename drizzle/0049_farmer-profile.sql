ALTER TABLE farms ADD COLUMN farmer_profile jsonb;
-- Name only the existing primary farmer. New farms must choose their own name.
UPDATE farms SET farmer_profile = '{"version":1,"identity":{"name":"Meskalamdug"}}'::jsonb
WHERE player_id = '00000000-0000-4000-8000-000000000001';
