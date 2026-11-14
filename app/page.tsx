"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "../lib/supabase";
import { rpc } from "../lib/api";
import { catalogArt, catalogLabel, harvestArt, levelInfo, levelTitle } from "../lib/game";
import { slotUnlockCost } from "../lib/garden-map";
import type { View } from "../lib/client-types";
import { Art, Dialog, Icon, Money, VndMoney } from "./ui";
import { GardenMap } from "./garden-map";
import { GameProvider, useGame, useSession } from "./game-session";

const fallback = () => <p role="status">Đang tải...</p>;
function Toast({ id, text, dismiss }: { id: number; text: string; dismiss: (id: number) => void }) {
  useEffect(() => {
    const timer = setTimeout(() => dismiss(id), 2500);
    return () => clearTimeout(timer);
  }, [id, dismiss]);
  return <div className="toast">{text}</div>;
}
const Tasks = dynamic(() => import("./tasks").then((m) => m.Tasks), {
  loading: fallback,
});
const Shop = dynamic(() => import("./shop").then((m) => m.Shop), {
  loading: fallback,
});
const Account = dynamic(() => import("./account").then((m) => m.Account), {
  loading: fallback,
});
const Admin = dynamic(() => import("./admin").then((m) => m.Admin), {
  loading: fallback,
});
const PlantDialog = dynamic(
  () => import("./plant-dialog").then((m) => m.PlantDialog),
  { loading: fallback },
);
const AuthDialog = dynamic(
  () => import("./auth-dialog").then((m) => m.AuthDialog),
  { loading: fallback },
);

