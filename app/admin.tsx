"use client";
import { useState } from "react";
import { cleanupFiles, rpc, uploadFiles } from "../lib/api";
import {
  catalogArt,
  catalogLabel,
  plantStages,
  type Task,
  type CatalogItem,
} from "../lib/game";
import { Art, Dialog, FilePicker, SeedOdds } from "./ui";
import { useGame } from "./game-session";
import { useResource } from "./data-hooks";
import { loadPendingCount } from "../lib/api";
import { AdminTaskList, AdminReviewList } from "./admin-lists";
import { ReviewDialog } from "./review-dialog";
import { CheatMenu } from "./cheats";
import { QuestionBank } from "./question-bank";

function localDate(value: string | null) {
  if (!value) return "";
  const d = new Date(value);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 16);
}
export function Admin({
  openFile,
}: {
  openFile: (p: string, b: string) => void;
}) {
  const { data, session, busy, run, error } = useGame();
  const userId = session!.user.id;
  const pending = useResource("review-count", loadPendingCount, [
    "reviews",
    "tasks",
  ]);
  const [tab, setTab] = useState("tasks");
  const [editor, setEditor] = useState(false),
    [taskId, setTaskId] = useState<string | null>(null);
  const [title, setTitle] = useState(""),
    [body, setBody] = useState(""),
    [due, setDue] = useState(""),
    [reward, setReward] = useState(20);
  const [attachments, setAttachments] = useState<string[]>([]),
    [files, setFiles] = useState<File[]>([]);
  const [reviewId, setReviewId] = useState<string | null>(null),
    [localError, setLocalError] = useState("");
  const [catalog, setCatalog] = useState<CatalogItem | null>(null);
  function editTask(task?: Task) {
    setTaskId(task?.id || null);
    setTitle(task?.title || "");
    setBody(task?.body || "");
    setDue(localDate(task?.due_at || null));
    setReward(task?.reward ?? 20);
    setAttachments(task?.files || []);
    setFiles([]);
    setLocalError("");
    setEditor(true);
  }
  function saveTask(status: string) {
    if (!title.trim() || attachments.length + files.length > 5) {
      setLocalError("Nhập tiêu đề và đính kèm tối đa 5 tệp.");
      return;
    }
    run(
      async () => {
        const paths = await uploadFiles(files, "garden-task-files", userId);
        try {
          await rpc("garden_save_task", {
            p_id: taskId,
            p_title: title,
            p_body: body,
            p_due: due ? new Date(due).toISOString() : null,
            p_reward: reward,
            p_status: status,
            p_files: [...attachments, ...paths],
          });
        } catch (e) {
          await cleanupFiles(paths, "garden-task-files");
          throw e;
        }
        setEditor(false);
      },
      status === "published" ? "Nhiệm vụ đã được đăng." : "Đã lưu nhiệm vụ.",
      ["tasks", "reviews"],
    );
  }
  return (
    <section className="parchment content-panel admin-panel">
      <p className="kicker">GÓC CỦA NGƯỜI GIAO BÀI</p>
      <h2>Quản lý</h2>
      <div className="tabs">
        {[
          ["tasks", "Bài tập"],
          ["reviews", "Duyệt bài"],
          ["catalog", "Cấu hình cửa hàng"],
          ["questions", "Ngân hàng câu hỏi"],
          ["cheats", "Cheat menu"],
        ].map(([id, label]) => (
          <button
            className={tab === id ? "active" : ""}
            key={id}
            onClick={() => setTab(id)}
          >
            {label}
            {id === "reviews" && pending.value
              ? " (" + pending.value + ")"
              : ""}
          </button>
        ))}
      </div>
      {tab === "cheats" && (
        <CheatMenu data={data} busy={busy} run={run} error={error} />
      )}
      {tab === "tasks" && <AdminTaskList editTask={editTask} />}
      {tab === "reviews" && <AdminReviewList onReview={setReviewId} />}
      {tab === "questions" && <QuestionBank />}
      {tab === "catalog" && (
        <>
          <p className="helper">
            Cửa hàng bán hạt gacha, hạt cây đã khám phá và phân bón. Cấu hình
            từng cây quyết định thời gian lớn và XP khi gieo.
          </p>
          <div className="shop-grid">
            {data.catalog.map((c) => (
              <article className="shop-card" key={c.id}>
                <Art name={catalogArt(c)} />
                <h3>{c.kind === "seed" ? c.name : catalogLabel(c)}</h3>
                {c.kind === "seed" ? (
                  <p>
                    {c.price} ĐTT · {Math.round(c.grow_seconds / 60)} phút ·{" "}
                    {c.xp} XP · {plantStages[c.id]} giai đoạn
                  </p>
                ) : (
                  <p>
                    {c.price} ĐTT · Cấp {c.min_level}
                  </p>
                )}
                {c.kind === "fertilizer" && (
                  <p>Giảm {Math.round(c.reduction_seconds / 60)} phút</p>
                )}
                {c.kind === "gacha" && (
                  <SeedOdds id={c.id} data={data} revealAll />
                )}
                <span className="status">
                  {c.kind === "seed"
                    ? c.active
                      ? "Có trong gacha"
                      : "Tạm ngừng xuất hiện"
                    : c.active
                      ? "Đang bán"
                      : "Ngừng bán"}
                </span>
                <button
                  className="secondary"
                  onClick={() => setCatalog({ ...c })}
                >
                  Chỉnh cấu hình
                </button>
              </article>
            ))}
          </div>
        </>
      )}
      {editor && (
        <Dialog
          title={taskId ? "Chỉnh nhiệm vụ" : "Tạo nhiệm vụ"}
          onClose={() => setEditor(false)}
        >
          <form
            onSubmit={(e) => {
              e.preventDefault();
              saveTask("published");
            }}
          >
            <label htmlFor="task-title">Tiêu đề</label>
            <input
              id="task-title"
              maxLength={180}
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
            <label htmlFor="task-body">Hướng dẫn</label>
            <textarea
              id="task-body"
              rows={5}
              value={body}
              onChange={(e) => setBody(e.target.value)}
            />
            <label htmlFor="task-due">
              Hạn nộp (để trống nếu không giới hạn)
            </label>
            <input
              id="task-due"
              type="datetime-local"
              value={due}
              onChange={(e) => setDue(e.target.value)}
            />
            <label htmlFor="task-reward">Thưởng cơ bản · Đồng tri thức</label>
            <input
              id="task-reward"
              type="number"
              min={0}
              max={100000}
              step={1}
              required
              value={reward}
              onChange={(e) => setReward(Number(e.target.value))}
            />
            <div className="attachments-edit">
              {attachments.map((p, i) => (
                <div key={p}>
                  <button
                    type="button"
                    className="link-button"
                    onClick={() => openFile(p, "garden-task-files")}
                  >
                    Tệp {i + 1}: {p.split("/").pop()}
                  </button>
                  <button
                    type="button"
                    aria-label={"Bỏ tệp " + (i + 1)}
                    onClick={() =>
                      setAttachments((a) => a.filter((f) => f !== p))
                    }
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
            <FilePicker id="task-files" files={files} onChange={setFiles} pdf />
            {(localError || error) && (
              <p className="inline-error" role="alert">
                {localError || error}
              </p>
            )}
            <button className="primary" disabled={busy}>
              Đăng nhiệm vụ
            </button>
            <div className="button-row">
              <button
                className="secondary"
                type="button"
                disabled={busy}
                onClick={() => saveTask("draft")}
              >
                Lưu bản nháp
              </button>
              {taskId && (
                <button
                  className="secondary"
                  type="button"
                  disabled={busy}
                  onClick={() => saveTask("hidden")}
                >
                  Ẩn nhiệm vụ
                </button>
              )}
            </div>
          </form>
        </Dialog>
      )}
      {reviewId && (
        <ReviewDialog
          key={reviewId}
          id={reviewId}
          onClose={() => setReviewId(null)}
          openFile={openFile}
        />
      )}
      {catalog && (
        <Dialog
          title={"Cấu hình " + catalog.name}
          onClose={() => setCatalog(null)}
        >
          <form
            onSubmit={(e) => {
              e.preventDefault();
              run(
                async () => {
                  await rpc("garden_save_catalog", {
                    p_item: catalog.id,
                    p_price: catalog.price,
                    p_seconds: Math.max(60, catalog.grow_seconds),
                    p_xp: catalog.xp,
                    p_level: catalog.min_level,
                    p_reduction: Math.max(60, catalog.reduction_seconds),
                    p_active: catalog.active,
                  });
                  setCatalog(null);
                },
                "Đã cập nhật cửa hàng.",
                ["catalog"],
              );
            }}
          >
            <label htmlFor="catalog-price">Giá · Đồng tri thức</label>
            <input
              id="catalog-price"
              type="number"
              required
              min={0}
              max={100000}
              step={1}
              value={catalog.price}
              onChange={(e) =>
                setCatalog({ ...catalog, price: Number(e.target.value) })
              }
            />
            {catalog.kind !== "seed" && (
              <>
                <label htmlFor="catalog-level">Cấp mở khóa</label>
                <input
                  id="catalog-level"
                  type="number"
                  min={1}
                  max={100}
                  step={1}
                  required
                  value={catalog.min_level}
                  onChange={(e) =>
                    setCatalog({
                      ...catalog,
                      min_level: Number(e.target.value),
                    })
                  }
                />
              </>
            )}
            {catalog.kind === "seed" && (
              <>
                <label htmlFor="catalog-minutes">Thời gian lớn · phút</label>
                <input
                  id="catalog-minutes"
                  type="number"
                  min={1}
                  max={43200}
                  required
                  value={catalog.grow_seconds / 60}
                  onChange={(e) =>
                    setCatalog({
                      ...catalog,
                      grow_seconds: Number(e.target.value) * 60,
                    })
                  }
                />
                <label htmlFor="catalog-xp">XP khi thu hoạch</label>
                <input
                  id="catalog-xp"
                  type="number"
                  min={0}
                  max={100000}
                  step={1}
                  required
                  value={catalog.xp}
                  onChange={(e) =>
                    setCatalog({ ...catalog, xp: Number(e.target.value) })
                  }
                />
              </>
            )}
            {catalog.kind === "fertilizer" && (
              <>
                <label htmlFor="catalog-reduction">Thời gian giảm · phút</label>
                <input
                  id="catalog-reduction"
                  type="number"
                  min={1}
                  max={43200}
                  required
                  value={catalog.reduction_seconds / 60}
                  onChange={(e) =>
                    setCatalog({
                      ...catalog,
                      reduction_seconds: Number(e.target.value) * 60,
                    })
                  }
                />
              </>
            )}
            {catalog.kind === "gacha" && (
              <SeedOdds id={catalog.id} data={data} revealAll />
            )}
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={catalog.active}
                onChange={(e) =>
                  setCatalog({ ...catalog, active: e.target.checked })
                }
              />
              {catalog.kind === "seed"
                ? "Cho phép xuất hiện từ gacha và bán hạt đã khám phá"
                : "Đang bán"}
            </label>
            <p className="helper">
              Cây đã trồng giữ thời gian và XP tại lúc gieo. Khi tắt một cây, tỷ
              lệ các cây còn lại được chia lại theo trọng số.
            </p>
            {error && (
              <p className="inline-error" role="alert">
                {error}
              </p>
            )}
            <button className="primary" disabled={busy}>
              Lưu cấu hình
            </button>
          </form>
        </Dialog>
      )}
    </section>
  );
}
