"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { LayoutShell } from "@/components/layout-shell";
import { supabaseClient } from "@/lib/supabase/client";

export type MediaItem = {
  id: string;
  type: "photo" | "video" | "live";
  url: string;
  poster?: string;
  livePlaybackUrl?: string;
  createdAt?: string;
};

type Memory = {
  id: string;
  title: string;
  items: MediaItem[];
};

function getNextIndices(current: number, total: number, count: number) {
  const res: number[] = [];
  for (let i = 1; i <= count; i++) {
    res.push((current + i) % total);
  }
  return res;
}

export default function MemoryWall() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [memories, setMemories] = useState<Memory[]>([]);
  const [activeMemoryId, setActiveMemoryId] = useState<string>("");
  const [sceneIndex, setSceneIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isAuthed, setIsAuthed] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const activeMemory = memories.find((m) => m.id === activeMemoryId) ?? memories[0];
  const totalScenes = activeMemory?.items.length ?? 0;
  const scene = totalScenes ? activeMemory.items[sceneIndex % totalScenes] : null;

  // 初始化: 根据 URL 参数设定 memory 与全屏
  useEffect(() => {
    const memId = searchParams.get("memory");
    const fullscreenParam = searchParams.get("fullscreen");
    if (memId && memories.some((m) => m.id === memId)) {
      setActiveMemoryId(memId);
      setSceneIndex(0);
    }
    if (fullscreenParam === "1") {
      requestFullscreen();
    }
  }, [searchParams, memories]);

  useEffect(() => {
    async function ensureLogin() {
      if (!supabaseClient) return;
      const { data } = await supabaseClient.auth.getSession();
      if (!data.session?.user) {
        router.replace("/login");
        return;
      }
      setIsAuthed(true);
    }
    ensureLogin();
  }, [router]);

  useEffect(() => {
    async function loadMemories() {
      if (!supabaseClient || !isAuthed) return;
      const { data: sessionData } = await supabaseClient.auth.getSession();
      const user = sessionData.session?.user;
      if (!user) return;
      const windowDays = Math.floor(Math.random() * (30 - 7 + 1)) + 7;
      const end = new Date();
      const start = new Date(end.getTime() - windowDays * 24 * 60 * 60 * 1000);
      const { data, error } = await supabaseClient
        .from("photos")
        .select("id, storage_path, live_video_path, media_type, original_name, created_at")
        .eq("user_id", user.id)
        .gte("created_at", start.toISOString())
        .order("created_at", { ascending: false })
        .limit(80);
      if (error) {
        console.log("获取 Memory Wall 数据失败", error);
        return;
      }

      const toMediaItem = (row: any): MediaItem | null => {
        const { data: urlData } = supabaseClient.storage.from("photos").getPublicUrl(row.storage_path);
        if (!urlData?.publicUrl) return null;
        const liveUrl =
          row.media_type === "live" && row.live_video_path
            ? supabaseClient.storage.from("photos").getPublicUrl(row.live_video_path).data.publicUrl
            : null;
        return {
          id: row.id,
          type: row.media_type === "video" ? "video" : row.media_type === "live" ? "live" : "photo",
          url: urlData.publicUrl,
          livePlaybackUrl: liveUrl ?? undefined,
          createdAt: row.created_at,
        };
      };

      const itemsRaw = (data ?? []).map(toMediaItem).filter(Boolean) as MediaItem[];

      // 去掉时间过近的重复（2分钟内）
      const deduped: MediaItem[] = [];
      let lastTs = 0;
      for (const item of itemsRaw) {
        const ts = item.createdAt ? new Date(item.createdAt).getTime() : 0;
        if (Math.abs(ts - lastTs) < 2 * 60 * 1000) continue;
        lastTs = ts;
        deduped.push(item);
      }

      const targetCount = Math.min(40, Math.max(20, deduped.length));
      const priority = deduped.filter((m) => m.type !== "photo");
      const photosOnly = deduped.filter((m) => m.type === "photo");
      const reordered: MediaItem[] = [];
      let pIdx = 0;
      let vIdx = 0;
      while (reordered.length < targetCount && (pIdx < photosOnly.length || vIdx < priority.length)) {
        if (vIdx < priority.length) {
          reordered.push(priority[vIdx++]);
        }
        if (reordered.length >= targetCount) break;
        if (pIdx < photosOnly.length) {
          const last = reordered[reordered.length - 1];
          if (last && last.type === "photo" && vIdx < priority.length) {
            reordered.push(priority[vIdx++]);
          } else {
            reordered.push(photosOnly[pIdx++]);
          }
        }
      }
      if (reordered.length === 0 && itemsRaw.length > 0) {
        reordered.push(itemsRaw[0]);
      }

      const mem: Memory = {
        id: "memory-auto",
        title: "回忆精选",
        items: reordered,
      };
      setMemories([mem]);
      setActiveMemoryId("memory-auto");
      setSceneIndex(0);
    }
    loadMemories();
  }, [isAuthed]);

  // 全屏状态监听
  useEffect(() => {
    function handleFullScreenChange() {
      setIsFullscreen(Boolean(document.fullscreenElement));
    }
    document.addEventListener("fullscreenchange", handleFullScreenChange);
    return () => document.removeEventListener("fullscreenchange", handleFullScreenChange);
  }, []);

  // 自动播放
  useEffect(() => {
    if (!isPlaying || !totalScenes) return;
    const delay = 6000 + Math.random() * 4000; // 6-10 秒
    const timer = setTimeout(() => {
      setSceneIndex((idx) => (idx + 1) % totalScenes);
    }, delay);
    return () => clearTimeout(timer);
  }, [sceneIndex, isPlaying, totalScenes]);

  // 切换 memory 时重置
  useEffect(() => {
    setSceneIndex(0);
    setIsPlaying(true);
  }, [activeMemoryId]);

  function togglePlay() {
    setIsPlaying((v) => !v);
  }

  function requestFullscreen() {
    if (document.fullscreenElement) return;
    const target = containerRef.current ?? document.documentElement;
    target.requestFullscreen?.();
  }

  function exitFullscreen() {
    if (document.fullscreenElement) {
      document.exitFullscreen();
    }
  }

  async function handleShare() {
    const url = new URL(window.location.href);
    url.searchParams.set("memory", activeMemoryId);
    url.searchParams.set("fullscreen", "1");
    try {
      await navigator.clipboard.writeText(url.toString());
      alert("链接已复制，可直接用平板打开");
    } catch {
      prompt("复制此链接", url.toString());
    }
  }

  function setMemory(id: string) {
    setActiveMemoryId(id);
    setSceneIndex(0);
    setIsPlaying(true);
    const url = new URL(window.location.href);
    url.searchParams.set("memory", id);
    router.replace(`${url.pathname}?${url.searchParams.toString()}`);
  }

  const fullscreenWrapperClass = isFullscreen
    ? "fixed inset-0 z-50 bg-black text-white"
    : "flex min-h-[calc(100vh-64px)] flex-col gap-4 bg-gradient-to-b from-[#0b0f1a] via-[#0f1524] to-[#0b0f1a] px-0 pb-6 text-white";

  return (
    <LayoutShell fullBleed>
      <div className={fullscreenWrapperClass}>
        <header
          className={`${
            isFullscreen ? "absolute left-0 right-0 top-0" : "sticky top-0"
          } z-10 flex flex-wrap items-center justify-between gap-3 bg-black/20 px-4 py-2 backdrop-blur`}
        >
          <div className="flex items-center gap-3">
            <div className="text-xs uppercase tracking-[0.3em] text-white/60">Memory Wall</div>
            <div className="flex items-center gap-2 rounded-xl bg-white/5 px-3 py-2 text-sm font-semibold">
              <span className="text-white/70">当前记忆</span>
              <button
                className="rounded-lg bg-white/10 px-3 py-1 text-white hover:bg-white/20"
                onClick={() => {
                  const next = memories[(memories.findIndex((m) => m.id === activeMemoryId) + 1) % memories.length];
                  setMemory(next.id);
                }}
              >
                {activeMemory?.title ?? "未命名"}
              </button>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={requestFullscreen}
              className="rounded-lg border border-white/15 bg-white/10 px-3 py-2 text-sm font-semibold hover:bg-white/20"
            >
              全屏
            </button>
            <button
              onClick={handleShare}
              className="rounded-lg border border-white/15 bg-white/10 px-3 py-2 text-sm font-semibold hover:bg-white/20"
            >
              分享
            </button>
          </div>
        </header>

        <div
          ref={containerRef}
          className={`relative flex flex-1 flex-col gap-2 ${isFullscreen ? "min-h-screen" : "px-2"}`}
          style={isFullscreen ? undefined : { minHeight: "calc(100vh - 110px)" }}
        >
          <div
            className={`relative flex w-full cursor-pointer select-none flex-col justify-center overflow-hidden ${
              isFullscreen ? "min-h-screen" : "h-full"
            }`}
            onClick={togglePlay}
            style={isFullscreen ? undefined : { minHeight: "calc(100vh - 140px)" }}
          >
            {scene && (
              <>
                <div className="absolute inset-0">
                  <FadeScene key={scene.id + sceneIndex} item={scene} />
                </div>
              </>
            )}

            <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/30 via-black/10 to-black/30" />

            <div className="absolute left-4 top-4 flex items-center gap-2 rounded-full bg-black/40 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-white/80">
              {isPlaying ? "播放中" : "已暂停"} · {activeMemory?.title ?? ""}
            </div>
          </div>

          {isFullscreen && (
            <button
              onClick={exitFullscreen}
              className="absolute right-6 top-4 rounded-full bg-black/60 px-3 py-1 text-xs font-semibold text-white/85 hover:bg-black/80"
            >
              退出全屏
            </button>
          )}
        </div>

        {!isFullscreen && (
          <section className="flex flex-col gap-2 px-2 pb-3">
            <div className="text-sm uppercase tracking-[0.3em] text-white/50">记忆列表</div>
            <div
              className="grid gap-3"
              style={{
                gridTemplateColumns: "repeat(auto-fill, minmax(240px, 260px))",
                justifyContent: "flex-start",
              }}
            >
              {memories.map((memory) => {
                const cover = memory.items[0];
                const active = memory.id === activeMemoryId;
                return (
                  <button
                    key={memory.id}
                    onClick={() => setMemory(memory.id)}
                    className={`flex h-full flex-col items-start gap-2 rounded-lg bg-white/5 p-2 text-left transition hover:bg-white/10 ${
                      active ? "ring-2 ring-blue-400/70" : ""
                    }`}
                  >
                    <div className="relative w-full overflow-hidden rounded-lg bg-black/40" style={{ aspectRatio: "16 / 9" }}>
                      {cover ? <SupportScene item={cover} /> : <div className="h-full w-full" />}
                      <div className="absolute inset-0 bg-gradient-to-b from-black/20 to-black/50" />
                    </div>
                    <div className="flex w-full items-center justify-between">
                      <div>
                        <div className="text-sm font-semibold text-white">{memory.title}</div>
                        <div className="text-xs text-white/60">{memory.items.length} 片段</div>
                      </div>
                      <span className="text-lg">{active ? "●" : "○"}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </section>
        )}
      </div>
    </LayoutShell>
  );
}

function FadeScene({ item }: { item: MediaItem }) {
  const [loaded, setLoaded] = useState(false);
  return (
    <div
      className="flex h-full w-full items-center justify-center transition"
      style={{
        opacity: loaded ? 1 : 0,
        transform: loaded ? "translateY(0px)" : "translateY(10px)",
        transition: "opacity 0.8s ease, transform 0.8s ease",
      }}
    >
      {item.type === "video" ? (
        <video
          src={item.url}
          poster={item.poster}
          autoPlay
          muted
          loop
          playsInline
          className="max-h-[90vh] w-full object-contain"
          onCanPlay={() => setLoaded(true)}
        />
      ) : (
        <img
          src={item.type === "live" && item.livePlaybackUrl ? item.livePlaybackUrl : item.url}
          alt="memory scene"
          className="max-h-[90vh] w-full object-contain"
          onLoad={() => setLoaded(true)}
        />
      )}
    </div>
  );
}

function SupportScene({ item }: { item: MediaItem }) {
  if (item.type === "video") {
    return (
      <video
        src={item.url}
        poster={item.poster}
        muted
        loop
        autoPlay
        playsInline
        className="h-full w-full object-cover brightness-95"
      />
    );
  }
  return <img src={item.url} alt={item.id} className="h-full w-full object-cover brightness-95" loading="lazy" />;
}
