"use client";
import { useState } from "react";
import { supabase } from "../lib/supabase";
import { Dialog } from "./ui";
import { useGame } from "./game-session";

export function AuthDialog({
  initialSignup,
  onClose,
}: {
  initialSignup: boolean;
  onClose: () => void;
}) {
  const [signup, setSignup] = useState(initialSignup),
    [email, setEmail] = useState(""),
    [password, setPassword] = useState("");
  const { run, busy, error, setError, setNotice } = useGame();
  async function authenticate(e: React.FormEvent) {
    e.preventDefault();
    await run(
      async () => {
        const response = signup
          ? await supabase!.auth.signUp({ email: email.trim(), password })
          : await supabase!.auth.signInWithPassword({
              email: email.trim(),
              password,
            });
        if (response.error)
          throw new Error(
            response.error.message === "Invalid login credentials"
              ? "Email hoặc mật khẩu chưa đúng."
              : response.error.message,
          );
        if (!response.data.session)
          throw new Error(
            "Chưa đăng nhập được. Vui lòng kiểm tra cấu hình tài khoản.",
          );
        onClose();
        setPassword("");
        setNotice(
          signup
            ? "Tạo tài khoản thành công. Cùng bắt đầu nhé!"
            : "Chào mừng bạn trở lại!",
        );
      },
      undefined,
      [],
    );
  }

  return (
    <Dialog
      title={signup ? "Tạo tài khoản" : "Đăng nhập"}
      onClose={() => onClose()}
    >
      <p>Tạo một khu vườn của riêng bạn, bắt đầu từ bài tập hôm nay.</p>
      <form onSubmit={authenticate}>
        <label htmlFor="email">Email</label>
        <input
          id="email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <label htmlFor="password">Mật khẩu</label>
        <input
          id="password"
          type="password"
          autoComplete={signup ? "new-password" : "current-password"}
          minLength={6}
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        {error && (
          <p className="inline-error" role="alert">
            {error}
          </p>
        )}
        <button className="primary" disabled={busy}>
          {busy
            ? "Đang xử lý..."
            : signup
              ? "Tạo tài khoản & vào vườn"
              : "Đăng nhập"}
        </button>
      </form>
      <button
        className="link-button"
        onClick={() => {
          setSignup(!signup);
          setError("");
        }}
      >
        {signup ? "Đã có tài khoản? Đăng nhập" : "Chưa có tài khoản? Đăng ký"}
      </button>
    </Dialog>
  );
}
