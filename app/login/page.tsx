"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { LayoutShell } from "@/components/layout-shell";
import { supabaseClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState<"idle" | "success" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setStatus("idle");
    setError(null);
    if (!supabaseClient) {
      setError("Supabase 客户端未初始化，请检查环境变量。");
      setStatus("error");
      return;
    }
    supabaseClient.auth
      .signInWithPassword({ email, password })
      .then(({ data, error: authError }) => {
        if (authError || !data.user) {
          setError(authError?.message || "登录失败，请检查邮箱和密码。");
          setStatus("error");
          return;
        }
        localStorage.setItem("kc_logged_in", "true");
        localStorage.setItem("kc_user_email", data.user.email ?? "");
        localStorage.setItem("kc_user_id", data.user.id);
        setStatus("success");
        setTimeout(() => router.push("/memory-wall"), 300);
      })
      .catch((err) => {
        setError(err.message || "登录失败，请稍后重试。");
        setStatus("error");
      });
  }

  return (
    <LayoutShell hideSidebar>
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-2">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-zinc-500">
            登录
          </p>
          <h1 className="text-3xl font-semibold">进入 Kiddo Cloud</h1>
          <p className="text-sm text-zinc-600">使用邮箱 + 密码登录（Supabase Auth）。</p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="rounded-2xl border border-zinc-200 bg-zinc-50 p-6 shadow-sm"
        >
          <div className="flex flex-col gap-4">
            <label className="text-sm font-medium text-zinc-800">
              邮箱
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-zinc-500 focus:outline-none"
                placeholder="you@example.com"
              />
            </label>
            <label className="text-sm font-medium text-zinc-800">
              密码
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-zinc-500 focus:outline-none"
                placeholder="请输入密码"
              />
            </label>
            <button
              type="submit"
              className="mt-2 rounded-lg bg-zinc-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-zinc-800"
            >
              登录
            </button>
            {status === "success" && (
              <div className="rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700">
                登录成功，即将跳转到 Memory Wall
              </div>
            )}
            {status === "error" && error && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {error}
              </div>
            )}
          </div>
        </form>
      </div>
    </LayoutShell>
  );
}
