import { supabase } from "./supabase";
import type {
  Attempt,
  CatalogItem,
  Crop,
  GameData,
  Inventory,
  LedgerEntry,
  Plot,
  Profile,
  Progress,
  Review,
  SeedDrop,
  Task,
} from "./game";
import {
  PAGE_SIZE,
  type Cursor,
  type DataScope,
  type Page,
} from "./client-types";

function client() {
  if (!supabase) throw new Error("Chưa kết nối được ứng dụng.");
  return supabase;
}

export async function rpc<T = void>(
  name: string,
  args: Record<string, unknown> = {},
  signal?: AbortSignal,
): Promise<T> {
  const query = client().rpc(name, args);
  const result = await (signal ? query.abortSignal(signal) : query);
  if (result.error) throw new Error(result.error.message);
  return result.data as T;
}

async function rows<T>(
  query: PromiseLike<{ data: unknown; error: { message: string } | null }>,
): Promise<T[]> {
  const result = await query;
  if (result.error) throw new Error(result.error.message);
  return (result.data ?? []) as T[];
}

const columns = {
  profile: "user_id,coins,xp,display_name",
  plot: "id,slot,seed_id,source_seed_id,planted_at,ready_at,next_water_at,growth_seconds,xp_reward,harvested",
  catalog:
    "id,name,kind,price,grow_seconds,xp,min_level,reduction_seconds,active,retired",
  task: "id,title,body,reward,due_at,status,files,created_at",
  progress:
    "id,user_id,task_id,status,reward_snapshot,submitted_at,approved_at,bonus_given",
};

export async function loadScope(
  scope: DataScope,
  userId: string,
  signal: AbortSignal,
): Promise<Partial<GameData>> {
  const db = client();
  switch (scope) {
    case "profile": {
      const profiles = await rows<Profile>(
        db
          .from("garden_profiles")
          .select(columns.profile)
          .eq("user_id", userId)
          .abortSignal(signal),
      );
      return { profile: profiles[0] ?? null };
    }
    case "catalog": {
      const [catalog, drops] = await Promise.all([
        rows<CatalogItem>(
          db
            .from("garden_catalog")
            .select(columns.catalog)
            .eq("retired", false)
            .abortSignal(signal),
        ),
        rows<SeedDrop>(
          db
            .from("garden_seed_drops")
            .select("seed_id,plant_id,weight")
            .abortSignal(signal),
        ),
      ]);
      return { catalog, drops };
    }
    case "garden": {
      const [plots, land, discoveredSeeds] = await Promise.all([
        rows<Plot>(
          db
            .from("garden_plots")
            .select(columns.plot)
            .eq("user_id", userId)
            .eq("harvested", false)
            .order("slot")
            .abortSignal(signal),
        ),
        rows<{ slot: number }>(
          db
            .from("garden_unlocked_slots")
            .select("slot")
            .eq("user_id", userId)
            .abortSignal(signal),
        ),
        rpc<string[]>("garden_discovered_seeds", {}, signal),
      ]);
      return {
        plots,
        unlockedSlots: [0, 1, 2, 3, ...land.map((row) => row.slot)],
        discoveredSeeds,
      };
    }
    case "inventory":
      return {
        inventory: await rows<Inventory>(
          db
            .from("garden_inventory")
            .select("item_id,quantity")
            .eq("user_id", userId)
            .abortSignal(signal),
        ),
      };
    case "collection":
      return {
        collection: await rows<Crop>(
          db
            .from("garden_collection")
            .select("seed_id,quantity")
            .eq("user_id", userId)
            .abortSignal(signal),
        ),
      };
  }
}

export function toPage<T extends { id: string }>(
  items: T[],
  timestamp: (item: T) => string,
): Page<T> {
  const visible = items.slice(0, PAGE_SIZE);
  const last = visible[visible.length - 1];
  return {
    items: visible,
    next:
      items.length > PAGE_SIZE && last
        ? { at: timestamp(last), id: last.id }
        : null,
  };
}

