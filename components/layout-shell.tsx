"use client";

import { useState } from "react";
import { NavBar } from "@/components/nav";
import { Sidebar } from "@/components/sidebar";

type LayoutShellProps = {
  children: React.ReactNode;
  fullBleed?: boolean;
  hideSidebar?: boolean;
};

const HEADER_HEIGHT = 64;
const SIDEBAR_WIDTH = 220;

export function LayoutShell({ children, fullBleed = false, hideSidebar = false }: LayoutShellProps) {
  const [open, setOpen] = useState(false);

  return (
    <div className="min-h-screen bg-[#f7f8fb] text-zinc-900">
      <NavBar onMenuClick={hideSidebar ? undefined : () => setOpen(true)} />
      <div
        className="flex w-full"
        style={{
          paddingTop: HEADER_HEIGHT,
          paddingLeft: hideSidebar ? 0 : SIDEBAR_WIDTH + 16,
        }}
      >
        {!hideSidebar && <Sidebar />}
        <main
          className="flex-1"
          style={{
            minHeight: `calc(100vh - ${HEADER_HEIGHT}px)`,
            overflowY: "auto",
              padding: fullBleed ? "0" : "24px 24px 32px",
            }}
          >
            {fullBleed ? (
              children
            ) : (
              <div className="min-h-full rounded-2xl bg-white px-4 py-6 shadow-sm lg:px-8 lg:py-10">
                {children}
              </div>
            )}
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
