"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "../lib/supabase";
import { loadScope, rpc } from "../lib/api";
import { emptyData, type GameData } from "../lib/game";
import type { Change, DataScope, Run, View } from "../lib/client-types";
import {
  errorMessage,
  mutateAndRefresh,
  RequestCoordinator,
  RetryRequests,
  WakeGate,
} from "../lib/requests";

export function useSession() {
  const [state, setState] = useState<{
    session: Session | null;
    ready: boolean;
    error: string;
    epoch: number;
  }>({ session: null, ready: false, error: "", epoch: 0 });
  useEffect(() => {
    if (!supabase) {
      setState((previous) => ({
        ...previous,
        ready: true,
        error: "Chưa kết nối được dịch vụ.",
      }));
      return;
    }
    let active = true,
      observed = false;
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      observed = true;
      if (active)
        setState((previous) => ({
          session,
          ready: true,
          error: "",
          epoch:
            previous.epoch +
            Number(previous.session?.user.id !== session?.user.id),
        }));
    });
    supabase.auth
      .getSession()
      .then(({ data, error }) => {
        if (active && !observed)
          setState((previous) => ({
            session: data.session,
            ready: true,
            error: error ? "Chưa khôi phục được đăng nhập." : "",
            epoch:
              previous.epoch +
              Number(previous.session?.user.id !== data.session?.user.id),
          }));
      })
      .catch(() => {
        if (active && !observed)
          setState((previous) => ({
            ...previous,
            ready: true,
            error: "Chưa khôi phục được đăng nhập.",
          }));
      });
    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, []);
  return state;
}

const viewScopes: Record<View, DataScope[]> = {
  garden: ["profile", "catalog", "garden", "inventory"],
  tasks: ["profile"],
  shop: ["profile", "catalog", "garden", "inventory"],
  warehouse: ["profile", "catalog", "inventory", "collection"],
  account: ["profile", "catalog", "garden", "inventory", "collection"],
  admin: ["profile", "catalog", "garden", "inventory"],
};
type Subscription = {
  changes: Change[];
  refresh: (force: boolean) => Promise<void>;
};
type GameContextValue = {
  session: Session | null;
  data: GameData;
  loading: boolean;
  busy: boolean;
  error: string;
  setError: (error: string) => void;
  notices: { id: number; text: string }[];
  dismissNotice: (id: number) => void;
  setNotice: (notice: string) => void;
  run: Run;
  refresh: () => Promise<void>;
  retry: RetryRequests;
  register: (subscription: Subscription) => () => void;
};
const GameContext = createContext<GameContextValue | null>(null);

export function GameProvider({
  session,
  view,
  children,
}: {
  session: Session | null;
  view: View;
  children: ReactNode;
}) {
  const userId = session?.user.id;
  const [data, setData] = useState<GameData>(emptyData);
  const [loading, setLoading] = useState(!!userId),
    [busy, setBusy] = useState(false);
  const [error, setError] = useState(""),
    [notices, setNotices] = useState<{id: number; text: string}[]>([]);
  const nextNotice = useRef(0);
  const setNotice = useCallback((message: string) => { if (message) setNotices(previous => [...previous, {id: ++nextNotice.current, text: message}]); }, []);
  const dismissNotice = useCallback((id: number) => setNotices(previous => previous.filter(notice => notice.id !== id)), []);
  const coordinator = useRef(new RequestCoordinator());
  const retry = useRef(new RetryRequests());
  const subscriptions = useRef(new Set<Subscription>());
  const active = useRef(true),
    working = useRef(false);
  const bootstrap = useRef<Promise<void> | null>(null);
  const scopes = useRef(viewScopes[view]);
  scopes.current = viewScopes[view];

  const register = useCallback((subscription: Subscription) => {
    subscriptions.current.add(subscription);
    return () => {
      subscriptions.current.delete(subscription);
    };
  }, []);

  const refreshChanges = useCallback(
    async (changes?: Change[], force = false) => {
      if (!userId) return;
      if (!bootstrap.current) {
        bootstrap.current = rpc("garden_initialize").catch((error) => {
          bootstrap.current = null;
          throw error;
        });
      }
      await bootstrap.current;
      if (!active.current) return;
      const selected = changes
        ? scopes.current.filter((scope) => changes.includes(scope))
        : scopes.current;
      const jobs = selected.map((scope) => {
        if (force) coordinator.current.invalidate(scope);
        return coordinator.current.run(
          scope,
          (signal) => loadScope(scope, userId, signal),
          (patch) => setData((previous) => ({ ...previous, ...patch })),
        );
      });
      for (const subscription of subscriptions.current) {
        if (
          !changes ||
          subscription.changes.some((change) => changes.includes(change))
        )
          jobs.push(subscription.refresh(force));
      }
      await Promise.all(jobs);
    },
    [userId],
  );
  const refresh = useCallback(() => refreshChanges(), [refreshChanges]);

  useEffect(() => {
    active.current = true;
    if (userId) {
      coordinator.current
        .run(
          "manager",
          (signal) => rpc<boolean>("garden_manager", {}, signal),
          (manager) => setData((previous) => ({ ...previous, manager })),
        )
        .catch((e) => setError(errorMessage(e)));
    }
    return () => {
      active.current = false;
      coordinator.current.reset();
    };
  }, [userId]);

  useEffect(() => {
    let current = true;
    setLoading(!!userId);
    refresh()
      .catch((e) => {
        if (current) setError(errorMessage(e));
      })
      .finally(() => {
        if (current) setLoading(false);
      });
    return () => {
      current = false;
    };
  }, [userId, view, refresh]);

  useEffect(() => {
    if (!userId) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const gate = new WakeGate();
    const schedule = () => {
      clearTimeout(timer);
      if (document.visibilityState === "visible")
        timer = setTimeout(tick, 30000);
    };
    const tick = () => {
      if (document.visibilityState !== "visible") return;
      if (!working.current && gate.accept(Date.now())) {
        void refresh().catch(() => {});
      }
      schedule();
    };
    const wake = () => {
      if (document.visibilityState === "visible" && !working.current && gate.accept(Date.now())) {
        void refresh().catch(() => {});
      }
      schedule();
    };
    schedule();
    window.addEventListener("focus", wake);
    document.addEventListener("visibilitychange", wake);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("focus", wake);
      document.removeEventListener("visibilitychange", wake);
    };
  }, [userId, refresh]);

  const run: Run = useCallback(
    async (job, message, changes) => {
      if (working.current) return;
      working.current = true;
      setBusy(true);
      setError("");
      try {
        const result = await mutateAndRefresh(async () => {
          await job();
          if (active.current && message) setNotice(message);
        }, () =>
          active.current ? refreshChanges(changes, true) : Promise.resolve(),
        );
        if (!active.current) return;
        if (result.syncError)
          setError(
            "Đã lưu thao tác. Chưa tải được dữ liệu mới; bấm Thử lại để đồng bộ.",
          );
      } catch (error) {
        if (active.current) setError(errorMessage(error));
      } finally {
        working.current = false;
        if (active.current) setBusy(false);
      }
    },
    [refreshChanges, setNotice],
  );

  const value = useMemo(
    () => ({
      session,
      data,
      loading,
      busy,
      error,
      setError,
      notices,
      dismissNotice,
      setNotice,
      run,
      refresh,
      register,
      retry: retry.current,
    }),
    [session, data, loading, busy, error, notices, dismissNotice, run, refresh, register],
  );
  return <GameContext.Provider value={value}>{children}</GameContext.Provider>;
}

export function useGame() {
  const context = useContext(GameContext);
  if (!context) throw new Error("GameProvider is required");
  return context;
}
