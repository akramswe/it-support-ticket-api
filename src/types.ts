export const TICKET_STATUSES = ["open", "in_progress", "resolved"] as const;
export const TICKET_PRIORITIES = ["low", "medium", "high"] as const;

export type TicketStatus = (typeof TICKET_STATUSES)[number];
export type TicketPriority = (typeof TICKET_PRIORITIES)[number];

export interface Ticket {
  id: string;
  title: string;
  description: string | null;
  status: TicketStatus;
  priority: TicketPriority;
  createdAt: string;
  updatedAt: string;
}

export interface CreateTicketInput {
  title: string;
  description: string | null;
  priority: TicketPriority;
}

export interface UpdateTicketInput {
  status?: TicketStatus;
  priority?: TicketPriority;
}

export interface TicketQuery {
  status?: TicketStatus;
  priority?: TicketPriority;
  page: number;
  limit: number;
}

export interface TicketPage {
  items: Ticket[];
  total: number;
}
