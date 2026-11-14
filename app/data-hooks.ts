"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import type { Change, Cursor, Page } from "../lib/client-types";
import { useGame } from "./game-session";

export function useSessionPreference<T>(key: string, initial: T) {
  const { cache } = useGame();
  const [value, setValue] = useState<T>(() => cache.preferences.has(key) ? cache.preferences.get(key) as T : initial);
  return [value, (next: T) => { cache.preferences.set(key, next); setValue(next); }] as const;
}

export function useResource<T>(key: string, load: (signal: AbortSignal) => Promise<T>, changes: Change[]) {
  const { cache, register } = useGame();
  const loader = useRef(load);
  loader.current = load;
  const state = useSyncExternalStore(cache.subscribe, () => cache.get<T>(key), () => cache.get<T>(key));
  const refresh = useCallback((force = false) => cache.load(key, signal => loader.current(signal), force), [cache, key]);
  const changeKey = changes.join(",");
  useEffect(() => {
    cache.track(key, changeKey.split(","));
    const unregister = register({ changes: changeKey.split(",") as Change[], refresh });
    void refresh().catch(() => {});
    return unregister;
  }, [cache, key, changeKey, register, refresh]);
  return { key, value: state.value, error: state.error, loading: state.value === undefined && (state.loading || !state.error), refresh: () => refresh(true) };
}

type CachedPages<T> = { items: T[]; next: Cursor | null; pages: number };
export function usePagedList<T extends { id: string }>(key: string, load: (cursor: Cursor | null, signal: AbortSignal) => Promise<Page<T>>, changes: Change[]) {
  const { cache } = useGame();
  const loader = useRef(load);
  loader.current = load;
  const resource = useResource<CachedPages<T>>(key, async signal => {
    const count = cache.get<CachedPages<T>>(key).value?.pages ?? 1;
    const items: T[] = [];
    let next: Cursor | null = null;
    let pages = 0;
    for (let i=0; i<count; i++) {
      const page = await loader.current(next, signal);
      items.push(...page.items); next = page.next; pages++;
      if (!next) break;
    }
    return {items: [...new Map(items.map(item => [item.id,item])).values()], next, pages};
  }, changes);
  const more = useCallback(async () => {
    const state = cache.get<CachedPages<T>>(key);
    const snapshot = state.value;
    if (!snapshot?.next || state.loading) return;
    // Rebuild expired pages before extending them so cursors match the current list.
    if (!cache.fresh(key)) { await resource.refresh().catch(() => {}); return; }
    await cache.load(key, async signal => {
      const page = await loader.current(snapshot.next,signal);
      return {items: [...new Map([...snapshot.items,...page.items].map(item => [item.id,item])).values()], next: page.next, pages: snapshot.pages+1};
    }, true).catch(() => {});
  }, [cache, key, resource.refresh]);
  return { items: resource.value?.items ?? [], next: resource.value?.next ?? null, loading: resource.loading || cache.get(key).loading, error: resource.error, more, refresh: resource.refresh };
}

export function useClock(enabled = true) {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    if (!enabled) return;
    let timer: ReturnType<typeof setInterval> | undefined;
    const update = () => {
      clearInterval(timer);
      if (document.visibilityState === "visible") {
        setNow(Date.now());
        timer = setInterval(() => setNow(Date.now()), 1000);
      }
    };
    update();
    document.addEventListener("visibilitychange", update);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", update);
    };
  }, [enabled]);
  return now;
}
