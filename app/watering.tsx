"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { rpc } from "../lib/api";
import { timeLeft, type Plot } from "../lib/game";
import { useGame } from "./game-session";
import { MathText } from "./math-text";
import { wateringDeadline } from "../lib/watering-clock";

type Question = { id: string; topic: string; prompt: string; type: "choice" | "short"; options: string[] | null; expires_at: string; server_now: string; localDeadline: number };
type Result = Partial<Question> & { correct?: boolean; expired?: boolean; finished?: boolean; solved?: number };

export function Watering({ plot, now }: { plot: Plot; now: number }) {
  const { refresh } = useGame();
  const [question, setQuestion] = useState<Question | null>(null);
  const [answer, setAnswer] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const pending = useRef(false);
  const due = Date.parse(plot.next_water_at) <= now;
  const secondsLeft = question ? Math.max(0, Math.ceil((question.localDeadline - now) / 1000)) : 0;

  useEffect(() => {
    if (!question || secondsLeft > 0 || pending.current) return;
    pending.current = true;
    setBusy(true);
    void rpc("garden_watering_finish", { p_plot: plot.id }).then(async () => {
      setQuestion(null);
      setMessage("Đã hết thời gian. Lượt tưới kết thúc.");
      await refresh();
    }).catch((error: unknown) => {
      setMessage(error instanceof Error ? error.message : "Chưa kết thúc được lượt tưới. Hãy mở lại lượt tưới.");
    }).finally(() => { pending.current = false; setBusy(false); });
  }, [question, secondsLeft, plot.id, refresh]);

  async function start() {
    setBusy(true);
    setMessage("");
    try {
      const next = await rpc<Question | { expired: true }>("garden_watering_start", { p_plot: plot.id });
      if ("expired" in next) { setMessage("Đã hết thời gian. Lượt tưới kết thúc."); await refresh(); }
      else {
        const localDeadline = wateringDeadline(next.expires_at, next.server_now, Date.now());
        if (localDeadline === null) throw new Error("Chưa đồng bộ được thời gian tưới. Vui lòng cập nhật máy chủ và thử lại.");
        setAnswer(""); setQuestion({ ...next, localDeadline });
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Chưa bắt đầu được lượt tưới.");
    } finally { setBusy(false); }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!question || !answer.trim() || answer.trim().length > 500 || pending.current) return;
    pending.current = true;
    setBusy(true);
    try {
      const result = await rpc<Result>("garden_watering_submit", { p_plot: plot.id, p_question: question.id, p_answer: answer });
      if (result.expired || result.finished) {
        setQuestion(null);
        setMessage(result.expired ? "Đã hết thời gian. Lượt tưới kết thúc." : result.correct === false ? "Chưa đúng. Lượt tưới kết thúc." : "Không còn câu hỏi. Lượt tưới đã kết thúc.");
        await refresh();
      } else {
        const localDeadline = wateringDeadline(result.expires_at ?? "", result.server_now ?? "", Date.now());
        if (!result.id || !result.prompt || !result.type || localDeadline === null) throw new Error("Chưa đồng bộ được câu hỏi tiếp theo. Hãy mở lại lượt tưới.");
        setQuestion({ ...result, id: result.id, prompt: result.prompt, type: result.type, topic: result.topic ?? "", options: result.options ?? null, expires_at: result.expires_at!, server_now: result.server_now!, localDeadline });
        setAnswer("");
        setMessage(result.correct ? "Chính xác! +15 giây và cây lớn nhanh hơn tối đa 1 phút." : "Chưa đúng. Tiếp tục với câu tiếp theo.");
        if (result.correct) await refresh();
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Chưa gửi được đáp án. Hãy thử lại.");
    } finally { pending.current = false; setBusy(false); }
  }

  async function finish() {
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    try {
      await rpc("garden_watering_finish", { p_plot: plot.id });
      setQuestion(null);
      setMessage("Đã kết thúc lượt tưới.");
      await refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Chưa kết thúc được lượt tưới.");
    } finally { pending.current = false; setBusy(false); }
  }

  return <section className="watering" aria-label="Tưới nước">
    <h3>Tưới nước</h3>
    {!due ? <p>{timeLeft(plot.next_water_at, now)} nữa cần tưới</p> : !question ? <>
      <p>Bạn có 1 phút để giải nhiều câu. Mỗi câu chỉ được trả lời một lần; trả lời đúng cộng 15 giây và giảm tối đa 1 phút chờ. Trả lời sai sẽ kết thúc lượt.</p>
      <button type="button" className="secondary" disabled={busy} onClick={start}>Giải toán để tưới</button>
    </> : <>
      <p>Thời gian còn lại: <strong>{secondsLeft} giây</strong> · Mỗi câu một lần trả lời</p>
      <form onSubmit={submit}>
        {question.topic && <p>{question.topic}</p>}
        <p className="watering-prompt" id="watering-question"><MathText text={question.prompt} /></p>
        {question.type === "choice" ? <fieldset className="watering-options" aria-labelledby="watering-question">
          {question.options?.map((option, index) => <label key={index}><input type="radio" name="watering-choice" value={"ABCD"[index]} checked={answer === "ABCD"[index]} onChange={(event) => setAnswer(event.target.value)} required /> <span>{"ABCD"[index]}. <MathText text={option} /></span></label>)}
        </fieldset> : <><label htmlFor="watering-answer">Đáp án của bạn</label><input id="watering-answer" type="text" maxLength={500} value={answer} onChange={(event) => setAnswer(event.target.value)} required autoFocus /></>}
        <div className="watering-answer"><button className="primary" disabled={busy || secondsLeft === 0} type="submit">Trả lời</button></div>
      </form>
      <button type="button" className="secondary" disabled={busy} onClick={finish}>Tưới xong</button>
    </>}
    {message && <p role="status">{message}</p>}
  </section>;
}
