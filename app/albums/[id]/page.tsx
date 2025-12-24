"use client";

import { use, useState, useEffect, useMemo, useRef } from "react";
import { notFound } from "next/navigation";
import { LayoutShell } from "@/components/layout-shell";
import { listPhotos } from "@/lib/photos";

type MediaItem =
  | {
      id: string;
      type: "photo";
      title: string;
      url: string;
      takenAt?: string;
      isLive?: boolean;
    }
  | { id: string; type: "video"; title: string; url: string; takenAt?: string };

const mockVideos: MediaItem[] = [
  {
    id: "v1",
    type: "video",
    title: "Play time",
    url: "https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4",
    takenAt: "2023-09-01",
  },
];

function buildMedia(): MediaItem[] {
  const photos = listPhotos().map<MediaItem>((p) => ({
    id: p.id,
    type: "photo",
    title: p.title,
    url: p.url,
    takenAt: p.takenAt,
  }));
  return [...photos, ...mockVideos];
}

const filterOptions = [
  { value: "all", label: "全部" },
  { value: "photo", label: "只看照片" },
  { value: "video", label: "只看视频" },
];

export default function AlbumDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [filter, setFilter] = useState<"all" | "photo" | "video">("all");
  const [zoom, setZoom] = useState(1); // 1.0 = 默认缩放
  const [selectedIndex, setSelectedIndex] = useState<number | null>(0);
  const [previewIndex, setPreviewIndex] = useState<number | null>(null);
  const [previewZoom, setPreviewZoom] = useState(1);
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef<{ x: number; y: number } | null>(null);
  const scrollStartRef = useRef<{ x: number; y: number } | null>(null);
  const previewContainerRef = useRef<HTMLDivElement | null>(null);
  const previewImageRef = useRef<HTMLImageElement | null>(null);
  const [baseSize, setBaseSize] = useState<{ w: number; h: number }>({
    w: 0,
    h: 0,
  });

  if (id !== "default") {
    notFound();
  }

  const media = buildMedia().filter((item) =>
    filter === "all" ? true : item.type === filter
  );

  function clampZoom(next: number) {
    return Math.min(1.6, Math.max(0.7, next));
  }

  function handleZoom(delta: number) {
    setZoom((z) => clampZoom(z + delta));
  }

  function handleWheel(e: React.WheelEvent<HTMLDivElement>) {
    // 仅在触控板 pinch（ctrlKey 为 true）时缩放；普通滚动保持滚动，不触发缩放
    if (!e.ctrlKey && !e.metaKey) return;
    const step = 0.05;
    handleZoom(e.deltaY > 0 ? -step : step);
  }

  // 预览层缩放：仅对照片生效
  function clampPreviewZoom(next: number) {
    // 放宽范围，尽量不限制；仅做安全防护
    return Math.min(10, Math.max(0.1, next));
  }

  function handlePreviewZoom(delta: number) {
    setPreviewZoom((z) => clampPreviewZoom(z + delta));
  }

  function handlePreviewWheel(e: React.WheelEvent<HTMLDivElement>) {
    if (!e.ctrlKey && !e.metaKey) return;
    const step = 0.1;
    handlePreviewZoom(e.deltaY > 0 ? -step : step);
  }

  function handlePreviewPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    if (filtered[previewIndex ?? -1]?.type !== "photo") return;
    if (previewZoom <= 1) return;
    e.preventDefault();
    const container = previewContainerRef.current;
    if (!container) return;
    container.setPointerCapture(e.pointerId);
    setIsDragging(true);
    dragStartRef.current = { x: e.clientX, y: e.clientY };
    scrollStartRef.current = {
      x: container.scrollLeft,
      y: container.scrollTop,
    };
  }

  function handlePreviewPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (!isDragging) return;
    const container = previewContainerRef.current;
    if (!container || !dragStartRef.current || !scrollStartRef.current) return;
    const dx = e.clientX - dragStartRef.current.x;
    const dy = e.clientY - dragStartRef.current.y;
    container.scrollTo({
      left: scrollStartRef.current.x - dx,
      top: scrollStartRef.current.y - dy,
      behavior: "auto",
    });
  }

  function handlePreviewPointerUp(e: React.PointerEvent<HTMLDivElement>) {
    (e.currentTarget as HTMLDivElement).releasePointerCapture(e.pointerId);
    setIsDragging(false);
    dragStartRef.current = null;
    scrollStartRef.current = null;
  }

  const thumbBase = 220;
  const thumbWidth = Math.round(thumbBase * zoom);
  const gap = Math.round(thumbWidth * 0.05); // 行列间距为占位高度的 5%

  const filtered = useMemo(
    () =>
      buildMedia().filter((item) =>
        filter === "all" ? true : item.type === filter
      ),
    [filter]
  );
  const currentMedia = previewIndex !== null ? filtered[previewIndex] : null;

  // 保证选中索引合法
  useEffect(() => {
    if (filtered.length === 0) {
      setSelectedIndex(null);
      return;
    }
    setSelectedIndex((idx) => {
      if (idx === null || idx >= filtered.length) return 0;
      return idx;
    });
  }, [filtered.length]);

  function openPreview(idx: number) {
    setPreviewIndex(idx);
    setPreviewZoom(1);
    dragStartRef.current = null;
    scrollStartRef.current = null;
    setBaseSize({ w: 0, h: 0 });
  }

  function closePreview() {
    setPreviewIndex(null);
    setPreviewZoom(1);
    dragStartRef.current = null;
    scrollStartRef.current = null;
    setBaseSize({ w: 0, h: 0 });
  }

  function stepPreview(delta: number) {
    if (previewIndex === null) return;
    const next = (previewIndex + delta + filtered.length) % filtered.length;
    setPreviewIndex(next);
    setPreviewZoom(1);
    dragStartRef.current = null;
    scrollStartRef.current = null;
    setBaseSize({ w: 0, h: 0 });
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (previewIndex !== null) {
        if (e.key === "Escape") {
          closePreview();
        } else if (e.key === "ArrowRight") {
          stepPreview(1);
        } else if (e.key === "ArrowLeft") {
          stepPreview(-1);
        }
        return;
      }

      // 列表态下快捷键
      if (e.key === " " && selectedIndex !== null) {
        e.preventDefault();
        openPreview(selectedIndex);
      }
      if (e.key === "ArrowRight" && selectedIndex !== null) {
        e.preventDefault();
        setSelectedIndex((idx) =>
          idx === null ? 0 : Math.min(filtered.length - 1, idx + 1)
        );
      }
      if (e.key === "ArrowLeft" && selectedIndex !== null) {
        e.preventDefault();
        setSelectedIndex((idx) => (idx === null ? 0 : Math.max(0, idx - 1)));
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [previewIndex, filtered.length, selectedIndex]);

  useEffect(() => {
    if (!previewImageRef.current || !previewContainerRef.current) return;
    if (previewZoom !== 1) return;
    const imgEl = previewImageRef.current;
    // 等待图片渲染完成，读取当前适配后的尺寸作为基准
    const rect = imgEl.getBoundingClientRect();
    if (rect.width && rect.height) {
      setBaseSize({ w: rect.width, h: rect.height });
    }
  }, [previewZoom, previewIndex, currentMedia]);

  return (
    <LayoutShell>
      <div className="flex flex-col gap-8">
        <header className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-zinc-500">
              默认相册
            </p>
            <h1 className="text-3xl font-semibold">家庭照片与视频</h1>
            <p className="text-sm text-zinc-600">
              上传内容自动归档到默认相册。右侧可筛选照片或视频，默认展示全部。
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-zinc-700">筛选：</label>
              <div className="flex rounded-lg border border-zinc-200 bg-white p-1 shadow-sm">
                {filterOptions.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setFilter(opt.value as typeof filter)}
                    className={`rounded-md px-3 py-1 text-sm transition ${
                      filter === opt.value
                        ? "bg-zinc-900 text-white"
                        : "text-zinc-700 hover:bg-zinc-100"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex items-center gap-2 rounded-lg border border-zinc-200 bg-white px-2 py-1 shadow-sm">
              <span className="text-xs text-zinc-600">缩放</span>
              <button
                onClick={() => handleZoom(-0.1)}
                className="rounded-md px-2 py-1 text-sm font-semibold text-zinc-700 hover:bg-zinc-100"
                aria-label="缩小"
              >
                −
              </button>
              <div className="min-w-[48px] text-center text-sm font-semibold text-zinc-800">
                {(zoom * 100).toFixed(0)}%
              </div>
              <button
                onClick={() => handleZoom(0.1)}
                className="rounded-md px-2 py-1 text-sm font-semibold text-zinc-700 hover:bg-zinc-100"
                aria-label="放大"
              >
                +
              </button>
            </div>
          </div>
        </header>

        <section
          className="grid"
          style={{
            gridTemplateColumns: `repeat(auto-fill, minmax(${thumbWidth}px, 1fr))`,
            gap: `${gap}px`,
          }}
          onWheel={handleWheel}
        >
          {filtered.map((item, idx) =>
            item.type === "photo" ? (
              <figure
                key={item.id}
                className={`group overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm ${
                  selectedIndex === idx ? "ring-2 ring-blue-500" : ""
                }`}
                onClick={() => setSelectedIndex(idx)}
                onDoubleClick={() => openPreview(idx)}
              >
                <div className="relative w-full">
                  <img
                    src={item.url}
                    alt={item.title}
                    className="w-full aspect-[4/3] object-cover"
                  />
                  {item.isLive && (
                    <span className="absolute left-2 top-2 rounded-full bg-black/70 px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-white">
                      Live
                    </span>
                  )}
                </div>
                <figcaption className="px-4 py-3 text-sm">
                  <p className="font-semibold text-zinc-900">{item.title}</p>
                  <p className="text-xs text-zinc-500">{item.takenAt ?? "未知日期"}</p>
                </figcaption>
              </figure>
            ) : (
              <figure
                key={item.id}
                className={`group overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm ${
                  selectedIndex === idx ? "ring-2 ring-blue-500" : ""
                }`}
                onClick={() => setSelectedIndex(idx)}
                onDoubleClick={() => openPreview(idx)}
              >
                <div className="relative w-full">
                  <video controls className="w-full aspect-[4/3] object-cover">
                    <source src={item.url} />
                    您的浏览器不支持视频播放。
                  </video>
                </div>
                <figcaption className="px-4 py-3 text-sm">
                  <p className="font-semibold text-zinc-900">{item.title}</p>
                  <p className="text-xs text-zinc-500">{item.takenAt ?? "未知日期"}</p>
                </figcaption>
              </figure>
            )
          )}
        </section>

        {previewIndex !== null && (
          <div
            className="fixed inset-0 z-50 flex h-screen w-screen items-center justify-center bg-black/80 px-2 sm:px-4"
            onClick={closePreview}
            onWheel={handlePreviewWheel}
          >
            <div
              className="relative flex h-full w-full items-center justify-center"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                onClick={() => stepPreview(-1)}
                className="absolute left-0 top-1/2 z-10 -translate-y-1/2 rounded-full bg-white/80 px-3 py-2 text-lg font-bold text-zinc-800 shadow hover:bg-white"
                aria-label="上一张"
              >
                ←
              </button>
              <button
                onClick={() => stepPreview(1)}
                className="absolute right-0 top-1/2 z-10 -translate-y-1/2 rounded-full bg-white/80 px-3 py-2 text-lg font-bold text-zinc-800 shadow hover:bg-white"
                aria-label="下一张"
              >
                →
              </button>
              <button
                onClick={closePreview}
                className="absolute right-2 top-2 z-10 rounded-full bg-white/80 px-3 py-1 text-sm font-semibold text-zinc-800 shadow hover:bg-white"
                aria-label="关闭"
              >
                关闭
              </button>
              <div className="flex h-full w-full items-center justify-center">
                {filtered[previewIndex]?.type === "photo" ? (
                  <div
                    ref={previewContainerRef}
                    className="relative flex h-full w-full items-center justify-center overflow-auto rounded-2xl bg-black"
                    style={{ touchAction: "none" }}
                    onPointerDown={handlePreviewPointerDown}
                    onPointerMove={handlePreviewPointerMove}
                    onPointerUp={handlePreviewPointerUp}
                    onPointerCancel={handlePreviewPointerUp}
                  >
                    <img
                      ref={previewImageRef}
                      src={filtered[previewIndex]?.url}
                      alt={filtered[previewIndex]?.title}
                      className="block select-none object-contain"
                      draggable={false}
                      onDragStart={(e) => e.preventDefault()}
                      style={{
                        width:
                          previewZoom === 1
                            ? "auto"
                            : baseSize.w
                              ? `${baseSize.w * previewZoom}px`
                              : `${96 * previewZoom}vw`,
                        height:
                          previewZoom === 1
                            ? "auto"
                            : baseSize.h
                              ? `${baseSize.h * previewZoom}px`
                              : "auto",
                        maxWidth: previewZoom === 1 ? "96vw" : "none",
                        maxHeight: previewZoom === 1 ? "92vh" : "none",
                        cursor:
                          previewZoom > 1 ? (isDragging ? "grabbing" : "grab") : "default",
                        willChange: "transform",
                      }}
                    />
                    {filtered[previewIndex]?.isLive && (
                      <span className="absolute left-3 top-3 rounded-full bg-black/70 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-white">
                        Live
                      </span>
                    )}
                  </div>
                ) : (
                  <div className="relative h-full w-full overflow-hidden rounded-2xl bg-black">
                    <video
                      controls
                      autoPlay
                      className="h-full w-full object-contain"
                    >
                      <source src={filtered[previewIndex]?.url} />
                      您的浏览器不支持视频播放。
                    </video>
                  </div>
                )}
              </div>

              {filtered[previewIndex]?.type === "photo" && (
                <div className="absolute bottom-4 right-4 flex items-center gap-2 rounded-lg bg-white/85 px-3 py-2 text-sm font-semibold text-zinc-800 shadow">
                  <span className="text-xs text-zinc-600">缩放</span>
                  <button
                    onClick={() => handlePreviewZoom(-0.1)}
                    className="rounded-md px-2 py-1 hover:bg-zinc-100"
                    aria-label="预览缩小"
                  >
                    −
                  </button>
                  <div className="min-w-[48px] text-center">{(previewZoom * 100).toFixed(0)}%</div>
                  <button
                    onClick={() => handlePreviewZoom(0.1)}
                    className="rounded-md px-2 py-1 hover:bg-zinc-100"
                    aria-label="预览放大"
                  >
                    +
                  </button>
                  <button
                    onClick={() => setPreviewZoom(1)}
                    className="rounded-md px-2 py-1 text-xs text-blue-600 hover:bg-blue-50"
                    aria-label="预览重置"
                  >
                    重置
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </LayoutShell>
  );
}
