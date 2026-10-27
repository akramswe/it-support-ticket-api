import { HttpError } from "./errors.ts";
import {
  type CreateTicketInput,
  TICKET_PRIORITIES,
  type TicketPriority,
  type TicketQuery,
  TICKET_STATUSES,
  type TicketStatus,
  type UpdateTicketInput,
} from "./types.ts";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function invalid(message: string): never {
  throw new HttpError(400, "VALIDATION_ERROR", message);
}

function objectBody(value: unknown): Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return invalid("Request body must be a JSON object.");
  }
  return value as Record<string, unknown>;
}

function rejectExtraKeys(body: Record<string, unknown>, allowed: string[]): void {
  const unexpected = Object.keys(body).find((key) => !allowed.includes(key));
  if (unexpected) invalid(`Unknown field: ${unexpected}`);
}

function isStatus(value: unknown): value is TicketStatus {
  return typeof value === "string" && TICKET_STATUSES.some((status) => status === value);
}

function isPriority(value: unknown): value is TicketPriority {
  return typeof value === "string" &&
    TICKET_PRIORITIES.some((priority) => priority === value);
}

export function validateTicketId(id: string): string {
  if (!UUID_PATTERN.test(id)) return invalid("Ticket ID must be a valid UUID.");
  return id;
}

export function parseCreateTicket(value: unknown): CreateTicketInput {
  const body = objectBody(value);
  rejectExtraKeys(body, ["title", "description", "priority"]);

  if (typeof body.title !== "string") invalid("title must be a string.");
  const title = body.title.trim();
  if (title.length < 3 || title.length > 120) {
    invalid("title must contain 3 to 120 characters.");
  }

  let description: string | null = null;
  if (body.description !== undefined && body.description !== null) {
    if (typeof body.description !== "string") invalid("description must be a string or null.");
    description = body.description.trim();
    if (description.length > 2000) invalid("description cannot exceed 2000 characters.");
  }

  const priority = body.priority === undefined ? "medium" : body.priority;
  if (!isPriority(priority)) invalid("priority must be low, medium, or high.");

  return { title, description, priority };
}

export function parseUpdateTicket(value: unknown): UpdateTicketInput {
  const body = objectBody(value);
  rejectExtraKeys(body, ["status", "priority"]);
  if (Object.keys(body).length === 0) {
    invalid("Supply status and/or priority to update.");
  }
  if (body.status !== undefined && !isStatus(body.status)) {
    invalid("status must be open, in_progress, or resolved.");
  }
  if (body.priority !== undefined && !isPriority(body.priority)) {
    invalid("priority must be low, medium, or high.");
  }
  if (body.status === undefined && body.priority === undefined) {
    invalid("Supply status and/or priority to update.");
  }
  return {
    ...(body.status !== undefined ? { status: body.status as TicketStatus } : {}),
    ...(body.priority !== undefined ? { priority: body.priority as TicketPriority } : {}),
  };
}

function parsePositiveInteger(value: string | null, fallback: number, field: string): number {
  if (value === null) return fallback;
  if (!/^[1-9][0-9]*$/.test(value)) invalid(`${field} must be a positive integer.`);
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed)) invalid(`${field} is too large.`);
  return parsed;
}

export function parseTicketQuery(search: URLSearchParams): TicketQuery {
  const allowed = new Set(["status", "priority", "page", "limit"]);
  for (const key of search.keys()) {
    if (!allowed.has(key)) invalid(`Unknown query parameter: ${key}`);
    if (search.getAll(key).length > 1) invalid(`Duplicate query parameter: ${key}`);
  }
  const status = search.get("status");
  const priority = search.get("priority");
  if (status !== null && !isStatus(status)) {
    invalid("status must be open, in_progress, or resolved.");
  }
  if (priority !== null && !isPriority(priority)) {
    invalid("priority must be low, medium, or high.");
  }
  const page = parsePositiveInteger(search.get("page"), 1, "page");
  const limit = parsePositiveInteger(search.get("limit"), 20, "limit");
  if (limit > 100) invalid("limit must be at most 100.");
  if (page > 10000) invalid("page must be at most 10000.");
  return {
    ...(status !== null ? { status: status as TicketStatus } : {}),
    ...(priority !== null ? { priority: priority as TicketPriority } : {}),
    page,
    limit,
  };
}
