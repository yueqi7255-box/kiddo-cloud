"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
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

export const dynamic = "force-dynamic";

function getNextIndices(current: number, total: number, count: number) {
  const res: number[] = [];
  for (let i = 1; i <= count; i++) {
    res.push((current + i) % total);
  }
  return res;
}

function MemoryWall() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [memories, setMemories] = useState<Memory[]>([]);
  const [activeMemoryId, setActiveMemoryId] = useState<string>("");
  const [sceneIndex, setSceneIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isAuthed, setIsAuthed] = useState(false);
  const [controlsVisible, setControlsVisible] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const thumbBarRef = useRef<HTMLDivElement | null>(null);

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
      const client = supabaseClient;
      if (!client) return;
      const { data } = await client.auth.getSession();
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
      const client = supabaseClient;
      if (!client || !isAuthed) return;
      const { data: sessionData } = await client.auth.getSession();
      const user = sessionData.session?.user;
      if (!user) return;
      const windowDays = Math.floor(Math.random() * (30 - 7 + 1)) + 7;
      const end = new Date();
      const start = new Date(end.getTime() - windowDays * 24 * 60 * 60 * 1000);
      const { data, error } = await client
        .from("media")
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
        const bucket = client.storage.from("photos");
        const transformed =
          bucket.getPublicUrl(row.storage_path, row.media_type === "live" ? { transform: { format: "webp", quality: 90 } } : undefined)
            .data.publicUrl ?? bucket.getPublicUrl(row.storage_path).data.publicUrl;
        if (!transformed) return null;
        const liveUrl =
          row.media_type === "live" && row.live_video_path ? bucket.getPublicUrl(row.live_video_path).data.publicUrl : null;
        return {
          id: row.id,
          type: row.media_type === "video" ? "video" : row.media_type === "live" ? "live" : "photo",
          url: transformed,
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

  function showControls() {
    setControlsVisible(true);
  }

  function hideControls() {
    setControlsVisible(false);
  }

  function setMemory(id: string) {
    setActiveMemoryId(id);
    setSceneIndex(0);
    setIsPlaying(true);
    const url = new URL(window.location.href);
    url.searchParams.set("memory", id);
    router.replace(`${url.pathname}?${url.searchParams.toString()}`);
  }

  function nextMemory(delta: 1 | -1) {
    if (memories.length === 0) return;
    const currentIdx = memories.findIndex((m) => m.id === activeMemoryId);
    const idx = currentIdx >= 0 ? currentIdx : 0;
    const nextIdx = (idx + delta + memories.length) % memories.length;
    setMemory(memories[nextIdx].id);
  }

  useEffect(() => {
    if (!thumbBarRef.current) return;
    const activeThumb = thumbBarRef.current.querySelector<HTMLButtonElement>('[data-active="true"]');
    if (activeThumb && thumbBarRef.current) {
      const barRect = thumbBarRef.current.getBoundingClientRect();
      const thumbRect = activeThumb.getBoundingClientRect();
      const offset = thumbRect.left - barRect.left - barRect.width / 2 + thumbRect.width / 2;
      thumbBarRef.current.scrollBy({ left: offset, behavior: "smooth" });
    }
  }, [sceneIndex, activeMemoryId]);

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

  const fullscreenWrapperClass = isFullscreen
    ? "fixed inset-0 z-50 bg-white text-zinc-900"
    : "flex h-[calc(100vh-64px)] flex-row bg-gradient-to-b from-[#f7f8fb] via-white to-[#eef1f5] text-zinc-900 overflow-hidden";

  return (
    <LayoutShell fullBleed>
      <div className={fullscreenWrapperClass}>
        {!isFullscreen && (
          <aside className="flex w-[240px] flex-col gap-3 border-r border-zinc-200/70 bg-white/70 p-3 backdrop-blur-lg">
            <div className="flex flex-wrap gap-2">
              <button
                onClick={requestFullscreen}
                className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-xs font-semibold text-zinc-800 shadow-sm hover:bg-zinc-50"
              >
                全屏
              </button>
              <button
                onClick={handleShare}
                className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-xs font-semibold text-zinc-800 shadow-sm hover:bg-zinc-50"
              >
                分享
              </button>
            </div>
            <div className="text-xs uppercase tracking-[0.3em] text-zinc-500">Memory List</div>
            <div className="space-y-3 overflow-y-auto pr-1">
              {memories.map((memory) => {
                const cover = memory.items[0];
                const active = memory.id === activeMemoryId;
                const createdAt = cover?.createdAt ? new Date(cover.createdAt).toLocaleDateString() : "未知时间";
                return (
                  <button
                    key={memory.id}
                    onClick={() => setMemory(memory.id)}
                    className={`flex w-full flex-col overflow-hidden rounded-2xl border border-zinc-200 bg-white text-left text-xs text-zinc-800 shadow-sm transition hover:-translate-y-0.5 hover:shadow ${
                      active ? "ring-2 ring-blue-200" : ""
                    }`}
                  >
                    <div className="relative h-28 w-full overflow-hidden bg-zinc-100">
                      {cover ? <SupportScene item={cover} /> : <div className="h-full w-full bg-zinc-100" />}
                      <span className="absolute right-2 top-2 rounded-full bg-black/70 px-2 py-0.5 text-[10px] font-semibold text-white">
                        {memory.items.length} 片段
                      </span>
                    </div>
                    <div className="w-full space-y-1 px-3 py-2">
                      <div className="truncate text-sm font-semibold text-zinc-900">{memory.title}</div>
                      <div className="text-[11px] text-zinc-500">{createdAt}</div>
                    </div>
                  </button>
                );
              })}
            </div>
          </aside>
        )}

        <div
          ref={containerRef}
          className={`relative flex flex-1 flex-col gap-2 ${isFullscreen ? "min-h-screen" : "px-2 pb-4"}`}
          style={isFullscreen ? undefined : { minHeight: "calc(100vh - 32px)" }}
          onMouseEnter={showControls}
          onMouseLeave={hideControls}
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

            <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-white/15 via-white/5 to-white/20" />

            <div className="absolute left-4 top-4 flex items-center gap-2 rounded-full bg-white/80 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-zinc-700 shadow">
              {isPlaying ? "播放中" : "已暂停"} · {activeMemory?.title ?? ""}
            </div>
          </div>

          {scene && totalScenes > 0 && (
            <div
            className={`pointer-events-auto absolute inset-x-0 bottom-0 z-20 transition ${
              controlsVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
            }`}
              style={{ padding: "0 16px 48px", bottom: "12px" }}
            >
              <div className="mx-auto flex max-w-6xl items-center gap-3 rounded-3xl bg-white/90 px-4 py-3 shadow-2xl backdrop-blur-lg ring-1 ring-zinc-200">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => nextMemory(-1)}
                    className="h-11 w-11 rounded-full bg-zinc-200 text-lg font-bold text-zinc-800 shadow-sm transition hover:bg-zinc-300"
                    aria-label="上一记忆"
                  >
                    ⏮
                  </button>
                  <button
                    onClick={togglePlay}
                    className="h-11 w-11 rounded-full bg-zinc-900 text-lg font-semibold text-white shadow-md transition hover:bg-zinc-800"
                    aria-label={isPlaying ? "暂停" : "播放"}
                  >
                    {isPlaying ? "⏸" : "▶️"}
                  </button>
                  <button
                    onClick={() => nextMemory(1)}
                    className="h-11 w-11 rounded-full bg-zinc-200 text-lg font-bold text-zinc-800 shadow-sm transition hover:bg-zinc-300"
                    aria-label="下一记忆"
                  >
                    ⏭
                  </button>
                  <div className="rounded-full bg-zinc-100 px-3 py-1 text-xs font-semibold text-zinc-700 shadow-sm">
                    {sceneIndex + 1} / {totalScenes}
                  </div>
                </div>

                <div className="flex-1 overflow-x-auto" ref={thumbBarRef}>
                  <div className="ml-auto flex gap-2 pb-1 justify-end">
                    {activeMemory?.items.map((thumb, idx) => {
                      const active = idx === sceneIndex;
                      return (
                        <button
                          key={thumb.id}
                          data-active={active ? "true" : "false"}
                          onClick={() => {
                            setSceneIndex(idx);
                            setIsPlaying(true);
                          }}
                          className={`relative flex h-12 w-16 flex-shrink-0 overflow-hidden rounded-lg border shadow-sm transition ${
                            active ? "border-blue-300 ring-2 ring-blue-200" : "border-zinc-200 hover:border-blue-200"
                          }`}
                        >
                          {thumb.type === "video" ? (
                            <video muted playsInline className="h-full w-full object-cover">
                              <source src={thumb.url} />
                            </video>
                          ) : (
                            <img src={thumb.url} alt={thumb.id} className="h-full w-full object-cover" />
                          )}
                          <span className="absolute left-1 top-1 rounded-full bg-black/65 px-2 py-0.5 text-[10px] font-semibold text-white">
                            {idx + 1}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          )}

          {isFullscreen && (
            <button
              onClick={exitFullscreen}
              className="absolute right-6 top-4 rounded-full bg-black/60 px-3 py-1 text-xs font-semibold text-white/85 hover:bg-black/80"
            >
              退出全屏
            </button>
          )}
        </div>

      </div>
    </LayoutShell>
  );
}

export default function MemoryWallPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-black" />}>
      <MemoryWall />
    </Suspense>
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
