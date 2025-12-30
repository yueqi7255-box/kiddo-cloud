"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { LayoutShell } from "@/components/layout-shell";
import { supabaseClient } from "@/lib/supabase/client";

type UploadItem = { name: string; url: string };
type Album = { id: string; name: string };

export default function UploadPage() {
  const router = useRouter();
  const [albums, setAlbums] = useState<Album[]>([]);
  const [selectedAlbumId, setSelectedAlbumId] = useState<string>("");
  const [files, setFiles] = useState<UploadItem[]>([]);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [loadingAlbums, setLoadingAlbums] = useState(true);
  const [isAuthed, setIsAuthed] = useState(false);
  const makeUuid = () =>
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : "id-" + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);

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
    async function loadAlbums() {
      if (!supabaseClient || !isAuthed) return;
      const { data: sessionData } = await supabaseClient.auth.getSession();
      const user = sessionData.session?.user;
      if (!user) {
        setLoadingAlbums(false);
        return;
      }
      const { data, error } = await supabaseClient
        .from("albums")
        .select("id, name")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });
      if (error) {
        console.log("获取相册失败", error);
      } else if (data) {
        setAlbums(data.map((a) => ({ id: String(a.id), name: a.name ?? "未命名相册" })));
        if (data.length > 0) {
          setSelectedAlbumId(String(data[0].id));
        }
      }
      setLoadingAlbums(false);
    }
    loadAlbums();
  }, [isAuthed]);

  async function handleFilesChange(fileList: FileList | null) {
    if (!fileList || !supabaseClient) return;
    setMessage(null);
    const { data: sessionData, error: sessionErr } = await supabaseClient.auth.getSession();
    const user = sessionData.session?.user;
    if (sessionErr || !user) {
      console.log("获取用户失败", sessionErr);
      setMessage("请先登录再上传");
      return;
    }
    const userId = user.id;
    if (!selectedAlbumId) {
      setMessage("请先选择相册");
      return;
    }
    setUploading(true);
    const uploaded: UploadItem[] = [];
    for (const file of Array.from(fileList)) {
      const ext = file.name.includes(".") ? file.name.slice(file.name.lastIndexOf(".")) : "";
      const safeName = `${makeUuid()}${ext}`;
      const path = `${userId}/${safeName}`;
      const { error } = await supabaseClient.storage.from("photos").upload(path, file, {
        cacheControl: "3600",
        upsert: true,
        contentType: file.type,
      });
      if (error) {
        console.log("上传失败", error);
        continue;
      }
      const { data: urlData } = supabaseClient.storage.from("photos").getPublicUrl(path);
      const lowerName = file.name.toLowerCase();
      const isHeic = lowerName.endsWith(".heic");
      const isPngJpg =
        lowerName.endsWith(".png") || lowerName.endsWith(".jpg") || lowerName.endsWith(".jpeg");
      const mediaType: "image" | "video" | "live" =
        isHeic ? "live" : file.type.startsWith("video/") ? "video" : "image";
      const { error: insertErr } = await supabaseClient.from("photos").insert({
        user_id: userId,
        album_id: selectedAlbumId,
        storage_path: isPngJpg ? `${userId}/${safeName || `${makeUuid()}.jpg`}` : path,
        original_name: file.name,
        live_video_path: null,
        media_type: mediaType,
      });
      if (insertErr) {
        console.log("写入 photos 表失败", insertErr);
      }
      uploaded.push({ name: file.name, url: urlData.publicUrl });
    }
    setFiles((prev) => [...uploaded, ...prev]);
    if (uploaded.length) {
      setMessage(`已上传 ${uploaded.length} 个文件`);
      // 触发默认相册刷新：写入 localStorage 简单通知
      localStorage.setItem("kc_album_refresh", Date.now().toString());
    } else {
      setMessage("上传失败，请检查控制台错误");
    }
    setUploading(false);
  }

  return (
    <LayoutShell>
      <div className="flex flex-col gap-8">
        <header className="flex flex-col gap-2">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-zinc-500">
            上传照片 / 视频
          </p>
          <h1 className="text-3xl font-semibold">选择相册并上传文件</h1>
          <p className="text-sm text-zinc-600">文件将上传到 Supabase Storage 的 photos bucket。</p>
        </header>

        <div className="flex flex-col gap-6 rounded-2xl border border-dashed border-zinc-300 bg-zinc-50 p-8 text-center shadow-sm">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-white shadow-sm">
            <span className="text-3xl text-zinc-600">⬆️</span>
          </div>
          <div className="flex flex-col items-center gap-2 text-zinc-700">
            <p className="text-lg font-semibold">拖拽或点击上传</p>
            <p className="text-sm text-zinc-500">支持照片或视频文件</p>
          </div>

          <label className="mx-auto flex cursor-pointer flex-col items-center gap-2 rounded-lg border border-zinc-200 bg-white px-4 py-3 text-sm font-medium text-zinc-800 transition hover:border-zinc-400 hover:bg-white">
            <span>{uploading ? "正在上传..." : "选择文件"}</span>
            <input
              type="file"
              accept="image/*,video/*"
              multiple
              className="hidden"
              onChange={(e) => handleFilesChange(e.target.files)}
              disabled={uploading}
            />
          </label>

          <div className="mx-auto flex flex-col gap-2 text-sm text-left text-zinc-700">
            <label className="font-semibold">选择相册</label>
            <select
              value={selectedAlbumId}
              onChange={(e) => setSelectedAlbumId(e.target.value)}
              className="w-64 rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-zinc-500 focus:outline-none"
              disabled={loadingAlbums || uploading || albums.length === 0}
            >
              {albums.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
            {albums.length === 0 && (
              <p className="text-xs text-red-600">当前还没有相册，请先创建相册后再上传。</p>
            )}
          </div>

          {message && <div className="text-sm text-zinc-700">{message}</div>}

          {files.length > 0 && (
            <div className="mx-auto w-full max-w-xl rounded-lg border border-zinc-200 bg-white px-4 py-3 text-left text-sm text-zinc-700 shadow-sm">
              <p className="font-semibold">已上传文件：</p>
              <ul className="mt-2 space-y-1">
                {files.map((item) => (
                  <li key={item.name} className="truncate">
                    • {item.name}{" "}
                    <a href={item.url} className="text-xs text-blue-600 underline" target="_blank" rel="noreferrer">
                      查看
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </LayoutShell>
  );
}
