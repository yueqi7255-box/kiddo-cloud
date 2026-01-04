"use client";

import { useMemo, useState } from "react";
import { MediaPreviewer, type MediaItem } from "@/components/media-previewer";

type MediaGridProps = {
  items: MediaItem[];
  showTypeBadge?: boolean;
  emptyText?: string;
};

export function MediaGrid({ items, showTypeBadge = true, emptyText = "暂无内容" }: MediaGridProps) {
  const [zoom, setZoom] = useState(1);
  const [previewIndex, setPreviewIndex] = useState<number | null>(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);

  const filtered = useMemo(() => items, [items]);
  const thumbBase = 220;
  const thumbWidth = Math.round(thumbBase * zoom);
  const gap = Math.round(thumbWidth * 0.05);

  function handleZoom(delta: number) {
    setZoom((z) => clampZoom(z + delta));
  }

  function clampZoom(next: number) {
    return Math.min(1.6, Math.max(0.7, next));
  }

  function openPreview(idx: number) {
    setPreviewIndex(idx);
    setIsPreviewOpen(true);
  }

  function closePreview() {
    setIsPreviewOpen(false);
    setPreviewIndex(null);
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
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

      {filtered.length === 0 && <p className="text-sm text-zinc-600">{emptyText}</p>}

      <section
        className="grid"
        style={{
          gridTemplateColumns: `repeat(auto-fill, minmax(${thumbWidth}px, 1fr))`,
          gap: `${gap}px`,
        }}
      >
        {filtered.map((item, idx) => (
          <figure
            key={item.id}
            className="group overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm"
            onDoubleClick={() => openPreview(idx)}
          >
            <div className="relative w-full">
              {item.type === "photo" ? (
                <img src={item.url} alt={item.title ?? item.id} className="w-full aspect-[4/3] object-cover" />
              ) : (
                <video muted playsInline className="w-full aspect-[4/3] object-cover">
                  <source src={item.url} />
                </video>
              )}
              {showTypeBadge && item.media_type === "live" && (
                <span className="absolute left-2 bottom-2 rounded-full bg-black/75 px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-white">
                  Live
                </span>
              )}
              {showTypeBadge && item.type === "video" && (
                <span className="absolute left-2 bottom-2 rounded-full bg-black/75 px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-white">
                  视频
                </span>
              )}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  openPreview(idx);
                }}
                className="absolute right-2 bottom-2 hidden rounded-full bg-black/70 px-2 py-1 text-xs font-semibold text-white shadow-sm transition group-hover:flex"
                aria-label="预览"
              >
                预览
              </button>
            </div>
          </figure>
        ))}
      </section>

      <MediaPreviewer
        items={filtered}
        open={isPreviewOpen && previewIndex !== null}
        index={previewIndex}
        onClose={closePreview}
        onIndexChange={setPreviewIndex}
      />
    </div>
  );
}
