"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { supabaseClient } from "@/lib/supabase/client";

type NavBarProps = {
  onMenuClick?: () => void;
};

export function NavBar({ onMenuClick }: NavBarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [loggedIn, setLoggedIn] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    const flag = typeof window !== "undefined" ? localStorage.getItem("kc_logged_in") === "true" : false;
    const email = typeof window !== "undefined" ? localStorage.getItem("kc_user_email") : null;
    const uid = typeof window !== "undefined" ? localStorage.getItem("kc_user_id") : null;
    setLoggedIn(flag);
    setUserEmail(email);
    setUserId(uid);
    function handleStorage(e: StorageEvent) {
      if (e.key === "kc_logged_in") {
        setLoggedIn(e.newValue === "true");
      }
      if (e.key === "kc_user_email") {
        setUserEmail(e.newValue);
      }
      if (e.key === "kc_user_id") {
        setUserId(e.newValue);
      }
    }
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []);

  async function handleLogout() {
    if (supabaseClient) {
      await supabaseClient.auth.signOut();
    }
    localStorage.removeItem("kc_logged_in");
    localStorage.removeItem("kc_user_email");
    localStorage.removeItem("kc_user_id");
    setLoggedIn(false);
    setUserEmail(null);
    setUserId(null);
    setMenuOpen(false);
    router.push("/");
  }

  return (
    <>
      <header className="fixed left-0 top-0 z-40 w-full border-b border-zinc-200 bg-white/90 backdrop-blur">
        <div className="flex h-16 w-full items-center justify-between px-3 lg:px-6">
          <div className="flex items-center gap-3">
            <button
              onClick={onMenuClick}
              className="rounded-lg p-2 text-zinc-700 hover:bg-zinc-100 lg:hidden"
              aria-label="打开导航"
            >
              ☰
            </button>
            <Link href="/" className="text-lg font-semibold text-zinc-900">
              Kiddo Cloud
            </Link>
          </div>
          <div className="hidden items-center gap-3 text-sm font-medium text-zinc-700 md:flex">
            {loggedIn ? (
              <div className="relative">
                <button
                  onClick={() => setMenuOpen((v) => !v)}
                  className="flex items-center gap-2 rounded-full border border-zinc-200 bg-white px-3 py-1 shadow-sm transition hover:bg-zinc-100"
                >
                  <span className="h-8 w-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 text-xs font-semibold text-white flex items-center justify-center">
                    U
                  </span>
                </button>
                {menuOpen && (
                  <div className="absolute right-0 mt-2 w-40 rounded-xl border border-zinc-200 bg-white py-2 shadow-lg">
                    <button
                      onClick={() => {
                        setShowProfile(true);
                        setMenuOpen(false);
                      }}
                      className="flex w-full items-center px-4 py-2 text-left text-sm text-zinc-700 hover:bg-zinc-100"
                    >
                      个人信息
                    </button>
                    <button
                      onClick={handleLogout}
                      className="flex w-full items-center px-4 py-2 text-left text-sm text-zinc-700 hover:bg-zinc-100"
                    >
                      退出登录
                    </button>
                  </div>
                )}
              </div>
            ) : pathname === "/login" ? (
              <Link href="/" className="rounded-lg px-3 py-2 transition-colors hover:bg-zinc-100">
                取消登录
              </Link>
            ) : (
              <Link href="/login" className="rounded-lg px-3 py-2 transition-colors hover:bg-zinc-100">
                登录
              </Link>
            )}
          </div>
        </div>
      </header>

      {showProfile && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
          onClick={() => setShowProfile(false)}
        >
          <div
            className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <div className="text-lg font-semibold text-zinc-900">个人信息</div>
              <button
                onClick={() => setShowProfile(false)}
                className="rounded-full bg-zinc-100 px-3 py-1 text-sm text-zinc-700 hover:bg-zinc-200"
              >
                关闭
              </button>
            </div>
            <div className="mt-4 space-y-2 text-sm text-zinc-700">
              <div>
                <span className="font-semibold text-zinc-800">用户 ID：</span>
                <span className="break-all text-zinc-700">{userId ?? "未登录"}</span>
              </div>
              <div>
                <span className="font-semibold text-zinc-800">邮箱：</span>
                <span className="break-all text-zinc-700">{userEmail ?? "未登录"}</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
