import Link from "next/link";
import { LayoutShell } from "@/components/layout-shell";

export default function Home() {
  return (
    <LayoutShell hideSidebar>
      <div className="flex flex-col gap-12">
        <header className="flex flex-col gap-3">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-zinc-500">
            Kiddo Cloud · 家庭私有云原型
          </p>
          <h1 className="text-4xl font-semibold leading-tight">
              存好孩子的照片和成长记忆，简单、可长期使用。
          </h1>
          <p className="text-lg text-zinc-600">
            当前是本地原型：前端 + 轻量 API（内存数据），未来可平滑接入 Supabase
            认证 / 数据库 / 存储。
          </p>
          <div className="mt-4 flex flex-wrap gap-3 text-sm font-medium">
            <Link
              href="/login"
              className="rounded-full bg-zinc-900 px-5 py-2 text-white transition hover:bg-zinc-800"
            >
              去登录（模拟）
            </Link>
          </div>
        </header>

        <section className="grid gap-4">
          <h3 className="text-xl font-semibold">本地自检</h3>
          <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-5 shadow-sm">
            <ol className="list-decimal space-y-2 pl-5 text-sm text-zinc-700">
              <li>终端执行 <code>pnpm dev</code>，打开 http://localhost:3000</li>
              <li>
                访问 <code>/api/health</code> 应返回 status: ok；访问{" "}
                <code>/api/photos</code> 返回 mock 照片列表
              </li>
              <li>未来接入 Supabase 时，只需在 <code>lib/supabase/</code> 补全客户端</li>
            </ol>
          </div>
        </section>
      </div>
    </LayoutShell>
  );
}