function cursorFilter(column: string, cursor: Cursor) {
  // Cursors come from database rows; validate before interpolating PostgREST syntax.
  if (
    !/^[0-9a-f-]{36}$/i.test(cursor.id) ||
    !/^\d{4}-[\dT:.+Z -]+$/.test(cursor.at)
  )
    throw new Error("Mốc phân trang không hợp lệ.");
  return `${column}.lt.${cursor.at},and(${column}.eq.${cursor.at},id.lt.${cursor.id})`;
}

export type TaskRow = Task & { created_at: string; progress?: Progress };
export async function loadTaskPage(
  userId: string,
  manage: boolean,
  open: boolean,
  cursor: Cursor | null,
  signal: AbortSignal,
): Promise<Page<TaskRow>> {
  const tasks = await rpc<TaskRow[]>(
    "garden_task_page",
    {
      p_manage: manage,
      p_open: open,
      p_before_at: cursor?.at ?? null,
      p_before_id: cursor?.id ?? null,
      p_limit: PAGE_SIZE + 1,
    },
    signal,
  );
  const page = toPage(tasks, (task) => task.created_at);
  if (!manage && page.items.length) {
    const progress = await rows<Progress>(
      client()
        .from("garden_progress")
        .select(columns.progress)
        .eq("user_id", userId)
        .in(
          "task_id",
          page.items.map((t) => t.id),
        )
        .abortSignal(signal),
    );
    const byTask = new Map(progress.map((p) => [p.task_id, p]));
    page.items = page.items.map((task) => ({
      ...task,
      progress: byTask.get(task.id),
    }));
  }
  return page;
}

export type ReviewRow = Progress & {
  task: Task;
  person: Pick<Profile, "user_id" | "display_name">;
};
export async function loadPendingCount(signal: AbortSignal): Promise<number> {
  const result = await client()
    .from("garden_progress")
    .select("id", { count: "exact", head: true })
    .eq("status", "submitted")
    .abortSignal(signal);
  if (result.error) throw new Error(result.error.message);
  return result.count ?? 0;
}

