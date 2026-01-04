"use client";

import Link from "next/link";
import { use, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { LayoutShell } from "@/components/layout-shell";
import { type MediaItem } from "@/components/media-previewer";
import { MediaGrid } from "@/components/media-grid";
import { supabaseClient } from "@/lib/supabase/client";

type Album = {
  id: string;
  name: string;
  created_at?: string;
};

type PendingMedia = {
  id: string;
  url: string;
  media_type: "photo" | "video" | "live" | string;
  title?: string;
};

function generateEmbedding(seed: string) {
  let state = 0;
  for (let i = 0; i < seed.length; i++) {
    state = (state * 31 + seed.charCodeAt(i)) % 1000003;
  }
  const vec: number[] = [];
  for (let i = 0; i < 512; i++) {
    state = (state * 9301 + 49297) % 233280;
    vec.push((state / 233280) * 2 - 1);
  }
  return vec;
}

function averageEmbeddings(existing: number[][], incoming: number[][]) {
  const total = existing.length + incoming.length;
  if (total === 0) return [];
  const sum = new Array(512).fill(0);
  const all = [...existing, ...incoming];
  all.forEach((vec) => {
    for (let i = 0; i < Math.min(512, vec.length); i++) {
      sum[i] += vec[i];
    }
  });
  return sum.map((v) => v / total);
}

export default function ChildDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [userId, setUserId] = useState<string | null>(null);
  const [childName, setChildName] = useState<string>("");
  const [media, setMedia] = useState<MediaItem[]>([]);
  const [albums, setAlbums] = useState<Album[]>([]);
  const [albumIdsForChild, setAlbumIdsForChild] = useState<Set<string>>(new Set());
  const [albumsLoading, setAlbumsLoading] = useState(false);
  const [creatingAlbum, setCreatingAlbum] = useState(false);
  const [newAlbumName, setNewAlbumName] = useState("");
  const [albumModalOpen, setAlbumModalOpen] = useState(false);
  const [mediaLoading, setMediaLoading] = useState(false);
  const [deleteMode, setDeleteMode] = useState(false);
  const [selectedDelete, setSelectedDelete] = useState<Set<string>>(new Set());

  useEffect(() => {
    async function ensureLogin() {
      if (!supabaseClient) return;
      const { data } = await supabaseClient.auth.getSession();
      const user = data.session?.user;
      if (!user) {
        router.replace("/login");
        return;
      }
      setUserId(user.id);
      await loadChild(user.id);
      await loadChildMedia();
      await loadAlbums(user.id);
    }
    ensureLogin();
  }, [id, router]);

  useEffect(() => {
    function onStorage(e: StorageEvent) {
      if (e.key === "kc_child_media_refresh") {
        loadChildMedia();
      }
    }
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [userId]);

  async function loadChild(uid: string) {
    if (!supabaseClient) return;
    const { data, error } = await supabaseClient
      .from("children")
      .select("id, name")
      .eq("user_id", uid)
      .eq("id", id)
      .maybeSingle();
    if (error) {
      console.log("查询孩子失败", error);
      return;
    }
    if (!data) {
      router.replace("/albums");
      return;
    }
    setChildName(data.name ?? "未命名");
  }

  async function loadChildMedia() {
    if (!supabaseClient) return;
    setMediaLoading(true);
    const { data, error } = await supabaseClient
      .from("child_media")
      .select("media_id, created_at, media(id, storage_path, media_type, live_video_path, original_name, created_at, album_id)")
      .eq("child_id", id)
      .order("created_at", { ascending: false });
    if (error) {
      console.log("查询孩子媒体失败", error);
      setMediaLoading(false);
      return;
    }
    const client = supabaseClient;
    if (!client) return;
    const albumIds: string[] = [];
    const mapped: MediaItem[] =
      data
        ?.map((row: any) => {
          const mediaRow = row.media;
          if (!mediaRow) return null;
          const bucket = client.storage.from("photos");
          const transformed =
            bucket.getPublicUrl(
              mediaRow.storage_path,
              mediaRow.media_type === "live" ? ({ transform: { format: "webp", quality: 90 } } as any) : undefined
            ).data.publicUrl ?? bucket.getPublicUrl(mediaRow.storage_path).data.publicUrl;
          if (!transformed) return null;
          const liveUrl =
            mediaRow.media_type === "live" && mediaRow.live_video_path
              ? bucket.getPublicUrl(mediaRow.live_video_path).data.publicUrl
              : null;
          if (mediaRow.album_id) albumIds.push(String(mediaRow.album_id));
          return {
            id: String(mediaRow.id),
            type: mediaRow.media_type === "video" ? "video" : "photo",
            media_type: mediaRow.media_type,
            url: transformed,
            livePlaybackUrl: liveUrl ?? undefined,
            title: mediaRow.original_name ?? "",
            takenAt: mediaRow.created_at ?? undefined,
            storagePath: mediaRow.storage_path,
          };
        })
        .filter(Boolean) as MediaItem[] ?? [];
    setMedia(mapped);
    setAlbumIdsForChild(new Set(albumIds));
    setMediaLoading(false);
  }

  async function loadAlbums(uid: string) {
    if (!supabaseClient) return;
    setAlbumsLoading(true);
    const { data, error } = await supabaseClient
      .from("albums")
      .select("id, name, created_at")
      .eq("user_id", uid)
      .order("created_at", { ascending: false });
    if (error) {
      console.log("查询相册失败", error);
      setAlbumsLoading(false);
      return;
    }
    setAlbums(
      data?.map((row: any) => ({
        id: String(row.id),
        name: row.name ?? "未命名",
        created_at: row.created_at,
      })) ?? []
    );
    setAlbumsLoading(false);
  }

  async function linkPhotosToChild(mediaIds: string[]) {
    if (!supabaseClient || mediaIds.length === 0) return;
    const { data: existing } = await supabaseClient
      .from("child_media")
      .select("media_id")
      .eq("child_id", id)
      .in("media_id", mediaIds);
    const exists = new Set((existing ?? []).map((r: any) => String(r.media_id)));
    const payload = mediaIds
      .filter((pid) => !exists.has(pid))
      .map((pid) => ({
        child_id: id,
        media_id: pid,
      }));
    if (payload.length > 0) {
      const { error } = await supabaseClient.from("child_media").insert(payload);
      if (error) {
        console.log("写入 child_media 失败", error);
      }
    }
  }

  async function upsertFaceProfile(mediaIds: string[]) {
    if (!supabaseClient || mediaIds.length === 0) return;
    const { data: existing } = await supabaseClient
      .from("face_profiles")
      .select("id, embedding")
      .eq("child_id", id)
      .limit(3);
    const existingVec = (existing ?? []).map((row: any) => row.embedding as number[]).filter(Boolean);
    const incoming = mediaIds.map((pid, idx) => generateEmbedding(`${pid}-${idx}`));
    const aggregated = averageEmbeddings(existingVec, incoming);
    if (aggregated.length === 0) return;
    if (existing && existing.length > 0) {
      const target = existing[0];
      const { error } = await supabaseClient
        .from("face_profiles")
        .update({ embedding: aggregated, child_id: id })
        .eq("id", target.id);
      if (error) console.log("更新 face_profiles 失败", error);
    } else {
      const { error } = await supabaseClient.from("face_profiles").insert({
        child_id: id,
        embedding: aggregated,
      });
      if (error) console.log("创建 face_profiles 失败", error);
    }
  }

  async function removeAssociation(photoId: string) {
    if (!supabaseClient) return;
    const { error } = await supabaseClient.from("child_media").delete().eq("child_id", id).eq("media_id", photoId);
    if (error) {
      console.log("移除关联失败", error);
      return;
    }
    await loadChildMedia();
  }

  async function handleDeleteSelected() {
    if (!supabaseClient || !userId) return;
    const ids = Array.from(selectedDelete);
    if (ids.length === 0) return;
    const paths = media.filter((m) => ids.includes(m.id) && (m as any).storagePath).map((m: any) => m.storagePath as string);
    const { error: relErr } = await supabaseClient.from("child_media").delete().eq("child_id", id).in("media_id", ids);
    if (relErr) {
      console.log("删除关联失败", relErr);
    }
    const { error: mediaErr } = await supabaseClient.from("media").delete().eq("user_id", userId).in("id", ids);
    if (mediaErr) {
      console.log("删除媒体失败", mediaErr);
    }
    if (paths.length) {
      await supabaseClient.storage.from("photos").remove(paths);
    }
    setSelectedDelete(new Set());
    setDeleteMode(false);
    await loadChildMedia();
  }

  async function handleCreateAlbum() {
    if (!supabaseClient || !userId || !newAlbumName.trim()) return;
    setCreatingAlbum(true);
    const payload: Record<string, any> = {
      user_id: userId,
      name: newAlbumName.trim(),
    };
    payload.child_id = id;
    const { error } = await supabaseClient.from("albums").insert(payload);
    if (error) {
      console.log("创建相册失败，尝试不带 child_id", error);
      const fallback = await supabaseClient.from("albums").insert({
        user_id: userId,
        name: newAlbumName.trim(),
      });
      if (fallback.error) {
        console.log("创建相册失败（降级后）", fallback.error);
      }
    }
    setCreatingAlbum(false);
    setAlbumModalOpen(false);
    setNewAlbumName("");
    await loadAlbums(userId);
  }

  const childTitle = useMemo(() => (childName ? `${childName} 的所有照片/视频` : "孩子空间"), [childName]);

  function loadIgnored(): Set<string> {
    if (typeof window === "undefined") return new Set();
    try {
      const raw = localStorage.getItem("kc_ignored_photos");
      if (!raw) return new Set();
      const arr = JSON.parse(raw) as string[];
      return new Set(arr);
    } catch {
      return new Set();
    }
  }

  return (
    <LayoutShell>
      <div className="flex flex-col gap-6">
        <header className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-zinc-500">{childName || "孩子"}</p>
            <h1 className="text-3xl font-semibold">{childTitle}</h1>
            <p className="text-sm text-zinc-600">相册与媒体列表均为 {childName || "孩子"} 的空间；待确认/回收站在左侧导航。</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => router.push("/upload")}
              className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm font-semibold text-zinc-800 shadow-sm hover:bg-zinc-100"
            >
              上传照片
            </button>
            <button
              onClick={() => setAlbumModalOpen(true)}
              className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm font-semibold text-zinc-800 shadow-sm hover:bg-zinc-100"
            >
              创建相册
            </button>
            <button
              onClick={() => {
                setDeleteMode((v) => !v);
                setSelectedDelete(new Set());
              }}
              className={`rounded-lg px-3 py-2 text-sm font-semibold shadow-sm ${
                deleteMode
                  ? "border border-red-200 bg-red-50 text-red-700 hover:bg-red-100"
                  : "border border-zinc-200 bg-white text-zinc-800 hover:bg-zinc-100"
              }`}
            >
              {deleteMode ? "取消删除" : "删除照片"}
            </button>
            {deleteMode && (
              <button
                onClick={handleDeleteSelected}
                disabled={selectedDelete.size === 0}
                className="rounded-lg bg-red-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-red-700 disabled:cursor-not-allowed disabled:bg-red-300"
              >
                确认删除（{selectedDelete.size}）
              </button>
            )}
          </div>
        </header>

        <section className="space-y-3">
          {albumsLoading && <p className="text-sm text-zinc-600">加载相册...</p>}
          {!albumsLoading && albums.filter((a) => albumIdsForChild.has(a.id)).length > 0 && (
            <>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold uppercase tracking-[0.2em] text-zinc-500">相册</p>
                  <p className="text-sm text-zinc-600">根据与孩子关联的媒体反推关联相册，仅展示含有该孩子媒体的相册。</p>
                </div>
                <button
                  onClick={() => setAlbumModalOpen(true)}
                  className="rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-xs font-semibold text-zinc-800 shadow-sm hover:bg-zinc-100"
                >
                  新建相册
                </button>
              </div>
              <div className="flex flex-wrap gap-3">
                {albums
                  .filter((album) => albumIdsForChild.has(album.id))
                  .map((album) => (
                    <Link
                      key={album.id}
                      href={{ pathname: `/albums/${album.id}`, query: { title: album.name, albumId: album.id } }}
                      className="flex min-w-[160px] flex-col gap-1 rounded-xl border border-zinc-200 bg-white px-3 py-2 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-zinc-300"
                    >
                      <span className="text-sm font-semibold text-zinc-900">{album.name}</span>
                      <span className="text-xs text-zinc-600">创建于 {album.created_at ? new Date(album.created_at).toLocaleDateString() : "未知"}</span>
                    </Link>
                  ))}
              </div>
            </>
          )}
        </section>

        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-zinc-500">所有照片 / 视频</p>
              <p className="text-sm text-zinc-600">上传后自动进入孩子媒体或待确认池，可从下方移除误标。</p>
            </div>
            <span className="text-xs text-zinc-600">已确认 {media.length} 条</span>
          </div>

          {mediaLoading && <p className="text-sm text-zinc-600">加载中...</p>}
          {!mediaLoading && media.length === 0 && (
            <div className="rounded-xl border border-dashed border-zinc-300 bg-zinc-50 px-3 py-3 text-sm text-zinc-600">
              还没有关联的内容，去「上传」或「待确认」完成标注。
            </div>
          )}

          {!mediaLoading && media.length > 0 && (
            <>
              {!deleteMode && (
                <MediaGrid
                  items={media}
                  showTypeBadge
                  emptyText="还没有关联的内容，去「上传」或「待确认」完成标注。"
                />
              )}
              {deleteMode && (
                <div
                  className="grid"
                  style={{
                    gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
                    gap: "12px",
                  }}
                >
                  {media.map((item) => {
                    const selected = selectedDelete.has(item.id);
                    return (
                      <label
                        key={item.id}
                        className={`relative block overflow-hidden rounded-xl border bg-white shadow-sm ${
                          selected ? "border-red-400 ring-2 ring-red-200" : "border-zinc-200"
                        }`}
                      >
                        <input
                          type="checkbox"
                          className="absolute left-2 top-2 h-4 w-4"
                          checked={selected}
                          onChange={() => {
                            setSelectedDelete((prev) => {
                              const next = new Set(Array.from(prev));
                              if (next.has(item.id)) next.delete(item.id);
                              else next.add(item.id);
                              return next;
                            });
                          }}
                        />
                        {item.type === "photo" ? (
                          <img src={item.url} alt={item.title ?? item.id} className="w-full aspect-[4/3] object-cover" />
                        ) : (
                          <video muted playsInline className="w-full aspect-[4/3] object-cover">
                            <source src={item.url} />
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
                      </label>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </section>

        {albumModalOpen && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
            onClick={() => setAlbumModalOpen(false)}
          >
            <div
              className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-zinc-900">创建相册</h3>
                <button
                  onClick={() => setAlbumModalOpen(false)}
                  className="rounded-full bg-zinc-100 px-3 py-1 text-sm text-zinc-700 hover:bg-zinc-200"
                >
                  关闭
                </button>
              </div>
              <div className="mt-4 space-y-4">
                <div>
                  <label className="text-sm font-medium text-zinc-800">相册名称</label>
                  <input
                    value={newAlbumName}
                    onChange={(e) => setNewAlbumName(e.target.value)}
                    className="mt-2 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm text-zinc-900 focus:border-zinc-400 focus:outline-none"
                    placeholder="如：幼儿园开学季"
                    disabled={creatingAlbum}
                  />
                </div>
                <div className="flex items-center justify-end gap-2">
                  <button
                    onClick={() => setAlbumModalOpen(false)}
                    className="rounded-lg px-3 py-2 text-sm font-semibold text-zinc-600 hover:bg-zinc-100"
                  >
                    取消
                  </button>
                  <button
                    onClick={handleCreateAlbum}
                    className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-800 disabled:cursor-not-allowed disabled:bg-zinc-400"
                    disabled={creatingAlbum}
                  >
                    {creatingAlbum ? "创建中..." : "创建"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </LayoutShell>
  );
}
