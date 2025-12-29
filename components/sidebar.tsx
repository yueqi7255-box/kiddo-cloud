"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type NavItem = {
  label: string;
  href: string;
  icon?: string;
};

const navItems: NavItem[] = [
  { label: "Memory Wall", href: "/memory-wall", icon: "🧩" },
  { label: "上传照片", href: "/upload", icon: "⬆️" },
  { label: "我的相册", href: "/albums", icon: "🖼️" },
];

type SidebarProps = {
  variant?: "desktop" | "mobile";
  onClose?: () => void;
  headerOffset?: number;
  width?: number;
};

export function Sidebar({ variant = "desktop", onClose }: SidebarProps) {
  const pathname = usePathname();
  const isMobile = variant === "mobile";

  const width = 220;
  const offset = 72; // align below header
  const baseClasses =
    "flex flex-col justify-between rounded-2xl bg-[#f2f5fb] px-2 py-3 text-sm text-zinc-800 shadow-sm";
  const desktopVisibility = "hidden lg:flex";
  const mobileOverlay =
    "fixed inset-y-4 left-3 z-50 flex border border-zinc-200";

  return (
    <aside
      className={`${baseClasses} ${isMobile ? mobileOverlay : desktopVisibility}`}
      style={
        isMobile
          ? { width }
          : {
              position: "fixed",
              left: 12,
              top: offset,
              width,
              height: `calc(100vh - ${offset + 12}px)`,
            }
      }
    >
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between px-3">
          <div className="text-sm font-semibold text-zinc-900">Kiddo Cloud</div>
          {isMobile && (
            <button
              onClick={onClose}
              className="rounded-lg px-2 py-1 text-xs font-semibold text-zinc-600 hover:bg-white"
            >
              关闭
            </button>
          )}
        </div>
        <nav className="flex flex-col gap-1">
          {navItems.map((item) => {
            const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={isMobile ? onClose : undefined}
                className={`flex items-center gap-3 rounded-xl px-3 py-2 transition ${
                  active ? "bg-white text-zinc-900 shadow-sm" : "hover:bg-white/60"
                }`}
              >
                <span className="text-lg">{item.icon ?? "•"}</span>
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>
      </div>

      <div className="mt-auto flex flex-col gap-3 rounded-xl border border-zinc-200 bg-white px-3 py-3 text-xs text-zinc-600 shadow-sm">
        <p className="text-sm font-semibold text-zinc-800">存储空间</p>
        <div className="h-2 overflow-hidden rounded-full bg-zinc-200">
          <div className="h-full w-[6%] bg-blue-500" />
        </div>
        <p>已使用 0.9 GB / 共 15 GB</p>
        <button className="rounded-lg border border-zinc-200 px-3 py-2 text-xs font-semibold text-blue-600 transition hover:border-blue-200 hover:bg-blue-50">
          解锁存储空间折扣
        </button>
      </div>
    </aside>
  );
}
