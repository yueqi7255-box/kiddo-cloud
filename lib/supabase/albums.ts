import { supabaseClient } from "./client";

function makeId() {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

const DEFAULT_ALBUM_NAME = "默认相册";

export async function ensureDefaultAlbum(userId: string) {
  if (!supabaseClient) return null;
  const { data: existing, error: existError } = await supabaseClient
    .from("albums")
    .select("id, name")
    .eq("user_id", userId)
    .eq("name", DEFAULT_ALBUM_NAME)
    .limit(1);
  if (existError) {
    console.log("查询默认相册失败", existError);
  }
  if (existing && existing.length > 0) return existing[0] as any;

  const { data: inserted, error: insertError } = await supabaseClient
    .from("albums")
    .insert({ user_id: userId, name: DEFAULT_ALBUM_NAME })
    .select("id, name")
    .maybeSingle();
  if (insertError) {
    if ((insertError as any).code === "23505") {
      const { data: retry } = await supabaseClient
        .from("albums")
        .select("id, name")
        .eq("user_id", userId)
        .eq("name", DEFAULT_ALBUM_NAME)
        .limit(1);
      if (retry && retry.length > 0) return retry[0] as any;
    }
    console.log("创建默认相册失败", insertError);
    return null;
  }
  return inserted as any;
}

export async function listUserAlbums(userId: string) {
  if (!supabaseClient) return [];
  const { data, error } = await supabaseClient
    .from("albums")
    .select("id, name")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (error) {
    console.log("查询相册失败", error);
    return [];
  }
  return data ?? [];
}
