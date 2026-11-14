"use client";

import { useEffect, useState } from "react";
import { rpc } from "../lib/api";
import { MathText } from "./math-text";

type BankQuestion = { id: string; topic: string; prompt: string; kind: "choice" | "short"; options: string[] | null; answer: string; active: boolean };
type ImportQuestion = { topic?: string; question: string; type: "choice" | "short"; options?: string[]; answer: string };
const example = [
  { topic: "Nguyên hàm", question: "Cho $f(x)=x-\\frac{1}{\\sqrt{x}}$. Một nguyên hàm của $f(x)$ trên $(0;+\\infty)$ là:", type: "choice", options: ["$\\dfrac{x^2}{2}+\\sqrt{x}$", "$\\dfrac{x^2}{2}-\\sqrt{x}$", "$\\dfrac{x^2}{2}+2\\sqrt{x}$", "$\\dfrac{x^2}{2}-2\\sqrt{x}$"], answer: "D" },
  { topic: "Tích phân", question: "Tính $\\int_0^1 2x\\,dx$.", type: "short", answer: "1" },
];

export function QuestionBank() {
  const [questions, setQuestions] = useState<BankQuestion[]>([]);
  const [items, setItems] = useState<ImportQuestion[] | null>(null);
  const [request, setRequest] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  async function load() { setQuestions(await rpc<BankQuestion[]>("garden_list_questions")); }
  useEffect(() => { let live = true; rpc<BankQuestion[]>("garden_list_questions").then((data) => { if (live) setQuestions(data); }).catch((e) => { if (live) setError(e.message); }); return () => { live = false; }; }, []);
  async function readFile(file: File | undefined) {
    setItems(null); setError(""); setMessage("");
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".json") || file.size > 1024 * 1024) { setError("Chọn tệp .json không quá 1 MB."); return; }
    try {
      const data: unknown = JSON.parse((await file.text()).replace(/^\uFEFF/, ""));
      if (!Array.isArray(data) || data.length < 1 || data.length > 500 || data.some((item) => !item || typeof item !== "object" || typeof item.question !== "string" || typeof item.answer !== "string" || !["choice", "short"].includes(item.type))) throw new Error("Tệp phải là mảng từ 1 đến 500 câu, mỗi câu có question, type và answer dạng văn bản.");
      setItems(data as ImportQuestion[]); setRequest(crypto.randomUUID());
    } catch (e) { setError(e instanceof SyntaxError ? "Tệp JSON không đúng định dạng." : e instanceof Error ? e.message : "Không đọc được tệp."); }
  }
  async function upload() {
    if (!items) return;
    setBusy(true); setError(""); setMessage("");
    try {
      const count = await rpc<number>("garden_import_questions", { p_items: items, p_request: request });
      setItems(null); setMessage(`Đã nhập ${count} câu hỏi.`);
      try { await load(); } catch { setError("Đã nhập câu hỏi nhưng chưa tải được danh sách. Hãy mở lại mục này."); }
    } catch (e) { setError(e instanceof Error ? e.message : "Chưa nhập được câu hỏi."); }
    finally { setBusy(false); }
  }
  async function toggle(question: BankQuestion) {
    setBusy(true); setError(""); setMessage("");
    try { await rpc("garden_set_question_active", { p_question: question.id, p_enabled: !question.active }); await load(); }
    catch (e) { setError(e instanceof Error ? e.message : "Chưa cập nhật được câu hỏi."); }
    finally { setBusy(false); }
  }
  return <div className="question-bank">
    <h3>Ngân hàng câu hỏi tưới cây</h3>
    <p>Tải tệp JSON chứa tối đa 500 câu mỗi lần. Câu được thêm vào ngân hàng hiện có; người chơi sẽ gặp lại câu hỏi khi giải tiếp.</p>
    <p>Trắc nghiệm dùng <code>type: "choice"</code>, bốn <code>options</code> và <code>answer</code> là A, B, C hoặc D. Câu trả lời ngắn dùng <code>type: "short"</code> và đáp án dạng văn bản. Đáp án ngắn được so khớp sau khi bỏ khoảng trắng đầu cuối và không phân biệt chữ hoa, chữ thường.</p>
    <p>Đặt công thức LaTeX trong <code>$...$</code> hoặc <code>$$...$$</code>. Trong tệp JSON, viết hai dấu gạch chéo ngược cho mỗi dấu gạch chéo của lệnh LaTeX, như trong mẫu dưới đây.</p>
    <details><summary>Xem JSON mẫu</summary><pre>{JSON.stringify(example, null, 2)}</pre></details>
    <label htmlFor="question-file">Chọn tệp JSON</label>
    <input id="question-file" type="file" accept=".json,application/json" disabled={busy} onChange={(e) => void readFile(e.target.files?.[0])} />
    {items && <div><p>Đã đọc {items.length} câu. Kiểm tra nội dung và đáp án trước khi nhập.</p><ol>{items.slice(0, 3).map((item, index) => <li key={index}><MathText text={item.question} /> ({item.type === "choice" ? "Trắc nghiệm" : "Trả lời ngắn"}){Array.isArray(item.options) && <ol type="A">{item.options.map((option, i) => <li key={i}><MathText text={String(option)} /></li>)}</ol>}<p>Đáp án: {item.answer}</p></li>)}</ol><button className="primary" type="button" disabled={busy} onClick={upload}>Nhập {items.length} câu hỏi</button></div>}
    {error && <p className="inline-error" role="alert">{error}</p>}{message && <p role="status">{message}</p>}
    <h3>Câu hỏi đã nhập</h3>
    <p>Hiển thị tối đa 500 câu mới nhất. Ngừng sử dụng không làm thay đổi câu hỏi người chơi đang giải.</p>
    {!questions.length ? <p>Chưa có câu hỏi nào.</p> : <div className="task-list">{questions.map((q) => <article className="admin-task" key={q.id}><div><strong className="bank-prompt"><MathText text={q.prompt} /></strong><small>{q.topic || "Chưa phân loại"} · {q.kind === "choice" ? "Trắc nghiệm" : "Trả lời ngắn"} · {q.active ? "Đang sử dụng" : "Đã ngừng"}</small>{q.options && <ol type="A">{q.options.map((o, i) => <li key={i}><MathText text={o} /></li>)}</ol>}<p>Đáp án: {q.answer}</p></div><button className="secondary" type="button" disabled={busy} onClick={() => void toggle(q)}>{q.active ? "Ngừng sử dụng" : "Sử dụng lại"}</button></article>)}</div>}
  </div>;
}
