"use client";
import { useState } from "react";
import { loadReview, rpc } from "../lib/api";
import { statusText } from "../lib/game";
import { Dialog } from "./ui";
import { useGame } from "./game-session";
import { useResource } from "./data-hooks";
import { ProgressHistory } from "./progress-history";

export function ReviewDialog({
  id,
  onClose,
  openFile,
}: {
  id: string;
  onClose: () => void;
  openFile: (path: string, bucket: string) => void;
}) {
  const { busy, run, error } = useGame();
  const [note, setNote] = useState(""),
    [bonus, setBonus] = useState(0),
    [localError, setLocalError] = useState("");
  const resource = useResource(
    "review:" + id,
    (signal) => loadReview(id, signal),
    ["tasks", "reviews"],
  );
  const currentReview = resource.value;
  const currentTask = currentReview?.task;
  if (!currentReview)
    return (
      <Dialog title="Duyệt bài" onClose={onClose}>
        <p role="status">
          {resource.loading
            ? "Đang tải..."
            : resource.error || "Bài nộp không còn khả dụng."}
        </p>
        {resource.error && (
          <button
            className="secondary"
            onClick={() => void resource.refresh().catch(() => {})}
          >
            Thử lại
          </button>
        )}
      </Dialog>
    );
  return (
    <Dialog
      title={"Duyệt: " + (currentTask?.title || "Bài tập")}
      onClose={() => onClose()}
    >
      <p>
        <strong>{currentReview.person?.display_name || "Người chơi"}</strong>
      </p>
      <p className={"status " + currentReview.status}>
        {statusText[currentReview.status]}
        {currentTask?.due_at &&
        Date.parse(currentReview.submitted_at) > Date.parse(currentTask.due_at)
          ? " · Nộp trễ"
          : ""}
      </p>
      <p>Thưởng cơ bản: {currentReview.reward_snapshot} Đồng tri thức</p>
      <ProgressHistory progressId={currentReview.id} openFile={openFile} />
      {(currentReview.status === "submitted" ||
        (currentReview.status === "approved" &&
          !currentReview.bonus_given)) && (
        <>
          <label htmlFor="review-note">Nhận xét</label>
          <textarea
            id="review-note"
            rows={3}
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
          <label htmlFor="review-bonus">Đồng tri thức thưởng thêm</label>
          <input
            id="review-bonus"
            type="number"
            min={0}
            max={100000}
            step={1}
            value={bonus}
            onChange={(e) => setBonus(Number(e.target.value))}
          />
          {currentReview.status === "submitted" ? (
            <>
              <button
                className="primary"
                disabled={busy || !Number.isInteger(bonus) || bonus < 0}
                onClick={() =>
                  run(
                    async () => {
                      await rpc("garden_review", {
                        p_progress: currentReview.id,
                        p_accept: true,
                        p_note: note,
                        p_bonus: bonus,
                      });
                      onClose();
                    },
                    "Đã duyệt bài và phát thưởng.",
                    ["profile", "tasks", "reviews", "ledger"],
                  )
                }
              >
                Duyệt hoàn thành & thưởng{" "}
                {currentReview.reward_snapshot + bonus} ĐTT
              </button>
              <button
                className="secondary"
                disabled={busy}
                onClick={() => {
                  if (!note.trim()) {
                    setLocalError(
                      "Ghi hướng dẫn để người chơi biết cần bổ sung điều gì.",
                    );
                    return;
                  }
                  run(
                    async () => {
                      await rpc("garden_review", {
                        p_progress: currentReview.id,
                        p_accept: false,
                        p_note: note,
                        p_bonus: 0,
                      });
                      onClose();
                    },
                    "Đã gửi yêu cầu bổ sung.",
                    ["profile", "tasks", "reviews", "ledger"],
                  );
                }}
              >
                Yêu cầu bổ sung
              </button>
            </>
          ) : (
            <button
              className="primary"
              disabled={busy || !Number.isInteger(bonus) || bonus <= 0}
              onClick={() =>
                run(
                  async () => {
                    await rpc("garden_bonus", {
                      p_progress: currentReview.id,
                      p_amount: bonus,
                      p_note: note,
                    });
                    onClose();
                  },
                  "Đã tặng Đồng tri thức thưởng thêm.",
                  ["profile", "tasks", "reviews", "ledger"],
                )
              }
            >
              Tặng thêm {bonus} Đồng tri thức
            </button>
          )}
        </>
      )}
      {currentReview.bonus_given && (
        <p className="helper">Bài này đã nhận khoản thưởng thêm.</p>
      )}
      {(localError || error) && (
        <p className="inline-error" role="alert">
          {localError || error}
        </p>
      )}
    </Dialog>
  );
}
