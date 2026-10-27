import { test } from "node:test";
import assert from "node:assert/strict";
import { createApp } from "../../src/app.ts";
import { InMemoryTicketRepository } from "../helpers/in_memory_repository.ts";
import type { Ticket } from "../../src/types.ts";

const BASE = "http://localhost:8000";

function request(path: string, method = "GET", body?: unknown): Request {
  return new Request(BASE + path, {
    method,
    ...(body === undefined ? {} : {
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    }),
  });
}

type TicketResult = { data: Ticket };
type TicketListResult = {
  data: Ticket[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
};
type StatusResult = { status: string };
type ErrorResult = { error: { code: string; message: string } };

async function result<T>(response: Response): Promise<T> {
  return await response.json() as T;
}

test("GET /health and /ready return service status", async () => {
  const app = createApp(new InMemoryTicketRepository());
  assert.equal((await result<StatusResult>(await app(request("/health")))).status, "ok");
  assert.equal((await result<StatusResult>(await app(request("/ready")))).status, "ready");
});

test("POST creates ticket and GET retrieves it", async () => {
  const app = createApp(new InMemoryTicketRepository());
  const created = await app(request("/api/tickets", "POST", {
    title: " Monitor not working ", priority: "high", description: "HDMI no signal",
  }));
  assert.equal(created.status, 201);
  const ticket = (await result<TicketResult>(created)).data;
  assert.equal(ticket.title, "Monitor not working");
  assert.equal(ticket.priority, "high");
  assert.equal(ticket.status, "open");
  assert.equal(created.headers.get("location"), `/api/tickets/${ticket.id}`);

  const get = await app(request(`/api/tickets/${ticket.id}`));
  assert.equal(get.status, 200);
  assert.equal((await result<TicketResult>(get)).data.id, ticket.id);
});

test("GET list supports filters and pagination metadata", async () => {
  const app = createApp(new InMemoryTicketRepository());
  await app(request("/api/tickets", "POST", { title: "First incident", priority: "high" }));
  await app(request("/api/tickets", "POST", { title: "Second incident", priority: "low" }));
  await app(request("/api/tickets", "POST", { title: "Third incident", priority: "high" }));
  const list = await result<TicketListResult>(await app(request("/api/tickets?priority=high&page=1&limit=1")));
  assert.equal(list.data.length, 1);
  assert.equal(list.pagination.total, 2);
  assert.equal(list.pagination.totalPages, 2);
  assert.equal(list.pagination.limit, 1);
});

test("PATCH updates status and priority; DELETE removes ticket", async () => {
  const app = createApp(new InMemoryTicketRepository());
  const id = (await result<TicketResult>(await app(request("/api/tickets", "POST", {
    title: "VPN problem",
  })))).data.id;
  const response = await app(request(`/api/tickets/${id}`, "PATCH", {
    status: "resolved", priority: "low",
  }));
  assert.equal(response.status, 200);
  assert.equal((await result<TicketResult>(response)).data.status, "resolved");
  const removed = await app(request(`/api/tickets/${id}`, "DELETE"));
  assert.equal(removed.status, 204);
  assert.equal(await removed.text(), "");
  assert.equal((await app(request(`/api/tickets/${id}`))).status, 404);
});

test("input errors return structured 400 errors", async () => {
  const app = createApp(new InMemoryTicketRepository());
  const response = await app(request("/api/tickets", "POST", { title: "a" }));
  assert.equal(response.status, 400);
  assert.equal((await result<ErrorResult>(response)).error.code, "VALIDATION_ERROR");
  assert.equal((await app(request("/api/tickets?limit=-1"))).status, 400);
  assert.equal((await app(request("/api/tickets/not-a-uuid"))).status, 400);
});

test("rejects invalid JSON and missing content-type", async () => {
  const app = createApp(new InMemoryTicketRepository());
  const malformed = new Request(BASE + "/api/tickets", {
    method: "POST", headers: { "content-type": "application/json" }, body: "{not valid",
  });
  assert.equal((await app(malformed)).status, 400);
  const noContentType = new Request(BASE + "/api/tickets", {
    method: "POST", body: "{}",
  });
  assert.equal((await app(noContentType)).status, 415);
});

test("missing tickets and routes are 404; unsupported methods are 405", async () => {
  const app = createApp(new InMemoryTicketRepository());
  const id = "0d4c2411-cbd1-40fb-af18-50ca8af22f2a";
  assert.equal((await app(request(`/api/tickets/${id}`))).status, 404);
  assert.equal((await app(request(`/api/tickets/${id}`, "DELETE"))).status, 404);
  assert.equal((await app(request("/unknown"))).status, 404);
  const method = await app(request("/api/tickets", "PUT", { title: "Sample" }));
  assert.equal(method.status, 405);
  assert.equal(method.headers.get("allow"), "GET, POST");
});
