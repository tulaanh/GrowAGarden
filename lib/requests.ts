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
export type CacheState<T> = { value?: T; updatedAt: number; dirty: boolean; loading: boolean; error: string };
export class SessionCache {
  private entries = new Map<string, CacheState<unknown>>();
  private pending = new Map<string, {controller: AbortController; promise: Promise<void>}>();
  private tags = new Map<string, string[]>();
  private listeners = new Set<() => void>();
  private empty: CacheState<unknown> = {updatedAt: 0, dirty: true, loading: false, error: ''};
  readonly preferences = new Map<string, unknown>();
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  get<T>(key: string): CacheState<T> { return (this.entries.get(key) ?? this.empty) as CacheState<T>; }
  private publish(key: string, value: CacheState<unknown>) { this.entries.set(key,value); this.listeners.forEach(listener => listener()); }
  track(key: string, tags: string[]) { this.tags.set(key, tags); }
  invalidate(tags: string[]) {
    for (const [key, groups] of this.tags) if (groups.some(tag => tags.includes(tag))) {
      this.pending.get(key)?.controller.abort(); this.pending.delete(key);
      this.publish(key, {...this.get(key), dirty: true, loading: false});
    }
  }
  fresh(key: string, now = Date.now()) { const entry=this.get(key); return entry.value !== undefined && !entry.dirty && now-entry.updatedAt < 60000; }
  load<T>(key: string, load: (signal: AbortSignal) => Promise<T>, force = false): Promise<void> {
    if (force) { this.pending.get(key)?.controller.abort(); this.pending.delete(key); }
    const existing=this.pending.get(key); if (existing) return existing.promise;
    if (!force && this.fresh(key)) return Promise.resolve();
    const controller=new AbortController();
    const entry={controller, promise: Promise.resolve()};
    this.pending.set(key,entry);
    this.publish(key, {...this.get(key), loading: true, error: ''});
    entry.promise=Promise.resolve().then(() => load(controller.signal)).then(value => {
      if (!controller.signal.aborted) this.publish(key,{value,updatedAt:Date.now(),dirty:false,loading:false,error:''});
    }).catch(error => {
      if (!controller.signal.aborted) { this.publish(key,{...this.get(key), loading:false, dirty:true, error:errorMessage(error)}); throw error; }
    }).finally(() => { if (this.pending.get(key)===entry) this.pending.delete(key); });
    return entry.promise;
  }
  reset() { this.pending.forEach(entry => entry.controller.abort()); this.pending.clear(); this.entries.clear(); this.tags.clear(); this.preferences.clear(); this.listeners.forEach(listener => listener()); }
}
