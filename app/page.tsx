 "use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { LayoutShell } from "@/components/layout-shell";
import { supabaseClient } from "@/lib/supabase/client";

export default function Home() {
  const router = useRouter();
  const [isAuthed, setIsAuthed] = useState(false);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    async function detectLogin() {
      const localFlag = typeof window !== "undefined" && localStorage.getItem("kc_logged_in") === "true";
      if (!supabaseClient) {
        setIsAuthed(false);
        setChecked(true);
        return;
      }
      const { data } = await supabaseClient.auth.getSession();
      const authed = Boolean(data.session?.user) && localFlag;
      setIsAuthed(authed);
      setChecked(true);
    }
    detectLogin();
  }, []);

  async function handleStart() {
    const localFlag = typeof window !== "undefined" && localStorage.getItem("kc_logged_in") === "true";
    if (!supabaseClient) return router.push("/login");
    const { data } = await supabaseClient.auth.getSession();
    const authed = Boolean(data.session?.user) && localFlag;
    setIsAuthed(authed);
    router.push(authed ? "/memory-wall" : "/login");
  }

  return (
    <LayoutShell hideSidebar fullBleed>
      <div className="relative flex h-[calc(100vh-64px)] w-full items-center justify-center overflow-hidden bg-gradient-to-br from-[#f5f6fb] via-[#eef1f8] to-[#e8ecf5] px-6 text-slate-900">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute left-[-10%] top-[-10%] h-72 w-72 rounded-full bg-[#c5d4ff]/30 blur-3xl" />
          <div className="absolute right-[-6%] bottom-[-8%] h-80 w-80 rounded-full bg-[#dbe4ff]/35 blur-3xl" />
          <div className="absolute inset-16 rounded-3xl border border-white/30 bg-white/30 backdrop-blur-[8px]" />
        </div>

        <div className="relative z-10 flex max-w-4xl flex-col items-center gap-10 text-center">
          <span className="rounded-full bg-white/60 px-4 py-1 text-xs font-semibold uppercase tracking-[0.32em] text-slate-600 shadow-sm shadow-slate-900/5">
            Kiddo Cloud
          </span>

          <h1 className="text-[40px] font-semibold leading-snug text-slate-900 md:text-[48px]">
            把孩子的成长，
            <br />
            放在一个不会被打扰的地方。
          </h1>

          <div className="flex flex-col gap-2 text-base text-slate-600 md:text-lg">
            <span>· 照片高清不压缩</span>
            <span>· 老人也能轻松回忆</span>
            <span>· 打开，就是记忆本身</span>
          </div>

          <button
            onClick={handleStart}
            disabled={!checked}
            className="rounded-full bg-slate-900 px-8 py-3 text-base font-semibold text-white shadow-xl shadow-slate-900/10 transition-transform duration-200 hover:-translate-y-0.5 hover:bg-slate-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            开始使用
          </button>
        </div>
      </div>
    </LayoutShell>
  );
}
