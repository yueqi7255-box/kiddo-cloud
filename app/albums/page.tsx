"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { LayoutShell } from "@/components/layout-shell";
import { listPhotos } from "@/lib/photos";
import { supabaseClient } from "@/lib/supabase/client";
import { ensureDefaultAlbum } from "@/lib/supabase/albums";

type Album = {
  id: string;
  name: string;
  count?: number;
  description?: string;
  cover: string;
  type: "normal" | "smart";
  created_at?: string;
};

type Child = {
  id: string;
  name: string;
  created_at?: string;
  avatar_media_id?: string | null;
  mediaCount: number;
  coverUrl?: string | null;
};

const CHILD_CACHE_TTL = 60 * 1000; // 1 minute cache for faster repeat visits
let childrenCache:
  | {
      userId: string;
      children: Child[];
      pendingCount: number;
      cachedAt: number;
    }
  | null = null;

function randomCover(): string {
  const photos = listPhotos();
  if (!photos.length) return "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=900&q=80";
  const idx = Math.floor(Math.random() * photos.length);
  return photos[idx]?.url ?? photos[0].url;
}

export default function AlbumsPage() {
  const router = useRouter();
  const [albums, setAlbums] = useState<Album[]>([]);
  const [children, setChildren] = useState<Child[]>([]);
  const [showCreateAlbum, setShowCreateAlbum] = useState(false);
  const [newAlbumName, setNewAlbumName] = useState("");
  const [newAlbumType, setNewAlbumType] = useState<"normal" | "smart">("normal");
  const [albumLoading, setAlbumLoading] = useState(false);
  const [albumsLoading, setAlbumsLoading] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [countsLoading, setCountsLoading] = useState(false);
  const [childrenLoading, setChildrenLoading] = useState(true);
  const [showCreateChild, setShowCreateChild] = useState(false);
  const [creatingChild, setCreatingChild] = useState(false);
  const [newChildName, setNewChildName] = useState("");
  const [pendingCount, setPendingCount] = useState(0);
  const [childError, setChildError] = useState<string | null>(null);
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const coverObserver = useRef<IntersectionObserver | null>(null);
  const [visibleCoverIds, setVisibleCoverIds] = useState<Set<string>>(new Set());

  function hydrateFromCache(uid: string) {
    if (!childrenCache) return false;
    const fresh = Date.now() - childrenCache.cachedAt < CHILD_CACHE_TTL;
    if (childrenCache.userId === uid && fresh) {
      setChildren(childrenCache.children);
      setPendingCount(childrenCache.pendingCount);
      setChildrenLoading(false);
      return true;
    }
    return false;
  }

  async function handleCreateAlbum() {
    if (!newAlbumName.trim()) return;
    if (!supabaseClient || !userId) return;
    setAlbumLoading(true);
    const { error } = await supabaseClient.from("albums").insert({
      user_id: userId,
      name: newAlbumName.trim(),
    });
    if (error) {
      console.log("创建相册失败", error);
    }
    await loadAlbums(userId);
    setShowCreateAlbum(false);
    setNewAlbumName("");
    setNewAlbumType("normal");
    setAlbumLoading(false);
  }

  async function handleCreateChild() {
    if (!newChildName.trim()) {
      setChildError("请输入孩子姓名");
      return;
    }
    if (!userId || !supabaseClient) {
      setChildError("请先登录后再添加孩子");
      return;
    }
    setCreatingChild(true);
    const { data, error } = await supabaseClient
      .from("children")
      .insert({ name: newChildName.trim(), user_id: userId })
      .select("id, name")
      .maybeSingle();
    setCreatingChild(false);
    if (error) {
      console.log("创建孩子失败", error);
      setChildError(error.message || "创建失败，请稍后重试");
      return;
    }
    setChildError(null);
    setShowCreateChild(false);
    setNewChildName("");
    if (data?.id) {
      await loadChildren(userId);
      router.push(`/children/${data.id}`);
    } else {
      await loadChildren(userId);
    }
  }

  async function loadChildren(uid: string) {
    if (!supabaseClient) return;
    setChildrenLoading(true);
    hydrateFromCache(uid);
    const { data, error } = await supabaseClient
      .from("children")
      .select(
        `
        id,
        name,
        created_at,
        avatar_media_id,
        media_count:child_media(count),
        cover_media:child_media(
          created_at,
          media:media(id, storage_path, created_at)
        )
      `
      )
      .eq("user_id", uid)
      .order("created_at", { ascending: true })
      .order("created_at", { foreignTable: "cover_media", ascending: false })
      .limit(1, { foreignTable: "cover_media" });
    if (error) {
      console.log("查询孩子失败", error);
      setChildrenLoading(false);
      return;
    }
    const mapped: Child[] =
      data?.map((c: any) => {
        const mediaCount = c?.media_count?.[0]?.count ?? 0;
        const cover = c?.cover_media?.[0]?.media;
        const coverUrl = cover?.storage_path ? getPublicUrl(cover.storage_path) : null;
        return {
          id: String(c.id),
          name: c.name ?? "未命名",
          created_at: c.created_at,
          mediaCount,
          coverUrl,
        };
      }) ?? [];

    setChildren(mapped);
    if ((mapped?.length ?? 0) === 0) {
      setShowCreateChild(true);
    }
    const pending = await computePending(uid);
    setPendingCount(pending ?? 0);
    childrenCache = {
      userId: uid,
      children: mapped,
      pendingCount: pending ?? 0,
      cachedAt: Date.now(),
    };
    setChildrenLoading(false);
  }

  async function computePending(uid: string) {
    if (!supabaseClient) return 0;
    const { data: photos, error } = await supabaseClient
      .from("media")
      .select("id")
      .eq("user_id", uid);
    if (error) {
      console.log("查询未确认照片失败", error);
      return 0;
    }
    const photoIds = photos?.map((p: any) => String(p.id)) ?? [];
    if (photoIds.length === 0) {
      return 0;
    }
    const { data: relations, error: relErr } = await supabaseClient
      .from("child_media")
      .select("media_id")
      .in("media_id", photoIds);
    if (relErr) {
      console.log("查询关联失败", relErr);
      return 0;
    }
    const linked = new Set((relations ?? []).map((r: any) => String(r.media_id)));
    const pending = photoIds.filter((id) => !linked.has(id)).length;
    return pending;
  }

  function getPublicUrl(storagePath?: string | null) {
    if (!storagePath) return null;
    if (!supabaseUrl) return null;
    // Use transform to ensure HEIC/live renders and limit size for faster thumbnails
    return `${supabaseUrl}/storage/v1/object/public/photos/${storagePath}?format=webp&width=480`;
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
    const mapped =
      data?.map<Album>((a) => ({
        id: String(a.id),
        name: a.name ?? "未命名",
        type: "normal",
        cover: randomCover(),
        description: "",
        count: undefined,
        created_at: a.created_at,
      })) ?? [];
    setAlbums(mapped);
    refreshCounts(uid, mapped);
    ensureDefaultAlbum(uid).then((def) => {
      if (!def) return;
      if (!mapped.find((a) => a.id === def.id)) {
        loadAlbums(uid);
      }
    });
    setAlbumsLoading(false);
  }

  async function refreshCounts(uid: string, current: Album[]) {
    if (!supabaseClient || current.length === 0) return;
    setCountsLoading(true);
    const { data, error } = await supabaseClient
      .from("media")
      .select("album_id, id, storage_path, created_at")
      .eq("user_id", uid);
    if (error) {
      console.log("查询内容数量失败", error);
      setCountsLoading(false);
      return;
    }
    const map = new Map<string, number>();
    const latestMap = new Map<string, { created_at: string; storage_path: string | null }>();
    (data ?? []).forEach((row: any) => {
      const key = String(row.album_id);
      map.set(key, (map.get(key) ?? 0) + 1);
      const exist = latestMap.get(key);
      if (!exist || new Date(row.created_at).getTime() > new Date(exist.created_at).getTime()) {
        latestMap.set(key, { created_at: row.created_at, storage_path: row.storage_path });
      }
    });
    setAlbums((prev) =>
      prev.map((a) => ({
        ...a,
        count: map.get(a.id) ?? 0,
        cover: latestMap.get(a.id)?.storage_path ? getPublicUrl(latestMap.get(a.id)?.storage_path) ?? a.cover : a.cover,
      }))
    );
    setCountsLoading(false);
  }

  useEffect(() => {
    async function init() {
      if (!supabaseClient) return;
      const { data: sessionData } = await supabaseClient.auth.getSession();
      const user = sessionData.session?.user;
      if (!user) {
        router.replace("/login");
        return;
      }
      setUserId(user.id);
      await loadChildren(user.id);
      await loadAlbums(user.id);
    }
    init();
  }, [router]);

  useEffect(() => {
    // Intersection observer to delay cover image loading until visible
    const obs = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const id = entry.target.getAttribute("data-child-id");
          if (entry.isIntersecting && id) {
            setVisibleCoverIds((prev) => {
              if (prev.has(id)) return prev;
              const next = new Set(prev);
              next.add(id);
              return next;
            });
            obs.unobserve(entry.target);
          }
        });
      },
      { rootMargin: "200px 0px", threshold: 0.1 }
    );
    coverObserver.current = obs;
    return () => obs.disconnect();
  }, []);

  return (
    <LayoutShell>
      <div className="flex flex-col gap-10">
        <section className="flex flex-col gap-4">
          <header className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="space-y-1">
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-zinc-500">我的孩子</p>
              <h1 className="text-3xl font-semibold">家人的私人相册空间</h1>
              <p className="text-sm text-zinc-600">待确认池：{pendingCount} 张未分配。先添加孩子，再享受专属记忆。</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => router.push("/upload")}
                className="rounded-full border border-zinc-200 bg-white px-4 py-2 text-sm font-semibold text-zinc-800 shadow-sm transition hover:-translate-y-0.5 hover:shadow"
              >
                上传照片
              </button>
              <button
                onClick={() => setShowCreateChild(true)}
                className="rounded-full bg-zinc-900 px-5 py-2 text-sm font-semibold text-white shadow hover:-translate-y-0.5 hover:bg-zinc-800"
              >
                添加孩子
              </button>
            </div>
          </header>

          <div className="space-y-3">
            {!childrenLoading && children.length === 0 && (
              <div className="flex items-center justify-between rounded-2xl bg-gradient-to-r from-blue-50 via-white to-purple-50 px-5 py-6 shadow-sm ring-1 ring-zinc-100">
                <div>
                  <p className="text-lg font-semibold text-zinc-900">还没有孩子</p>
                  <p className="text-sm text-zinc-600">点击右上角「添加孩子」开始。</p>
                </div>
                <button
                  onClick={() => setShowCreateChild(true)}
                  className="rounded-full bg-zinc-900 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-zinc-800"
                >
                  现在添加
                </button>
              </div>
            )}

            <div
              className="grid gap-3"
              style={{
                gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
              }}
            >
              {childrenLoading
                ? Array.from({ length: 3 }).map((_, idx) => (
                    <div
                      key={`child-skeleton-${idx}`}
                      className="flex animate-pulse flex-col gap-3 rounded-2xl border border-zinc-100 bg-white/60 p-4 shadow-sm"
                    >
                      <div className="h-40 w-full rounded-2xl bg-zinc-200" />
                      <div className="space-y-2">
                        <div className="h-4 w-24 rounded bg-zinc-200" />
                        <div className="h-3 w-32 rounded bg-zinc-100" />
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        <div className="h-8 rounded-full bg-zinc-100" />
                        <div className="h-8 rounded-full bg-zinc-100" />
                        <div className="h-8 rounded-full bg-zinc-100" />
                      </div>
                    </div>
                  ))
                : children.map((child) => {
                    return (
                      <div
                        key={child.id}
                        className="flex flex-col gap-3 rounded-2xl border border-zinc-100 bg-white/90 p-4 shadow-sm backdrop-blur transition hover:-translate-y-0.5 hover:shadow-md"
                      >
                        <div
                          className="relative h-40 w-full overflow-hidden rounded-2xl bg-gradient-to-br from-blue-200 to-purple-100 text-xl font-semibold text-zinc-800 ring-1 ring-zinc-100"
                          data-child-id={child.id}
                          ref={(el) => {
                            if (el) coverObserver.current?.observe(el);
                          }}
                        >
                          {child.coverUrl && visibleCoverIds.has(child.id) ? (
                            <img
                              src={child.coverUrl}
                              alt={child.name}
                              className="h-full w-full object-cover"
                              loading="lazy"
                              decoding="async"
                            />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center">{child.name.slice(0, 1)}</div>
                          )}
                          <span className="absolute left-3 top-3 rounded-full bg-white/90 px-3 py-1 text-[11px] font-semibold text-zinc-700 shadow-sm">
                            {child.mediaCount} 张
                          </span>
                        </div>
                        <div className="space-y-1">
                          <div className="text-lg font-semibold text-zinc-900">{child.name}</div>
                          <p className="text-xs text-zinc-500">
                            创建于 {child.created_at ? new Date(child.created_at).toLocaleDateString() : "未记录"}
                          </p>
                        </div>
                        <div className="mt-2 grid grid-cols-3 gap-2">
                          <button
                            onClick={() => router.push(`/children/${child.id}`)}
                            className="rounded-full border border-zinc-200 bg-white/80 px-3 py-2 text-xs font-semibold text-zinc-700 shadow-sm hover:bg-white"
                          >
                            进入空间
                          </button>
                          <button
                            onClick={() => router.push(`/upload`)}
                            className="rounded-full border border-dashed border-zinc-200 bg-white/70 px-3 py-2 text-xs font-semibold text-zinc-600 shadow-sm hover:bg-white"
                          >
                            上传照片
                          </button>
                          <button
                            onClick={() => router.push(`/memory-wall?child=${child.id}`)}
                            className="rounded-full border border-zinc-200 bg-white/80 px-3 py-2 text-xs font-semibold text-zinc-700 shadow-sm hover:bg-white"
                          >
                            记忆墙
                          </button>
                        </div>
                      </div>
                    );
                  })}
            </div>
          </div>
        </section>

        <section className="flex flex-col gap-4">
          <header className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-zinc-500">我的相册</p>
              <h2 className="text-2xl font-semibold">为家人分类回忆</h2>
              <p className="text-sm text-zinc-600">上传先归属孩子；相册仅做分类展示。</p>
            </div>
            <button
              onClick={() => setShowCreateAlbum(true)}
              className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-zinc-800"
            >
              创建相册
            </button>
          </header>

          <div
            className="grid gap-2"
            style={{
              gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
            }}
          >
            {(albumsLoading ? Array.from({ length: 6 }) : albums).map((album, idx) =>
              albumsLoading ? (
                <div
                  key={`album-skeleton-${idx}`}
                  className="h-36 w-full animate-pulse rounded-xl border border-zinc-100 bg-white/70 shadow-sm"
                />
              ) : (
                <Link
                  key={(album as Album).id}
                  href={{ pathname: `/albums/${(album as Album).id}`, query: { title: (album as Album).name, type: (album as Album).type, albumId: (album as Album).id } }}
                  className="group relative overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:border-zinc-300"
                >
                  <div className="h-28 w-full overflow-hidden">
                    <img src={(album as Album).cover} alt={(album as Album).name} className="h-full w-full object-cover transition duration-300 group-hover:scale-105" />
                  </div>
                  <div className="space-y-1 px-3 py-2">
                    <div className="flex items-center justify-between">
                      <h2 className="text-sm font-semibold text-zinc-900">{(album as Album).name}</h2>
                      <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-semibold text-zinc-700">
                        {(album as Album).type === "smart" ? "智能" : "普通"}
                      </span>
                    </div>
                    <p className="text-xs text-zinc-600">{(album as Album).description}</p>
                    <p className="text-xs font-medium text-zinc-800">
                      {(album as Album).count !== undefined ? `${(album as Album).count} 条` : countsLoading ? "加载中..." : "0 条"} · 点击进入
                    </p>
                  </div>
                </Link>
              )
            )}
          </div>
        </section>
      </div>

      {showCreateAlbum && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
          onClick={() => setShowCreateAlbum(false)}
        >
          <div
            className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-zinc-900">创建相册</h3>
              <button
                onClick={() => setShowCreateAlbum(false)}
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
                  disabled={albumLoading}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-zinc-800">类型</label>
                <div className="flex gap-2">
                  <button
                    onClick={() => setNewAlbumType("normal")}
                    className={`flex-1 rounded-lg border px-3 py-2 text-sm font-semibold transition ${
                      newAlbumType === "normal"
                        ? "border-zinc-900 bg-zinc-900 text-white"
                        : "border-zinc-200 text-zinc-700 hover:border-zinc-300"
                    }`}
                    disabled={albumLoading}
                  >
                    普通相册
                  </button>
                  <button
                    onClick={() => setNewAlbumType("smart")}
                    className={`flex-1 rounded-lg border px-3 py-2 text-sm font-semibold transition ${
                      newAlbumType === "smart"
                        ? "border-zinc-900 bg-zinc-900 text-white"
                        : "border-zinc-200 text-zinc-700 hover:border-zinc-300"
                    }`}
                    disabled={albumLoading}
                  >
                    智能相册
                  </button>
                </div>
              </div>
              <div className="flex items-center justify-end gap-2">
                <button
                  onClick={() => setShowCreateAlbum(false)}
                  className="rounded-lg px-3 py-2 text-sm font-semibold text-zinc-600 hover:bg-zinc-100"
                >
                  取消
                </button>
                <button
                  onClick={handleCreateAlbum}
                  className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-800 disabled:cursor-not-allowed disabled:bg-zinc-400"
                  disabled={albumLoading}
                >
                  {albumLoading ? "创建中..." : "创建"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showCreateChild && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
          onClick={() => setShowCreateChild(false)}
        >
          <div
            className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-zinc-900">添加孩子</h3>
              <button
                onClick={() => setShowCreateChild(false)}
                className="rounded-full bg-zinc-100 px-3 py-1 text-sm text-zinc-700 hover:bg-zinc-200"
              >
                关闭
              </button>
            </div>
            <div className="mt-4 space-y-4">
              <div>
                <label className="text-sm font-medium text-zinc-800">孩子姓名</label>
                <input
                  value={newChildName}
                  onChange={(e) => setNewChildName(e.target.value)}
                  className="mt-2 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm text-zinc-900 focus:border-zinc-400 focus:outline-none"
                  placeholder="如：多多 / 妞妞"
                  disabled={creatingChild}
                />
                {childError && <p className="mt-2 text-xs text-red-600">{childError}</p>}
              </div>
              <div className="flex items-center justify-end gap-2">
                <button
                  onClick={() => setShowCreateChild(false)}
                  className="rounded-lg px-3 py-2 text-sm font-semibold text-zinc-600 hover:bg-zinc-100"
                >
                  取消
                </button>
                <button
                  onClick={handleCreateChild}
                  className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-800 disabled:cursor-not-allowed disabled:bg-zinc-400"
                  disabled={creatingChild}
                >
                  {creatingChild ? "创建中..." : "确认添加"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </LayoutShell>
  );
}