export default function Home() {
  const { session, ready, error, epoch } = useSession();
  return (
    <SessionShell
      key={epoch}
      session={session}
      ready={ready}
      authError={error}
    />
  );
}
function SessionShell({
  session,
  ready,
  authError,
}: {
  session: Session | null;
  ready: boolean;
  authError: string;
}) {
  const [view, setView] = useState<View>("garden");
  return (
    <GameProvider session={session} view={view}>
      <GameShell
        ready={ready}
        authError={authError}
        view={view}
        setView={setView}
      />
    </GameProvider>
  );
}
function GameShell({
  ready,
  authError,
  view,
  setView,
}: {
  ready: boolean;
  authError: string;
  view: View;
  setView: (view: View) => void;
}) {
  const {
    session,
    data: game,
    loading,
    busy,
    error,
    setError,
    notices,
    dismissNotice,
    run,
    refresh,
  } = useGame();
  const [slot, setSlot] = useState<number | null>(null);
  const [unlockSlot, setUnlockSlot] = useState<{
    slot: number;
    request: string;
  } | null>(null);
  const [auth, setAuth] = useState(false),
    [signup, setSignup] = useState(false);
  const [preview, setPreview] = useState<{ url: string; pdf: boolean } | null>(
    null,
  );
  const active = useRef(true),
    fileRequest = useRef(0);
  const lv = levelInfo(game.profile?.xp || 0);
  const unlockPrice = slotUnlockCost(game.unlockedSlots.length);
  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
      fileRequest.current++;
    };
  }, []);
  useEffect(() => {
    if (authError) setError(authError);
  }, [authError, setError]);
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [view]);
  const needLogin = useCallback(() => {
    if (!session) {
      setAuth(true);
      return true;
    }
    return false;
  }, [session]);
  const selectSlot = useCallback(
    (selected: number) => {
      if (!needLogin()) {
        setSlot(selected);
        setError("");
      }
    },
    [needLogin, setError],
  );
  const selectUnlock = useCallback(
    (selected: number) => {
      if (!needLogin()) {
        setUnlockSlot({ slot: selected, request: crypto.randomUUID() });
        setError("");
      }
    },
    [needLogin, setError],
  );
  const navigate = useCallback(
    (next: View) => {
      setView(next);
      setSlot(null);
      setUnlockSlot(null);
      setError("");
    },
    [setView, setError],
  );
  const openFile = useCallback(
    async (path: string, bucket: string) => {
      const request = ++fileRequest.current;
      try {
        if (!supabase) throw new Error("Chưa kết nối được dịch vụ.");
        const result = await supabase.storage
          .from(bucket)
          .createSignedUrl(path, 300);
        if (result.error) throw result.error;
        if (active.current && request === fileRequest.current)
          setPreview({
            url: result.data.signedUrl,
            pdf: path.toLowerCase().endsWith(".pdf"),
          });
      } catch {
        if (active.current && request === fileRequest.current)
          setError("Chưa mở được tệp. Hãy thử lại.");
      }
    },
    [setError],
  );
  return (
    <div className="world">
      <header className="game-header">
        <div className="hud">
          <button
            className="player"
            onClick={() => navigate("account")}
            aria-label={
              "Mở tài khoản · Cấp " + lv.level + " · " + lv.current + "/" + lv.needed + " XP · " + levelTitle(lv.level)
            }
          >
            <span className="avatar">
              <Icon name="account" />
            </span>
            <span>
              <small>Cấp {lv.level} · {lv.current}/{lv.needed} XP</small>
              <span className="xp-bar">
                <span style={{ width: lv.progress + "%" }} />
              </span>
              <span className="player-title">{levelTitle(lv.level)}</span>
            </span>
          </button>
          <div className="wallet-balances">
            <button className="wallet" onClick={() => navigate("account")} aria-label={"Ví " + (game.profile?.coins || 0) + " Đồng tri thức"}>
              <Money amount={game.profile?.coins || 0} />
            </button>
            <button className="wallet" onClick={() => navigate("shop")} aria-label={"Mở cửa hàng · " + (game.profile?.vnd || 0) + " VNĐ"}>
              <VndMoney amount={game.profile?.vnd || 0} />
            </button>
          </div>
        </div>
      </header>
      <main className={"main-content view-" + view}>
        {!ready || loading ? (
          <div className="loading" role="status">
            Đang chuẩn bị khu vườn...
          </div>
        ) : null}
        {error && (
          <div className="alert" role="alert">
            <span>{error}</span>
            <button
              onClick={() => {
                setError("");
                void refresh().catch((e) => setError(e.message));
              }}
            >
              Thử lại
            </button>
            <button aria-label="Đóng thông báo" onClick={() => setError("")}>
              ×
            </button>
          </div>
        )}
        <div className="toast-stack" role="status" aria-live="polite" aria-relevant="additions">
          {notices.slice(0, 3).map(notice => <Toast key={notice.id} {...notice} dismiss={dismissNotice} />)}
        </div>
        {view === "garden" && (
          <GardenMap
            plots={game.plots}
            catalog={game.catalog}
            unlockedSlots={game.unlockedSlots}
            onSelect={selectSlot}
            onUnlock={selectUnlock}
          />
        )}
        {view === "tasks" && (
          <Tasks
            navigate={navigate}
            needLogin={needLogin}
            openFile={openFile}
          />
        )}
        {view === "shop" && <Shop needLogin={needLogin} />}
        {view === "warehouse" && (
          <section className="content-panel parchment">
            <h2>Kho đồ</h2>
            <h3>Hạt giống &amp; phân bón</h3>
            <div className="collection">
              {game.inventory.filter(i => i.quantity > 0).map(i => { const item = game.catalog.find(c => c.id === i.item_id); return item ? <div className="collection-item" key={i.item_id}><Art name={catalogArt(item)} /><strong>{catalogLabel(item)}</strong><span>Số lượng: {i.quantity}</span></div> : null; })}
            </div>
            {!game.inventory.some(i => i.quantity > 0) && <p>Chưa có hạt giống hoặc phân bón.</p>}
            <h3>Nông sản</h3>
            <div className="collection">
              {game.collection.filter(i => i.quantity > 0).map(i => { const item = game.catalog.find(c => c.id === i.seed_id); return item ? <div className="collection-item" key={i.seed_id}><Art name={harvestArt(i.seed_id)} /><strong>{item.name}</strong><span>Số lượng: {i.quantity}</span></div> : null; })}
            </div>
            {!game.collection.some(i => i.quantity > 0) && <p>Chưa có nông sản.</p>}
          </section>
        )}
        {view === "account" && (
          <Account
            navigate={navigate}
            openAuth={(signup) => {
              setSignup(signup);
              setAuth(true);
            }}
          />
        )}
        {view === "admin" && game.manager && session && (
          <Admin openFile={openFile} />
        )}
      </main>
      <nav className="bottom-nav" aria-label="Điều hướng chính">
        {(
          [
            ["garden", "Khu vườn"],
            ["tasks", "Nhiệm vụ"],
            ["shop", "Cửa hàng"],
            ["warehouse", "Kho đồ"],
            ["account", "Tài khoản"],
          ] as [View, string][]
        ).map(([id, label]) => (
          <button
            className={view === id ? "active" : ""}
            key={id}
            onClick={() => navigate(id)}
            aria-current={view === id ? "page" : undefined}
          >
            <Icon name={id} />
            <span>{label}</span>
          </button>
        ))}
      </nav>
      {auth && (
        <AuthDialog initialSignup={signup} onClose={() => setAuth(false)} />
      )}
      {unlockSlot && session && (
        <Dialog
          title={"Mở vị trí trồng " + (unlockSlot.slot + 1)}
          onClose={() => {
            if (!busy) setUnlockSlot(null);
          }}
        >
          <p>Mở thêm một vị trí để trồng 1 cây. Khu vườn có tối đa 16 cây.</p>
          <div className="info-row">
            <span>Chi phí mở vị trí</span>
            <strong>
              {unlockPrice?.toLocaleString("vi-VN")} Đồng tri thức
            </strong>
          </div>
          <div className="info-row">
            <span>Số dư của bạn</span>
            <strong>
              {(game.profile?.coins || 0).toLocaleString("vi-VN")} Đồng tri thức
            </strong>
          </div>
          {unlockPrice !== null && (game.profile?.coins || 0) < unlockPrice && (
            <p className="helper">
              Bạn cần thêm{" "}
              {(unlockPrice - (game.profile?.coins || 0)).toLocaleString(
                "vi-VN",
              )}{" "}
              Đồng tri thức.
            </p>
          )}
          <button
            className="primary"
            disabled={
              busy ||
              unlockPrice === null ||
              (game.profile?.coins || 0) < unlockPrice
            }
            onClick={() =>
              run(
                async () => {
                  await rpc("garden_unlock_slot", {
                    p_slot: unlockSlot.slot,
                    p_cost: unlockPrice,
                    p_request: unlockSlot.request,
                  });
                  setUnlockSlot(null);
                },
                "Đã mở thêm 1 vị trí trồng cây!",
                ["profile", "garden", "ledger"],
              )
            }
          >
            {busy
              ? "Đang mở vị trí..."
              : "Mở vị trí · " +
                unlockPrice?.toLocaleString("vi-VN") +
                " Đồng tri thức"}
          </button>
          {error && (
            <p className="inline-error" role="alert">
              {error}
            </p>
          )}
        </Dialog>
      )}
      {slot !== null && session && (
        <PlantDialog slot={slot} setSlot={setSlot} navigate={navigate} />
      )}
      {preview && (
        <Dialog title="Tệp đính kèm" onClose={() => setPreview(null)}>
          {preview.pdf ? (
            <a
              className="primary file-link"
              href={preview.url}
              target="_blank"
              rel="noopener noreferrer"
            >
              Mở tài liệu PDF
            </a>
          ) : (
            <img
              className="preview-image"
              src={preview.url}
              alt="Nội dung tệp đính kèm"
              width="1000"
              height="1000"
            />
          )}
        </Dialog>
      )}
    </div>
  );
}
