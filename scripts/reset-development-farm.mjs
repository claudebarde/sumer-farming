import { Client } from "pg";

const DEVELOPMENT_PLAYER_ID = "00000000-0000-4000-8000-000000000001";
const LOCAL_DATABASE_URL =
  "postgres://sumer:sumer_dev@localhost:5432/sumer_farming";
const connectionString = process.env.DATABASE_URL ?? LOCAL_DATABASE_URL;
const databaseUrl = new URL(connectionString);

if (databaseUrl.hostname !== "localhost" && databaseUrl.hostname !== "127.0.0.1") {
  throw new Error(
    "Refusing to reset a non-local database. This command is only for development."
  );
}

const client = new Client({ connectionString });

try {
  await client.connect();

  const result = await client.query(
    `
      DELETE FROM farms
      WHERE player_id = $1
      RETURNING id
    `,
    [DEVELOPMENT_PLAYER_ID]
  );

  if (result.rowCount === 0) {
    console.log("No development farm exists; nothing needed to be reset.");
  } else {
    console.log(
      "Development farm reset. Refresh the browser to generate a new farm."
    );
  }
} finally {
  await client.end();
}
