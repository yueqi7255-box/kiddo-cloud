"use client";

import { type RefObject, useEffect, useMemo, useRef, useState } from "react";

export type MediaItem =
  | {
      id: string;
      type: "photo";
      title: string;
      url: string;
      takenAt?: string;
      isLive?: boolean;
      livePlaybackUrl?: string;
      format?: string;
      sizeMB?: number;
      location?: string;
      device?: string;
      storagePath?: string;
    }
  | {
      id: string;
      type: "video";
      title: string;
      url: string;
      takenAt?: string;
      format?: string;
      sizeMB?: number;
      location?: string;
      device?: string;
      storagePath?: string;
    };

type MediaPreviewerProps = {
  items: MediaItem[];
  open: boolean;
  index: number | null;
  onClose: () => void;
  onIndexChange: (next: number) => void;
};

export function MediaPreviewer({
  items,
  open,
  index,
  onClose,
  onIndexChange,
}: MediaPreviewerProps) {
  const [previewZoom, setPreviewZoom] = useState(1);
  const [isDragging, setIsDragging] = useState(false);
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const dragStartRef = useRef<{ x: number; y: number } | null>(null);
  const panStartRef = useRef<{ x: number; y: number } | null>(null);
  const previewContainerRef = useRef<HTMLDivElement | null>(null);
  const previewImageRef = useRef<HTMLImageElement | null>(null);
  const sizeCacheRef = useRef<Record<string, { w: number; h: number }>>({});
  const [baseSize, setBaseSize] = useState<{ w: number; h: number }>({
    w: 0,
    h: 0,
  });
  const [previewLivePlaying, setPreviewLivePlaying] = useState(false);
  const [slideDir, setSlideDir] = useState<0 | 1 | -1>(0);
  const [animatingTo, setAnimatingTo] = useState<number | null>(null);
  const [trackTransition, setTrackTransition] = useState(false);
  const [videoHover, setVideoHover] = useState(false);
  const [viewport, setViewport] = useState<{ w: number; h: number }>({ w: 0, h: 0 });
  const slideDuration = 820;
  const slideEasing = "cubic-bezier(0.22, 1, 0.36, 1)";

  const currentMedia = useMemo(
    () => (index !== null && index >= 0 ? items[index] ?? null : null),
    [items, index]
  );

  useEffect(() => {
    function updateViewport() {
      setViewport({ w: window.innerWidth, h: window.innerHeight });
    }
    updateViewport();
    window.addEventListener("resize", updateViewport);
    return () => window.removeEventListener("resize", updateViewport);
  }, []);

  useEffect(() => {
    const original = document.body.style.overflow;
    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = original || "";
    }
    return () => {
      document.body.style.overflow = original || "";
    };
  }, [open]);

  function clampNumber(value: number, min: number, max: number) {
    return Math.min(max, Math.max(min, value));
  }

  function updateBaseSize(next: { w: number; h: number }, cacheKey?: string) {
    if (!next.w || !next.h) return;
    setBaseSize(next);
    if (cacheKey) {
      sizeCacheRef.current[cacheKey] = next;
    }
  }

  function clampPreviewZoom(next: number) {
    return Math.min(10, Math.max(0.1, next));
  }

  function handlePreviewZoom(delta: number) {
    setPreviewZoom((z) => clampPreviewZoom(z + delta));
  }

  function handlePreviewWheel(e: React.WheelEvent<HTMLDivElement>) {
    if (!e.ctrlKey && !e.metaKey) return;
    e.preventDefault();
    e.stopPropagation();
    const step = 0.1;
    handlePreviewZoom(e.deltaY > 0 ? -step : step);
  }

  function handlePreviewPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    if (items[index ?? -1]?.type !== "photo") return;
    if (previewZoom <= 1) return;
    e.preventDefault();
    const container = previewContainerRef.current;
    if (!container) return;
    container.setPointerCapture(e.pointerId);
    setIsDragging(true);
    dragStartRef.current = { x: e.clientX, y: e.clientY };
    panStartRef.current = { x: pan.x, y: pan.y };
  }

  function handlePreviewPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (!isDragging) return;
    if (!dragStartRef.current || !panStartRef.current) return;
    const dx = e.clientX - dragStartRef.current.x;
    const dy = e.clientY - dragStartRef.current.y;
    const next = {
      x: panStartRef.current.x + dx,
      y: panStartRef.current.y + dy,
    };
    setPan(next);
  }

  function handlePreviewPointerUp(e: React.PointerEvent<HTMLDivElement>) {
    (e.currentTarget as HTMLDivElement).releasePointerCapture(e.pointerId);
    setIsDragging(false);
    dragStartRef.current = null;
    panStartRef.current = null;
  }

  function handleImageLoad(el: HTMLImageElement, cacheKey?: string) {
    if (el.naturalWidth && el.naturalHeight) {
      updateBaseSize({ w: el.naturalWidth, h: el.naturalHeight }, cacheKey);
    }
  }

  function handleVideoMetadata(el: HTMLVideoElement, cacheKey?: string) {
    if (el.videoWidth && el.videoHeight) {
      updateBaseSize({ w: el.videoWidth, h: el.videoHeight }, cacheKey);
    }
  }

  useEffect(() => {
    if (!open || index === null) return;
    const item = items[index];
    if (!item) return;
    if (item.type === "photo") {
      let cancelled = false;
      const img = new Image();
      img.src = item.url;
      if (img.complete && img.naturalWidth && img.naturalHeight) {
        updateBaseSize({ w: img.naturalWidth, h: img.naturalHeight }, item.id);
        return;
      }
      img.onload = () => {
        if (cancelled) return;
        updateBaseSize({ w: img.naturalWidth, h: img.naturalHeight }, item.id);
      };
      return () => {
        cancelled = true;
        img.onload = null;
      };
    }
    if (item.type === "video") {
      updateBaseSize({ w: 16, h: 9 }, item.id);
    }
  }, [open, index, items]);

  useEffect(() => {
    if (!open || baseSize.w || baseSize.h) return;
    if (!previewImageRef.current) return;
    const el = previewImageRef.current;
    if (el.naturalWidth && el.naturalHeight) {
      updateBaseSize({ w: el.naturalWidth, h: el.naturalHeight });
      return;
    }
    const rect = el.getBoundingClientRect();
    if (rect.width && rect.height) {
      updateBaseSize({ w: rect.width, h: rect.height });
    }
  }, [baseSize.w, baseSize.h, open, index, currentMedia]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (!open || index === null) return;
      if (e.key === "Escape") {
        onClose();
      } else if (e.key === "ArrowRight") {
        stepPreview(1);
      } else if (e.key === "ArrowLeft") {
        stepPreview(-1);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, index, items.length]);

  useEffect(() => {
    if (!open || index === null) return;
    const target = items[index];
    const cached = target ? sizeCacheRef.current[target.id] : null;
    setPreviewZoom(1);
    dragStartRef.current = null;
    panStartRef.current = null;
    setBaseSize(cached ?? { w: 0, h: 0 });
    setPreviewLivePlaying(false);
    setSlideDir(0);
    setAnimatingTo(null);
    setTrackTransition(false);
    setPan({ x: 0, y: 0 });
  }, [open, index, items]);

  useEffect(() => {
    if (animatingTo === null) return;
    const start = requestAnimationFrame(() => setTrackTransition(true));
    const targetIndex = animatingTo;
    const timer = setTimeout(() => {
      onIndexChange(targetIndex);
      setAnimatingTo(null);
      setTrackTransition(false);
      setSlideDir(0);
    }, slideDuration);
    return () => {
      cancelAnimationFrame(start);
      clearTimeout(timer);
    };
  }, [animatingTo, slideDuration, onIndexChange]);

  const maxVisualHeight = viewport.h ? viewport.h * 0.78 : 0;
  const aspect = baseSize.h ? baseSize.w / baseSize.h : 1;
  const naturalWidth = maxVisualHeight ? maxVisualHeight * aspect : 0;
  const baseTargetWidth =
    naturalWidth || (viewport.w ? clampNumber(viewport.w * 0.6, 320, viewport.w * 0.8) : 320);
  const clampedBaseWidth = viewport.w
    ? Math.min(Math.max(320, baseTargetWidth), viewport.w * 0.8)
    : baseTargetWidth;
  const zoomedWidth = clampedBaseWidth * previewZoom;
  const maxVisualWidth = viewport.w ? viewport.w * 0.92 : zoomedWidth;
  const mainWidth = Math.min(Math.max(320, clampedBaseWidth), maxVisualWidth);
  const galleryGap = viewport.w ? clampNumber(viewport.w * 0.05, 24, 48) : 32;
  const galleryPadding = viewport.w ? clampNumber(viewport.w * 0.1, 24, 56) : 32;
  const sideHeight = "clamp(60vh, 78vh, 820px)";
  const availableForSides = viewport.w
    ? viewport.w - mainWidth - galleryPadding * 2 - galleryGap * 2
    : 0;
  const sideWidthPx = availableForSides > 0 ? Math.max(110, availableForSides / 2) : 110;

  useEffect(() => {
    if (!open || previewZoom <= 1) {
      setPan({ x: 0, y: 0 });
      return;
    }
    const maxOffsetX = ((baseSize.w * previewZoom - mainWidth) / 2) || 0;
    const maxOffsetY = ((baseSize.h * previewZoom - maxVisualHeight) / 2) || 0;
    setPan((p) => ({
      x: clampNumber(p.x, -maxOffsetX, maxOffsetX),
      y: clampNumber(p.y, -maxOffsetY, maxOffsetY),
    }));
  }, [open, previewZoom, baseSize.w, baseSize.h, mainWidth, maxVisualHeight]);

  useEffect(() => {
    if (!open) {
      setPreviewZoom(1);
      setAnimatingTo(null);
      setTrackTransition(false);
      setSlideDir(0);
      setPan({ x: 0, y: 0 });
      setBaseSize({ w: 0, h: 0 });
      setPreviewLivePlaying(false);
    }
  }, [open]);

  function stepPreview(delta: number) {
    if (index === null) return;
    if (animatingTo !== null) return;
    const next = index + delta;
    if (next < 0 || next >= items.length) return;
    const dir = delta > 0 ? 1 : -1;
    const target = items[next];
    const cached = target ? sizeCacheRef.current[target.id] : null;
    setBaseSize(cached ?? { w: 0, h: 0 });
    setSlideDir(dir);
    setAnimatingTo(next);
    setTrackTransition(false);
    setPreviewZoom(1);
    setPan({ x: 0, y: 0 });
    dragStartRef.current = null;
    setPreviewLivePlaying(false);
  }

  function renderScene(sceneIndex: number, attachRefs: boolean) {
    const sceneItem = items[sceneIndex];
    if (!sceneItem) return null;
    const prevScene = sceneIndex > 0 ? items[sceneIndex - 1] : null;
    const nextScene = sceneIndex < items.length - 1 ? items[sceneIndex + 1] : null;
    const sceneTransform =
      animatingTo === null
        ? "translateX(0%)"
        : sceneIndex === index
          ? `translateX(${trackTransition ? (slideDir === 1 ? -100 : 100) : 0}%)`
          : sceneIndex === animatingTo
            ? `translateX(${trackTransition ? 0 : slideDir === 1 ? 100 : -100}%)`
            : "translateX(100%)";

    return (
      <div
        key={`scene-${sceneIndex}`}
        className="absolute inset-0 flex h-full w-full items-center justify-center"
        style={{
          transform: sceneTransform,
          transition: trackTransition
            ? `transform ${slideDuration}ms ${slideEasing}`
            : "none",
        }}
      >
        <div
          className="flex h-full w-full items-center justify-center"
          style={{
            gap: `${galleryGap}px`,
            paddingLeft: `${galleryPadding}px`,
            paddingRight: `${galleryPadding}px`,
          }}
        >
          {previewZoom === 1 && prevScene && (
            <div
              className="hidden h-full max-h-[78vh] items-center justify-center overflow-hidden rounded-xl bg-black/60 shadow-lg lg:flex"
              onClick={() => stepPreview(-1)}
              style={{
                opacity: 0.18,
                width: `${sideWidthPx}px`,
                height: sideHeight,
                pointerEvents: "auto",
                transform: "scale(0.9)",
                filter: "grayscale(30%) blur(1px)",
                transition: "opacity 0.3s ease, transform 0.3s ease",
              }}
            >
              {prevScene.type === "photo" ? (
                <img
                  src={prevScene.url}
                  alt={prevScene.title}
                  className="h-full w-full object-cover"
                />
              ) : (
                <video muted playsInline className="h-full w-full object-cover">
                  <source src={prevScene.url} />
                </video>
              )}
            </div>
          )}

          <div
            className="relative flex items-center justify-center overflow-hidden rounded-3xl bg-black/40"
            style={{
              width: `${mainWidth}px`,
              maxWidth: "92vw",
              maxHeight: "78vh",
              aspectRatio: baseSize.w && baseSize.h ? `${baseSize.w} / ${baseSize.h}` : "4 / 3",
            }}
          >
            {sceneItem.type === "photo" ? (
              <div
                ref={attachRefs ? previewContainerRef : null}
                className="relative flex h-full w-full items-center justify-center overflow-hidden rounded-2xl bg-black"
                style={{
                  touchAction: "none",
                  cursor: previewZoom > 1 ? (isDragging ? "grabbing" : "grab") : "default",
                }}
                onPointerDown={attachRefs ? handlePreviewPointerDown : undefined}
                onPointerMove={attachRefs ? handlePreviewPointerMove : undefined}
                onPointerUp={attachRefs ? handlePreviewPointerUp : undefined}
                onPointerCancel={attachRefs ? handlePreviewPointerUp : undefined}
                onMouseEnter={() => setVideoHover(true)}
                onMouseLeave={() => setVideoHover(false)}
              >
                {sceneItem.isLive && sceneItem.livePlaybackUrl ? (
                  <video
                    ref={attachRefs ? (previewImageRef as RefObject<HTMLVideoElement>) : null}
                    src={sceneItem.livePlaybackUrl}
                    controls
                    autoPlay={previewLivePlaying}
                    className="block select-none object-contain"
                    onLoadedMetadata={(e) => handleVideoMetadata(e.currentTarget, sceneItem.id)}
                    style={{
                      width: "100%",
                      height: "100%",
                      maxWidth: "none",
                      maxHeight: "none",
                      transform: `translate3d(${pan.x}px, ${pan.y}px, 0) scale(${previewZoom})`,
                      transformOrigin: "center center",
                      willChange: "transform",
                    }}
                    draggable={false}
                    onDragStart={(e) => e.preventDefault()}
                  />
                ) : (
                  <img
                    ref={attachRefs ? previewImageRef : null}
                    src={sceneItem.url}
                    alt={sceneItem.title}
                    className="block select-none object-contain"
                    draggable={false}
                    onDragStart={(e) => e.preventDefault()}
                    onLoad={(e) => handleImageLoad(e.currentTarget, sceneItem.id)}
                    style={{
                      width: "100%",
                      height: "100%",
                      maxWidth: "none",
                      maxHeight: "none",
                      transform: `translate3d(${pan.x}px, ${pan.y}px, 0) scale(${previewZoom})`,
                      transformOrigin: "center center",
                      willChange: "transform",
                    }}
                  />
                )}
                {sceneItem.isLive && sceneItem.livePlaybackUrl && (
                  <button
                    onClick={() => setPreviewLivePlaying((v) => !v)}
                    className={`absolute left-3 top-3 rounded-full bg-black/70 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-white hover:bg-black/80 ${
                      videoHover ? "opacity-100" : "opacity-0"
                    } transition`}
                  >
                    Live {previewLivePlaying ? "播放中" : "播放"}
                  </button>
                )}
              </div>
            ) : (
              <div className="relative h-full w-full overflow-hidden rounded-2xl bg-black">
                <video
                  controls
                  autoPlay
                  className="h-full w-full object-contain"
                  onLoadedMetadata={(e) => handleVideoMetadata(e.currentTarget, sceneItem.id)}
                >
                  <source src={sceneItem.url} />
                  您的浏览器不支持视频播放。
                </video>
              </div>
            )}
          </div>

          {previewZoom === 1 && nextScene && (
            <div
              className="hidden h-full max-h-[78vh] items-center justify-center overflow-hidden rounded-xl bg-black/60 shadow-lg lg:flex"
              onClick={() => stepPreview(1)}
              style={{
                opacity: 0.18,
                width: `${sideWidthPx}px`,
                height: sideHeight,
                pointerEvents: "auto",
                transform: "scale(0.9)",
                filter: "grayscale(30%) blur(1px)",
                transition: "opacity 0.3s ease, transform 0.3s ease",
              }}
            >
              {nextScene.type === "photo" ? (
                <img
                  src={nextScene.url}
                  alt={nextScene.title}
                  className="h-full w-full object-cover"
                />
              ) : (
                <video muted playsInline className="h-full w-full object-cover">
                  <source src={nextScene.url} />
                </video>
              )}
            </div>
          )}
        </div>
      </div>
    );
  }

  if (!open || index === null) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-50 flex h-screen w-screen items-center justify-center bg-black/90 px-4"
      onClick={onClose}
      onWheel={handlePreviewWheel}
    >
      <button
        onClick={onClose}
        className="absolute left-6 top-6 z-20 rounded-full bg-white/85 px-3 py-1 text-sm font-semibold text-zinc-900 shadow hover:bg-white"
        aria-label="关闭"
      >
        关闭
      </button>
      <div className="absolute left-1/2 top-6 z-20 -translate-x-1/2 rounded-full bg-white/80 px-3 py-1 text-xs font-semibold text-zinc-800 shadow">
        {index + 1} / {items.length}
      </div>
      <button
        onClick={(e) => {
          e.stopPropagation();
          stepPreview(-1);
        }}
        disabled={index === 0}
        className={`absolute left-4 top-1/2 z-20 -translate-y-1/2 rounded-full px-3 py-2 text-lg font-bold shadow ${
          index === 0
            ? "bg-white/50 text-zinc-400 cursor-not-allowed"
            : "bg-white/80 text-zinc-800 hover:bg-white"
        }`}
        aria-label="上一张"
      >
        ←
      </button>
      <button
        onClick={(e) => {
          e.stopPropagation();
          stepPreview(1);
        }}
        disabled={index === items.length - 1}
        className={`absolute right-4 top-1/2 z-20 -translate-y-1/2 rounded-full px-3 py-2 text-lg font-bold shadow ${
          index === items.length - 1
            ? "bg-white/50 text-zinc-400 cursor-not-allowed"
            : "bg-white/80 text-zinc-800 hover:bg-white"
        }`}
        aria-label="下一张"
      >
        →
      </button>

      <div
        className="relative flex h-full w-full items-center justify-center overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="relative h-full w-full">
          {renderScene(index, animatingTo === null)}
          {animatingTo !== null && renderScene(animatingTo, false)}
        </div>

        {animatingTo === null && items[index]?.type === "photo" && (
          <div className="absolute bottom-6 right-6 z-20 flex items-center gap-2 rounded-lg bg-white/85 px-3 py-2 text-sm font-semibold text-zinc-800 shadow">
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
  );
}
