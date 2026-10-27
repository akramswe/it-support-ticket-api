import postgres from "postgres";
import { createApp } from "./app.ts";
import { PostgresTicketRepository } from "./postgres_repository.ts";

const databaseUrl = Deno.env.get("DATABASE_URL");
if (!databaseUrl) throw new Error("DATABASE_URL is required. See .env.example.");

const port = Number(Deno.env.get("PORT") ?? "8000");
const hostname = Deno.env.get("HOST") ?? "127.0.0.1";
if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error("PORT must be an integer between 1 and 65535.");
}

const sql = postgres(databaseUrl, { max: 10, idle_timeout: 20 });
const repository = new PostgresTicketRepository(sql);

// Fail fast if the database is unavailable or the schema was not migrated.
try {
  await repository.ping();
  await sql`SELECT id FROM tickets LIMIT 0`;
} catch (error) {
  console.error("Database connection/schema check failed. Run: deno task migrate", error);
  await sql.end();
  Deno.exit(1);
}

console.log(`Ticket API listening at http://${hostname}:${port}`);
const server = Deno.serve({ hostname, port }, createApp(repository));

// Ensure open DB connections do not keep the process alive after shutdown.
try {
  await server.finished;
} finally {
  await sql.end();
}
