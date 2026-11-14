"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { validateFiles } from "../lib/api";
import { HOMEWORK_PHOTO_LIMIT } from "../lib/file-limits";
import styles from "./homework-photos.module.css";

export function HomeworkPhotos({ files, onChange, disabled = false }: {
  files: File[];
  onChange: (files: File[]) => void;
  disabled?: boolean;
}) {
  const [cameraOpen, setCameraOpen] = useState(false);
  const [error, setError] = useState("");
  const filePicker = useRef<HTMLInputElement>(null);
  const cameraTrigger = useRef<HTMLButtonElement>(null);
  const photoStatus = useRef<HTMLParagraphElement>(null);
  const wasCameraOpen = useRef(false);
  const full = files.length >= HOMEWORK_PHOTO_LIMIT;

  useEffect(() => {
    if (wasCameraOpen.current && !cameraOpen) {
      (full ? photoStatus.current : cameraTrigger.current)?.focus();
    }
    wasCameraOpen.current = cameraOpen;
  }, [cameraOpen, full]);

  function addFiles(incoming: File[]) {
    if (disabled || !incoming.length) return;
    const next = [...files, ...incoming];
    try {
      validateFiles(next, "garden-homework");
      onChange(next);
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Chưa thêm được ảnh. Hãy thử lại.");
    }
  }

  return (
    <section className={styles.photos} aria-labelledby="homework-photos-title">
      <h3 id="homework-photos-title">Ảnh bài làm</h3>
      <p>Chụp từng trang, kiểm tra ảnh rồi nộp tất cả cùng một lần. Tối đa {HOMEWORK_PHOTO_LIMIT} ảnh, 10 MB/ảnh.</p>
      {!disabled && cameraOpen ? (
        <HomeworkCamera
          files={files}
          onCapture={addFiles}
          onRemove={(index) => { onChange(files.filter((_, i) => i !== index)); setError(""); }}
          error={error}
          onClose={() => setCameraOpen(false)}
          onError={(message) => { setError(message); setCameraOpen(false); }}
        />
      ) : (
        <button ref={cameraTrigger} type="button" className="secondary" disabled={disabled || full}
          onClick={() => { setError(""); setCameraOpen(true); }}>
          {files.length ? "Chụp thêm ảnh" : "Mở camera chụp bài"}
        </button>
      )}
      <div className={styles.actions}>
        <button type="button" className="secondary" disabled={disabled || full || cameraOpen}
          onClick={() => filePicker.current?.click()}>Chọn ảnh có sẵn</button>
      </div>
      <input ref={filePicker} type="file" multiple
        accept="image/jpeg,image/png,image/webp,image/heic,image/heif" hidden
        aria-label="Chọn ảnh bài làm có sẵn" disabled={disabled || full || cameraOpen}
        onChange={(e) => { addFiles(Array.from(e.target.files || [])); e.target.value = ""; }} />
      <p ref={photoStatus} role="status" tabIndex={-1}>{files.length ? `Đã chọn ${files.length}/${HOMEWORK_PHOTO_LIMIT} ảnh.${full ? " Đã đủ ảnh, bạn có thể nộp bài." : " Có thể chụp hoặc thêm ảnh tiếp."}` : "Chưa có ảnh bài làm."}</p>
      {files.length > 0 && (
        <ol className={styles.previews}>
          {files.map((file, index) => (
            <li key={index}>
              <PhotoPreview file={file} index={index} />
              <button type="button" className="secondary" disabled={disabled || cameraOpen}
                aria-label={`Xóa ảnh ${index + 1}`}
                onClick={() => { onChange(files.filter((_, i) => i !== index)); setError(""); }}>
                Xóa ảnh {index + 1}
              </button>
            </li>
          ))}
        </ol>
      )}
      {error && <p className="inline-error" role="alert">{error}</p>}
    </section>
  );
}

function PhotoPreview({ file, index }: { file: File; index: number }) {
  const [url, setUrl] = useState("");
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    const next = URL.createObjectURL(file);
    setUrl(next);
    setFailed(false);
    return () => URL.revokeObjectURL(next);
  }, [file]);
  return (
    <>
      {url && !failed ? <img src={url} alt={`Ảnh bài làm ${index + 1}`} onError={() => setFailed(true)} />
        : <p>Ảnh {index + 1}: {file.name}{failed && " (không xem trước được định dạng này)"}</p>}
    </>
  );
}

