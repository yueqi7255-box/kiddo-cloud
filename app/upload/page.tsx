"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { LayoutShell } from "@/components/layout-shell";
import { supabaseClient } from "@/lib/supabase/client";

type UploadItem = { name: string; url: string; photoId?: string; media_type?: string };
type Child = { id: string; name: string };

export default function UploadPage() {
  const router = useRouter();
  const [files, setFiles] = useState<UploadItem[]>([]);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [isAuthed, setIsAuthed] = useState(false);
  const [children, setChildren] = useState<Child[]>([]);
  const [loadingChildren, setLoadingChildren] = useState(true);
  const [confirmOpen, setConfirmOpen] = useState(false); // legacy modal flag
  const [negativeIds, setNegativeIds] = useState<Set<string>>(new Set()); // legacy
  const [selectedChildId, setSelectedChildId] = useState<string>("");
  const [userId, setUserId] = useState<string | null>(null);
  const [childCounts, setChildCounts] = useState<Map<string, number>>(new Map());
  const [reviewOpen, setReviewOpen] = useState(false);
  const [reviewItems, setReviewItems] = useState<(UploadItem & { storagePath?: string })[]>([]);
  const [reviewSelected, setReviewSelected] = useState<Set<string>>(new Set());
  const [avatarId, setAvatarId] = useState<string | null>(null);
  const [bodyOverflow, setBodyOverflow] = useState<string | null>(null);
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
      setUserId(data.session.user.id);
      setIsAuthed(true);
    }
    ensureLogin();
  }, [router]);

  useEffect(() => {
    async function loadChildren() {
      if (!supabaseClient || !isAuthed) return;
      const { data: sessionData } = await supabaseClient.auth.getSession();
      const user = sessionData.session?.user;
      if (!user) {
        setLoadingChildren(false);
        return;
      }
      const { data, error } = await supabaseClient
        .from("children")
        .select("id, name")
        .eq("user_id", user.id)
        .order("created_at", { ascending: true });
      if (error) {
        console.log("获取孩子失败", error);
      } else if (data) {
        const mapped = data.map((c) => ({ id: String(c.id), name: c.name ?? "未命名" }));
        setChildren(mapped);
        if (mapped.length > 0 && !selectedChildId) setSelectedChildId(String(mapped[0].id));
        await loadChildCounts(user.id);
      }
      setLoadingChildren(false);
    }
    loadChildren();
  }, [isAuthed]);

  useEffect(() => {
    if (typeof document === "undefined") return;
    if (reviewOpen && bodyOverflow === null) {
      setBodyOverflow(document.body.style.overflow);
      document.body.style.overflow = "hidden";
    }
    if (!reviewOpen && bodyOverflow !== null) {
      document.body.style.overflow = bodyOverflow;
      setBodyOverflow(null);
    }
    return () => {
      if (bodyOverflow !== null) {
        document.body.style.overflow = bodyOverflow;
      }
    };
  }, [reviewOpen, bodyOverflow]);

  async function loadChildCounts(uid: string) {
    if (!supabaseClient) return;
    const { data, error } = await supabaseClient.from("child_media").select("child_id");
    if (error) {
      console.log("获取孩子内容数失败", error);
      return;
    }
    const map = new Map<string, number>();
    (data ?? []).forEach((row: any) => {
      const key = String(row.child_id);
      map.set(key, (map.get(key) ?? 0) + 1);
    });
    setChildCounts(map);
  }

  async function cancelUploaded(items: (UploadItem & { storagePath?: string })[]) {
    const ids = items.map((i) => i.photoId).filter(Boolean) as string[];
    if (ids.length && supabaseClient) {
      await supabaseClient.from("media").delete().in("id", ids);
    }
    const paths = items.map((i) => i.storagePath).filter(Boolean) as string[];
    if (paths.length && supabaseClient) {
      await supabaseClient.storage.from("photos").remove(paths);
    }
    setFiles((prev) => prev.filter((f) => !ids.includes(f.photoId ?? "")));
    setMessage("已取消此次上传，未写入任何数据");
  }

  function toggleNegative(id: string) {
    setNegativeIds((prev) => {
      const next = new Set(Array.from(prev));
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function linkPhotosToChild(childId: string, photoIds: string[]) {
    if (!supabaseClient || photoIds.length === 0) return;
    const { data: existing } = await supabaseClient
      .from("child_media")
      .select("media_id")
      .eq("child_id", childId)
      .in("media_id", photoIds);
    const exists = new Set((existing ?? []).map((r: any) => String(r.media_id)));
    const payload = photoIds
      .filter((pid) => !exists.has(pid))
      .map((pid) => ({
        child_id: childId,
        media_id: pid,
      }));
    if (payload.length > 0) {
      const { error } = await supabaseClient.from("child_media").insert(payload);
      if (error) {
        console.log("写入 child_media 失败", error);
      }
    }
  }

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

  function persistIgnored(set: Set<string>) {
    if (typeof window === "undefined") return;
    localStorage.setItem("kc_ignored_photos", JSON.stringify(Array.from(set)));
  }

  async function upsertFaceProfile(childId: string, photoIds: string[]) {
    if (!supabaseClient || photoIds.length === 0) return;
    const { data: existing } = await supabaseClient
      .from("face_profiles")
      .select("id, embedding")
      .eq("child_id", childId)
      .limit(3);
    const existingVec = (existing ?? []).map((row: any) => row.embedding as number[]).filter(Boolean);
    const incoming = photoIds.map((pid, idx) => generateEmbedding(`${pid}-${idx}`));
    const aggregated = averageEmbeddings(existingVec, incoming);
    if (aggregated.length === 0) return;
    if (existing && existing.length > 0) {
      const target = existing[0];
      const { error } = await supabaseClient
        .from("face_profiles")
        .update({ embedding: aggregated, child_id: childId })
        .eq("id", target.id);
      if (error) console.log("更新 face_profiles 失败", error);
    } else {
      const { error } = await supabaseClient.from("face_profiles").insert({
        child_id: childId,
        embedding: aggregated,
      });
      if (error) console.log("创建 face_profiles 失败", error);
    }
  }

  async function confirmNow(targetChildId?: string, targetIds?: string[]) {
    const childId = targetChildId ?? selectedChildId;
    if (!childId) {
      setMessage("请先选择孩子再确认");
      return;
    }
    const positives =
      targetIds ??
      files.filter((f) => f.photoId && !negativeIds.has(f.photoId)).map((f) => f.photoId as string);
    const negatives = files.filter((f) => f.photoId && negativeIds.has(f.photoId)).map((f) => f.photoId as string);
    await linkPhotosToChild(childId, positives);
    await upsertFaceProfile(childId, positives);
    if (negatives.length) {
      const nextIgnored = loadIgnored();
      negatives.forEach((id) => nextIgnored.add(id));
      persistIgnored(nextIgnored);
    }
    setConfirmOpen(false);
    setNegativeIds(new Set());
    localStorage.setItem("kc_child_media_refresh", Date.now().toString());
    setMessage("已完成确认，已写入孩子媒体/人脸向量");
    if (userId) {
      localStorage.setItem(`kc_initial_face_done_${userId}`, "1");
    }
    setChildCounts((prev) => {
      const next = new Map(prev);
      next.set(childId, (next.get(childId) ?? 0) + positives.length);
      return next;
    });
  }

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
    if (fileList.length > 9) {
      setMessage("已截取前 9 张：首次校准建议最多 9 张不同角度的照片");
    }
    const userId = user.id;
    setUploading(true);
    const uploaded: (UploadItem & { storagePath: string })[] = [];
    const limitedFiles = Array.from(fileList).slice(0, 9);
    for (const file of limitedFiles) {
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
      const lowerName = file.name.toLowerCase();
      const isPngJpg =
        lowerName.endsWith(".png") || lowerName.endsWith(".jpg") || lowerName.endsWith(".jpeg");
      // Web 端不支持 Live Photo，HEIC 统一按静态图像处理
      const mediaType: "image" | "video" | "live" = file.type.startsWith("video/") ? "video" : "image";
      const bucket = supabaseClient.storage.from("photos");
      const previewUrl =
        bucket.getPublicUrl(
          path,
          mediaType === "image"
            ? {
                transform: {
                  format: "webp",
                  quality: 90,
                  width: 1200,
                },
              }
            : undefined
        ).data.publicUrl ?? bucket.getPublicUrl(path).data.publicUrl;
      const { data: inserted, error: insertErr } = await supabaseClient
        .from("media")
        .insert({
          user_id: userId,
          album_id: null,
          storage_path: isPngJpg ? `${userId}/${safeName || `${makeUuid()}.jpg`}` : path,
          original_name: file.name,
          live_video_path: null,
          media_type: mediaType,
        })
        .select("id")
        .maybeSingle();
      if (insertErr) {
        console.log("写入 photos 表失败", insertErr);
      }
      uploaded.push({
        name: file.name,
        url: previewUrl ?? "",
        photoId: inserted?.id ? String(inserted.id) : undefined,
        media_type: mediaType,
        storagePath: path,
      });
    }
    setFiles((prev) => [...uploaded, ...prev]);
    if (uploaded.length) {
      const initialDone = userId ? localStorage.getItem(`kc_initial_face_done_${userId}`) === "1" : false;
      const selectedCount = childCounts.get(selectedChildId ?? "") ?? 0;
      const shouldReview = Boolean(selectedChildId) && selectedCount === 0;
      if (shouldReview) {
        const ids = uploaded.map((i) => i.photoId!).filter(Boolean);
        if (ids.length === 0) {
          setMessage("上传成功，但未获取到图片 ID，已进入待确认池");
          return;
        }
        const defaultAvatar = ids[0] ?? null;
        setAvatarId(defaultAvatar);
        setReviewItems(uploaded);
        setReviewSelected(new Set(ids));
        setReviewOpen(true);
        setMessage(`已上传 ${uploaded.length} 个文件，需确认孩子人脸后完成关联`);
      } else if (selectedChildId) {
        await confirmNow(selectedChildId, uploaded.map((f) => f.photoId!).filter(Boolean));
        setMessage(`已上传并关联到所选孩子，共 ${uploaded.length} 个文件`);
      } else {
        setMessage(`已上传 ${uploaded.length} 个文件，已进入待确认池`);
        setConfirmOpen(!initialDone);
        if (initialDone) {
          setNegativeIds(new Set());
          localStorage.setItem("kc_child_media_refresh", Date.now().toString());
        }
      }
    } else {
      setMessage("上传失败，请检查控制台错误");
    }
    setUploading(false);
  }

  return (
    <LayoutShell>
      <div className="flex flex-col gap-8">
        <header className="flex flex-col gap-2">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-zinc-500">上传照片 / 视频</p>
          <h1 className="text-3xl font-semibold">先上传，再在待确认池标注孩子</h1>
          <p className="text-sm text-zinc-600">
            上传后不再选择相册，统一进入待确认池。建议首次最多 9 张不同角度的人脸，九宫格中勾选「没有孩子」的照片来纠正。
          </p>
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

          <div className="mx-auto flex flex-col items-center gap-2 text-sm text-zinc-700">
            <div className="flex flex-col items-center gap-2">
              <label className="text-sm font-semibold">选择孩子（可选，不选则进入待确认池）</label>
              <select
                value={selectedChildId}
                onChange={(e) => setSelectedChildId(e.target.value)}
                className="w-64 rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-zinc-500 focus:outline-none"
                disabled={loadingChildren || uploading || children.length === 0}
              >
                <option value="">不选择，进入待确认池</option>
                {children.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <p className="text-xs text-red-600">提示：首次校准建议最多 9 张不同角度的照片。</p>
            {!loadingChildren && children.length === 0 && (
              <p className="text-xs text-red-600">还没有孩子，请先去「我的孩子」页面添加。</p>
            )}
          </div>

          {message && <div className="text-sm text-zinc-700">{message}</div>}

          {files.length > 0 && (
            <div className="mx-auto w-full max-w-xl rounded-lg border border-zinc-200 bg-white px-4 py-3 text-left text-sm text-zinc-700 shadow-sm">
              <p className="font-semibold">已上传文件：</p>
              <ul className="mt-2 space-y-1">
                {files.map((item) => (
                  <li key={(item.photoId ?? "") + item.name} className="truncate">
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

      {confirmOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
          onClick={() => setConfirmOpen(false)}
        >
          <div
            className="w-full max-w-4xl rounded-2xl bg-white p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-zinc-900">九宫格确认</h3>
                <p className="text-sm text-zinc-600">
                  请选择「照片中没有」目标孩子的图片；剩余将写入孩子并生成人脸向量。
                </p>
              </div>
              <button
                onClick={() => setConfirmOpen(false)}
                className="rounded-full bg-zinc-100 px-3 py-1 text-sm text-zinc-700 hover:bg-zinc-200"
              >
                关闭
              </button>
            </div>

            <div className="mt-4 flex flex-col gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-semibold text-zinc-800">选择孩子：</span>
                <select
                  value={selectedChildId}
                  onChange={(e) => setSelectedChildId(e.target.value)}
                  className="rounded-lg border border-zinc-200 px-3 py-2 text-sm focus:border-zinc-400 focus:outline-none"
                >
                  {children.map((child) => (
                    <option key={child.id} value={child.id}>
                      {child.name}
                    </option>
                  ))}
                </select>
                {children.length === 0 && (
                  <span className="text-xs text-red-600">还没有孩子，请先创建后再确认。</span>
                )}
              </div>

              <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))" }}>
                {files.slice(0, 9).map((item) => (
                  <label
                    key={(item.photoId ?? "") + item.name}
                    className={`relative block overflow-hidden rounded-xl border ${
                      item.photoId && negativeIds.has(item.photoId) ? "border-red-400 ring-2 ring-red-200" : "border-zinc-200"
                    }`}
                  >
                    <input
                      type="checkbox"
                      className="absolute left-2 top-2 h-4 w-4"
                      checked={item.photoId ? negativeIds.has(item.photoId) : false}
                      onChange={() => item.photoId && toggleNegative(item.photoId)}
                    />
                    {item.media_type === "video" ? (
                      <video muted playsInline className="w-full aspect-square object-cover">
                        <source src={item.url} />
                      </video>
                    ) : (
                      <img src={item.url} alt={item.name} className="w-full aspect-square object-cover" />
                    )}
                  </label>
                ))}
              </div>

              <div className="flex items-center justify-between">
                <p className="text-xs text-zinc-600">未勾选的将自动归属所选孩子；未选孩子时内容会继续留在待确认池。</p>
                <div className="flex gap-2">
                  <button
                    onClick={() => setConfirmOpen(false)}
                    className="rounded-lg px-3 py-2 text-sm font-semibold text-zinc-700 hover:bg-zinc-100"
                  >
                    稍后确认
                  </button>
                  <button
                    onClick={confirmNow}
                    className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-zinc-800 disabled:cursor-not-allowed disabled:bg-zinc-400"
                    disabled={!selectedChildId || files.length === 0}
                  >
                    确认并写入
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {reviewOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
          onClick={() => setReviewOpen(false)}
          onWheel={(e) => e.stopPropagation()}
        >
          <div
            className="w-full max-w-5xl rounded-2xl bg-white p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
            style={{ maxHeight: "90vh", overflow: "hidden" }}
          >
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-zinc-900">确认 {children.find((c) => c.id === selectedChildId)?.name ?? "孩子"} 的人脸</h3>
                <p className="text-sm text-zinc-600">左侧为系统选出的头像，右侧请勾选属于该孩子的照片，可点击设为头像。</p>
              </div>
              <button
                onClick={() => setReviewOpen(false)}
                className="rounded-full bg-zinc-100 px-3 py-1 text-sm text-zinc-700 hover:bg-zinc-200"
              >
                关闭
              </button>
            </div>

            <div
              className="mt-4 grid gap-4"
              style={{ maxHeight: "70vh", gridTemplateColumns: "0.8fr 1.2fr" }}
            >
              <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4 shadow-sm overflow-y-auto flex flex-col items-center gap-3 justify-center">
                <p className="text-sm font-semibold text-zinc-800">头像预览</p>
                {avatarId ? (
                  <>
                    <div className="relative flex h-32 w-32 items-center justify-center overflow-hidden rounded-lg border border-zinc-200 bg-white">
                      <img
                        src={reviewItems.find((i) => i.photoId === avatarId)?.url}
                        alt="avatar"
                        className="h-full w-full object-cover"
                      />
                    </div>
                    <button
                      onClick={() => {
                        const img = reviewItems.find((i) => i.photoId === avatarId)?.url ?? "";
                        if (!img) return;
                        const newWin = window.open(img, "_blank", "noopener,noreferrer");
                        if (!newWin) alert("请允许弹窗以查看大图");
                      }}
                      className="rounded-full border border-zinc-200 px-3 py-1 text-xs font-semibold text-zinc-700 shadow-sm transition hover:border-zinc-300 hover:bg-white"
                    >
                      放大预览
                    </button>
                  </>
                ) : (
                  <div className="flex h-32 w-full items-center justify-center rounded-lg bg-white text-sm text-zinc-500">未选择</div>
                )}
              </div>

              <div className="rounded-xl border border-zinc-200 bg-white p-3 shadow-sm overflow-y-auto">
                <p className="text-sm font-semibold text-zinc-800 mb-2">请选择属于孩子的照片（可设为头像）</p>
                <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))" }}>
                  {reviewItems.map((item) => (
                    <label
                      key={item.photoId ?? item.name}
                      className={`relative block overflow-hidden rounded-lg border ${
                        reviewSelected.has(item.photoId ?? "") ? "border-blue-500 ring-2 ring-blue-200" : "border-zinc-200"
                      }`}
                    >
                      <input
                        type="checkbox"
                        className="absolute left-2 top-2 h-4 w-4"
                        checked={reviewSelected.has(item.photoId ?? "")}
                        onChange={() => {
                          const pid = item.photoId ?? "";
                          setReviewSelected((prev) => {
                            const next = new Set(Array.from(prev));
                            if (next.has(pid)) next.delete(pid);
                            else next.add(pid);
                            return next;
                          });
                        }}
                      />
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          setAvatarId(item.photoId ?? null);
                        }}
                        className={`absolute right-2 top-2 rounded-full px-2 py-1 text-[11px] font-semibold ${
                          avatarId === item.photoId ? "bg-blue-600 text-white" : "bg-black/60 text-white"
                        }`}
                      >
                        设为头像
                      </button>
                      {item.media_type === "video" ? (
                        <video muted playsInline className="w-full aspect-square object-cover">
                          <source src={item.url} />
                        </video>
                      ) : (
                        <img src={item.url} alt={item.name} className="w-full aspect-square object-cover" />
                      )}
                    </label>
                  ))}
                </div>
              </div>
            </div>

            <div className="mt-4 flex items-center justify-between">
              <p className="text-xs text-zinc-600">确认后将写入孩子的关联与人脸向量；未选中的将被移除本次上传。</p>
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    setReviewOpen(false);
                    cancelUploaded(reviewItems);
                  }}
                  className="rounded-full bg-zinc-200 px-4 py-2 text-sm font-semibold text-zinc-700 hover:bg-zinc-300"
                >
                  ✖ 取消
                </button>
                <button
                  onClick={async () => {
                    const ids = Array.from(reviewSelected).filter(Boolean);
                    await confirmNow(selectedChildId, ids);
                    setReviewOpen(false);
                    if (selectedChildId) {
                      router.push(`/children/${selectedChildId}`);
                    }
                  }}
                  disabled={reviewSelected.size === 0}
                  className="rounded-full bg-green-600 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-green-700 disabled:cursor-not-allowed disabled:bg-green-300"
                >
                  ✔ 确认
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </LayoutShell>
  );
}
