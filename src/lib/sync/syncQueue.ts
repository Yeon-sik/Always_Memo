export interface SyncQueue {
  enqueue<T>(operation: () => Promise<T>): Promise<T>;
}

// Remote sync operations share one tail promise. A failed operation releases
// the queue so a later manual/reconnect retry can still run.
export function createSyncQueue(): SyncQueue {
  let tail: Promise<void> = Promise.resolve();

  return {
    enqueue<T>(operation: () => Promise<T>): Promise<T> {
      const next = tail.then(operation, operation);
      tail = next.then(
        () => undefined,
        () => undefined,
      );
      return next;
    },
  };
}
