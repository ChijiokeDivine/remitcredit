// backend/src/store.ts
//
// On-chain contract state (via RemitCreditClient) is always the source of
// truth for borrower/loan/credit data — routes read it directly rather
// than trusting a cache. This store exists for things that are awkward or
// expensive to reconstruct from chain reads alone, like a chronological
// activity feed for a future frontend ("here's what happened, in order").
// It's defined behind an interface so swapping the in-memory
// implementation for Postgres/SQLite later doesn't touch route code.

export interface ActivityEvent {
  id: string;
  borrower: string;
  type: "borrower_registered" | "remittance_verified" | "credit_reviewed" | "loan_disbursed" | "loan_repaid";
  data: Record<string, unknown>;
  timestamp: number;
}

export interface ActivityStore {
  append(event: Omit<ActivityEvent, "id" | "timestamp">): ActivityEvent;
  listForBorrower(borrower: string, limit?: number): ActivityEvent[];
  listAll(limit?: number): ActivityEvent[];
}

export class InMemoryActivityStore implements ActivityStore {
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

// Singleton for the process — swap this line to plug in a real store.
export const activityStore: ActivityStore = new InMemoryActivityStore();
