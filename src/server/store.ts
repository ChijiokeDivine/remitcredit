// Process-local activity feed. On Vercel each serverless instance has its own
// memory — fine for demos; swap for Redis/Postgres for multi-instance production.

export interface ActivityEvent {
  id: string;
  borrower: string;
  type:
    | "borrower_registered"
    | "remittance_verified"
    | "credit_reviewed"
    | "loan_disbursed"
    | "loan_repaid";
  data: Record<string, unknown>;
  timestamp: number;
}

export interface ActivityStore {
  append(event: Omit<ActivityEvent, "id" | "timestamp">): ActivityEvent;
  listForBorrower(borrower: string, limit?: number): ActivityEvent[];
  listAll(limit?: number): ActivityEvent[];
}

class InMemoryActivityStore implements ActivityStore {
  private events: ActivityEvent[] = [];
  private counter = 0;

  append(event: Omit<ActivityEvent, "id" | "timestamp">): ActivityEvent {
    const full: ActivityEvent = {
      ...event,
      id: `evt_${++this.counter}`,
      timestamp: Math.floor(Date.now() / 1000),
    };
    this.events.push(full);
    return full;
  }

  listForBorrower(borrower: string, limit = 50): ActivityEvent[] {
    const key = borrower.toLowerCase();
    return this.events
      .filter((e) => e.borrower.toLowerCase() === key)
      .slice(-limit)
      .reverse();
  }

  listAll(limit = 100): ActivityEvent[] {
    return this.events.slice(-limit).reverse();
  }
}

const g = globalThis as unknown as { __remitActivityStore?: ActivityStore };
if (!g.__remitActivityStore) g.__remitActivityStore = new InMemoryActivityStore();
export const activityStore: ActivityStore = g.__remitActivityStore;
