"use client";

import { useState } from "react";
import { NavBar } from "@/components/nav";
import { Sidebar } from "@/components/sidebar";

type LayoutShellProps = {
  children: React.ReactNode;
};

export function LayoutShell({ children }: LayoutShellProps) {
  const [open, setOpen] = useState(false);

  return (
    <div className="min-h-screen bg-[#f7f8fb] text-zinc-900">
      <NavBar onMenuClick={() => setOpen(true)} />
      <div className="flex w-full gap-4 px-3 py-6 lg:px-6 lg:py-8">
        <Sidebar />
        <main className="flex-1">
          <div className="rounded-2xl bg-white px-4 py-6 shadow-sm lg:px-8 lg:py-10">
            {children}
          </div>
        </main>
      </div>
      {open && (
        <>
          <div className="fixed inset-0 z-40 bg-black/30 lg:hidden" onClick={() => setOpen(false)} />
          <Sidebar variant="mobile" onClose={() => setOpen(false)} />
        </>
      )}
    </div>
  );
}
