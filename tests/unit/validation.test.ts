import { test } from "node:test";
import assert from "node:assert/strict";
import { HttpError } from "../../src/errors.ts";
import {
  parseCreateTicket,
  parseTicketQuery,
  parseUpdateTicket,
  validateTicketId,
} from "../../src/validation.ts";

function expectValidationError(action: () => unknown): void {
  assert.throws(action, (error: unknown) => error instanceof HttpError && error.status === 400);
}

test("create: trims values and defaults priority", () => {
  assert.deepEqual(parseCreateTicket({ title: "  Printer offline  ", description: "  Floor 2 " }), {
    title: "Printer offline",
    description: "Floor 2",
    priority: "medium",
  });
});

test("create: rejects missing, short or long titles", () => {
  expectValidationError(() => parseCreateTicket({}));
  expectValidationError(() => parseCreateTicket({ title: "  a  " }));
  expectValidationError(() => parseCreateTicket({ title: "x".repeat(121) }));
});

test("create: rejects malformed priority, long description, and unknown fields", () => {
  expectValidationError(() => parseCreateTicket({ title: "Valid", priority: "urgent" }));
  expectValidationError(() =>
    parseCreateTicket({ title: "Valid", description: "x".repeat(2001) })
  );
  expectValidationError(() => parseCreateTicket({ title: "Valid", extra: true }));
});

test("create: supports null description", () => {
  assert.equal(parseCreateTicket({ title: "Laptop issue", description: null }).description, null);
});

test("update: only accepts status and priority", () => {
  assert.deepEqual(parseUpdateTicket({ status: "in_progress" }), { status: "in_progress" });
  assert.deepEqual(parseUpdateTicket({ priority: "high" }), { priority: "high" });
  expectValidationError(() => parseUpdateTicket({}));
  expectValidationError(() => parseUpdateTicket({ status: "closed" }));
  expectValidationError(() => parseUpdateTicket({ title: "Not supported" }));
});

test("query: validates status, priority and pagination", () => {
  assert.deepEqual(parseTicketQuery(new URLSearchParams()), { page: 1, limit: 20 });
  assert.deepEqual(parseTicketQuery(new URLSearchParams("status=open&priority=high&page=2&limit=5")), {
    status: "open",
    priority: "high",
    page: 2,
    limit: 5,
  });
  expectValidationError(() => parseTicketQuery(new URLSearchParams("limit=101")));
  expectValidationError(() => parseTicketQuery(new URLSearchParams("page=0")));
  expectValidationError(() => parseTicketQuery(new URLSearchParams("status=done")));
  expectValidationError(() => parseTicketQuery(new URLSearchParams("unexpected=value")));
  expectValidationError(() => parseTicketQuery(new URLSearchParams("page=1&page=2")));
});

test("ticket IDs must be UUIDs", () => {
  assert.equal(validateTicketId("d8481cd4-6c8e-4bb4-9618-605ee38250cb"),
    "d8481cd4-6c8e-4bb4-9618-605ee38250cb");
  expectValidationError(() => validateTicketId("anything' OR 1=1"));
});
