"use client";

import Link from "next/link";

type NavBarProps = {
  onMenuClick?: () => void;
};

const navItems = [
  { href: "/", label: "主页" },
  { href: "/login", label: "登录" },
  { href: "/upload", label: "上传照片" },
  { href: "/albums", label: "我的相册" },
];

export function NavBar({ onMenuClick }: NavBarProps) {
  return (
    <header className="border-b border-zinc-200 bg-white/90 backdrop-blur">
      <div className="flex w-full items-center justify-between px-3 py-4 lg:px-6">
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
        <nav className="hidden items-center gap-3 text-sm font-medium text-zinc-700 md:flex">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-lg px-3 py-2 transition-colors hover:bg-zinc-100"
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}
