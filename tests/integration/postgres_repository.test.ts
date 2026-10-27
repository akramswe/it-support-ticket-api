import { test } from "node:test";
import assert from "node:assert/strict";
import postgres from "postgres";
import { PostgresTicketRepository } from "../../src/postgres_repository.ts";

const url = Deno.env.get("DATABASE_URL");

test("PostgreSQL repository: create, filter, update, read and delete", {
  skip: !url && "Set DATABASE_URL and run the migration to run integration tests.",
}, async () => {
  if (!url) return;
  const sql = postgres(url, { max: 2 });
  const repository = new PostgresTicketRepository(sql);
  let id: string | undefined;
  try {
    await repository.ping();
    const created = await repository.create({
      title: "Integration test ticket",
      description: "Postgres persistence check",
      priority: "high",
    });
    id = created.id;
    assert.match(id, /^[a-f0-9-]{36}$/i);
    assert.equal(created.status, "open");
    assert.equal((await repository.findById(id))?.title, "Integration test ticket");
    const filtered = await repository.list({ status: "open", priority: "high", page: 1, limit: 100 });
    assert.ok(filtered.items.some((ticket) => ticket.id === id));
    const updated = await repository.update(id, { status: "in_progress", priority: "low" });
    assert.equal(updated?.status, "in_progress");
    assert.equal(updated?.priority, "low");
    assert.equal(await repository.delete(id), true);
    id = undefined;
    assert.equal(await repository.findById(created.id), null);
  } finally {
    if (id) await repository.delete(id);
    await sql.end();
  }
});
