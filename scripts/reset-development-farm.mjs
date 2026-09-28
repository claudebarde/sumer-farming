import { Client } from "pg";

const DEVELOPMENT_PLAYER_ID = "00000000-0000-4000-8000-000000000001";
const resetAll = process.argv.includes("--all");
const playerIds = resetAll
  ? [DEVELOPMENT_PLAYER_ID, "00000000-0000-4000-8000-000000000002"]
  : [DEVELOPMENT_PLAYER_ID];
const LOCAL_DATABASE_URL =
  "postgres://sumer:sumer_dev@localhost:5432/sumer_farming";
const connectionString = process.env.DATABASE_URL ?? LOCAL_DATABASE_URL;
const databaseUrl = new URL(connectionString);

if (databaseUrl.hostname !== "localhost" && databaseUrl.hostname !== "127.0.0.1") {
  throw new Error(
    "Refusing to reset a non-local database. This command is only for development."
  );
}
if (databaseUrl.pathname !== "/sumer_farming") {
  throw new Error("Refusing to reset a database other than the local sumer_farming database.");
}

const client = new Client({ connectionString });

try {
  await client.connect();
  await client.query("BEGIN");
  // --all is a fresh progression playtest, including balances and trade history.
  // Preserve the two development player identities, and never touch other players.
  if (resetAll) {
    await client.query("DELETE FROM market_orders WHERE player_id = ANY($1::uuid[])", [playerIds]);
    await client.query("DELETE FROM shekel_transactions WHERE player_id = ANY($1::uuid[])", [playerIds]);
    await client.query("UPDATE players SET shekel_balance = 0 WHERE id = ANY($1::uuid[])", [playerIds]);
  }

  const result = await client.query(
    `
      DELETE FROM farms
      WHERE player_id = ANY($1::uuid[])
      RETURNING id
    `,
    [playerIds]
  );
  await client.query("COMMIT");

  if (result.rowCount === 0) {
    console.log("No development farm exists; nothing needed to be reset.");
  } else {
    console.log(
      `${result.rowCount} development farm(s) reset${resetAll ? ", including balances and trade history" : ""}. Refresh the browser to generate fresh farms.`
    );
  }
} catch (error) {
  await client.query("ROLLBACK");
  throw error;
} finally {
  await client.end();
}
