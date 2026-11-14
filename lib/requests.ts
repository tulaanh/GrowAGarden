type Pending = { controller: AbortController; promise: Promise<void> };

export class RequestCoordinator {
  private pending = new Map<string, Pending>();
  private generation = 0;

  run<T>(
    key: string,
    load: (signal: AbortSignal) => Promise<T>,
    commit: (value: T) => void,
  ): Promise<void> {
    const existing = this.pending.get(key);
    if (existing) return existing.promise;
    const generation = this.generation;
    const controller = new AbortController();
    const entry: Pending = { controller, promise: Promise.resolve() };
    entry.promise = Promise.resolve()
      .then(() => load(controller.signal))
      .then((value) => {
        if (!controller.signal.aborted && generation === this.generation)
          commit(value);
      })
      .catch((error) => {
        if (!controller.signal.aborted && generation === this.generation)
          throw error;
      })
      .finally(() => {
        if (this.pending.get(key) === entry) this.pending.delete(key);
      });
    this.pending.set(key, entry);
    return entry.promise;
  }

  invalidate(key: string) {
    this.pending.get(key)?.controller.abort();
    this.pending.delete(key);
  }

  reset() {
    this.generation++;
    for (const entry of this.pending.values()) entry.controller.abort();
    this.pending.clear();
  }
}

export class RetryRequests {
  private requests = new Map<string, string>();

  async run<T>(key: string, job: (request: string) => Promise<T>): Promise<T> {
    const request = this.requests.get(key) ?? crypto.randomUUID();
    this.requests.set(key, request);
    const value = await job(request);
    this.requests.delete(key);
    return value;
  }
}

export class WakeGate {
  private last = Number.NEGATIVE_INFINITY;

  accept(now: number) {
    if (now - this.last <= 1000) return false;
    this.last = now;
    return true;
  }
}

export async function mutateAndRefresh(
  job: () => Promise<void>,
  refresh: () => Promise<void>,
) {
  await job();
  try {
    await refresh();
    return { saved: true, syncError: null } as const;
  } catch (syncError) {
    return { saved: true, syncError } as const;
  }
}

export function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Có lỗi xảy ra. Hãy thử lại.";
}
