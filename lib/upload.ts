import type { SupabaseClient } from "@supabase/supabase-js";

const ALLOWED = ["image/png", "image/jpeg", "image/gif", "image/webp"];

/**
 * Upload an image from a form field into the public `images` bucket, under the
 * player's own folder (storage RLS only allows that). Returns the public URL,
 * or null if the field was empty.
 */
export async function uploadImage(
  supabase: SupabaseClient,
  userId: string,
  file: FormDataEntryValue | null,
  folder: string,
): Promise<{ url: string | null; error?: string }> {
  if (!file || typeof file === "string" || file.size === 0) return { url: null };
  if (!ALLOWED.includes(file.type)) return { url: null, error: "Images must be PNG, JPG, GIF, or WebP." };
  if (file.size > 4 * 1024 * 1024) return { url: null, error: "Images must be under 4 MB." };

  const ext = file.type.split("/")[1].replace("jpeg", "jpg");
  const path = `${userId}/${folder}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const { error } = await supabase.storage.from("images").upload(path, file, { contentType: file.type });
  if (error) return { url: null, error: error.message };
  return { url: supabase.storage.from("images").getPublicUrl(path).data.publicUrl };
}
