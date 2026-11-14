"use client";
import { useState, useMemo } from "react";
import { rpc } from "../lib/api";
import {
  catalogArt,
  harvestArt,
  catalogLabel,
  levelInfo,
  seedOdds,
  type CatalogItem,
} from "../lib/game";
import type { GameData } from "../lib/game";
import { Art, Money, SeedOdds, VndMoney } from "./ui";
import { useSessionPreference } from "./data-hooks";
import { useGame } from "./game-session";

export function Shop({ needLogin }: { needLogin: () => boolean }) {
  const { data: game, session, busy, run, retry } = useGame();
  const [tab, setTab] = useSessionPreference<"buy" | "sell">("shop-tab", "buy");
  const lv = levelInfo(game.profile?.xp || 0);
  const stocks = useMemo(
    () => new Map(game.inventory.map((i) => [i.item_id, i.quantity])),
    [game.inventory],
  );
  const inventory = (id: string) => stocks.get(id) || 0;
  return (
    <section className="parchment content-panel">
      <div className="panel-heading">
        <div>
          <p className="kicker">MỘT HẠT NHỎ, MỘT KHU VƯỜN LỚN</p>
          <h2>Cửa hàng</h2>
        </div>
        {tab === "buy" ? <Money amount={game.profile?.coins || 0} /> : <VndMoney amount={game.profile?.vnd || 0} />}
      </div>
      <div className="tabs" aria-label="Chọn mua hoặc bán">
        <button type="button" className={tab === "buy" ? "active" : ""} aria-pressed={tab === "buy"} onClick={() => setTab("buy")}>Mua</button>
        <button type="button" className={tab === "sell" ? "active" : ""} aria-pressed={tab === "sell"} onClick={() => setTab("sell")}>Bán</button>
      </div>
      {tab === "sell" ? <ProduceSales needLogin={needLogin} /> : <>
      <p className="panel-description">
        Gieo hạt gacha để khám phá cây mới và mở khóa hạt giống của cây đó trong
        cửa hàng.
      </p>
      {(
        [
          [
            "Hạt gacha & vật phẩm",
            game.catalog.filter((c) => c.active && c.kind !== "seed"),
          ],
          [
            "Hạt giống cây",
            game.catalog.filter((c) => c.active && c.kind === "seed"),
          ],
        ] as [string, CatalogItem[]][]
      ).map(([title, items]) => (
        <section key={title} aria-label={title}>
          <h3>{title}</h3>
          <div className="shop-grid">
            {items.map((c) =>
              c.kind === "seed" && !game.discoveredSeeds.includes(c.id) ? (
                <article
                  className="shop-card mystery-card"
                  key={c.id}
                  aria-label="Hạt giống chưa khám phá"
                >
                  <div className="shop-art mystery-art" aria-hidden="true">
                    ???
                  </div>
                  <h3>???</h3>
                  <p>???</p>
                  <p className="item-price">???</p>
                  <span className="owned">???</span>
                  <button type="button" className="primary" disabled>
                    Chưa khám phá
                  </button>
                </article>
              ) : (
                <ShopCard
                  key={c.id}
                  item={c}
                  data={game}
                  level={lv.level}
                  owned={inventory(c.id)}
                  balance={game.profile?.coins || 0}
                  busy={busy}
                  guest={!session}
                  onBuy={(quantity) => {
                    if (!needLogin())
                      run(
                        async () => {
                          await retry.run(
                            JSON.stringify(["buy", c.id, quantity]),
                            (request) =>
                              rpc("garden_buy", {
                                p_item: c.id,
                                p_quantity: quantity,
                                p_request: request,
                              }),
                          );
                        },
                        "Đã thêm vật phẩm vào kho.",
                        ["profile", "inventory", "ledger"],
                      );
                  }}
                />
              ),
            )}
          </div>
        </section>
      ))}
      <p className="helper">
        Đồng tri thức nhận từ bài tập được duyệt. Thu hoạch cho nông sản và XP.
      </p>
      </>}
    </section>
  );
}

