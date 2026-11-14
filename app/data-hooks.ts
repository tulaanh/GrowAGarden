"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Change, Cursor, Page } from "../lib/client-types";
import { errorMessage, RequestCoordinator } from "../lib/requests";
import { useGame } from "./game-session";

export function useResource<T>(
  key: string,
  load: (signal: AbortSignal) => Promise<T>,
  changes: Change[],
) {
  const { register } = useGame();
  const loader = useRef(load);
  loader.current = load;
  const coordinator = useRef(new RequestCoordinator());
  const [state, setState] = useState<{
    key: string;
    value?: T;
    loading: boolean;
    error: string;
  }>({ key, loading: true, error: "" });
  const refresh = useCallback(
    async (force = false) => {
      if (force) coordinator.current.invalidate(key);
      try {
        await coordinator.current.run(
          key,
          (signal) => loader.current(signal),
          (value) => setState({ key, value, loading: false, error: "" }),
        );
      } catch (error) {
        setState((previous) => ({
          ...previous,
          loading: false,
          error: errorMessage(error),
        }));
        throw error;
      }
    },
    [key],
  );
  const changeKey = changes.join(",");
  useEffect(() => {
    coordinator.current.reset();
    setState({ key, loading: true, error: "" });
    const unregister = register({
      changes: changeKey.split(",") as Change[],
      refresh,
    });
    void refresh().catch(() => {});
    return () => {
      unregister();
      coordinator.current.reset();
    };
  }, [key, changeKey, register, refresh]);
  return {
    ...(state.key === key
      ? state
      : { loading: true, error: "", value: undefined }),
    refresh: () => refresh(true),
  };
}

export function usePagedList<T extends { id: string }>(
  key: string,
  load: (cursor: Cursor | null, signal: AbortSignal) => Promise<Page<T>>,
  changes: Change[],
) {
  const { register } = useGame();
  const loader = useRef(load);
  loader.current = load;
  const coordinator = useRef(new RequestCoordinator());
  const pageCount = useRef(1);
  const [state, setState] = useState<{
    key: string;
    items: T[];
    next: Cursor | null;
    loading: boolean;
    error: string;
  }>({ key, items: [], next: null, loading: true, error: "" });
  const current = useRef(state);
  current.current = state;
  const refresh = useCallback(
    async (force = false) => {
      if (force) coordinator.current.invalidate(key);
      try {
        await coordinator.current.run(
          key,
          async (signal) => {
            let cursor: Cursor | null = null;
            const items: T[] = [];
            for (let i = 0; i < pageCount.current; i++) {
              const page = await loader.current(cursor, signal);
              items.push(...page.items);
              cursor = page.next;
              if (!cursor) break;
            }
            return {
              items: [
                ...new Map(items.map((item) => [item.id, item])).values(),
              ],
              next: cursor,
            };
          },
          (page) => setState({ key, ...page, loading: false, error: "" }),
        );
      } catch (error) {
        setState((previous) => ({
          ...previous,
          loading: false,
          error: errorMessage(error),
        }));
        throw error;
      }
    },
    [key],
  );
  const more = useCallback(async () => {
    const snapshot = current.current;
    if (!snapshot.next || snapshot.loading || snapshot.key !== key) return;
    setState((previous) => ({ ...previous, loading: true, error: "" }));
    // One queue owns both refresh and pagination, so a late page cannot replace refreshed rows.
    coordinator.current.invalidate(key);
    try {
      await coordinator.current.run(
        key,
        (signal) => loader.current(snapshot.next, signal),
        (page) => {
          pageCount.current++;
          setState({
            key,
            items: [
              ...new Map(
                [...snapshot.items, ...page.items].map((item) => [
                  item.id,
                  item,
                ]),
              ).values(),
            ],
            next: page.next,
            loading: false,
            error: "",
          });
        },
      );
    } catch (error) {
      setState((previous) => ({
        ...previous,
        loading: false,
        error: errorMessage(error),
      }));
    }
  }, [key]);
  const changeKey = changes.join(",");
  useEffect(() => {
    coordinator.current.reset();
    pageCount.current = 1;
    setState({ key, items: [], next: null, loading: true, error: "" });
    const unregister = register({
      changes: changeKey.split(",") as Change[],
      refresh,
    });
    void refresh().catch(() => {});
    return () => {
      unregister();
      coordinator.current.reset();
    };
  }, [key, changeKey, register, refresh]);
  return {
    ...(state.key === key
      ? state
      : { items: [], next: null, loading: true, error: "" }),
    more,
    refresh: () => refresh(true),
  };
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
