"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { LayoutShell } from "@/components/layout-shell";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [status, setStatus] = useState<"idle" | "success">("idle");

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setStatus("success");
    setTimeout(() => router.push("/upload"), 300);
  }

  return (
    <LayoutShell>
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-2">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-zinc-500">
            登录（模拟）
          </p>
          <h1 className="text-3xl font-semibold">进入 Kiddo Cloud</h1>
          <p className="text-sm text-zinc-600">
            这里不做真实认证，未来可替换 Supabase Auth。现在输入任意邮箱和验证码点击登录即可。
          </p>
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
              验证码（模拟）
              <input
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-zinc-500 focus:outline-none"
                placeholder="123456"
              />
              <p className="mt-1 text-xs text-zinc-500">
                未来可用邮箱/短信/魔法链接；现在随便填即可。
              </p>
            </label>
            <button
              type="submit"
              className="mt-2 rounded-lg bg-zinc-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-zinc-800"
            >
              登录
            </button>
            {status === "success" && (
              <div className="rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700">
                登录成功（模拟），即将跳转到上传页
              </div>
            )}
          </div>
        </form>
      </div>
    </LayoutShell>
  );
}
