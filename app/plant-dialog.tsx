"use client";
import { rpc } from "../lib/api";
import {
  itemName,
  plantArt,
  plantDefinition,
  plantVisual,
  timeLeft,
} from "../lib/game";
import { gardenSlotLabel } from "../lib/garden-map";
import type { View } from "../lib/client-types";
import { Art, Dialog } from "./ui";
import { SeedPicker } from "./seed-picker";
import { useGame } from "./game-session";
import { useClock } from "./data-hooks";
import { Watering } from "./watering";

export function PlantDialog({
  slot,
  setSlot,
  navigate,
}: {
  slot: number;
  setSlot: (slot: number | null) => void;
  navigate: (view: View) => void;
}) {
  const { data: game, busy, run, error } = useGame();
  const now = useClock();
  const plot = game.plots.find((p) => p.slot === slot);
  const visual = plot ? plantVisual(plot, now) : null;
  const inventory = (id: string) =>
    game.inventory.find((i) => i.item_id === id)?.quantity || 0;
  if (!plot && !game.unlockedSlots.includes(slot)) return null;
  return (
    <Dialog
      title={
        plot
          ? itemName(plot.seed_id, game.catalog)
          : "Gieo hạt · " + gardenSlotLabel(slot)
      }
      onClose={() => setSlot(null)}
    >
      {!game.unlockedSlots.includes(slot) && (
        <p className="helper">
          Bạn có thể thu hoạch cây hiện có. Vị trí này cần mở khóa trước khi
          gieo cây mới.
        </p>
      )}
      {plot && visual ? (
        <>
          <Art name={visual.art} className="detail-plant" />
          <p className="center growth-label">{visual.label}</p>
          <div className="growth-track" aria-label="Các giai đoạn phát triển">
            {Array.from({ length: visual.total }, (_, i) => i + 1).map(
              (stage) => (
                <span
                  className={stage <= visual.stage ? "reached" : ""}
                  key={stage}
                  aria-current={stage === visual.stage ? "step" : undefined}
                >
                  <Art name={plantArt(plot.seed_id, stage)} />
                  <small>
                    {stage === 1
                      ? plantDefinition(plot.seed_id)?.orchard
                        ? "Cây con"
                        : "Mới gieo"
                      : stage === visual.total
                        ? "Chín"
                        : stage}
                  </small>
                </span>
              ),
            )}
          </div>
          {plot.source_seed_id && (
            <p className="center helper">
              Gieo từ {itemName(plot.source_seed_id, game.catalog)}
            </p>
          )}
          <p className="center">{timeLeft(plot.ready_at, now)}</p>
          <p className="center helper">
            Thu hoạch nhận {plot.xp_reward} XP và 1 nông sản
          </p>
          {Date.parse(plot.ready_at) <= now ? (
            <button
              className="primary"
              disabled={busy}
              onClick={() =>
                run(
                  async () => {
                    await rpc("garden_harvest", { p_plot: plot.id });
                    setSlot(null);
                  },
                  "Đã thu hoạch nông sản và nhận XP!",
                  ["profile", "garden", "collection"],
                )
              }
            >
              Thu hoạch
            </button>
          ) : (
            <>
              <Watering key={plot.id} plot={plot} now={now} />
              <button
                className="primary"
                disabled={busy || inventory("fertilizer") === 0}
                onClick={() =>
                  run(
                    async () => {
                      await rpc("garden_fertilize", { p_plot: plot.id });
                    },
                    "Đã bón phân cho cây.",
                    ["garden", "inventory"],
                  )
                }
              >
                Bón phân · còn {inventory("fertilizer")}
              </button>
              <p className="helper">
                Giảm tối đa{" "}
                {Math.round(
                  (game.catalog.find((c) => c.id === "fertilizer")
                    ?.reduction_seconds || 1800) / 60,
                )}{" "}
                phút chờ cho mỗi phần phân bón.
              </p>
              <button
                className="secondary"
                onClick={() => {
                  setSlot(null);
                  navigate("shop");
                }}
              >
                Mua phân bón
              </button>
            </>
          )}
        </>
      ) : (
        <>
          <p>
            Chọn hạt trong kho để gieo. Hạt gacha sẽ trở thành một cây ngẫu
            nhiên ngay khi gieo.
          </p>
          <SeedPicker
            data={game}
            busy={busy}
            onPlant={(item) =>
              run(
                async () => {
                  await rpc("garden_plant", { p_slot: slot, p_seed: item.id });
                },
                item.kind === "gacha"
                  ? "Đã gieo hạt! Cây bạn nhận được đang ở vị trí này."
                  : "Đã gieo hạt giống.",
                ["garden", "inventory"],
              )
            }
          />
          <button
            className="secondary"
            onClick={() => {
              setSlot(null);
              navigate("shop");
            }}
          >
            Mua thêm hạt giống
          </button>
        </>
      )}
      {error && (
        <p className="inline-error" role="alert">
          {error}
        </p>
      )}
    </Dialog>
  );
}
