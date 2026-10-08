# Farmer profile

The farmer belongs to the farm, not the account. `farms.farmer_profile` is a nullable JSONB document validated by `FarmerProfileSchema`, currently `{ version: 1, identity: { name } }`. Null indicates incomplete customization; migration 0049 names only the existing primary farmer Meskalamdug. A genuinely new farm starts unnamed, even if its player already has a city.

New details should be added as explicit typed sections (for example biography and personality) with defaults or a version migration. Do not accept an arbitrary client profile blob or derive character traits, gender, or abilities from name groups. Keep production, hunger, happiness, and other simulation state in their existing domain fields.

The validated `name_farmer` intention at `/api/farmer/profile` locks the farm row and saves the initial profile, incrementing the farm version. Repeating the same choice is idempotent; a conflicting second choice is rejected. Existing values and any future sections are never overwritten by this command. Farm snapshots include the profile, so the management drawer needs no separate profile cache. HTTP farm actions and frontend onboarding require a saved name; the endpoint uses existing development-only identity middleware.

Customization precedes the city map. Names come from shared game data, grouped in the UI but not used to infer additional character attributes. Future setup controls can extend the customization component and profile schema without altering city or neighbourhood membership.