function HomeworkCamera({ files, onCapture, onRemove, error, onClose, onError }: {
  files: File[];
  onCapture: (files: File[]) => void;
  onRemove: (index: number) => void;
  error: string;
  onClose: () => void;
  onError: (message: string) => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const photoStrip = useRef<HTMLOListElement>(null);
  const video = useRef<HTMLVideoElement>(null);
  const active = useRef(false);
  const capturing = useRef(false);
  const onErrorRef = useRef(onError);
  onErrorRef.current = onError;
  const [ready, setReady] = useState(false);
  const [saving, setSaving] = useState(false);
  const full = files.length >= HOMEWORK_PHOTO_LIMIT;

  useEffect(() => {
    if (photoStrip.current) photoStrip.current.scrollLeft = photoStrip.current.scrollWidth;
  }, [files.length]);

  useLayoutEffect(() => {
    const element = dialog.current;
    element?.showModal();
    return () => { if (element?.open) element.close(); };
  }, []);

  useEffect(() => {
    let cancelled = false;
    let stream: MediaStream | undefined;
    active.current = true;
    async function start() {
      try {
        if (!navigator.mediaDevices?.getUserMedia) {
          throw new Error("unsupported");
        }
        stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: { facingMode: { ideal: "environment" }, width: { ideal: 1920 }, height: { ideal: 1440 } },
        });
        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        if (video.current) {
          video.current.srcObject = stream;
          await video.current.play();
        }
      } catch (e) {
        if (cancelled) return;
        const denied = e instanceof Error && ["NotAllowedError", "SecurityError"].includes(e.name);
        onErrorRef.current(denied
          ? "Chưa được phép dùng camera. Hãy cấp quyền camera trong trình duyệt rồi thử lại hoặc chọn ảnh có sẵn."
          : "Không mở được camera. Hãy kiểm tra camera của thiết bị rồi thử lại hoặc chọn ảnh có sẵn.");
      }
    }
    void start();
    return () => {
      cancelled = true;
      active.current = false;
      stream?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  function capture() {
    const source = video.current;
    if (!source || !source.videoWidth || !source.videoHeight || capturing.current || full) return;
    capturing.current = true;
    setSaving(true);
    try {
      const canvas = document.createElement("canvas");
      canvas.width = source.videoWidth;
      canvas.height = source.videoHeight;
      const context = canvas.getContext("2d");
      if (!context) throw new Error("canvas");
      context.drawImage(source, 0, 0);
      canvas.toBlob((blob) => {
        if (!active.current) return;
        capturing.current = false;
        setSaving(false);
        if (!blob) {
          onError("Chưa chụp được ảnh. Hãy mở lại camera và thử lại.");
          return;
        }
        onCapture([new File([blob], `bai-lam-${crypto.randomUUID()}.jpg`, { type: "image/jpeg" })]);
      }, "image/jpeg", 0.9);
    } catch {
      capturing.current = false;
      setSaving(false);
      onError("Chưa chụp được ảnh. Hãy mở lại camera và thử lại.");
    }
  }

  return (
    <dialog ref={dialog} className={styles.camera} aria-label="Chụp ảnh bài làm toàn màn hình"
      onCancel={(event) => { event.preventDefault(); event.stopPropagation(); onClose(); }}>
      <header className={styles.cameraHeader}>
        <strong>Chụp ảnh bài làm</strong>
        <button type="button" className={styles.cameraButton} autoFocus onClick={onClose}>Đóng camera</button>
      </header>
      <div className={styles.viewfinder}>
        <video ref={video} autoPlay muted playsInline aria-label="Camera chụp bài làm"
          onCanPlay={() => setReady(true)}
          onError={() => onError("Không xem được camera. Hãy mở lại camera hoặc chọn ảnh có sẵn.")} />
        {!ready && <p className={styles.cameraLoading} role="status">Đang mở camera. Hãy cho phép sử dụng camera nếu trình duyệt hỏi.</p>}
      </div>
      <footer className={styles.cameraControls}>
        {files.length > 0 && (
          <ol ref={photoStrip} className={styles.cameraPhotos} aria-label="Ảnh bài làm đã chụp hoặc chọn">
            {files.map((file, index) => (
              <li key={index}>
                <PhotoPreview file={file} index={index} />
                <button type="button" className={styles.cameraButton} disabled={saving}
                  aria-label={`Xóa ảnh ${index + 1}`} onClick={() => onRemove(index)}>Xóa ảnh {index + 1}</button>
              </li>
            ))}
          </ol>
        )}
        <p role="status">Đã chọn {files.length}/{HOMEWORK_PHOTO_LIMIT} ảnh. {full ? "Đã đủ ảnh. Đóng camera để nộp bài hoặc xóa ảnh để chụp lại." : "Ảnh vừa chụp sẽ hiện ở đây. Đóng camera khi đã chụp xong."}</p>
        {error && <p className="inline-error" role="alert">{error}</p>}
        <button type="button" className={styles.cameraButton} onClick={capture} disabled={!ready || saving || full}>
          {saving ? "Đang lưu ảnh..." : full ? "Đã đủ ảnh" : "Chụp ảnh"}
        </button>
      </footer>
    </dialog>
  );
}
