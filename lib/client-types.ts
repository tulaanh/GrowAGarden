export type View = "garden" | "tasks" | "shop" | "warehouse" | "account" | "admin";
export type DataScope =
  "profile" | "catalog" | "garden" | "inventory" | "collection";
export type Change = DataScope | "tasks" | "reviews" | "ledger";
export type Run = (
  job: () => Promise<void>,
  message?: string,
  changes?: Change[],
) => Promise<void>;
export type Page<T> = { items: T[]; next: Cursor | null };
export type Cursor = { at: string; id: string };
export const PAGE_SIZE = 50;
