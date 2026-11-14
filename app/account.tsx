"use client";
import { useMemo } from "react";
import { supabase } from "../lib/supabase";
import { loadLedgerPage } from "../lib/api";
import {
  catalogArt,
  catalogLabel,
  harvestArt,
  levelInfo,
  plantStages,
} from "../lib/game";
import type { View } from "../lib/client-types";
import { Art, DateLabel, Empty, Money } from "./ui";
import { useGame } from "./game-session";
import { usePagedList } from "./data-hooks";
import { PageControls } from "./page-controls";

export function Account({
  navigate,
  openAuth,
}: {
  navigate: (view: View) => void;
  openAuth: (signup: boolean) => void;
}) {
  const { data: game, session, busy, run } = useGame();
  const lv = levelInfo(game.profile?.xp || 0);
  const stocks = useMemo(
    () => new Map(game.inventory.map((i) => [i.item_id, i.quantity])),
    [game.inventory],
  );
  const inventory = (id: string) => stocks.get(id) || 0;
  const ledger = usePagedList(
    "ledger",
    (cursor, signal) =>
      session
        ? loadLedgerPage(session.user.id, cursor, signal)
        : Promise.resolve({ items: [], next: null }),
    ["ledger"],
  );
  return (
    <section className="parchment content-panel">
      <p className="kicker">THÀNH QUẢ CỦA RIÊNG BẠN</p>
      <h2>Tài khoản & bộ sưu tập</h2>
      {!session ? (
        <Empty title="Khu vườn đang chờ bạn">
          Tạo tài khoản để nhận nhiệm vụ, mua hạt giống và lưu khu vườn.
          <button className="primary" onClick={() => openAuth(true)}>
            Tạo tài khoản
          </button>
          <button className="secondary" onClick={() => openAuth(false)}>
            Đăng nhập
          </button>
        </Empty>
      ) : (
        <>
          <div className="account-summary">
            <div>
              <strong>{game.profile?.display_name}</strong>
              <p className="email">{session.user.email}</p>
              <span>
                Cấp {lv.level} · {game.profile?.xp || 0} XP tích lũy
              </span>
            </div>
            <Money amount={game.profile?.coins || 0} />
          </div>
          <div className="button-row">
            {game.manager && (
              <button className="primary" onClick={() => navigate("admin")}>
                Quản lý nhiệm vụ & cửa hàng
              </button>
            )}
            <button
              className="secondary"
              disabled={busy}
              onClick={() =>
                run(
                  async () => {
                    const result = await supabase!.auth.signOut();
                    if (result.error) throw result.error;
                  },
                  "Đã đăng xuất.",
                  [],
                )
              }
            >
              Đăng xuất
            </button>
          </div>
          <h3>Nông sản sưu tầm</h3>
          <div className="collection">
            {game.catalog
              .filter((c) => c.kind === "seed")
              .map((c) =>
                !game.discoveredSeeds.includes(c.id) ? (
                  <div
                    className="collection-item mystery-card"
                    key={c.id}
                    aria-label="Nông sản chưa khám phá"
                  >
                    <div
                      className="collection-mystery-art mystery-art"
                      aria-hidden="true"
                    >
                      ???
                    </div>
                    <strong>???</strong>
                    <span>???</span>
                    <span>???</span>
                  </div>
                ) : (
                  <div
                    className={
                      "collection-item " +
                      (!game.collection.some((x) => x.seed_id === c.id)
                        ? "uncollected"
                        : "")
                    }
                    key={c.id}
                  >
                    <Art name={harvestArt(c.id)} />
                    <strong>{c.name}</strong>
                    <span>
                      {game.collection.find((x) => x.seed_id === c.id)
                        ?.quantity || 0}{" "}
                      nông sản
                    </span>
                    <span>{plantStages[c.id]} giai đoạn phát triển</span>
                  </div>
                ),
              )}
          </div>
          <h3>Kho vật phẩm</h3>
          <div className="inventory-list">
            {game.catalog
              .filter((c) => c.kind !== "seed" || inventory(c.id) > 0)
              .map((c) => (
                <div className="info-row" key={c.id}>
                  <span className="inventory-name">
                    <Art name={catalogArt(c)} />
                    <span>{catalogLabel(c)}</span>
                  </span>
                  <strong>{inventory(c.id)}</strong>
                </div>
              ))}
          </div>
          <h3>Lịch sử Đồng tri thức</h3>
          {!ledger.items.length ? (
            <p className="helper">
              Các khoản thưởng và mua hàng sẽ xuất hiện ở đây.
            </p>
          ) : (
            <div className="ledger">
              {ledger.items.map((l) => (
                <div className="ledger-row" key={l.id}>
                  <span>
                    {l.note || "Thưởng thêm"}
                    <small>
                      <DateLabel value={l.created_at} />
                    </small>
                  </span>
                  <strong className={l.amount > 0 ? "positive" : ""}>
                    {l.amount > 0 ? "+" : ""}
                    {l.amount}
                  </strong>
                </div>
              ))}
            </div>
          )}
          <PageControls page={ledger} />
        </>
      )}
    </section>
  );
}
