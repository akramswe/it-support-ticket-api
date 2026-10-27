import { HttpError } from "./errors.ts";
import type { TicketRepository } from "./repository.ts";
import {
  parseCreateTicket,
  parseTicketQuery,
  parseUpdateTicket,
  validateTicketId,
} from "./validation.ts";

const JSON_HEADERS = { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" };

function json(data: unknown, status = 200, headers: HeadersInit = {}): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...JSON_HEADERS, ...headers },
  });
}

async function readJson(request: Request): Promise<unknown> {
  if (!request.headers.get("content-type")?.toLowerCase().includes("application/json")) {
    throw new HttpError(415, "UNSUPPORTED_MEDIA_TYPE", "Content-Type must be application/json.");
  }
  const raw = await request.text();
  if (raw.length > 16_384) {
    throw new HttpError(413, "PAYLOAD_TOO_LARGE", "JSON body cannot exceed 16 KB.");
  }
  try {
    return JSON.parse(raw);
  } catch {
    throw new HttpError(400, "INVALID_JSON", "Request body contains invalid JSON.");
  }
}

function methodNotAllowed(allowed: string): Response {
  return json({ error: { code: "METHOD_NOT_ALLOWED", message: "Method not allowed." } }, 405, {
    allow: allowed,
  });
}

/** Stateless HTTP handler, with persistence injected for testability. */
export function createApp(repository: TicketRepository): (request: Request) => Promise<Response> {
  return async (request) => {
    try {
      const url = new URL(request.url);
      const path = url.pathname;
      const method = request.method.toUpperCase();

      if (path === "/health") {
        return method === "GET" ? json({ status: "ok" }) : methodNotAllowed("GET");
      }
      if (path === "/ready") {
        if (method !== "GET") return methodNotAllowed("GET");
        await repository.ping();
        return json({ status: "ready" });
      }

      if (path === "/api/tickets") {
        if (method === "GET") {
          const query = parseTicketQuery(url.searchParams);
          const { items, total } = await repository.list(query);
          return json({
            data: items,
            pagination: {
              page: query.page,
              limit: query.limit,
              total,
              totalPages: Math.ceil(total / query.limit),
            },
          });
        }
        if (method === "POST") {
          const input = parseCreateTicket(await readJson(request));
          const ticket = await repository.create(input);
          return json({ data: ticket }, 201, { location: `/api/tickets/${ticket.id}` });
        }
        return methodNotAllowed("GET, POST");
      }

      const ticketPath = /^\/api\/tickets\/([^/]+)$/.exec(path);
      if (ticketPath) {
        const id = validateTicketId(ticketPath[1]);
        if (method === "GET") {
          const ticket = await repository.findById(id);
          if (!ticket) throw new HttpError(404, "NOT_FOUND", "Ticket not found.");
          return json({ data: ticket });
        }
        if (method === "PATCH") {
          const changes = parseUpdateTicket(await readJson(request));
          const ticket = await repository.update(id, changes);
          if (!ticket) throw new HttpError(404, "NOT_FOUND", "Ticket not found.");
          return json({ data: ticket });
        }
        if (method === "DELETE") {
          const deleted = await repository.delete(id);
          if (!deleted) throw new HttpError(404, "NOT_FOUND", "Ticket not found.");
          return new Response(null, { status: 204 });
        }
        return methodNotAllowed("GET, PATCH, DELETE");
      }
      throw new HttpError(404, "NOT_FOUND", "Route not found.");
    } catch (error) {
      if (error instanceof HttpError) {
        return json({ error: { code: error.code, message: error.message } }, error.status);
      }
      console.error("Unhandled request error:", error);
      return json({ error: { code: "INTERNAL_ERROR", message: "An unexpected error occurred." } }, 500);
    }
  };
}
