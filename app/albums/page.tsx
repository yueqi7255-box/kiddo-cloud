"use client";

import Link from "next/link";
import { LayoutShell } from "@/components/layout-shell";
import { listPhotos } from "@/lib/photos";

export default function AlbumsPage() {
  const albums = [
    {
      id: "default",
      name: "默认相册",
      count: listPhotos().length,
      description: "上传的照片/视频默认归档到这里",
    },
  ];

  return (
    <LayoutShell>
      <div className="flex flex-col gap-8">
        <header className="flex flex-col gap-2">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-zinc-500">
            我的相册
          </p>
          <h1 className="text-3xl font-semibold">查看或管理相册</h1>
          <p className="text-sm text-zinc-600">
            系统已初始化“默认相册”。上传的照片/视频会自动进入这里。未来可增加更多相册并支持 Supabase 存储。
          </p>
        </header>

        <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-4">
          {albums.map((album) => (
            <Link
              key={album.id}
              href={`/albums/${album.id}`}
              className="group rounded-2xl border border-zinc-200 bg-zinc-50 p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-zinc-300 hover:bg-white"
            >
              <p className="text-sm font-semibold text-zinc-500">相册</p>
              <h2 className="mt-2 text-xl font-semibold text-zinc-900">{album.name}</h2>
              <p className="mt-1 text-sm text-zinc-600">{album.description}</p>
              <p className="mt-4 text-sm font-medium text-zinc-800">
                {album.count} 条内容 · 点击进入
              </p>
            </Link>
          ))}
        </div>
      </div>
    </LayoutShell>
  );
}
