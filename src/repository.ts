import type {
  CreateTicketInput,
  Ticket,
  TicketPage,
  TicketQuery,
  UpdateTicketInput,
} from "./types.ts";

/** Persistence contract; API behavior can be tested without a live database. */
export interface TicketRepository {
  ping(): Promise<void>;
  create(input: CreateTicketInput): Promise<Ticket>;
  list(query: TicketQuery): Promise<TicketPage>;
  findById(id: string): Promise<Ticket | null>;
  update(id: string, changes: UpdateTicketInput): Promise<Ticket | null>;
  delete(id: string): Promise<boolean>;
}
