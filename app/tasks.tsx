"use client";
import { useState } from "react";
import {
  cleanupFiles,
  loadTask,
  loadTaskPage,
  rpc,
  uploadFiles,
} from "../lib/api";
import { statusText, type Task } from "../lib/game";
import type { View } from "../lib/client-types";
import {
  DateLabel,
  Dialog,
  Empty,
  FileLinks,
  Icon,
  Money,
} from "./ui";
import { useGame } from "./game-session";
import { usePagedList, useResource, useSessionPreference } from "./data-hooks";
import { PageControls } from "./page-controls";
import { ProgressHistory } from "./progress-history";
import { HomeworkPhotos } from "./homework-photos";

type OpenFile = (path: string, bucket: string) => void;
export function Tasks({
  navigate,
  needLogin,
  openFile,
}: {
  navigate: (view: View) => void;
  needLogin: () => boolean;
  openFile: OpenFile;
}) {
  const { data: game, session, setError } = useGame();
  const [taskFilter, setTaskFilter] = useSessionPreference<"open" | "all">("tasks-filter", "open");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const page = usePagedList(
    "tasks:" + taskFilter,
    (cursor, signal) =>
      session
        ? loadTaskPage(
            session.user.id,
            false,
            taskFilter === "open",
            cursor,
            signal,
          )
        : Promise.resolve({ items: [], next: null }),
    ["tasks"],
  );
  const visibleTasks = page.items;
  function chooseTask(task: Task) {
    if (!needLogin()) {
      setSelectedId(task.id);
      setError("");
    }
  }
  return (
    <>
      <section className="parchment content-panel">
        <div className="panel-heading">
          <div>
            <p className="kicker">MỖI BÀI LÀ MỘT BƯỚC TIẾN</p>
            <h2>Nhiệm vụ</h2>
          </div>
          {game.manager && (
            <button className="secondary" onClick={() => navigate("admin")}>
              Quản lý bài tập
            </button>
          )}
        </div>
        {session && (
          <div className="tabs">
            <button
              className={taskFilter === "open" ? "active" : ""}
              onClick={() => setTaskFilter("open")}
            >
              Cần hoàn thành
            </button>
            <button
              className={taskFilter === "all" ? "active" : ""}
              onClick={() => setTaskFilter("all")}
            >
              Tất cả
            </button>
          </div>
        )}
        {!session ? (
          <Empty title="Bắt đầu hành trình học tập">
            Đăng nhập để xem bài tập và lưu thành quả của bạn.
            <button className="primary" onClick={() => needLogin()}>
              Đăng nhập
            </button>
          </Empty>
        ) : !page.loading && !visibleTasks.length ? (
          <Empty
            title={
              taskFilter === "open"
                ? "Chưa có nhiệm vụ cần hoàn thành"
                : "Chưa có nhiệm vụ"
            }
          >
            Bài tập mới sẽ xuất hiện ở đây khi được giao. Bạn có thể xem bài đã
            xong trong mục Tất cả.
          </Empty>
        ) : (
          <div className="task-list">
            {visibleTasks.map((t) => {
              const p = t.progress;
              return (
                <button
                  className="task-card"
                  onClick={(e) => {
                    e.currentTarget.focus();
                    chooseTask(t);
                  }}
                  key={t.id}
                >
                  <span className="task-symbol">
                    <Icon name="tasks" />
                  </span>
                  <span className="task-content">
                    <strong>{t.title}</strong>
                    <small>
                      Hạn nộp: <DateLabel value={t.due_at} />
                    </small>
                    <span className={"status " + (p?.status || "new")}>
                      {p ? statusText[p.status] : "Chưa nộp"}
                      {t.status === "hidden" ? " · Đã ẩn" : ""}
                    </span>
                  </span>
                  <span className="reward">
                    +{p?.status === "approved" ? p.reward_snapshot : t.reward}
                    <small>Đồng tri thức</small>
                  </span>
                </button>
              );
            })}
          </div>
        )}
        {session && <PageControls page={page} />}
      </section>
      {selectedId && session && (
        <TaskDialog
          key={selectedId}
          id={selectedId}
          openFile={openFile}
          onClose={() => setSelectedId(null)}
        />
      )}
    </>
  );
}
function TaskDialog({
  id,
  openFile,
  onClose,
}: {
  id: string;
  openFile: OpenFile;
  onClose: () => void;
}) {
  const { session, busy, run, error } = useGame();
  const [files, setFiles] = useState<File[]>([]);
  const resource = useResource(
    "task:" + id,
    (signal) => loadTask(id, session!.user.id, signal),
    ["tasks", "reviews"],
  );
  const selectedTask = resource.value;
  const ownProgress = selectedTask?.progress;
  async function submitTask() {
    if (!selectedTask || !session || !files.length) return;
    await run(
      async () => {
        const paths = await uploadFiles(
          files,
          "garden-homework",
          session.user.id,
        );
        try {
          await rpc("garden_submit_task", {
            p_task: selectedTask.id,
            p_files: paths,
          });
        } catch (e) {
          await cleanupFiles(paths, "garden-homework");
          throw e;
        }
        onClose();
        setFiles([]);
      },
      "Đã nộp bài. Bạn sẽ nhận thưởng khi được duyệt.",
      ["tasks", "reviews"],
    );
  }

  if (!selectedTask)
    return (
      <Dialog title="Nhiệm vụ" onClose={onClose}>
        <p role="status">
          {resource.loading
            ? "Đang tải..."
            : resource.error || "Nhiệm vụ không còn khả dụng."}
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
    <Dialog title={selectedTask.title} drawer onClose={() => onClose()}>
      <div className="task-meta">
        <Money
          amount={
            ownProgress?.status === "approved"
              ? ownProgress.reward_snapshot
              : selectedTask.reward
          }
        />
        <span>
          Hạn: <DateLabel value={selectedTask.due_at} />
        </span>
      </div>
      <p className="task-body">{selectedTask.body}</p>
      <FileLinks
        files={selectedTask.files}
        onOpen={(p) => openFile(p, "garden-task-files")}
      />
      {ownProgress && (
        <>
          <p className={"status " + ownProgress.status}>
            {statusText[ownProgress.status]}
            {selectedTask.due_at &&
            Date.parse(ownProgress.submitted_at) >
              Date.parse(selectedTask.due_at)
              ? " · Nộp trễ"
              : ""}
          </p>
          <ProgressHistory progressId={ownProgress.id} openFile={openFile} />
        </>
      )}
      {selectedTask.status === "published" &&
      (!ownProgress || ownProgress.status === "returned") ? (
        <>
          <HomeworkPhotos files={files} onChange={setFiles} disabled={busy} />
          <button
            className="primary"
            disabled={busy || files.length === 0}
            onClick={submitTask}
          >
            {busy
              ? "Đang nộp bài..."
              : ownProgress
                ? "Nộp lại bài"
                : "Nộp bài để chờ duyệt"}
          </button>
        </>
      ) : (
        <p className="helper">
          {ownProgress?.status === "approved"
            ? "Bạn đã nhận thưởng cho nhiệm vụ này."
            : ownProgress?.status === "submitted"
              ? "Bài của bạn đang chờ quản lý kiểm tra."
              : "Nhiệm vụ đã ẩn, hiện không nhận bài mới."}
        </p>
      )}
      {error && (
        <p className="inline-error" role="alert">
          {error}
        </p>
      )}
    </Dialog>
  );
}
