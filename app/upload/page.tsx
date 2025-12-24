"use client";

import { useState } from "react";
import { LayoutShell } from "@/components/layout-shell";

const albums = ["默认相册"];

export default function UploadPage() {
  const [selectedAlbum, setSelectedAlbum] = useState(albums[0]);
  const [files, setFiles] = useState<string[]>([]);

  function handleFilesChange(fileList: FileList | null) {
    if (!fileList) return;
    const names = Array.from(fileList).map((f) => f.name);
    setFiles(names);
  }

  return (
    <LayoutShell>
      <div className="flex flex-col gap-8">
          <header className="flex flex-col gap-2">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-zinc-500">
              上传照片 / 视频
            </p>
            <h1 className="text-3xl font-semibold">选择相册并上传文件</h1>
            <p className="text-sm text-zinc-600">
              目前为本地模拟上传，不会把文件发出去；未来接入 Supabase Storage 时在此替换上传逻辑。
            </p>
          </header>

          <div className="flex flex-col gap-6 rounded-2xl border border-dashed border-zinc-300 bg-zinc-50 p-8 text-center shadow-sm">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-white shadow-sm">
              <span className="text-3xl text-zinc-600">⬆️</span>
            </div>
            <div className="flex flex-col items-center gap-2 text-zinc-700">
              <p className="text-lg font-semibold">拖拽或点击上传</p>
              <p className="text-sm text-zinc-500">支持照片或视频文件，示例将记录文件名</p>
            </div>

            <label className="mx-auto flex cursor-pointer flex-col items-center gap-2 rounded-lg border border-zinc-200 bg-white px-4 py-3 text-sm font-medium text-zinc-800 transition hover:border-zinc-400 hover:bg-white">
              <span>选择文件</span>
              <input
                type="file"
                accept="image/*,video/*"
                multiple
                className="hidden"
                onChange={(e) => handleFilesChange(e.target.files)}
              />
            </label>

            <div className="mx-auto flex flex-col gap-2 text-sm text-left text-zinc-700">
              <label className="font-semibold">选择相册</label>
              <select
                value={selectedAlbum}
                onChange={(e) => setSelectedAlbum(e.target.value)}
                className="w-48 rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-zinc-500 focus:outline-none"
              >
                {albums.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </select>
              <p className="text-xs text-zinc-500">默认选中“默认相册”。上传后将归档到此相册。</p>
            </div>

            {files.length > 0 && (
              <div className="mx-auto w-full max-w-xl rounded-lg border border-zinc-200 bg-white px-4 py-3 text-left text-sm text-zinc-700 shadow-sm">
                <p className="font-semibold">已选择文件（模拟上传）：</p>
                <ul className="mt-2 space-y-1">
                  {files.map((name) => (
                    <li key={name} className="truncate">
                      • {name} <span className="text-xs text-zinc-500">→ {selectedAlbum}</span>
                    </li>
                  ))}
                </ul>
                <p className="mt-3 text-xs text-zinc-500">
                  这里仅展示文件名。未来接入 Supabase Storage 时会在此调用上传接口。
                </p>
              </div>
            )}
          </div>
      </div>
    </LayoutShell>
  );
}
