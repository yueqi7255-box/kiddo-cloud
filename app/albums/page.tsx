"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { LayoutShell } from "@/components/layout-shell";
import { listPhotos } from "@/lib/photos";

type Album = {
  id: string;
  name: string;
  count: number;
  description: string;
  cover: string;
  type: "normal" | "smart";
};

function randomCover(): string {
  const photos = listPhotos();
  if (!photos.length) return "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=900&q=80";
  const idx = Math.floor(Math.random() * photos.length);
  return photos[idx]?.url ?? photos[0].url;
}

export default function AlbumsPage() {
  const initialAlbums = useMemo<Album[]>(
    () => [
      {
        id: "default",
        name: "默认相册",
        count: listPhotos().length,
        description: "上传的照片/视频默认归档到这里",
        cover: randomCover(),
        type: "normal",
      },
    ],
    []
  );
  const [albums, setAlbums] = useState<Album[]>(initialAlbums);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [newType, setNewType] = useState<"normal" | "smart">("normal");

  function handleCreate() {
    if (!newName.trim()) return;
    const id = `album-${Date.now()}`;
    const count = Math.max(1, Math.floor(Math.random() * 12) + 1);
    const cover = randomCover();
    const album: Album = {
      id,
      name: newName.trim(),
      count,
      description: newType === "smart" ? "智能相册 · 自动归类" : "手动管理的相册",
      cover,
      type: newType,
    };
    setAlbums((prev) => [...prev, album]);
    setShowCreate(false);
    setNewName("");
    setNewType("normal");
  }

  return (
    <LayoutShell>
      <div className="flex flex-col gap-6">
        <header className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-zinc-500">
              我的相册
            </p>
            <h1 className="text-3xl font-semibold">查看或管理相册</h1>
            <p className="text-sm text-zinc-600">
              默认相册已创建。可以新建普通/智能相册，未来可接入 Supabase。
            </p>
          </div>
          <button
            onClick={() => setShowCreate(true)}
            className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-zinc-800"
          >
            创建相册
          </button>
        </header>

        <div
          className="grid gap-4"
          style={{
            gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
          }}
        >
          {albums.map((album) => (
            <Link
              key={album.id}
              href={{ pathname: `/albums/${album.id}`, query: { title: album.name, type: album.type } }}
              className="group relative overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:border-zinc-300"
            >
              <div className="h-36 w-full overflow-hidden">
                <img src={album.cover} alt={album.name} className="h-full w-full object-cover transition duration-300 group-hover:scale-105" />
              </div>
              <div className="space-y-1 px-4 py-3">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-semibold text-zinc-900">{album.name}</h2>
                  <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[11px] font-semibold text-zinc-700">
                    {album.type === "smart" ? "智能" : "普通"}
                  </span>
                </div>
                <p className="text-sm text-zinc-600">{album.description}</p>
                <p className="text-sm font-medium text-zinc-800">{album.count} 条内容 · 点击进入</p>
              </div>
            </Link>
          ))}
        </div>
      </div>

      {showCreate && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
          onClick={() => setShowCreate(false)}
        >
          <div
            className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-zinc-900">创建相册</h3>
              <button
                onClick={() => setShowCreate(false)}
                className="rounded-full bg-zinc-100 px-3 py-1 text-sm text-zinc-700 hover:bg-zinc-200"
              >
                关闭
              </button>
            </div>
            <div className="mt-4 space-y-4">
              <div>
                <label className="text-sm font-medium text-zinc-800">相册名称</label>
                <input
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="mt-2 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm text-zinc-900 focus:border-zinc-400 focus:outline-none"
                  placeholder="如：家庭旅行"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-zinc-800">类型</label>
                <div className="flex gap-2">
                  <button
                    onClick={() => setNewType("normal")}
                    className={`flex-1 rounded-lg border px-3 py-2 text-sm font-semibold transition ${
                      newType === "normal"
                        ? "border-zinc-900 bg-zinc-900 text-white"
                        : "border-zinc-200 text-zinc-700 hover:border-zinc-300"
                    }`}
                  >
                    普通相册
                  </button>
                  <button
                    onClick={() => setNewType("smart")}
                    className={`flex-1 rounded-lg border px-3 py-2 text-sm font-semibold transition ${
                      newType === "smart"
                        ? "border-zinc-900 bg-zinc-900 text-white"
                        : "border-zinc-200 text-zinc-700 hover:border-zinc-300"
                    }`}
                  >
                    智能相册
                  </button>
                </div>
              </div>
              <div className="flex items-center justify-end gap-2">
                <button
                  onClick={() => setShowCreate(false)}
                  className="rounded-lg px-3 py-2 text-sm font-semibold text-zinc-600 hover:bg-zinc-100"
                >
                  取消
                </button>
                <button
                  onClick={handleCreate}
                  className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-800"
                >
                  创建
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </LayoutShell>
  );
}