export async function loadReviewPage(
  filter: string,
  cursor: Cursor | null,
  signal: AbortSignal,
): Promise<Page<ReviewRow>> {
  let query = client()
    .from("garden_progress")
    .select(columns.progress)
    .order("submitted_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(PAGE_SIZE + 1);
  if (filter !== "all") query = query.eq("status", filter);
  if (cursor) query = query.or(cursorFilter("submitted_at", cursor));
  const page = toPage(
    await rows<Progress>(query.abortSignal(signal)),
    (p) => p.submitted_at,
  );
  if (!page.items.length) return { items: [], next: null };
  const [tasks, people] = await Promise.all([
    rows<Task>(
      client()
        .from("garden_tasks")
        .select(columns.task)
        .in("id", [...new Set(page.items.map((p) => p.task_id))])
        .abortSignal(signal),
    ),
    rows<Profile>(
      client()
        .from("garden_profiles")
        .select("user_id,display_name")
        .in("user_id", [...new Set(page.items.map((p) => p.user_id))])
        .abortSignal(signal),
    ),
  ]);
  const byTask = new Map(tasks.map((t) => [t.id, t]));
  const byPerson = new Map(people.map((p) => [p.user_id, p]));
  return {
    ...page,
    items: page.items.map((p) => ({
      ...p,
      task: byTask.get(p.task_id)!,
      person: byPerson.get(p.user_id)!,
    })),
  };
}

export async function loadLedgerPage(
  userId: string,
  cursor: Cursor | null,
  signal: AbortSignal,
): Promise<Page<LedgerEntry>> {
  let query = client()
    .from("garden_ledger")
    .select("id,amount,kind,note,created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(PAGE_SIZE + 1);
  if (cursor) query = query.or(cursorFilter("created_at", cursor));
  return toPage(
    await rows<LedgerEntry>(query.abortSignal(signal)),
    (l) => l.created_at,
  );
}

export async function loadTask(
  id: string,
  userId: string,
  signal: AbortSignal,
): Promise<TaskRow | null> {
  const [tasks, progress] = await Promise.all([
    rows<TaskRow>(
      client()
        .from("garden_tasks")
        .select(columns.task)
        .eq("id", id)
        .abortSignal(signal),
    ),
    rows<Progress>(
      client()
        .from("garden_progress")
        .select(columns.progress)
        .eq("task_id", id)
        .eq("user_id", userId)
        .abortSignal(signal),
    ),
  ]);
  return tasks[0] ? { ...tasks[0], progress: progress[0] } : null;
}

export async function loadReview(
  id: string,
  signal: AbortSignal,
): Promise<ReviewRow | null> {
  const [progress] = await rows<Progress>(
    client()
      .from("garden_progress")
      .select(columns.progress)
      .eq("id", id)
      .abortSignal(signal),
  );
  if (!progress) return null;
  const [tasks, people] = await Promise.all([
    rows<Task>(
      client()
        .from("garden_tasks")
        .select(columns.task)
        .eq("id", progress.task_id)
        .abortSignal(signal),
    ),
    rows<Profile>(
      client()
        .from("garden_profiles")
        .select("user_id,display_name")
        .eq("user_id", progress.user_id)
        .abortSignal(signal),
    ),
  ]);
  return { ...progress, task: tasks[0], person: people[0] };
}

export async function loadHistoryPage<T extends Attempt | Review>(
  kind: "attempts" | "reviews",
  progressId: string,
  cursor: Cursor | null,
  signal: AbortSignal,
): Promise<Page<T>> {
  const select =
    kind === "attempts"
      ? "id,progress_id,user_id,files,created_at"
      : "id,progress_id,action,note,amount,created_at";
  let query = client()
    .from(`garden_${kind}`)
    .select(select)
    .eq("progress_id", progressId)
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(PAGE_SIZE + 1);
  if (cursor) query = query.or(cursorFilter("created_at", cursor));
  return toPage(await rows<T>(query.abortSignal(signal)), (a) => a.created_at);
}

export function validateFiles(files: File[], bucket: string) {
  if (!["garden-task-files", "garden-homework"].includes(bucket))
    throw new Error("Kho tệp không hợp lệ.");
  if (files.length > 5) throw new Error("Mỗi lần nộp tối đa 5 tệp.");
  const allowed =
    bucket === "garden-task-files"
      ? ["image/jpeg", "image/png", "image/webp", "application/pdf"]
      : ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"];
  for (const file of files) {
    if (
      !allowed.includes(file.type) ||
      file.size > 10 * 1024 * 1024 ||
      !file.size
    )
      throw new Error(
        "Tệp cần đúng định dạng, có nội dung và không quá 10 MB.",
      );
  }
}

type FileStore = {
  upload: (
    path: string,
    file: File,
    options: { contentType: string },
  ) => PromiseLike<{ error: { message: string } | null }>;
  remove: (
    paths: string[],
  ) => PromiseLike<{ error: { message: string } | null }>;
};

export async function uploadFiles(
  files: File[],
  bucket: string,
  userId: string,
  store?: FileStore,
): Promise<string[]> {
  validateFiles(files, bucket);
  const storage = store ?? client().storage.from(bucket);
  const paths: string[] = [];
  try {
    for (const file of files) {
      const path =
        userId +
        "/" +
        crypto.randomUUID() +
        "/" +
        file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      paths.push(path);
      const { error } = await storage.upload(path, file, {
        contentType: file.type,
      });
      if (error)
        throw new Error("Chưa tải được tệp. Kiểm tra kết nối rồi thử lại.");
    }
    return paths;
  } catch (error) {
    await cleanupFiles(paths, bucket, storage);
    throw error;
  }
}

export async function cleanupFiles(
  paths: string[],
  bucket: string,
  store?: FileStore,
) {
  if (!paths.length) return;
  try {
    // Storage DELETE policies reject referenced files, including an RPC that committed before a lost response.
    const { error } = await (store ?? client().storage.from(bucket)).remove(
      paths,
    );
    if (error) console.warn("Không dọn được tệp tải lên:", error.message);
  } catch {
    console.warn(
      "Không dọn được tệp tải lên; giữ nguyên lỗi thao tác ban đầu.",
    );
  }
}
