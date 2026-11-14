"use client";

export function PageControls({
  page,
}: {
  page: {
    loading: boolean;
    error: string;
    next: unknown;
    more: () => Promise<void>;
    refresh: () => Promise<void>;
  };
}) {
  return (
    <>
      {page.loading && <p role="status">Đang tải...</p>}
      {page.error && (
        <p role="alert">
          {page.error}{" "}
          <button
            className="link-button"
            onClick={() => void page.refresh().catch(() => {})}
          >
            Thử lại
          </button>
        </p>
      )}
      {page.next && (
        <button
          className="secondary"
          disabled={page.loading}
          onClick={() => void page.more()}
        >
          Xem thêm
        </button>
      )}
    </>
  );
}