function ShopCard({
  item: c,
  data,
  level,
  owned,
  balance,
  busy,
  guest,
  onBuy,
}: {
  item: CatalogItem;
  data: GameData;
  level: number;
  owned: number;
  balance: number;
  busy: boolean;
  guest: boolean;
  onBuy: (q: number) => void;
}) {
  const [quantity, setQuantity] = useState(1),
    locked = c.kind !== "seed" && level < c.min_level;
  const validQuantity =
    Number.isInteger(quantity) && quantity >= 1 && quantity <= 99;
  const total = validQuantity ? c.price * quantity : 0;
  const missing = Math.max(0, total - balance);
  const insufficient = !guest && !locked && validQuantity && missing > 0;
  const unavailable =
    (c.kind === "gacha" && !seedOdds(c.id, data.drops, data.catalog).length) ||
    (c.kind === "seed" && c.grow_seconds <= 0);
  const label = busy
    ? "Đang xử lý..."
    : unavailable
      ? "Tạm ngừng bán"
      : guest
        ? "Đăng nhập để mua"
        : locked
          ? "Mở ở cấp " + c.min_level
          : !validQuantity
            ? "Chọn số lượng 1–99"
            : insufficient
              ? "Thiếu " + missing.toLocaleString("vi-VN") + " ĐTT"
              : "Mua · " + total.toLocaleString("vi-VN") + " ĐTT";
  return (
    <article className="shop-card">
      <div className="shop-art">
        <Art name={catalogArt(c)} />
      </div>
      <h3>{catalogLabel(c)}</h3>
      <p>
        {c.kind === "gacha"
          ? "Gieo 1 hạt → nhận 1 cây ngẫu nhiên"
          : c.kind === "seed"
            ? "Trồng " +
              c.name +
              " · " +
              Math.round(c.grow_seconds / 60) +
              " phút · " +
              c.xp +
              " XP"
            : "Giảm tối đa " + Math.round(c.reduction_seconds / 60) + " phút"}
      </p>
      {c.kind === "gacha" && <SeedOdds id={c.id} data={data} />}
      <p className="item-price">
        Giá: {c.price.toLocaleString("vi-VN")} Đồng tri thức
      </p>
      <span className="owned">Trong kho: {owned}</span>
      <label htmlFor={"quantity-" + c.id}>Số lượng</label>
      <input
        id={"quantity-" + c.id}
        type="number"
        min="1"
        max="99"
        step="1"
        value={quantity}
        onChange={(e) => setQuantity(Number(e.target.value))}
      />
      <button
        className="primary"
        disabled={
          busy ||
          unavailable ||
          !validQuantity ||
          (!guest && (locked || missing > 0))
        }
        onClick={() => onBuy(quantity)}
      >
        {label}
      </button>
    </article>
  );
}

function ProduceSales({needLogin}:{needLogin:()=>boolean}) {
  const {data, session, busy, run, retry, setNotice} = useGame();
  const produce = data.collection.filter(c => c.quantity > 0).map(c => ({stock:c, item:data.catalog.find(i => i.id === c.seed_id)})).filter(c => c.item?.kind === "seed");
  return <>
    <p className="panel-description">Bán nông sản đã thu hoạch để nhận VNĐ. Chọn số lượng và xem tổng tiền trước khi bán.</p>
    {!session ? <button className="secondary" onClick={needLogin}>Đăng nhập để bán nông sản</button> : !produce.length ? <p className="empty">Bạn chưa có nông sản để bán. Hãy thu hoạch cây trong vườn.</p> : <div className="shop-grid">{produce.map(({stock,item}) => <SellCard key={stock.seed_id} item={item!} owned={stock.quantity} busy={busy} onSell={quantity => {
      if (needLogin()) return;
      void run(async () => {
        const total = await retry.run(JSON.stringify(["sell",stock.seed_id,quantity,item!.sell_price]), request => rpc<number>("garden_sell_produce",{p_item:stock.seed_id,p_quantity:quantity,p_price:item!.sell_price,p_request:request}));
        setNotice(`Đã bán ${quantity} ${item!.name}, nhận ${total.toLocaleString("vi-VN")} VNĐ.`);
      }, undefined, ["profile","collection"]);
    }} />)}</div>}
  </>;
}
function SellCard({item,owned,busy,onSell}:{item:CatalogItem;owned:number;busy:boolean;onSell:(quantity:number)=>void}) {
  const [quantity,setQuantity]=useState(1);
  const price=item.sell_price ?? 0;
  const valid=Number.isInteger(quantity) && quantity>=1 && quantity<=Math.min(owned,99);
  return <article className="shop-card">
    <div className="shop-art"><Art name={harvestArt(item.id)} /></div>
    <h3>{item.name}</h3><span className="owned">Trong kho: {owned}</span>
    <p>Giá bán: {price.toLocaleString("vi-VN")} VNĐ / sản phẩm</p>
    <label htmlFor={"sell-"+item.id}>Số lượng bán</label>
    <input id={"sell-"+item.id} type="number" min={1} max={Math.min(owned,99)} step={1} value={quantity} onChange={e=>setQuantity(Number(e.target.value))} />
    <button className="primary" disabled={busy || !valid || price<=0} onClick={()=>onSell(quantity)}>{busy ? "Đang bán..." : price<=0 ? "Chưa thể bán" : !valid ? "Chọn số lượng hợp lệ" : `Bán · Nhận ${(price*quantity).toLocaleString("vi-VN")} VNĐ`}</button>
  </article>;
}
