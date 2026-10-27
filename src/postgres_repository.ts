import postgres from "postgres";
import type { TicketRepository } from "./repository.ts";
import type {
  CreateTicketInput,
  Ticket,
  TicketPage,
  TicketQuery,
  TicketPriority,
  TicketStatus,
  UpdateTicketInput,
} from "./types.ts";

export type Database = ReturnType<typeof postgres>;

function toTicket(row: Record<string, unknown>): Ticket {
  return {
    id: String(row.id),
    title: String(row.title),
    description: row.description === null ? null : String(row.description),
    status: row.status as TicketStatus,
    priority: row.priority as TicketPriority,
    createdAt: new Date(row.created_at as string | number | Date).toISOString(),
    updatedAt: new Date(row.updated_at as string | number | Date).toISOString(),
  };
}

export class PostgresTicketRepository implements TicketRepository {
  private readonly sql: Database;

  constructor(sql: Database) {
    this.sql = sql;
  }

  async ping(): Promise<void> {
    await this.sql`SELECT 1`;
  }

  async create(input: CreateTicketInput): Promise<Ticket> {
    const rows = await this.sql`
      INSERT INTO tickets (id, title, description, priority)
      VALUES (${crypto.randomUUID()}, ${input.title}, ${input.description}, ${input.priority})
      RETURNING *
    `;
    return toTicket(rows[0]);
  }

  async list(query: TicketQuery): Promise<TicketPage> {
    // postgres.js binds user values: no string interpolation into SQL syntax.
    const filter = this.sql`
      WHERE (${query.status ?? null}::text IS NULL OR status = ${query.status ?? null})
        AND (${query.priority ?? null}::text IS NULL OR priority = ${query.priority ?? null})
    `;
    const countRows = await this.sql`SELECT COUNT(*)::integer AS total FROM tickets ${filter}`;
    const rows = await this.sql`
      SELECT * FROM tickets ${filter}
      ORDER BY created_at DESC, id DESC
      LIMIT ${query.limit} OFFSET ${(query.page - 1) * query.limit}
    `;
    return { items: rows.map(toTicket), total: Number(countRows[0].total) };
  }

  async findById(id: string): Promise<Ticket | null> {
    const rows = await this.sql`SELECT * FROM tickets WHERE id = ${id}`;
    return rows.length ? toTicket(rows[0]) : null;
  }

  async update(id: string, changes: UpdateTicketInput): Promise<Ticket | null> {
    const rows = await this.sql`
      UPDATE tickets
      SET status = COALESCE(${changes.status ?? null}, status),
          priority = COALESCE(${changes.priority ?? null}, priority),
          updated_at = NOW()
      WHERE id = ${id}
      RETURNING *
    `;
    return rows.length ? toTicket(rows[0]) : null;
  }

  async delete(id: string): Promise<boolean> {
    const rows = await this.sql`DELETE FROM tickets WHERE id = ${id} RETURNING id`;
    return rows.length > 0;
  }
}
