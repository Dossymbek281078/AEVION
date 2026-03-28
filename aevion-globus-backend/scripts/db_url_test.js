const dotenv = require("dotenv");
dotenv.config();

const { Pool } = require("pg");

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("DATABASE_URL is not set");
    process.exit(1);
  }

  const pool = new Pool({ connectionString: url });
  try {
    const r = await pool.query("SELECT 1 as ok");
    console.log("DB_OK", r.rows[0]);
  } catch (err) {
    console.log("DB_ERROR_CODE", err.code);
    console.log("DB_ERROR_NAME", err.name);
    console.log("DB_ERROR_MESSAGE", err.message);
    console.log("DB_ERROR_DETAIL", err.detail);
    console.log("DB_ERROR_HINT", err.hint);
    console.log("DB_ERROR_STACK", err.stack);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

main();

