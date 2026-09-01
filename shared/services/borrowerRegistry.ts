// shared/services/borrowerRegistry.ts
//
// Builds the declaredSender -> Set<borrower> map by replaying
// BorrowerRegistered / DeclaredSenderAdded / DeclaredSenderRemoved events
// in block order, so a later removal correctly overrides an earlier add.
// The standalone worker (monitor.ts) hydrates this once and keeps it fresh
// via live event listeners; the tick route has no persistent listener, so
// it just rebuilds this map from scratch on every invocation.

import { RemitCreditClient } from "./contractClient";

export async function buildSenderToBorrowersMap(
  client: RemitCreditClient
): Promise<Map<string, Set<string>>> {
  const [registeredEvents, addedEvents, removedEvents] = await Promise.all([
    client.loan.queryFilter(client.loan.filters.BorrowerRegistered(), 0, "latest"),
    client.loan.queryFilter(client.loan.filters.DeclaredSenderAdded(), 0, "latest"),
    client.loan.queryFilter(client.loan.filters.DeclaredSenderRemoved(), 0, "latest"),
  ]);

  type Change = { blockNumber: number; logIndex: number; borrower: string; sender: string; add: boolean };
  const changes: Change[] = [];

  for (const event of registeredEvents) {
    if (!("args" in event) || !event.args) continue;
    const [borrower, initialSenders] = event.args as unknown as [string, string[]];
    for (const sender of initialSenders) {
      changes.push({ blockNumber: event.blockNumber, logIndex: event.index, borrower, sender, add: true });
    }
  }
  for (const event of addedEvents) {
    if (!("args" in event) || !event.args) continue;
    const [borrower, sender] = event.args as unknown as [string, string];
    changes.push({ blockNumber: event.blockNumber, logIndex: event.index, borrower, sender, add: true });
  }
  for (const event of removedEvents) {
    if (!("args" in event) || !event.args) continue;
    const [borrower, sender] = event.args as unknown as [string, string];
    changes.push({ blockNumber: event.blockNumber, logIndex: event.index, borrower, sender, add: false });
  }

  changes.sort((a, b) => a.blockNumber - b.blockNumber || a.logIndex - b.logIndex);

  const map = new Map<string, Set<string>>();
  const add = (borrower: string, sender: string) => {
    const key = sender.toLowerCase();
    const set = map.get(key) ?? new Set<string>();
    set.add(borrower.toLowerCase());
    map.set(key, set);
  };
  const remove = (borrower: string, sender: string) => {
    map.get(sender.toLowerCase())?.delete(borrower.toLowerCase());
  };

  for (const change of changes) {
    if (change.add) add(change.borrower, change.sender);
    else remove(change.borrower, change.sender);
  }
  return map;
}
