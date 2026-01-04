"use client";

import { useEffect, useState } from "react";
import { LayoutShell } from "@/components/layout-shell";
import { MediaGrid } from "@/components/media-grid";
import { supabaseClient } from "@/lib/supabase/client";
import { type MediaItem } from "@/components/media-previewer";
import { useRouter } from "next/navigation";

export default function TrashPage() {
  const router = useRouter();
  const [items, setItems] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function init() {
      if (!supabaseClient) return;
      const { data } = await supabaseClient.auth.getSession();
      const uid = data.session?.user?.id;
      if (!uid) {
        router.replace("/login");
        return;
      }
      await loadTrash(uid);
    }
    init();
  }, [router]);

  async function loadTrash(uid: string) {
    if (!supabaseClient) return;
    setLoading(true);
    const ignored = loadIgnored();
    if (ignored.size === 0) {
      setItems([]);
      setLoading(false);
      return;
    }
    const { data, error } = await supabaseClient
      .from("media")
      .select("id, storage_path, media_type, live_video_path, original_name, created_at")
      .in("id", Array.from(ignored))
      .eq("user_id", uid);
    if (error) {
      console.log("查询回收站失败", error);
      setLoading(false);
      return;
    }
    const client = supabaseClient;
    const mapped =
      data?.map((p: any) => {
        const bucket = client.storage.from("photos");
        const transformed =
          bucket.getPublicUrl(
            p.storage_path,
            p.media_type === "live" ? ({ transform: { format: "webp", quality: 90 } } as any) : undefined
          ).data.publicUrl ?? bucket.getPublicUrl(p.storage_path).data.publicUrl;
        const liveUrl =
          p.media_type === "live" && p.live_video_path ? bucket.getPublicUrl(p.live_video_path).data.publicUrl : null;
        return {
          id: String(p.id),
          type: p.media_type === "video" ? "video" : "photo",
          media_type: p.media_type,
          url: liveUrl ?? transformed ?? undefined,
          title: p.original_name ?? "",
          takenAt: p.created_at ?? undefined,
        } as MediaItem;
      }) ?? [];
    setItems(mapped);
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
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-zinc-500">回收站</p>
          <h1 className="text-3xl font-semibold">已忽略的照片 / 视频</h1>
          <p className="text-sm text-zinc-600">来自待确认中标记为“不是孩子”的内容。</p>
        </header>
        {loading ? (
          <p className="text-sm text-zinc-600">加载中...</p>
        ) : (
          <MediaGrid items={items} showTypeBadge emptyText="回收站为空" />
        )}
      </div>
    </LayoutShell>
  );
}
