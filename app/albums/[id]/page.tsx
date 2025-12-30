"use client";

import { use, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { LayoutShell } from "@/components/layout-shell";
import { MediaPreviewer, type MediaItem } from "@/components/media-previewer";
import { supabaseClient } from "@/lib/supabase/client";
import { ensureDefaultAlbum } from "@/lib/supabase/albums";

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
  const router = useRouter();
  const searchParams = useSearchParams();
  const [filter, setFilter] = useState<"all" | "photo" | "video">("all");
  const [zoom, setZoom] = useState(1); // 1.0 = 默认缩放
  const [selectedIndex, setSelectedIndex] = useState<number | null>(0);
  const [previewIndex, setPreviewIndex] = useState<number | null>(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [infoItem, setInfoItem] = useState<MediaItem | null>(null);
  const [showMemberModal, setShowMemberModal] = useState(false);
  const [memberInput, setMemberInput] = useState("");
  const [inviteLinkOn, setInviteLinkOn] = useState(true);
  const [members, setMembers] = useState<
    { id: string; contact: string; status: "pending" | "viewer" | "uploader" | "removed" }[]
  >([
    { id: "m1", contact: "mom@example.com", status: "viewer" },
    { id: "m2", contact: "dad@example.com", status: "uploader" },
  ]);
  const [uploaded, setUploaded] = useState<MediaItem[]>([]);
  const [albumId, setAlbumId] = useState<string | null>(null);
  const [isAuthed, setIsAuthed] = useState(false);

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
    async function fetchUploads() {
      if (!supabaseClient || !isAuthed) return;
      const { data: sessionData, error: sessionErr } = await supabaseClient.auth.getSession();
      const user = sessionData.session?.user;
      if (sessionErr || !user) return;
      const userId = user.id;
      const defaultAlbum = await ensureDefaultAlbum(userId);
      const urlAlbumId = searchParams.get("albumId");
      const routeAlbumId = id !== "default" ? id : null;
      const targetAlbumId = urlAlbumId || routeAlbumId || (defaultAlbum ? (defaultAlbum.id as string) : null);
      setAlbumId(targetAlbumId ?? null);
      if (!targetAlbumId) return;

      const { data, error } = await supabaseClient
        .from("photos")
        .select("id, storage_path, live_video_path, media_type, original_name, created_at")
        .eq("album_id", targetAlbumId)
        .order("created_at", { ascending: false });
      if (error) {
        console.log("获取相册照片失败", error);
        return;
      }
      const client = supabaseClient;
      if (!client) return;
      const items =
        data
          ?.map<MediaItem | null>((row) => {
            const decodedName = (() => {
              try {
                return decodeURIComponent(row.original_name ?? "");
              } catch {
                return row.original_name ?? "";
              }
            })();
            const urlResult = client.storage.from("photos").getPublicUrl(row.storage_path);
            const publicUrl = urlResult.data?.publicUrl;
            if (!publicUrl) return null;
            const liveUrl =
              row.media_type === "live" && row.live_video_path
                ? client.storage.from("photos").getPublicUrl(row.live_video_path).data.publicUrl
                : null;
            return {
              id: row.id.toString(),
              type: row.media_type === "video" ? "video" : "photo",
              media_type: row.media_type,
              livePlaybackUrl: liveUrl ?? undefined,
              title: decodedName || row.storage_path,
              url: publicUrl,
              takenAt: row.created_at ?? undefined,
            };
          })
          .filter(Boolean) as MediaItem[] ?? [];
      setUploaded(items);
    }
    fetchUploads();
    function onRefresh(e: StorageEvent) {
      if (e.key === "kc_album_refresh") {
        fetchUploads();
      }
    }
    window.addEventListener("storage", onRefresh);
    return () => window.removeEventListener("storage", onRefresh);
  }, [id, searchParams, isAuthed]);

  const albumTitle = searchParams.get("title") || (id === "default" ? "默认相册" : "我的相册");

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

  const thumbBase = 220;
  const thumbWidth = Math.round(thumbBase * zoom);
  const gap = Math.round(thumbWidth * 0.05); // 行列间距为占位高度的 5%

  const filtered = useMemo(() => {
    return uploaded.filter((item) => (filter === "all" ? true : item.type === filter));
  }, [filter, uploaded]);

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
    setIsPreviewOpen(true);
  }

  function closePreview() {
    setIsPreviewOpen(false);
    setPreviewIndex(null);
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (isPreviewOpen) return;
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
  }, [isPreviewOpen, filtered.length, selectedIndex]);

  return (
    <LayoutShell>
      <div className="flex h-full flex-col gap-6">
        <header className="sticky top-0 z-10 flex flex-col gap-3 border-b border-zinc-200 bg-white/95 pb-3 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-zinc-500">
              {albumTitle}
            </p>
            <h1 className="text-3xl font-semibold">家庭照片与视频</h1>
            <p className="text-sm text-zinc-600">右侧可筛选照片或视频，默认展示全部。</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={() => setShowMemberModal(true)}
              className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm font-semibold text-zinc-800 shadow-sm hover:bg-zinc-100"
            >
              添加成员
            </button>
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
          {filtered.map((item, idx) => (
            <figure
              key={item.id}
              className={`group overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm ${
                selectedIndex === idx ? "ring-2 ring-blue-500" : ""
              }`}
              onClick={() => setSelectedIndex(idx)}
              onDoubleClick={() => openPreview(idx)}
            >
              <div className="relative w-full">
                {item.type === "photo" ? (
                  <img
                    src={item.url}
                    alt={item.title}
                    className="w-full aspect-[4/3] object-cover"
                  />
                ) : (
                  <video muted playsInline className="w-full aspect-[4/3] object-cover">
                    <source src={item.url} />
                    您的浏览器不支持视频播放。
                  </video>
                )}
                {item.media_type === "live" && (
                  <span className="absolute left-2 bottom-2 rounded-full bg-black/75 px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-white">
                    Live
                  </span>
                )}
                {item.type === "video" && (
                  <span className="absolute left-2 bottom-2 rounded-full bg-black/75 px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-white">
                    视频
                  </span>
                )}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setInfoItem(item);
                  }}
                  className="absolute right-2 bottom-2 hidden rounded-full bg-black/70 px-2 py-1 text-xs font-semibold text-white shadow-sm transition group-hover:flex"
                  aria-label="更多信息"
                >
                  ⋯
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

        {infoItem && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4"
            onClick={() => setInfoItem(null)}
          >
            <div
              className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between">
                <div className="text-lg font-semibold">照片/视频信息</div>
                <button
                  onClick={() => setInfoItem(null)}
                  className="rounded-full bg-zinc-100 px-3 py-1 text-sm text-zinc-700 hover:bg-zinc-200"
                >
                  关闭
                </button>
              </div>
              <div className="mt-4 space-y-2 text-sm text-zinc-700">
                <p>类型：{infoItem.type === "photo" ? "照片" : "视频"}</p>
                {infoItem.media_type === "live" && <p>Live：是</p>}
                <p>格式：{infoItem.format ?? "未知"}</p>
                <p>大小：{infoItem.sizeMB ? `${infoItem.sizeMB} MB` : "未知"}</p>
                <p>拍摄时间：{infoItem.takenAt ?? "未知"}</p>
                <p>设备：{infoItem.device ?? "未知"}</p>
                <p>地点：{infoItem.location ?? "未知"}</p>
                <p>存储：{infoItem.storagePath ?? "default/..."}</p>
                <p>标题：{infoItem.title}</p>
                <p>ID：{infoItem.id}</p>
                <p>链接：{infoItem.url}</p>
              </div>
            </div>
          </div>
        )}

        {showMemberModal && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4"
            onClick={() => setShowMemberModal(false)}
          >
            <div
              className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-zinc-900">添加成员</h3>
                  <p className="text-sm text-zinc-600">邀请家庭成员加入相册并设置权限。</p>
                </div>
                <button
                  onClick={() => setShowMemberModal(false)}
                  className="rounded-full bg-zinc-100 px-3 py-1 text-sm text-zinc-700 hover:bg-zinc-200"
                >
                  关闭
                </button>
              </div>

              <div className="mt-4 space-y-4">
                <div>
                  <label className="text-sm font-medium text-zinc-800">手机号/邮箱</label>
                  <div className="mt-2 flex gap-2">
                    <input
                      value={memberInput}
                      onChange={(e) => setMemberInput(e.target.value)}
                      className="flex-1 rounded-lg border border-zinc-200 px-3 py-2 text-sm text-zinc-900 focus:border-zinc-400 focus:outline-none"
                      placeholder="例如 138xxxx8888 或 email@example.com"
                    />
                    <button
                      onClick={() => {
                        if (!memberInput.trim()) return;
                        const id = `m-${Date.now()}`;
                        setMembers((prev) => [...prev, { id, contact: memberInput.trim(), status: "pending" }]);
                        setMemberInput("");
                      }}
                      className="rounded-lg bg-zinc-900 px-3 py-2 text-sm font-semibold text-white hover:bg-zinc-800"
                    >
                      添加
                    </button>
                  </div>
                </div>

                <div className="space-y-3 rounded-xl border border-zinc-200 bg-zinc-50 p-3">
                  <div className="text-sm font-semibold text-zinc-800">成员列表</div>
                  <div className="space-y-2">
                    {members.map((m) => (
                      <div
                        key={m.id}
                        className="flex items-center justify-between rounded-lg bg-white px-3 py-2 text-sm shadow-sm"
                      >
                        <div className="text-zinc-800">{m.contact}</div>
                        {m.status === "pending" ? (
                          <span className="text-sm font-semibold text-red-500">待加入</span>
                        ) : (
                          <select
                            value={m.status}
                            onChange={(e) => {
                              const value = e.target.value as "pending" | "viewer" | "uploader" | "removed";
                              setMembers((prev) =>
                                prev.map((item) => (item.id === m.id ? { ...item, status: value } : item))
                              );
                            }}
                            className="rounded-lg border border-zinc-200 px-2 py-1 text-sm text-zinc-800 focus:border-zinc-400 focus:outline-none"
                          >
                            <option value="viewer">仅预览</option>
                            <option value="uploader">可上传</option>
                            <option value="removed">移除成员</option>
                          </select>
                        )}
                      </div>
                    ))}
                    {members.length === 0 && (
                      <p className="text-sm text-zinc-500">暂无成员，添加后会显示在这里。</p>
                    )}
                  </div>
                </div>

                <div className="flex items-center justify-between rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-3">
                  <div>
                    <div className="text-sm font-semibold text-zinc-800">邀请链接</div>
                    <p className="text-xs text-zinc-600">开启后可复制分享给家人加入相册。</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="flex items-center gap-1 text-sm text-zinc-700">
                      <input
                        type="checkbox"
                        checked={inviteLinkOn}
                        onChange={() => setInviteLinkOn((v) => !v)}
                        className="h-4 w-4"
                      />
                      开启
                    </label>
                    <button
                      onClick={() => {
                        const url = new URL(window.location.href);
                        url.searchParams.set("invite", "1");
                        navigator.clipboard.writeText(url.toString());
                        alert("邀请链接已复制");
                      }}
                      disabled={!inviteLinkOn}
                      className={`rounded-lg px-3 py-2 text-sm font-semibold shadow-sm ${
                        inviteLinkOn
                          ? "bg-zinc-900 text-white hover:bg-zinc-800"
                          : "bg-zinc-200 text-zinc-500 cursor-not-allowed"
                      }`}
                    >
                      复制链接
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </LayoutShell>
  );
}
