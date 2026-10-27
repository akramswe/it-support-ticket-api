import postgres from "postgres";

const url = Deno.env.get("DATABASE_URL");
if (!url) throw new Error("DATABASE_URL is required. See .env.example.");

const sql = postgres(url, { max: 1 });
try {
  // SQL is from our version-controlled file, never from a user request.
  const migration = await Deno.readTextFile("db/migrations/001_create_tickets.sql");
  // This initial migration contains two simple DDL statements; execute them
  // separately because PostgreSQL prepared queries accept one statement each.
  const statements = migration.split(/;\s*(?:\r?\n|$)/).map((part) => part.trim()).filter(Boolean);
  for (const statement of statements) {
    await sql.unsafe(statement);
  }
  console.log("Database schema is ready.");
} finally {
  await sql.end();
}
