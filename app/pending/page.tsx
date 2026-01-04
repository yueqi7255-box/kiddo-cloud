"use client";

import { useEffect, useState } from "react";
import { LayoutShell } from "@/components/layout-shell";
import { MediaGrid } from "@/components/media-grid";
import { supabaseClient } from "@/lib/supabase/client";
import { type MediaItem } from "@/components/media-previewer";
import { useRouter } from "next/navigation";

export default function PendingPage() {
  const router = useRouter();
  const [items, setItems] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    async function init() {
      if (!supabaseClient) return;
      const { data } = await supabaseClient.auth.getSession();
      const uid = data.session?.user?.id;
      if (!uid) {
        router.replace("/login");
        return;
      }
      setUserId(uid);
      await loadPending(uid);
    }
    init();
  }, [router]);

  async function loadPending(uid: string) {
    if (!supabaseClient) return;
    setLoading(true);
    const ignored = loadIgnored();
    const { data: mediaRows, error } = await supabaseClient
      .from("media")
      .select("id, storage_path, media_type, live_video_path, original_name, created_at")
      .eq("user_id", uid)
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) {
      console.log("查询待确认失败", error);
      setLoading(false);
      return;
    }
    const mediaIds = mediaRows?.map((p: any) => String(p.id)) ?? [];
    const { data: relations } = await supabaseClient.from("child_media").select("media_id").in("media_id", mediaIds);
    const linked = new Set((relations ?? []).map((r: any) => String(r.media_id)));
    const client = supabaseClient;
    const pending =
      (mediaRows ?? [])
        .filter((p: any) => !linked.has(String(p.id)) && !ignored.has(String(p.id)))
        .map((p: any) => {
          const bucket = client.storage.from("photos");
          const transformed = bucket.getPublicUrl(
            p.storage_path,
            p.media_type === "live" ? ({ transform: { format: "webp", quality: 90 } } as any) : undefined
          ).data.publicUrl;
          const fallback = bucket.getPublicUrl(p.storage_path).data.publicUrl;
          const liveUrl =
            p.media_type === "live" && p.live_video_path ? bucket.getPublicUrl(p.live_video_path).data.publicUrl : null;
          return {
            id: String(p.id),
            type: p.media_type === "video" ? "video" : "photo",
            media_type: p.media_type,
            url: liveUrl ?? transformed ?? fallback,
            title: p.original_name ?? "",
            takenAt: p.created_at ?? undefined,
          } as MediaItem;
        })
        .filter(Boolean);
    setItems(pending);
    setLoading(false);
  }

  function loadIgnored(): Set<string> {
    if (typeof window === "undefined") return new Set();
    try {
      const raw = localStorage.getItem("kc_ignored_photos");
      if (!raw) return new Set();
      return new Set(JSON.parse(raw) as string[]);
    } catch {
      return new Set();
    }
  }

  return (
    <LayoutShell>
      <div className="flex flex-col gap-4">
        <header className="flex flex-col gap-2">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-zinc-500">待确认</p>
          <h1 className="text-3xl font-semibold">未分配的照片 / 视频</h1>
          <p className="text-sm text-zinc-600">选择后进入孩子空间完成关联；标记为“不是孩子”的会进入回收站。</p>
        </header>
        {loading ? (
          <p className="text-sm text-zinc-600">加载中...</p>
        ) : (
          <MediaGrid items={items} showTypeBadge emptyText="暂无待确认内容" />
        )}
      </div>
    </LayoutShell>
  );
}
