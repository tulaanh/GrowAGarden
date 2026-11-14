"use client";

import { loadReviewPage, loadTaskPage } from "../lib/api";
import { statusText, type Task } from "../lib/game";
import { useGame } from "./game-session";
import { usePagedList, useSessionPreference } from "./data-hooks";
import { DateLabel, Empty, Money } from "./ui";
import { PageControls } from "./page-controls";

export function AdminTaskList({
  editTask,
}: {
  editTask: (task?: Task) => void;
}) {
  const { session } = useGame();
  const page = usePagedList(
    "admin-tasks",
    (cursor, signal) =>
      loadTaskPage(session!.user.id, true, false, cursor, signal),
    ["tasks"],
  );
  return (
    <>
      <div className="panel-heading">
        <h3>Danh sách nhiệm vụ</h3>
        <button className="primary compact" onClick={() => editTask()}>
          Tạo nhiệm vụ
        </button>
      </div>
      {!page.loading && !page.items.length ? (
        <Empty title="Giao bài đầu tiên">
          Tạo đề bài, đặt hạn nộp và Đồng tri thức cho người hoàn thành.
        </Empty>
      ) : (
        <div className="task-list">
          {page.items.map((task) => (
            <article className="admin-task" key={task.id}>
              <div>
                <strong>{task.title}</strong>
                <small>
                  {task.status === "published"
                    ? "Đã đăng"
                    : task.status === "draft"
                      ? "Bản nháp"
                      : "Đã ẩn"}{" "}
                  · Hạn <DateLabel value={task.due_at} />
                </small>
                <Money amount={task.reward} />
              </div>
              <button className="secondary" onClick={() => editTask(task)}>
                Chỉnh sửa
              </button>
            </article>
          ))}
        </div>
      )}
      <PageControls page={page} />
    </>
  );
}

export function AdminReviewList({
  onReview,
}: {
  onReview: (id: string) => void;
}) {
  const [filter, setFilter] = useSessionPreference("admin-review-filter", "submitted");
  const page = usePagedList(
    "admin-reviews:" + filter,
    (cursor, signal) => loadReviewPage(filter, cursor, signal),
    ["reviews", "tasks"],
  );
  return (
    <>
      <label htmlFor="review-filter">Trạng thái bài</label>
      <select
        id="review-filter"
        value={filter}
        onChange={(event) => setFilter(event.target.value)}
      >
        <option value="submitted">Chờ duyệt</option>
        <option value="approved">Hoàn thành</option>
        <option value="returned">Cần bổ sung</option>
        <option value="all">Tất cả</option>
      </select>
      {!page.loading && !page.items.length ? (
        <Empty title="Chưa có bài ở trạng thái này">
          Các bài người chơi gửi sẽ xuất hiện tại đây.
        </Empty>
      ) : (
        <div className="task-list">
          {page.items.map((progress) => (
            <button
              className="task-card"
              key={progress.id}
              onClick={() => onReview(progress.id)}
            >
              <span className="task-content">
                <strong>{progress.task?.title || "Nhiệm vụ"}</strong>
                <small>
                  {progress.person?.display_name || "Người chơi"} ·{" "}
                  <DateLabel value={progress.submitted_at} />
                </small>
                <span className={"status " + progress.status}>
                  {statusText[progress.status]}
                </span>
              </span>
              <span className="reward">
                +{progress.reward_snapshot}
                <small>Đồng tri thức</small>
              </span>
            </button>
          ))}
        </div>
      )}
      <PageControls page={page} />
    </>
  );
}
