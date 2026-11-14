"use client";
import { loadHistoryPage } from "../lib/api";
import type { Attempt, Review } from "../lib/game";
import { usePagedList } from "./data-hooks";
import { PageControls } from "./page-controls";
import { DateLabel, FileLinks } from "./ui";

export function ProgressHistory({
  progressId,
  openFile,
}: {
  progressId: string;
  openFile: (path: string, bucket: string) => void;
}) {
  const attempts = usePagedList(
    "attempts:" + progressId,
    (cursor, signal) =>
      loadHistoryPage<Attempt>("attempts", progressId, cursor, signal),
    ["tasks", "reviews"],
  );
  const reviews = usePagedList(
    "reviews:" + progressId,
    (cursor, signal) =>
      loadHistoryPage<Review>("reviews", progressId, cursor, signal),
    ["tasks", "reviews"],
  );
  return (
    <>
      {reviews.items.map((review) => (
        <div className="review-note" key={review.id}>
          <strong>
            {review.action === "bonus"
              ? "Thưởng thêm"
              : review.action === "approved"
                ? "Đã duyệt"
                : "Cần bổ sung"}{" "}
            · {review.amount} ĐTT
          </strong>
          <p>{review.note || "Không có nhận xét."}</p>
          <small>
            <DateLabel value={review.created_at} />
          </small>
        </div>
      ))}
      <PageControls page={reviews} />
      {attempts.items.map((attempt, index) => (
        <details key={attempt.id} open={index === 0}>
          <summary>
            {index === 0 ? "Bài nộp mới nhất" : "Bài nộp trước đó"} ·{" "}
            <DateLabel value={attempt.created_at} />
          </summary>
          <FileLinks
            files={attempt.files}
            onOpen={(path) => openFile(path, "garden-homework")}
          />
        </details>
      ))}
      <PageControls page={attempts} />
    </>
  );
}
