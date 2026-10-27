import type { TicketRepository } from "../../src/repository.ts";
import type {
  CreateTicketInput,
  Ticket,
  TicketPage,
  TicketQuery,
  UpdateTicketInput,
} from "../../src/types.ts";

export class InMemoryTicketRepository implements TicketRepository {
  private tickets = new Map<string, Ticket>();

  async ping(): Promise<void> {
    // Nothing to check in an in-memory repository.
  }

  async create(input: CreateTicketInput): Promise<Ticket> {
    const timestamp = new Date().toISOString();
    const ticket: Ticket = {
      ...input,
      id: crypto.randomUUID(),
      status: "open",
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    this.tickets.set(ticket.id, ticket);
    return ticket;
  }

  async list(query: TicketQuery): Promise<TicketPage> {
    const matching = [...this.tickets.values()]
      .filter((ticket) => query.status === undefined || ticket.status === query.status)
      .filter((ticket) => query.priority === undefined || ticket.priority === query.priority)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id));
    const start = (query.page - 1) * query.limit;
    return { items: matching.slice(start, start + query.limit), total: matching.length };
  }

  async findById(id: string): Promise<Ticket | null> {
    return this.tickets.get(id) ?? null;
  }

  async update(id: string, changes: UpdateTicketInput): Promise<Ticket | null> {
    const ticket = this.tickets.get(id);
    if (!ticket) return null;
    const updated = { ...ticket, ...changes, updatedAt: new Date().toISOString() };
    this.tickets.set(id, updated);
    return updated;
  }

  async delete(id: string): Promise<boolean> {
    return this.tickets.delete(id);
  }
}
